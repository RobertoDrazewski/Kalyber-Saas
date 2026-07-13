// ============================================================
// Servidor TCP crudo para los trackers Jimi IoT (JM-VL04 / JM-VL502).
// Escucha en el puerto que apunta el TCP Proxy de Railway y habla el
// protocolo GT06 — el más común en la familia Concox/Jimi IoT.
//
// ESTADO CONFIRMADO (10/07/2026, contra bytes reales del IMEI
// 861652050142625, equipo VL502 en un Renault Kangoo en Maipú):
//
//   ✅ Login (0x01) — extracción de IMEI, funcionando.
//   ✅ Heartbeat (0x13) — se ACKea, no trae datos usables.
//   ✅ Posición GPS (0x37 y 0x26) — CONFIRMADA. Los dos protocolos
//      comparten el mismo bloque de posición: fecha en offset 0-4,
//      lat en offset 7 (4 bytes BE, /30000/60), lon en offset 11
//      (igual), velocidad en offset 15. El 0x26 es una versión
//      liviana del mismo bloque, más frecuente, sin el resto de la
//      cola; el 0x37 le agrega ~32 bytes más después.
//   ✅ Offset 16-17 del 0x37/0x26 — es el campo estándar GT06 de
//      "curso + banderas de estado" (rumbo 0-360° en los 10 bits
//      bajos). Confirmado por eliminación al descartarlo como RPM.
//
//   ❌ RPM/temperatura/combustible/batería del motor — NO
//      confirmado. Se probó exhaustivamente contra dos lecturas
//      reales de RPM (900 y 2100) tomadas con 1 minuto de diferencia
//      y NINGÚN byte de la cola se mueve de forma proporcional a ese
//      cambio. Los "candidatos" que parecían prometedores resultaron
//      ser: el bloque de antena celular (MCC/LAC, constante siempre)
//      o un contador que sube solo, sin relación con el motor.
//      Conclusión: el 0x37, tal como lo manda este equipo/firmware,
//      probablemente NO incluye los PIDs de OBD todavía — puede
//      hacer falta un comando aparte para activarlos (consultar a
//      Conecty/Jimi IoT), o vienen en un tipo de paquete que todavía
//      no vimos pasar. El resto de la cola queda logueado crudo
//      (RAW_OBD:...) para seguir mirando si aparece algo nuevo, pero
//      ya NO se le atribuye ningún significado — antes de este
//      análisis se guardaba con ese nombre asumiendo que eran datos
//      de motor, y no está confirmado que lo sean.
// ============================================================

const net = require('net');
const pool = require('../config/database');
const telemetryIngestReal = require('./telemetryIngestReal');
const jt808 = require('./jt808Handler');

const PORT = process.env.GT06_TCP_PORT || 9000;

const START = Buffer.from([0x78, 0x78]);
const STOP = Buffer.from([0x0D, 0x0A]);
const START_LONG = Buffer.from([0x79, 0x79]); // formato "trama larga" — length de 2 bytes en vez de 1

const PROTOCOL = {
    LOGIN: 0x01,
    GPS_LOCATION: 0x12,
    STATUS_HEARTBEAT: 0x13,
    GPS_LOCATION_ALT: 0x22,
    ALARM: 0x16,
    GPS_LBS_EXTENDED: 0x37, // = MSG_GPS_LBS_3 en la nomenclatura de Traccar: GPS + antena celular, SIN datos de motor
    GPS_COMBO_LIGHT: 0x26, // versión liviana del mismo bloque de posición, más frecuente
};

// Bloque de posición estándar GT06, confirmado contra bytes reales del
// VL502: fecha en offset 0-4, lat en offset 7 (4 bytes BE), lon en
// offset 11 (4 bytes BE), velocidad en offset 15. Lo usan tanto el
// 0x37 (combinado con OBD) como el 0x26 (versión liviana, sin OBD).
function parseComboGpsBlock(content) {
    if (content.length < 18) return null;
    const latRaw = content.readUInt32BE(7);
    const lonRaw = content.readUInt32BE(11);
    
    // Offset 16-17 del 0x37/0x26 — es el campo estándar GT06 de "curso + banderas de estado" (rumbo 0-360° en los 10 bits bajos)
    const courseStatusInt = content.readUInt16BE(16);
    const course = courseStatusInt & 0x03FF;
    
    return {
        lat: -(latRaw / 30000 / 60),  // Mendoza = hemisferio sur
        lon: -(lonRaw / 30000 / 60),  // Mendoza = hemisferio oeste
        speed_kmh: content[15] ?? 0,
        course: course,
    };
}

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

// Trama LARGA (0x7979) — mismo esquema pero con 2 bytes de longitud
// en vez de 1. Es donde viaja, entre otras cosas, la configuración
// de geocercas en texto legible (protocolo 0x94).
function extractLongFrame(buf) {
    const startIdx = buf.indexOf(START_LONG);
    if (startIdx === -1) return null;
    if (buf.length < startIdx + 5) return null;

    const length = buf.readUInt16BE(startIdx + 2);
    const frameEnd = startIdx + 4 + length + 2; // start(2) + lenBytes(2) + length + stop(2)
    if (buf.length < frameEnd) return null;

    return { frame: buf.slice(startIdx, frameEnd), rest: buf.slice(frameEnd), isLong: true };
}

// Busca el frame (corto o largo) que empiece más cerca del principio
// del buffer, para no perderse ninguno cuando vienen mezclados.
function extractAnyFrame(buf) {
    const shortIdx = buf.indexOf(START);
    const longIdx = buf.indexOf(START_LONG);
    if (shortIdx === -1 && longIdx === -1) return null;
    if (longIdx === -1 || (shortIdx !== -1 && shortIdx <= longIdx)) {
        return extractFrame(buf);
    }
    return extractLongFrame(buf);
}

// Parseo del paquete de posición GPS estándar GT06 (protocolo 0x12/0x22).
// OJO: el signo de latitud/longitud (norte/sur, este/oeste) depende de
// bits del campo "course/status" cuya posición exacta varía un poco
// entre firmwares — dejamos Mendoza (hemisferio sur/oeste) forzado
// como default razonable, y lo confirmamos contra la posición real
// del equipo apenas transmita mañana.
function parseGpsContent(content) {
    if (content.length < 18) return null;

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
    
    // Offset 16-17 del paquete estándar GT06
    const courseStatusInt = content.readUInt16BE(16);
    const course = courseStatusInt & 0x03FF;

    return {
        recordedAt: new Date(Date.UTC(year, month - 1, day, hour, minute, second)),
        lat, lon, speed_kmh: speed, course: course
    };
}

async function findVehicleIdByImei(imei) {
    const [[device]] = await pool.query(
        `SELECT vehicle_id FROM Devices WHERE imei = ? AND status = 'paired'`,
        [imei]
    );
    return device?.vehicle_id || null;
}

// Id de la tabla Devices — útil en los logs para cruzar rápido contra
// lo que se ve en Equipos GPS, sin tener que buscar por IMEI a mano.
async function findDeviceIdByImei(imei) {
    const [[device]] = await pool.query('SELECT id FROM Devices WHERE imei = ?', [imei]);
    return device?.id ?? null;
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

            // ---- JT808 (equipos VL502/"Avanzado") — protocolo distinto,
            // delimitado por 0x7e en vez de 0x7878/0x7979. Se procesa
            // aparte, antes del loop de GT06 existente.
            let jt808Result;
            while ((jt808Result = jt808.extractJT808Frame(buffer)) !== null) {
                buffer = jt808Result.rest;
                try {
                    const header = jt808.parseHeader(jt808Result.unescaped);
                    const terminalIdHex = header.terminalId.toString('hex');

                    if (header.msgId === jt808.MSG_ID.TERMINAL_REGISTER) {
                        const imeiPrefixLog = jt808.terminalIdToImeiPrefix(header.terminalId);
                        const [[deviceLog]] = await pool.query('SELECT id FROM Devices WHERE imei LIKE ?', [`${imeiPrefixLog}%`]);
                        console.log(`[JT808] Registro de terminal, ID crudo=${terminalIdHex} (id=${deviceLog?.id ?? 'no encontrado en Devices'}) desde ${remote}`);
                        socket.write(jt808.buildRegisterResponse(header.terminalId, 1, header.serialNo));
                        console.log(`[JT808] Respondido 0x8100 (registro OK)`);

                    } else if (header.msgId === jt808.MSG_ID.TERMINAL_AUTH || header.msgId === jt808.MSG_ID.TERMINAL_HEARTBEAT) {
                        socket.write(jt808.buildGeneralResponse(header.terminalId, 1, header.msgId, header.serialNo));
                        console.log(`[JT808] ${header.msgId === jt808.MSG_ID.TERMINAL_AUTH ? 'Autenticación' : 'Heartbeat'} confirmado, ID=${terminalIdHex}`);

                    } else if (header.msgId === jt808.MSG_ID.LOCATION_REPORT) {
                        socket.write(jt808.buildGeneralResponse(header.terminalId, 1, header.msgId, header.serialNo));
                        const loc = jt808.parseLocationReport(header.body);
                        if (loc) {
                            console.log(`[JT808] Posición ID=${terminalIdHex} lat=${loc.lat} lon=${loc.lon} v=${loc.speedKmh}km/h rumbo=${loc.direction}° ACC=${loc.accOn ? 'ON' : 'OFF'} km=${loc.mileageKm} combustible=${loc.fuelLiters}L`);
                            if (loc.sinIdentificar.length) {
                                console.log(`[JT808] Info adicional sin identificar: ${loc.sinIdentificar.join(' | ')}`);
                            }

                            // El ID de terminal = IMEI real sin el último dígito
                            // (confirmado). Buscamos el equipo con LIKE para no
                            // tener que reconstruir el dígito verificador, pero
                            // le pasamos a ingestReading el IMEI REAL completo
                            // que encontramos en la base (no el prefijo), para
                            // no tocar la firma de esa función.
                            const imeiPrefix = jt808.terminalIdToImeiPrefix(header.terminalId);
                            const [[device]] = await pool.query(
                                `SELECT imei, vehicle_id FROM Devices WHERE imei LIKE ? AND status = 'paired'`,
                                [`${imeiPrefix}%`]
                            );
                            if (!device) {
                                console.warn(`[JT808] No se encontró ningún equipo pareado con IMEI que empiece con ${imeiPrefix}`);
                            } else {
                                await telemetryIngestReal.ingestReading(device.imei, {
                                    lat: loc.lat,
                                    lng: loc.lon,
                                    speed_kmh: loc.speedKmh,
                                    heading: loc.direction,
                                    engine_rpm: null,
                                    engine_load: null,
                                    coolant_temp: null,
                                    battery_voltage: null,
                                    harsh_brake: false,
                                    dtc_codes: loc.sinIdentificar.length ? `JT808_TLV:${loc.sinIdentificar.join('|')}` : null,
                                });
                            }
                        }
                    } else if (header.msgId === 0x0900) {
                        // "Transmisión transparente de datos" — el primer
                        // byte del cuerpo indica el SUB-TIPO de mensaje
                        // (confirmado por el manual oficial del fabricante):
                        //   0x03 = alarmas / comportamiento de manejo
                        //          (frenada brusca, colisión, geocerca, etc.)
                        //   0xf0 = reporte periódico normal (RPM, temp, etc.)
                        socket.write(jt808.buildGeneralResponse(header.terminalId, 1, header.msgId, header.serialNo));

                        const subType = header.body[0];
                        const imeiPrefixTransparente = jt808.terminalIdToImeiPrefix(header.terminalId);
                        const [[deviceTransparente]] = await pool.query(
                            `SELECT imei, vehicle_id FROM Devices WHERE imei LIKE ? AND status = 'paired'`,
                            [`${imeiPrefixTransparente}%`]
                        );

                        if (!deviceTransparente) {
                            console.warn(`[JT808] 0x0900: no se encontró ningún equipo pareado con IMEI que empiece con ${imeiPrefixTransparente}`);

                        } else if (subType === 0x03) {
                            // Alarma / comportamiento de manejo — ACÁ vive
                            // la frenada brusca (ID 0x1B), confirmado por el
                            // manual oficial del fabricante.
                            const alarmData = jt808.parseAlarmData(header.body);
                            for (const alarm of alarmData.alarms) {
                                console.log(`[JT808] 🚨 ALARMA equipo=${deviceTransparente.imei}: ${alarm.label} (id=0x${alarm.id.toString(16)}) ${alarm.desc || ''}`);
                                const isHarshBrake = alarm.id === 0x1B;
                                await telemetryIngestReal.ingestReading(deviceTransparente.imei, {
                                    lat: alarmData.lat, lng: alarmData.lon,
                                    speed_kmh: null, heading: null,
                                    engine_rpm: null, engine_load: null, coolant_temp: null, battery_voltage: null,
                                    harsh_brake: isHarshBrake,
                                    dtc_codes: `ALARM:${alarm.label}`,
                                });
                            }

                        } else {
                            // Reporte periódico normal (0xf0 y similares)
                            const parsed = jt808.parseTransparentTlv(header.body);

                            if (parsed.vin) {
                                await pool.query('UPDATE Vehicles SET vin = ? WHERE id = ? AND (vin IS NULL OR vin != ?)', [parsed.vin, deviceTransparente.vehicle_id, parsed.vin]);
                                console.log(`[JT808] VIN confirmado equipo=${deviceTransparente.imei}: ${parsed.vin}`);
                            }

                            if (parsed.rpm !== null || parsed.fuel_level !== null) {
                                await telemetryIngestReal.ingestReading(deviceTransparente.imei, {
                                    lat: null, lng: null, speed_kmh: null, heading: null,
                                    engine_rpm: parsed.rpm,
                                    engine_load: parsed.engine_load,
                                    coolant_temp: parsed.coolant_temp,
                                    battery_voltage: parsed.battery_voltage,
                                    fuel_level: parsed.fuel_level,
                                    harsh_brake: false,
                                });
                                console.log(`[JT808] OBD Data equipo=${deviceTransparente.imei}: RPM=${parsed.rpm} temp=${parsed.coolant_temp}°C bat=${parsed.battery_voltage}V carga=${parsed.engine_load}% combustible=${parsed.fuel_level}% freno=${parsed.brake_pedal} acelerador=${parsed.accelerator_pedal}%`);
                            }
                        }

                    } else {
                        console.log(`[JT808] Mensaje no manejado todavía, ID=0x${header.msgId.toString(16)} ID_terminal=${terminalIdHex} body=${header.body.toString('hex')}`);
                    }
                } catch (err) {
                    console.error('[JT808] Error procesando trama:', err.message);
                }
            }

            let result;
            while ((result = extractAnyFrame(buffer)) !== null) {
                const { frame, rest, isLong } = result;
                buffer = rest;

                if (isLong) {
                    // Trama larga (0x7979) — length de 2 bytes, protocolo en
                    // offset 4, contenido desde offset 5. Acá viaja, entre
                    // otras cosas, la config de geocercas en texto (0x94).
                    // No le mandamos ACK: el equipo sigue funcionando bien
                    // sin uno, y no está confirmado el formato de ACK para
                    // este tipo de trama — mejor no inventarlo.
                    const longLength = frame.readUInt16BE(2);
                    const longProtocol = frame[4];
                    const longContent = frame.slice(5, longLength);
                    const asAscii = longContent.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
                    console.log(`[GT06] Trama larga IMEI=${currentImei || '?'} protocolo=0x${longProtocol.toString(16)} contenido_hex=${longContent.toString('hex')} contenido_ascii=${asAscii}`);
                    continue;
                }

                const length = frame[2];
                const protocolNumber = frame[3];
                const content = frame.slice(4, 4 + length - 5);
                const serial = frame.slice(4 + length - 5, 4 + length - 5 + 2);

                try {
                    if (protocolNumber === PROTOCOL.LOGIN) {
                        currentImei = bcdToImei(content.slice(0, 8));
                        const deviceId = await findDeviceIdByImei(currentImei);
                        console.log(`[GT06] Login IMEI=${currentImei} (id=${deviceId ?? 'no encontrado en Devices'}) desde ${remote}`);
                        socket.write(buildAck(protocolNumber, serial));
                    } else if (protocolNumber === PROTOCOL.STATUS_HEARTBEAT) {
                        socket.write(buildAck(protocolNumber, serial));
                        
                        // Extraemos el bit de ACC del primer byte del Heartbeat.
                        // OJO: revisando fuentes externas (Traccar, la plataforma
                        // open source), encontré que esto NO está 100% estandarizado
                        // entre variantes de firmware — hay documentación real que
                        // dice que es el bit 1, y otra que dice que es el bit 7. Por
                        // eso logueamos el byte crudo en hex al lado de la
                        // interpretación: comparando estos logs contra encendidas/
                        // apagadas reales del motor, confirmamos cuál es la correcta
                        // para ESTE equipo puntual, en vez de asumir.
                        if (content.length >= 1 && currentImei) {
                            const terminalInfo = content[0];
                            const accBit1 = ((terminalInfo & 0x02) >> 1) === 1;
                            const accBit7 = ((terminalInfo & 0x80) >> 7) === 1;
                            console.log(`[GT06] Heartbeat IMEI=${currentImei} - byte crudo=0x${terminalInfo.toString(16).padStart(2, '0')} - hipótesis bit1(ACC)=${accBit1 ? 'ENCENDIDO' : 'APAGADO'} - hipótesis bit7=${accBit7 ? 'ENCENDIDO' : 'APAGADO'}`);
                        }
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
                            heading: gps.course,
                            engine_rpm: null,
                            engine_load: null,
                            coolant_temp: null,
                            battery_voltage: null,
                            harsh_brake: false,
                        });
                        console.log(`[GT06] Posición IMEI=${currentImei} lat=${gps.lat.toFixed(5)} lng=${gps.lon.toFixed(5)} v=${gps.speed_kmh}km/h heading=${gps.course}°`);
                        
                    } else if (protocolNumber === PROTOCOL.GPS_LBS_EXTENDED) {
                        // --- GPS + LBS extendido (0x37 = MSG_GPS_LBS_3 en Traccar).
                        // Confirmado con fuente externa (decoder open-source de Traccar,
                        // usado en producción por miles de instalaciones reales): este
                        // protocolo NO es un paquete de motor/OBD — es GPS combinado con
                        // datos de la antena celular (torre, señal). Nunca iba a traer
                        // RPM/temperatura/combustible, por eso nunca los encontramos. ---
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

                        const gps = parseComboGpsBlock(content);

                        // El resto de los bytes (después del bloque de posición) NO
                        // están identificados todavía — se probó exhaustivamente
                        // contra 900 y 2100 RPM reales y ningún campo coincidió, así
                        // que NO es seguro asumir que esto es "OBD". Se guarda crudo
                        // por si sirve para seguir investigando, sin atribuirle
                        // significado.
                        const tailHex = content.length > 16 ? content.slice(16).toString('hex') : null;

                        await telemetryIngestReal.ingestReading(currentImei, {
                            lat: gps?.lat ?? null,
                            lng: gps?.lon ?? null,
                            speed_kmh: gps?.speed_kmh ?? null,
                            heading: gps?.course ?? null,
                            engine_rpm: null,
                            engine_load: null,
                            coolant_temp: null,
                            battery_voltage: null,
                            harsh_brake: false,
                            dtc_codes: tailHex ? `RAW_TAIL:${tailHex}` : null
                        });

                        if (gps) {
                            console.log(`[GT06] Posición (0x37) IMEI=${currentImei} lat=${gps.lat.toFixed(5)} lng=${gps.lon.toFixed(5)} v=${gps.speed_kmh}km/h heading=${gps.course}°`);
                        } else {
                            console.log(`[GT06] Paquete 0x37 IMEI=${currentImei} procesado sin bloque de posición (paquete corto).`);
                        }

                    } else if (protocolNumber === PROTOCOL.GPS_COMBO_LIGHT) {
                        // --- Versión liviana del mismo bloque de posición, sin OBD
                        // (confirmado 10/07/2026 — mismo offset que el 0x37) ---
                        socket.write(buildAck(protocolNumber, serial));

                        if (!currentImei) {
                            console.warn('[GT06] Paquete 0x26 sin login previo, se descarta');
                            continue;
                        }

                        const vehicleId = await findVehicleIdByImei(currentImei);
                        if (!vehicleId) {
                            console.warn(`[GT06] IMEI ${currentImei} no está pareado a ningún vehículo — se descarta el paquete`);
                            continue;
                        }

                        const gps = parseComboGpsBlock(content);
                        if (gps) {
                            await telemetryIngestReal.ingestReading(currentImei, {
                                lat: gps.lat,
                                lng: gps.lon,
                                speed_kmh: gps.speed_kmh,
                                heading: gps.course,
                                engine_rpm: null,
                                engine_load: null,
                                coolant_temp: null,
                                battery_voltage: null,
                                harsh_brake: false,
                            });
                            console.log(`[GT06] Posición (0x26) IMEI=${currentImei} lat=${gps.lat.toFixed(5)} lng=${gps.lon.toFixed(5)} v=${gps.speed_kmh}km/h heading=${gps.course}°`);
                        }

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