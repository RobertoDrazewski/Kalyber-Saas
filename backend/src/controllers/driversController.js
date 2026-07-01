const pool = require('../config/database');

const getDrivers = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.*, 
            (SELECT AVG(driver_score) FROM Telemetry_Heuristics th JOIN Vehicles v ON th.vehicle_id = v.id WHERE v.current_driver_id = d.id) as avg_score
            FROM Drivers d
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo conductores' });
    }
};

module.exports = { getDrivers };