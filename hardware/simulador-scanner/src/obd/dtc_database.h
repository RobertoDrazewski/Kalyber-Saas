#pragma once
#include <Arduino.h>
#include <map>

// ─────────────────────────────────────────────────────────────
// DtcDatabase — traducción de códigos de falla.
//
// [LÍMITE A PROPÓSITO — leer antes de tocar este archivo]
// Acá SOLO van códigos genéricos (P0xxx, la parte "genérica" del
// estándar SAE J2012), que son públicos e idénticos en cualquier
// marca. Los códigos específicos de fabricante (P1xxx, P3xxx, y los
// C/B/U específicos) NO están acá — tu propio traspaso de contexto
// marca esto como "sin fuente confiable todavía", y va a seguir así
// hasta que tengas sesiones reales confirmadas por un mecánico (por
// eso existe el botón 👍/👎 en la app — ESO es lo que va a ir
// llenando este archivo con datos verificados, no una tabla
// inventada de antemano).
// ─────────────────────────────────────────────────────────────

// Decodifica la ESTRUCTURA del código (esto sí es 100% estándar y
// universal, no depende de la marca): 2 bytes crudos → algo como
// "P0301". No confundir con la DESCRIPCIÓN (eso sí varía).
inline String decodeDtcStructure(uint8_t highByte, uint8_t lowByte) {
  static const char SYSTEM_CHAR[4] = { 'P', 'C', 'B', 'U' };
  uint8_t systemBits = (highByte & 0xC0) >> 6;   // 2 bits más altos: sistema (Powertrain/Chassis/Body/Network)
  uint8_t genericBit = (highByte & 0x30) >> 4;   // siguiente bit: 0=genérico SAE, 1=específico de fabricante
  uint8_t digit2 = highByte & 0x0F;
  uint8_t digit3 = (lowByte & 0xF0) >> 4;
  uint8_t digit4 = lowByte & 0x0F;

  char buf[6];
  snprintf(buf, sizeof(buf), "%c%d%X%X%X", SYSTEM_CHAR[systemBits], genericBit, digit2, digit3, digit4);
  return String(buf);
}

// Tabla de descripciones — SOLO genéricos P0xxx confirmados contra el
// estándar público SAE J2012. Los más comunes en fallas de motor;
// se va a ir ampliando con el tiempo, siempre con la misma fuente
// (nunca "inventados" para completar un hueco).
static const std::map<String, String> GENERIC_DTC_DESCRIPTIONS = {
  {"P0100", "Circuito del sensor de flujo de masa de aire — falla"},
  {"P0101", "Sensor de flujo de masa de aire — rango/rendimiento"},
  {"P0110", "Circuito del sensor de temperatura de aire de admisión"},
  {"P0115", "Circuito del sensor de temperatura del refrigerante"},
  {"P0120", "Circuito del sensor de posición del acelerador (TPS)"},
  {"P0130", "Circuito de la sonda de oxígeno (banco 1, sensor 1)"},
  {"P0171", "Sistema demasiado pobre (banco 1)"},
  {"P0172", "Sistema demasiado rico (banco 1)"},
  {"P0174", "Sistema demasiado pobre (banco 2)"},
  {"P0175", "Sistema demasiado rico (banco 2)"},
  {"P0200", "Circuito del inyector — falla general"},
  {"P0201", "Circuito del inyector, cilindro 1"},
  {"P0202", "Circuito del inyector, cilindro 2"},
  {"P0203", "Circuito del inyector, cilindro 3"},
  {"P0204", "Circuito del inyector, cilindro 4"},
  {"P0217", "Motor sobrecalentado"},
  {"P0300", "Fallas de encendido detectadas, múltiples cilindros"},
  {"P0301", "Falla de encendido, cilindro 1"},
  {"P0302", "Falla de encendido, cilindro 2"},
  {"P0303", "Falla de encendido, cilindro 3"},
  {"P0304", "Falla de encendido, cilindro 4"},
  {"P0325", "Circuito del sensor de golpeteo (knock sensor)"},
  {"P0335", "Circuito del sensor de posición del cigüeñal"},
  {"P0340", "Circuito del sensor de posición del árbol de levas"},
  {"P0400", "Circuito de recirculación de gases de escape (EGR)"},
  {"P0420", "Eficiencia del catalizador por debajo del umbral (banco 1)"},
  {"P0430", "Eficiencia del catalizador por debajo del umbral (banco 2)"},
  {"P0440", "Sistema de control de emisiones evaporativas — falla general"},
  {"P0442", "Sistema evaporativo — fuga pequeña detectada"},
  {"P0455", "Sistema evaporativo — fuga grande detectada"},
  {"P0500", "Circuito del sensor de velocidad del vehículo"},
  {"P0505", "Sistema de control de ralentí — falla"},
};

inline String translateDtc(const String& code) {
  auto it = GENERIC_DTC_DESCRIPTIONS.find(code);
  if (it != GENERIC_DTC_DESCRIPTIONS.end()) return it->second;

  // Fuera de la tabla genérica — puede ser (a) un P0xxx real que
  // todavía no agregamos, o (b) un código específico de fabricante
  // (P1xxx+). En cualquiera de los dos casos, NO inventamos una
  // descripción — se lo decimos claro al mecánico para que confirme
  // manualmente y esa confirmación sea lo que amplíe esta tabla.
  if (code.length() == 5 && code.charAt(1) == '0') {
    return "Código genérico SAE, todavía sin descripción cargada — confirmá manualmente";
  }
  return "Código específico de fabricante — no traducido automáticamente todavía";
}
