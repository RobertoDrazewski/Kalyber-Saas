const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');
const gt06Server = require('../services/gt06Server');

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
// Crea la geocerca en la base Y, si el equipo está conectado en este
// momento, le manda el comando FENCE por la conexión TCP activa
// (mismo mecanismo que sendCommandToDevice ya usa para PARAM#/WHERE#
// — ver gt06Server.js). Si el equipo está apagado/sin señal, la
// geocerca queda guardada igual (device_synced=0) para no bloquear
// al usuario, pero avisamos en la respuesta que no se sincronizó.
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
    const fenceMode = mode === 'IN' ? 'IN' : 'OUT';

    try {
        if (!(await assertVehicleAccess(req, vehicle_id))) {
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }

        const [[device]] = await pool.query(
            `SELECT d.imei, d.model FROM Devices d WHERE d.vehicle_id = ? AND d.status = 'paired'`,
            [vehicle_id]
        );
        if (!device) {
            return res.status(400).json({ error: 'Ese vehículo no tiene un equipo GPS pareado todavía' });
        }
        if (device.model !== 'VL04') {
            return res.status(400).json({ error: 'Por ahora solo mandamos el comando de geocerca a equipos VL04. El VL502 usa JT808, y el mensaje 0x8300 que se probó para eso es para MOSTRAR texto en el terminal, no para configurarlo — casi seguro no hace nada real. Hace falta implementar el mensaje JT808 correcto (0x8600, "Set Circular Fence") antes de habilitarlo acá.' });
        }

        const [result] = await pool.query(
            `INSERT INTO Geofences (vehicle_id, name, lat, lng, radius_m, mode, active, device_synced)
             VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
            [vehicle_id, name || null, lat, lng, radiusNum, fenceMode]
        );

        const command = `FENCE,ON,0,${lat},${lng},${radiusNum},${fenceMode},0#`;
        const sendResult = await gt06Server.sendCommandToDevice(device.imei, command);

        if (sendResult.sent) {
            await pool.query('UPDATE Geofences SET device_synced = 1 WHERE id = ?', [result.insertId]);
        }

        res.json({
            id: result.insertId,
            message: sendResult.sent
                ? 'Geocerca creada y comando enviado al equipo. La confirmación real del equipo (FENCE#) va a aparecer en los logs del servidor.'
                : `Geocerca guardada, pero no se pudo enviar el comando al equipo ahora mismo: ${sendResult.reason}. Vas a tener que reenviarlo (por ejemplo con FENCE# desde SMS) cuando el equipo esté online.`,
            device_synced: sendResult.sent,
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

// Reintenta mandar el comando FENCE de una geocerca que quedó
// device_synced=0 (el equipo estaba offline cuando se creó). Útil
// para no tener que ir a mandarlo a mano por SMS apenas el equipo
// vuelva a conectarse — el botón "Reintentar" del panel pega acá.
const resyncGeofence = async (req, res) => {
    const { id } = req.params;
    try {
        const [[fence]] = await pool.query(
            `SELECT g.*, d.imei, d.model
             FROM Geofences g
             JOIN Vehicles v ON v.id = g.vehicle_id
             LEFT JOIN Devices d ON d.vehicle_id = v.id AND d.status = 'paired'
             WHERE g.id = ?`,
            [id]
        );
        if (!fence) return res.status(404).json({ error: 'Geocerca no encontrada' });
        if (!(await assertVehicleAccess(req, fence.vehicle_id))) {
            return res.status(403).json({ error: 'Esa geocerca no pertenece a tu flota' });
        }
        if (!fence.imei) {
            return res.status(400).json({ error: 'Ese vehículo no tiene un equipo pareado' });
        }
        if (fence.model !== 'VL04') {
            return res.status(400).json({ error: 'Reenvío automático solo soportado para VL04 por ahora — ver nota en createGeofence sobre por qué el VL502 no está habilitado todavía.' });
        }

        const command = `FENCE,ON,0,${fence.lat},${fence.lng},${fence.radius_m},${fence.mode},0#`;
        const sendResult = await gt06Server.sendCommandToDevice(fence.imei, command);

        if (sendResult.sent) {
            await pool.query('UPDATE Geofences SET device_synced = 1 WHERE id = ?', [id]);
        }

        res.json({
            device_synced: sendResult.sent,
            message: sendResult.sent
                ? 'Comando reenviado al equipo. Confirmá con FENCE# que lo aplicó.'
                : `Todavía no se pudo enviar: ${sendResult.reason}`,
        });
    } catch (error) {
        console.error('❌ Error reintentando geocerca:', error);
        res.status(500).json({ error: 'Error reintentando el envío' });
    }
};

module.exports = { getVehicleGeofences, createGeofence, deleteGeofence, resyncGeofence };