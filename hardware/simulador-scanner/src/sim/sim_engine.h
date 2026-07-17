#pragma once
#include <Arduino.h>

// ─────────────────────────────────────────────────────────────
// SimEngine — control de la ignición simulada del banco de pruebas,
// vía el MOSFET IRLZ44N en GPIO 15 (ver traspaso de contexto).
//
// Por seguridad: arranca SIEMPRE apagado (LOW) — nunca se energiza
// solo al bootear, tiene que ser una acción explícita.
// ─────────────────────────────────────────────────────────────
class SimEngine {
public:
  void begin(uint8_t relayPin);
  void setIgnition(bool on);
  bool isIgnitionOn() const { return ignitionOn; }

private:
  uint8_t pin = 0;
  bool ignitionOn = false;
};

extern SimEngine simEngine;
