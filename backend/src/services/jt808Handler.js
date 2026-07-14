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
//
// ACTUALIZACIÓN: se agregó el parseo extendido de la Tabla 25 (data
// stream IDs para vehículos de pasajeros, 0x0500-0x0548) del manual
// oficial "Communication Protocol of VL502 V1.0.7", más las Tablas
// 26 (DTC) y 29/30 (viaje), y la Tabla 28 completa de alarmas. Los
// tags de motor (RPM, combustible, temp. agua, carga, freno,
// acelerador, VIN) ya estaban confirmados contra bytes reales; el
// resto (luces, puertas, cinturones, DTC, viajes) son NUEVOS — están
// bien contra el manual, pero todavía NO CONTRA BYTES REALES. Seguí
// el mismo método de siempre: logueá crudo, confirmá contra un
// evento real conocido (por ej. abrir una puerta) antes de confiar
// 100% en el valor.
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
function terminalIdToImeiPrefix(terminalIdBuffer) {
    return terminalIdBuffer.readUIntBE(0, 6).toString();
}

// ============================================================
// Parser del "0x0900 — transmisión transparente" del VL502.
//
// El primer byte del cuerpo indica el TIPO de sub-mensaje. Dentro de
// ese cuerpo, según Tabla 31 del manual: tipo(1) + fecha BCD(6) +
// dataType(1) + vehicleType(1) + subcategoría(1) = 10 bytes, y el
// contenido específico arranca en el byte 10. En este codebase se
// viene usando offset=11 en vez de 10 para los parsers ya confirmados
// (parseAlarmData, la tabla periódica) — se mantiene ese mismo offset
// acá para los parsers nuevos, por consistencia con lo que ya está
// probado funcionando contra el equipo real.
//
//   0x02 = Trouble code reporting (DTC)               [NUEVO]
//   0x03 = Alarm and driving behavior data              (ya confirmado)
//   0x04 = Travel data (inicio/fin de viaje)           [NUEVO]
//   0xf0 = Reporte periódico normal (extensión propia de Jimi, no
//          documentada en la tabla base — la reversamos a mano y
//          ahora coincide con los offsets oficiales de la Tabla 25).
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

function readByte(tags, tag) {
    return (tags[tag] && tags[tag].length === 1) ? tags[tag].readUInt8(0) : null;
}
function readWord(tags, tag) {
    return (tags[tag] && tags[tag].length === 2) ? tags[tag].readUInt16BE(0) : null;
}
function readDword(tags, tag) {
    return (tags[tag] && tags[tag].length === 4) ? tags[tag].readUInt32BE(0) : null;
}
function readBool(tags, tag) {
    const v = readByte(tags, tag);
    return v === null ? null : !!v;
}

// Tags booleanos de la Tabla 25 (0x0500-0x0527) — estado del auto
// (luces, puertas, ventanillas, fallas, cinturones, etc). Se agrupan
// todos en un único JSON (status_flags) por lectura, en vez de una
// columna SQL por cada uno — son ~25 flags y la mayoría no cambian
// lectura a lectura.
const STATUS_FLAG_TAGS = {
    '0500': 'luz_alta', '0501': 'luz_baja', '0502': 'luz_posicion', '0503': 'luz_antiniebla',
    '0504': 'giro_izquierdo', '0505': 'giro_derecho', '0506': 'balizas',
    '0507': 'puerta_del_izq', '0508': 'puerta_del_der', '0509': 'puerta_tras_izq', '050a': 'puerta_tras_der', '050b': 'baul',
    '050c': 'seguro_general', '050d': 'seguro_del_izq', '050e': 'seguro_del_der', '050f': 'seguro_tras_izq', '0510': 'seguro_tras_der', '0511': 'seguro_baul',
    '0512': 'ventanilla_del_izq', '0513': 'ventanilla_del_der', '0514': 'ventanilla_tras_izq', '0515': 'ventanilla_tras_der', '0516': 'techo_solar',
    '0517': 'falla_ecm', '0518': 'falla_abs', '0519': 'falla_srs',
    '051a': 'alarma_aceite', '051b': 'alarma_presion_neumaticos', '051c': 'alarma_mantenimiento',
    '051d': 'airbag_desplegado', '051e': 'freno_mano_puesto',
    '0520': 'cinturon_conductor', '0521': 'cinturon_acompanante',
    '0523': 'llave_puesta', '0525': 'limpiaparabrisas_on', '0526': 'aire_acondicionado_on',
};

const SHIFT_POSITION = { 1: 'P', 2: 'R', 3: 'N', 4: 'D' };
const REMOTE_SIGNAL = { 0: 'sin_presionar', 1: 'desbloqueo', 2: 'bloqueo', 3: 'baul', 4: 'desbloqueo_largo', 5: 'bloqueo_largo' };

// Reporte periódico normal (type 0xf0) — datos del vehículo en vivo.
// Extendido para sacar TODO lo que trae la Tabla 25 del manual para
// vehículos de pasajeros, no solo los 8 campos de motor originales.
function parseTransparentTlv(unescapedBody) {
    const empty = {
        tags: {}, vin: null, rpm: null, battery_voltage: null, coolant_temp: null, engine_load: null,
        fuel_level: null, brake_pedal: null, accelerator_pedal: null, device_odometer_km: null,
        fuel_consumption_avg: null, fuel_consumption_instant: null, oil_pressure_kpa: null, oil_life_pct: null,
        intake_air_temp: null, cabin_temp: null, steering_angle: null, throttle_relative_pct: null,
        remaining_fuel_l: null, acc_signal: null, shift_position: null, remote_control_signal: null,
        statusFlags: null,
    };
    if (unescapedBody.length < 11) return empty;

    const rest = unescapedBody.slice(11);
    const tags = parseTags(rest);

    // --- Campos de motor, ya confirmados contra bytes reales ---
    let vin = null;
    if (tags['0001'] && tags['0001'].length === 17) {
        const text = tags['0001'].toString('ascii');
        if (/^[A-Z0-9]{17}$/.test(text)) vin = text;
    }
    const rpm = readWord(tags, '0536');
    const battery_voltage = tags['0530'] && tags['0530'].length === 2 ? tags['0530'].readUInt16BE(0) / 1000 : null;
    const coolant_temp = readByte(tags, '052d') !== null ? readByte(tags, '052d') - 40 : null;
    const engine_load = readByte(tags, '0114');
    const fuel_level = readByte(tags, '0544');
    const brake_pedal = readByte(tags, '051f');
    const accelerator_pedal = readByte(tags, '053f');

    // --- Campos NUEVOS de la Tabla 25 (todavía sin confirmar contra
    // bytes reales — validar apenas lleguen datos del VL502 en vivo) ---
    const device_odometer_km = readDword(tags, '0528') !== null ? readDword(tags, '0528') / 10 : null;
    const fuel_consumption_avg = readWord(tags, '0537') !== null ? readWord(tags, '0537') / 100 : null;
    const fuel_consumption_instant = readWord(tags, '0538') !== null ? readWord(tags, '0538') / 100 : null;
    const oil_pressure_kpa = readWord(tags, '053b') !== null ? readWord(tags, '053b') / 10 : null;
    const oil_life_pct = readByte(tags, '053a');
    const intake_air_temp = readByte(tags, '052e') !== null ? readByte(tags, '052e') - 40 : null;
    const cabin_temp = readByte(tags, '052f') !== null ? readByte(tags, '052f') - 40 : null;
    const steering_angle = readWord(tags, '0541');
    const throttle_relative_pct = readByte(tags, '0547');
    const remaining_fuel_l = readWord(tags, '0543') !== null ? readWord(tags, '0543') / 100 : null;
    const acc_signal = readBool(tags, '0522');
    const shiftRaw = readByte(tags, '0527');
    const shift_position = shiftRaw !== null ? (SHIFT_POSITION[shiftRaw] || `desconocido(${shiftRaw})`) : null;
    const remoteRaw = readByte(tags, '0524');
    const remote_control_signal = remoteRaw !== null ? (REMOTE_SIGNAL[remoteRaw] || `desconocido(${remoteRaw})`) : null;

    // --- Snapshot de estado (booleans) ---
    let statusFlags = null;
    const flagEntries = Object.entries(STATUS_FLAG_TAGS)
        .map(([tag, key]) => [key, readBool(tags, tag)])
        .filter(([, v]) => v !== null);
    if (flagEntries.length > 0) statusFlags = Object.fromEntries(flagEntries);

    return {
        tags, vin, rpm, battery_voltage, coolant_temp, engine_load, fuel_level, brake_pedal, accelerator_pedal,
        device_odometer_km, fuel_consumption_avg, fuel_consumption_instant, oil_pressure_kpa, oil_life_pct,
        intake_air_temp, cabin_temp, steering_angle, throttle_relative_pct, remaining_fuel_l, acc_signal,
        shift_position, remote_control_signal, statusFlags,
    };
}

// Tabla 28 completa del manual oficial (0x00-0x3E) — antes solo
// teníamos un subconjunto. Se deja completa para no perder ningún
// tipo de alarma que el equipo pueda llegar a mandar.
const ALARM_IDS = {
    0x00: 'Falla de hardware detectada en autodiagnóstico',
    0x01: 'Terminal conectado (plug-in)',
    0x02: 'Terminal desconectado (plug-out)',
    0x03: 'Alarma de alto voltaje',
    0x04: 'Alarma de bajo voltaje',
    0x05: 'Alarma de alta temperatura de agua',
    0x06: 'Alarma de baja temperatura de agua',
    0x07: 'Alarma de alta temperatura de aceite',
    0x08: 'Alarma de alta temperatura de combustible',
    0x09: 'Alarma de alta presión de aceite',
    0x0A: 'Alarma de presión de neumáticos anormal',
    0x0B: 'Combustible bajo',
    0x0C: 'Recordatorio de carga',
    0x0D: 'Precalentamiento excesivo',
    0x0E: 'Ralentí excesivo',
    0x0F: 'Manejando con combustible bajo',
    0x10: 'Auto recién arrancado manejando a alta velocidad',
    0x11: 'Manejando de noche sin luces',
    0x12: 'Manejando sin soltar el freno de mano',
    0x13: 'Manejando con puertas abiertas',
    0x14: 'Manejando con puertas sin seguro',
    0x15: 'Manejando con el baúl abierto',
    0x16: 'Alarma de punto muerto en movimiento (coasting)',
    0x17: 'Conductor sin cinturón',
    0x18: 'Acompañante sin cinturón',
    0x19: 'Carga rápida de combustible',
    0x1A: 'Aceleración brusca',
    0x1B: 'Frenada brusca',
    0x1C: 'Giro brusco',
    0x1D: 'Cambio de carril rápido',
    0x1E: 'Cruce de varios carriles de una vez',
    0x1F: 'Cambios de carril continuos',
    0x20: 'Alarma de emergencia',
    0x21: 'Salió de la geocerca',
    0x22: 'Entró a la geocerca',
    0x23: 'Manejo con fatiga (fatigue driving)',
    0x24: 'Tiempo acumulado de manejo sobre el umbral',
    0x25: 'Exceso de velocidad',
    0x26: 'Colisión (leve)',
    0x27: 'Colisión (severa)',
    0x28: 'Vuelco del vehículo',
    0x29: 'Freno pisado por tiempo prolongado',
    0x2A: 'Embrague pisado por tiempo prolongado',
    0x2B: 'Uso indebido del embrague (riding the clutch)',
    0x2C: 'Alerta de cambio de marcha',
    0x2D: 'Estacionado sin poner en P/N',
    0x2E: 'Alerta de colisión al estacionar',
    0x2F: 'Recordatorio de posible robo de combustible',
    0x30: 'Recordatorio de remolque',
    0x31: 'Alerta de puertas abiertas',
    0x32: 'Alerta de puertas sin seguro',
    0x33: 'Alerta de ventanillas abiertas',
    0x34: 'Alerta de baúl abierto',
    0x35: 'Alerta de techo solar abierto',
    0x36: 'Alerta de tapa de combustible abierta',
    0x37: 'Luces dejadas encendidas',
    0x38: 'Recordatorio de encendido (ignition on)',
    0x39: 'Recordatorio de apagado (ignition off)',
    0x3A: 'Alerta de despertar (wake-up)',
    0x3B: 'Nivel de urea sin cambios (anormal)',
    0x3C: 'Alerta de aumento de nivel de urea',
    0x3D: 'Manejando con falla del vehículo detectada',
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

// ============================================================
// [NUEVO] Trouble codes / DTC (subtipo 0x02, Tabla 26 del manual).
// Estructura: tipo(1)+fecha(6)+algo(4)=11 (mismo offset que el resto
// de subtipos en este codebase) + número de sistemas(WORD) + por
// cada sistema: systemID(DWORD) + cantidad de códigos(WORD) + lista
// de códigos (16 bytes cada uno) + status(4)+lat(4)+lon(4) al final.
// SIN CONFIRMAR contra bytes reales todavía — el auto de prueba
// (Ford Focus) puede no tener ningún DTC activo para validar esto
// hasta que aparezca una falla real u OBD simulado.
// ============================================================
function parseTroubleCodes(unescapedBody) {
    if (unescapedBody.length < 13) return { systems: [], lat: null, lon: null };

    let offset = 11;
    const totalSystems = unescapedBody.readUInt16BE(offset);
    offset += 2;

    const systems = [];
    for (let i = 0; i < totalSystems && offset + 6 <= unescapedBody.length; i++) {
        const systemId = unescapedBody.readUInt32BE(offset);
        offset += 4;
        const codeCount = unescapedBody.readUInt16BE(offset);
        offset += 2;
        const codes = [];
        for (let c = 0; c < codeCount && offset + 16 <= unescapedBody.length; c++) {
            codes.push(unescapedBody.slice(offset, offset + 16).toString('hex'));
            offset += 16;
        }
        systems.push({ systemId, codes });
    }

    let lat = null, lon = null;
    if (offset + 12 <= unescapedBody.length) {
        offset += 4; // status DWORD
        lat = -(unescapedBody.readUInt32BE(offset) / 1_000_000);
        lon = -(unescapedBody.readUInt32BE(offset + 4) / 1_000_000);
    }

    return { systems, lat, lon };
}

// ============================================================
// [NUEVO] Datos de viaje (subtipo 0x04, Tablas 29/30 del manual).
// El primer byte después del offset base indica si es inicio
// (0x01) o fin (0x02) de viaje — el body de fin trae odómetro y
// combustible reales del tramo, algo que hoy no tenemos (el
// TabHistorico actual reconstruye viajes solo con GPS/haversine).
// SIN CONFIRMAR contra bytes reales todavía.
// ============================================================
function parseTravelData(unescapedBody) {
    if (unescapedBody.length < 16) return null;

    let offset = 11;
    const travelProperty = unescapedBody[offset]; // 0x01 = inicio, 0x02 = fin
    offset += 1;
    const travelNumber = unescapedBody.readUInt32BE(offset);
    offset += 4;
    const startTimeBcd = unescapedBody.slice(offset, offset + 6);
    offset += 6;
    const startTime = bcdToDateString(startTimeBcd);

    if (travelProperty === 0x01) {
        // Inicio de viaje: no hay más datos.
        return { kind: 'inicio', travelNumber, startTime };
    }

    if (travelProperty === 0x02 && offset + 6 <= unescapedBody.length) {
        const endTimeBcd = unescapedBody.slice(offset, offset + 6);
        offset += 6;
        const endTime = bcdToDateString(endTimeBcd);

        let startLat = null, startLon = null, endLat = null, endLon = null;
        if (offset + 16 <= unescapedBody.length) {
            startLat = -(unescapedBody.readUInt32BE(offset) / 1_000_000); offset += 4;
            startLon = -(unescapedBody.readUInt32BE(offset) / 1_000_000); offset += 4;
            endLat = -(unescapedBody.readUInt32BE(offset) / 1_000_000); offset += 4;
            endLon = -(unescapedBody.readUInt32BE(offset) / 1_000_000); offset += 4;
        }
        if (offset < unescapedBody.length) offset += 1; // byte de signos lat/lon, no lo usamos (forzamos hemisferio)

        let idlingCount = null, idlingSeconds = null, distanceKm = null, fuelConsumedL = null;
        if (offset + 8 <= unescapedBody.length) {
            idlingCount = unescapedBody.readUInt16BE(offset); offset += 2;
            idlingSeconds = unescapedBody.readUInt16BE(offset); offset += 2;
            distanceKm = unescapedBody.readUInt16BE(offset) / 10; offset += 2;
            fuelConsumedL = unescapedBody.readUInt16BE(offset) / 100; offset += 2;
        }

        return {
            kind: 'fin', travelNumber, startTime, endTime,
            startLat, startLon, endLat, endLon,
            idlingCount, idlingSeconds, distanceKm, fuelConsumedL,
        };
    }

    return { kind: 'desconocido', travelProperty, travelNumber, startTime };
}

function bcdToDateString(bcdBuffer) {
    // YY-MM-DD-HH-MM-SS en BCD → 'YYYY-MM-DD HH:MM:SS' para insertar directo en DATETIME
    const digits = [...bcdBuffer].map(b => b.toString(16).padStart(2, '0'));
    const [yy, mm, dd, hh, mi, ss] = digits;
    return `20${yy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

// Reconstruye el "terminal ID" (6 bytes) que usa JT808 a partir del
// IMEI real guardado en nuestra base — son los primeros 14 dígitos
// del IMEI, empaquetados como entero grande de 6 bytes BE. Factorizado
// acá porque tanto buildTextCommandPacket como buildSetCircularFence
// lo necesitan.
function imeiToTerminalId(imei) {
    const prefixStr = imei.slice(0, 14);
    const prefixInt = parseInt(prefixStr, 10);
    const terminalId = Buffer.alloc(6);
    terminalId.writeUIntBE(prefixInt, 0, 6);
    return terminalId;
}

// ============================================================
// [NUEVO] Comandos servidor→equipo (Mensaje 0x8300 - Text Info)
// Envuelve comandos AT estándar de Jimi (como FENCE,ON...) dentro
// del protocolo JT808 para mandarlos al equipo VL502.
//
// OJO — SIN CONFIRMAR: 0x8300 en el estándar JT/T808 es para MOSTRAR
// un mensaje de texto en la pantalla del terminal, no para pasarle
// comandos de configuración tipo AT. Es muy probable que esto no haga
// nada real en el equipo (el VL502 no tiene pantalla ni parsea
// sintaxis GT06). Se deja acá para comandos de diagnóstico/texto
// libre desde TabComandos, PERO para geocercas usar
// buildSetCircularFence() de acá abajo, que sí es el mensaje correcto
// del estándar.
// ============================================================
function buildTextCommandPacket(imei, commandText) {
    const terminalId = imeiToTerminalId(imei);

    // Body: flag (1 byte) + texto. Flag 0x00 indica mensaje de texto normal.
    const flag = Buffer.from([0x00]);
    const textBuf = Buffer.from(commandText, 'ascii');
    const body = Buffer.concat([flag, textBuf]);

    // Generamos un serial number aleatorio para usar como ID de correlación
    const serialNo = Math.floor(Math.random() * 0xFFFF);
    const packet = buildFrame(0x8300, terminalId, serialNo, body);

    return { packet, correlationId: serialNo.toString(16).padStart(4, '0') };
}

// ============================================================
// [NUEVO 13/07/2026] Mensaje 0x8600 ("Set Circular Area") del
// estándar JT/T808 — este SÍ es el mensaje correcto para configurar
// una geocerca circular real en el equipo (a diferencia del 0x8300
// de arriba). Estructura según el estándar público:
//   Atributo de configuración(1) + Total de áreas(2) +
//   [ID de área(4) + Atributo de área(2) + Latitud centro(4) +
//    Longitud centro(4) + Radio en metros(4)]  (repetido por área,
//    acá mandamos una sola)
//
// Atributo de área usado acá (bitmask):
//   bit3 = alarma AL ENTRAR reportada a la plataforma
//   bit5 = alarma AL SALIR reportada a la plataforma
// (no usamos ventana horaria ni límite de velocidad — quedan en 0)
//
// SIN CONFIRMAR CONTRA BYTES REALES TODAVÍA. A diferencia de los tags
// de motor del VL502 (cruzados contra el manual específico del
// fabricante en Scribd), esto sale del estándar público JT/T808 sin
// un documento propio para confirmarlo. Falta la prueba real: crear
// la geocerca, cruzar el límite con el auto, y ver si aparece la
// alarma de geocerca (0x21=salió / 0x22=entró, ver ALARM_IDS) en el
// próximo 0x0900 subtipo 0x03. Recién ahí se puede confiar en esto.
// ============================================================
function buildSetCircularFence(imei, { fenceId, lat, lng, radiusM, mode }) {
    const terminalId = imeiToTerminalId(imei);

    const settingAttr = Buffer.from([0x00]); // 0 = actualizar (reemplaza cualquier área previa con este ID)
    const totalAreas = uint16be(1);

    const areaId = Buffer.alloc(4);
    areaId.writeUInt32BE(fenceId, 0);

    const areaAttr = uint16be(mode === 'IN' ? 0x0008 : 0x0020); // bit3=alarma al entrar, bit5=alarma al salir

    const latBuf = Buffer.alloc(4);
    latBuf.writeUInt32BE(Math.round(Math.abs(lat) * 1_000_000), 0);
    const lngBuf = Buffer.alloc(4);
    lngBuf.writeUInt32BE(Math.round(Math.abs(lng) * 1_000_000), 0);
    const radiusBuf = Buffer.alloc(4);
    radiusBuf.writeUInt32BE(Math.round(radiusM), 0);

    const body = Buffer.concat([settingAttr, totalAreas, areaId, areaAttr, latBuf, lngBuf, radiusBuf]);

    const serialNo = Math.floor(Math.random() * 0xFFFF);
    const packet = buildFrame(0x8600, terminalId, serialNo, body);

    return { packet, correlationId: `jt808-${serialNo}` };
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
    parseTroubleCodes,
    parseTravelData,
    ALARM_IDS,
    STATUS_FLAG_TAGS,
    buildTextCommandPacket,
    buildSetCircularFence,
    imeiToTerminalId,
};