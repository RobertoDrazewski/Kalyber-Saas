#include "sim_engine.h"

SimEngine simEngine;

void SimEngine::begin(uint8_t relayPin) {
  pin = relayPin;
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW); // arranca apagado, siempre — ver nota de seguridad en el .h
  ignitionOn = false;
}

void SimEngine::setIgnition(bool on) {
  ignitionOn = on;
  digitalWrite(pin, on ? HIGH : LOW);
}
