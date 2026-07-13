// ============================================================
// Ingesta de telemetría REAL — punto de entrada único al que le
// llegan los datos ya parseados de GT06 (VL04) y JT808 (VL502).
//
// ACTUALIZACIÓN: se agregaron tres funciones nuevas —
// ingestAlarm, ingestTroubleCodes e ingestTripEvent — para alojar
// todo lo que el manual del VL502 permite sacar y que antes se
// perdía o se aplastaba contra un solo booleano (harsh_brake). Ver
// migration_vl502_extended.sql para las tablas/columnas nuevas que
// esto necesita antes de deployar.
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

async function findPairedDevice(imei) {
    const [[device]] = await pool.query(
        `SELECT id, vehicle_id FROM Devices WHERE imei = ? AND status = 'paired'`,
        [imei]
    );
    return device;
}

/**
 * Punto de entrada único para telemetría real ya parseada.
 * @param {string} imei - IMEI del equipo (JM-VL04 o JM-VL502)
 * @param {object} reading - lecturas de motor/posición + (nuevo) campos extendidos del VL502
 */
async function ingestReading(imei, reading) {
    const device = await findPairedDevice(imei);
    if (!device || !device.vehicle_id) {
        console.warn(`[telemetryIngestReal] IMEI ${imei} no está pareado a ningún vehículo, se descarta el paquete`);
        return null;
    }

    const statusFlagsJson = reading.statusFlags ? JSON.stringify(reading.statusFlags) : null;

    await pool.query(
        `INSERT INTO Telemetry_Raw
            (vehicle_id, lat, lng, speed_kmh, heading, engine_rpm, engine_load, coolant_temp, battery_voltage,
             fuel_level, harsh_brake, dtc_codes, source,
             device_odometer_km, fuel_consumption_avg, fuel_consumption_instant, oil_pressure_kpa, oil_life_pct,
             intake_air_temp, cabin_temp, steering_angle, throttle_relative_pct, remaining_fuel_l, acc_signal,
             status_flags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'real', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            device.vehicle_id, reading.lat, reading.lng, reading.speed_kmh, reading.heading, reading.engine_rpm, reading.engine_load,
            reading.coolant_temp, reading.battery_voltage, reading.fuel_level ?? null, reading.harsh_brake ? 1 : 0, reading.dtc_codes || null,
            reading.device_odometer_km ?? null, reading.fuel_consumption_avg ?? null, reading.fuel_consumption_instant ?? null,
            reading.oil_pressure_kpa ?? null, reading.oil_life_pct ?? null, reading.intake_air_temp ?? null, reading.cabin_temp ?? null,
            reading.steering_angle ?? null, reading.throttle_relative_pct ?? null, reading.remaining_fuel_l ?? null,
            reading.acc_signal === null || reading.acc_signal === undefined ? null : (reading.acc_signal ? 1 : 0),
            statusFlagsJson,
        ]
    );

    // Cache en Vehicles de lo último conocido — mismo patrón que ya
    // existía para last_rpm, extendido a odómetro del equipo, nivel
    // de combustible y el snapshot de estado (luces/puertas/etc), así
    // el panel puede pedir "estado actual" sin pegarle a Telemetry_Raw.
    const cacheFields = [];
    const cacheParams = [];
    if (reading.device_odometer_km != null) { cacheFields.push('device_odometer_km = ?'); cacheParams.push(reading.device_odometer_km); }
    if (reading.fuel_level != null) { cacheFields.push('last_fuel_level = ?'); cacheParams.push(reading.fuel_level); }
    if (statusFlagsJson) { cacheFields.push('last_status_flags = ?'); cacheParams.push(statusFlagsJson); }
    if (reading.engine_rpm != null) { cacheFields.push('last_rpm = ?'); cacheParams.push(reading.engine_rpm); }

    // Protección crítica: Solo actualizar lat/lng en la tabla Vehicles si el paquete trae coordenadas.
    // Evita que los paquetes OBD (0x37 / 0x0900 sin GPS) borren la última posición conocida poniéndola en NULL.
    if (reading.lat !== null && reading.lng !== null && reading.lat !== undefined && reading.lng !== undefined) {
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
            `UPDATE Vehicles SET lat = ?, lng = ?, heading = ?, odometer_km = ?, speed_kmh = ?, last_ping_at = NOW()
             ${cacheFields.length ? ', ' + cacheFields.join(', ') : ''} WHERE id = ?`,
            [reading.lat, reading.lng, reading.heading, newOdometer, reading.speed_kmh ?? null, ...cacheParams, device.vehicle_id]
        );
    } else {
        // Aquí caen los paquetes 0x0900 (OBD Transmisión Transparente) del VL502
        await pool.query(
            `UPDATE Vehicles SET
                last_ping_at = NOW(),
                last_rpm = COALESCE(?, last_rpm)
                ${cacheFields.length ? ', ' + cacheFields.join(', ') : ''}
             WHERE id = ?`,
            [reading.engine_rpm, ...cacheParams, device.vehicle_id]
        );
    }

    await pool.query(`UPDATE Devices SET last_seen_at = NOW() WHERE id = ?`, [device.id]);

    return mlService.processReading(device.vehicle_id, reading, 'real');
}

/**
 * [NUEVO] Registra un evento de alarma/comportamiento de manejo
 * (frenada brusca, giro brusco, colisión, geocerca, exceso de
 * velocidad, etc — Tabla 28 del manual VL502) como fila individual
 * en Telemetry_Alarms, en vez de perderlo dentro de un texto suelto.
 * @param {string} imei
 * @param {{id:number, label:string, desc:string}} alarm
 * @param {{lat:?number, lon:?number}} location
 */
async function ingestAlarm(imei, alarm, location = {}) {
    const device = await findPairedDevice(imei);
    if (!device || !device.vehicle_id) {
        console.warn(`[telemetryIngestReal] ingestAlarm: IMEI ${imei} no está pareado, se descarta`);
        return null;
    }
    await pool.query(
        `INSERT INTO Telemetry_Alarms (vehicle_id, alarm_id, label, description, lat, lng, source)
         VALUES (?, ?, ?, ?, ?, ?, 'real')`,
        [device.vehicle_id, alarm.id, alarm.label, alarm.desc || null, location.lat ?? null, location.lon ?? null]
    );
    return { vehicle_id: device.vehicle_id };
}

/**
 * [NUEVO] Registra códigos de falla (DTC) reportados por el equipo,
 * uno por sistema (J1939/OBDII/J1708 según el vehículo).
 * @param {string} imei
 * @param {{systems: Array<{systemId:number, codes:string[]}>}} dtcData
 */
async function ingestTroubleCodes(imei, dtcData) {
    const device = await findPairedDevice(imei);
    if (!device || !device.vehicle_id) {
        console.warn(`[telemetryIngestReal] ingestTroubleCodes: IMEI ${imei} no está pareado, se descarta`);
        return null;
    }
    for (const system of dtcData.systems) {
        if (!system.codes.length) continue;
        await pool.query(
            `INSERT INTO Telemetry_DTC (vehicle_id, system_id, trouble_codes, source) VALUES (?, ?, ?, 'real')`,
            [device.vehicle_id, system.systemId, JSON.stringify(system.codes)]
        );
    }
    return { vehicle_id: device.vehicle_id };
}

/**
 * [NUEVO] Registra inicio/fin de viaje reportado por el propio
 * equipo (odómetro y combustible reales del tramo, a diferencia del
 * TabHistorico actual que reconstruye viajes solo con GPS).
 * @param {string} imei
 * @param {object} tripData - resultado de jt808Handler.parseTravelData
 */
async function ingestTripEvent(imei, tripData) {
    const device = await findPairedDevice(imei);
    if (!device || !device.vehicle_id) {
        console.warn(`[telemetryIngestReal] ingestTripEvent: IMEI ${imei} no está pareado, se descarta`);
        return null;
    }

    if (tripData.kind === 'inicio') {
        await pool.query(
            `INSERT INTO Telemetry_TripsDevice (vehicle_id, travel_number, start_time, status, source)
             VALUES (?, ?, ?, 'en_curso', 'real')
             ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), status = 'en_curso'`,
            [device.vehicle_id, tripData.travelNumber, tripData.startTime]
        );
    } else if (tripData.kind === 'fin') {
        await pool.query(
            `INSERT INTO Telemetry_TripsDevice
                (vehicle_id, travel_number, start_time, end_time, start_lat, start_lng, end_lat, end_lng,
                 idling_count, idling_seconds, distance_km, fuel_consumed_l, status, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finalizado', 'real')
             ON DUPLICATE KEY UPDATE
                end_time = VALUES(end_time), start_lat = VALUES(start_lat), start_lng = VALUES(start_lng),
                end_lat = VALUES(end_lat), end_lng = VALUES(end_lng), idling_count = VALUES(idling_count),
                idling_seconds = VALUES(idling_seconds), distance_km = VALUES(distance_km),
                fuel_consumed_l = VALUES(fuel_consumed_l), status = 'finalizado'`,
            [
                device.vehicle_id, tripData.travelNumber, tripData.startTime, tripData.endTime,
                tripData.startLat, tripData.startLon, tripData.endLat, tripData.endLon,
                tripData.idlingCount, tripData.idlingSeconds, tripData.distanceKm, tripData.fuelConsumedL,
            ]
        );
    }
    return { vehicle_id: device.vehicle_id };
}

module.exports = { ingestReading, ingestAlarm, ingestTroubleCodes, ingestTripEvent };