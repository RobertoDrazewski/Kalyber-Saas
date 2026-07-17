#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include "status/led_status.h"
#include "status/display_manager.h"
#include "network/backend_client.h"
#include "obd/can_engine.h"
#include "mode_arbiter.h"
#include "sim/sim_engine.h"

// ─────────────────────────────────────────────────────────────
// Kalyber Scanner/Simulador — firmware principal
//
// OBJETIVO DE ESTA VERSIÓN: apenas armes el hardware, cargás esto UNA
// vez, y de ahí en más es "conectar y listo" — la primera vez entra
// en modo pareo (portal WiFi cautivo, donde cargás el WiFi del taller
// + el token que te da la app), y las veces siguientes se conecta
// solo con lo que ya guardó.
//
// [PENDIENTE DE VALIDAR CONTRA HARDWARE REAL] Todo lo de WiFi/portal/
// display/LED está escrito siguiendo las APIs documentadas de cada
// librería, pero no se ejecutó en un ESP32-S3 real (no hay forma de
// emular esto en este entorno). Cuando cargues esto a la placa por
// primera vez, mirá el monitor serie (115200 baudios) — ahí vas a ver
// cada paso con su resultado, para poder ubicar rápido si algo no
// coincide con tu hardware concreto (dirección I2C del OLED distinta,
// pin del WS2812 distinto, etc.)
// ─────────────────────────────────────────────────────────────

// ---- Pines confirmados (ver traspaso de contexto) ----
#define PIN_MODE_SENSE   21
#define PIN_RELAY_GATE   15
// CAN (4,5) e I2C (8,9) se configuran adentro de sus propios módulos
// (can_engine / display_manager) — no hace falta repetirlos acá.

// ---- Parámetro custom del portal cautivo: el token del equipo ----
// Esto es lo que el mecánico pega en el portal WiFi la primera vez,
// junto con el SSID/password de su local — se lo dio la app al parear
// el equipo (POST /api/scanner/devices/claim). Se guarda en la NVS
// del ESP32 vía WiFiManager, así que sobrevive a reinicios/cortes de
// luz sin tener que volver a cargarlo cada vez.
WiFiManagerParameter customDeviceToken("device_token", "Token del equipo (de la app Kalyber)", "", 80);
WiFiManagerParameter customDeviceImei("device_imei", "IMEI/ID del equipo (el mismo que pareaste)", "", 20);

Preferences prefs; // NVS — para persistir token/imei fuera del ciclo de vida de WiFiManager

String deviceToken;
String deviceImei;
bool wifiConnected = false;
LiveStatus liveStatus;

// [NUEVO — cierra el hueco de "patente" mencionado en las notas de
// abajo] Para esta fase de validación de campo (un solo prototipo, un
// mecánico caminando de auto en auto), la forma más simple y honesta
// de saber a qué patente corresponde el DTC es que el mecánico la
// tipee por el Monitor Serie ANTES de escanear ese auto puntual —
// escribe PATENTE:AB123CD y Enter. Cuando integres la pantalla OLED
// con botones/teclado (fuera del alcance de esta versión), esto se
// puede reemplazar por una selección en pantalla; por ahora, Serial
// es lo que hay disponible sin inventar hardware de más.
String currentPatente = "";

void handleSerialCommands() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.startsWith("PATENTE:")) {
    currentPatente = line.substring(8);
    currentPatente.trim();
    Serial.printf("[SERIAL] Patente activa seteada: %s\n", currentPatente.c_str());
  } else if (line.length() > 0) {
    Serial.println("[SERIAL] Comando no reconocido. Usá: PATENTE:AB123CD");
  }
}

void loadCredentialsFromNVS() {
  prefs.begin("kalyber", true); // solo lectura
  deviceToken = prefs.getString("device_token", "");
  deviceImei = prefs.getString("device_imei", "");
  prefs.end();
}

void saveCredentialsToNVS() {
  prefs.begin("kalyber", false); // lectura/escritura
  prefs.putString("device_token", deviceToken);
  prefs.putString("device_imei", deviceImei);
  prefs.end();
}

void setup() {
  Serial.begin(115200);
  delay(300); // margen para que el monitor serie enganche al abrir

  Serial.println("\n========================================");
  Serial.println("  KALYBER SCANNER — arrancando");
  Serial.println("========================================");

  ledStatus.begin();
  ledStatus.setStatus(SystemStatus::BOOTING);

  bool hasDisplay = displayManager.begin();
  Serial.printf("[BOOT] Display OLED: %s\n", hasDisplay ? "detectado" : "NO detectado (el equipo sigue andando igual, sin pantalla)");
  displayManager.showBoot();

  modeArbiter.begin(PIN_MODE_SENSE);
  simEngine.begin(PIN_RELAY_GATE); // arranca apagado siempre, por seguridad

  Serial.printf("[BOOT] Modo detectado: %s\n", modeArbiter.current() == OperatingMode::SCANNER ? "SCANNER" : "SIMULATOR");

  // ---- Cargar token/IMEI guardados de una configuración anterior ----
  loadCredentialsFromNVS();

  // ---- WiFiManager: portal cautivo si no hay WiFi guardado ----
  WiFiManager wm;
  wm.addParameter(&customDeviceToken);
  wm.addParameter(&customDeviceImei);

  // Si ya había un token guardado, precargamos el campo para que no
  // haya que volver a tipearlo si el mecánico solo está re-parando el
  // WiFi (ej: cambió de router) sin cambiar el token.
  if (deviceToken.length() > 0) customDeviceToken.setValue(deviceToken.c_str(), 80);
  if (deviceImei.length() > 0) customDeviceImei.setValue(deviceImei.c_str(), 20);

  String apName = "Kalyber-Scanner-" + String((uint32_t)(ESP.getEfuseMac() & 0xFFFF), HEX);
  apName.toUpperCase();

  wm.setConfigPortalTimeout(300); // 5 minutos en modo pareo, después reintenta con lo que tenga guardado (evita que quede colgado en el banco de trabajo para siempre)
  wm.setAPCallback([&](WiFiManager* mgr) {
    Serial.printf("[WiFiManager] Modo pareo — conectate a la red '%s'\n", apName.c_str());
    ledStatus.setStatus(SystemStatus::PAIRING);
    displayManager.showPairingInstructions(apName);
  });

  bool connected = wm.autoConnect(apName.c_str());

  if (connected) {
    wifiConnected = true;
    Serial.println("[WiFiManager] WiFi conectado");

    // Si el mecánico cargó/cambió el token en el portal, lo guardamos
    String newToken = customDeviceToken.getValue();
    String newImei = customDeviceImei.getValue();
    if (newToken.length() > 0) deviceToken = newToken;
    if (newImei.length() > 0) deviceImei = newImei;
    if (newToken.length() > 0 || newImei.length() > 0) saveCredentialsToNVS();

    backendClient.begin();
    if (deviceToken.length() > 0) {
      backendClient.setDeviceToken(deviceToken);
      Serial.println("[BOOT] Token de equipo cargado — listo para mandar diagnósticos");
    } else {
      Serial.println("[BOOT] ⚠️ Sin token configurado — el backend va a rechazar cualquier POST con 401. Volvé a entrar al portal de pareo para cargarlo.");
    }
  } else {
    wifiConnected = false;
    Serial.println("[WiFiManager] No se pudo conectar — reintentando en el loop");
  }

  liveStatus.wifiConnected = wifiConnected;
  liveStatus.paired = deviceToken.length() > 0;

  if (modeArbiter.current() == OperatingMode::SCANNER) {
    bool canOk = canEngine.begin();
    Serial.printf("[BOOT] Bus CAN: %s\n", canOk ? "inicializado" : "ERROR al inicializar");
    if (!canOk) {
      ledStatus.setStatus(SystemStatus::BUS_ERROR);
      displayManager.showError("Fallo bus CAN");
    } else {
      ledStatus.setStatus(wifiConnected ? SystemStatus::SCANNER_OK : SystemStatus::NO_INTERNET);
    }
  } else {
    ledStatus.setStatus(SystemStatus::SIMULATOR_ACTIVE);
  }

  displayManager.showLive(liveStatus);
  Serial.println("========================================\n");
}

// Cada cuánto se consulta el bus por nuevos DTCs — 1 vez cada 3s es
// suficiente para "en vivo" sin saturar el bus con pedidos.
const unsigned long SCAN_INTERVAL_MS = 3000;
unsigned long lastScanAt = 0;

// Cada cuánto se refresca la pantalla LIVE aunque no haya nada nuevo
// (para que el reloj/tiempo "hace Xs" se sienta vivo).
const unsigned long DISPLAY_REFRESH_MS = 2000;
unsigned long lastDisplayRefresh = 0;

void loop() {
  ledStatus.update(); // no bloqueante, siempre
  handleSerialCommands();

  wifiConnected = (WiFi.status() == WL_CONNECTED);
  liveStatus.wifiConnected = wifiConnected;

  if (modeArbiter.current() == OperatingMode::SIMULATOR) {
    // Modo simulador — fuera del alcance de esta prueba de campo (ver
    // plan de validación: "el modo Simulador queda para después").
    // Se deja el LED en azul fijo y no se toca nada de CAN/backend acá.
    delay(50);
    return;
  }

  // ---- Modo SCANNER ----
  if (!wifiConnected) {
    ledStatus.setStatus(SystemStatus::NO_INTERNET);
  } else if (!canEngine.isBusHealthy()) {
    ledStatus.setStatus(SystemStatus::BUS_ERROR);
  } else {
    ledStatus.setStatus(SystemStatus::SCANNER_OK);
  }

  unsigned long now = millis();

  if (now - lastScanAt >= SCAN_INTERVAL_MS) {
    lastScanAt = now;

    if (canEngine.hasNewDtc()) {
      DtcReading dtc = canEngine.getLastNewDtc();
      Serial.printf("[SCANNER] DTC nuevo: %s — %s\n", dtc.code.c_str(), dtc.description.c_str());

      ledStatus.pulseDtcFound();
      displayManager.showDtcFound(dtc.code, dtc.description);

      liveStatus.lastDtcCode = dtc.code;
      liveStatus.lastDtcDesc = dtc.description;
      liveStatus.lastDtcAtMs = now;
      liveStatus.dtcsThisSession++;

      // ---- Subida al backend — lo mismo que se ve por serial ----
      // "patente" sale de currentPatente, seteada por Serial antes de
      // escanear este auto puntual (ver handleSerialCommands arriba).
      if (currentPatente.length() == 0) {
        Serial.println("[SCANNER] ⚠️ DTC detectado pero no hay patente activa — escribí PATENTE:XXX en el Monitor Serie antes de escanear. No se sube al backend sin esto (lo rechazaría con 400 igual).");
      } else if (wifiConnected && deviceToken.length() > 0) {
        bool ok = backendClient.postDiagnostic(
          currentPatente,
          dtc.code,
          dtc.description,
          "local",               // source: se tradujo a bordo con la tabla genérica SAE
          deviceImei
        );
        Serial.printf("[SCANNER] Subida al backend: %s\n", ok ? "OK" : "FALLÓ (ver log de BackendClient arriba)");
      } else {
        Serial.println("[SCANNER] Sin WiFi o sin token — el DTC se muestra local pero no se pudo subir");
      }
    }
  }

  if (now - lastDisplayRefresh >= DISPLAY_REFRESH_MS) {
    lastDisplayRefresh = now;
    displayManager.showLive(liveStatus);
  }

  delay(50);
}
