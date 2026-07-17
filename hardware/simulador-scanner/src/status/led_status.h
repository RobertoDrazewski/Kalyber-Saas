#pragma once
#include <Arduino.h>

// ─────────────────────────────────────────────────────────────
// LedStatus — controla el WS2812 integrado de la placa (o el pin que
// definas en WS2812_PIN si tu core no expone RGB_BUILTIN) para
// mostrar el estado del equipo sin necesitar leer el OLED.
//
// Tabla de estados (igual a la documentada en README.md):
//   Arrancando              → Blanco tenue fijo
//   Pairing (portal WiFi)   → Azul parpadeante lento
//   Scanner OK, reportando  → Verde fijo
//   DTC recién detectado    → Verde parpadeo rápido x3, vuelve a verde fijo
//   Simulador activo        → Azul fijo
//   Sin internet            → Ámbar fijo
//   Falla de bus CAN/HW     → Rojo fijo
//   Apertura de gabinete    → Rojo parpadeante rápido
//
// [PENDIENTE — ver README] Confirmar el GPIO real del WS2812 en la
// placa concreta que compraste. Si tu core Arduino ya define
// RGB_BUILTIN para esta variante de ESP32-S3, se usa automático; si
// no, definí WS2812_PIN acá abajo con el pin real.
// ─────────────────────────────────────────────────────────────

#ifndef WS2812_PIN
  #ifdef RGB_BUILTIN
    #define WS2812_PIN RGB_BUILTIN
  #else
    #define WS2812_PIN 48  // ⚠️ PLACEHOLDER — confirmar contra tu placa concreta
  #endif
#endif

enum class SystemStatus {
  BOOTING,
  PAIRING,
  SCANNER_OK,
  SIMULATOR_ACTIVE,
  NO_INTERNET,
  BUS_ERROR,
  TAMPER,
};

class LedStatus {
public:
  void begin();
  void update();                 // no bloqueante — llamar siempre en loop()
  void setStatus(SystemStatus s);
  void pulseDtcFound();          // parpadeo verde x3 sin perder el estado de fondo

private:
  SystemStatus currentStatus = SystemStatus::BOOTING;
  bool pulsing = false;
  uint8_t pulseCount = 0;
  unsigned long lastToggle = 0;
  bool blinkOn = true;

  void showColor(uint8_t r, uint8_t g, uint8_t b);
  void tickBlink(uint8_t r, uint8_t g, uint8_t b, uint16_t intervalMs);
  void tickPulse();
};

extern LedStatus ledStatus;
