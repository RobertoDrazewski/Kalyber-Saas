const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

// Nota: los conductores NO están atados a un auto fijo — cualquiera
// puede manejar cualquier vehículo DE SU MISMA FLOTA. El avg_score se
// calcula sobre todos los autos que manejó, no sobre uno solo.
//
// IMPORTANTE: el alta de choferes ya NO se hace acá (se sacó
// addDriver). Ahora hay un único camino para crear choferes: la tab
// de Usuarios (usersController.createUser con role='driver'), que
// además les da login, DNI, vencimiento de carnet y dispara el mail
// / whatsapp con las credenciales. Esta tab solo lista, edita y
// elimina — así no quedan dos herramientas de alta pisándose.
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

const updateDriver = async (req, res) => {
    const { id } = req.params;
    const { full_name, phone_number, license_number, dni, license_expiry, status } = req.body;
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
             license_number = COALESCE(?, license_number), dni = COALESCE(?, dni),
             license_expiry = COALESCE(?, license_expiry), status = COALESCE(?, status) WHERE id = ?`,
            [full_name, phone_number, license_number, dni, license_expiry, status, id]
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

module.exports = { getDrivers, updateDriver, deleteDriver };
