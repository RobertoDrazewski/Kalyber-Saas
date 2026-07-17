const pool = require('../config/database');
const crypto = require('crypto');
const { Resend } = require('resend');
const { sendAlert } = require('../services/whatsappService');

// [FIX 16/07/2026] Antes esto era `const resend = new Resend(process.env.RESEND_API_KEY);`
// a nivel de módulo — si RESEND_API_KEY no estaba seteada en las env
// vars de ESTE servicio de Railway (fleet-backend/Kalyber-Saas), el
// SDK de Resend tira una excepción EN EL MOMENTO DEL require(), antes
// de que Express llegue a levantar. Como usersController.js se importa
// desde userRoutes.js, que se importa desde server.js, eso tumbaba TODO
// el backend (auth, vehículos, telemetría, todo) en un crash-loop
// infinito solo por un problema de la integración de mails — nada que
// ver con el trabajo de separación de puertos VL04/VL502.
// Ahora se crea una sola vez la PRIMERA VEZ que de verdad hace falta
// mandar un mail (lazy init), y si falta la key se loguea un error
// claro y se corta SOLO ese envío puntual, sin tumbar el resto de la API.
let resendClient = null;
function getResendClient() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('Falta configurar RESEND_API_KEY en las variables de entorno de este servicio (fleet-backend) — sin esto no se pueden mandar mails.');
    }
    if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
}

// Jerarquía de creación:
//   super_admin puede crear -> admin (y otro super_admin si hace falta)
//   admin puede crear       -> driver
// Cada usuario nuevo queda con owner_id = quien lo creó, así se arma
// la cadena de pertenencia sin tener que duplicar tablas de tenants.
//
// ESTA es ahora la ÚNICA herramienta para crear admins y choferes con
// login (antes existía también un alta de chofer "sin login" en
// TabConductores/driversController — se sacó de ahí para no tener dos
// caminos distintos que terminan pisándose).
const CREATION_RULES = {
    super_admin: ['admin', 'super_admin', 'taller'],
    admin: ['driver'],
};

const getUsers = async (req, res) => {
    try {
        let query = `SELECT id, name, email, role, owner_id, entity_type, first_name, last_name,
                             dni, company_name, cuit, phone_number, license_expiry, created_at
                      FROM Users`;
        const params = [];

        if (req.user.role === 'admin') {
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
        console.error('[getUsers] error:', error);
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
};

// Trae los admins existentes — lo usa el selector del super_admin
// cuando quiere ver rápido a quién le pertenece cada flota.
const getAdmins = async (req, res) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'No tenés permiso' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT id, name, email, entity_type, company_name, cuit FROM Users WHERE role = 'admin' ORDER BY name ASC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo admins' });
    }
};

function genTempPassword() {
    // 8 caracteres legibles (sin 0/O/1/l para que no se confundan al
    // transcribirla desde un mail o un whatsapp).
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 8 }, () => chars[crypto.randomInt(chars.length)]).join('');
}

async function sendCredentialsEmail({ to, name, role, email, password }) {
    const roleLabel = { admin: 'Administrador de flota', driver: 'Chofer', super_admin: 'Super Admin' }[role] || role;
    try {
        await getResendClient().emails.send({
            from: 'Kalyber <accesos@kalyber.com.ar>',
            to: [to],
            subject: `Tu acceso a Kalyber (${roleLabel})`,
            html: `
                <h2 style="font-family: sans-serif;">Bienvenido a Kalyber, ${name}</h2>
                <p style="font-family: sans-serif;">Ya tenés tu cuenta como <strong>${roleLabel}</strong>. Estos son tus datos de acceso:</p>
                <table style="font-family: sans-serif; border-collapse: collapse; margin: 12px 0;">
                    <tr><td style="padding:4px 12px 4px 0;"><strong>Usuario (email)</strong></td><td>${email}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;"><strong>Contraseña</strong></td><td>${password}</td></tr>
                </table>
                <p style="font-family: sans-serif; color:#64748b; font-size:12px;">Por seguridad, te recomendamos cambiar la contraseña la primera vez que entres.</p>
            `
        });
        return { sent: true };
    } catch (err) {
        console.error('[sendCredentialsEmail] error:', err);
        return { sent: false, error: err.message };
    }
}

const createUser = async (req, res) => {
    const {
        role, email, password: providedPassword, phone_number,
        entity_type,          // 'persona' | 'empresa' (solo aplica a role === 'admin')
        first_name, last_name, dni,          // persona
        company_name, cuit,                  // empresa
        license_expiry,                      // solo choferes
    } = req.body;
    const creatorRole = req.user.role;

    const allowedRoles = CREATION_RULES[creatorRole] || [];
    if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({ error: `Con tu rol (${creatorRole}) no podés crear usuarios de tipo "${role || '(sin especificar)'}"` });
    }
    if (!email) {
        return res.status(400).json({ error: 'Falta el email' });
    }

    // Armamos el "name" para mostrar en listados, y validamos los
    // campos obligatorios según el tipo de alta.
    let displayName;
    if (role === 'admin') {
        if (!entity_type || !['persona', 'empresa'].includes(entity_type)) {
            return res.status(400).json({ error: 'Indicá si el admin es persona física o empresa' });
        }
        if (entity_type === 'persona') {
            if (!first_name || !last_name || !dni) {
                return res.status(400).json({ error: 'Para persona física: nombre, apellido y DNI son obligatorios' });
            }
            displayName = `${first_name} ${last_name}`;
        } else {
            if (!company_name || !cuit) {
                return res.status(400).json({ error: 'Para empresa: razón social y CUIT son obligatorios' });
            }
            displayName = company_name;
        }
    } else if (role === 'driver') {
        if (!first_name || !last_name || !dni || !phone_number) {
            return res.status(400).json({ error: 'Para chofer: nombre, apellido, DNI y teléfono son obligatorios (el teléfono es para las alertas de manejo)' });
        }
        displayName = `${first_name} ${last_name}`;
    } else if (role === 'taller') {
        // [NUEVO 17/07/2026] Login del dueño/mecánico de un taller
        // (producto Kalyber Scanner). Los datos comerciales completos
        // (CUIT, dirección, etc.) viven en Workshops, no acá — este
        // registro en Users es solo el login.
        if (!company_name) {
            return res.status(400).json({ error: 'Falta el nombre del taller (se usa como nombre para mostrar de este login)' });
        }
        displayName = company_name;
    } else {
        // super_admin creado por otro super_admin: caso raro, pedimos lo mínimo.
        if (!first_name || !last_name) {
            return res.status(400).json({ error: 'Nombre y apellido son obligatorios' });
        }
        displayName = `${first_name} ${last_name}`;
    }

    // La password la puede fijar quien crea el usuario, o si no la
    // generamos nosotros y se la mandamos por mail/whatsapp — así el
    // super_admin no tiene que inventarle una clave a cada chofer.
    const password = providedPassword || genTempPassword();

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // NOTA DE SEGURIDAD: la password se guarda en texto plano
        // porque así compara authController.login hoy. Migrar a
        // bcrypt es tarea pendiente aparte — no se hace acá para no
        // romper el login existente, pero es importante priorizarla
        // ahora que hay pagos/datos fiscales de por medio.
        const [result] = await connection.query(
            `INSERT INTO Users
                (name, email, password_hash, role, owner_id, entity_type, first_name, last_name, dni, company_name, cuit, phone_number, license_expiry)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                displayName, email, password, role, req.user.id,
                role === 'admin' ? entity_type : null,
                first_name || null, last_name || null, dni || null,
                company_name || null, cuit || null,
                phone_number || null,
                role === 'driver' ? (license_expiry || null) : null,
            ]
        );
        const newUserId = result.insertId;

        // Si es chofer, además creamos su perfil en Drivers (así el
        // resto del sistema —trips, telemetry, score— sigue igual).
        if (role === 'driver') {
            await connection.query(
                `INSERT INTO Drivers (full_name, phone_number, license_number, dni, license_expiry, status, user_id, owner_id)
                 VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
                [displayName, phone_number, null, dni, license_expiry || null, newUserId, req.user.id]
            );
        }

        await connection.commit();

        // Notificaciones best-effort: si fallan, el usuario ya quedó
        // creado igual — se lo avisamos al que lo creó en la respuesta.
        const notif = { email: null, whatsapp: null };
        notif.email = await sendCredentialsEmail({ to: email, name: displayName, role, email, password });
        if (role === 'driver' && phone_number) {
            notif.whatsapp = await sendAlert(phone_number, `Hola ${displayName}, tu acceso a Kalyber: usuario ${email} / clave ${password}`);
        }

        res.json({ id: newUserId, name: displayName, email, role, notif });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ese email ya está registrado' });
        }
        console.error('[createUser] error:', error);
        res.status(500).json({ error: 'Error creando el usuario' });
    } finally {
        connection.release();
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, password, status, phone_number, license_expiry } = req.body;

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
            `UPDATE Users SET name = COALESCE(?, name), password_hash = COALESCE(?, password_hash),
             phone_number = COALESCE(?, phone_number), license_expiry = COALESCE(?, license_expiry) WHERE id = ?`,
            [name, password, phone_number, license_expiry, id]
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

module.exports = { getUsers, getAdmins, createUser, updateUser, deleteUser };