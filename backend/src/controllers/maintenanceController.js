const pool = require('../config/database');

const getMaintenanceAlerts = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT v.id as vehicle_id, v.plate, v.brand, v.model, v.photo_url,
                   t.tire_wear_score, t.brake_wear_score, t.driver_score,
                   t.anomaly_flag, t.anomaly_detail, t.ai_recommendation, t.recorded_at
            FROM Telemetry_Heuristics t
            JOIN Vehicles v ON t.vehicle_id = v.id
            WHERE t.id IN (SELECT MAX(id) FROM Telemetry_Heuristics GROUP BY vehicle_id)
            AND (t.tire_wear_score < 60 OR t.brake_wear_score < 60 OR t.anomaly_flag = 1)
            ORDER BY LEAST(t.tire_wear_score, t.brake_wear_score) ASC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo alertas de mantenimiento' });
    }
};

// Estado completo (no solo alertas) para gráficos comparativos de flota.
const getFleetHealth = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT v.id as vehicle_id, v.plate, t.tire_wear_score, t.brake_wear_score, t.driver_score
            FROM Telemetry_Heuristics t
            JOIN Vehicles v ON t.vehicle_id = v.id
            WHERE t.id IN (SELECT MAX(id) FROM Telemetry_Heuristics GROUP BY vehicle_id)
            ORDER BY v.plate
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo salud de flota' });
    }
};

module.exports = { getMaintenanceAlerts, getFleetHealth };
