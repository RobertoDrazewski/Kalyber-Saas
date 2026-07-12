const crypto = require('crypto');
const pool = require('../config/database');

function hashKey(rawKey) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// A diferencia del login normal (JWT, para el panel), esto es para
// que un sistema EXTERNO del cliente consuma sus propios datos.
// Acepta la key por header "Authorization: Bearer <key>" o "X-API-Key".
async function requireApiKey(req, res, next) {
    const authHeader = req.headers['authorization'];
    const rawKey = req.headers['x-api-key'] || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!rawKey) {
        return res.status(401).json({ error: 'Falta la API key (header Authorization: Bearer <key> o X-API-Key)' });
    }

    try {
        const keyHash = hashKey(rawKey);
        const [[row]] = await pool.query(
            `SELECT id, owner_id, revoked_at FROM ApiKeys WHERE key_hash = ?`,
            [keyHash]
        );

        if (!row) return res.status(401).json({ error: 'API key inválida' });
        if (row.revoked_at) return res.status(401).json({ error: 'Esta API key fue revocada' });

        req.apiOwnerId = row.owner_id;

        // Best-effort, no bloquea la respuesta si falla.
        pool.query('UPDATE ApiKeys SET last_used_at = NOW() WHERE id = ?', [row.id]).catch(() => {});

        next();
    } catch (error) {
        res.status(500).json({ error: 'Error validando la API key' });
    }
}

module.exports = { requireApiKey };
