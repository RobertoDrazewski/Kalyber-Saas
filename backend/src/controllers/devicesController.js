const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

// Alta de un equipo GPS/OBD2 por IMEI. Todos los equipos pueden
// pairearse a cualquier auto DE LA MISMA FLOTA — no hay restricción
// modelo-a-modelo, solo que pertenezcan al mismo owner_id.
const addDevice = async (req, res) => {
    const { imei, label, model } = req.body;
    if (!imei) return res.status(400).json({ error: 'Falta el IMEI' });
    if (model && !['VL04', 'VL502'].includes(model)) {
        return res.status(400).json({ error: 'Modelo inválido (tiene que ser VL04 o VL502)' });
    }
    try {
        const [result] = await pool.query(
            `INSERT INTO Devices (imei, label, model, status, owner_id) VALUES (?, ?, ?, 'unpaired', ?)`,
            [imei, label || null, model || 'VL502', req.user.id]
        );
        res.json({ id: result.insertId, imei, label, model: model || 'VL502', status: 'unpaired' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ese IMEI ya está registrado' });
        }
        res.status(500).json({ error: 'Error dando de alta el equipo' });
    }
};

const getDevices = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        let query = `
            SELECT dev.*, v.plate as vehicle_plate
            FROM Devices dev
            LEFT JOIN Vehicles v ON dev.vehicle_id = v.id
        `;
        const params = [];
        if (ownerId) {
            query += ' WHERE dev.owner_id = ?';
            params.push(ownerId);
        }
        query += ' ORDER BY dev.created_at DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo equipos' });
    }
};

const pairDevice = async (req, res) => {
    const { imei, vehicle_id } = req.body;
    const ownerId = effectiveOwnerId(req);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[device]] = await connection.query('SELECT id, vehicle_id, owner_id FROM Devices WHERE imei = ?', [imei]);
        if (!device) {
            await connection.rollback();
            return res.status(404).json({ error: 'IMEI no encontrado' });
        }
        if (ownerId && device.owner_id !== ownerId) {
            await connection.rollback();
            return res.status(403).json({ error: 'Ese equipo no pertenece a tu flota' });
        }
        if (device.vehicle_id) {
            await connection.rollback();
            return res.status(400).json({ error: 'Ese equipo ya está pareado a otro vehículo' });
        }
        const [[vehicle]] = await connection.query('SELECT owner_id FROM Vehicles WHERE id = ?', [vehicle_id]);
        if (ownerId && vehicle && vehicle.owner_id !== ownerId) {
            await connection.rollback();
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }
        await connection.query('UPDATE Devices SET vehicle_id = ?, status = "paired" WHERE id = ?', [vehicle_id, device.id]);
        await connection.query('UPDATE Vehicles SET device_id = ? WHERE id = ?', [device.id, vehicle_id]);
        await connection.commit();
        res.json({ message: 'Equipo pareado correctamente' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: 'Error pareando el equipo' });
    } finally {
        connection.release();
    }
};

const unpairDevice = async (req, res) => {
    const { imei } = req.params;
    try {
        const ownerId = effectiveOwnerId(req);
        const [[device]] = await pool.query('SELECT id, vehicle_id, owner_id FROM Devices WHERE imei = ?', [imei]);
        if (!device) return res.status(404).json({ error: 'IMEI no encontrado' });
        if (ownerId && device.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese equipo no pertenece a tu flota' });
        }
        await pool.query('UPDATE Vehicles SET device_id = NULL WHERE id = ?', [device.vehicle_id]);
        await pool.query('UPDATE Devices SET vehicle_id = NULL, status = "unpaired" WHERE id = ?', [device.id]);
        res.json({ message: 'Equipo despareado' });
    } catch (error) {
        res.status(500).json({ error: 'Error despareando el equipo' });
    }
};

module.exports = { addDevice, getDevices, pairDevice, unpairDevice };
