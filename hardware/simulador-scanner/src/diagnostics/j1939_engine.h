#pragma once
#include <Arduino.h>
#include <vector>

// ─────────────────────────────────────────────────────────────
// J1939Engine — decodifica tramas J1939 sobre el mismo bus CAN
// físico que ya usás para OBD-II (SN65HVD230, GPIO 4/5 TX/RX).
//
// Diferencia clave con OBD-II ISO 15765-4:
//   - OBD-II usa IDs estándar de 11 bits (0x7DF, 0x7E8-0x7EF)
//   - J1939 usa IDs extendidos de 29 bits, con estructura:
//     Priority (3 bits) + PGN (18 bits: PF + PS) + Source Address (8 bits)
//
// El TWAI del ESP32-S3 soporta ambos formatos de frame en el
// mismo bus — la diferencia se distingue por el flag de "extended
// ID" de cada mensaje recibido, no por configuración de hardware.
//
// ⚠️ VALIDACIÓN PENDIENTE: la estructura del mensaje DM1 (Active
// Diagnostic Trouble Codes, PGN 65226 / 0xFECA) que se decodifica
// acá sigue el estándar SAE J1939-73 tal como lo recuerdo, pero
// los offsets de bits para SPN/FMI/OC hay que confirmarlos contra
// tramas reales capturadas con el modo sniffer antes de confiar
// en la traducción en un equipo de producción. No asumas que el
// primer build decodifica bien sin esa validación de campo.
// ─────────────────────────────────────────────────────────────

struct J1939Dtc {
  uint32_t spn;       // Suspect Parameter Number — identifica QUÉ falló
  uint8_t  fmi;        // Failure Mode Identifier — CÓMO falló (rango, corto, etc.)
  uint8_t  occurrenceCount;
  uint8_t  sourceAddress; // qué ECU del vehículo lo reportó (motor, transmisión, etc.)
};

class J1939Engine {
public:
  void begin();

  // Llamar con cada frame CAN extendido recibido del TWAI driver.
  // Devuelve true si el frame era un DM1 y se extrajeron DTCs nuevos.
  bool processExtendedFrame(uint32_t canId, const uint8_t* data, uint8_t len);

  bool hasNewDtcs() const { return !pendingDtcs.empty(); }
  std::vector<J1939Dtc> consumeNewDtcs(); // vacía la cola al leerla

private:
  std::vector<J1939Dtc> pendingDtcs;

  struct J1939Header {
    uint8_t  priority;
    uint32_t pgn;
    uint8_t  sourceAddress;
  };

  J1939Header decodeHeader(uint32_t canId);
  void parseDm1(const J1939Header& hdr, const uint8_t* data, uint8_t len);
};

extern J1939Engine j1939Engine;
