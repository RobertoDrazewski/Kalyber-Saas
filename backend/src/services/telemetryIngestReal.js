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

// Distancia entre dos coordenadas (fórmula haversine), en km.
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Punto de entrada único para telemetría real ya parseada.
 * @param {string} imei - IMEI del equipo (JM-VL04 o JM-VL502)
 * @param {object} reading - { lat, lng, speed_kmh, heading, engine_rpm, engine_load, coolant_temp, battery_voltage, harsh_brake, dtc_codes }
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
        `INSERT INTO Telemetry_Raw (vehicle_id, lat, lng, speed_kmh, heading, engine_rpm, engine_load, coolant_temp, battery_voltage, fuel_level, harsh_brake, dtc_codes, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'real')`,
        [device.vehicle_id, reading.lat, reading.lng, reading.speed_kmh, reading.heading, reading.engine_rpm, reading.engine_load,
         reading.coolant_temp, reading.battery_voltage, reading.fuel_level ?? null, reading.harsh_brake ? 1 : 0, reading.dtc_codes || null]
    );

    // Protección crítica: Solo actualizar lat/lng en la tabla Vehicles si el paquete trae coordenadas.
    // Evita que los paquetes OBD (0x37) borren la última posición conocida del vehículo poniéndola en NULL.
    if (reading.lat !== null && reading.lng !== null && reading.lat !== undefined && reading.lng !== undefined) {
        // Incremento automático del odómetro por distancia GPS real.
        // Guardas para no ensuciar el dato:
        //   - Solo suma si veníamos con una posición previa (no en el
        //     primer ping).
        //   - Solo suma si speed_kmh > 2 — con el auto detenido, el GPS
        //     "tiembla" unos metros entre lectura y lectura (lo vimos
        //     en los logs reales), y sin este filtro esos metros se
        //     irían acumulando de forma falsa aunque el auto no se
        //     mueva nunca.
        //   - Techo de 3km por lectura, por si un salto de GPS raro
        //     (falla de señal momentánea) reporta una distancia absurda
        //     de golpe — no debería pasar en operación normal dado el
        //     intervalo de reporte, pero mejor no confiar ciegamente.
        const [[prevState]] = await pool.query(
            'SELECT lat, lng, odometer_km FROM Vehicles WHERE id = ?',
            [device.vehicle_id]
        );

        let newOdometer = prevState?.odometer_km ?? 0;
        if (prevState?.lat != null && prevState?.lng != null && (reading.speed_kmh ?? 0) > 2) {
            const distanceKm = haversineKm(
                parseFloat(prevState.lat), parseFloat(prevState.lng),
                reading.lat, reading.lng
            );
            if (distanceKm > 0 && distanceKm < 3) {
                newOdometer = parseFloat(newOdometer) + distanceKm;
            }
        }

        await pool.query(
            `UPDATE Vehicles SET lat = ?, lng = ?, heading = ?, odometer_km = ?, speed_kmh = ?, last_ping_at = NOW() WHERE id = ?`,
            [reading.lat, reading.lng, reading.heading, newOdometer, reading.speed_kmh ?? null, device.vehicle_id]
        );
    } else {
        // Aquí caen los paquetes 0x0900 (OBD Transmisión Transparente) del VL502
        await pool.query(
            `UPDATE Vehicles SET 
                last_ping_at = NOW(),
                last_rpm = COALESCE(?, last_rpm)
             WHERE id = ?`,
            [reading.engine_rpm, device.vehicle_id]
        );
    }

    await pool.query(`UPDATE Devices SET last_seen_at = NOW() WHERE id = ?`, [device.id]);

    return mlService.processReading(device.vehicle_id, reading, 'real');
}

module.exports = { ingestReading };