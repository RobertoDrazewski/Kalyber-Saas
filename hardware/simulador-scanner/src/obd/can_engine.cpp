#include "can_engine.h"
#include "iso15765_transport.h"
#include "dtc_database.h"

CanEngine canEngine;

bool CanEngine::begin() {
  return isoTp.begin();
}

bool CanEngine::isBusHealthy() const {
  return isoTp.isBusHealthy();
}

std::vector<DtcReading> CanEngine::readStoredDtcs() {
  std::vector<DtcReading> result;

  std::vector<uint8_t> request = { 0x01, 0x03 }; // Mode 03 no lleva PID — se manda como si fuera "Mode 01, PID 0x03" en algunos scanners pero el estándar real es un solo byte 0x03. Ver nota abajo.
  // [CORRECCIÓN] El pedido Mode 03 real es UN byte: {0x03}. El "0x01"
  // de arriba fue un error de borrador — lo dejo comentado en vez de
  // silenciosamente cambiarlo, para que quede visible en el diff qué
  // se corrigió:
  request = { 0x03 };

  std::vector<uint8_t> response;
  if (!isoTp.request(request, response, 1000)) {
    return result; // timeout — auto apagado, sin señal, o no respondió a este modo
  }

  // Respuesta esperada: byte 0 = 0x43 (Mode 03 + 0x40 = respuesta
  // positiva), byte 1 = cantidad de DTCs, luego 2 bytes por cada DTC.
  if (response.empty() || response[0] != 0x43) {
    return result; // respuesta negativa o inesperada
  }

  for (size_t i = 1; i + 1 < response.size(); i += 2) {
    uint8_t high = response[i];
    uint8_t low = response[i + 1];
    if (high == 0x00 && low == 0x00) continue; // relleno, no un DTC real

    String code = decodeDtcStructure(high, low);
    DtcReading r;
    r.code = code;
    r.description = translateDtc(code);
    r.isGeneric = (code.length() >= 2 && code.charAt(1) == '0');
    result.push_back(r);
  }

  return result;
}

bool CanEngine::hasNewDtc() {
  pendingNew.clear();
  auto current = readStoredDtcs();

  for (auto& d : current) {
    bool alreadySeen = false;
    for (auto& k : knownCodes) {
      if (k == d.code) { alreadySeen = true; break; }
    }
    if (!alreadySeen) {
      knownCodes.push_back(d.code);
      pendingNew.push_back(d);
    }
  }
  return !pendingNew.empty();
}

DtcReading CanEngine::getLastNewDtc() {
  if (pendingNew.empty()) return DtcReading{ "", "", false };
  return pendingNew.back();
}
