const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

// Alta de una carga de combustible. El consumo real se calcula
// DESPUÉS, comparando esta carga contra la anterior — no hace falta
// ningún dato del equipo GPS para esto.
const addFuelLog = async (req, res) => {
    const { vehicle_id, liters, cost, odometer_km, filled_at, notes } = req.body;
    if (!vehicle_id || !liters || odometer_km === undefined || odometer_km === null) {
        return res.status(400).json({ error: 'Faltan datos: vehículo, litros y odómetro son obligatorios' });
    }
    try {
        const ownerId = effectiveOwnerId(req);
        const [[vehicle]] = await pool.query('SELECT owner_id FROM Vehicles WHERE id = ?', [vehicle_id]);
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
        if (ownerId && vehicle.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        await pool.query(
            `INSERT INTO FuelLogs (vehicle_id, owner_id, liters, cost, odometer_km, filled_at, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [vehicle_id, vehicle.owner_id, liters, cost || null, odometer_km, filled_at || new Date(), notes || null]
        );

        // Al cargar combustible es un buen momento para corregir el
        // odómetro del auto contra el valor real del tablero (el
        // automático por GPS puede ir acumulando un pequeño margen de
        // error con el tiempo).
        await pool.query('UPDATE Vehicles SET odometer_km = ? WHERE id = ?', [odometer_km, vehicle_id]);

        res.json({ message: 'Carga registrada' });
    } catch (error) {
        res.status(500).json({ error: 'Error registrando la carga de combustible' });
    }
};

// Historial de cargas de un vehículo + consumo calculado entre cada
// carga y la anterior: litros cargados / (km recorridos / 100).
const getFuelLogs = async (req, res) => {
    const { vehicleId } = req.params;
    try {
        const ownerId = effectiveOwnerId(req);
        const [[vehicle]] = await pool.query('SELECT owner_id FROM Vehicles WHERE id = ?', [vehicleId]);
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
        if (ownerId && vehicle.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        const [logs] = await pool.query(
            `SELECT * FROM FuelLogs WHERE vehicle_id = ? ORDER BY odometer_km ASC`,
            [vehicleId]
        );

        const withConsumption = logs.map((log, i) => {
            if (i === 0) return { ...log, km_since_last: null, consumption_l_100km: null };
            const prev = logs[i - 1];
            const kmSinceLast = Number(log.odometer_km) - Number(prev.odometer_km);
            const consumption = kmSinceLast > 0
                ? Math.round((Number(log.liters) / kmSinceLast) * 100 * 10) / 10
                : null;
            return { ...log, km_since_last: kmSinceLast, consumption_l_100km: consumption };
        });

        res.json(withConsumption.reverse());
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo el historial de combustible' });
    }
};

module.exports = { addFuelLog, getFuelLogs };