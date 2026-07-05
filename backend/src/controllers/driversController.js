const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

// Nota: los conductores NO están atados a un auto fijo — cualquiera
// puede manejar cualquier vehículo DE SU MISMA FLOTA. El avg_score se
// calcula sobre todos los autos que manejó, no sobre uno solo.
const getDrivers = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        let query = `
            SELECT d.*,
            (SELECT AVG(th.driver_score) FROM Telemetry_Heuristics th
             JOIN Vehicles v ON th.vehicle_id = v.id
             WHERE v.current_driver_id = d.id) as avg_score
            FROM Drivers d
        `;
        const params = [];
        if (ownerId) {
            query += ' WHERE d.owner_id = ?';
            params.push(ownerId);
        }
        query += ' ORDER BY d.status ASC, d.full_name ASC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo conductores' });
    }
};

// Alta de conductor SIN login (solo perfil, para llevar sus stats).
// Si el admin además quiere darle acceso a la app, eso se hace desde
// Usuarios (crear un usuario con rol "driver"), que ya crea el
// perfil en Drivers automáticamente vinculado.
const addDriver = async (req, res) => {
    const { full_name, phone_number, license_number } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Falta el nombre del conductor' });
    try {
        const [result] = await pool.query(
            `INSERT INTO Drivers (full_name, phone_number, license_number, status, owner_id) VALUES (?, ?, ?, 'active', ?)`,
            [full_name, phone_number || null, license_number || null, req.user.id]
        );
        res.json({ id: result.insertId, full_name, phone_number, license_number, status: 'active' });
    } catch (error) {
        res.status(500).json({ error: 'Error agregando conductor' });
    }
};

const updateDriver = async (req, res) => {
    const { id } = req.params;
    const { full_name, phone_number, license_number, status } = req.body;
    try {
        const ownerId = effectiveOwnerId(req);
        if (ownerId) {
            const [[driver]] = await pool.query('SELECT owner_id FROM Drivers WHERE id = ?', [id]);
            if (!driver || driver.owner_id !== ownerId) {
                return res.status(403).json({ error: 'No tenés permiso sobre este conductor' });
            }
        }
        await pool.query(
            `UPDATE Drivers SET full_name = COALESCE(?, full_name), phone_number = COALESCE(?, phone_number),
             license_number = COALESCE(?, license_number), status = COALESCE(?, status) WHERE id = ?`,
            [full_name, phone_number, license_number, status, id]
        );
        res.json({ message: 'Conductor actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando conductor' });
    }
};

const deleteDriver = async (req, res) => {
    const { id } = req.params;
    try {
        const ownerId = effectiveOwnerId(req);
        if (ownerId) {
            const [[driver]] = await pool.query('SELECT owner_id FROM Drivers WHERE id = ?', [id]);
            if (!driver || driver.owner_id !== ownerId) {
                return res.status(403).json({ error: 'No tenés permiso sobre este conductor' });
            }
        }
        await pool.query('UPDATE Vehicles SET current_driver_id = NULL WHERE current_driver_id = ?', [id]);
        await pool.query('UPDATE Trips SET driver_id = NULL WHERE driver_id = ?', [id]);
        // Si el conductor tenía login (Users), lo borramos también para no dejar cuentas huérfanas.
        await pool.query('DELETE FROM Users WHERE id = (SELECT user_id FROM Drivers WHERE id = ?)', [id]);
        await pool.query('DELETE FROM Drivers WHERE id = ?', [id]);
        res.json({ message: 'Conductor eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando conductor' });
    }
};

module.exports = { getDrivers, addDriver, updateDriver, deleteDriver };
