// ============================================================
// Servidor TCP crudo para los trackers Jimi IoT (JM-VL04 / JM-VL502).
// Escucha en el puerto 9000 (el mismo que configuraste en el TCP
// Proxy de Railway) y habla el protocolo GT06 — el más común en la
// familia Concox/Jimi IoT para este tipo de equipo.
//
// HONESTIDAD TÉCNICA: lo que está acá abajo cubre con confianza alta
// el ENVOLTORIO del protocolo (framing, CRC, login, ACKs) y el
// paquete de posición GPS estándar — eso es prácticamente idéntico
// en toda la familia GT06 y es lo que necesitás para que el equipo
// "salga reportando" mañana (posición + velocidad).
//
// Lo que NO está confirmado todavía es el layout exacto de los
// paquetes EXTENDIDOS de OBD (RPM, temperatura, combustible, DTC)
// que debería mandar el VL502 — eso varía más entre firmwares y no
// lo voy a inventar. Cualquier paquete que no reconozcamos se
// imprime en crudo (hex) en la consola para poder mirarlo juntos
// apenas el equipo esté transmitiendo de verdad, y ahí completamos
// ese parser contra bytes reales en vez de a ciegas.
// ============================================================

const net = require('net');
const pool = require('../config/database');
const telemetryIngestReal = require('./telemetryIngestReal');

const PORT = process.env.GT06_TCP_PORT || 9000;

const START = Buffer.from([0x78, 0x78]);
const STOP = Buffer.from([0x0D, 0x0A]);

const PROTOCOL = {
    LOGIN: 0x01,
    GPS_LOCATION: 0x12,
    STATUS_HEARTBEAT: 0x13,
    GPS_LOCATION_ALT: 0x22,
    ALARM: 0x16,
};

// CRC-16/X-25 (CRC-ITU) — el checksum estándar de GT06.
function crcX25(buffer) {
    let crc = 0xFFFF;
    for (let i = 0; i < buffer.length; i++) {
        crc ^= buffer[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x0001) ? (crc >> 1) ^ 0x8408 : crc >> 1;
        }
    }
    return (~crc) & 0xFFFF;
}

function bcdToImei(bcdBuffer) {
    let digits = '';
    for (const byte of bcdBuffer) {
        digits += ((byte >> 4) & 0x0F).toString();
        digits += (byte & 0x0F).toString();
    }
    if (digits.length === 16 && digits[0] === '0') digits = digits.slice(1);
    return digits;
}

function buildAck(protocolNumber, serialBuffer) {
    const length = 1 + 2 + 2; // protocolo(1) + serial(2) + crc(2), sin contenido
    const beforeCrc = Buffer.concat([Buffer.from([length, protocolNumber]), serialBuffer]);
    const crc = crcX25(beforeCrc);
    const crcBuf = Buffer.alloc(2);
    crcBuf.writeUInt16BE(crc, 0);
    return Buffer.concat([START, beforeCrc, crcBuf, STOP]);
}

// Extrae el primer frame completo del buffer acumulado, si ya llegó
// entero. Devuelve null si hay que esperar más datos.
function extractFrame(buf) {
    const startIdx = buf.indexOf(START);
    if (startIdx === -1) return null;
    if (buf.length < startIdx + 4) return null; // ni siquiera llegó el byte de longitud + protocolo

    const length = buf[startIdx + 2];
    const frameEnd = startIdx + 3 + length + 2; // start(2) + lenByte(1) + length + stop(2)
    if (buf.length < frameEnd) return null;

    return { frame: buf.slice(startIdx, frameEnd), rest: buf.slice(frameEnd) };
}

// Parseo del paquete de posición GPS estándar GT06 (protocolo 0x12/0x22).
// OJO: el signo de latitud/longitud (norte/sur, este/oeste) depende de
// bits del campo "course/status" cuya posición exacta varía un poco
// entre firmwares — dejamos Mendoza (hemisferio sur/oeste) forzado
// como default razonable, y lo confirmamos contra la posición real
// del equipo apenas transmita mañana.
function parseGpsContent(content) {
    if (content.length < 12) return null;

    const year = 2000 + content[0];
    const month = content[1];
    const day = content[2];
    const hour = content[3];
    const minute = content[4];
    const second = content[5];

    const latRaw = content.readUInt32BE(7);
    const lonRaw = content.readUInt32BE(11);
    const lat = (latRaw / 30000 / 60) * -1;  // Mendoza = hemisferio sur → negativo
    const lon = (lonRaw / 30000 / 60) * -1;  // Mendoza = hemisferio oeste → negativo

    const speed = content.length > 15 ? content[15] : 0;

    return {
        recordedAt: new Date(Date.UTC(year, month - 1, day, hour, minute, second)),
        lat, lon, speed_kmh: speed,
    };
}

async function findVehicleIdByImei(imei) {
    const [[device]] = await pool.query(
        `SELECT vehicle_id FROM Devices WHERE imei = ? AND status = 'paired'`,
        [imei]
    );
    return device?.vehicle_id || null;
}

function startGt06Server() {
    const server = net.createServer((socket) => {
        let buffer = Buffer.alloc(0);
        let currentImei = null;
        const remote = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`[GT06] Conexión nueva desde ${remote}`);

        socket.on('data', async (data) => {
            buffer = Buffer.concat([buffer, data]);
            console.log(`[GT06] Datos crudos recibidos de ${remote} (${data.length} bytes): ${data.toString('hex')}`);

            let result;
            while ((result = extractFrame(buffer)) !== null) {
                const { frame, rest } = result;
                buffer = rest;

                const length = frame[2];
                const protocolNumber = frame[3];
                const content = frame.slice(4, 4 + length - 5);
                const serial = frame.slice(4 + length - 5, 4 + length - 5 + 2);

                try {
                    if (protocolNumber === PROTOCOL.LOGIN) {
                        currentImei = bcdToImei(content.slice(0, 8));
                        console.log(`[GT06] Login IMEI=${currentImei} desde ${remote}`);
                        socket.write(buildAck(protocolNumber, serial));
                    } else if (protocolNumber === PROTOCOL.STATUS_HEARTBEAT) {
                        socket.write(buildAck(protocolNumber, serial));
                    } else if (protocolNumber === PROTOCOL.GPS_LOCATION || protocolNumber === PROTOCOL.GPS_LOCATION_ALT) {
                        socket.write(buildAck(protocolNumber, serial));
                        if (!currentImei) {
                            console.warn('[GT06] Paquete GPS sin login previo, se descarta');
                            continue;
                        }
                        const gps = parseGpsContent(content);
                        if (!gps) continue;

                        const vehicleId = await findVehicleIdByImei(currentImei);
                        if (!vehicleId) {
                            console.warn(`[GT06] IMEI ${currentImei} no está pareado a ningún vehículo — se descarta el paquete`);
                            continue;
                        }

                        await telemetryIngestReal.ingestReading(currentImei, {
                            lat: gps.lat,
                            lng: gps.lon,
                            speed_kmh: gps.speed_kmh,
                            engine_rpm: null,
                            engine_load: null,
                            coolant_temp: null,
                            battery_voltage: null,
                            harsh_brake: false,
                        });
                        console.log(`[GT06] Posición IMEI=${currentImei} lat=${gps.lat.toFixed(5)} lng=${gps.lon.toFixed(5)} v=${gps.speed_kmh}km/h`);
                        
                    } else if (protocolNumber === 0x37) {
                        // --- PAQUETE DE TELEMETRÍA EXTENDIDA (OBD) ---
                        socket.write(buildAck(protocolNumber, serial));
                        
                        if (!currentImei) {
                            console.warn('[GT06] Paquete 0x37 (OBD) sin login previo, se descarta');
                            continue;
                        }

                        const vehicleId = await findVehicleIdByImei(currentImei);
                        if (!vehicleId) {
                            console.warn(`[GT06] IMEI ${currentImei} no está pareado a ningún vehículo — se descarta el paquete`);
                            continue;
                        }

                        // Extraer el remanente de datos (Sensores/OBD en crudo)
                        const obdHex = content.slice(6).toString('hex');
                        
                        console.log(`[GT06] OBD IMEI=${currentImei} procesado. Inyectando Hex crudo a BD.`);

                        // Inyectamos el payload hexadecimal en la columna dtc_codes para visualización inmediata en BD
                        await telemetryIngestReal.ingestReading(currentImei, {
                            lat: null, 
                            lng: null,
                            speed_kmh: null,
                            engine_rpm: null,
                            engine_load: null,
                            coolant_temp: null,
                            battery_voltage: null,
                            harsh_brake: false,
                            dtc_codes: `RAW_OBD:${obdHex}`
                        });
                        
                    } else {
                        socket.write(buildAck(protocolNumber, serial));
                        console.log(`[GT06] Paquete no reconocido, protocolo=0x${protocolNumber.toString(16)} contenido=${content.toString('hex')}`);
                    }
                } catch (err) {
                    console.error('[GT06] Error procesando paquete:', err.message);
                }
            }
        });

        socket.on('error', (err) => console.error(`[GT06] Error de socket (${remote}):`, err.message));
        socket.on('close', () => console.log(`[GT06] Conexión cerrada: ${remote} (IMEI=${currentImei || 'desconocido'})`));
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`📡 Servidor GT06 (trackers) escuchando en el puerto ${PORT}`);
    });

    server.on('error', (err) => console.error('❌ Error en servidor GT06:', err.message));

    return server;
}

module.exports = { startGt06Server };