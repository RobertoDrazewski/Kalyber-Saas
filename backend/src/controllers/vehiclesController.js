const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

const getVehicles = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        let query = `
            SELECT v.*, d.full_name as current_driver_name, dev.imei as device_imei, dev.model as device_model,
                (SELECT engine_rpm FROM Telemetry_Raw tr WHERE tr.vehicle_id = v.id AND tr.engine_rpm IS NOT NULL ORDER BY tr.recorded_at DESC LIMIT 1) as last_rpm,
                (SELECT recorded_at FROM Telemetry_Raw tr WHERE tr.vehicle_id = v.id ORDER BY tr.recorded_at DESC LIMIT 1) as last_reading_at
            FROM Vehicles v
            LEFT JOIN Drivers d ON v.current_driver_id = d.id
            LEFT JOIN Devices dev ON dev.vehicle_id = v.id AND dev.status = 'paired'
        `;
        const params = [];
        if (ownerId) {
            query += ` WHERE v.owner_id = ?`;
            params.push(ownerId);
        }
        query += ` ORDER BY v.plate ASC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo flota' });
    }
};

const addVehicle = async (req, res) => {
    const { plate, brand, model, year, photo_url, device_imei, odometer_km } = req.body;
    const ownerId = req.user.role === 'super_admin' ? (req.body.owner_id || req.user.id) : req.user.id;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let deviceId = null;
        if (device_imei) {
            const [[device]] = await connection.query('SELECT id, vehicle_id, owner_id FROM Devices WHERE imei = ?', [device_imei]);
            if (!device) {
                await connection.rollback();
                return res.status(400).json({ error: 'Ese ID de equipo no existe. Revisá que esté bien escrito, o consultá a Kalyber.' });
            }
            if (device.owner_id && device.owner_id !== ownerId) {
                await connection.rollback();
                return res.status(400).json({ error: 'Ese equipo ya pertenece a otra flota.' });
            }
            if (device.vehicle_id) {
                await connection.rollback();
                return res.status(400).json({ error: 'Ese equipo ya está pareado a otro vehículo.' });
            }
            deviceId = device.id;
        }

        const [result] = await connection.query(
            `INSERT INTO Vehicles (plate, brand, model, year, photo_url, device_id, status, source, owner_id, odometer_km)
             VALUES (?, ?, ?, ?, ?, ?, 'active', 'real', ?, ?)`,
            [plate, brand, model, year || null, photo_url || null, deviceId, ownerId, odometer_km || 0]
        );

        if (deviceId) {
            await connection.query(`UPDATE Devices SET vehicle_id = ?, status = 'paired', owner_id = ? WHERE id = ?`, [result.insertId, ownerId, deviceId]);
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
    const { brand, model, year, photo_url, status, odometer_km } = req.body;
    try {
        const ownerId = effectiveOwnerId(req);
        if (ownerId) {
            const [[vehicle]] = await pool.query('SELECT owner_id FROM Vehicles WHERE id = ?', [id]);
            if (!vehicle || vehicle.owner_id !== ownerId) {
                return res.status(403).json({ error: 'No tenés permiso sobre este vehículo' });
            }
        }
        await pool.query(
            `UPDATE Vehicles SET brand = COALESCE(?, brand), model = COALESCE(?, model),
             year = COALESCE(?, year), photo_url = COALESCE(?, photo_url), status = COALESCE(?, status),
             odometer_km = COALESCE(?, odometer_km)
             WHERE id = ?`,
            [brand, model, year, photo_url, status, odometer_km, id]
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

// El chofer elige su propio auto (autoservicio) — ya existía.
const selectVehicleAsDriver = async (req, res) => {
    const { vehicle_id } = req.body;
    if (req.user.role !== 'driver') {
        return res.status(403).json({ error: 'Solo los choferes usan este endpoint' });
    }
    try {
        const [[driver]] = await pool.query('SELECT id FROM Drivers WHERE user_id = ?', [req.user.id]);
        if (!driver) return res.status(404).json({ error: 'No se encontró tu perfil de conductor' });

        const [[vehicle]] = await pool.query('SELECT id, owner_id FROM Vehicles WHERE id = ?', [vehicle_id]);
        if (!vehicle || vehicle.owner_id !== req.user.owner_id) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        await pool.query('UPDATE Vehicles SET current_driver_id = NULL WHERE current_driver_id = ?', [driver.id]);
        await pool.query('UPDATE Vehicles SET current_driver_id = ? WHERE id = ?', [driver.id, vehicle_id]);

        res.json({ message: 'Vehículo seleccionado', vehicle_id });
    } catch (error) {
        res.status(500).json({ error: 'Error seleccionando el vehículo' });
    }
};

// NUEVO: el admin/super_admin vincula (o desvincula) un chofer a un
// vehículo directamente, sin depender de que el chofer lo elija él
// mismo. Igual que con el autoservicio, un chofer maneja un auto a
// la vez — si ya estaba en otro, se lo saca de ahí antes.
const assignDriverAsAdmin = async (req, res) => {
    const { id } = req.params; // id del vehículo
    const { driver_id } = req.body; // null o ausente para desasignar

    try {
        const [[vehicle]] = await pool.query('SELECT id, owner_id FROM Vehicles WHERE id = ?', [id]);
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });

        const ownerId = effectiveOwnerId(req);
        if (ownerId && vehicle.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        if (!driver_id) {
            await pool.query('UPDATE Vehicles SET current_driver_id = NULL WHERE id = ?', [id]);
            return res.json({ message: 'Conductor desasignado del vehículo' });
        }

        const [[driver]] = await pool.query('SELECT id, owner_id, user_id FROM Drivers WHERE id = ?', [driver_id]);
        if (!driver) return res.status(404).json({ error: 'Conductor no encontrado' });

        // La restricción de "misma flota" solo aplica a admins de flota
        // regulares — un super_admin ve y gestiona todo. Si un
        // super_admin asigna un chofer de OTRA flota, lo "mudamos" a
        // la flota del vehículo (en Drivers y en Users, que es lo que
        // define qué ve ese chofer al loguearse) — si no, queda un
        // estado inconsistente donde el auto tiene chofer asignado
        // pero el chofer no lo ve en su propia vista.
        if (req.user.role !== 'super_admin' && driver.owner_id !== vehicle.owner_id) {
            return res.status(400).json({ error: 'Ese conductor no pertenece a la misma flota que el vehículo' });
        }
        if (driver.owner_id !== vehicle.owner_id) {
            await pool.query('UPDATE Drivers SET owner_id = ? WHERE id = ?', [vehicle.owner_id, driver.id]);
            if (driver.user_id) {
                await pool.query('UPDATE Users SET owner_id = ? WHERE id = ?', [vehicle.owner_id, driver.user_id]);
            }
        }

        await pool.query('UPDATE Vehicles SET current_driver_id = NULL WHERE current_driver_id = ?', [driver_id]);
        await pool.query('UPDATE Vehicles SET current_driver_id = ? WHERE id = ?', [driver_id, id]);

        res.json({ message: 'Conductor asignado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error asignando el conductor' });
    }
};

module.exports = { getVehicles, addVehicle, updateVehicle, deleteVehicle, selectVehicleAsDriver, assignDriverAsAdmin };