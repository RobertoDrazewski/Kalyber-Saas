const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

const getTrips = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        let query = `
            SELECT t.*, v.plate, d.full_name as driver_name
            FROM Trips t
            JOIN Vehicles v ON t.vehicle_id = v.id
            LEFT JOIN Drivers d ON t.driver_id = d.id
        `;
        const params = [];
        if (ownerId) {
            query += ` WHERE v.owner_id = ?`;
            params.push(ownerId);
        }
        query += ` ORDER BY t.start_time DESC LIMIT 200`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo historial de viajes' });
    }
};

const getCalendar = async (req, res) => {
    const month = req.query.month;
    try {
        const ownerId = effectiveOwnerId(req);
        const params = [];
        let where = 'WHERE 1=1';
        if (month) {
            where += ' AND DATE_FORMAT(t.start_time, "%Y-%m") = ?';
            params.push(month);
        }
        if (ownerId) {
            where += ' AND v.owner_id = ?';
            params.push(ownerId);
        }

        const [days] = await pool.query(`
            SELECT
                DATE(t.start_time) as day,
                COUNT(*) as trip_count,
                ROUND(SUM(TIMESTAMPDIFF(MINUTE, t.start_time, COALESCE(t.end_time, t.start_time))) / 60, 1) as total_hours,
                ROUND(SUM(t.distance_km), 1) as total_km,
                ROUND(SUM(t.estimated_earnings), 2) as total_earnings
            FROM Trips t
            JOIN Vehicles v ON t.vehicle_id = v.id
            ${where}
            GROUP BY DATE(t.start_time)
            ORDER BY day ASC
        `, params);

        res.json(days);
    } catch (error) {
        console.error('[getCalendar] Error real:', error.message);
        res.status(500).json({ error: 'Error obteniendo calendario de actividad', detalle: error.message });
    }
};

const getDayDetail = async (req, res) => {
    const { day } = req.params;
    try {
        const ownerId = effectiveOwnerId(req);
        const params = [day];
        let where = 'WHERE DATE(t.start_time) = ?';
        if (ownerId) {
            where += ' AND v.owner_id = ?';
            params.push(ownerId);
        }
        const [rows] = await pool.query(`
            SELECT t.*, v.plate, d.full_name as driver_name
            FROM Trips t
            JOIN Vehicles v ON t.vehicle_id = v.id
            LEFT JOIN Drivers d ON t.driver_id = d.id
            ${where}
            ORDER BY t.start_time ASC
        `, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo el detalle del día' });
    }
};

// ============================================================
// Reconstrucción de viajes reales a partir del GPS.
//
// No hay ningún proceso que arme "viajes" a partir de los pings de
// Telemetry_Raw — esto lo resuelve. Un viaje EMPIEZA cuando el auto
// pasa de quieto a en movimiento, y TERMINA cuando queda quieto un
// rato (no en el instante exacto en que frena en un semáforo).
//
// Ojo con lo que NO hace: no inventa "ganancias estimadas" para
// viajes reales — ese campo se deja NULL porque no tenemos ninguna
// tarifa real con la que calcularlo (a diferencia del simulador
// viejo, que sí usaba una fórmula inventada).
// ============================================================

const MOVING_SPEED_KMH = 3;      // por debajo de esto, se considera "quieto" (ruido de GPS)
const STOP_GAP_MINUTES = 4;      // quieto más que esto = el viaje terminó
const MAX_TIME_GAP_MINUTES = 25; // hueco de datos más grande que esto = no se une como el mismo viaje
const MIN_TRIP_DISTANCE_KM = 0.3;
const MIN_TRIP_DURATION_MIN = 1.5;

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeTripMetrics(points) {
    let distanceKm = 0;
    let maxSpeed = 0;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        distanceKm += haversineKm(parseFloat(a.lat), parseFloat(a.lng), parseFloat(b.lat), parseFloat(b.lng));
        maxSpeed = Math.max(maxSpeed, parseFloat(b.speed_kmh) || 0);
    }
    const start = new Date(points[0].recorded_at);
    const end = new Date(points[points.length - 1].recorded_at);
    const durationMin = Math.round((end - start) / 60000);
    return {
        start_time: points[0].recorded_at,
        end_time: points[points.length - 1].recorded_at,
        distance_km: Math.round(distanceKm * 100) / 100,
        duration_min: durationMin,
        max_speed: Math.round(maxSpeed),
        start_lat: points[0].lat,
        start_lng: points[0].lng,
        end_lat: points[points.length - 1].lat,
        end_lng: points[points.length - 1].lng,
    };
}

function segmentIntoTrips(readings) {
    const segments = [];
    let current = null;
    let lastMovingIdx = -1;

    for (let i = 0; i < readings.length; i++) {
        const r = readings[i];
        const prev = readings[i - 1];
        const isMoving = parseFloat(r.speed_kmh) > MOVING_SPEED_KMH;

        if (prev && current) {
            const gapMin = (new Date(r.recorded_at) - new Date(prev.recorded_at)) / 60000;
            if (gapMin > MAX_TIME_GAP_MINUTES) {
                segments.push(current);
                current = null;
            }
        }

        if (isMoving) {
            if (!current) current = [];
            current.push(r);
            lastMovingIdx = i;
        } else if (current) {
            const minutesSinceMove = (new Date(r.recorded_at) - new Date(readings[lastMovingIdx].recorded_at)) / 60000;
            if (minutesSinceMove > STOP_GAP_MINUTES) {
                segments.push(current);
                current = null;
            } else {
                current.push(r);
            }
        }
    }

    return segments
        .map(computeTripMetrics)
        .filter(t => t.distance_km >= MIN_TRIP_DISTANCE_KM && t.duration_min >= MIN_TRIP_DURATION_MIN);
}

async function reconstructTripsForVehicle(vehicleId) {
    const [readings] = await pool.query(
        `SELECT recorded_at, lat, lng, speed_kmh FROM Telemetry_Raw
         WHERE vehicle_id = ? AND source = 'real' AND lat IS NOT NULL AND lng IS NOT NULL
         ORDER BY recorded_at ASC LIMIT 20000`,
        [vehicleId]
    );
    if (readings.length < 2) return 0;

    const trips = segmentIntoTrips(readings);
    const [[vehicle]] = await pool.query('SELECT current_driver_id FROM Vehicles WHERE id = ?', [vehicleId]);

    let inserted = 0;
    for (const trip of trips) {
        const [[existing]] = await pool.query(
            `SELECT id FROM Trips WHERE vehicle_id = ? AND start_time = ?`,
            [vehicleId, trip.start_time]
        );
        if (existing) continue;

        await pool.query(
            `INSERT INTO Trips (vehicle_id, driver_id, start_time, end_time, distance_km, duration_minutes, max_speed_kmh, start_lat, start_lng, end_lat, end_lng, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'real')`,
            [vehicleId, vehicle?.current_driver_id || null, trip.start_time, trip.end_time, trip.distance_km,
             trip.duration_min, trip.max_speed, trip.start_lat, trip.start_lng, trip.end_lat, trip.end_lng]
        );
        inserted++;
    }
    return inserted;
}

const reconstructTrips = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        let query = 'SELECT id FROM Vehicles';
        const params = [];
        if (ownerId) {
            query += ' WHERE owner_id = ?';
            params.push(ownerId);
        }
        const [vehicles] = await pool.query(query, params);

        let totalInserted = 0;
        for (const v of vehicles) {
            totalInserted += await reconstructTripsForVehicle(v.id);
        }
        res.json({ message: 'Viajes reconstruidos', nuevos: totalInserted });
    } catch (error) {
        res.status(500).json({ error: 'Error reconstruyendo viajes' });
    }
};

module.exports = { getTrips, getCalendar, getDayDetail, reconstructTrips };