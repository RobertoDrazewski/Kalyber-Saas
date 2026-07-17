#pragma once
#include <Arduino.h>

enum class OperatingMode { SCANNER, SIMULATOR };

// ─────────────────────────────────────────────────────────────
// ModeArbiter — lee el switch DPDT (polo B, sensado en GPIO 21) y
// decide el modo. HIGH = Simulador (polo B a 3.3V), LOW = Scanner
// (pull-down a GND, resuelto por hardware con R de 10kΩ).
//
// [SIMPLIFICADO A PROPÓSITO] Tu traspaso de contexto describe esto
// como "arbitraje sin reiniciar, coordina acceso al bus CAN" — para
// el prototipo actual (donde probás en un taller real, sin simulador
// todavía en uso según tu plan de validación), lo que hace falta es
// leer el switch de forma confiable y exponer el modo actual. Si más
// adelante necesitás cambiar de modo EN CALIENTE sin reiniciar
// (crítico si el simulador y el scanner llegan a competir por el
// mismo bus CAN a la vez), ahí se amplía esto con la coordinación de
// acceso real — no lo armé de antemano para no adivinar un requisito
// que tu plan de validación actual no necesita todavía.
// ─────────────────────────────────────────────────────────────
class ModeArbiter {
public:
  void begin(uint8_t modeSensePin);
  OperatingMode read();
  OperatingMode current() const { return mode; }

private:
  uint8_t pin = 0;
  OperatingMode mode = OperatingMode::SCANNER;
};

extern ModeArbiter modeArbiter;
