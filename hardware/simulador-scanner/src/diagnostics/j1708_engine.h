#pragma once
#include <Arduino.h>
#include <vector>

// ─────────────────────────────────────────────────────────────
// J1708Engine — decodifica tramas J1708 sobre RS485 (MAX485,
// GPIO 17/18 TX/RX vía UART1, GPIO 6 para DE/RE).
//
// J1708 es la capa física/de framing (9600 baud, half-duplex).
// J1587 es la capa de aplicación que define qué significan los
// bytes — es la que hace falta para diagnósticos.
//
// Estructura de frame J1708 (esto sí es estándar y confiable):
//   Byte 0: MID (Message ID) — identifica el ECU origen
//   Bytes 1..N-2: datos (PID + valor, formato variable según PID)
//   Byte N-1: checksum (suma de todos los bytes + checksum = 0 mod 256)
//
// ⚠️ ALTO NIVEL DE INCERTIDUMBRE en el parseo del mensaje de
// diagnóstico específico (PID 194, "Component/Fault Codes"): la
// estructura interna de conteo de fallas + SID/PID + FMI que
// debería ir dentro de ese PID no la tengo confirmada con
// suficiente confianza como para codificarla sin verificarla.
// Este motor deja el framing base (MID/PID/checksum) funcionando
// y devuelve el payload crudo del PID 194 sin interpretar — hay
// que capturar tráfico real de un equipo con J1708 (con el modo
// sniffer, igual que hicimos para CAN) y confirmar el formato
// exacto antes de completar parseDiagnosticPayload().
// ─────────────────────────────────────────────────────────────

struct J1708RawMessage {
  uint8_t mid;
  uint8_t pid;
  std::vector<uint8_t> payload; // datos crudos, sin interpretar
};

class J1708Engine {
public:
  void begin();

  // Alimentar byte por byte desde la UART1 (RS485). J1708 no tiene
  // delimitador de inicio/fin explícito — se separan frames por el
  // gap de silencio en el bus (típicamente >2 tiempos de bit sin
  // actividad). Este método asume que ya se resolvió el framing
  // por timeout en el módulo que llama (ver nota en el .cpp).
  bool parseFrame(const uint8_t* rawFrame, uint8_t len, J1708RawMessage& outMsg);

  // Placeholder — NO USAR en producción sin validar contra tráfico
  // real. Devuelve el payload crudo tal cual, no SPN/FMI parseados.
  bool isDiagnosticMessage(const J1708RawMessage& msg) const;

private:
  bool validateChecksum(const uint8_t* rawFrame, uint8_t len) const;
};

extern J1708Engine j1708Engine;
