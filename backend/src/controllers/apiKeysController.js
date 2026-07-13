const crypto = require('crypto');
const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');

function hashKey(rawKey) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function generateRawKey() {
    // kal_live_ + 32 caracteres hex al azar. El prefijo sirve para
    // reconocer de un vistazo que es una key de Kalyber (mismo patrón
    // que usan Stripe/GitHub), no aporta seguridad por sí solo — la
    // seguridad real es el resto, aleatorio y solo lo conoce quien la
    // generó (nunca se vuelve a mostrar completa después de crearla).
    const random = crypto.randomBytes(24).toString('hex');
    return `kal_live_${random}`;
}

// El admin (o super_admin) genera una key para SU PROPIA flota. La
// key completa se devuelve UNA SOLA VEZ acá — a partir de este
// momento solo guardamos el hash, no se puede volver a mostrar.
const createApiKey = async (req, res) => {
    const { label } = req.body;
    try {
        const ownerId = effectiveOwnerId(req) || req.user.id; // super_admin genera para sí mismo si no especifica otra cosa
        const rawKey = generateRawKey();
        const keyPrefix = rawKey.slice(0, 16); // "kal_live_" + 7 caracteres, alcanza para mostrar en la lista sin exponer la key completa
        const keyHash = hashKey(rawKey);

        await pool.query(
            `INSERT INTO ApiKeys (owner_id, label, key_prefix, key_hash, created_by) VALUES (?, ?, ?, ?, ?)`,
            [ownerId, label || 'Sin nombre', keyPrefix, keyHash, req.user.id]
        );

        // OJO: esta es la ÚNICA vez que la key completa viaja por la
        // red — de acá en más solo existe el hash en la base.
        res.json({ api_key: rawKey, key_prefix: keyPrefix, label: label || 'Sin nombre' });
    } catch (error) {
        console.error('[ApiKeys] Error generando key:', error.message);
        res.status(500).json({ error: 'Error generando la API key' });
    }
};

const listApiKeys = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req) || req.user.id;
        const [rows] = await pool.query(
            `SELECT id, label, key_prefix, last_used_at, revoked_at, created_at
             FROM ApiKeys WHERE owner_id = ? ORDER BY created_at DESC`,
            [ownerId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo las API keys' });
    }
};

const revokeApiKey = async (req, res) => {
    const { id } = req.params;
    try {
        const ownerId = effectiveOwnerId(req) || req.user.id;
        const [[key]] = await pool.query('SELECT owner_id FROM ApiKeys WHERE id = ?', [id]);
        if (!key) return res.status(404).json({ error: 'API key no encontrada' });
        if (key.owner_id !== ownerId) return res.status(403).json({ error: 'Esa API key no es tuya' });

        await pool.query('UPDATE ApiKeys SET revoked_at = NOW() WHERE id = ?', [id]);
        res.json({ message: 'API key revocada' });
    } catch (error) {
        res.status(500).json({ error: 'Error revocando la API key' });
    }
};

module.exports = { createApiKey, listApiKeys, revokeApiKey, hashKey };