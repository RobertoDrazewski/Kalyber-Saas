#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include "config_variant.h"        // [VARIANTES 20/07/2026] DESKTOP o TALLER_MINI — ver /variantes
#include "status/led_status.h"
#if HAS_OLED
  #include "status/display_manager.h"
#endif
#include "network/backend_client.h"
#include "obd/can_engine.h"
#include "diagnostics/j1939_engine.h"   // [NUEVO] J1939 (CAN 29-bit) — camiones/maquinaria moderna
#if HAS_RS485
  #include "diagnostics/j1708_engine.h" // [NUEVO] J1708/J1587 (RS485) — maquinaria pesada legacy
#endif
#if HAS_SIMULATOR
  #include "mode_arbiter.h"
  #include "sim/sim_engine.h"
#endif

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

// ---- Pines: definidos en config_variant.h según la variante ----
// (PIN_MODE_SENSE/PIN_RELAY_GATE solo existen si HAS_SIMULATOR;
//  CAN 4/5 e I2C 8/9 se configuran en sus módulos.)

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
String deviceUid;   // KAL-SCAN-XXXX — el mismo código del barcode de la caja
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
  } else if (line.startsWith("SETUID:")) {
    // [NUEVO 20/07/2026] Identidad del equipo = el MISMO código del
    // barcode de la caja (KAL-SCAN-XXXX). Se graba UNA vez en fábrica
    // y persiste en NVS. Ver COMO-COMPILAR.md, sección "Grabar el ID".
    String uid = line.substring(7);
    uid.trim();
    if (uid.startsWith("KAL-SCAN-") && uid.length() >= 13) {
      prefs.begin("kalyber", false);
      prefs.putString("device_uid", uid);
      prefs.end();
      deviceUid = uid;
      Serial.printf("[SERIAL] ✅ UID guardado: %s (persiste en flash)\n", uid.c_str());
    } else {
      Serial.println("[SERIAL] ❌ Formato inválido. Esperado: SETUID:KAL-SCAN-0001");
    }
  } else if (line == "GETUID") {
    Serial.printf("[SERIAL] UID actual: %s\n", deviceUid.length() ? deviceUid.c_str() : "(sin grabar)");
  } else if (line.length() > 0) {
    Serial.println("[SERIAL] Comandos: PATENTE:AB123CD | SETUID:KAL-SCAN-XXXX | GETUID");
  }
}

void loadCredentialsFromNVS() {
  prefs.begin("kalyber", true); // solo lectura
  deviceToken = prefs.getString("device_token", "");
  deviceImei = prefs.getString("device_imei", "");
  deviceUid = prefs.getString("device_uid", "");
  prefs.end();
  if (deviceUid.length() == 0) {
    Serial.println("[ID] ⚠️ SIN UID GRABADO — grabalo con SETUID:KAL-SCAN-XXXX antes de despachar (control de calidad de fábrica)");
  } else {
    Serial.printf("[ID] Equipo: %s\n", deviceUid.c_str());
  }
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

#if HAS_OLED
  bool hasDisplay = displayManager.begin();
  Serial.printf("[BOOT] Display OLED: %s\n", hasDisplay ? "detectado" : "NO detectado (el equipo sigue andando igual, sin pantalla)");
  displayManager.showBoot();
#else
  Serial.println("[BOOT] Variante sin OLED — estado por LEDs + monitor serie");
#endif

#if HAS_SIMULATOR
  modeArbiter.begin(PIN_MODE_SENSE);
  simEngine.begin(PIN_RELAY_GATE); // arranca apagado siempre, por seguridad
  Serial.printf("[BOOT] Modo detectado: %s\n", modeArbiter.current() == OperatingMode::SCANNER ? "SCANNER" : "SIMULATOR");
#else
  Serial.println("[BOOT] Variante TALLER_MINI — scanner puro (sin simulador)");
#endif

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
#if HAS_OLED
    displayManager.showPairingInstructions(apName);
#endif
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

#if HAS_SIMULATOR
  const bool bootAsScanner = (modeArbiter.current() == OperatingMode::SCANNER);
#else
  const bool bootAsScanner = true; // TALLER_MINI: siempre scanner
#endif

  if (bootAsScanner) {
    bool canOk = canEngine.begin();
    Serial.printf("[BOOT] Bus CAN: %s\n", canOk ? "inicializado" : "ERROR al inicializar");

    j1939Engine.begin();  // [NUEVO] mismo bus CAN físico, frames de 29 bits
#if HAS_RS485
    j1708Engine.begin();  // [NUEVO] bus RS485 aparte (J1708/J1587)
#endif

    if (!canOk) {
      ledStatus.setStatus(SystemStatus::BUS_ERROR);
#if HAS_OLED
      displayManager.showError("Fallo bus CAN");
#endif
    } else {
      ledStatus.setStatus(wifiConnected ? SystemStatus::SCANNER_OK : SystemStatus::NO_INTERNET);
    }
  }
#if HAS_SIMULATOR
  else {
    ledStatus.setStatus(SystemStatus::SIMULATOR_ACTIVE);
  }
#endif

#if HAS_OLED
  displayManager.showLive(liveStatus);
#endif
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

#if HAS_SIMULATOR
  if (modeArbiter.current() == OperatingMode::SIMULATOR) {
    // Modo simulador — fuera del alcance de esta prueba de campo (ver
    // plan de validación: "el modo Simulador queda para después").
    // Se deja el LED en azul fijo y no se toca nada de CAN/backend acá.
    delay(50);
    return;
  }
#endif

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
#if HAS_OLED
      displayManager.showDtcFound(dtc.code, dtc.description);
#endif

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

#if HAS_OLED
  if (now - lastDisplayRefresh >= DISPLAY_REFRESH_MS) {
    lastDisplayRefresh = now;
    displayManager.showLive(liveStatus);
  }
#endif

  delay(50);
}
