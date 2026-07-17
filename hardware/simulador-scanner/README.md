# Kalyber Scanner/Simulador — Firmware base

## Librerías necesarias (Arduino IDE / PlatformIO)

- `Adafruit NeoPixel` — para el LED de estado WS2812
- `WiFiManager` (tzapu) — portal cautivo
- `Adafruit_SH110X` — display OLED (una vez que integres la UI)
- `ArduinoJson` — armado del payload del backend
- `HTTPClient` — viene con el core ESP32, no requiere instalación aparte

## Endpoint de ingesta (confirmado)

```
POST https://kalyber-saas-production.up.railway.app/api/scanner/internal/diagnostics-log
Content-Type: application/json

{
  "patente": "AB841QH",
  "dtc_code": "P0301",
  "dtc_description_es": "Falla de encendido cilindro 1",
  "dtc_source": "local",
  "device_imei": "868935060187604"
}
```

⚠️ **Pendiente de confirmar contra el backend real**: si este endpoint requiere header de autenticación (tipo `x-internal-secret`, igual que `/internal/send-command` en `gt06-standalone`) o si queda abierto sin auth por estar bajo `/internal`. Confirmar antes de exponer el equipo fuera de banco de pruebas.

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
