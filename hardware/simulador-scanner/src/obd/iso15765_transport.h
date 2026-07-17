#pragma once
#include <Arduino.h>
#include <vector>

// ─────────────────────────────────────────────────────────────
// ISO15765Transport — ensamblado/desensamblado ISO-TP (ISO 15765-2)
// sobre CAN clásico, para hablar OBD-II estándar (SAE J1979) por
// direccionamiento funcional.
//
// Esto SÍ es un estándar público, bien documentado, igual en
// cualquier vehículo con puerto OBD-II desde 1996 (EE.UU.) / 2001
// (UE, nafta) / 2004 (UE, diesel) en adelante — a diferencia de la
// traducción de DTCs específicos de fabricante (eso NO está acá,
// ver dtc_database.h), el transporte y el pedido de códigos
// genéricos es el mismo para Toyota, Ford, VW, lo que sea.
//
// ID de pedido (functional/broadcast): 0x7DF
// IDs de respuesta típicos de ECU:      0x7E8 a 0x7EF
//
// Frames largos (>7 bytes de payload) usan el protocolo de
// First Frame / Consecutive Frame / Flow Control de ISO-TP — lo
// normal para Mode 03 con varios DTCs a la vez.
// ─────────────────────────────────────────────────────────────

class ISO15765Transport {
public:
  bool begin();

  // Manda un pedido OBD-II (ej: {0x01, 0x03} = Mode 03, "leer DTCs
  // almacenados") y devuelve el payload ensamblado de la respuesta,
  // ya sin los bytes de framing ISO-TP. Bloqueante hasta timeoutMs.
  bool request(const std::vector<uint8_t>& payload, std::vector<uint8_t>& response, uint32_t timeoutMs = 1000);

  bool isBusHealthy() const { return busHealthy; }

private:
  bool busHealthy = true;
  bool sendFrame(uint32_t id, const uint8_t* data, uint8_t len);
  bool receiveFrame(uint32_t& id, uint8_t* data, uint8_t& len, uint32_t timeoutMs);
};

extern ISO15765Transport isoTp;
