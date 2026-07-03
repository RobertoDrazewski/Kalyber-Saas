const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { quoteChat, sendQuoteEmail } = require('../controllers/quoteChatController');

// Capa 1: control de ráfagas (alguien clickeando/scripteando rápido)
const burstLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10, // Un poco más alto por si mandan mail rápido
    message: { error: 'Muchos mensajes seguidos. Esperá un momento antes de escribir de nuevo.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Capa 2: control de costo total por IP por día
const dailyLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 40,
    message: { error: 'Alcanzaste el límite de consultas por hoy. Escribinos directo si necesitás más info.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/', burstLimiter, dailyLimiter, quoteChat);

// Nueva ruta para el envío de mail de cotización
router.post('/send-email', burstLimiter, sendQuoteEmail);

module.exports = router;