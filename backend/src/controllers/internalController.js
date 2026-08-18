// ============================================================
// Resumen de estado para el panel de Asistentes de Puma Code.
// Un solo endpoint, curado (no expone filas crudas de clientes),
// pensado para responder rápido y no bloquear si algo puntual falla.
// ============================================================
const pool = require('../config/database');

// Un equipo pareado se considera "offline" si no mandó ping hace
// más de este umbral. 30 min es generoso para GPS-only (VL04 manda
// bastante seguido); lo ajustamos con la práctica si da falsos positivos.
const OFFLINE_THRESHOLD_MIN = 30;

exports.getStatus = async (req, res) => {
    try {
        const [[devices]] = await pool.query(
            `SELECT
                COUNT(*) AS total,
                SUM(status = 'unpaired') AS unpaired,
                SUM(status = 'paired' AND last_seen_at >= DATE_SUB(NOW(), INTERVAL ${OFFLINE_THRESHOLD_MIN} MINUTE)) AS online,
                SUM(status = 'paired' AND (last_seen_at IS NULL OR last_seen_at < DATE_SUB(NOW(), INTERVAL ${OFFLINE_THRESHOLD_MIN} MINUTE))) AS offline
             FROM Devices`
        );

        const [[vehicles]] = await pool.query(
            `SELECT
                COUNT(*) AS total,
                SUM(status = 'active') AS active,
                SUM(status = 'maintenance') AS maintenance,
                SUM(status = 'inactive') AS inactive,
                MAX(last_ping_at) AS ultimo_ping
             FROM Vehicles`
        );

        // Subscriptions puede no existir todavía en instalaciones viejas
        // que no corrieron la migración — no queremos que todo el
        // endpoint falle por eso.
        let subs = { activas: 0, pendientes: 0, mrr_ars: 0, ultimo_pago: null };
        try {
            const [[row]] = await pool.query(
                `SELECT
                    SUM(status = 'active') AS activas,
                    SUM(status = 'pending') AS pendientes,
                    COALESCE(SUM(monthly_total * (status = 'active')), 0) AS mrr_ars,
                    MAX(last_payment_at) AS ultimo_pago
                 FROM Subscriptions`
            );
            subs = {
                activas: Number(row.activas) || 0,
                pendientes: Number(row.pendientes) || 0,
                mrr_ars: Number(row.mrr_ars) || 0,
                ultimo_pago: row.ultimo_pago,
            };
        } catch (err) {
            console.warn('⚠️ No se pudo leer Subscriptions (¿falta la migración?):', err.message);
        }

        res.json({
            success: true,
            devices: {
                total: Number(devices.total) || 0,
                unpaired: Number(devices.unpaired) || 0,
                online: Number(devices.online) || 0,
                offline: Number(devices.offline) || 0,
            },
            vehicles: {
                total: Number(vehicles.total) || 0,
                active: Number(vehicles.active) || 0,
                maintenance: Number(vehicles.maintenance) || 0,
                inactive: Number(vehicles.inactive) || 0,
                ultimo_ping: vehicles.ultimo_ping,
            },
            subscriptions: subs,
            checked_at: new Date(),
        });
    } catch (error) {
        console.error('❌ Error en /internal/status:', error);
        res.status(500).json({ success: false, error: 'No se pudo calcular el estado de la flota.' });
    }
};
