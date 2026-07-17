#include "mode_arbiter.h"

ModeArbiter modeArbiter;

void ModeArbiter::begin(uint8_t modeSensePin) {
  pin = modeSensePin;
  pinMode(pin, INPUT); // pull-down ya resuelto por hardware (R 10kΩ), ver traspaso de contexto
  read();
}

OperatingMode ModeArbiter::read() {
  mode = (digitalRead(pin) == HIGH) ? OperatingMode::SIMULATOR : OperatingMode::SCANNER;
  return mode;
}
