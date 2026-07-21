#include "j1939_engine.h"

J1939Engine j1939Engine;

constexpr uint32_t PGN_DM1 = 0xFECA; // 65226 decimal — Active Diagnostic Trouble Codes

void J1939Engine::begin() {
  pendingDtcs.clear();
}

J1939Engine::J1939Header J1939Engine::decodeHeader(uint32_t canId) {
  J1939Header hdr;
  // ID extendido de 29 bits: Priority(3) | PGN(18) | Source Address(8)
  hdr.priority = (canId >> 26) & 0x07;
  hdr.pgn      = (canId >> 8) & 0x3FFFF;
  hdr.sourceAddress = canId & 0xFF;

  // Si el PDU Format (byte alto del PGN) es < 240, es formato PDU1
  // (mensaje dirigido, el byte bajo del PGN es la dirección destino,
  // no forma parte del PGN real). Para DM1 esto no aplica porque es
  // PDU2 (broadcast), pero lo dejamos comentado como referencia para
  // cuando sumes otros PGNs dirigidos más adelante:
  //
  // uint8_t pf = (hdr.pgn >> 8) & 0xFF;
  // if (pf < 240) { /* PDU1: reconstruir PGN sin el byte de destino */ }

  return hdr;
}

void J1939Engine::parseDm1(const J1939Header& hdr, const uint8_t* data, uint8_t len) {
  // Bytes 0-1: estado de las lámparas (MIL, stop, warning, protect) — no
  // se parsea acá, solo interesa extraer los DTCs a partir del byte 2.
  if (len < 6) return; // un DM1 con al menos un DTC tiene mínimo 6 bytes

  // A partir del byte 2, se repiten bloques de 4 bytes por cada DTC activo.
  for (int offset = 2; offset + 4 <= len; offset += 4) {
    uint8_t b1 = data[offset];     // SPN bits 1-8
    uint8_t b2 = data[offset + 1]; // SPN bits 9-16
    uint8_t b3 = data[offset + 2]; // bits 1-5 = FMI | bits 6-8 = SPN bits 17-19
    uint8_t b4 = data[offset + 3]; // bits 1-7 = OC | bit 8 = Conversion Method

    J1939Dtc dtc;
    dtc.spn = (uint32_t)b1 | ((uint32_t)b2 << 8) | (((uint32_t)b3 >> 5) << 16);
    dtc.fmi = b3 & 0x1F;
    dtc.occurrenceCount = b4 & 0x7F;
    dtc.sourceAddress = hdr.sourceAddress;

    // SPN 0 con FMI 0 suele ser relleno de "sin más DTCs" en algunos
    // fabricantes — filtramos ese caso degenerado.
    if (dtc.spn == 0 && dtc.fmi == 0) continue;

    pendingDtcs.push_back(dtc);
  }
}

bool J1939Engine::processExtendedFrame(uint32_t canId, const uint8_t* data, uint8_t len) {
  J1939Header hdr = decodeHeader(canId);

  if (hdr.pgn != PGN_DM1) {
    return false; // no es un mensaje de diagnóstico, se ignora en este motor
  }

  size_t before = pendingDtcs.size();
  parseDm1(hdr, data, len);
  return pendingDtcs.size() > before;
}

std::vector<J1939Dtc> J1939Engine::consumeNewDtcs() {
  std::vector<J1939Dtc> copy = pendingDtcs;
  pendingDtcs.clear();
  return copy;
}
