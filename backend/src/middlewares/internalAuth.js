// ============================================================
// Autenticación interna server-to-server (NO es para clientes).
// La usa el panel de Puma Code para pedir un resumen de estado de
// la flota, con el mismo patrón que ya usás entre tu API y el
// gt06-standalone: un secreto compartido por variable de entorno,
// nunca un JWT de usuario ni una ApiKey de cliente.
//
// Variable de entorno requerida en Railway:
//   PUMA_INTERNAL_SECRET = un string largo y random (generalo una
//   vez y pegalo IGUAL en este servicio y en el backend de Puma Code).
// ============================================================
function requireInternalSecret(req, res, next) {
    const secret = process.env.PUMA_INTERNAL_SECRET;
    if (!secret) {
        console.error('❌ Falta PUMA_INTERNAL_SECRET — el endpoint interno está deshabilitado por seguridad.');
        return res.status(503).json({ error: 'Endpoint interno no configurado.' });
    }

    const provided = req.headers['x-internal-secret'];
    if (!provided || provided !== secret) {
        return res.status(401).json({ error: 'No autorizado.' });
    }

    next();
}

module.exports = { requireInternalSecret };
