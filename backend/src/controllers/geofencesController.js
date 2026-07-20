const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');
// [20/07/2026] Ya NO importamos gt06InternalClient — las geocercas no
// le mandan ningún comando al equipo, todo se detecta por GPS del lado
// del servidor (checkGeofenceCrossings en telemetryIngestReal.js).

// Mismo criterio de acceso que ya usa telemetryController — confirma
// que el vehículo pedido sea de la flota de quien pregunta.
async function assertVehicleAccess(req, vehicleId) {
    const ownerId = effectiveOwnerId(req);
    if (!ownerId) return true; // super_admin sin filtro
    const [[vehicle]] = await pool.query('SELECT owner_id FROM Vehicles WHERE id = ?', [vehicleId]);
    return !!vehicle && vehicle.owner_id === ownerId;
}

const getVehicleGeofences = async (req, res) => {
    const { id } = req.params;
    try {
        if (!(await assertVehicleAccess(req, id))) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }
        const [rows] = await pool.query(
            `SELECT id, name, lat, lng, radius_m, mode, active, device_synced, created_at
             FROM Geofences WHERE vehicle_id = ? ORDER BY created_at DESC`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') return res.json([]); // migración todavía no corrida
        res.status(500).json({ error: 'Error obteniendo geocercas' });
    }
};

// ============================================================
// [REESCRITO 20/07/2026] Crea la geocerca en la base y NADA MÁS.
//
// IMPORTANTE — corrección de un error real: esta función ANTES le
// mandaba un comando al equipo (FENCE para VL04, 0x8600 para VL502)
// cada vez que se creaba una geocerca. Eso contradecía la decisión
// que tomamos de hacer TODO por GPS del lado del servidor, y causaba
// dos problemas reales:
//   1. VL04: el comando de geocerca del equipo es inestable y lo
//      "rompía" (rechazaba la salida en modo BOTH, etc.).
//   2. VL502: si el equipo no estaba con conexión TCP activa en ese
//      instante exacto (aunque estuviera reportando en la ruta un
//      segundo después), tiraba el error "no tiene conexión TCP
//      activa" y asustaba al usuario sin necesidad.
//
// La detección de cruces YA la hace el servidor por GPS en
// telemetryIngestReal.js (checkGeofenceCrossings, basado en la
// distancia haversine entre la posición reportada y el centro de cada
// geocerca). NO necesita que el equipo sepa nada de la geocerca. Por
// eso acá NO se manda ningún comando: se guarda en la base y el
// cálculo por GPS la toma en la próxima posición que llegue.
//
// device_synced queda en 1 directo — ya no significa "el equipo
// confirmó el comando" (que ya no mandamos), significa simplemente
// "la geocerca está activa y el servidor la está vigilando por GPS".
// ============================================================
const createGeofence = async (req, res) => {
    const { vehicle_id, name, lat, lng, radius_m, mode } = req.body;

    if (!vehicle_id || lat == null || lng == null || !radius_m) {
        return res.status(400).json({ error: 'Faltan datos: vehicle_id, lat, lng y radius_m son obligatorios' });
    }
    const radiusNum = parseInt(radius_m, 10);
    if (!Number.isFinite(radiusNum) || radiusNum < 10 || radiusNum > 50000) {
        return res.status(400).json({ error: 'El radio tiene que ser un número entre 10 y 50000 metros' });
    }
    const fenceMode = ['IN', 'OUT', 'BOTH'].includes(mode) ? mode : 'OUT';

    try {
        if (!(await assertVehicleAccess(req, vehicle_id))) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        // Confirmamos que el auto tenga un equipo pareado (para saber
        // que va a llegar posición GPS que alimente el cálculo), pero
        // NO le mandamos nada al equipo ni dependemos de que esté
        // conectado en este instante.
        const [[device]] = await pool.query(
            `SELECT d.imei FROM Devices d WHERE d.vehicle_id = ? AND d.status = 'paired'`,
            [vehicle_id]
        );
        if (!device) {
            return res.status(400).json({ error: 'Ese vehículo no tiene un equipo GPS pareado todavía' });
        }

        const [result] = await pool.query(
            `INSERT INTO Geofences (vehicle_id, name, lat, lng, radius_m, mode, active, device_synced)
             VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
            [vehicle_id, name || null, lat, lng, radiusNum, fenceMode]
        );

        res.json({
            id: result.insertId,
            message: 'Geocerca creada. El servidor la vigila por GPS — se detecta la entrada y salida con la posición real del equipo, sin depender de que el equipo tenga la función ni de mandarle ningún comando.',
            device_synced: true,
        });
    } catch (error) {
        console.error('❌ Error creando geocerca:', error);
        res.status(500).json({ error: 'Error creando la geocerca' });
    }
};

// Borra la geocerca de nuestra base. NO le manda automáticamente
// FENCE,OFF# al equipo — lo dejamos manual a propósito (ver nota en
// el front) para no desactivar por accidente algo que el cliente
// configuró él mismo por SMS y que nuestra base no conoce.
const deleteGeofence = async (req, res) => {
    const { id } = req.params;
    try {
        const [[fence]] = await pool.query('SELECT vehicle_id FROM Geofences WHERE id = ?', [id]);
        if (!fence) return res.status(404).json({ error: 'Geocerca no encontrada' });
        if (!(await assertVehicleAccess(req, fence.vehicle_id))) {
            return res.status(403).json({ error: 'Esa geocerca no pertenece a tu flota' });
        }
        await pool.query('DELETE FROM Geofences WHERE id = ?', [id]);
        res.json({ message: 'Geocerca eliminada de la base. Si querés que el equipo deje de vigilarla, mandale FENCE,OFF# aparte.' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando la geocerca' });
    }
};

// [REESCRITO 20/07/2026] "Reintentar" ya NO manda ningún comando al
// equipo — ni al VL04 (el comando FENCE lo rompía) ni al VL502 (el
// 0x8600 fallaba si no había conexión TCP en ese instante exacto).
// En el modelo por GPS no hay nada que "reenviar" al equipo: la
// geocerca ya está guardada y el servidor la vigila por posición. Este
// endpoint queda por compatibilidad con el botón del panel, pero solo
// se asegura de que la geocerca esté marcada como activa. Idealmente
// el botón "Reintentar" se saca del frontend (ya no hay nada que
// reintentar), pero si queda, no rompe nada ni toca el equipo.
const resyncGeofence = async (req, res) => {
    const { id } = req.params;
    try {
        const [[fence]] = await pool.query('SELECT vehicle_id FROM Geofences WHERE id = ?', [id]);
        if (!fence) return res.status(404).json({ error: 'Geocerca no encontrada' });
        if (!(await assertVehicleAccess(req, fence.vehicle_id))) {
            return res.status(403).json({ error: 'Esa geocerca no pertenece a tu flota' });
        }

        // Solo re-confirmamos que esté activa y marcada como vigilada
        // por GPS. NO se le manda absolutamente nada al equipo.
        await pool.query('UPDATE Geofences SET active = 1, device_synced = 1 WHERE id = ?', [id]);

        res.json({
            device_synced: true,
            message: 'Geocerca activa. El servidor la vigila por GPS — no hace falta enviar nada al equipo.',
        });
    } catch (error) {
        console.error('❌ Error reactivando geocerca:', error);
        res.status(500).json({ error: 'Error reactivando la geocerca' });
    }
};

// [REESCRITO 20/07/2026] Edita una geocerca (nombre, radio, modo o
// centro) SOLO en la base. Igual que createGeofence: NO le manda
// ningún comando al equipo (ni VL04 ni VL502). El cálculo por GPS
// toma los valores nuevos en la próxima posición que llegue.
const updateGeofence = async (req, res) => {
    const { id } = req.params;
    const { name, lat, lng, radius_m, mode } = req.body;

    try {
        const [[existing]] = await pool.query('SELECT * FROM Geofences WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ error: 'Geocerca no encontrada' });
        if (!(await assertVehicleAccess(req, existing.vehicle_id))) {
            return res.status(403).json({ error: 'Esa geocerca no pertenece a tu flota' });
        }

        const newLat = lat != null ? lat : existing.lat;
        const newLng = lng != null ? lng : existing.lng;
        const newName = name !== undefined ? (name || null) : existing.name;

        let newRadius = existing.radius_m;
        if (radius_m != null) {
            const radiusNum = parseInt(radius_m, 10);
            if (!Number.isFinite(radiusNum) || radiusNum < 10 || radiusNum > 50000) {
                return res.status(400).json({ error: 'El radio tiene que ser un número entre 10 y 50000 metros' });
            }
            newRadius = radiusNum;
        }

        const newMode = ['IN', 'OUT', 'BOTH'].includes(mode) ? mode : existing.mode;

        // device_synced se mantiene en 1: la geocerca sigue vigilada por
        // GPS con los valores nuevos, sin tocar el equipo.
        await pool.query(
            `UPDATE Geofences SET name = ?, lat = ?, lng = ?, radius_m = ?, mode = ?, device_synced = 1 WHERE id = ?`,
            [newName, newLat, newLng, newRadius, newMode, id]
        );

        res.json({
            message: 'Geocerca actualizada. El servidor la vigila por GPS con los valores nuevos — no se le manda nada al equipo.',
            device_synced: true,
        });
    } catch (error) {
        console.error('❌ Error editando geocerca:', error);
        res.status(500).json({ error: 'Error editando la geocerca' });
    }
};

module.exports = { getVehicleGeofences, createGeofence, updateGeofence, deleteGeofence, resyncGeofence };