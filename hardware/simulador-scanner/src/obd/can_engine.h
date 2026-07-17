#pragma once
#include <Arduino.h>
#include <vector>

// ─────────────────────────────────────────────────────────────
// CanEngine — capa de más alto nivel sobre ISO15765Transport.
// Implementa Mode 03 (SAE J1979: "Request Emission-Related Diagnostic
// Trouble Codes") — estándar, público, igual en cualquier auto OBD-II.
//
// [PENDIENTE DE VALIDAR CONTRA HARDWARE REAL] Esto se escribió
// siguiendo el estándar al pie de la letra, pero nunca se ejecutó
// contra un vehículo real ni contra el transceptor CAN físico — no
// hay forma de simular un bus CAN de un auto real en este entorno de
// desarrollo. Cuando conectes al primer auto, revisar con el monitor
// serie que las respuestas tengan sentido antes de confiar en la
// traducción que se muestra en pantalla/app.
// ─────────────────────────────────────────────────────────────

struct DtcReading {
  String code;         // ej: "P0301"
  String description;  // traducción, si está en la tabla genérica
  bool isGeneric;       // true si el segundo dígito es 0 (P0xxx genérico SAE)
};

class CanEngine {
public:
  bool begin();

  // Pide los DTCs almacenados (Mode 03) y devuelve la lista completa
  // detectada en esta consulta — puede ser 0, 1, o varios.
  std::vector<DtcReading> readStoredDtcs();

  // Para el loop() principal: compara contra la última lectura y
  // avisa si apareció algo NUEVO desde la consulta anterior — así
  // main.cpp no tiene que llevar su propio estado de "ya vi este".
  bool hasNewDtc();
  DtcReading getLastNewDtc();

  bool isBusHealthy() const;

private:
  std::vector<String> knownCodes; // códigos ya vistos en esta sesión, para no re-alertar el mismo DTC en cada poll
  std::vector<DtcReading> pendingNew;
};

extern CanEngine canEngine;
