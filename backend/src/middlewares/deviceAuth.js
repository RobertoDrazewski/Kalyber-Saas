const crypto = require('crypto');
const pool = require('../config/database');

function hashDeviceToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// [AJUSTADO 17/07/2026 contra backend_client.cpp real] El firmware ya
// tiene el comentario "agregar acá: http.addHeader('x-internal-secret',
// SECRET)" — usamos ESE nombre de header para no pedirte que cambies
// el firmware. Importante la distinción: NO es un secreto único
// compartido por todos los equipos (como GT06_INTERNAL_SECRET, que es
// interno entre nuestros propios dos servicios) — folder por equipo,
// pareado 1 a 1 con su ScannerDevices.device_uid. Si algún día un
// equipo se pierde/lo roban, se revoca SOLO ese, sin afectar al resto
// de tus clientes.
async function requireDeviceToken(req, res, next) {
    const rawToken = req.headers['x-internal-secret'];
    if (!rawToken) {
        return res.status(401).json({ error: 'Falta el header x-internal-secret' });
    }
    try {
        const tokenHash = hashDeviceToken(rawToken);
        const [[device]] = await pool.query(
            `SELECT id, workshop_id, mode, device_uid FROM ScannerDevices WHERE device_token_hash = ?`,
            [tokenHash]
        );
        if (!device) return res.status(401).json({ error: 'Token de dispositivo inválido' });
        if (!device.workshop_id) return res.status(403).json({ error: 'Este equipo todavía no fue pareado a ningún taller' });

        req.scannerDevice = device;
        pool.query('UPDATE ScannerDevices SET last_seen_at = NOW() WHERE id = ?', [device.id]).catch(() => {});
        next();
    } catch (error) {
        res.status(500).json({ error: 'Error validando el token del dispositivo' });
    }
}

module.exports = { requireDeviceToken, hashDeviceToken };
