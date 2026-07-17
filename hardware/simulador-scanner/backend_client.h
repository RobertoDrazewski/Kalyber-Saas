#pragma once
#include <Arduino.h>

// ─────────────────────────────────────────────────────────────
// BackendClient — sube diagnósticos al SaaS Kalyber
//
// Endpoint real confirmado (Railway):
//   https://kalyber-saas-production.up.railway.app/api/scanner/internal/diagnostics-log
//
// [CONFIRMADO 17/07/2026] El endpoint SÍ requiere autenticación —
// header "x-internal-secret" con el token de ESTE equipo puntual
// (no un secreto único compartido entre todos los scanners — cada
// equipo tiene el suyo, generado al parearlo desde la app del taller,
// en /scanner → "Parear equipo"). Sin el header, el backend responde
// 401. Si el equipo no fue pareado todavía (workshop_id nulo del lado
// del backend), responde 403.
// ─────────────────────────────────────────────────────────────

class BackendClient {
public:
  void begin(const char* wifiSsid = nullptr); // reservado por si se necesita validar conectividad al iniciar
  void setDeviceToken(const String& token);    // token que el mecánico carga en el portal WiFi al parear
  bool postDiagnostic(const String& patente,
                       const String& dtcCode,
                       const String& dtcDescriptionEs,
                       const String& dtcSource,   // "local" | "remote" | "unknown"
                       const String& deviceImei);

private:
  static constexpr const char* ENDPOINT_URL =
    "https://kalyber-saas-production.up.railway.app/api/scanner/internal/diagnostics-log";
  String deviceToken;
};

extern BackendClient backendClient;
