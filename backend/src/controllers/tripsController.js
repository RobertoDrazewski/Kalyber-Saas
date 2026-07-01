const pool = require('../config/database');

const getTrips = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT t.*, v.plate, d.full_name as driver_name
            FROM Trips t
            JOIN Vehicles v ON t.vehicle_id = v.id
            LEFT JOIN Drivers d ON t.driver_id = d.id
            ORDER BY t.start_time DESC LIMIT 200
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo historial de viajes' });
    }
};

// Calendario de actividad: un registro por día con horas trabajadas,
// cantidad de viajes y km, reconstruido a partir de los Trips reales
// (que a su vez vienen del GPS/telemetría, real o simulada).
const getCalendar = async (req, res) => {
    const month = req.query.month; // formato 'YYYY-MM', opcional
    try {
        const params = [];
        let whereMonth = '';
        if (month) {
            whereMonth = 'WHERE DATE_FORMAT(t.start_time, "%Y-%m") = ?';
            params.push(month);
        }

        const [days] = await pool.query(`
            SELECT
                DATE(t.start_time) as day,
                COUNT(*) as trip_count,
                ROUND(SUM(TIMESTAMPDIFF(MINUTE, t.start_time, COALESCE(t.end_time, t.start_time))) / 60, 1) as total_hours,
                ROUND(SUM(t.distance_km), 1) as total_km,
                ROUND(SUM(t.estimated_earnings), 2) as total_earnings
            FROM Trips t
            ${whereMonth}
            GROUP BY DATE(t.start_time)
            ORDER BY day ASC
        `, params);

        res.json(days);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo calendario de actividad' });
    }
};

// Detalle de viajes de un día puntual (formato YYYY-MM-DD), para el
// panel que se abre al clickear un día del calendario.
const getDayDetail = async (req, res) => {
    const { day } = req.params;
    try {
        const [rows] = await pool.query(`
            SELECT t.*, v.plate, d.full_name as driver_name
            FROM Trips t
            JOIN Vehicles v ON t.vehicle_id = v.id
            LEFT JOIN Drivers d ON t.driver_id = d.id
            WHERE DATE(t.start_time) = ?
            ORDER BY t.start_time ASC
        `, [day]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo el detalle del día' });
    }
};

module.exports = { getTrips, getCalendar, getDayDetail };
