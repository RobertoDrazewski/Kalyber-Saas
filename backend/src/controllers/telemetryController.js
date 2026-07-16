const pool = require('../config/database');
const telemetryIngestReal = require('../services/telemetryIngestReal');
const { effectiveOwnerId } = require('../middlewares/requireRole');

// Trae, además de lo que ya había, todo lo que el equipo VL502 cachea
// en Vehicles (odómetro propio, combustible, snapshot de luces/
// puertas/etc, ACC) — así el panel no tiene que pegarle a
// Telemetry_Raw por separado para pintar el estado actual del auto.
const getLiveTelemetry = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        // [FIX 16/07/2026] Mismo criterio que getVehicleSeries — sin
        // filtrar por source='real', un vehículo con lecturas viejas de
        // demo/simulador podía traer acá esa fila en vez de la real (o
        // tapar el hueco de un vehículo que sí tiene datos reales pero
        // más antiguos que los de demo).
        let query = `
            SELECT t.*, v.plate, v.source as vehicle_source, v.lat, v.lng, v.heading,
                   v.odometer_km, v.device_odometer_km, v.last_fuel_level, v.last_status_flags,
                   v.last_ping_at, dev.model as device_model, dev.imei as device_imei
            FROM Telemetry_Heuristics t
            JOIN Vehicles v ON t.vehicle_id = v.id
            LEFT JOIN Devices dev ON v.device_id = dev.id
            WHERE t.source = 'real' AND t.id IN (
                SELECT MAX(id) FROM Telemetry_Heuristics WHERE source = 'real' GROUP BY vehicle_id
            )
        `;
        const params = [];
        if (ownerId) {
            query += ` AND v.owner_id = ?`;
            params.push(ownerId);
        }
        query += ` ORDER BY v.plate`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo telemetría en vivo' });
    }
};

// Confirma que el vehículo pedido pertenezca a la flota de quien
// pregunta (mismo criterio que ya usan vehiclesController/
// devicesController) — antes estos endpoints no chequeaban nada.
async function assertVehicleAccess(req, vehicleId) {
    const ownerId = effectiveOwnerId(req);
    if (!ownerId) return true; // super_admin sin filtro
    const [[vehicle]] = await pool.query('SELECT owner_id FROM Vehicles WHERE id = ?', [vehicleId]);
    return !!vehicle && vehicle.owner_id === ownerId;
}

// Serie histórica de un vehículo puntual — se usa para el gráfico de
// RPM/velocidad Y para dibujar la trayectoria en el mapa. Extendida
// con TODOS los campos que el VL502 puede llegar a mandar, para que
// el panel avanzado tenga de dónde graficar sin pedir nada más.
//
// [FIX 16/07/2026] Faltaba filtrar por source='real'. Sin esto, un
// vehículo que en algún momento tuvo datos de DEMO/simulador cargados
// (Telemetry_Raw.source='simulated' — típico de un auto que arrancó
// como demo antes de instalarle el hardware real) mezclaba esas
// lecturas viejas con las reales de hoy en el MISMO gráfico y en la
// MISMA polilínea del mapa. Efecto visible confirmado en la Kangoo
// (AE376ZB, VL04): el gráfico mostraba picos de RPM de hasta 8000,
// algo que el VL04 real NUNCA manda (confirmado en gt06Server.js —
// ese equipo siempre guarda engine_rpm=null), y el mapa dibujaba
// líneas erráticas en forma de estrella — la polilínea conectando en
// orden cronológico puntos reales de hoy con puntos simulados de otro
// momento/ubicación. Filtrando por source='real' acá alcanza para
// arreglar los dos síntomas a la vez, porque el chart Y la polyline
// del mapa en TabPosicion.jsx toman los datos de este mismo endpoint.
const getVehicleSeries = async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 40, 200);
    try {
        if (!(await assertVehicleAccess(req, id))) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }
        const [rows] = await pool.query(
            `SELECT recorded_at, speed_kmh, engine_rpm, engine_load, coolant_temp, battery_voltage, lat, lng, heading,
                    fuel_level, device_odometer_km, fuel_consumption_avg, fuel_consumption_instant,
                    oil_pressure_kpa, oil_life_pct, intake_air_temp, cabin_temp, steering_angle,
                    throttle_relative_pct, remaining_fuel_l, acc_signal, harsh_brake, dtc_codes,
                    brake_pedal_pct, accelerator_pedal_pct, shift_position, remote_control_signal, status_flags
             FROM Telemetry_Raw WHERE vehicle_id = ? AND source = 'real' ORDER BY recorded_at DESC LIMIT ?`,
            [id, limit]
        );
        res.json(rows.reverse());
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo serie de telemetría' });
    }
};

// [NUEVO] Historial real de alarmas / comportamiento de manejo del
// VL502 (frenada brusca, giro brusco, colisión, geocerca, exceso de
// velocidad, etc — cada una como evento propio, con ubicación).
const getVehicleAlarms = async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 300);
    try {
        if (!(await assertVehicleAccess(req, id))) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }
        const [rows] = await pool.query(
            `SELECT id, alarm_id, label, description, lat, lng, recorded_at
             FROM Telemetry_Alarms WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT ?`,
            [id, limit]
        );
        res.json(rows);
    } catch (error) {
        // Si la migración de Telemetry_Alarms todavía no corrió, no
        // tiramos un 500 feo — devolvemos vacío para que el panel
        // simplemente no muestre esta sección.
        if (error.code === 'ER_NO_SUCH_TABLE') return res.json([]);
        res.status(500).json({ error: 'Error obteniendo alarmas del vehículo' });
    }
};

// [NUEVO] Códigos de falla (DTC) reportados por el equipo.
const getVehicleDTC = async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    try {
        if (!(await assertVehicleAccess(req, id))) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }
        const [rows] = await pool.query(
            `SELECT id, system_id, trouble_codes, recorded_at
             FROM Telemetry_DTC WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT ?`,
            [id, limit]
        );
        res.json(rows);
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') return res.json([]);
        res.status(500).json({ error: 'Error obteniendo códigos de falla' });
    }
};

// [NUEVO] Viajes reportados por el propio equipo (odómetro y
// combustible reales del tramo, no reconstruidos por GPS).
const getVehicleTripsDevice = async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    try {
        if (!(await assertVehicleAccess(req, id))) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }
        const [rows] = await pool.query(
            `SELECT id, travel_number, start_time, end_time, start_lat, start_lng, end_lat, end_lng,
                    idling_count, idling_seconds, distance_km, fuel_consumed_l, status
             FROM Telemetry_TripsDevice WHERE vehicle_id = ? ORDER BY start_time DESC LIMIT ?`,
            [id, limit]
        );
        res.json(rows);
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') return res.json([]);
        res.status(500).json({ error: 'Error obteniendo viajes del equipo' });
    }
};

// Endpoint de ingesta real. Cuando el Teltonika esté conectado por
// TCP, ese servicio va a llamar telemetryIngestReal.ingestReading()
// directamente; este endpoint HTTP queda disponible igual para
// pruebas manuales o para un gateway intermedio que sí hable HTTP.
const ingestRealReading = async (req, res) => {
    const { imei, ...reading } = req.body;
    if (!imei) return res.status(400).json({ error: 'Falta el IMEI del equipo' });
    try {
        const result = await telemetryIngestReal.ingestReading(imei, reading);
        if (!result) return res.status(404).json({ error: 'IMEI no pareado a ningún vehículo' });
        res.json({ message: 'Lectura procesada', result });
    } catch (error) {
        res.status(500).json({ error: 'Error procesando la lectura' });
    }
};

module.exports = {
    getLiveTelemetry,
    getVehicleSeries,
    getVehicleAlarms,
    getVehicleDTC,
    getVehicleTripsDevice,
    ingestRealReading,
};