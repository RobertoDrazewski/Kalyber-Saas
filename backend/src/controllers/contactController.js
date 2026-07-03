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

module.exports = { sendContactEmail, sendQuoteEmail };