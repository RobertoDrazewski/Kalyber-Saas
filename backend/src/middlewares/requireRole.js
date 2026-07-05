// ============================================================
// Gate de permisos por rol. Se usa DESPUÉS de verifyToken (que ya
// dejó req.user = { id, role } desde el JWT).
//
// Jerarquía: super_admin > admin > driver.
// - super_admin: sos vos (Puma Code). Ve y crea todo, incluidos admins.
// - admin: dueño de una flota cliente. Ve y gestiona SOLO lo suyo
//   (sus vehículos, choferes, equipos) — nunca lo de otro admin.
// - driver: chofer con vista reducida (mapa + elegir su auto).
//
// Uso: router.post('/', verifyToken, requireRole('super_admin'), crearAdmin)
// ============================================================
const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'No tenés permiso para hacer esto' });
    }
    next();
};

// Devuelve el owner_id "efectivo" de la petición — es decir, de qué
// flota/tenant hay que filtrar los datos:
//   - super_admin: no filtra (ve todo), salvo que pase ?owner_id=X
//   - admin: su propio id (todo lo que creó le pertenece a él)
//   - driver: el id de su admin (owner_id de su propio usuario)
const effectiveOwnerId = (req) => {
    if (req.user.role === 'super_admin') return req.query.owner_id || null;
    if (req.user.role === 'admin') return req.user.id;
    return req.user.owner_id || null; // driver
};

module.exports = { requireRole, effectiveOwnerId };
