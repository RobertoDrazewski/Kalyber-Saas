const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

const TYPE_LABEL = {
    neumaticos: 'Neumáticos',
    frenos: 'Frenos',
    fluidos: 'Fluidos',
    bateria: 'Batería',
    motor: 'Motor',
    otro: 'Otros',
};

// Historial completo de mantenimiento de un vehículo puntual — lo
// que se ve al hacer click en un auto desde la tab nueva.
const getEventsForVehicle = async (req, res) => {
    const { vehicleId } = req.params;
    try {
        const ownerId = effectiveOwnerId(req);
        const [[vehicle]] = await pool.query('SELECT owner_id, odometer_km FROM Vehicles WHERE id = ?', [vehicleId]);
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
        if (ownerId && vehicle.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        const [events] = await pool.query(
            `SELECT me.*, u.name as created_by_name
             FROM MaintenanceEvents me
             LEFT JOIN Users u ON me.created_by = u.id
             WHERE me.vehicle_id = ? ORDER BY me.event_date DESC, me.id DESC`,
            [vehicleId]
        );
        res.json({ current_odometer_km: vehicle.odometer_km, events });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo el historial de mantenimiento' });
    }
};

const addEvent = async (req, res) => {
    const { vehicle_id, type, description, event_date, km_at_event, cost, provider, photo_url } = req.body;
    if (!vehicle_id || !type || !event_date) {
        return res.status(400).json({ error: 'Faltan datos: vehículo, tipo y fecha son obligatorios' });
    }
    if (!Object.keys(TYPE_LABEL).includes(type)) {
        return res.status(400).json({ error: 'Tipo de mantenimiento inválido' });
    }
    try {
        const ownerId = effectiveOwnerId(req);
        const [[vehicle]] = await pool.query('SELECT owner_id, odometer_km FROM Vehicles WHERE id = ?', [vehicle_id]);
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
        if (ownerId && vehicle.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        await pool.query(
            `INSERT INTO MaintenanceEvents (vehicle_id, type, description, event_date, km_at_event, cost, provider, photo_url, origin, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)`,
            [vehicle_id, type, description || null, event_date, km_at_event ?? vehicle.odometer_km, cost || null, provider || null, photo_url || null, req.user.id]
        );
        res.json({ message: 'Mantenimiento registrado' });
    } catch (error) {
        res.status(500).json({ error: 'Error registrando el mantenimiento' });
    }
};

const updateEvent = async (req, res) => {
    const { id } = req.params;
    const { type, description, event_date, km_at_event, cost, provider, photo_url } = req.body;
    try {
        const ownerId = effectiveOwnerId(req);
        const [[event]] = await pool.query(
            `SELECT me.id, v.owner_id FROM MaintenanceEvents me JOIN Vehicles v ON me.vehicle_id = v.id WHERE me.id = ?`,
            [id]
        );
        if (!event) return res.status(404).json({ error: 'Registro no encontrado' });
        if (ownerId && event.owner_id !== ownerId) {
            return res.status(403).json({ error: 'No tenés permiso sobre este registro' });
        }

        await pool.query(
            `UPDATE MaintenanceEvents SET
                type = COALESCE(?, type), description = COALESCE(?, description),
                event_date = COALESCE(?, event_date), km_at_event = COALESCE(?, km_at_event),
                cost = COALESCE(?, cost), provider = COALESCE(?, provider), photo_url = COALESCE(?, photo_url)
             WHERE id = ?`,
            [type, description, event_date, km_at_event, cost, provider, photo_url, id]
        );
        res.json({ message: 'Registro actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando el registro' });
    }
};

const deleteEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const ownerId = effectiveOwnerId(req);
        const [[event]] = await pool.query(
            `SELECT me.id, v.owner_id FROM MaintenanceEvents me JOIN Vehicles v ON me.vehicle_id = v.id WHERE me.id = ?`,
            [id]
        );
        if (!event) return res.status(404).json({ error: 'Registro no encontrado' });
        if (ownerId && event.owner_id !== ownerId) {
            return res.status(403).json({ error: 'No tenés permiso sobre este registro' });
        }
        await pool.query('DELETE FROM MaintenanceEvents WHERE id = ?', [id]);
        res.json({ message: 'Registro eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando el registro' });
    }
};

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

module.exports = { getMaintenanceAlerts, getFleetHealth, getEventsForVehicle, addEvent, updateEvent, deleteEvent };
