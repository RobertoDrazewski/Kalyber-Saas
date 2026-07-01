// ============================================================
// Ingesta de telemetría REAL — scaffold para cuando llegue el
// equipo Teltonika (FMB920/FMB130) con OBD2.
//
// El Teltonika habla el protocolo Codec8/Codec8 Extended por
// TCP. Esto NO está implementado todavía porque no hay hardware
// para probar contra un parser real — implementarlo a ciegas
// generaría un parser que "compila" pero nunca se validó contra
// bytes reales del dispositivo, lo cual es peor que no tenerlo.
//
// Lo que sí queda listo: el punto de entrada al resto del sistema.
// Cuando el equipo llegue, esta función es la única pieza que falta
// escribir — todo lo demás (mlService, tablas, dashboard) ya
// funciona igual para 'real' que para 'simulated'.
//
// Pasos para completarlo cuando tengas el equipo en mano:
//   1. Levantar un servidor TCP (net.createServer) en el puerto que
//      configures en el equipo.
//   2. Parsear los paquetes Codec8 (hay parsers open source en
//      npm, ej. buscar "teltonika-codec8" o similar, o escribir uno
//      a partir de la documentación oficial de Teltonika).
//   3. Extraer del OBD2 los PIDs que interesan: RPM, velocidad,
//      carga de motor, temperatura, voltaje de batería, DTCs.
//   4. Mapear el IMEI del paquete a un vehicle_id vía la tabla
//      Devices (columna imei) y llamar a ingestReading() de abajo.
// ============================================================

const pool = require('../config/database');
const mlService = require('./mlService');

/**
 * Punto de entrada único para telemetría real ya parseada.
 * @param {string} imei - IMEI del equipo Teltonika
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
