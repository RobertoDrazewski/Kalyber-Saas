#pragma once
#include <Arduino.h>

// ─────────────────────────────────────────────────────────────
// DisplayManager — OLED SH1106 1.3" I2C (Adafruit_SH110X + Adafruit_GFX)
//
// GPIO confirmados (ver traspaso de contexto): SDA=8, SCL=9.
//
// [NOTA IMPORTANTE sobre el logo] No tengo el archivo de imagen del
// logo de Kalyber — así que en vez de inventar un bitmap (que se
// vería mal o directamente no correspondería a tu marca real), armé
// un wordmark tipográfico "KALYBER" en el font grande de Adafruit_GFX,
// que es lo mismo que ya usa el resto de tu plataforma en texto. Si me
// pasás tu logo como PNG monocromático (ideal: fondo transparente o
// negro, trazo blanco, cuadrado o rectangular chico — 64x32 o 128x32px
// funciona perfecto para este display de 128x64), lo convierto a un
// array de bytes XBM y lo reemplazo acá sin tocar el resto del código.
// ─────────────────────────────────────────────────────────────

enum class DisplayScreen {
  BOOT,       // logo + "Iniciando..."
  PAIRING,    // instrucciones de portal cautivo
  LIVE,       // WiFi / taller / último DTC — la pantalla principal
  DTC_FOUND,  // código de falla recién detectado, a pantalla completa unos segundos
  ERROR,      // fallo de bus/hardware
};

// Datos que la pantalla LIVE necesita mostrar — se los pasa main.cpp
// cada vez que algo cambia, no hace falta que DisplayManager sepa de
// WiFi/BackendClient/CanEngine directamente (bajo acoplamiento).
struct LiveStatus {
  bool wifiConnected = false;
  bool paired = false;
  String workshopName = "";      // vacío si todavía no se sabe
  String currentPatente = "";    // vacío = sin patente activa seteada por Serial
  String lastDtcCode = "";       // vacío = sin fallas detectadas todavía
  String lastDtcDesc = "";
  unsigned long lastDtcAtMs = 0; // millis() de cuándo se detectó, para "hace Xs"
  int dtcsThisSession = 0;
};

class DisplayManager {
public:
  bool begin();  // devuelve false si no encontró el display en el bus I2C — para no colgar el boot si el OLED todavía no está soldado
  void showBoot();
  void showPairingInstructions(const String& apName);
  void showLive(const LiveStatus& status);
  void showDtcFound(const String& code, const String& desc);
  void showError(const String& message);

private:
  bool displayOk = false;
  void drawWordmark(int16_t y); // "KALYBER" — ver nota del logo arriba
};

extern DisplayManager displayManager;
