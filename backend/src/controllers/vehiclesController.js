const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

const getVehicles = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        let query = `
            SELECT v.*, d.full_name as current_driver_name, dev.imei as device_imei
            FROM Vehicles v
            LEFT JOIN Drivers d ON v.current_driver_id = d.id
            LEFT JOIN Devices dev ON v.device_id = dev.id
        `;
        const params = [];
        // El simulador (source='simulated') siempre se ve, es la demo
        // compartida — el resto se filtra por dueño de flota.
        if (ownerId) {
            query += ` WHERE (v.owner_id = ? OR v.source = 'simulated')`;
            params.push(ownerId);
        }
        query += ` ORDER BY v.source ASC, v.plate ASC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo flota' });
    }
};

const addVehicle = async (req, res) => {
    const { plate, brand, model, year, photo_url, device_imei } = req.body;
    const ownerId = req.user.role === 'super_admin' ? (req.body.owner_id || req.user.id) : req.user.id;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let deviceId = null;
        if (device_imei) {
            const [[device]] = await connection.query('SELECT id, vehicle_id, owner_id FROM Devices WHERE imei = ?', [device_imei]);
            if (!device) {
                await connection.rollback();
                return res.status(400).json({ error: 'Ese ID de equipo no existe. Dalo de alta primero en Equipos.' });
            }
            if (device.vehicle_id) {
                await connection.rollback();
                return res.status(400).json({ error: 'Ese equipo ya está pareado a otro vehículo.' });
            }
            deviceId = device.id;
        }

        const [result] = await connection.query(
            `INSERT INTO Vehicles (plate, brand, model, year, photo_url, device_id, status, source, owner_id)
             VALUES (?, ?, ?, ?, ?, ?, 'active', 'real', ?)`,
            [plate, brand, model, year || null, photo_url || null, deviceId, ownerId]
        );

        if (deviceId) {
            await connection.query(`UPDATE Devices SET vehicle_id = ?, status = 'paired' WHERE id = ?`, [result.insertId, deviceId]);
        }

        await connection.commit();
        res.json({ id: result.insertId, plate, brand, model, status: 'active' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'La patente ya está registrada' });
        }
        res.status(500).json({ error: 'Error agregando vehículo' });
    } finally {
        connection.release();
    }
};

const updateVehicle = async (req, res) => {
    const { id } = req.params;
    const { brand, model, year, photo_url, status } = req.body;
    try {
        const ownerId = effectiveOwnerId(req);
        if (ownerId) {
            const [[vehicle]] = await pool.query('SELECT owner_id FROM Vehicles WHERE id = ?', [id]);
            if (!vehicle || (vehicle.owner_id !== ownerId && vehicle.owner_id !== null)) {
                return res.status(403).json({ error: 'No tenés permiso sobre este vehículo' });
            }
        }
        await pool.query(
            `UPDATE Vehicles SET brand = COALESCE(?, brand), model = COALESCE(?, model),
             year = COALESCE(?, year), photo_url = COALESCE(?, photo_url), status = COALESCE(?, status)
             WHERE id = ?`,
            [brand, model, year, photo_url, status, id]
        );
        res.json({ message: 'Vehículo actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando vehículo' });
    }
};

const deleteVehicle = async (req, res) => {
    const { id } = req.params;
    try {
        const ownerId = effectiveOwnerId(req);
        if (ownerId) {
            const [[vehicle]] = await pool.query('SELECT owner_id FROM Vehicles WHERE id = ?', [id]);
            if (!vehicle || vehicle.owner_id !== ownerId) {
                return res.status(403).json({ error: 'No tenés permiso sobre este vehículo' });
            }
        }
        await pool.query('UPDATE Devices SET vehicle_id = NULL, status = "unpaired" WHERE vehicle_id = ?', [id]);
        await pool.query('DELETE FROM Vehicles WHERE id = ?', [id]);
        res.json({ message: 'Vehículo eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando vehículo' });
    }
};

// Endpoint para el chofer: elegir qué auto va a manejar ahora. Como
// "cualquier chofer puede manejar cualquier auto", esto solo mueve
// el puntero current_driver_id — no hay una asignación fija.
const selectVehicleAsDriver = async (req, res) => {
    const { vehicle_id } = req.body;
    if (req.user.role !== 'driver') {
        return res.status(403).json({ error: 'Solo los choferes usan este endpoint' });
    }
    try {
        const [[driver]] = await pool.query('SELECT id FROM Drivers WHERE user_id = ?', [req.user.id]);
        if (!driver) return res.status(404).json({ error: 'No se encontró tu perfil de conductor' });

        const [[vehicle]] = await pool.query('SELECT id, owner_id, source FROM Vehicles WHERE id = ?', [vehicle_id]);
        if (!vehicle || (vehicle.owner_id !== req.user.owner_id && vehicle.source !== 'simulated')) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        // Libera al chofer de cualquier auto anterior (un chofer maneja un auto a la vez)
        await pool.query('UPDATE Vehicles SET current_driver_id = NULL WHERE current_driver_id = ?', [driver.id]);
        await pool.query('UPDATE Vehicles SET current_driver_id = ? WHERE id = ?', [driver.id, vehicle_id]);

        res.json({ message: 'Vehículo seleccionado', vehicle_id });
    } catch (error) {
        res.status(500).json({ error: 'Error seleccionando el vehículo' });
    }
};

module.exports = { getVehicles, addVehicle, updateVehicle, deleteVehicle, selectVehicleAsDriver };
