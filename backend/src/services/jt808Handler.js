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
    const lat = latRaw / 1_000_000;   // grados, escala 10^-6 según spec — SIGNO según hemisferio (ver más abajo)
    const lon = lonRaw / 1_000_000;

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

    let mileageKm = null, fuelLiters = null;
    if (additional[ADDITIONAL_INFO.MILEAGE] && additional[ADDITIONAL_INFO.MILEAGE].length === 4) {
        mileageKm = additional[ADDITIONAL_INFO.MILEAGE].readUInt32BE(0) / 10;
    }
    if (additional[ADDITIONAL_INFO.FUEL] && additional[ADDITIONAL_INFO.FUEL].length === 2) {
        fuelLiters = additional[ADDITIONAL_INFO.FUEL].readUInt16BE(0) / 10;
    }

    // Cualquier ID de información adicional que NO sea 0x01/0x02/0x03
    // (mileage/fuel/speed-sensor, los únicos confirmados por spec) lo
    // dejamos aparte para loguearlo crudo — ahí es donde probablemente
    // viva el RPM si este equipo lo manda, con un ID propietario del
    // fabricante que hay que confirmar contra un valor real.
    const idsConocidos = [ADDITIONAL_INFO.MILEAGE, ADDITIONAL_INFO.FUEL, ADDITIONAL_INFO.SPEED_SENSOR];
    const sinIdentificar = Object.entries(additional)
        .filter(([id]) => !idsConocidos.includes(Number(id)))
        .map(([id, value]) => `ID=0x${Number(id).toString(16)} valor=${value.toString('hex')}`);

    return { accOn, gpsFixed, lat, lon, altitude, speedKmh, direction, timeDigits, mileageKm, fuelLiters, sinIdentificar };
}

module.exports = {
    MSG_ID,
    extractJT808Frame,
    parseHeader,
    buildRegisterResponse,
    buildGeneralResponse,
    parseLocationReport,
};
