const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { quoteChat } = require('../controllers/quoteChatController');

// Capa 1: control de ráfagas (alguien clickeando/scripteando rápido)
const burstLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 8,
    message: { error: 'Muchos mensajes seguidos. Esperá un momento antes de escribir de nuevo.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Capa 2: control de costo total por IP por día — esto es lo que
// evita que alguien deje corriendo un script toda la noche contra
// la API de Anthropic a costa nuestra.
const dailyLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 40,
    message: { error: 'Alcanzaste el límite de consultas por hoy. Escribinos directo si necesitás más info.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/', burstLimiter, dailyLimiter, quoteChat);

module.exports = router;
