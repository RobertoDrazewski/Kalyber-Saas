const pool = require('../config/database');

// Jerarquía de creación:
//   super_admin puede crear -> admin (y otro super_admin si hace falta)
//   admin puede crear       -> driver
// Cada usuario nuevo queda con owner_id = quien lo creó, así se arma
// la cadena de pertenencia sin tener que duplicar tablas de tenants.
const CREATION_RULES = {
    super_admin: ['admin', 'super_admin'],
    admin: ['driver'],
};

const getUsers = async (req, res) => {
    try {
        let query = 'SELECT id, name, email, role, owner_id, created_at FROM Users';
        const params = [];

        if (req.user.role === 'admin') {
            // Un admin solo ve a los usuarios que él mismo creó (sus choferes)
            query += ' WHERE owner_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'driver') {
            return res.status(403).json({ error: 'No tenés permiso para ver usuarios' });
        }
        // super_admin ve todo, sin filtro

        query += ' ORDER BY role ASC, name ASC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
};

const createUser = async (req, res) => {
    const { name, email, password, role, phone_number, license_number } = req.body;
    const creatorRole = req.user.role;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (nombre, email, password, rol)' });
    }

    const allowedRoles = CREATION_RULES[creatorRole] || [];
    if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: `Con tu rol (${creatorRole}) no podés crear usuarios de tipo "${role}"` });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // NOTA DE SEGURIDAD: la password se guarda en texto plano
        // porque así está el resto del sistema hoy (login.js compara
        // texto plano). Migrar a bcrypt es una tarea pendiente aparte
        // — no lo hacemos acá solo para no romper el login existente.
        const [result] = await connection.query(
            `INSERT INTO Users (name, email, password_hash, role, owner_id) VALUES (?, ?, ?, ?, ?)`,
            [name, email, password, role, req.user.id]
        );
        const newUserId = result.insertId;

        // Si es un driver, además le creamos (o vinculamos) su perfil
        // de conductor en Drivers, para que sus datos de manejo/score
        // sigan funcionando igual que antes.
        if (role === 'driver') {
            await connection.query(
                `INSERT INTO Drivers (full_name, phone_number, license_number, status, user_id, owner_id) VALUES (?, ?, ?, 'active', ?, ?)`,
                [name, phone_number || null, license_number || null, newUserId, req.user.id]
            );
        }

        await connection.commit();
        res.json({ id: newUserId, name, email, role });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ese email ya está registrado' });
        }
        res.status(500).json({ error: 'Error creando el usuario' });
    } finally {
        connection.release();
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, password, status } = req.body;

    // Un admin solo puede tocar usuarios que él creó; super_admin, cualquiera
    if (req.user.role === 'admin') {
        const [[target]] = await pool.query('SELECT owner_id FROM Users WHERE id = ?', [id]);
        if (!target || target.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'No tenés permiso para editar este usuario' });
        }
    } else if (req.user.role === 'driver') {
        return res.status(403).json({ error: 'No tenés permiso para editar usuarios' });
    }

    try {
        await pool.query(
            `UPDATE Users SET name = COALESCE(?, name), password_hash = COALESCE(?, password_hash) WHERE id = ?`,
            [name, password, id]
        );
        res.json({ message: 'Usuario actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando usuario' });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;

    if (req.user.role === 'admin') {
        const [[target]] = await pool.query('SELECT owner_id FROM Users WHERE id = ?', [id]);
        if (!target || target.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'No tenés permiso para eliminar este usuario' });
        }
    } else if (req.user.role === 'driver') {
        return res.status(403).json({ error: 'No tenés permiso para eliminar usuarios' });
    }

    try {
        await pool.query('UPDATE Vehicles SET current_driver_id = NULL WHERE current_driver_id IN (SELECT id FROM Drivers WHERE user_id = ?)', [id]);
        await pool.query('DELETE FROM Drivers WHERE user_id = ?', [id]);
        await pool.query('DELETE FROM Users WHERE id = ?', [id]);
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando usuario' });
    }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
