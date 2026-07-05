const express = require('express');
const router = express.Router();
const { createSubscription, webhookMercadoPago } = require('../controllers/paymentController');

// Ruta para que React pida el link de pago
router.post('/subscription', createSubscription);

// Ruta pública para que Mercado Pago envíe los avisos de cobro
router.post('/webhook', webhookMercadoPago);

module.exports = router;