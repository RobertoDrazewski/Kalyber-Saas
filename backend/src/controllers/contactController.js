const { Resend } = require('resend');

// Asegúrate de tener RESEND_API_KEY en tu archivo .env
const resend = new Resend(process.env.RESEND_API_KEY);

const sendContactEmail = async (req, res) => {
    const { name, email, message } = req.body;
    try {
        const data = await resend.emails.send({
            // El remitente inventado bajo tu dominio verificado
            from: 'Kalyber Web <contacto@kalyber.com.ar>', 
            // A dónde te llega la notificación
            to: ['kalyber@puma-code.com'],
            // Si le das a "Responder" en tu Gmail, le responderás al cliente
            reply_to: email, 
            subject: `Nuevo mensaje de contacto de ${name}`,
            html: `
                <h2>Nuevo mensaje desde la web de Kalyber</h2>
                <p><strong>Nombre / Empresa:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Mensaje:</strong><br/>${message}</p>
            `
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error enviando email de contacto:", error);
        res.status(500).json({ error: error.message });
    }
};

const sendQuoteEmail = async (req, res) => {
    const { history } = req.body;
    
    if (!history || !Array.isArray(history) || history.length === 0) {
        return res.status(400).json({ error: 'El historial está vacío o es inválido' });
    }

    try {
        const historyHtml = history.map(msg => 
            `<p style="margin-bottom: 12px; font-family: sans-serif;">
                <strong style="color: ${msg.role === 'user' ? '#4F46E5' : '#475569'};">
                    ${msg.role === 'user' ? '👤 Cliente' : '🤖 Asistente (IA)'}:
                </strong><br/>
                ${msg.content}
            </p>`
        ).join('');

        const data = await resend.emails.send({
            // El remitente inventado para el bot
            from: 'Kalyber IA <cotizaciones@kalyber.com.ar>', 
            to: ['kalyber@puma-code.com'],
            subject: 'Nueva Solicitud de Cotización (Chat IA)',
            html: `
                <h2 style="font-family: sans-serif; color: #1E293B;">El cliente ha solicitado una cotización</h2>
                <p style="font-family: sans-serif; color: #475569;">A continuación se detalla la conversación con la IA para evaluar sus necesidades:</p>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    ${historyHtml}
                </div>
            `
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("[sendQuoteEmail] error:", error);
        res.status(500).json({ error: 'No se pudo enviar el correo de cotización.' });
    }
};

const PLAN_INFO = {
    basico: { label: 'Plan Básico (JM-VL04)', monthly: 30, hardware: 110 },
    avanzado: { label: 'Plan Avanzado (JM-VL502)', monthly: 60, hardware: 130 },
};

// Recalculamos el descuento y los totales server-side — nunca
// confiamos en los números que manda el navegador, el cliente podría
// mandar cualquier cosa (ej. "descuento: 90%") y no nos damos cuenta.
function calcDiscount(vehicleCount) {
    if (vehicleCount >= 50) return 20;
    if (vehicleCount >= 10) return 10;
    return 0;
}

const sendCartQuote = async (req, res) => {
    const { plan, vehicleCount, billingName, billingTaxId, billingEmail, billingPhone } = req.body;

    if (!PLAN_INFO[plan]) {
        return res.status(400).json({ error: 'Plan inválido' });
    }
    const qty = parseInt(vehicleCount, 10);
    if (!qty || qty < 1 || qty > 10000) {
        return res.status(400).json({ error: 'Cantidad de vehículos inválida' });
    }
    if (!billingName || !billingEmail) {
        return res.status(400).json({ error: 'Faltan datos de contacto (nombre y email)' });
    }

    const info = PLAN_INFO[plan];
    const discountPct = calcDiscount(qty);
    const monthlyTotal = (info.monthly * qty * (1 - discountPct / 100)).toFixed(2);
    const hardwareTotal = (info.hardware * qty).toFixed(2);

    try {
        const data = await resend.emails.send({
            from: 'Kalyber Carrito <cotizaciones@kalyber.com.ar>',
            to: ['kalyber@puma-code.com'],
            reply_to: billingEmail,
            subject: `Nueva cotización de carrito — ${info.label} x${qty} (${billingName})`,
            html: `
                <h2 style="font-family: sans-serif; color: #1E293B;">Nueva solicitud desde el carrito de Kalyber</h2>
                <table style="font-family: sans-serif; color: #334155; border-collapse: collapse;">
                    <tr><td style="padding:4px 12px 4px 0;"><strong>Plan</strong></td><td>${info.label}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;"><strong>Cantidad de vehículos</strong></td><td>${qty}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;"><strong>Descuento aplicado</strong></td><td>${discountPct}%</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;"><strong>Total hardware (único pago)</strong></td><td>USD ${hardwareTotal}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;"><strong>Total mensual</strong></td><td>USD ${monthlyTotal}/mes</td></tr>
                </table>
                <hr style="margin:16px 0;">
                <p style="font-family: sans-serif;"><strong>Nombre / Empresa:</strong> ${billingName}</p>
                <p style="font-family: sans-serif;"><strong>CUIT/DNI:</strong> ${billingTaxId || '(no informado)'}</p>
                <p style="font-family: sans-serif;"><strong>Email:</strong> ${billingEmail}</p>
                <p style="font-family: sans-serif;"><strong>Teléfono:</strong> ${billingPhone || '(no informado)'}</p>
                <p style="font-family: sans-serif; color: #64748b; font-size: 12px; margin-top: 16px;">
                    Todavía no se procesó ningún pago — esto es una solicitud de cotización desde el carrito, pendiente de que se contacte para coordinar el pago recurrente.
                </p>
            `
        });
        res.status(200).json({
            success: true, data,
            summary: { plan: info.label, qty, discountPct, monthlyTotal, hardwareTotal }
        });
    } catch (error) {
        console.error('[sendCartQuote] error:', error);
        res.status(500).json({ error: 'No se pudo enviar la cotización.' });
    }
};

module.exports = { sendContactEmail, sendQuoteEmail, sendCartQuote };