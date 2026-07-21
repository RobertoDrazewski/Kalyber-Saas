# Variantes de hardware — Kalyber Scanner

Dos versiones, un solo firmware. La variante se elige al compilar
(`pio run -e desktop` / `pio run -e taller-mini`), ver `config_variant.h`.

---

## VARIANTE DESKTOP — Scanner/Simulador de escritorio (la completa)

Tal como se planeó desde el principio. Para banco de trabajo: simula
Y lee datos en todos los protocolos.

### BOM
| Componente | Notas |
|---|---|
| ESP32-S3 DevKit | |
| Pantalla OLED SH1106 | I2C, GPIO 8 (SDA) / 9 (SCL) |
| SN65HVD230 | CAN — OBD-II (11-bit) y J1939 (29-bit), GPIO 4/5 |
| MAX485 | RS485 — J1708/J1587, GPIO 17/18 + DE en 6 |
| DPDT + relé IRLZ44N | modo scanner/simulador + ignición simulada (GPIO 21/15) |
| Fuente 220V→12V | alimentación de banco |
| Step-down XL4005 12V→5V | |
| LED WS2812 | estado |

### Conectividad
- **Puerto serial USB**: logs en vivo en la PC (monitor serie 115200).
- **WiFi**: sube los diagnósticos al backend Kalyber
  (`/api/scanner/internal/diagnostics-log`, auth `x-internal-secret`).

### Protocolos
| Protocolo | Lee | Simula |
|---|---|---|
| OBD-II (ISO 15765-4, CAN 11-bit) | ✅ | ✅ |
| J1939 (CAN 29-bit) | ✅ | ✅ |
| J1708/J1587 (RS485) | ✅ (framing; PID 194 pendiente de validar con tráfico real) | ✅ (frames crudos) |
| K-Line | ❌ (requiere chip L9637, no está en el BOM) | ❌ |

### Compilar: `pio run -e desktop`

---

## VARIANTE TALLER_MINI — caja mínima, solo scanner

La versión comercial para talleres: chica, sin simulador, y capaz de
leer TODOS los protocolos (OBD-II, J1939, J1708) — solo K-Line queda
afuera en toda la línea.
**Sin OLED, sin nada de 220V.**

### La clave: se alimenta del propio auto
El conector OBD-II entrega **12V de batería en el pin 16** (GND en
4/5). No necesita enchufe: el mismo cable OBD que lee datos también
alimenta la caja, pasando por el step-down 12V→5V.

### BOM completo (corto a propósito)
| Componente | Cant. | Notas |
|---|---|---|
| ESP32-S3 (mini si conseguís) | 1 | los LEDs de la placa son la única indicación visual |
| SN65HVD230 | 1 | CAN |
| MAX485 | 1 | RS485 — J1708/J1587, GPIO 17/18 + DE en 6 |
| Step-down 12V→5V (XL4005 o MP1584) | 1 | entrada: pin 16 del OBD |
| Cable OBD-II macho | 1 | 4 hilos: pin 6 CAN-H, 14 CAN-L, 16 +12V, 4/5 GND |
| Cable/conector USB accesible | 1 | puerto serial para debug/logs con notebook |
| Caja chica (~70x50x25mm) | 1 | **con el código de barras KAL-SCAN-XXXX impreso** |

### Conexionado
```
OBD pin 16 (+12V) ──→ IN  step-down ──→ 5V ESP32
OBD pin 4/5 (GND) ──→ GND común
OBD pin 6 (CAN-H) ──→ CANH SN65HVD230
OBD pin 14 (CAN-L)──→ CANL SN65HVD230
SN65HVD230 TX/RX  ──→ GPIO 4 / GPIO 5
MAX485 RO/DI      ──→ GPIO 18 / GPIO 17 (UART1)
MAX485 DE+RE      ──→ GPIO 6
USB de la ESP32   ──→ accesible desde afuera de la caja (serial)
```

### El código de barras en la caja
Cada caja lleva impreso su `KAL-SCAN-XXXX` (generado desde el panel
super_admin → Equipos Scanner → Imprimir etiqueta). El taller lo
escanea con la cámara al parear — círculo completo con el
provisioning que ya está en la plataforma.

### Qué lee
- **OBD-II** ✅ — autos y utilitarios comunes
- **J1939** ✅ — camiones/maquinaria moderna (mismo bus CAN)
- **J1708/J1587** ✅ — maquinaria pesada legacy (MAX485 incluido de fábrica).
  ⚠️ El conector físico de esos vehículos es Deutsch de 6 o 9 pines, no
  OBD-II — se vende aparte el **cable adaptador Deutsch → conector del
  scanner**. El Deutsch de 9 pines también trae +12V, así que la caja se
  alimenta igual desde el vehículo con el adaptador.
- K-Line ❌ (igual que en todas: requiere chip L9637, no está en el BOM)
- **No simula** — es solo scanner.

### Compilar: `pio run -e taller-mini`

### Nota de alimentación
El pin 16 del OBD está SIEMPRE vivo (no depende de la llave). El
step-down debe bancarse transitorios del auto: XL4005 aguanta 32V de
entrada, OK. Si usás MP1584, confirmá que el módulo tolere ≥28V
(hay versiones de 24V máx que quedan justas con picos de alternador).

---

## platformio.ini — los 2 entornos

```ini
[env:desktop]
build_flags = -DVARIANT_DESKTOP

[env:taller-mini]
build_flags = -DVARIANT_TALLER_MINI
```
(cada env hereda board/platform de tu sección común existente)
