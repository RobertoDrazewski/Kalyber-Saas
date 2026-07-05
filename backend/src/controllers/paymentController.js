const { MercadoPagoConfig, PreApproval, Payment } = require('mercadopago');
const crypto = require('crypto');
const { Resend } = require('resend');
const pool = require('../config/database');
const { calcQuote } = require('../utils/pricing');

const resend = new Resend(process.env.RESEND_API_KEY);

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
    options: { timeout: 5000 }
});

// ============================================================
// Crear la suscripción (Preapproval)
//
// Cambios respecto a la versión anterior:
// 1. El monto NUNCA sale del body — se recalcula acá con calcQuote()
//    a partir de (plan, vehicleCount), la misma lógica que usa el
//    mail de cotización. Así un usuario no puede mandar
//    "monto_mensual: 0.01" y pagar centavos.
// 2. Guardamos la suscripción en la tabla Subscriptions ANTES de
//    pedirle el link a Mercado Pago, en estado 'pending'. Cuando
//    llegue el webhook la marcamos 'active'. Sin esto, un pago
//    aprobado no dejaba ningún rastro en la base.
// ============================================================
const createSubscription = async (req, res) => {
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error('❌ Falta MP_ACCESS_TOKEN en el .env — Mercado Pago no puede inicializarse.');
        return res.status(500).json({ error: 'Pagos no configurados todavía. Contactanos para coordinar el alta manual.' });
    }

    const { plan, vehicleCount, billingName, billingTaxId, billingEmail, billingPhone } = req.body;

    if (!billingName || !billingEmail) {
        return res.status(400).json({ error: 'Faltan datos de contacto (nombre y email)' });
    }

    let quote;
    try {
        quote = calcQuote(plan, vehicleCount);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
    const { info, qty, discountPct, monthlyTotal } = quote;

    try {
        const preApproval = new PreApproval(client);

        const body = {
            reason: `Suscripción Kalyber — ${info.label} x${qty}`,
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: monthlyTotal,
                currency_id: 'ARS'
            },
            back_url: 'https://kalyber.com.ar/gracias',
            payer_email: billingEmail,
            external_reference: null // lo seteamos después de insertar, ver abajo
        };

        // Insertamos primero en 'pending' para tener el ID interno como
        // external_reference — así el webhook puede encontrar la fila
        // sin depender de emails que pueden repetirse.
        const [insertResult] = await pool.query(
            `INSERT INTO Subscriptions
                (plan, vehicle_count, discount_pct, monthly_total, billing_name, billing_tax_id, billing_email, billing_phone, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [plan, qty, discountPct, monthlyTotal, billingName, billingTaxId || null, billingEmail, billingPhone || null]
        );
        const subscriptionId = insertResult.insertId;

        body.external_reference = String(subscriptionId);
        const suscripcion = await preApproval.create({ body });

        await pool.query(
            `UPDATE Subscriptions SET mp_preapproval_id = ? WHERE id = ?`,
            [suscripcion.id, subscriptionId]
        );

        res.status(200).json({ init_point: suscripcion.init_point });
    } catch (error) {
        console.error('❌ Error creando suscripción en MP:', error);
        res.status(500).json({ error: 'Fallo al generar el link de pago' });
    }
};

// ============================================================
// Webhook de Mercado Pago
//
// Cambios respecto a la versión anterior:
// 1. Verificamos la firma (header x-signature + x-request-id) contra
//    MP_WEBHOOK_SECRET antes de confiar en el body. Sin esto,
//    cualquiera podía pegarle a este endpoint simulando un pago
//    aprobado.
// 2. Actualizamos la fila real en Subscriptions (antes solo hacía
//    console.log y no quedaba ningún registro).
// 3. Mandamos un mail a kalyber@puma-code.com avisando del cobro,
//    igual que el resto de las notificaciones del sistema.
// ============================================================
function verifyMpSignature(req) {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) {
        // Si todavía no configuraste el secret en Railway, no podemos
        // verificar — lo dejamos pasar pero avisamos fuerte en logs.
        console.warn('⚠️  MP_WEBHOOK_SECRET no configurado — el webhook NO está verificando firmas. Configuralo en las notificaciones webhook de tu app en Mercado Pago.');
        return true;
    }

    const signatureHeader = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];
    const dataId = req.query['data.id'] || (req.body && req.body.data && req.body.data.id);

    if (!signatureHeader || !requestId || !dataId) return false;

    // El header viene como "ts=169..., v1=abcdef..."
    const parts = Object.fromEntries(
        signatureHeader.split(',').map(p => p.trim().split('=').map(s => s.trim()))
    );
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    try {
        return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
    } catch {
        return false; // longitudes distintas, etc. -> inválida
    }
}

const webhookMercadoPago = async (req, res) => {
    // MP exige 200 OK inmediato para no reintentar el envío.
    res.status(200).send('OK');

    if (!verifyMpSignature(req)) {
        console.warn('⚠️  Webhook de MP con firma inválida — ignorado.', { headers: req.headers['x-request-id'] });
        return;
    }

    const { type, data } = req.body;

    try {
        if (type === 'payment') {
            const payment = new Payment(client);
            const paymentInfo = await payment.get({ id: data.id });

            if (paymentInfo.status === 'approved') {
                const emailCliente = paymentInfo.payer?.email;
                const monto = paymentInfo.transaction_amount;
                const subscriptionId = paymentInfo.external_reference ? Number(paymentInfo.external_reference) : null;

                console.log(`✅ Pago recurrente aprobado para: ${emailCliente} por $${monto}`);

                if (subscriptionId) {
                    await pool.query(
                        `UPDATE Subscriptions SET status = 'active', last_payment_at = NOW(), last_payment_amount = ? WHERE id = ?`,
                        [monto, subscriptionId]
                    );
                }

                try {
                    await resend.emails.send({
                        from: 'Kalyber Pagos <pagos@kalyber.com.ar>',
                        to: ['kalyber@puma-code.com'],
                        subject: `💳 Pago aprobado — ${emailCliente} ($${monto})`,
                        html: `
                            <h2 style="font-family: sans-serif;">Pago recurrente aprobado</h2>
                            <p style="font-family: sans-serif;"><strong>Cliente:</strong> ${emailCliente || '(sin email)'}</p>
                            <p style="font-family: sans-serif;"><strong>Monto:</strong> $${monto} ARS</p>
                            <p style="font-family: sans-serif;"><strong>ID de suscripción interna:</strong> ${subscriptionId || 'N/A'}</p>
                            <p style="font-family: sans-serif; color:#64748b; font-size:12px;">Recordá emitir la Factura C correspondiente.</p>
                        `
                    });
                } catch (mailErr) {
                    console.error('❌ Pago aprobado pero falló el mail de aviso:', mailErr);
                }
            } else if (['cancelled', 'rejected'].includes(paymentInfo.status)) {
                const subscriptionId = paymentInfo.external_reference ? Number(paymentInfo.external_reference) : null;
                if (subscriptionId) {
                    await pool.query(`UPDATE Subscriptions SET status = ? WHERE id = ?`, [paymentInfo.status, subscriptionId]);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error procesando el Webhook:', error);
    }
};

module.exports = {
    createSubscription,
    webhookMercadoPago
};
