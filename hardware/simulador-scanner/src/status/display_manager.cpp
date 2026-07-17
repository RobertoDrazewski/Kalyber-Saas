#include "display_manager.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>

DisplayManager displayManager;

#define OLED_I2C_ADDR 0x3C   // dirección típica de estos módulos SH1106 — si el tuyo viene en 0x3D, cambiar acá
#define OLED_SDA 8
#define OLED_SCL 9
#define SCREEN_W 128
#define SCREEN_H 64

static Adafruit_SH1106G display(SCREEN_W, SCREEN_H, &Wire, -1);

bool DisplayManager::begin() {
  Wire.begin(OLED_SDA, OLED_SCL);
  displayOk = display.begin(OLED_I2C_ADDR, true);
  if (!displayOk) {
    // No colgamos el boot por esto — el equipo tiene que poder seguir
    // funcionando (LED + backend) aunque el OLED todavía no esté
    // soldado o falle, sobre todo mientras arma el prototipo de a
    // partes.
    Serial.println("[DisplayManager] OLED no detectado en el bus I2C — el equipo sigue funcionando sin pantalla");
    return false;
  }
  display.setRotation(0);
  display.clearDisplay();
  display.display();
  return true;
}

void DisplayManager::drawWordmark(int16_t y) {
  // "KALYBER" — ver nota completa en el .h sobre por qué es texto y
  // no un bitmap del logo real todavía.
  display.setTextSize(2);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(8, y);
  display.print("KALYBER");
  display.setTextSize(1);
  display.setCursor(10, y + 18);
  display.print("Scanner Diagnostics");
}

void DisplayManager::showBoot() {
  if (!displayOk) return;
  display.clearDisplay();
  drawWordmark(6);
  display.drawFastHLine(0, 34, SCREEN_W, SH110X_WHITE);
  display.setCursor(0, 44);
  display.print("Iniciando...");
  display.display();
}

void DisplayManager::showPairingInstructions(const String& apName) {
  if (!displayOk) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 0);
  display.println("MODO PAREO");
  display.drawFastHLine(0, 10, SCREEN_W, SH110X_WHITE);
  display.setCursor(0, 16);
  display.println("1. Conecte su celular");
  display.println("   al WiFi:");
  display.setTextSize(1);
  display.setCursor(0, 34);
  display.print("   ");
  display.println(apName);
  display.setCursor(0, 48);
  display.println("2. Se abre un portal");
  display.println("   solo. Si no, abra");
  display.println("   192.168.4.1");
  display.display();
}

// Pantalla principal — la que está viva la mayor parte del tiempo,
// con exactamente lo mismo que ves por serial y en el panel de
// Railway: estado de WiFi, si está pareado a un taller, y el último
// DTC leído.
void DisplayManager::showLive(const LiveStatus& status) {
  if (!displayOk) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);

  display.setCursor(0, 0);
  display.print("KALYBER DIAGNOSTICS");
  display.drawFastHLine(0, 9, SCREEN_W, SH110X_WHITE);

  display.setCursor(0, 14);
  display.print("WiFi: ");
  display.print(status.wifiConnected ? "Conectado" : "Sin conexion");

  display.setCursor(0, 24);
  display.print("Taller: ");
  if (status.paired) {
    display.print(status.workshopName.length() > 0 ? status.workshopName : "Pareado");
  } else {
    display.print("Sin parear");
  }

  display.drawFastHLine(0, 34, SCREEN_W, SH110X_WHITE);

  display.setCursor(0, 40);
  if (status.currentPatente.length() > 0) {
    display.print("Auto: ");
    display.println(status.currentPatente);
  }

  display.setCursor(0, status.currentPatente.length() > 0 ? 50 : 40);
  if (status.lastDtcCode.length() == 0) {
    display.print("DTC: Listo, sin fallas");
  } else {
    display.print("DTC: ");
    display.println(status.lastDtcCode);
  }

  display.setCursor(0, 56);
  display.print("Sesion: ");
  display.print(status.dtcsThisSession);
  display.print(" DTC(s)");

  display.display();
}

void DisplayManager::showDtcFound(const String& code, const String& desc) {
  if (!displayOk) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 0);
  display.print("¡DTC DETECTADO!");
  display.drawFastHLine(0, 10, SCREEN_W, SH110X_WHITE);
  display.setTextSize(2);
  display.setCursor(4, 20);
  display.print(code);
  display.setTextSize(1);
  display.setCursor(0, 44);
  String d = desc;
  if (d.length() > 21) d = d.substring(0, 21);
  display.println(d);
  if (desc.length() > 21) {
    display.setCursor(0, 54);
    display.println(desc.substring(21, std::min((size_t)42, desc.length())));
  }
  display.display();
}

void DisplayManager::showError(const String& message) {
  if (!displayOk) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 0);
  display.print("⚠ ERROR");
  display.drawFastHLine(0, 10, SCREEN_W, SH110X_WHITE);
  display.setCursor(0, 20);
  display.println(message);
  display.display();
}
