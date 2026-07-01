// ============================================================
// Simulador de flota (demo).
//
// Genera 6 autos virtuales que se mueven por Mendoza y producen
// telemetría con la MISMA forma que va a mandar el equipo real
// (Teltonika OBD2+GPS) el día que esté instalado. Escriben en las
// mismas tablas, marcados con source='simulated', y pasan por el
// mismo mlService.processReading() que va a usar el dato real.
//
// Cuando llegue el hardware, el ingestor real (ver telemetryIngest.js)
// va a escribir con source='real' en las mismas tablas — ambos
// pipelines conviven sin pisarse, se distinguen por vehicle_id y
// por la columna `source`.
//
// Se activa con SIMULATOR_ENABLED=true (ver server.js).
// ============================================================

const pool = require('../config/database');
const mlService = require('./mlService');

const TICK_MS = 8000; // cada 8s se mueve la flota simulada un paso

// Centro aproximado: Mendoza Capital / Maipú / Godoy Cruz.
// Cada auto recorre un circuito cerrado de waypoints (no son calles
// reales, es un loop geográfico plausible para la demo).
const FLEET_DEFS = [
    { plate: 'SIM001', brand: 'Chevrolet', model: 'Onix', center: [-32.8895, -68.8458], radius: 0.015 },
    { plate: 'SIM002', brand: 'Toyota', model: 'Etios', center: [-32.9025, -68.8320], radius: 0.012 },
    { plate: 'SIM003', brand: 'Renault', model: 'Sandero', center: [-32.8720, -68.8600], radius: 0.018 },
    { plate: 'SIM004', brand: 'VW', model: 'Gol Trend', center: [-32.9150, -68.8580], radius: 0.010 },
    { plate: 'SIM005', brand: 'Fiat', model: 'Cronos', center: [-32.8830, -68.8200], radius: 0.014 },
    { plate: 'SIM006', brand: 'Peugeot', model: '208', center: [-32.9300, -68.8450], radius: 0.016 },
];

const PLACEHOLDER_PHOTO = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&q=60';

// estado en memoria por auto: ángulo actual en el círculo + si está
// "en viaje" o "detenido" + trip_id abierto
const state = new Map();

function nextPoint(center, radius, angleRad) {
    const lat = center[0] + radius * Math.sin(angleRad);
    const lng = center[1] + radius * Math.cos(angleRad) * 1.2; // corrige aspecto por latitud
    return { lat, lng };
}

function haversineKm(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(h));
}

async function ensureFleetExists() {
    for (const def of FLEET_DEFS) {
        const [[existing]] = await pool.query('SELECT id FROM Vehicles WHERE plate = ?', [def.plate]);
        let vehicleId;
        if (existing) {
            vehicleId = existing.id;
        } else {
            const [result] = await pool.query(
                `INSERT INTO Vehicles (plate, brand, model, photo_url, status, source, lat, lng, odometer_km)
                 VALUES (?, ?, ?, ?, 'active', 'simulated', ?, ?, ?)`,
                [def.plate, def.brand, def.model, PLACEHOLDER_PHOTO, def.center[0], def.center[1], Math.round(Math.random() * 40000)]
            );
            vehicleId = result.insertId;
        }
        state.set(def.plate, {
            vehicleId,
            angle: Math.random() * Math.PI * 2,
            moving: true,
            stepsUntilStateChange: 5 + Math.floor(Math.random() * 10),
            currentTripId: null,
            lastPoint: { lat: def.center[0], lng: def.center[1] },
        });
    }
}

async function openTrip(vehicleId, point) {
    const [result] = await pool.query(
        `INSERT INTO Trips (vehicle_id, start_time, start_lat, start_lng, source) VALUES (?, NOW(), ?, ?, 'simulated')`,
        [vehicleId, point.lat, point.lng]
    );
    return result.insertId;
}

async function closeTrip(tripId, point, distanceKm) {
    // Tarifa estimada simple: base + por km, similar a lo que cobraría
    // Uber/taxi en un trayecto urbano corto en Mendoza. Es una
    // aproximación para comparar rentabilidad, no una tarifa oficial.
    const estimatedEarnings = Math.round((350 + distanceKm * 180) * 100) / 100;
    await pool.query(
        `UPDATE Trips SET end_time = NOW(), end_lat = ?, end_lng = ?, distance_km = ?,
         duration_minutes = TIMESTAMPDIFF(MINUTE, start_time, NOW()), estimated_earnings = ?
         WHERE id = ?`,
        [point.lat, point.lng, distanceKm, estimatedEarnings, tripId]
    );
}

async function tickVehicle(def) {
    const s = state.get(def.plate);
    if (!s) return;

    s.stepsUntilStateChange -= 1;
    if (s.stepsUntilStateChange <= 0) {
        s.moving = !s.moving;
        s.stepsUntilStateChange = s.moving ? 8 + Math.floor(Math.random() * 12) : 3 + Math.floor(Math.random() * 5);

        if (s.moving && !s.currentTripId) {
            s.currentTripId = await openTrip(s.vehicleId, s.lastPoint);
            s.tripDistance = 0;
        } else if (!s.moving && s.currentTripId) {
            await closeTrip(s.currentTripId, s.lastPoint, s.tripDistance || 0.1);
            s.currentTripId = null;
        }
    }

    let point = s.lastPoint;
    let speed = 0;
    let harshBrake = 0;

    if (s.moving) {
        s.angle += 0.12 + Math.random() * 0.05;
        point = nextPoint(def.center, def.radius, s.angle);
        const stepKm = haversineKm(s.lastPoint, point);
        s.tripDistance = (s.tripDistance || 0) + stepKm;
        speed = 20 + Math.random() * 40;
        harshBrake = Math.random() < 0.06 ? 1 : 0; // ~6% de probabilidad de frenada brusca por tick en movimiento
        if (harshBrake) speed = Math.max(5, speed - 25);
    }

    s.lastPoint = point;

    const reading = {
        engine_rpm: s.moving ? Math.round(900 + speed * 25 + (Math.random() * 300 - 150)) : Math.round(750 + Math.random() * 60),
        speed_kmh: Math.round(speed * 10) / 10,
        engine_load: Math.round((s.moving ? 25 + speed * 0.6 : 8) + (Math.random() * 8 - 4)),
        coolant_temp: Math.round((88 + Math.random() * 6) * 10) / 10,
        battery_voltage: Math.round((12.6 + Math.random() * 0.7 - 0.2) * 100) / 100,
    };

    await pool.query(
        `INSERT INTO Telemetry_Raw (vehicle_id, lat, lng, speed_kmh, engine_rpm, engine_load, coolant_temp, battery_voltage, harsh_brake, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'simulated')`,
        [s.vehicleId, point.lat, point.lng, reading.speed_kmh, reading.engine_rpm, reading.engine_load, reading.coolant_temp, reading.battery_voltage, harshBrake]
    );

    await pool.query(
        `UPDATE Vehicles SET lat = ?, lng = ?, odometer_km = odometer_km + ?, last_ping_at = NOW() WHERE id = ?`,
        [point.lat, point.lng, s.moving ? (s.tripDistance ? haversineKm(s.lastPoint, point) || 0 : 0) : 0, s.vehicleId]
    );

    await mlService.processReading(s.vehicleId, reading, 'simulated');
}

let intervalHandle = null;

async function start() {
    if (intervalHandle) return; // ya corriendo
    await ensureFleetExists();
    console.log(`🧪 Simulador de flota activo: ${FLEET_DEFS.length} autos, tick cada ${TICK_MS / 1000}s`);
    intervalHandle = setInterval(() => {
        FLEET_DEFS.forEach(def => {
            tickVehicle(def).catch(err => console.error('[simulator] error en tick:', err.message));
        });
    }, TICK_MS);
}

function stop() {
    if (intervalHandle) clearInterval(intervalHandle);
    intervalHandle = null;
}

module.exports = { start, stop, FLEET_DEFS };
