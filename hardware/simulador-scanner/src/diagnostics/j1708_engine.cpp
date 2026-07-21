#include "j1708_engine.h"

J1708Engine j1708Engine;

constexpr uint8_t PID_COMPONENT_FAULT_CODES = 194; // "diagnóstico" en J1587, no verificado en detalle

void J1708Engine::begin() {
  // Nada que inicializar acá — la UART1 (RS485) se configura en el
  // módulo de transporte serie, este motor solo parsea bytes ya
  // recibidos.
}

bool J1708Engine::validateChecksum(const uint8_t* rawFrame, uint8_t len) const {
  if (len < 2) return false;
  uint8_t sum = 0;
  for (uint8_t i = 0; i < len; i++) sum += rawFrame[i];
  return sum == 0; // el checksum J1708 hace que la suma total dé 0 mod 256
}

bool J1708Engine::parseFrame(const uint8_t* rawFrame, uint8_t len, J1708RawMessage& outMsg) {
  if (len < 3) return false; // MID + al menos 1 byte de dato + checksum

  if (!validateChecksum(rawFrame, len)) {
    return false; // frame corrupto o mal alineado — descartar
  }

  outMsg.mid = rawFrame[0];
  outMsg.pid = rawFrame[1];
  outMsg.payload.assign(rawFrame + 2, rawFrame + len - 1); // excluye MID, PID y checksum

  return true;
}

bool J1708Engine::isDiagnosticMessage(const J1708RawMessage& msg) const {
  // Esto SÍ identifica correctamente que el mensaje es de la familia
  // de diagnóstico (PID 194 es el estándar J1587 para eso). Lo que
  // NO está resuelto es interpretar el contenido de msg.payload como
  // SID/PID + FMI individuales — eso queda pendiente de validación
  // de campo, ver nota en el header.
  return msg.pid == PID_COMPONENT_FAULT_CODES;
}
