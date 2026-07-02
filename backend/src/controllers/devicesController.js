const pool = require('../config/database');

// Alta de un equipo GPS/OBD2 por IMEI (antes de parearlo a un auto).
// Esto es lo que hacés vos como admin cuando llega un JM-VL04 o
// JM-VL502 de Jimi IoT: lo das de alta acá con su IMEI y modelo, y
// después desde la tab de Flota lo vinculás a un vehículo puntual.
// El modelo importa: VL502 lee ECU/CAN real (RPM, temp, combustible,
// DTC), VL04 es inercial puro (GPS + acelerómetro, sin OBD) — eso
// determina qué tabs de IA tienen sentido mostrar para ese auto.
const addDevice = async (req, res) => {
    const { imei, label, model } = req.body;
    if (!imei) return res.status(400).json({ error: 'Falta el IMEI' });
    if (model && !['VL04', 'VL502'].includes(model)) {
        return res.status(400).json({ error: 'Modelo inválido (tiene que ser VL04 o VL502)' });
    }
    try {
        const [result] = await pool.query(
            `INSERT INTO Devices (imei, label, model, status) VALUES (?, ?, ?, 'unpaired')`,
            [imei, label || null, model || 'VL502']
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
