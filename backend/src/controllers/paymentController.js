const { MercadoPagoConfig, PreApproval, Payment } = require('mercadopago');

// Inicializar el cliente de Mercado Pago con el token del .env
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN, 
    options: { timeout: 5000 } 
});

// Crear la suscripción (Preapproval)
const createSubscription = async (req, res) => {
    try {
        const { email_cliente, titulo_plan, monto_mensual } = req.body;

        const preApproval = new PreApproval(client);

        const body = {
            reason: titulo_plan || "Suscripción Kalyber",
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                // FIX: Forzamos un número limpio con máximo 2 decimales para evitar el error 500 de la API
                transaction_amount: Number(Number(monto_mensual).toFixed(2)), 
                currency_id: "ARS" 
            },
            // URL a la que vuelve el usuario tras asociar la tarjeta
            back_url: "https://kalyber.com.ar/gracias", 
            payer_email: email_cliente,
            status: "pending"
        };

        const suscripcion = await preApproval.create({ body });

        // Devolvemos el link al frontend para que el usuario pague
        res.status(200).json({ init_point: suscripcion.init_point });

    } catch (error) {
        console.error("❌ Error creando suscripción en MP:", error);
        res.status(500).json({ error: "Fallo al generar el link de pago" });
    }
};

// Webhook para recibir la confirmación de pago
const webhookMercadoPago = async (req, res) => {
    // 1. MP exige que respondamos 200 OK de inmediato para no reintentar el envío
    res.status(200).send('OK');

    const { type, data } = req.body;

    try {
        // Solo nos interesan los eventos de pago
        if (type === 'payment') {
            const payment = new Payment(client);
            // Buscamos los detalles reales del pago usando el ID que nos mandaron
            const paymentInfo = await payment.get({ id: data.id });

            if (paymentInfo.status === 'approved') {
                const emailCliente = paymentInfo.payer.email;
                const monto = paymentInfo.transaction_amount;
                
                console.log(`✅ Pago recurrente aprobado para: ${emailCliente} por $${monto}`);

                // ====================================================================
                // ACÁ INSERTÁS TU LÓGICA DE EMAIL
                // Importá tu servicio de correos y ejecutalo aquí. 
                // Ejemplo: enviarCotizacionEmail(emailCliente, carritoData, "PAGADO");
                // ====================================================================
            }
        }
    } catch (error) {
        console.error("❌ Error procesando el Webhook:", error);
    }
};

module.exports = {
    createSubscription,
    webhookMercadoPago
};