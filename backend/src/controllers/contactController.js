const { Resend } = require('resend');

// Asegúrate de tener RESEND_API_KEY en tu archivo .env
const resend = new Resend(process.env.RESEND_API_KEY);

const sendContactEmail = async (req, res) => {
    const { name, email, message } = req.body;
    try {
        const data = await resend.emails.send({
            // Cambia el "from" por tu dominio verificado en Resend si ya lo tienes, ej: 'contacto@kalyber.com.ar'
            from: 'Kalyber Web <onboarding@resend.dev>', 
            to: ['Kalyber@puma-code.com'],
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
    
    if (!history || !Array.isArray(history)) {
        return res.status(400).json({ error: 'Historial de chat inválido o vacío' });
    }

    try {
        const historyHtml = history.map(msg => 
            `<p style="margin-bottom: 10px;">
                <strong>${msg.role === 'user' ? '👤 Cliente' : '🤖 Asistente (IA)'}:</strong><br/>
                ${msg.content}
            </p>`
        ).join('');

        const data = await resend.emails.send({
            from: 'Kalyber Cotizaciones <onboarding@resend.dev>',
            to: ['Kalyber@puma-code.com'],
            subject: 'Solicitud de Cotización Finalizada (Chat IA)',
            html: `
                <h2>Nueva solicitud de cotización vía Asistente Virtual</h2>
                <p>El cliente ha presionado el botón "Enviar Cotización". A continuación se adjunta el historial de la charla para evaluar la cantidad de móviles y sus necesidades:</p>
                <hr />
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; color: #334155;">
                    ${historyHtml}
                </div>
            `
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Error enviando email de cotización:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = { sendContactEmail, sendQuoteEmail };