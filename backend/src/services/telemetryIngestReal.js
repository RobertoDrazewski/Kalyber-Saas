// ============================================================
// Ingesta de telemetría REAL — REPARADO
// ============================================================

const pool = require('../config/database');
const mlService = require('./mlService');

// [NUEVO 14/07/2026] Eventos puntuales de contacto ON/OFF — pedido
// puntual: además del ícono de estado actual (que ya andaba), el
// cliente quiere VER el encendido/apagado como evento en la lista de
// "Eventos de manejo", con hora y lugar. Antes el ACC solo se guardaba
// como el campo continuo acc_signal en cada lectura de Telemetry_Raw,
// nunca como una fila en Telemetry_Alarms. Guardamos acá (en memoria,
// mismo proceso que gt06Server.js) el último valor conocido por IMEI
// para detectar el CAMBIO — no queremos un evento cada 10 segundos,
// solo cuando de verdad pasó de ON a OFF o viceversa. Funciona para
// los dos equipos porque los dos pasan por ingestReading().
const lastAccByImei = new Map();

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// [NUEVO 16/07/2026] Geocercas calculadas por NOSOTROS a partir del
// GPS real, en vez de depender de que el equipo las detecte solo.
//
// POR QUÉ: hasta ahora, la única forma de saber si un vehículo entró o
// salió de una geocerca era que el EQUIPO la tuviera configurada
// (comando FENCE/0x8600) y nos avisara con su propia alarma nativa
// (0x04/0x05 para VL04, 0x21/0x22 para VL502). Confirmado por logs
// reales: la alarma de SALIDA del VL04 está rota en este firmware, y
// la del VL502 nunca llegó a confirmarse. Resultado: geocercas que no
// avisan nada, aunque el auto haya cruzado el límite de verdad.
//
// CÓMO FUNCIONA AHORA: cada vez que llega una posición real (de
// CUALQUIER equipo, VL04 o VL502 — este archivo es compartido por los
// dos protocolos), comparamos la distancia contra el centro de cada
// geocerca activa del vehículo. Si el estado "adentro/afuera" cambió
// respecto a la última lectura, generamos la alarma nosotros mismos,
// sin depender de que el equipo la detecte. Mismo alarm_id (0x22
// entrada / 0x21 salida) que ya usa TabPosicion.jsx para contar
// entradas/salidas — así el panel no necesita ningún cambio, ya sabe
// leer estos eventos.
// ============================================================
async function checkGeofenceCrossings(vehicleId, lat, lng) {
    const [fences] = await pool.query(
        `SELECT id, name, lat, lng, radius_m, mode, last_known_inside
         FROM Geofences WHERE vehicle_id = ? AND active = 1`,
        [vehicleId]
    );
    if (fences.length === 0) return;

    for (const fence of fences) {
        const distKm = haversineKm(lat, lng, parseFloat(fence.lat), parseFloat(fence.lng));
        const isInsideNow = (distKm * 1000) <= fence.radius_m;
        const wasInside = fence.last_known_inside === null ? null : !!fence.last_known_inside;

        // Primera lectura para esta geocerca: solo fijamos el estado
        // base, sin disparar alarma — no sabemos si "entró ahora" o
        // "ya estaba ahí desde antes de crear la geocerca".
        if (wasInside === null) {
            await pool.query('UPDATE Geofences SET last_known_inside = ? WHERE id = ?', [isInsideNow ? 1 : 0, fence.id]);
            continue;
        }

        if (isInsideNow !== wasInside) {
            const crossedIn = isInsideNow; // true = entró, false = salió
            const shouldAlert =
                fence.mode === 'BOTH' ||
                (fence.mode === 'IN' && crossedIn) ||
                (fence.mode === 'OUT' && !crossedIn);

            if (shouldAlert) {
                try {
                    await pool.query(
                        `INSERT INTO Telemetry_Alarms (vehicle_id, alarm_id, label, description, lat, lng, source)
                         VALUES (?, ?, ?, ?, ?, ?, 'real')`,
                        [
                            vehicleId,
                            crossedIn ? 0x22 : 0x21,
                            crossedIn ? 'geofence_enter_gps' : 'geofence_exit_gps',
                            `${crossedIn ? 'Entró a' : 'Salió de'} "${fence.name || 'geocerca #' + fence.id}" (calculado por GPS)`,
                            lat, lng,
                        ]
                    );
                    console.log(`[Geofence] Vehículo ${vehicleId} ${crossedIn ? 'ENTRÓ a' : 'SALIÓ de'} "${fence.name || fence.id}" (calculado por GPS, no por el equipo)`);
                } catch (err) {
                    console.error(`[Geofence] Error guardando cruce (vehicle_id=${vehicleId}, fence=${fence.id}):`, err.message);
                }
            }
            await pool.query('UPDATE Geofences SET last_known_inside = ? WHERE id = ?', [isInsideNow ? 1 : 0, fence.id]);
        }
    }
}

async function findPairedDevice(imei) {
    const [[device]] = await pool.query(
        `SELECT id, vehicle_id FROM Devices WHERE imei = ? AND status = 'paired'`,
        [imei]
    );
    return device;
}

async function ingestReading(imei, reading) {
    const device = await findPairedDevice(imei);
    if (!device || !device.vehicle_id) {
        console.warn(`[telemetryIngestReal] IMEI ${imei} no está pareado, se descarta`);
        return null;
    }

    const statusFlagsJson = reading.statusFlags ? JSON.stringify(reading.statusFlags) : null;

    // Detección de cambio de contacto — ver nota de lastAccByImei más
    // arriba. Se hace ANTES del insert de Telemetry_Raw a propósito,
    // sin bloquear ese insert si esto llegara a fallar por cualquier
    // motivo (try/catch propio, no se lleva puesta la lectura real).
    if (reading.acc_signal != null) {
        const prevAcc = lastAccByImei.get(imei);
        if (prevAcc !== undefined && prevAcc !== reading.acc_signal) {
            try {
                await ingestAlarm(imei, {
                    id: reading.acc_signal ? 0xFE : 0xFF,
                    label: reading.acc_signal ? 'acc_on' : 'acc_off',
                    desc: reading.acc_signal ? 'Contacto encendido' : 'Contacto apagado',
                }, { lat: reading.lat, lon: reading.lng });
                // [FIX 16/07/2026] Mismo motivo que el fix de reconexión en
                // gt06Server.js — sin esto, quedaba invisible en los logs
                // crudos aunque se guardara bien.
                console.log(`[telemetryIngestReal] 🔑 Contacto ${reading.acc_signal ? 'ENCENDIDO' : 'APAGADO'} detectado y guardado (IMEI ${imei})`);
            } catch (err) {
                console.error(`[telemetryIngestReal] Error guardando evento de contacto (IMEI ${imei}):`, err.message);
            }
        }
        lastAccByImei.set(imei, reading.acc_signal);
    }

    // 1. Insert en Telemetry_Raw (funciona OK)
    await pool.query(
        `INSERT INTO Telemetry_Raw
            (vehicle_id, lat, lng, speed_kmh, heading, engine_rpm, engine_load, coolant_temp, battery_voltage,
             fuel_level, harsh_brake, dtc_codes, source,
             device_odometer_km, fuel_consumption_avg, fuel_consumption_instant, oil_pressure_kpa, oil_life_pct,
             intake_air_temp, cabin_temp, steering_angle, throttle_relative_pct, remaining_fuel_l, acc_signal,
             status_flags, brake_pedal_pct, accelerator_pedal_pct, shift_position, remote_control_signal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'real', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            device.vehicle_id, reading.lat, reading.lng, reading.speed_kmh, reading.heading, reading.engine_rpm, reading.engine_load,
            reading.coolant_temp, reading.battery_voltage, reading.fuel_level ?? null, reading.harsh_brake ? 1 : 0, reading.dtc_codes || null,
            reading.device_odometer_km ?? null, reading.fuel_consumption_avg ?? null, reading.fuel_consumption_instant ?? null,
            reading.oil_pressure_kpa ?? null, reading.oil_life_pct ?? null, reading.intake_air_temp ?? null, reading.cabin_temp ?? null,
            reading.steering_angle ?? null, reading.throttle_relative_pct ?? null, reading.remaining_fuel_l ?? null,
            reading.acc_signal == null ? null : (reading.acc_signal ? 1 : 0),
            statusFlagsJson,
            // [NUEVO 14/07/2026] El parser de jt808Handler.js ya sacaba
            // estos 4 campos de la trama real, pero nunca se guardaban
            // porque no había columna ni se pasaban acá — confirmado con
            // bytes reales que brake_pedal/accelerator_pedal SÍ llegan.
            reading.brake_pedal ?? null, reading.accelerator_pedal ?? null,
            reading.shift_position ?? null, reading.remote_control_signal ?? null,
        ]
    );

    // 2. Update en Vehicles (Reparado para evitar errores de columnas dinámicas)
    // Usamos una estructura fija para el UPDATE y evitamos join() dinámico que rompe el orden de parámetros
    const hasCoords = reading.lat != null && reading.lng != null;
    
    // Red de seguridad: si este UPDATE falla por cualquier motivo (el
    // bug de arriba, o algo nuevo el día de mañana), que NO se lleve
    // puesto lo de abajo (last_seen_at + mlService) — Telemetry_Raw ya
    // quedó guardado en el paso 1 pase lo que pase acá.
    try {
        if (hasCoords) {
            const [[prevState]] = await pool.query('SELECT lat, lng, odometer_km FROM Vehicles WHERE id = ?', [device.vehicle_id]);
            // FIX CRÍTICO (13/07/2026): mysql2 devuelve las columnas DECIMAL
            // como STRING por defecto (para no perder precisión) — sin este
            // parseFloat, "newOdometer" arrancaba siendo un string tipo
            // "44197.40", y "newOdometer += dist" hacía CONCATENACIÓN DE
            // TEXTO en vez de suma ("44197.40" + 0.142... = "44197.400.142...").
            // Ese valor corrupto rompía el UPDATE de Vehicles con error de
            // MySQL ("Incorrect decimal value"), lo que tiraba una excepción
            // ANTES de llegar a actualizar Devices.last_seen_at y de llamar a
            // mlService.processReading() — es decir, aunque Telemetry_Raw se
            // seguía insertando bien (esa query corre antes y no depende de
            // esto), la tabla Vehicles (de donde el panel lee "última
            // posición" y "último estado") y las heurísticas de manejo
            // dejaban de actualizarse por completo, para los DOS equipos
            // (este archivo es compartido entre gt06Server.js y
            // jt808Handler.js). Confirmado en logs reales: 122 fallos en
            // VL04 y 13 en VL502 con el mismo mensaje de error exacto.
            let newOdometer = parseFloat(prevState?.odometer_km) || 0;
            if (prevState?.lat != null && (reading.speed_kmh ?? 0) > 2) {
                const dist = haversineKm(parseFloat(prevState.lat), parseFloat(prevState.lng), reading.lat, reading.lng);
                if (dist > 0 && dist < 3) newOdometer += dist;
            }

            await pool.query(
                `UPDATE Vehicles SET lat=?, lng=?, heading=?, odometer_km=?, speed_kmh=?, last_ping_at=NOW(), 
                 last_rpm=?, last_fuel_level=?, last_status_flags=?, device_odometer_km=? WHERE id=?`,
                [reading.lat, reading.lng, reading.heading, newOdometer, reading.speed_kmh ?? null, 
                 reading.engine_rpm ?? null, reading.fuel_level ?? null, statusFlagsJson, reading.device_odometer_km ?? null, device.vehicle_id]
            );
        } else {
            await pool.query(
                `UPDATE Vehicles SET last_ping_at=NOW(), last_rpm=?, last_fuel_level=?, last_status_flags=?, device_odometer_km=? WHERE id=?`,
                [reading.engine_rpm ?? null, reading.fuel_level ?? null, statusFlagsJson, reading.device_odometer_km ?? null, device.vehicle_id]
            );
        }
    } catch (err) {
        console.error(`[telemetryIngestReal] Error actualizando Vehicles (IMEI ${imei}) — Telemetry_Raw sí se guardó, pero el panel no va a ver esta lectura como "última posición":`, err.message);
    }

    // [NUEVO 16/07/2026] Chequeo de geocercas por GPS — ver nota completa
    // en checkGeofenceCrossings() más arriba. Propio try/catch: una
    // geocerca mal configurada nunca debe tirar abajo el resto de la
    // ingesta (posición/odómetro/ACC ya quedaron guardados arriba).
    if (hasCoords) {
        try {
            await checkGeofenceCrossings(device.vehicle_id, reading.lat, reading.lng);
        } catch (err) {
            console.error(`[telemetryIngestReal] Error chequeando geocercas (IMEI ${imei}):`, err.message);
        }
    }

    await pool.query(`UPDATE Devices SET last_seen_at = NOW() WHERE id = ?`, [device.id]);
    return mlService.processReading(device.vehicle_id, reading, 'real');
}

// ingestAlarm, ingestTroubleCodes e ingestTripEvent permanecen igual (funcionan OK)
async function ingestAlarm(imei, alarm, location = {}) {
    const device = await findPairedDevice(imei);
    if (!device) return null;
    await pool.query(`INSERT INTO Telemetry_Alarms (vehicle_id, alarm_id, label, description, lat, lng, source) VALUES (?, ?, ?, ?, ?, ?, 'real')`,
        [device.vehicle_id, alarm.id, alarm.label, alarm.desc || null, location.lat ?? null, location.lon ?? null]);
    return { vehicle_id: device.vehicle_id };
}

async function ingestTroubleCodes(imei, dtcData) {
    const device = await findPairedDevice(imei);
    if (!device) return null;
    for (const system of dtcData.systems) {
        if (!system.codes.length) continue;
        await pool.query(`INSERT INTO Telemetry_DTC (vehicle_id, system_id, trouble_codes, source) VALUES (?, ?, ?, 'real')`,
            [device.vehicle_id, system.systemId, JSON.stringify(system.codes)]);
    }
    return { vehicle_id: device.vehicle_id };
}

async function ingestTripEvent(imei, tripData) {
    const device = await findPairedDevice(imei);
    if (!device) return null;
    if (tripData.kind === 'inicio') {
        await pool.query(`INSERT INTO Telemetry_TripsDevice (vehicle_id, travel_number, start_time, status, source) VALUES (?, ?, ?, 'en_curso', 'real') ON DUPLICATE KEY UPDATE start_time = VALUES(start_time)`,
            [device.vehicle_id, tripData.travelNumber, tripData.startTime]);
    } else if (tripData.kind === 'fin') {
        await pool.query(`INSERT INTO Telemetry_TripsDevice (vehicle_id, travel_number, start_time, end_time, distance_km, status, source) VALUES (?, ?, ?, ?, ?, 'finalizado', 'real') ON DUPLICATE KEY UPDATE end_time = VALUES(end_time), distance_km = VALUES(distance_km)`,
            [device.vehicle_id, tripData.travelNumber, tripData.startTime, tripData.endTime, tripData.distanceKm]);
    }
    return { vehicle_id: device.vehicle_id };
}

// ============================================================
// [NUEVO 14/07/2026] Corrección retroactiva de manipulación —
// confirmado con logs reales: cuando el equipo está desconectado, no
// tiene señal para avisar nada en el momento. Las alarmas de "golpe"
// (colisión, aceleración/giro brusco) que pasan MIENTRAS lo están
// manoseando quedan en cola y se mandan TODAS JUNTAS recién cuando
// reconecta — antes que el propio corte de energía / reconexión, que
// suele llegar último en esa ráfaga. La corrección hacia adelante que
// ya existía en gt06Server.js (marcar como manipulación lo que llega
// DESPUÉS de un corte) se perdía estos casos porque el orden real es
// al revés. Esto corrige retroactivamente: cuando llega el corte de
// energía o la reconexión, reclasifica las alarmas de golpe de los
// últimos `windowMs` que ya se habían guardado con la etiqueta real
// (ej: "collision") por una etiqueta de manipulación.
// ============================================================
const SHOCK_ALARM_LABELS = ['collision', 'harsh_acceleration', 'sharp_left_turn', 'sharp_right_turn', 'vibration'];

async function relabelRecentShockAsTamper(imei, windowMs) {
    const device = await findPairedDevice(imei);
    if (!device) return null;
    const placeholders = SHOCK_ALARM_LABELS.map(() => '?').join(',');
    const [result] = await pool.query(
        `UPDATE Telemetry_Alarms
         SET label = 'tamper_suspected_shock',
             description = CONCAT('Posible manipulación del equipo (golpe/vibración cerca de un corte de energía — reclasificado retroactivamente, original: ', label, ')')
         WHERE vehicle_id = ? AND label IN (${placeholders}) AND recorded_at >= (NOW() - INTERVAL ? SECOND)`,
        [device.vehicle_id, ...SHOCK_ALARM_LABELS, Math.ceil(windowMs / 1000)]
    );
    if (result.affectedRows > 0) {
        console.log(`[Tamper] Reclasificadas ${result.affectedRows} alarma(s) de golpe como manipulación (vehicle_id=${device.vehicle_id})`);
    }
    return { vehicle_id: device.vehicle_id, relabeled: result.affectedRows };
}

module.exports = { ingestReading, ingestAlarm, ingestTroubleCodes, ingestTripEvent, relabelRecentShockAsTamper };