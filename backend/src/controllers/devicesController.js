const pool = require('../config/database');

// Alta de un equipo GPS+OBD2 por IMEI (antes de parearlo a un auto).
// Esto es lo que hacés vos como admin cuando compras un Teltonika:
// lo das de alta acá con su IMEI, y después desde la tab de Flota
// lo vinculás a un vehículo puntual.
const addDevice = async (req, res) => {
    const { imei, label } = req.body;
    if (!imei) return res.status(400).json({ error: 'Falta el IMEI' });
    try {
        const [result] = await pool.query(
            `INSERT INTO Devices (imei, label, status) VALUES (?, ?, 'unpaired')`,
            [imei, label || null]
        );
        res.json({ id: result.insertId, imei, label, status: 'unpaired' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ese IMEI ya está registrado' });
        }
        res.status(500).json({ error: 'Error dando de alta el equipo' });
    }
};

const getDevices = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT dev.*, v.plate as vehicle_plate
            FROM Devices dev
            LEFT JOIN Vehicles v ON dev.vehicle_id = v.id
            ORDER BY dev.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo equipos' });
    }
};

const pairDevice = async (req, res) => {
    const { imei, vehicle_id } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[device]] = await connection.query('SELECT id, vehicle_id FROM Devices WHERE imei = ?', [imei]);
        if (!device) {
            await connection.rollback();
            return res.status(404).json({ error: 'IMEI no encontrado' });
        }
        if (device.vehicle_id) {
            await connection.rollback();
            return res.status(400).json({ error: 'Ese equipo ya está pareado a otro vehículo' });
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
        const [[device]] = await pool.query('SELECT id, vehicle_id FROM Devices WHERE imei = ?', [imei]);
        if (!device) return res.status(404).json({ error: 'IMEI no encontrado' });
        await pool.query('UPDATE Vehicles SET device_id = NULL WHERE id = ?', [device.vehicle_id]);
        await pool.query('UPDATE Devices SET vehicle_id = NULL, status = "unpaired" WHERE id = ?', [device.id]);
        res.json({ message: 'Equipo despareado' });
    } catch (error) {
        res.status(500).json({ error: 'Error despareando el equipo' });
    }
};

module.exports = { addDevice, getDevices, pairDevice, unpairDevice };
