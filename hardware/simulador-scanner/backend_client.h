#pragma once
#include <Arduino.h>

// ─────────────────────────────────────────────────────────────
// BackendClient — sube diagnósticos al SaaS Kalyber
//
// Endpoint real confirmado (Railway):
//   https://kalyber-saas-production.up.railway.app/api/scanner/internal/diagnostics-log
//
// Nota: es un endpoint bajo /api/scanner/internal — coherente con
// que el servicio API en Railway expone las rutas internas del
// scanner bajo ese prefijo (mismo patrón que el resto de las
// rutas /internal/... del sistema gt06-standalone, pero servidas
// desde el servicio API, no desde el proceso TCP).
// ─────────────────────────────────────────────────────────────

class BackendClient {
public:
  void begin(const char* wifiSsid = nullptr); // reservado por si se necesita validar conectividad al iniciar
  bool postDiagnostic(const String& patente,
                       const String& dtcCode,
                       const String& dtcDescriptionEs,
                       const String& dtcSource,   // "local" | "remote" | "unknown"
                       const String& deviceImei);

private:
  static constexpr const char* ENDPOINT_URL =
    "https://kalyber-saas-production.up.railway.app/api/scanner/internal/diagnostics-log";
};

extern BackendClient backendClient;
