const pool = require('../config/database');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// No le mandamos un mail al admin cada vez que se calcula la
// heurística (sería spam) — solo si no le mandamos nada para este
// mismo auto+tipo de problema en los últimos 7 días.
const COOLDOWN_DAYS = 7;

async function alreadyAlertedRecently(vehicleId, type) {
    const [[row]] = await pool.query(
        `SELECT id FROM MaintenanceAlerts WHERE vehicle_id = ? AND type = ? AND sent_at > DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [vehicleId, type, COOLDOWN_DAYS]
    );
    return !!row;
}

async function sendMaintenanceAlert(vehicleId, type, detail) {
    try {
        if (await alreadyAlertedRecently(vehicleId, type)) return;

        const [[vehicle]] = await pool.query(
            `SELECT v.plate, v.brand, v.model, u.email as owner_email, u.name as owner_name
             FROM Vehicles v LEFT JOIN Users u ON v.owner_id = u.id WHERE v.id = ?`,
            [vehicleId]
        );
        if (!vehicle || !vehicle.owner_email) return; // sin dueño con mail, no hay a quién avisar

        await resend.emails.send({
            from: 'Kalyber <alertas@kalyber.com.ar>',
            to: [vehicle.owner_email],
            subject: `⚠️ Mantenimiento pendiente — ${vehicle.plate}`,
            html: `
                <h2>Alerta de mantenimiento</h2>
                <p><strong>${vehicle.plate}</strong> (${vehicle.brand} ${vehicle.model})</p>
                <p>${detail}</p>
                <p>Entrá al panel para ver el detalle y registrar el service cuando lo hagas.</p>
            `,
        });

        await pool.query(`INSERT INTO MaintenanceAlerts (vehicle_id, type) VALUES (?, ?)`, [vehicleId, type]);
    } catch (error) {
        // Una alerta que falla no puede tirar abajo el pipeline de
        // ingesta de telemetría — solo lo logueamos.
        console.error('[maintenanceAlertService] Error mandando alerta:', error.message);
    }
}

module.exports = { sendMaintenanceAlert };
