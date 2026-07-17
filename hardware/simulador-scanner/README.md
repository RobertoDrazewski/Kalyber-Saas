# Kalyber Scanner/Simulador — Firmware base

## Librerías necesarias (Arduino IDE / PlatformIO)

- `Adafruit NeoPixel` — para el LED de estado WS2812
- `WiFiManager` (tzapu) — portal cautivo
- `Adafruit_SH110X` — display OLED (una vez que integres la UI)
- `ArduinoJson` — armado del payload del backend
- `HTTPClient` — viene con el core ESP32, no requiere instalación aparte

## Endpoint de ingesta (confirmado, con auth)

```
POST https://kalyber-saas-production.up.railway.app/api/scanner/internal/diagnostics-log
Content-Type: application/json
x-internal-secret: <token de este equipo, ver abajo>

{
  "patente": "AB841QH",
  "dtc_code": "P0301",
  "dtc_description_es": "Falla de encendido cilindro 1",
  "dtc_source": "local",
  "device_imei": "868935060187604"
}
```

**[CONFIRMADO 17/07/2026]** Sí requiere autenticación — header `x-internal-secret` con el **token de este equipo puntual** (no un secreto compartido entre todos los scanners). El token se genera una sola vez, desde la app del taller (`/scanner` → pestaña "Parear equipo"), y se carga acá en el firmware con `backendClient.setDeviceToken("kalscan_...")` antes de mandar cualquier diagnóstico — normalmente como parámetro custom del portal cautivo de `WiFiManager`, junto con el SSID/password del local, así el mecánico lo carga todo en un solo paso sin tener que reflashear el equipo.

Sin token: el backend responde `401`. Si el token es válido pero el equipo todavía no fue pareado a ningún taller: responde `403`.

Sin `patente` cargada en `ScanVehicles` del lado del backend (el mecánico tiene que crear el auto en la app ANTES de escanearlo): responde `404`.

## Antes de compilar

1. **Confirmar `WS2812_PIN`** en `src/status/led_status.h` contra el pinout real de tu placa. Si tu core Arduino ya define `RGB_BUILTIN` para esta placa, no hace falta tocar nada — el código lo detecta solo.
2. Los pines de CAN (4,5), sensado de modo (21) y relé (15) ya están puestos según el plano de circuito que armamos — no deberían necesitar cambios salvo que tu unidad concreta tenga algún GPIO ocupado.

## Códigos de LED (referencia rápida)

| Estado | Color / patrón |
|---|---|
| Arrancando | Blanco tenue fijo |
| Modo pairing (portal cautivo) | Azul parpadeante lento |
| Scanner OK, reportando | Verde fijo |
| DTC recién detectado | Verde parpadeo rápido x3, vuelve a verde fijo |
| Simulador activo | Azul fijo |
| Sin internet (funciona local) | Ámbar fijo |
| Falla de bus CAN / hardware | Rojo fijo |
| Apertura de gabinete (tamper) | Rojo parpadeante rápido |

## Próximos módulos a integrar (no incluidos en este esqueleto)

- `CanEngine` / `ISO15765Transport` — motor de diagnóstico real
- `DtcDatabase` — traducción local SAE + fallback API
- `ModeArbiter` — arbitraje scanner/simulador sin reinicio
- `SimEngine` / control de ignición vía IRLZ44N
- Cliente HTTP hacia `/internal/diagnostics-log` de Kalyber
