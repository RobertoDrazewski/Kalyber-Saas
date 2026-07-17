#include <Arduino.h>
#include "status/led_status.h"
#include "network/backend_client.h"

// ─────────────────────────────────────────────────────────────
// Pines confirmados (ver plano de circuito completo)
// ─────────────────────────────────────────────────────────────
#define PIN_MODE_SENSE   21   // GPIO leído desde el polo B del DPDT
#define PIN_CAN_TX       4
#define PIN_CAN_RX       5
#define PIN_RELAY_GATE   15   // IRLZ44N — ignición simulada

enum class OperatingMode { SCANNER, SIMULATOR };
OperatingMode currentMode;

// Placeholders — reemplazar por las clases reales del ModeArbiter,
// CanEngine, ISO15765Transport, etc. que ya definimos en la guía.
bool wifiConnected = false;
bool busHealthy = true;

void readOperatingMode() {
  // HIGH = Simulador (polo B conectado a 3.3V), LOW = Scanner (pull-down a GND)
  currentMode = digitalRead(PIN_MODE_SENSE) == HIGH
                  ? OperatingMode::SIMULATOR
                  : OperatingMode::SCANNER;
}

void setup() {
  Serial.begin(115200);
  delay(300); // margen para que el monitor serie enganche al abrir

  pinMode(PIN_MODE_SENSE, INPUT); // pull-down ya resuelto por hardware (R 10kΩ)
  pinMode(PIN_RELAY_GATE, OUTPUT);
  digitalWrite(PIN_RELAY_GATE, LOW); // ignición simulada arranca apagada, por seguridad

  ledStatus.begin();
  backendClient.begin();

  readOperatingMode();
  Serial.printf("[BOOT] Modo detectado: %s\n",
                currentMode == OperatingMode::SCANNER ? "SCANNER" : "SIMULATOR");

  // ... acá va WiFiManager.autoConnect(), init de TWAI, etc.
  // Al conectar WiFi:
  //   wifiConnected = true;
  //   ledStatus.setStatus(SystemStatus::SCANNER_OK);
  // Si entra en portal cautivo:
  //   ledStatus.setStatus(SystemStatus::PAIRING);
}

void loop() {
  ledStatus.update(); // no bloqueante, hay que llamarlo siempre

  // ── Ejemplo de uso en modo Scanner ──
  if (currentMode == OperatingMode::SCANNER) {
    // if (canEngine.hasNewDtc()) {
    //   String code = canEngine.getLastDtc();
    //   String desc = dtcDatabase.translate(code);
    //   Serial.printf("[SCANNER] DTC detectado: %s - %s\n", code.c_str(), desc.c_str());
    //   ledStatus.pulseDtcFound();
    //   backendClient.postDiagnostic(
    //     currentPatente,       // resuelta previamente (input manual o VIN decodificado)
    //     code,
    //     desc,
    //     "local",              // o "remote" si vino de la API de traducción
    //     DEVICE_IMEI
    //   );
    // }

    if (!wifiConnected) {
      ledStatus.setStatus(SystemStatus::NO_INTERNET);
    }
    if (!busHealthy) {
      ledStatus.setStatus(SystemStatus::BUS_ERROR);
    }
  }

  // ── Ejemplo de uso en modo Simulador ──
  if (currentMode == OperatingMode::SIMULATOR) {
    ledStatus.setStatus(SystemStatus::SIMULATOR_ACTIVE);
    // Serial.printf("[SIMULATOR] Ignition: %s\n", ignitionOn ? "ON" : "OFF");
  }
}
