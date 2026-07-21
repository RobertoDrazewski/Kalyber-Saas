#pragma once
// ╔═══════════════════════════════════════════════════════════╗
// ║  ARCHIVO LISTO — VARIANTE: DESKTOP (scanner/simulador)    ║
// ║  Copiá este archivo a src/config_variant.h y compilá      ║
// ║  como siempre. NADA MÁS que hacer.                        ║
// ╚═══════════════════════════════════════════════════════════╝
// Si la variante ya vino por build_flags de platformio.ini (-e desktop /
// -e taller-mini), ese flag manda y este define no se aplica — así no
// pueden quedar las dos variantes definidas a la vez.
#if !defined(VARIANT_DESKTOP) && !defined(VARIANT_TALLER_MINI)
  #define VARIANT_DESKTOP
#endif


// ═════════════════════════════════════════════════════════════
// config_variant.h — UN solo firmware, DOS variantes de hardware.
// La variante se elige por build_flags en platformio.ini (recomendado)
// o descomentando un define.
//
//   VARIANT_DESKTOP     → Scanner/Simulador de escritorio COMPLETO.
//                         Tal como se planeó desde el principio:
//                         - OLED SH1106 (I2C, GPIO 8/9)
//                         - Fuente 220V→12V + step-down XL4005 → 5V
//                         - SIMULA datos en todos los protocolos
//                         - LEE en todos los protocolos:
//                           OBD-II (CAN 11-bit), J1939 (CAN 29-bit),
//                           J1708/J1587 (RS485)
//                         - Puerto serial USB para logs locales
//                         - WiFi → logs al backend Kalyber
//
//   VARIANT_TALLER_MINI → Caja mínima SOLO SCANNER para el taller.
//                         - SIN OLED, SIN nada de 220V
//                         - Alimentación desde el AUTO: pin 16 del
//                           OBD (12V) → step-down → 5V. Un solo cable.
//                         - Cable USB para puerto serial (debug/logs)
//                         - Indicación: los LEDs de la propia ESP32
//                         - La caja lleva impreso el CÓDIGO DE BARRAS
//                           (KAL-SCAN-XXXX) para darla de alta — el
//                           taller lo escanea con la cámara al parear
//                         - Lee TODOS los protocolos: OBD-II, J1939
//                           y J1708/J1587 (MAX485 incluido de fábrica).
//                           Solo K-Line queda afuera (requiere L9637).
//                           Sin simulador, sin relé.
//                         - Para maquinaria pesada (conector Deutsch)
//                           se vende aparte el cable adaptador.
//
// En platformio.ini:
//
//   [env:desktop]
//   build_flags = -DVARIANT_DESKTOP
//
//   [env:taller-mini]
//   build_flags = -DVARIANT_TALLER_MINI
//
// Compilás cada versión con `pio run -e desktop` o `pio run -e
// taller-mini`, sin tocar código.
// ═════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Capacidades por variante — el resto del código pregunta por estas
// macros (HAS_OLED, HAS_SIMULATOR, ...) y NUNCA por la variante
// directamente. Agregar una variante nueva mañana = tocar solo acá.
// ─────────────────────────────────────────────────────────────

#if defined(VARIANT_DESKTOP)
  #define HAS_OLED        1   // pantalla SH1106
  #define HAS_SIMULATOR   1   // relé IRLZ44N + DPDT de modo
  #define HAS_RS485       1   // J1708/J1587 (maquinaria pesada legacy)
  #define HAS_J1939       1
  #define POWER_SOURCE_MAINS 1  // fuente 220V→12V + XL4005

#elif defined(VARIANT_TALLER_MINI)
  #define HAS_OLED        0   // sin pantalla — LEDs de la ESP32
  #define HAS_SIMULATOR   0   // solo scanner: sin relé, sin DPDT
  #define HAS_RS485       1   // [20/07] TODAS las mini llevan MAX485 de fábrica:
                              // leen J1708/J1587 (maquinaria pesada legacy).
                              // Para maquinaria se vende aparte el cable
                              // adaptador Deutsch 6/9 pines → ver HARDWARE-VARIANTES.md
  #define HAS_J1939       1   // mismo bus CAN, cero hardware extra
  #define POWER_SOURCE_MAINS 0  // alimentado por el pin 16 del OBD (12V del auto)
#endif

// ─────────────────────────────────────────────────────────────
// Pines — iguales en ambas variantes donde el módulo existe.
// Si un módulo no existe en la variante (ej: relé en TALLER_MINI),
// su pin no se inicializa y el GPIO queda libre.
// ─────────────────────────────────────────────────────────────
#define PIN_CAN_TX       4
#define PIN_CAN_RX       5

#if HAS_SIMULATOR
  #define PIN_MODE_SENSE 21   // polo B del DPDT
  #define PIN_RELAY_GATE 15   // IRLZ44N ignición simulada
#endif

#if HAS_RS485
  #define PIN_RS485_TX   17
  #define PIN_RS485_RX   18
  #define PIN_RS485_DE   6
#endif

#if HAS_OLED
  #define PIN_I2C_SDA    8
  #define PIN_I2C_SCL    9
#endif
