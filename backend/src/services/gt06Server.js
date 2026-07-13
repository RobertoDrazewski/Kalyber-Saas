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
//
// ACTUALIZACIÓN (13/07/2026): apareció el manual oficial Concox de
// esta familia de equipos (protocolo compartido con el VL04). Confirma
// que el paquete 0x26 (y su variante multi-geocerca 0x27) NO es solo
// "posición liviana" como se había asumido — es el paquete de ALARMA:
// mismo bloque de posición (offsets 0-17, sin cambios) + LBS + info de
// terminal + un código de alarma de 1 byte (frenada brusca, aceleración
// brusca, giro brusco, colisión, SOS, geocerca, remolque/robo, tamper,
// puerta, batería, etc). Antes se leía la posición y se tiraba el resto
// sin loguear. Ver ALARM_CODES y parseAlarmPacket() más abajo. Esto NO
// toca nada del lado VL502/JT808 (0x0900), que sigue igual.
// ============================================================

const net = require('net');
const crypto = require('crypto');
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
    GPS_LBS_EXTENDED: 0x37, // = MSG_GPS_LBS_3 en la nomenclatura de Traccar: GPS + antena celular, SIN datos de motor
    // CORRECCIÓN 13/07/2026: 0x16 no existe en el manual real de esta
    // familia — el número de protocolo de alarma correcto es 0x26 (y
    // 0x27 para multi-geocerca). El viejo "ALARM: 0x16" nunca hizo
    // match contra nada y quedaba silenciosamente en la rama "no
    // reconocido" de abajo.
    ALARM_SINGLE_FENCE: 0x26, // Alarm Packet (single geofence, UTC) — comparte offsets 0-17 con la posición
    ALARM_MULTI_FENCE: 0x27,  // Alarm Packet (multiple geofences, UTC) — igual + 1 byte de Nº de geocerca
    // [NUEVO 13/07/2026] Comandos servidor→equipo. Necesarios para
    // habilitar el modo de red (GPRS) de las alarmas de manejo — según
    // el manual GT06N genérico, cada alarma tiene su propio parámetro
    // "M" (modo de alarma: 0=solo GPRS, 1=SMS+GPRS, 2=GPRS+SMS+llamada).
    // Sin mandar esto, el equipo puede tener el buzzer local activado
    // pero nunca reportar el evento por red — es la hipótesis que
    // estamos probando.
    ONLINE_COMMAND: 0x80,  // servidor → equipo
    COMMAND_REPLY: 0x21,   // equipo → servidor (respuesta al 0x80)
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

// Tabla "Alarm and language" del manual Concox (paquetes 0x26/0x27),
// byte 1 del campo "Alert and language". Solo se listan los códigos
// documentados; cualquier código no presente acá se loguea como
// "sin mapear" en vez de asumir significado.
const ALARM_CODES = {
    0x01: { label: 'sos', desc: 'Alerta SOS' },
    0x02: { label: 'power_cut', desc: 'Corte de energía/combustible' },
    0x03: { label: 'vibration', desc: 'Vibración detectada' },
    0x04: { label: 'fence_enter', desc: 'Entró a geocerca' },
    0x05: { label: 'fence_exit', desc: 'Salió de geocerca' },
    0x06: { label: 'overspeed', desc: 'Exceso de velocidad' },
    0x09: { label: 'tow_theft', desc: 'Remolque/robo detectado' },
    0x0A: { label: 'gps_blindspot_enter', desc: 'Entró a zona ciega GPS' },
    0x0B: { label: 'gps_blindspot_exit', desc: 'Salió de zona ciega GPS' },
    0x0C: { label: 'powered_on', desc: 'Equipo encendido' },
    0x0D: { label: 'gps_first_fix', desc: 'Primer fix GPS' },
    0x0E: { label: 'ext_battery_low', desc: 'Batería externa (vehículo) baja' },
    0x0F: { label: 'ext_battery_critical', desc: 'Protección por batería externa crítica' },
    0x10: { label: 'sim_changed', desc: 'SIM cambiada' },
    0x11: { label: 'powered_off', desc: 'Equipo apagado' },
    0x12: { label: 'airplane_mode_forced', desc: 'Modo avión activado tras batería externa crítica' },
    0x13: { label: 'tamper', desc: 'Manipulación/desmontaje detectado' },
    0x14: { label: 'door', desc: 'Alerta de puerta' },
    0x15: { label: 'powered_off_low_battery', desc: 'Apagado por batería interna baja' },
    0x16: { label: 'sound_control', desc: 'Alerta por control de sonido' },
    0x17: { label: 'rogue_base_station', desc: 'Estación base falsa detectada' },
    0x18: { label: 'cover_removed', desc: 'Tapa removida' },
    0x19: { label: 'internal_battery_low', desc: 'Batería interna del equipo baja' },
    0x20: { label: 'deep_sleep', desc: 'Entró en modo de sueño profundo' },
    0x23: { label: 'fall', desc: 'Caída detectada' },
    0x29: { label: 'harsh_acceleration', desc: 'Aceleración brusca' },
    0x2A: { label: 'sharp_left_turn', desc: 'Giro brusco a la izquierda' },
    0x2B: { label: 'sharp_right_turn', desc: 'Giro brusco a la derecha' },
    0x2C: { label: 'collision', desc: 'Colisión detectada' },
    0x30: { label: 'harsh_braking', desc: 'Frenada brusca' },
    0x32: { label: 'device_unplugged', desc: 'Equipo desconectado de la alimentación' },
    // [SIN CONFIRMAR — 13/07/2026] Apareció una sola vez, justo después de
    // un ciclo real device_unplugged(0x32) -> reconexión de alimentación.
    // Hipótesis por orden temporal: "alimentación restaurada / equipo
    // reconectado". NO está en el manual Concox que decodificamos ni en
    // el diccionario de Flespi — no hay fuente que lo respalde, solo la
    // secuencia observada UNA vez. Falta ver si se repite consistente en
    // la próxima desconexión/reconexión antes de confiar en esto.
    0x72: { label: 'power_restored_unconfirmed', desc: 'Alimentación restaurada / equipo reconectado (SIN CONFIRMAR)' },
    0xFE: { label: 'acc_on', desc: 'ACC encendido' },
    0xFF: { label: 'acc_off', desc: 'ACC apagado' },
};

// Paquete de Alarma GT06 (protocolo 0x26 = geocerca única, 0x27 =
// multi-geocerca — ver manual Concox). Reusa el mismo bloque de
// posición que ya veníamos parseando en offsets 0-17 y, si el
// contenido trae la cola completa (LBS + terminal + alarma, offset
// >= 32), agrega el código de alarma. Si llega recortado, devuelve
// solo la posición sin romper nada (mismo comportamiento que antes).
//
// Offsets del contenido (después del bloque de posición 0-17):
//   18      LBS length (self-length + MCC+MNC+LAC+CellID = 9)
//   19-20   MCC
//   21      MNC
//   22-23   LAC
//   24-26   CellID
//   27      Terminal info (mismo formato de bits que el heartbeat 0x13)
//   28      Nivel de batería
//   29      Señal GSM
//   30      Código de alarma (byte 1 de "Alert and language")
//   31      Idioma (byte 2)
//   32      Nº de geocerca (SOLO en 0x27 multi-geocerca; 0xFF = no aplica)
function parseAlarmPacket(content, hasFenceByte) {
    const gps = parseComboGpsBlock(content);
    if (!gps) return null;

    if (content.length < 32) {
        // Llegó sin la cola de LBS/alarma — nos quedamos solo con la posición,
        // igual que se comportaba antes para estos paquetes.
        return { ...gps, terminalInfo: null, accOn: null, alarmCode: null, fenceNo: null };
    }

    const terminalInfo = content[27];
    const alarmCode = content[30];
    const rawFenceNo = hasFenceByte && content.length > 32 ? content[32] : null;

    return {
        ...gps,
        terminalInfo,
        accOn: ((terminalInfo & 0x02) >> 1) === 1, // mismo bit que ya usamos en el heartbeat 0x13
        alarmCode,
        fenceNo: rawFenceNo === 0xFF ? null : rawFenceNo,
    };
}

// Decodificación de la cola del 0x37 (GPS_LBS_EXTENDED), a partir del
// análisis del 13/07/2026 sobre 9 frames reales de manejo en Maipú:
//
//   CONFIRMADO — el bloque LBS es real y coherente (MCC 722 = Argentina,
//   MNC 07 = Movistar, LAC constante, CellID cambiando de a poco durante
//   el viaje = handoff de antena). A diferencia del Alarm Packet del
//   manual, acá el LBS arranca directo en offset 18 SIN el byte previo
//   de "LBS length" — por eso antes quedaba todo mezclado en el hex
//   crudo sin identificar.
//
//   HIPÓTESIS (sin confirmar, por eso solo se loguean, no se persisten
//   todavía):
//   - offset 27 = mismo campo "terminal info" que ya usamos en el
//     heartbeat 0x13 (bit1 = ACC). En la sesión de prueba, 8 de 9
//     frames dieron bit1=1 y el último (fin del viaje) dio bit1=0.
//   - offset 34-35 (2 bytes) = contador que solo sube durante toda la
//     sesión — candidato a odómetro/contador de pulsos del equipo.
//     Falta comparar contra una distancia real conocida para confirmar.
function decodeLbsExtendedTail(content) {
    if (content.length < 36) return null;

    const mcc = content.readUInt16BE(18);
    const mnc = content[20];
    const lac = content.readUInt16BE(21);
    const cellId = (content[23] << 16) | (content[24] << 8) | content[25];

    const terminalInfoHyp = content[27];
    const accOnHyp = ((terminalInfoHyp & 0x02) >> 1) === 1;
    const counterHyp = content.readUInt16BE(34);

    return { mcc, mnc, lac, cellId, terminalInfoHyp, accOnHyp, counterHyp };
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

// Sockets TCP activos ahora mismo, indexados por IMEI — necesario para
// poder mandarle un comando a un equipo desde afuera del closure de
// conexión (ver sendCommandToDevice más abajo). Se completa en el login
// (0x01) y se borra al cerrar la conexión.
const activeSockets = new Map();

// Construye un paquete "Online Command" (protocolo 0x80, servidor→
// equipo) con un comando de texto tipo AT (ej: "PARAM#", "SPEED,ON,20,100,0#").
//
// OJO: el ejemplo puntual que trae el manual para este paquete
// ("78780E800800000000736F732300016D6A0D0A") tiene un error de
// transcripción — le faltan los 2 bytes de CRC (el cálculo no cierra).
// En vez de replicarlo literal, seguimos el mismo esquema general
// length=protocolo+contenido+SN+CRC que ya usamos en buildAck() y que
// está confirmado contra tráfico real en el resto de este archivo.
//
// [NUEVO] El "Server Flag Bit" (4 bytes) ya NO va en cero — ahora es
// un ID aleatorio que usamos para CORRELACIONAR la respuesta 0x21 del
// equipo contra el comando exacto que la generó (ver CommandLog y el
// handler de COMMAND_REPLY más abajo). El equipo está OBLIGADO por
// protocolo a devolver este mismo valor tal cual en su respuesta, así
// que es un ID de correlación gratis, sin inventar nada nuevo.
let commandSerialCounter = 1;
function buildCommandPacket(commandText, correlationBuf) {
    const cmdBuf = Buffer.from(commandText, 'ascii');
    const serverFlag = correlationBuf || crypto.randomBytes(4);
    const language = Buffer.from([0x00, 0x02]); // inglés
    const innerLength = 4 + cmdBuf.length; // "Server flag bit + command content length", según el manual
    const content = Buffer.concat([Buffer.from([innerLength]), serverFlag, cmdBuf, language]);

    const serial = Buffer.alloc(2);
    serial.writeUInt16BE(commandSerialCounter % 0xFFFF, 0);
    commandSerialCounter++;

    const length = 1 + content.length + 2 + 2; // protocolo + contenido + SN + CRC
    const beforeCrc = Buffer.concat([Buffer.from([length, PROTOCOL.ONLINE_COMMAND]), content, serial]);
    const crc = crcX25(beforeCrc);
    const crcBuf = Buffer.alloc(2);
    crcBuf.writeUInt16BE(crc, 0);
    return { packet: Buffer.concat([START, beforeCrc, crcBuf, STOP]), correlationId: serverFlag.toString('hex') };
}

// Decodifica UTF-16BE (el "código 0x02" que usa el equipo para sus
// respuestas) — Node solo trae utf16le nativo, así que damos vuelta
// los pares de bytes antes de decodificar.
function utf16beToString(buf) {
    const swapped = Buffer.from(buf);
    for (let i = 0; i + 1 < swapped.length; i += 2) {
        const tmp = swapped[i];
        swapped[i] = swapped[i + 1];
        swapped[i + 1] = tmp;
    }
    return swapped.toString('utf16le');
}

// [NUEVO 13/07/2026] Le manda un comando de texto a un equipo VL04 ya
// conectado. Devuelve {sent:false, reason} si el equipo no tiene una
// conexión TCP abierta en este momento (no se puede encolar para
// después — si no está conectado, no hay a quién mandárselo).
//
// Devuelve también correlationId — quien llama esta función es
// responsable de guardarlo en CommandLog si quiere trackear la
// respuesta real del equipo (ver deviceCommandsController.js). La
// respuesta en sí llega async por el protocolo 0x21 y se procesa en
// el handler de COMMAND_REPLY más abajo, que actualiza CommandLog
// directamente por su cuenta — sendCommandToDevice no la espera.
async function sendCommandToDevice(imei, commandText) {
    const socket = activeSockets.get(imei);
    if (!socket || socket.destroyed) {
        return {
            sent: false,
            reason: `IMEI ${imei} no tiene una conexión TCP activa en este momento (equipo apagado o sin señal)`,
        };
    }
    
    // [NUEVO] Determinamos el modelo del equipo para saber qué protocolo de empaquetado usar
    const [[device]] = await pool.query('SELECT model FROM Devices WHERE imei = ?', [imei]);
    
    if (device && device.model === 'VL502') {
        // Empaquetado JT808 (0x8300)
        const { packet, correlationId } = jt808.buildTextCommandPacket(imei, commandText);
        socket.write(packet);
        console.log(`[JT808] ➡️  Comando enviado a IMEI=${imei} (correlationId=${correlationId}): "${commandText}"`);
        return { sent: true, correlationId };
    }

    // Empaquetado original GT06 (0x80)
    const { packet, correlationId } = buildCommandPacket(commandText);
    socket.write(packet);
    console.log(`[GT06] ➡️  Comando enviado a IMEI=${imei} (correlationId=${correlationId}): "${commandText}" (hex: ${packet.toString('hex')})`);
    return { sent: true, correlationId };
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
                    const imeiPrefix = jt808.terminalIdToImeiPrefix(header.terminalId);

                    // [NUEVO] Registrar el socket activo para poder mandarle comandos al VL502
                    if (!currentImei) {
                        const [[dbDevice]] = await pool.query(
                            `SELECT imei FROM Devices WHERE imei LIKE ? AND status = 'paired'`,
                            [`${imeiPrefix}%`]
                        );
                        if (dbDevice) {
                            currentImei = dbDevice.imei;
                            activeSockets.set(currentImei, socket);
                        }
                    } else if (currentImei && !activeSockets.has(currentImei)) {
                        activeSockets.set(currentImei, socket);
                    }

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
                            const imeiPrefixLookup = jt808.terminalIdToImeiPrefix(header.terminalId);
                            const [[device]] = await pool.query(
                                `SELECT imei, vehicle_id FROM Devices WHERE imei LIKE ? AND status = 'paired'`,
                                [`${imeiPrefixLookup}%`]
                            );
                            if (!device) {
                                console.warn(`[JT808] No se encontró ningún equipo pareado con IMEI que empiece con ${imeiPrefixLookup}`);
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
                        //   0x02 = trouble codes / DTC                [NUEVO]
                        //   0x03 = alarmas / comportamiento de manejo
                        //          (frenada brusca, colisión, geocerca, etc.)
                        //   0x04 = inicio/fin de viaje                [NUEVO]
                        //   0xf0 = reporte periódico normal (RPM, temp,
                        //          luces, puertas, combustible, etc. — ahora
                        //          extendido con toda la Tabla 25 del manual)
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
                            // manual oficial del fabricante. Cada alarma
                            // queda guardada individual en Telemetry_Alarms
                            // (antes se perdía todo salvo la frenada brusca,
                            // que además pisaba el campo dtc_codes).
                            const alarmData = jt808.parseAlarmData(header.body);
                            for (const alarm of alarmData.alarms) {
                                console.log(`[JT808] 🚨 ALARMA equipo=${deviceTransparente.imei}: ${alarm.label} (id=0x${alarm.id.toString(16)}) ${alarm.desc || ''}`);

                                await telemetryIngestReal.ingestAlarm(deviceTransparente.imei, alarm, { lat: alarmData.lat, lon: alarmData.lon });

                                // La frenada brusca además sigue alimentando
                                // Telemetry_Raw/mlService (harsh_brake), para
                                // no romper el score de desgaste de frenos
                                // que ya depende de ese campo.
                                if (alarm.id === 0x1B) {
                                    await telemetryIngestReal.ingestReading(deviceTransparente.imei, {
                                        lat: alarmData.lat, lng: alarmData.lon,
                                        speed_kmh: null, heading: null,
                                        engine_rpm: null, engine_load: null, coolant_temp: null, battery_voltage: null,
                                        harsh_brake: true,
                                        dtc_codes: `ALARM:${alarm.label}`,
                                    });
                                }
                            }

                        } else if (subType === 0x02) {
                            // [NUEVO] Trouble codes / DTC — sin confirmar
                            // todavía contra bytes reales, loguear crudo
                            // hasta validar contra una falla real conocida.
                            const dtcData = jt808.parseTroubleCodes(header.body);
                            console.log(`[JT808] DTC equipo=${deviceTransparente.imei}: ${JSON.stringify(dtcData.systems)}`);
                            if (dtcData.systems.length) {
                                await telemetryIngestReal.ingestTroubleCodes(deviceTransparente.imei, dtcData);
                            }

                        } else if (subType === 0x04) {
                            // [NUEVO] Inicio/fin de viaje — trae odómetro y
                            // combustible reales del tramo. Sin confirmar
                            // todavía contra bytes reales.
                            const tripData = jt808.parseTravelData(header.body);
                            if (tripData) {
                                console.log(`[JT808] Viaje (${tripData.kind}) equipo=${deviceTransparente.imei}: #${tripData.travelNumber} km=${tripData.distanceKm ?? '?'} combustible=${tripData.fuelConsumedL ?? '?'}L`);
                                await telemetryIngestReal.ingestTripEvent(deviceTransparente.imei, tripData);
                            }

                        } else {
                            // Reporte periódico normal (0xf0 y similares) —
                            // ahora extendido con toda la Tabla 25: odómetro
                            // del equipo, consumo promedio/instantáneo,
                            // presión y vida de aceite, temp. de admisión y
                            // de cabina, ángulo de volante, acelerador
                            // relativo, combustible restante en litros, ACC
                            // nativo, posición de caja y el snapshot de
                            // estado (luces/puertas/ventanillas/cinturones/
                            // fallas ECM-ABS-SRS/airbag/freno de mano/llave).
                            const parsed = jt808.parseTransparentTlv(header.body);

                            if (parsed.vin) {
                                await pool.query('UPDATE Vehicles SET vin = ? WHERE id = ? AND (vin IS NULL OR vin != ?)', [parsed.vin, deviceTransparente.vehicle_id, parsed.vin]);
                                console.log(`[JT808] VIN confirmado equipo=${deviceTransparente.imei}: ${parsed.vin}`);
                            }

                            // Antes solo se guardaba si venía RPM o
                            // combustible — ahora cualquier campo nuevo
                            // (aunque no venga RPM en ese paquete puntual)
                            // dispara el guardado, para no perder datos.
                            const hasAnyData = [
                                parsed.rpm, parsed.fuel_level, parsed.device_odometer_km, parsed.fuel_consumption_avg,
                                parsed.fuel_consumption_instant, parsed.oil_pressure_kpa, parsed.oil_life_pct,
                                parsed.intake_air_temp, parsed.cabin_temp, parsed.steering_angle, parsed.throttle_relative_pct,
                                parsed.remaining_fuel_l, parsed.acc_signal, parsed.shift_position, parsed.statusFlags,
                            ].some(v => v !== null && v !== undefined);

                            if (hasAnyData) {
                                await telemetryIngestReal.ingestReading(deviceTransparente.imei, {
                                    lat: null, lng: null, speed_kmh: null, heading: null,
                                    engine_rpm: parsed.rpm,
                                    engine_load: parsed.engine_load,
                                    coolant_temp: parsed.coolant_temp,
                                    battery_voltage: parsed.battery_voltage,
                                    fuel_level: parsed.fuel_level,
                                    harsh_brake: false,
                                    device_odometer_km: parsed.device_odometer_km,
                                    fuel_consumption_avg: parsed.fuel_consumption_avg,
                                    fuel_consumption_instant: parsed.fuel_consumption_instant,
                                    oil_pressure_kpa: parsed.oil_pressure_kpa,
                                    oil_life_pct: parsed.oil_life_pct,
                                    intake_air_temp: parsed.intake_air_temp,
                                    cabin_temp: parsed.cabin_temp,
                                    steering_angle: parsed.steering_angle,
                                    throttle_relative_pct: parsed.throttle_relative_pct,
                                    remaining_fuel_l: parsed.remaining_fuel_l,
                                    acc_signal: parsed.acc_signal,
                                    statusFlags: parsed.statusFlags,
                                });
                                console.log(`[JT808] OBD Data equipo=${deviceTransparente.imei}: RPM=${parsed.rpm} temp=${parsed.coolant_temp}°C bat=${parsed.battery_voltage}V carga=${parsed.engine_load}% combustible=${parsed.fuel_level}% odom=${parsed.device_odometer_km}km caja=${parsed.shift_position} ACC=${parsed.acc_signal}`);
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
                        activeSockets.set(currentImei, socket);
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

                            // Solo logueo — no se persiste nada de esto todavía,
                            // ver nota de decodeLbsExtendedTail() más arriba.
                            const tailInfo = decodeLbsExtendedTail(content);
                            if (tailInfo) {
                                console.log(`[GT06]   ↳ LBS(confirmado): MCC=${tailInfo.mcc} MNC=${tailInfo.mnc} LAC=${tailInfo.lac} CellID=${tailInfo.cellId} | HIPÓTESIS: ACC(offset27)=${tailInfo.accOnHyp ? 'ON' : 'OFF'} (byte=0x${tailInfo.terminalInfoHyp.toString(16).padStart(2, '0')}) contador(offset34-35)=${tailInfo.counterHyp}`);
                            }
                        } else {
                            console.log(`[GT06] Paquete 0x37 IMEI=${currentImei} procesado sin bloque de posición (paquete corto).`);
                        }

                    } else if (protocolNumber === PROTOCOL.ALARM_SINGLE_FENCE || protocolNumber === PROTOCOL.ALARM_MULTI_FENCE) {
                        // --- Paquete de Alarma GT06 (0x26 / 0x27). Antes se
                        // trataba como "posición liviana" y se descartaba todo
                        // lo que viene después del offset 17 (LBS + terminal +
                        // código de alarma). Ver nota de ACTUALIZACIÓN al
                        // principio del archivo. ---
                        socket.write(buildAck(protocolNumber, serial));

                        if (!currentImei) {
                            console.warn(`[GT06] Paquete 0x${protocolNumber.toString(16)} (alarma) sin login previo, se descarta`);
                            continue;
                        }

                        const vehicleId = await findVehicleIdByImei(currentImei);
                        if (!vehicleId) {
                            console.warn(`[GT06] IMEI ${currentImei} no está pareado a ningún vehículo — se descarta el paquete`);
                            continue;
                        }

                        const hasFenceByte = protocolNumber === PROTOCOL.ALARM_MULTI_FENCE;
                        const parsed = parseAlarmPacket(content, hasFenceByte);
                        if (!parsed) continue;

                        // La posición sigue guardándose exactamente igual que
                        // antes (mismo INSERT, misma forma), solo que ahora
                        // harsh_brake se completa con el código real en vez de
                        // ir siempre en false.
                        await telemetryIngestReal.ingestReading(currentImei, {
                            lat: parsed.lat,
                            lng: parsed.lon,
                            speed_kmh: parsed.speed_kmh,
                            heading: parsed.course,
                            engine_rpm: null,
                            engine_load: null,
                            coolant_temp: null,
                            battery_voltage: null,
                            harsh_brake: parsed.alarmCode === 0x30,
                        });
                        console.log(`[GT06] Posición (0x${protocolNumber.toString(16)}) IMEI=${currentImei} lat=${parsed.lat.toFixed(5)} lng=${parsed.lon.toFixed(5)} v=${parsed.speed_kmh}km/h heading=${parsed.course}°`);

                        if (parsed.alarmCode != null && parsed.alarmCode !== 0x00) {
                            const known = ALARM_CODES[parsed.alarmCode];
                            if (known) {
                                const fenceSuffix = hasFenceByte && parsed.fenceNo != null ? ` (geocerca #${parsed.fenceNo + 1})` : '';
                                console.log(`[GT06] 🚨 ALARMA IMEI=${currentImei}: ${known.label} (0x${parsed.alarmCode.toString(16)}) ${known.desc}${fenceSuffix}`);

                                // ACC ON/OFF ya se sigue por el heartbeat 0x13 —
                                // no lo duplicamos como fila en Telemetry_Alarms.
                                if (parsed.alarmCode !== 0xFE && parsed.alarmCode !== 0xFF) {
                                    await telemetryIngestReal.ingestAlarm(currentImei, {
                                        id: parsed.alarmCode,
                                        label: known.label,
                                        desc: known.desc + fenceSuffix,
                                    }, { lat: parsed.lat, lon: parsed.lon });
                                }
                            } else {
                                console.log(`[GT06] Código de alarma sin mapear: 0x${parsed.alarmCode.toString(16)} IMEI=${currentImei} — agregar a ALARM_CODES si se confirma qué es`);
                            }
                        }

                    } else if (protocolNumber === PROTOCOL.COMMAND_REPLY) {
                        // --- [NUEVO 13/07/2026] Respuesta del equipo a un comando
                        // que le mandamos por sendCommandToDevice() (protocolo 0x80).
                        // Estructura según el manual: ServerFlagBit(4) + Código(1:
                        // 0x01=ASCII, 0x02=UTF-16BE) + Contenido de la respuesta.
                        //
                        // El ServerFlagBit es el correlationId que generamos al
                        // mandar el comando (ver buildCommandPacket) — el equipo lo
                        // devuelve tal cual, así que lo usamos para marcar en
                        // CommandLog CUÁL comando exacto es el que se confirmó. ---
                        socket.write(buildAck(protocolNumber, serial));
                        if (content.length >= 5) {
                            const correlationId = content.slice(0, 4).toString('hex');
                            const code = content[4];
                            const replyBytes = content.slice(5);
                            const replyText = code === 0x02 ? utf16beToString(replyBytes) : replyBytes.toString('ascii');
                            console.log(`[GT06] ⬅️  Respuesta a comando IMEI=${currentImei} (correlationId=${correlationId}): "${replyText}"`);
                            try {
                                await pool.query(
                                    `UPDATE CommandLog SET status = 'acked', response_text = ?, responded_at = NOW()
                                     WHERE correlation_id = ? AND status = 'sent'`,
                                    [replyText, correlationId]
                                );
                            } catch (err) {
                                // Si la migración de CommandLog todavía no corrió, no
                                // rompemos el flujo del socket por esto — solo se
                                // pierde el tildecito de confirmación, no la telemetría.
                                if (err.code !== 'ER_NO_SUCH_TABLE') console.error('[GT06] Error actualizando CommandLog:', err.message);
                            }
                        } else {
                            console.log(`[GT06] Respuesta a comando IMEI=${currentImei} (paquete corto, sin parsear): ${content.toString('hex')}`);
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
        socket.on('close', () => {
            if (currentImei && activeSockets.get(currentImei) === socket) activeSockets.delete(currentImei);
            console.log(`[GT06] Conexión cerrada: ${remote} (IMEI=${currentImei || 'desconocido'})`);
        });
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`📡 Servidor GT06 (trackers) escuchando en el puerto ${PORT}`);
    });

    server.on('error', (err) => console.error('❌ Error en servidor GT06:', err.message));

    return server;
}

module.exports = { startGt06Server, sendCommandToDevice };