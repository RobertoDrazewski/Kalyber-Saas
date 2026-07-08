// ============================================================
// Entry point INDEPENDIENTE para el servidor de trackers GT06.
// Se deploya como un servicio de Railway separado del backend HTTP
// principal (Kalyber-Saas), así cada uno tiene su propio puerto y
// no se pisan. Comparten la misma base de datos.
//
// Start command en Railway para este servicio: node gt06-standalone.js
// ============================================================
require('dotenv').config();
const { startGt06Server } = require('./src/services/gt06Server');

startGt06Server();
