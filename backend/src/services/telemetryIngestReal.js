// ============================================================
// Ingesta de telemetría REAL — scaffold para los equipos Jimi IoT
// que ya están en camino: JM-VL04 (Plan Básico) y JM-VL502 (Plan
// Avanzado). Llegan en ~4 días — esto queda listo para cuando los
// programes con la prestadora y los pruebes antes de instalarlos.
//
// Los dos hablan protocolos DISTINTOS a nivel binario, y ambos
// necesitan implementarse recién cuando tengas el equipo real en
// la mano para validar contra bytes reales (implementarlo a ciegas
// generaría un parser que "compila" pero nunca se probó, peor que
// no tenerlo):
//
//   - JM-VL04 (inercial, sin OBD): familia de dispositivos Jimi
//     IoT/Concox — típicamente protocolo GT06 (binario, frames que
//     arrancan con 0x7878 para paquetes cortos y 0x7979 para
//     paquetes largos). Reporta GPS + eventos del acelerómetro/
//     giróscopo de 6 ejes, SIN datos de motor (no tiene ECU/CAN).
//     En Telemetry_Raw, para estos dispositivos vas a insertar
//     engine_rpm/coolant_temp/battery_voltage como NULL siempre —
//     eso ya está contemplado en el esquema.
//
//   - JM-VL502 (escáner OBD2): mismo dispositivo pero con lectura
//     de ECU real vía K-Line/CAN Bus — protocolo probablemente
//     también GT06 con extensiones para los PIDs de motor, pero
//     CONFIRMÁ con el manual/datasheet específico del lote que te
//     llegue, porque Jimi IoT a veces permite configurar JT808 en
//     su lugar según el firmware. Anotá qué protocolo trae apenas
//     lo prendas.
//
// Lo que sí queda listo: el punto de entrada al resto del sistema.
// Cuando el equipo llegue, el parser (paso 2 de abajo) es la única
// pieza que falta escribir — todo lo demás (mlService, tablas,
// dashboard, gating de features por modelo) ya funciona igual para
// 'real' que para 'simulated'.
//
// Pasos para completarlo cuando tengas el equipo en mano:
//   1. Levantar un servidor TCP (net.createServer) en el puerto que
//      configures en el equipo del lado de la prestadora — el
//      equipo se conecta él solo a tu servidor, vos no llamás nada.
//   2. Parsear los paquetes según el protocolo confirmado (GT06 o
//      JT808 — buscar "gt06 protocol parser npm" o implementarlo a
//      partir del manual del fabricante). Guardar el binario crudo
//      de los primeros paquetes reales que lleguen para poder
//      debuggear el parser contra casos reales.
//   3. Extraer los PIDs que interesan: para VL502, RPM, velocidad,
//      carga de motor, temperatura, combustible, DTCs. Para VL04,
//      solo GPS + eventos de frenada/aceleración brusca.
//   4. Mapear el IMEI del paquete a un vehicle_id vía la tabla
//      Devices (columna imei) y llamar a ingestReading() de abajo
//      — ya valida que el device esté pareado antes de insertar.
// ============================================================

const pool = require('../config/database');
const mlService = require('./mlService');

/**
 * Punto de entrada único para telemetría real ya parseada.
 * @param {string} imei - IMEI del equipo (JM-VL04 o JM-VL502)
 * @param {object} reading - { lat, lng, speed_kmh, engine_rpm, engine_load, coolant_temp, battery_voltage, harsh_brake, dtc_codes }
 */
async function ingestReading(imei, reading) {
    const [[device]] = await pool.query(
        `SELECT id, vehicle_id FROM Devices WHERE imei = ? AND status = 'paired'`,
        [imei]
    );
    if (!device || !device.vehicle_id) {
        console.warn(`[telemetryIngestReal] IMEI ${imei} no está pareado a ningún vehículo, se descarta el paquete`);
        return null;
    }

    await pool.query(
        `INSERT INTO Telemetry_Raw (vehicle_id, lat, lng, speed_kmh, engine_rpm, engine_load, coolant_temp, battery_voltage, harsh_brake, dtc_codes, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'real')`,
        [device.vehicle_id, reading.lat, reading.lng, reading.speed_kmh, reading.engine_rpm, reading.engine_load,
         reading.coolant_temp, reading.battery_voltage, reading.harsh_brake ? 1 : 0, reading.dtc_codes || null]
    );

    await pool.query(
        `UPDATE Vehicles SET lat = ?, lng = ?, last_ping_at = NOW() WHERE id = ?`,
        [reading.lat, reading.lng, device.vehicle_id]
    );
    await pool.query(`UPDATE Devices SET last_seen_at = NOW() WHERE id = ?`, [device.id]);

    return mlService.processReading(device.vehicle_id, reading, 'real');
}

module.exports = { ingestReading };
