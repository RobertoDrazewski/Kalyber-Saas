// ============================================================
// Entry point INDEPENDIENTE para el servidor de trackers GT06.
// Se deploya como un servicio de Railway separado del backend HTTP
// principal (Kalyber-Saas), así cada uno tiene su propio puerto y
// no se pisan. Comparten la misma base de datos.
//
// Start command en Railway para este servicio: node gt06-standalone.js
//
// [NUEVO 13/07/2026] También levanta startInternalCommandApi() — un
// server HTTP chico en un puerto aparte (GT06_INTERNAL_PORT, default
// 9001) para que el servicio de la API (Kalyber-Saas/server.js) le
// pueda pedir a ESTE proceso que mande comandos a los equipos. Ver la
// nota completa en gt06Server.js — sin esto, el envío de comandos
// desde la API nunca encontraba la conexión real del equipo, porque
// cada servicio de Railway corre como un proceso de Node separado.
//
// Configurar en las env vars de ESTE servicio (gt06-standalone):
//   GT06_INTERNAL_PORT=9001 (o el que prefieras)
//   GT06_INTERNAL_SECRET=<algo random, para que no cualquiera en la
//     red interna de Railway pueda mandarle comandos a los equipos>
//
// Y en las env vars del servicio de la API (Kalyber-Saas):
//   GT06_INTERNAL_URL=http://<nombre-de-este-servicio>.railway.internal:9001
//   GT06_INTERNAL_SECRET=<el mismo valor de arriba>
// (el nombre exacto del host privado depende de cómo se llame este
// servicio en tu proyecto de Railway — Settings → Networking →
// Private Networking te muestra el dominio interno real).
// ============================================================
require('dotenv').config();
const { startGt06Server, startInternalCommandApi } = require('./src/services/gt06Server');

startGt06Server();
startInternalCommandApi();