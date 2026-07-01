const pool = require('../config/database');

const getUsers = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM Users');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
};

module.exports = { getUsers };