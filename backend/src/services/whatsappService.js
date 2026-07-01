// ============================================================
// Notificaciones por WhatsApp — stub.
// Nota: este archivo tenía pegado por error un componente React
// (HeroMendoza) que no correspondía a un servicio de backend.
// Se limpió. Cuando haya proveedor elegido (ej. Twilio, WhatsApp
// Cloud API), completar sendAlert() con la llamada real.
// ============================================================

async function sendAlert(phoneNumber, message) {
    console.log(`[whatsappService] (stub) Enviaría a ${phoneNumber}: ${message}`);
    return { sent: false, reason: 'Proveedor de WhatsApp no configurado todavía' };
}

module.exports = { sendAlert };
