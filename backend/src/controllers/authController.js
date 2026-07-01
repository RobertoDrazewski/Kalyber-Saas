const pool = require('../config/database');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        const user = users[0];
        // En producción usaremos bcrypt para encriptar
        if (password !== user.password_hash) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 🚀 Fabricamos el Token de seguridad
        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ 
            message: 'Login exitoso', 
            token, // Se lo enviamos al frontend
            user: { id: user.id, name: user.name, role: user.role } 
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

module.exports = { login };