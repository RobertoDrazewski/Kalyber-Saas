const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

// ============================================================
// Alta de equipo (por IMEI) — SOLO super_admin (ver deviceRoutes.js).
//
// FIX clave: el equipo se crea SIN owner_id (queda "en stock",
// owner_id = NULL). Antes se creaba con owner_id = super_admin.id,
// lo que hacía que NINGÚN admin pudiera parearlo después (ver
// pairDevice más abajo) — el bug que iba a bloquear la activación
// de los equipos que llegan mañana.
// ============================================================
const addDevice = async (req, res) => {
    const { imei, label, model, phone_number } = req.body;
    if (!imei) return res.status(400).json({ error: 'Falta el IMEI' });
    if (model && !['VL04', 'VL502'].includes(model)) {
        return res.status(400).json({ error: 'Modelo inválido (tiene que ser VL04 o VL502)' });
    }
    try {
        const [result] = await pool.query(
            `INSERT INTO Devices (imei, label, model, phone_number, status, owner_id) VALUES (?, ?, ?, ?, 'unpaired', NULL)`,
            [imei, label || null, model || 'VL502', phone_number || null]
        );
        res.json({ id: result.insertId, imei, label, model: model || 'VL502', phone_number, status: 'unpaired' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ese IMEI ya está registrado' });
        }
        res.status(500).json({ error: 'Error dando de alta el equipo' });
    }
};

// Para un admin, solo le mostramos SU equipo ya reclamado — no la
// bolsa de stock sin asignar (para eso está el flujo de "vincular
// por IMEI" en pairDevice, que no necesita listar nada). super_admin
// sí ve todo, incluido el stock sin reclamar (owner_id IS NULL), para
// llevar el inventario.
const getDevices = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        let query = `
            SELECT dev.*, v.plate as vehicle_plate,
                   u.name as owner_name, u.company_name as owner_company
            FROM Devices dev
            LEFT JOIN Vehicles v ON dev.vehicle_id = v.id
            LEFT JOIN Users u ON dev.owner_id = u.id
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

// ============================================================
// Diagnóstico: "todo lo que la base de datos guarda" de un equipo
// puntual — pensado para debug real, no para el uso diario. Devuelve
// el equipo, a qué cliente/vehículo está pareado, y las últimas
// lecturas crudas de Telemetry_Raw tal cual quedaron guardadas, sin
// procesar ni maquillar nada.
// ============================================================
const getDeviceRawData = async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    try {
        const ownerId = effectiveOwnerId(req);
        const [[device]] = await pool.query(`
            SELECT dev.*, v.plate as vehicle_plate, v.brand, v.model as vehicle_model,
                   v.odometer_km, u.name as owner_name, u.company_name as owner_company
            FROM Devices dev
            LEFT JOIN Vehicles v ON dev.vehicle_id = v.id
            LEFT JOIN Users u ON dev.owner_id = u.id
            WHERE dev.id = ?
        `, [id]);

        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (ownerId && device.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese equipo no pertenece a tu flota' });
        }

        let readings = [];
        if (device.vehicle_id) {
            const [rows] = await pool.query(
                `SELECT * FROM Telemetry_Raw WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT ?`,
                [device.vehicle_id, limit]
            );
            readings = rows;
        }

        res.json({ device, readings });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo los datos crudos del equipo' });
    }
};

// ============================================================
// Pareo de equipo a vehículo — ACÁ estaba el bug crítico.
//
// Ahora, si el equipo todavía no tiene dueño (owner_id IS NULL,
// o sea vino de stock dado de alta por super_admin), este pareo
// además "reclama" el equipo: le asigna owner_id = la flota de
// quien está pareando. A partir de ahí ese equipo ya es de esa
// flota y nadie más lo puede tomar.
// ============================================================
const pairDevice = async (req, res) => {
    const { imei, vehicle_id } = req.body;
    const ownerId = effectiveOwnerId(req);

    // Un admin necesita saber a qué flota está pareando; super_admin
    // puede pasar ?owner_id=X en la query para hacerlo en nombre de
    // un cliente puntual. Si es super_admin y no pasa owner_id, no
    // sabemos de quién es la flota — se lo pedimos explícito.
    if (!ownerId && req.user.role === 'super_admin') {
        return res.status(400).json({ error: 'Como super_admin, indicá ?owner_id=<id del admin> para saber a qué flota asignar el equipo' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[device]] = await connection.query('SELECT id, vehicle_id, owner_id FROM Devices WHERE imei = ?', [imei]);
        if (!device) {
            await connection.rollback();
            return res.status(404).json({ error: 'IMEI no encontrado' });
        }

        if (device.owner_id === null) {
            // Equipo sin reclamar: se lo asignamos a esta flota ahora mismo.
            await connection.query('UPDATE Devices SET owner_id = ? WHERE id = ?', [ownerId, device.id]);
        } else if (device.owner_id !== ownerId) {
            await connection.rollback();
            return res.status(403).json({ error: 'Ese equipo ya pertenece a otra flota' });
        }

        if (device.vehicle_id) {
            await connection.rollback();
            return res.status(400).json({ error: 'Ese equipo ya está pareado a otro vehículo' });
        }
        const [[vehicle]] = await connection.query('SELECT owner_id FROM Vehicles WHERE id = ?', [vehicle_id]);
        if (!vehicle) {
            await connection.rollback();
            return res.status(404).json({ error: 'Vehículo no encontrado' });
        }
        if (vehicle.owner_id !== ownerId) {
            await connection.rollback();
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }
        await connection.query('UPDATE Devices SET vehicle_id = ?, status = "paired" WHERE id = ?', [vehicle_id, device.id]);
        await connection.query('UPDATE Vehicles SET device_id = ? WHERE id = ?', [device.id, vehicle_id]);
        await connection.commit();
        res.json({ message: 'Equipo pareado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error pareando el equipo:', error);
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

// Editar un equipo (etiqueta o modelo) — no toca el pareo, para eso
// están pairDevice/unpairDevice.
const updateDevice = async (req, res) => {
    const { id } = req.params;
    const { label, model, phone_number } = req.body;
    if (model && !['VL04', 'VL502'].includes(model)) {
        return res.status(400).json({ error: 'Modelo inválido (tiene que ser VL04 o VL502)' });
    }
    try {
        const ownerId = effectiveOwnerId(req);
        const [[device]] = await pool.query('SELECT owner_id FROM Devices WHERE id = ?', [id]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (ownerId && device.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese equipo no pertenece a tu flota' });
        }
        await pool.query(
            `UPDATE Devices SET label = COALESCE(?, label), model = COALESCE(?, model), phone_number = COALESCE(?, phone_number) WHERE id = ?`,
            [label, model, phone_number, id]
        );
        res.json({ message: 'Equipo actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando el equipo' });
    }
};

// Eliminar un equipo por completo (no solo desparear) — SOLO
// super_admin, ya que es Puma Code quien programa/gestiona el
// inventario físico. Si estaba pareado, primero lo desconecta del
// vehículo para no dejar una referencia rota.
const deleteDevice = async (req, res) => {
    const { id } = req.params;
    try {
        const [[device]] = await pool.query('SELECT vehicle_id FROM Devices WHERE id = ?', [id]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (device.vehicle_id) {
            await pool.query('UPDATE Vehicles SET device_id = NULL WHERE id = ?', [device.vehicle_id]);
        }
        await pool.query('DELETE FROM Devices WHERE id = ?', [id]);
        res.json({ message: 'Equipo eliminado — el IMEI queda libre para volver a darlo de alta si hace falta' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando el equipo' });
    }
};

module.exports = { addDevice, getDevices, pairDevice, unpairDevice, getDeviceRawData, updateDevice, deleteDevice };
