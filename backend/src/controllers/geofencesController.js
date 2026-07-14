const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');
const gt06Internal = require('../services/gt06InternalClient'); // FIX 13/07/2026: ver nota en gt06InternalClient.js — llamar a gt06Server directo daba un activeSockets vacío, este proceso corre separado del que tiene los equipos conectados

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
    // [NUEVO 14/07/2026] Ahora acepta 'BOTH' (avisa al entrar Y al
    // salir), además de 'IN'/'OUT' — antes solo se podía elegir una de
    // las dos por geocerca.
    const fenceMode = ['IN', 'OUT', 'BOTH'].includes(mode) ? mode : 'OUT';

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
        if (device.model !== 'VL04' && device.model !== 'VL502') {
            return res.status(400).json({ error: 'Modelo de equipo no soportado para geocercas' });
        }

        const [result] = await pool.query(
            `INSERT INTO Geofences (vehicle_id, name, lat, lng, radius_m, mode, active, device_synced)
             VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
            [vehicle_id, name || null, lat, lng, radiusNum, fenceMode]
        );

        // [ACTUALIZADO 13/07/2026] Ahora arma el mensaje correcto según
        // el protocolo real de cada equipo — para VL04 sigue siendo el
        // comando de texto FENCE (confirmado funcionando con un cruce
        // real de geocerca); para VL502 arma el mensaje binario JT808
        // 0x8600 real, EN VEZ del 0x8300 de texto que no configuraba
        // nada. El 0x8600 todavía no está confirmado contra un cruce
        // real — device_synced=1 acá solo dice "el comando salió y el
        // equipo contestó 0x0001 con éxito", NO "confirmamos que la
        // alarma de geocerca funciona" — eso hace falta probarlo aparte.
        const sendResult = await gt06Internal.sendFenceCommand(device.imei, {
            fenceId: result.insertId,
            lat, lng, radiusM: radiusNum, mode: fenceMode,
        });

        if (sendResult.sent) {
            await pool.query('UPDATE Geofences SET device_synced = 1 WHERE id = ?', [result.insertId]);
        }

        const vl502Warning = device.model === 'VL502'
            ? ' (VL502: el comando 0x8600 se mandó, pero todavía NO está confirmado que la alarma de geocerca realmente llegue al cruzar el límite — falta esa prueba real.)'
            : '';
        // [NUEVO 14/07/2026] sendFenceCommand devuelve "warning" cuando
        // el comando se mandó pero con una limitación confirmada por
        // logs reales (hoy: VL04 + modo BOTH → el equipo rechaza la
        // alarma de salida, ver gt06Server.js). Sin esto, el mensaje
        // decía "creada y enviada" sin avisar que la mitad no aplicó.
        const deviceWarning = sendResult.warning ? ` (${sendResult.warning})` : '';

        res.json({
            id: result.insertId,
            message: sendResult.sent
                ? `Geocerca creada y comando enviado al equipo.${vl502Warning}${deviceWarning}`
                : `Geocerca guardada, pero no se pudo enviar el comando al equipo ahora mismo: ${sendResult.reason}.`,
            device_synced: sendResult.sent,
            warning: sendResult.warning || null,
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
        if (fence.model !== 'VL04' && fence.model !== 'VL502') {
            return res.status(400).json({ error: 'Modelo de equipo no soportado' });
        }

        const sendResult = await gt06Internal.sendFenceCommand(fence.imei, {
            fenceId: fence.id, lat: fence.lat, lng: fence.lng, radiusM: fence.radius_m, mode: fence.mode,
        });

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

// [NUEVO 14/07/2026] Edita una geocerca ya creada (nombre, radio,
// modo y/o centro) y le vuelve a mandar el comando al equipo — para
// VL502 con "atributo de configuración"=2 (modificar, Tabla 55) en
// vez de 0 (crear), para VL04 simplemente reenvía FENCE,ON con el
// mismo slot (ya pisa la config anterior, mismo mecanismo que crear).
// Antes no existía forma de editar: había que borrar y crear de
// nuevo, perdiendo el histórico de "device_synced" y el ID.
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

        await pool.query(
            `UPDATE Geofences SET name = ?, lat = ?, lng = ?, radius_m = ?, mode = ?, device_synced = 0 WHERE id = ?`,
            [newName, newLat, newLng, newRadius, newMode, id]
        );

        const [[device]] = await pool.query(
            `SELECT d.imei, d.model FROM Devices d WHERE d.vehicle_id = ? AND d.status = 'paired'`,
            [existing.vehicle_id]
        );
        if (!device) {
            return res.json({ message: 'Geocerca editada en la base, pero ese vehículo no tiene un equipo GPS pareado para reenviar el comando.', device_synced: false });
        }

        const sendResult = await gt06Internal.sendFenceCommand(device.imei, {
            fenceId: existing.id, lat: newLat, lng: newLng, radiusM: newRadius, mode: newMode, isEdit: true,
        });

        if (sendResult.sent) {
            await pool.query('UPDATE Geofences SET device_synced = 1 WHERE id = ?', [id]);
        }

        const deviceWarning = sendResult.warning ? ` (${sendResult.warning})` : '';

        res.json({
            message: sendResult.sent
                ? `Geocerca editada y comando reenviado al equipo.${deviceWarning}`
                : `Geocerca editada en la base, pero no se pudo reenviar el comando ahora mismo: ${sendResult.reason}.`,
            device_synced: sendResult.sent,
        });
    } catch (error) {
        console.error('❌ Error editando geocerca:', error);
        res.status(500).json({ error: 'Error editando la geocerca' });
    }
};

module.exports = { getVehicleGeofences, createGeofence, updateGeofence, deleteGeofence, resyncGeofence };