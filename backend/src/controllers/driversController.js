const pool = require('../config/database');

// Nota: los conductores NO están atados a un auto fijo — cualquiera
// puede manejar cualquier vehículo de la flota. Por eso Drivers no
// tiene vehicle_id. El avg_score se calcula sobre todos los autos
// que manejó ese conductor (vía Vehicles.current_driver_id en el
// momento de cada lectura), no sobre uno solo.
const getDrivers = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.*,
            (SELECT AVG(th.driver_score) FROM Telemetry_Heuristics th
             JOIN Vehicles v ON th.vehicle_id = v.id
             WHERE v.current_driver_id = d.id) as avg_score
            FROM Drivers d
            ORDER BY d.status ASC, d.full_name ASC
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo conductores' });
    }
};

const addDriver = async (req, res) => {
    const { full_name, phone_number, license_number } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Falta el nombre del conductor' });
    try {
        const [result] = await pool.query(
            `INSERT INTO Drivers (full_name, phone_number, license_number, status) VALUES (?, ?, ?, 'active')`,
            [full_name, phone_number || null, license_number || null]
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
        // No se borra en cascada de Vehicles/Trips: si estaba asignado
        // como current_driver_id en algún auto, lo desasignamos primero
        // para no dejar referencias colgadas.
        await pool.query('UPDATE Vehicles SET current_driver_id = NULL WHERE current_driver_id = ?', [id]);
        await pool.query('UPDATE Trips SET driver_id = NULL WHERE driver_id = ?', [id]);
        await pool.query('DELETE FROM Drivers WHERE id = ?', [id]);
        res.json({ message: 'Conductor eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando conductor' });
    }
};

module.exports = { getDrivers, addDriver, updateDriver, deleteDriver };
