// ============================================================
// Entry point INDEPENDIENTE para el servidor de trackers GT06/JT808.
// Se deploya como un servicio de Railway separado del backend HTTP
// principal (Kalyber-Saas), así cada uno tiene su propio puerto y
// no se pisan. Comparten la misma base de datos.
//
// Start command en Railway para este servicio: node gt06-standalone.js
//
// [ACTUALIZADO 16/07/2026] Separación real de puertos por modelo de
// equipo, para poder probar en serio con un controlador y un equipo
// por vehículo:
//
//   GT06_TCP_PORT_VL04  (default 9000) — SOLO equipos VL04 (ej: Kangoo
//                        AE376ZB). Protocolo GT06 (tramas 0x7878/0x7979).
//   GT06_TCP_PORT_VL502 (default 9002) — SOLO equipos VL502 (ej: Hilux
//                        FTQ210). Protocolo JT808 (tramas 0x7e).
//
// OJO — NO usar el puerto 9001 para ninguno de los dos: ya está tomado
// por la API interna de comandos (ver GT06_INTERNAL_PORT abajo). Si un
// TCP Proxy de Railway apunta por error a 9001, la API interna deja de
// levantar y el envío de comandos desde el panel (TabComandos) se
// rompe en silencio.
//
// Internamente los dos usan EL MISMO parser (gt06Server.js detecta el
// protocolo por el byte de arranque de cada trama, no por el puerto),
// así que no hay dos implementaciones separadas que mantener — separar
// el puerto es una capa extra de orden/aislamiento para testing, no un
// cambio de lógica de parseo.
//
// [13/07/2026] También levanta startInternalCommandApi() — un server
// HTTP chico en un puerto aparte (GT06_INTERNAL_PORT, default 9001)
// para que el servicio de la API (Kalyber-Saas/server.js) le pueda
// pedir a ESTE proceso que mande comandos a los equipos. Ver la nota
// completa en gt06Server.js — sin esto, el envío de comandos desde la
// API nunca encontraba la conexión real del equipo, porque cada
// servicio de Railway corre como un proceso de Node separado.
//
// Configurar en las env vars de ESTE servicio (gt06-standalone):
//   GT06_TCP_PORT_VL04=9000
//   GT06_TCP_PORT_VL502=9002
//   GT06_INTERNAL_PORT=9001 (o el que prefieras, pero NO 9000 ni 9002)
//   GT06_INTERNAL_SECRET=<algo random, para que no cualquiera en la
//     red interna de Railway pueda mandarle comandos a los equipos>
//
// Y en las env vars del servicio de la API (Kalyber-Saas):
//   GT06_INTERNAL_URL=http://<nombre-de-este-servicio>.railway.internal:9001
//   GT06_INTERNAL_SECRET=<el mismo valor de arriba>
// (el nombre exacto del host privado depende de cómo se llame este
// servicio en tu proyecto de Railway — Settings → Networking →
// Private Networking te muestra el dominio interno real).
//
// En Railway (Settings → Networking → TCP Proxy) necesitás DOS TCP
// Proxies para este servicio, uno apuntando al puerto interno 9000 y
// otro al puerto interno 9002 — cada uno te va a dar un host:puerto
// PÚBLICO distinto (ej: containers-us-west-123.railway.app:41234).
// Ese host:puerto público es el que se configura en cada equipo por
// SMS (*SETSERVER para VL502, SERVER,1,... para VL04) — NO el puerto
// interno 9000/9002 directamente, salvo que uses Railway con IP fija.
// ============================================================
require('dotenv').config();
const { startGt06Server, startInternalCommandApi } = require('./src/services/gt06Server');

const VL04_PORT = process.env.GT06_TCP_PORT_VL04 || process.env.GT06_TCP_PORT || 9000;
const VL502_PORT = process.env.GT06_TCP_PORT_VL502 || 9002;

startGt06Server(VL04_PORT, { label: 'VL04', expectedProto: 'gt06' });
startGt06Server(VL502_PORT, { label: 'VL502', expectedProto: 'jt808' });
startInternalCommandApi();