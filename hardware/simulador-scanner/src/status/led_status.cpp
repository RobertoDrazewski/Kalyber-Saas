#include "led_status.h"
#include <Adafruit_NeoPixel.h>

LedStatus ledStatus;

static Adafruit_NeoPixel pixel(1, WS2812_PIN, NEO_GRB + NEO_KHZ800);

void LedStatus::begin() {
  pixel.begin();
  pixel.setBrightness(60); // tenue a propósito — este LED vive prendido todo el tiempo, no encandila en un banco de trabajo
  showColor(20, 20, 20);   // blanco tenue = arrancando
}

void LedStatus::showColor(uint8_t r, uint8_t g, uint8_t b) {
  pixel.setPixelColor(0, pixel.Color(r, g, b));
  pixel.show();
}

void LedStatus::setStatus(SystemStatus s) {
  if (currentStatus == s && !pulsing) return; // evita re-escribir el mismo color en cada loop()
  currentStatus = s;
  pulsing = false;

  switch (s) {
    case SystemStatus::BOOTING:          showColor(20, 20, 20); break;
    case SystemStatus::SCANNER_OK:       showColor(0, 60, 0);   break;
    case SystemStatus::SIMULATOR_ACTIVE: showColor(0, 0, 60);   break;
    case SystemStatus::NO_INTERNET:      showColor(60, 40, 0);  break; // ámbar
    case SystemStatus::BUS_ERROR:        showColor(60, 0, 0);   break;
    // PAIRING y TAMPER parpadean — el color base lo pone tickBlink() en update()
    case SystemStatus::PAIRING:
    case SystemStatus::TAMPER:
    default: break;
  }
}

void LedStatus::pulseDtcFound() {
  // Parpadeo verde rápido x3 SIN pisar currentStatus — al terminar,
  // vuelve solo al color que corresponda (normalmente SCANNER_OK).
  pulsing = true;
  pulseCount = 0;
  lastToggle = millis();
  blinkOn = true;
}

void LedStatus::tickBlink(uint8_t r, uint8_t g, uint8_t b, uint16_t intervalMs) {
  unsigned long now = millis();
  if (now - lastToggle >= intervalMs) {
    lastToggle = now;
    blinkOn = !blinkOn;
    if (blinkOn) showColor(r, g, b);
    else showColor(0, 0, 0);
  }
}

void LedStatus::tickPulse() {
  // 3 parpadeos rápidos (150ms) en verde, después vuelve al estado normal.
  unsigned long now = millis();
  if (now - lastToggle >= 150) {
    lastToggle = now;
    blinkOn = !blinkOn;
    if (blinkOn) {
      showColor(0, 120, 0);
    } else {
      showColor(0, 0, 0);
      pulseCount++;
    }
    if (pulseCount >= 3) {
      pulsing = false;
      setStatus(currentStatus); // fuerza redibujar el color de fondo real
      // setStatus de arriba compara currentStatus==s y no haría nada
      // porque son iguales — forzamos el color acá directo:
      switch (currentStatus) {
        case SystemStatus::SCANNER_OK: showColor(0, 60, 0); break;
        default: break;
      }
    }
  }
}

void LedStatus::update() {
  if (pulsing) { tickPulse(); return; }

  switch (currentStatus) {
    case SystemStatus::PAIRING: tickBlink(0, 0, 60, 600);  break; // azul lento
    case SystemStatus::TAMPER:  tickBlink(60, 0, 0, 150);  break; // rojo rápido
    default: break; // el resto son colores fijos, ya seteados en setStatus()
  }
}
