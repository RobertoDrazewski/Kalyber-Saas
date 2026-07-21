# Kalyber Scanner/Simulador — Firmware v2

## Qué cambió en esta versión

Firmware completo, plug-and-play: conectás el hardware, cargás esto UNA vez, y las veces siguientes arranca solo. Antes había módulos referenciados (`status/led_status.h`, `network/backend_client.h`) que **no existían en las rutas correctas** — el proyecto viejo no llegaba a compilar. Esta versión reorganiza todo en una estructura real de PlatformIO y agrega lo que faltaba.

## Estructura del proyecto

```
platformio.ini
src/
  main.cpp                    — arranque, WiFiManager, loop principal
  mode_arbiter.h / .cpp       — lee el switch DPDT (scanner/simulador)
  status/
    led_status.h / .cpp       — WS2812, códigos de color
    display_manager.h / .cpp  — OLED SH1106, pantallas de estado
  network/
    backend_client.h / .cpp   — POST al backend de Kalyber
  obd/
    iso15765_transport.h/.cpp — ISO-TP sobre CAN (estándar público)
    can_engine.h / .cpp       — Mode 03 (leer DTCs almacenados)
    dtc_database.h            — traducción SOLO de códigos genéricos SAE
  sim/
    sim_engine.h / .cpp       — control de ignición simulada (IRLZ44N)
```

## Cómo cargarlo (plug-and-play, primera vez)

1. Abrí este proyecto con PlatformIO (VS Code + extensión PlatformIO, o `pio` por línea de comandos).
2. `pio run --target upload` (o el botón de subir de la extensión).
3. Abrí el Monitor Serie a 115200 baudios — vas a ver cada paso del arranque con su resultado.
4. La primera vez, el equipo entra en **modo pareo**: LED azul parpadeando, y una red WiFi nueva aparece en tu celular llamada `Kalyber-Scanner-XXXX`.
5. Conectate a esa red — se abre un portal solo (si no, andá a `192.168.4.1`).
6. Ahí cargás: el WiFi real del taller (SSID + contraseña), y el **token del equipo** + el **IMEI/ID** que te dio la app Kalyber al parearlo (`/scanner` → "Parear equipo").
7. Guardás — el equipo se reinicia y se conecta solo. De ahí en más, cada vez que lo prendas, arranca directo sin pasar por el portal (a menos que se le olvide el WiFi).

## Cómo escanear un auto (con esta versión)

1. Andá a la app Kalyber (`/scanner`), creá el auto con su patente (si no lo hiciste antes).
2. Conectá el equipo al puerto OBD-II del auto.
3. **Por el Monitor Serie**, escribí: `PATENTE:AB123CD` (la patente real del auto) y Enter — esto le dice al firmware a qué auto corresponden los DTCs que va a encontrar. *(Es un paso manual a propósito para esta fase de validación de campo — ver nota abajo.)*
4. El equipo consulta el bus cada 3 segundos. Si encuentra un DTC nuevo: LED verde parpadea x3, aparece en pantalla, se sube al backend.
5. En la app, pestaña "En vivo", debería aparecer casi al instante.

## Pantalla OLED — 3 estados principales

- **Boot:** wordmark "KALYBER" + "Iniciando..."
- **Pareo:** instrucciones de a qué red conectarse
- **Live (la de todo el tiempo):** WiFi / Taller / Auto activo / último DTC / contador de la sesión — es literalmente lo mismo que ves por Serial y en Railway, solo que resumido para la pantalla chica.

⚠️ **Sobre el logo:** no tengo el archivo de imagen real de Kalyber, así que la pantalla de arranque usa el nombre en texto grande, no un bitmap. Si me pasás un PNG monocromático (blanco sobre negro, ideal 64x32 o 128x32px), lo convierto a bitmap XBM y lo reemplazo sin tocar el resto.

## Endpoint de ingesta (confirmado, con auth)

```
POST https://kalyber-saas-production.up.railway.app/api/scanner/internal/diagnostics-log
Content-Type: application/json
x-internal-secret: <token de este equipo>

{
  "patente": "AB841QH",
  "dtc_code": "P0301",
  "dtc_description_es": "Falla de encendido cilindro 1",
  "dtc_source": "local",
  "device_imei": "868935060187604"
}
```

## Pendientes reales — no resueltos, no inventados

1. **Validar contra un vehículo/bus CAN real.** Todo el módulo `obd/` sigue el estándar ISO 15765-4 / SAE J1979 al pie de la letra, pero nunca se ejecutó contra hardware real — no hay forma de simular un bus CAN de auto en este entorno de desarrollo. Primeras pruebas: revisar el Monitor Serie antes de confiar en lo que aparece en pantalla/app.
2. **Velocidad del bus (500k vs 250k).** Algunos vehículos (sobre todo utilitarios/diesel viejos) usan 250kbps. Si no hay respuesta del auto, es el primer sospechoso — ver comentario en `iso15765_transport.cpp`.
3. **Traducción de DTCs específicos de fabricante.** Sin fuente confiable todavía — `dtc_database.h` solo traduce genéricos SAE P0xxx públicos. Esto se completa con sesiones reales confirmadas por el mecánico (botón 👍/👎 en la app), no con una tabla inventada de antemano.
4. **Asociar la patente automáticamente.** Hoy se tipea por Serial antes de cada auto. Cuando integres botones/selector en la pantalla OLED, se puede reemplazar por una selección visual — no se armó de antemano para no adivinar un flujo de UI que todavía no definiste.
5. **GPIO real del WS2812.** Confirmar contra tu placa concreta — ver el placeholder en `led_status.h`.
6. **Modo Simulador.** Fuera del alcance de esta prueba de campo (según tu plan de validación) — el código lee el switch y no rompe nada si está en esa posición, pero no está desarrollado más allá de eso.


---

# [ACTUALIZACIÓN 20/07/2026] Sistema de variantes de hardware

El firmware ahora soporta DOS variantes con un solo código:

| | DESKTOP | TALLER_MINI |
|---|---|---|
| Función | Simula y lee | Solo lee |
| OLED | Sí | No (LEDs de la ESP32) |
| Alimentación | 220V→12V→5V | Pin 16 del OBD (12V del auto) |
| Protocolos que lee | OBD-II, J1939, J1708 | OBD-II, J1939, J1708 |
| Simulador/DPDT/relé | Sí | No |

**Cómo elegir la variante:** ver `../COMO-COMPILAR.md` (método simple:
copiar el archivo de `variantes/` a `src/config_variant.h`; método por
entorno: `pio run -e desktop` o `pio run -e taller-mini`).

**Módulos nuevos en `src/diagnostics/`:** `j1939_engine` (DM1 por CAN
29-bit) y `j1708_engine` (framing RS485). Ambos con la advertencia de
validar contra tráfico real antes de producción — en particular:
- J1939 DM1 multi-DTC usa transporte multi-frame TP.BAM que aún NO se
  maneja (un frame simple trae 1 DTC; con varios activos solo se ve el
  primero). Pendiente para la fase de sniffer.
- J1708 PID 194 (los DTCs) todavía no se traduce — solo framing.

**Identidad del equipo:** cada unidad se graba en fábrica por serial
con `SETUID:KAL-SCAN-XXXX` (el MISMO código del barcode de la caja).
Verificar con `GETUID`. El endpoint de ingesta usa el header
`x-internal-secret` con token por equipo (confirmado — ya no es
"pendiente de confirmar" como decía una versión anterior de este
README).

**Manual de armado completo** (BOM, alimentación, pinout, checklist):
`../Kalyber_Manual_Armado_Prototipos.pdf`
