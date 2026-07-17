#include "iso15765_transport.h"
#include "driver/twai.h"

ISO15765Transport isoTp;

// GPIO confirmados (ver traspaso de contexto)
#define CAN_TX_PIN GPIO_NUM_4
#define CAN_RX_PIN GPIO_NUM_5

#define OBD_REQUEST_ID 0x7DF
// Respuestas de ECU válidas: 0x7E8 - 0x7EF

bool ISO15765Transport::begin() {
  twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_NORMAL);
  twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS(); // 500kbps — el estándar de la mayoría de los vehículos OBD-II sobre CAN; algunos usan 250kbps, ver nota abajo
  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

  if (twai_driver_install(&g_config, &t_config, &f_config) != ESP_OK) {
    Serial.println("[ISO15765] Error instalando el driver TWAI");
    busHealthy = false;
    return false;
  }
  if (twai_start() != ESP_OK) {
    Serial.println("[ISO15765] Error arrancando TWAI");
    busHealthy = false;
    return false;
  }
  // [PENDIENTE DE VALIDAR CONTRA HARDWARE REAL] Algunos vehículos
  // (sobre todo utilitarios/diesel más viejos) usan 250kbps en vez de
  // 500kbps. Si al conectar a un auto real no hay respuesta y
  // isBusHealthy() da true (o sea, el transceptor está bien pero
  // nadie contesta), probar cambiar a TWAI_TIMING_CONFIG_250KBITS()
  // acá — no lo hardcodeo como auto-detect todavía porque no lo
  // probé contra un vehículo real.
  busHealthy = true;
  return true;
}

bool ISO15765Transport::sendFrame(uint32_t id, const uint8_t* data, uint8_t len) {
  twai_message_t message;
  message.identifier = id;
  message.extd = 0;       // ID estándar de 11 bits (0x7DF), no extendido
  message.rtr = 0;
  message.data_length_code = 8; // ISO-TP siempre manda frames de 8 bytes, rellenando con 0x00/0xCC lo que sobra
  for (int i = 0; i < 8; i++) message.data[i] = (i < len) ? data[i] : 0x00;

  return twai_transmit(&message, pdMS_TO_TICKS(100)) == ESP_OK;
}

bool ISO15765Transport::receiveFrame(uint32_t& id, uint8_t* data, uint8_t& len, uint32_t timeoutMs) {
  twai_message_t message;
  if (twai_receive(&message, pdMS_TO_TICKS(timeoutMs)) != ESP_OK) return false;
  id = message.identifier;
  len = message.data_length_code;
  memcpy(data, message.data, len);
  return true;
}

bool ISO15765Transport::request(const std::vector<uint8_t>& payload, std::vector<uint8_t>& response, uint32_t timeoutMs) {
  response.clear();
  if (payload.empty() || payload.size() > 4095) return false; // ISO-TP multi-frame soporta hasta 4095 bytes de payload, de sobra para OBD-II

  // ---- Envío: Single Frame si entra en 7 bytes, si no First Frame + Consecutive Frames ----
  if (payload.size() <= 7) {
    uint8_t frame[8] = {0};
    frame[0] = payload.size(); // PCI: Single Frame, 4 bits altos en 0, 4 bits bajos = longitud
    for (size_t i = 0; i < payload.size(); i++) frame[i + 1] = payload[i];
    if (!sendFrame(OBD_REQUEST_ID, frame, 8)) return false;
  } else {
    // Multi-frame de ENVÍO — poco común para pedidos OBD-II estándar
    // (los pedidos son cortos, 2-6 bytes), pero lo dejamos completo
    // por si algún día se necesita mandar algo más largo.
    uint8_t firstFrame[8] = {0};
    firstFrame[0] = 0x10 | ((payload.size() >> 8) & 0x0F);
    firstFrame[1] = payload.size() & 0xFF;
    for (int i = 0; i < 6; i++) firstFrame[i + 2] = payload[i];
    if (!sendFrame(OBD_REQUEST_ID, firstFrame, 8)) return false;

    size_t sent = 6;
    uint8_t seq = 1;
    while (sent < payload.size()) {
      uint8_t cf[8] = {0};
      cf[0] = 0x20 | (seq & 0x0F);
      size_t chunk = std::min((size_t)7, payload.size() - sent);
      for (size_t i = 0; i < chunk; i++) cf[i + 1] = payload[sent + i];
      if (!sendFrame(OBD_REQUEST_ID, cf, 8)) return false;
      sent += chunk;
      seq++;
      delay(10); // margen entre consecutive frames — sin flow control real del lado del sender, un delay chico es más seguro que mandar todo pegado
    }
  }

  // ---- Recepción: puede venir Single Frame o First+Consecutive Frames ----
  uint32_t rxId; uint8_t rxData[8]; uint8_t rxLen;
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    if (!receiveFrame(rxId, rxData, rxLen, timeoutMs - (millis() - start))) continue;
    if (rxId < 0x7E8 || rxId > 0x7EF) continue; // ignoramos tráfico que no sea respuesta OBD-II

    uint8_t pciType = (rxData[0] & 0xF0) >> 4;

    if (pciType == 0x0) {
      // Single Frame — respuesta completa en un solo frame
      uint8_t len = rxData[0] & 0x0F;
      for (int i = 0; i < len; i++) response.push_back(rxData[i + 1]);
      return true;
    }

    if (pciType == 0x1) {
      // First Frame — hay más datos, hay que pedir que sigan (Flow Control) y juntar Consecutive Frames
      uint16_t totalLen = ((rxData[0] & 0x0F) << 8) | rxData[1];
      for (int i = 0; i < 6; i++) response.push_back(rxData[i + 2]);

      // Flow Control: "seguí mandando, sin límite de bloque, sin espera extra"
      uint8_t fc[8] = { 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
      sendFrame(0x7E0, fc, 8); // 0x7E0 = ID funcional típico hacia la ECU que respondió — [PENDIENTE validar contra hardware real si hace falta usar rxId-8 en vez de un fijo]

      while (response.size() < totalLen) {
        if (!receiveFrame(rxId, rxData, rxLen, 500)) break;
        if ((rxData[0] & 0xF0) != 0x20) continue; // no es un Consecutive Frame válido
        for (int i = 1; i < 8 && response.size() < totalLen; i++) response.push_back(rxData[i]);
      }
      return response.size() >= totalLen;
    }
    // pciType 0x2 (Consecutive Frame suelto, sin First Frame previo) o
    // 0x3 (Flow Control, no debería llegar acá) — se ignoran.
  }
  return false; // timeout — auto no contestó (apagado, protocolo distinto, o no soporta el modo pedido)
}
