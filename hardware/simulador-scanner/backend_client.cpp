#include "backend_client.h"
#include <HTTPClient.h>
#include <WiFi.h>
#include <ArduinoJson.h>

BackendClient backendClient;

void BackendClient::begin(const char* wifiSsid) {
  // Nada que inicializar por ahora — el WiFi ya lo maneja WiFiManager
  // en otro módulo. Se deja el método por si más adelante hace falta
  // setear headers fijos, timeout global, etc.
  (void)wifiSsid;
}

void BackendClient::setDeviceToken(const String& token) {
  deviceToken = token;
}

bool BackendClient::postDiagnostic(const String& patente,
                                    const String& dtcCode,
                                    const String& dtcDescriptionEs,
                                    const String& dtcSource,
                                    const String& deviceImei) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[BackendClient] Sin WiFi, no se pudo subir el diagnóstico");
    return false;
  }
  if (deviceToken.length() == 0) {
    Serial.println("[BackendClient] Sin device token configurado (setDeviceToken) — el backend va a rechazar el POST con 401");
    return false;
  }

  HTTPClient http;
  http.begin(ENDPOINT_URL);
  http.addHeader("Content-Type", "application/json");
  // [CONFIRMADO 17/07/2026] Header obligatorio — ver nota en el .h
  http.addHeader("x-internal-secret", deviceToken);

  StaticJsonDocument<512> doc;
  doc["patente"] = patente;
  doc["dtc_code"] = dtcCode;
  doc["dtc_description_es"] = dtcDescriptionEs;
  doc["dtc_source"] = dtcSource;
  doc["device_imei"] = deviceImei;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  bool success = (httpCode == 200 || httpCode == 201);

  if (success) {
    Serial.printf("[BackendClient] Diagnóstico subido OK (%d): %s\n", httpCode, dtcCode.c_str());
  } else {
    Serial.printf("[BackendClient] Error al subir diagnóstico (%d): %s\n", httpCode, http.errorToString(httpCode).c_str());
  }

  http.end();
  return success;
}
