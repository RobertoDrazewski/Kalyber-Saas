// ============================================================
// Manejador del protocolo JT808 — lo habla el JM-VL502 (el equipo
// "Avanzado"), a diferencia del VL04 que habla GT06.
//
// A diferencia de GT06 (donde tuvimos que hacer ingeniería inversa a
// ciegas), JT808 es un ESTÁNDAR PÚBLICO chino (JT/T 808), documentado
// oficialmente. Los IDs de mensaje y la mayoría de los campos acá
// abajo están confirmados contra la especificación real, no
// adivinados — la única parte "a ciegas" que queda es identificar
// los IDs de información adicional PROPIETARIOS del fabricante
// (fuera de 0x01=kilometraje y 0x02=combustible, que sí están en el
// estándar oficial) — por ejemplo RPM, si este equipo lo manda, va a
// aparecer con un ID fuera del estándar que hay que loguear y
// confirmar contra un valor real, mismo método que usamos siempre.
// ============================================================

const START_JT808 = 0x7e;

const MSG_ID = {
    TERMINAL_REGISTER: 0x0100,
    TERMINAL_REGISTER_RESPONSE: 0x8100,
    TERMINAL_AUTH: 0x0102,
    TERMINAL_HEARTBEAT: 0x0002,
    LOCATION_REPORT: 0x0200,
    PLATFORM_GENERAL_RESPONSE: 0x8001,
    TERMINAL_GENERAL_RESPONSE: 0x0001,
    TERMINAL_LOGOUT: 0x0003,
};

// IDs de "información adicional" del reporte de posición (0x0200)
// confirmados contra la especificación oficial JT/T 808.
const ADDITIONAL_INFO = {
    MILEAGE: 0x01,       // DWORD, en unidades de 1/10 km (odómetro del propio equipo)
    FUEL: 0x02,          // WORD, en unidades de 1/10 L (nivel de combustible)
    SPEED_SENSOR: 0x03,  // WORD, velocidad del sensor físico, 1/10 km/h
    GSM_SIGNAL: 0x30,    // BYTE, intensidad de señal GSM
    GNSS_SATELLITES: 0x31, // BYTE, cantidad de satélites GNSS visibles
};

function unescapeJT808(buf) {
    const out = [];
    for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0x7d && buf[i + 1] === 0x02) { out.push(0x7e); i++; }
        else if (buf[i] === 0x7d && buf[i + 1] === 0x01) { out.push(0x7d); i++; }
        else out.push(buf[i]);
    }
    return Buffer.from(out);
}

function escapeJT808(buf) {
    const out = [];
    for (const b of buf) {
        if (b === 0x7e) { out.push(0x7d, 0x02); }
        else if (b === 0x7d) { out.push(0x7d, 0x01); }
        else out.push(b);
    }
    return Buffer.from(out);
}

// Busca un frame JT808 completo (entre dos 0x7e) en el buffer
// acumulado. Como el escapado elimina cualquier 0x7e "de adentro",
// buscar el segundo 0x7e crudo siempre encuentra el delimitador real.
function extractJT808Frame(buf) {
    const startIdx = buf.indexOf(START_JT808);
    if (startIdx === -1) return null;
    const endIdx = buf.indexOf(START_JT808, startIdx + 1);
    if (endIdx === -1) return null; // todavía no llegó completo

    const raw = buf.slice(startIdx, endIdx + 1);
    const rest = buf.slice(endIdx + 1);
    const unescaped = unescapeJT808(raw.slice(1, -1)); // sin los 0x7e de los bordes
    return { raw, rest, unescaped };
}

function parseHeader(unescaped) {
    const msgId = unescaped.readUInt16BE(0);
    const bodyProps = unescaped.readUInt16BE(2);
    const bodyLength = bodyProps & 0x03FF;
    const isSubpackage = !!(bodyProps & 0x2000);
    const is2019 = !!(bodyProps & 0x4000);

    let offset = 4;
    let versionByte = null;
    if (is2019) {
        versionByte = unescaped[offset];
        offset += 1;
    }
    const idLen = is2019 ? 10 : 6;
    const terminalId = unescaped.slice(offset, offset + idLen);
    offset += idLen;

    const serialNo = unescaped.readUInt16BE(offset);
    offset += 2;

    if (isSubpackage) {
        // Mensaje partido en paquetes — no lo armamos completo todavía,
        // lo señalamos para no procesarlo mal.
        offset += 4;
    }

    const body = unescaped.slice(offset, offset + bodyLength);
    return { msgId, bodyLength, isSubpackage, is2019, terminalId, serialNo, body };
}

function uint16be(n) {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(n, 0);
    return b;
}

function buildFrame(msgId, terminalId, serialNo, bodyBuffer) {
    const bodyProps = uint16be(bodyBuffer.length & 0x03FF);
    const header = Buffer.concat([uint16be(msgId), bodyProps, terminalId, uint16be(serialNo)]);
    const preChecksum = Buffer.concat([header, bodyBuffer]);
    let checksum = 0;
    for (const b of preChecksum) checksum ^= b;
    const full = Buffer.concat([preChecksum, Buffer.from([checksum])]);
    const escaped = escapeJT808(full);
    return Buffer.concat([Buffer.from([0x7e]), escaped, Buffer.from([0x7e])]);
}

// Respuesta al registro (0x8100) — sin esto, el equipo se queda
// reintentando registrarse en loop y nunca manda posición real.
function buildRegisterResponse(terminalId, ourSerial, reqSerial) {
    const authCode = Buffer.from('888888', 'ascii'); // código simple, no usamos autenticación estricta
    const body = Buffer.concat([uint16be(reqSerial), Buffer.from([0x00]), authCode]);
    return buildFrame(MSG_ID.TERMINAL_REGISTER_RESPONSE, terminalId, ourSerial, body);
}

// Respuesta genérica (0x8001) — confirma cualquier mensaje recibido
// (heartbeat, autenticación, reporte de posición, etc.)
function buildGeneralResponse(terminalId, ourSerial, respondingToMsgId, respondingToSerial) {
    const body = Buffer.concat([uint16be(respondingToSerial), uint16be(respondingToMsgId), Buffer.from([0x00])]);
    return buildFrame(MSG_ID.PLATFORM_GENERAL_RESPONSE, terminalId, ourSerial, body);
}

// Parsea el reporte de posición (0x0200) — campos base confirmados
// contra la especificación oficial JT/T 808.
function parseLocationReport(body) {
    if (body.length < 28) return null;

    const alarmFlag = body.readUInt32BE(0);
    const statusFlag = body.readUInt32BE(4);
    const accOn = !!(statusFlag & 0x01);        // bit0 = ACC, confirmado por spec
    const gpsFixed = !!(statusFlag & 0x02);     // bit1 = posicionado

    const latRaw = body.readUInt32BE(8);
    const lonRaw = body.readUInt32BE(12);
    // Mendoza = hemisferio sur/oeste. El campo de statusFlag debería
    // traer los bits de hemisferio según el estándar, pero no está
    // confirmado en qué posición exacta para este firmware — igual
    // que hicimos con el GT06, forzamos el signo conocido en vez de
    // arriesgar una lectura mal interpretada del bit.
    const lat = -(latRaw / 1_000_000);
    const lon = -(lonRaw / 1_000_000);

    const altitude = body.readUInt16BE(16);
    const speedRaw = body.readUInt16BE(18);
    const speedKmh = speedRaw / 10;   // spec: unidades de 0.1 km/h
    const direction = body.readUInt16BE(20);

    const timeBcd = body.slice(22, 28);
    const timeDigits = [...timeBcd].map(b => b.toString(16).padStart(2, '0')).join('');

    // Información adicional (TLV): ID(1) + LEN(1) + VALOR(LEN bytes)
    const additional = {};
    let offset = 28;
    while (offset < body.length - 1) {
        const id = body[offset];
        const len = body[offset + 1];
        const value = body.slice(offset + 2, offset + 2 + len);
        additional[id] = value;
        offset += 2 + len;
    }

    let mileageKm = null, fuelLiters = null, gsmSignal = null, satellites = null;
    if (additional[ADDITIONAL_INFO.MILEAGE] && additional[ADDITIONAL_INFO.MILEAGE].length === 4) {
        mileageKm = additional[ADDITIONAL_INFO.MILEAGE].readUInt32BE(0) / 10;
    }
    if (additional[ADDITIONAL_INFO.FUEL] && additional[ADDITIONAL_INFO.FUEL].length === 2) {
        fuelLiters = additional[ADDITIONAL_INFO.FUEL].readUInt16BE(0) / 10;
    }
    if (additional[ADDITIONAL_INFO.GSM_SIGNAL] && additional[ADDITIONAL_INFO.GSM_SIGNAL].length === 1) {
        gsmSignal = additional[ADDITIONAL_INFO.GSM_SIGNAL][0];
    }
    if (additional[ADDITIONAL_INFO.GNSS_SATELLITES] && additional[ADDITIONAL_INFO.GNSS_SATELLITES].length === 1) {
        satellites = additional[ADDITIONAL_INFO.GNSS_SATELLITES][0];
    }

    // Cualquier ID de información adicional que NO sea uno de los ya
    // confirmados por el estándar lo dejamos aparte para loguearlo
    // crudo — ahí es donde probablemente viva el RPM/datos de motor,
    // si este equipo los manda, con un ID propietario del fabricante
    // que hay que confirmar contra un valor real.
    const idsConocidos = [
        ADDITIONAL_INFO.MILEAGE, ADDITIONAL_INFO.FUEL, ADDITIONAL_INFO.SPEED_SENSOR,
        ADDITIONAL_INFO.GSM_SIGNAL, ADDITIONAL_INFO.GNSS_SATELLITES,
    ];
    const sinIdentificar = Object.entries(additional)
        .filter(([id]) => !idsConocidos.includes(Number(id)))
        .map(([id, value]) => `ID=0x${Number(id).toString(16)} valor=${value.toString('hex')}`);

    return { accOn, gpsFixed, lat, lon, altitude, speedKmh, direction, timeDigits, mileageKm, fuelLiters, gsmSignal, satellites, sinIdentificar };
}

// El "ID de terminal" de JT808 (6 bytes) es el IMEI real del equipo,
// pero codificado como número puro (no texto) y SIN el último dígito
// (el IMEI completo de 15 dígitos no entra en 6 bytes = 48 bits, pero
// sin el dígito verificador sí entra). Confirmado contra el IMEI real
// impreso en la etiqueta del VL502 (868935060187604).
//
// OJO: el dígito verificador del IMEI (el último) se calcula con el
// algoritmo de Luhn — technically se podría reconstruir, pero como
// nunca lo vamos a necesitar para nada (alcanza con los primeros 14
// dígitos para buscar el equipo en la base de forma inequívoca),
// hacemos el match completando con LIKE en vez de intentar adivinar
// el dígito que falta.
function terminalIdToImeiPrefix(terminalIdBuffer) {
    return terminalIdBuffer.readUIntBE(0, 6).toString();
}

// ============================================================
// Parser del "0x0900 — transmisión transparente" del VL502.
//
// CONFIRMADO CONTRA EL MANUAL OFICIAL DEL FABRICANTE ("Communication
// Protocol of VL502 V1.0.7") — ya no son candidatos, son los tags
// reales documentados. El primer byte del cuerpo indica el TIPO de
// sub-mensaje:
//   0x02 = Trouble code reporting (DTC)
//   0x03 = Alarm and driving behavior data  <- frenada/giro brusco, colisión, etc.
//   0x04 = Travel data (inicio/fin de viaje)
//   0xf0 = Reporte periódico normal (extensión propia de Jimi, no
//          documentada en la tabla base — la reversamos a mano y
//          ahora coincide con los offsets oficiales de la tabla
//          general de parámetros del vehículo).
// ============================================================

function parseTags(rest) {
    const tags = {};
    let i = 0;
    while (i < rest.length - 3) {
        const tag = rest.slice(i, i + 2).toString('hex');
        const length = rest[i + 2];
        if (i + 3 + length > rest.length) break;
        tags[tag] = rest.slice(i + 3, i + 3 + length);
        i += 3 + length;
    }
    return tags;
}

// Reporte periódico normal (type 0xf0) — datos del vehículo en vivo.
function parseTransparentTlv(unescapedBody) {
    if (unescapedBody.length < 11) {
        return { tags: {}, vin: null, rpm: null, battery_voltage: null, coolant_temp: null, engine_load: null, fuel_level: null, brake_pedal: null, accelerator_pedal: null };
    }
    const rest = unescapedBody.slice(11);
    const tags = parseTags(rest);

    // VIN: tag 0001, 17 bytes ASCII — confirmado por formato inconfundible.
    let vin = null;
    if (tags['0001'] && tags['0001'].length === 17) {
        const text = tags['0001'].toString('ascii');
        if (/^[A-Z0-9]{17}$/.test(text)) vin = text;
    }

    // RPM — tag 0536, y=x sin escala. CONFIRMADO por el manual oficial.
    let rpm = null;
    if (tags['0536'] && tags['0536'].length === 2) {
        rpm = tags['0536'].readUInt16BE(0);
    }

    // Voltaje — tag 0530, y=x en mV. CONFIRMADO por el manual oficial.
    let battery_voltage = null;
    if (tags['0530'] && tags['0530'].length === 2) {
        battery_voltage = tags['0530'].readUInt16BE(0) / 1000;
    }

    // Temperatura de agua/refrigerante — tag 052D (NO 052E, ese es la
    // temperatura del aire de admisión — error mío corregido con el
    // manual oficial). y=x-40.
    let coolant_temp = null;
    if (tags['052d'] && tags['052d'].length === 1) {
        coolant_temp = tags['052d'].readUInt8(0) - 40;
    }

    // Carga de motor — tag 0114 (NO 053C, ese es "Air Flow" — error
    // mío corregido). y=x, ya viene en %.
    let engine_load = null;
    if (tags['0114'] && tags['0114'].length === 1) {
        engine_load = tags['0114'].readUInt8(0);
    }

    // Nivel de combustible — tag 0544, y=x, ya viene en %. NUEVO,
    // nunca lo habíamos buscado en este tag — resuelve el misterio
    // del combustible que nunca aparecía.
    let fuel_level = null;
    if (tags['0544'] && tags['0544'].length === 1) {
        fuel_level = tags['0544'].readUInt8(0);
    }

    // Estado del pedal de freno — tag 051F, 0=liberado, 1=presionado.
    // NUEVO — combinado con el ID de alarma 0x1B (frenada brusca) de
    // parseAlarmData, da doble confirmación de un frenazo real.
    let brake_pedal = null;
    if (tags['051f'] && tags['051f'].length === 1) {
        brake_pedal = tags['051f'].readUInt8(0);
    }

    // Posición del acelerador — tag 053F, y=x, en %. NUEVO.
    let accelerator_pedal = null;
    if (tags['053f'] && tags['053f'].length === 1) {
        accelerator_pedal = tags['053f'].readUInt8(0);
    }

    return { tags, vin, rpm, battery_voltage, coolant_temp, engine_load, fuel_level, brake_pedal, accelerator_pedal };
}

// IDs de alarma/comportamiento de manejo confirmados (Tabla 28 del
// manual oficial) — solo los que nos importan para el producto.
const ALARM_IDS = {
    0x0B: 'Combustible bajo',
    0x1A: 'Aceleración brusca',
    0x1B: 'Frenada brusca',
    0x1C: 'Giro brusco',
    0x1D: 'Cambio de carril rápido',
    0x20: 'Alarma de emergencia',
    0x21: 'Salió de la geocerca',
    0x22: 'Entró a la geocerca',
    0x25: 'Exceso de velocidad',
    0x26: 'Colisión (leve)',
    0x27: 'Colisión (severa)',
    0x28: 'Vuelco del vehículo',
    0x3E: 'Nivel de combustible anormal',
};

// Mensaje de alarma / comportamiento de manejo (type 0x03) — acá vive
// la frenada brusca que veníamos buscando desde el principio.
// Estructura (Tabla 27 del manual oficial): tipo(1) + fecha(6) + n
// bytes de cabecera propietaria + total de alarmas(1) + [ID(1) +
// largo descripción(1) + descripción(string)] repetido + status(4) +
// lat(4) + lon(4).
function parseAlarmData(unescapedBody) {
    // El body de este sub-mensaje arranca igual que el periódico:
    // tipo(1) + fecha BCD(6) + algo(4) = 11 bytes, después el tipo
    // "0x03" ya lo sacamos afuera al leer unescapedBody[0].
    if (unescapedBody.length < 12) return { alarms: [], lat: null, lon: null };

    let offset = 11;
    const totalAlarms = unescapedBody[offset];
    offset += 1;

    const alarms = [];
    for (let i = 0; i < totalAlarms && offset < unescapedBody.length - 1; i++) {
        const id = unescapedBody[offset];
        const descLen = unescapedBody[offset + 1];
        const desc = unescapedBody.slice(offset + 2, offset + 2 + descLen).toString('ascii');
        alarms.push({ id, label: ALARM_IDS[id] || `ID desconocido 0x${id.toString(16)}`, desc });
        offset += 2 + descLen;
    }

    let lat = null, lon = null;
    if (offset + 12 <= unescapedBody.length) {
        offset += 4; // status DWORD, no lo usamos por ahora
        lat = -(unescapedBody.readUInt32BE(offset) / 1_000_000);
        lon = -(unescapedBody.readUInt32BE(offset + 4) / 1_000_000);
    }

    return { alarms, lat, lon };
}

module.exports = {
    MSG_ID,
    extractJT808Frame,
    parseHeader,
    buildRegisterResponse,
    buildGeneralResponse,
    parseLocationReport,
    terminalIdToImeiPrefix,
    parseTransparentTlv,
    parseAlarmData,
    ALARM_IDS,
};