const pool = require('../config/database');

const getVehicles = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT v.*, d.full_name as current_driver_name, dev.imei as device_imei
            FROM Vehicles v
            LEFT JOIN Drivers d ON v.current_driver_id = d.id
            LEFT JOIN Devices dev ON v.device_id = dev.id
            ORDER BY v.source ASC, v.plate ASC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo flota' });
    }
};

const addVehicle = async (req, res) => {
    const { plate, brand, model, year, photo_url, device_imei } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let deviceId = null;
        if (device_imei) {
            const [[device]] = await connection.query('SELECT id, vehicle_id FROM Devices WHERE imei = ?', [device_imei]);
            if (!device) {
                await connection.rollback();
                return res.status(400).json({ error: 'Ese ID de equipo no existe. Dalo de alta primero en Devices.' });
            }
            if (device.vehicle_id) {
                await connection.rollback();
                return res.status(400).json({ error: 'Ese equipo ya está pareado a otro vehículo.' });
            }
            deviceId = device.id;
        }

        const [result] = await connection.query(
            `INSERT INTO Vehicles (plate, brand, model, year, photo_url, device_id, status, source)
             VALUES (?, ?, ?, ?, ?, ?, 'active', 'real')`,
            [plate, brand, model, year || null, photo_url || null, deviceId]
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
        await pool.query('UPDATE Devices SET vehicle_id = NULL, status = "unpaired" WHERE vehicle_id = ?', [id]);
        await pool.query('DELETE FROM Vehicles WHERE id = ?', [id]);
        res.json({ message: 'Vehículo eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando vehículo' });
    }
};

module.exports = { getVehicles, addVehicle, updateVehicle, deleteVehicle };
