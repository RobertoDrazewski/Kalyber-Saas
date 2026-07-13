const pool = require('../config/database');
const telemetryIngestReal = require('../services/telemetryIngestReal');

const getLiveTelemetry = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, v.plate, v.source as vehicle_source, dev.model as device_model
            FROM Telemetry_Heuristics t
            JOIN Vehicles v ON t.vehicle_id = v.id
            LEFT JOIN Devices dev ON v.device_id = dev.id
            WHERE t.id IN (
                SELECT MAX(id) FROM Telemetry_Heuristics GROUP BY vehicle_id
            )
            ORDER BY v.plate
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo telemetría en vivo' });
    }
};

// Serie histórica de un vehículo puntual — se usa para el gráfico de
// RPM/velocidad Y para dibujar la trayectoria en el mapa (por eso
// suma lat/lng/heading, que antes no traía).
const getVehicleSeries = async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 40, 200);
    try {
        const [rows] = await pool.query(
            `SELECT recorded_at, speed_kmh, engine_rpm, engine_load, coolant_temp, battery_voltage, lat, lng, heading
             FROM Telemetry_Raw WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT ?`,
            [id, limit]
        );
        res.json(rows.reverse());
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo serie de telemetría' });
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

module.exports = { getLiveTelemetry, getVehicleSeries, ingestRealReading };