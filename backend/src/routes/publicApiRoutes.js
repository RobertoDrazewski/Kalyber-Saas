const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireApiKey } = require('../middlewares/apiKeyAuth');

router.use(requireApiKey);

// Campos curados — no exponemos la tabla interna completa (ni
// owner_id, ni current_driver_id crudo, etc.), solo lo que un
// sistema externo razonablemente necesita.
router.get('/vehicles', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT v.id, v.plate, v.brand, v.model, v.year, v.status,
                    v.lat, v.lng, v.heading, v.speed_kmh, v.odometer_km, v.vin,
                    v.last_ping_at, d.full_name as current_driver
             FROM Vehicles v
             LEFT JOIN Drivers d ON v.current_driver_id = d.id
             WHERE v.owner_id = ?
             ORDER BY v.plate ASC`,
            [req.apiOwnerId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo vehículos' });
    }
});

router.get('/vehicles/:id/telemetry', async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    try {
        const [[vehicle]] = await pool.query('SELECT owner_id FROM Vehicles WHERE id = ?', [id]);
        if (!vehicle || vehicle.owner_id !== req.apiOwnerId) {
            return res.status(404).json({ error: 'Vehículo no encontrado' });
        }
        const [rows] = await pool.query(
            `SELECT recorded_at, lat, lng, speed_kmh, heading, engine_rpm
             FROM Telemetry_Raw WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT ?`,
            [id, limit]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo telemetría' });
    }
});

router.get('/trips', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    try {
        const [rows] = await pool.query(
            `SELECT t.id, t.vehicle_id, v.plate, t.start_time, t.end_time, t.distance_km, t.max_speed_kmh, t.duration_minutes
             FROM Trips t
             JOIN Vehicles v ON t.vehicle_id = v.id
             WHERE v.owner_id = ?
             ORDER BY t.start_time DESC LIMIT ?`,
            [req.apiOwnerId, limit]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo viajes' });
    }
});

router.get('/drivers', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, full_name, phone_number, license_expiry, status FROM Drivers WHERE owner_id = ?`,
            [req.apiOwnerId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo conductores' });
    }
});

module.exports = router;
