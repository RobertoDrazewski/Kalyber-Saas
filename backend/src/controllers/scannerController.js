const crypto = require('crypto');
const pool = require('../config/database');
const { hashDeviceToken } = require('../middlewares/deviceAuth');
const PDFDocument = require('pdfkit');

function generateDeviceToken() {
    // Mismo criterio que las ApiKeys de flota (crypto.randomBytes, se
    // muestra completo UNA sola vez). El mecánico lo copia al portal
    // cautivo del ESP32 (WiFiManager) como parámetro custom junto con
    // el WiFi/password de su local — de ahí en más el equipo lo manda
    // en cada request, nunca vuelve a pasar por texto plano acá.
    return `kalscan_${crypto.randomBytes(24).toString('hex')}`;
}

// ---- Alta de taller — SOLO super_admin (ver scannerRoutes.js) ----
// [AJUSTADO 17/07/2026] Antes asumía que quien crea el taller ES el
// dueño (req.user.id) — pero acá quien lo crea sos vos (super_admin),
// para UN CLIENTE distinto. El flujo real es: primero das de alta el
// login del mecánico con POST /api/users (rol 'admin', mismo endpoint
// que ya usás para flotas — no hizo falta inventar nada ahí), y ACÁ
// pasás ese owner_user_id + los datos comerciales del taller.
const createWorkshop = async (req, res) => {
    const { name, cuit, owner_name, phone, email, address, owner_user_id } = req.body;
    if (!name || !owner_user_id) {
        return res.status(400).json({ error: 'Faltan name y/o owner_user_id (creá primero el usuario del mecánico con POST /api/users)' });
    }
    try {
        const [[user]] = await pool.query('SELECT id FROM Users WHERE id = ?', [owner_user_id]);
        if (!user) return res.status(404).json({ error: 'owner_user_id no corresponde a ningún usuario existente' });

        const [result] = await pool.query(
            `INSERT INTO Workshops (name, cuit, owner_name, phone, email, address, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, cuit || null, owner_name || null, phone || null, email || null, address || null, owner_user_id]
        );
        res.json({ id: result.insertId, name });
    } catch (error) {
        console.error('[Scanner] Error creando taller:', error.message);
        res.status(500).json({ error: 'Error creando el taller' });
    }
};

// Resuelve el workshop_id del mecánico logueado — asume UN taller por
// usuario dueño por ahora (lo más simple para el MVP). Si el día de
// mañana un mecánico necesita varios locales bajo la misma cuenta,
// esto es lo primero que hay que generalizar.
async function resolveWorkshopId(userId) {
    const [[row]] = await pool.query('SELECT id FROM Workshops WHERE owner_user_id = ?', [userId]);
    return row ? row.id : null;
}

// ---- Parear un ESP32 nuevo al taller del mecánico logueado ----
// El mecánico escribe el device_uid que viene impreso/pegado en el
// equipo (grabado en fábrica por vos al armarlo). Esto genera el
// token que después el mecánico carga en el portal WiFi del equipo.
const claimScannerDevice = async (req, res) => {
    const { device_uid, label } = req.body;
    if (!device_uid) return res.status(400).json({ error: 'Falta el device_uid del equipo' });
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        if (!workshopId) return res.status(400).json({ error: 'Primero hay que crear el taller (POST /api/scanner/workshops)' });

        const rawToken = generateDeviceToken();
        const tokenHash = hashDeviceToken(rawToken);

        // UPSERT: si vos ya pre-cargaste el device_uid en la tabla al
        // fabricarlo (sin workshop_id todavía), esto lo reclama. Si no
        // existía, lo crea directo — así no dependemos de un paso
        // manual tuyo previo por cada unidad que vendas.
        const [existing] = await pool.query('SELECT id FROM ScannerDevices WHERE device_uid = ?', [device_uid]);
        if (existing.length > 0) {
            await pool.query(
                `UPDATE ScannerDevices SET workshop_id = ?, device_token_hash = ?, label = ?, paired_at = NOW() WHERE device_uid = ?`,
                [workshopId, tokenHash, label || null, device_uid]
            );
        } else {
            await pool.query(
                `INSERT INTO ScannerDevices (device_uid, workshop_id, device_token_hash, label, paired_at) VALUES (?, ?, ?, ?, NOW())`,
                [device_uid, workshopId, tokenHash, label || null]
            );
        }

        // Única vez que el token completo viaja por la red — el
        // mecánico lo tiene que copiar AHORA al portal cautivo del
        // equipo, no se puede volver a mostrar después.
        const [[device]] = await pool.query('SELECT id FROM ScannerDevices WHERE device_uid = ?', [device_uid]);
        res.json({ id: device.id, device_uid, device_token: rawToken, message: 'Copiá este token al portal WiFi del equipo — no se vuelve a mostrar.' });
    } catch (error) {
        console.error('[Scanner] Error pareando equipo:', error.message);
        res.status(500).json({ error: 'Error pareando el equipo' });
    }
};

// ---- Alta de un auto de un cliente del taller ----
const createScanVehicle = async (req, res) => {
    const { vin, brand, model, model_year, plate_photo_url, plate_text, customer_label } = req.body;
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        if (!workshopId) return res.status(400).json({ error: 'Taller no encontrado para este usuario' });

        const [result] = await pool.query(
            `INSERT INTO ScanVehicles (workshop_id, vin, brand, model, model_year, plate_photo_url, plate_text, customer_label)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [workshopId, vin || null, brand || null, model || null, model_year || null, plate_photo_url || null, plate_text || null, customer_label || null]
        );
        res.json({ id: result.insertId });
    } catch (error) {
        console.error('[Scanner] Error creando vehículo escaneado:', error.message);
        res.status(500).json({ error: 'Error creando el vehículo' });
    }
};

const listScanVehicles = async (req, res) => {
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        if (!workshopId) return res.json([]);
        const [rows] = await pool.query(
            `SELECT sv.*,
                    (SELECT COUNT(*) FROM DiagnosticSessions ds WHERE ds.scan_vehicle_id = sv.id) as total_sesiones,
                    (SELECT COUNT(*) FROM DiagnosticDTC dd JOIN DiagnosticSessions ds2 ON dd.session_id = ds2.id WHERE ds2.scan_vehicle_id = sv.id) as total_dtcs
             FROM ScanVehicles sv WHERE sv.workshop_id = ? ORDER BY sv.created_at DESC`,
            [workshopId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error listando vehículos' });
    }
};

// [NUEVO] El propio mecánico viendo el detalle de UN auto suyo — todas
// sus sesiones, con los DTCs de cada una. Distinto de getWorkshopHistory
// (esa es la vista de super_admin viendo TODOS los talleres); acá
// verificamos que el auto sea del taller de quien pregunta, no de otro.
const getScanVehicleHistory = async (req, res) => {
    const { id } = req.params;
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        const [[vehicle]] = await pool.query(
            `SELECT id, vin, brand, model, model_year, plate_text, customer_label, created_at
             FROM ScanVehicles WHERE id = ? AND workshop_id = ?`,
            [id, workshopId]
        );
        if (!vehicle) return res.status(404).json({ error: 'Auto no encontrado en tu taller' });

        const [sessions] = await pool.query(
            `SELECT id, mode, started_at, ended_at, status FROM DiagnosticSessions
             WHERE scan_vehicle_id = ? ORDER BY started_at DESC`,
            [id]
        );
        const sessionIds = sessions.map(s => s.id);
        let dtcsBySession = {};
        if (sessionIds.length > 0) {
            const [dtcs] = await pool.query(
                `SELECT id, session_id, detected_at, decoded_code, description_guess, source,
                        protocol, clear_status, clear_detail, cleared_at,
                        (decoded_code IS NOT NULL AND CHAR_LENGTH(decoded_code) >= 2 AND SUBSTRING(decoded_code, 2, 1) = '0') as is_generic,
                        confirmed_by_mechanic, mechanic_correction
                 FROM DiagnosticDTC WHERE session_id IN (?) ORDER BY detected_at DESC`,
                [sessionIds]
            );
            dtcsBySession = dtcs.reduce((acc, d) => {
                (acc[d.session_id] = acc[d.session_id] || []).push(d);
                return acc;
            }, {});
        }
        const sessionsWithDtcs = sessions.map(s => ({ ...s, dtcs: dtcsBySession[s.id] || [] }));

        res.json({ vehicle, sessions: sessionsWithDtcs });
    } catch (error) {
        console.error('[Scanner] Error obteniendo historial del vehículo:', error.message);
        res.status(500).json({ error: 'Error obteniendo el historial' });
    }
};

// ---- Iniciar una sesión de diagnóstico — ANTES de conectar físicamente el scanner al auto ----
const startSession = async (req, res) => {
    const { scan_vehicle_id, scanner_device_id, mode } = req.body;
    if (!scan_vehicle_id || !scanner_device_id) {
        return res.status(400).json({ error: 'Faltan scan_vehicle_id y/o scanner_device_id' });
    }
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        // Verificamos que el auto Y el equipo sean de ESTE taller — sin
        // esto, un mecánico podría (sin querer o a propósito) arrancar
        // una sesión contra el equipo de otro taller.
        const [[vehicle]] = await pool.query('SELECT id FROM ScanVehicles WHERE id = ? AND workshop_id = ?', [scan_vehicle_id, workshopId]);
        const [[device]] = await pool.query('SELECT id FROM ScannerDevices WHERE id = ? AND workshop_id = ?', [scanner_device_id, workshopId]);
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado en tu taller' });
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado en tu taller' });

        // Si ese equipo tenía otra sesión abierta (el mecánico se
        // olvidó de cerrarla), la cerramos sola — un ESP32 solo puede
        // estar "adentro" de un auto a la vez.
        await pool.query(`UPDATE DiagnosticSessions SET status='finalizada', ended_at=NOW() WHERE scanner_device_id = ? AND status='en_curso'`, [scanner_device_id]);

        const [result] = await pool.query(
            `INSERT INTO DiagnosticSessions (scan_vehicle_id, scanner_device_id, mode) VALUES (?, ?, ?)`,
            [scan_vehicle_id, scanner_device_id, mode === 'simulator' ? 'simulator' : 'scanner']
        );
        res.json({ session_id: result.insertId, status: 'en_curso' });
    } catch (error) {
        console.error('[Scanner] Error iniciando sesión:', error.message);
        res.status(500).json({ error: 'Error iniciando la sesión' });
    }
};

const endSession = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE DiagnosticSessions SET status='finalizada', ended_at=NOW() WHERE id = ? AND status='en_curso'`, [id]);
        res.json({ message: 'Sesión finalizada' });
    } catch (error) {
        res.status(500).json({ error: 'Error finalizando la sesión' });
    }
};

// ---- INGESTA — esto es lo que llama el ESP32, autenticado por header x-internal-secret ----
// [REESCRITO 17/07/2026 contra backend_client.cpp real] El firmware
// NO manda tramas en lote ni conoce ningún session_id — manda UN POST
// por cada DTC que detecta, con la patente que el mecánico cargó en el
// equipo y el IMEI/UID del propio equipo. Acá:
//   1. Resolvemos el ScanVehicle por patente, DENTRO del taller de
//      este equipo (nunca cruzamos datos entre talleres distintos).
//   2. Si no hay ninguna DiagnosticSession 'en_curso' para ese auto +
//      ese equipo, la abrimos sola — el mecánico no tiene que apretar
//      ningún botón de "empezar sesión" a propósito, para no
//      complicarle el uso en el taller real.
//   3. Guardamos el DTC ya decodificado que mandó el firmware
//      (dtc_code/dtc_description_es/dtc_source) — el campo
//      raw_code_hex queda NULL por ahora, el firmware todavía no
//      manda la trama cruda.
const ingestDiagnosticsLog = async (req, res) => {
    const { patente, dtc_code, dtc_description_es, dtc_source, device_imei } = req.body;
    if (!patente || !dtc_code) {
        return res.status(400).json({ error: 'Faltan patente y/o dtc_code en el body' });
    }
    try {
        // El device_imei del body es solo informativo/logging — quien
        // realmente identifica al equipo es el header x-internal-secret
        // (ya resuelto en req.scannerDevice por el middleware). Si no
        // coincide con lo que tenemos registrado, lo dejamos pasar
        // igual pero lo logueamos, por si hace falta debuggear un
        // mismatch de configuración en algún equipo de campo.
        if (device_imei && req.scannerDevice.device_uid !== device_imei) {
            console.warn(`[Scanner] device_imei del body (${device_imei}) no coincide con el device_uid pareado (${req.scannerDevice.device_uid}) — se usa igual el del token.`);
        }

        const [[vehicle]] = await pool.query(
            `SELECT id FROM ScanVehicles WHERE workshop_id = ? AND plate_text = ? ORDER BY created_at DESC LIMIT 1`,
            [req.scannerDevice.workshop_id, patente]
        );
        if (!vehicle) {
            // No inventamos el auto solo — el mecánico tiene que haberlo
            // cargado antes desde la app (con foto de patente/VIN). Le
            // devolvemos un error claro para que el firmware lo pueda
            // mostrar (ej: LED rojo parpadeante distinto, o mensaje en
            // el display OLED cuando lo integren).
            return res.status(404).json({ error: `No hay ningún auto cargado con la patente "${patente}" en este taller — hay que crearlo primero desde la app antes de escanear.` });
        }

        let [[session]] = await pool.query(
            `SELECT id FROM DiagnosticSessions WHERE scan_vehicle_id = ? AND scanner_device_id = ? AND status = 'en_curso' ORDER BY started_at DESC LIMIT 1`,
            [vehicle.id, req.scannerDevice.id]
        );
        if (!session) {
            const [result] = await pool.query(
                `INSERT INTO DiagnosticSessions (scan_vehicle_id, scanner_device_id, mode) VALUES (?, ?, ?)`,
                [vehicle.id, req.scannerDevice.id, req.scannerDevice.mode]
            );
            session = { id: result.insertId };
        }

        // [NUEVO 28/07/2026] protocol = 'OBD-II' fijo: hoy es el ÚNICO
        // protocolo que llega hasta este endpoint (j1939Engine y
        // j1708Engine todavía son sniffer-only en el firmware, no suben
        // DTC). El día que eso cambie, este INSERT es el único lugar que
        // hay que tocar para leer un protocol real del body.
        const [dtcResult] = await pool.query(
            `INSERT INTO DiagnosticDTC (session_id, decoded_code, description_guess, source, protocol) VALUES (?, ?, ?, ?, ?)`,
            [session.id, dtc_code, dtc_description_es || null, ['local', 'remote', 'unknown'].includes(dtc_source) ? dtc_source : 'unknown', 'OBD-II']
        );

        res.status(201).json({ session_id: session.id, dtc_id: dtcResult.insertId });
    } catch (error) {
        console.error('[Scanner] Error en ingesta de diagnóstico:', error.message);
        res.status(500).json({ error: 'Error guardando el diagnóstico' });
    }
};

// ---- Vista en vivo para el mecánico — últimas tramas + DTCs de una sesión ----
// [ACTUALIZADO 28/07/2026]
//   1. Agrega "device": estado del equipo (online/wifi/último visto)
//      para el panel en vivo de ScannerMechanicView.jsx — honesto con
//      lo que el backend realmente sabe, no inventa "leyendo X ahora"
//      salvo que haya un DTC de verdad detectado hace <15s.
//   2. Cada DTC ahora trae protocol/is_generic/clear_status/clear_detail
//      — lo que necesita el DtcCard "pro" (badge de protocolo, badge
//      de fabricante, y el estado del botón "Borrar falla").
//   3. [FIX de seguridad, de paso] Antes esta consulta no verificaba
//      que la sesión pedida fuera de un auto del taller de quien
//      pregunta — cualquier 'taller' autenticado podía ver el /live
//      de OTRO taller sabiendo el session_id. Ahora se valida igual
//      que en getScanVehicleHistory. super_admin (sin taller propio)
//      sigue viendo cualquiera, como en el resto del panel admin.
const getSessionLive = async (req, res) => {
    const { id } = req.params;
    try {
        const workshopId = await resolveWorkshopId(req.user.id);

        const [[session]] = await pool.query(
            `SELECT ds.id, ds.scanner_device_id, sv.workshop_id, sd.last_seen_at,
                    (sd.last_seen_at IS NOT NULL AND sd.last_seen_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)) as online
             FROM DiagnosticSessions ds
             JOIN ScannerDevices sd ON ds.scanner_device_id = sd.id
             JOIN ScanVehicles sv ON ds.scan_vehicle_id = sv.id
             WHERE ds.id = ?`,
            [id]
        );
        if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
        if (workshopId && session.workshop_id !== workshopId) {
            return res.status(404).json({ error: 'Sesión no encontrada en tu taller' });
        }

        const [frames] = await pool.query(
            `SELECT id, recorded_at, protocol, can_id, raw_frame_hex, decoded_pid, decoded_value, decoded_unit
             FROM DiagnosticFrames WHERE session_id = ? ORDER BY recorded_at DESC LIMIT 200`,
            [id]
        );
        const [dtcs] = await pool.query(
            `SELECT id, detected_at, raw_code_hex, decoded_code, description_guess,
                    protocol, clear_status, clear_detail, cleared_at,
                    (decoded_code IS NOT NULL AND CHAR_LENGTH(decoded_code) >= 2 AND SUBSTRING(decoded_code, 2, 1) = '0') as is_generic,
                    confirmed_by_mechanic, mechanic_correction
             FROM DiagnosticDTC WHERE session_id = ? ORDER BY detected_at DESC`,
            [id]
        );

        const [[recentDtc]] = await pool.query(
            `SELECT protocol, detected_at FROM DiagnosticDTC WHERE session_id = ? ORDER BY detected_at DESC LIMIT 1`,
            [id]
        );
        const recentEnough = recentDtc && (Date.now() - new Date(recentDtc.detected_at).getTime() < 15000);

        const device = {
            online: !!session.online,
            wifiConnected: !!session.online, // el equipo solo manda heartbeat/DTC con WiFi arriba — mismo dato, no hay una señal separada
            activeProtocol: recentEnough ? recentDtc.protocol : null,
            lastFrameAt: session.last_seen_at,
        };

        res.json({ frames: frames.reverse(), dtcs, device });
    } catch (error) {
        console.error('[Scanner] Error obteniendo datos en vivo de la sesión:', error.message);
        res.status(500).json({ error: 'Error obteniendo datos en vivo de la sesión' });
    }
};

// ---- El mecánico confirma o corrige un DTC después de revisar el auto — esto es lo que arma tu librería con datos reales ----
const confirmDtc = async (req, res) => {
    const { id } = req.params;
    const { confirmed, correction } = req.body; // confirmed: true/false, correction: texto libre si confirmed=false
    try {
        await pool.query(
            `UPDATE DiagnosticDTC SET confirmed_by_mechanic = ?, mechanic_correction = ? WHERE id = ?`,
            [confirmed ? 1 : 0, confirmed ? null : (correction || null), id]
        );
        res.json({ message: 'Diagnóstico actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando el DTC' });
    }
};

// ============================================================
// [NUEVO 28/07/2026] Borrado de fallas (Mode $04) — el contrato que
// ya está esperando el firmware del Taller Mini (ver backend_client.h
// del proyecto KalyberScanner-TallerMini). Tres puntas:
//   1. requestClearDtc      — el mecánico aprieta "Borrar falla" en la app
//   2. getPendingClearForDevice — el equipo pregunta cada 5s "¿hay algo para mí?"
//   3. reportClearResult    — el equipo reporta qué pasó
// ============================================================

// ---- 1) El mecánico pide borrar un DTC puntual ----
const requestClearDtc = async (req, res) => {
    const { id } = req.params;
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        if (!workshopId) return res.status(400).json({ error: 'Taller no encontrado para este usuario' });

        // El DTC tiene que ser de un auto de ESTE taller — mismo
        // aislamiento que el resto del controller. De paso, traemos todo
        // lo necesario para decidir si el pedido tiene sentido: con qué
        // patente identificar el auto en el equipo, y si ese equipo está
        // conectado ahora mismo (si no, el pedido quedaría pendiente para
        // siempre sin que el mecánico se entere de por qué).
        const [[row]] = await pool.query(
            `SELECT dd.id, dd.clear_status, sv.plate_text,
                    (sd.last_seen_at IS NOT NULL AND sd.last_seen_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)) as device_online
             FROM DiagnosticDTC dd
             JOIN DiagnosticSessions ds ON dd.session_id = ds.id
             JOIN ScanVehicles sv ON ds.scan_vehicle_id = sv.id
             JOIN ScannerDevices sd ON ds.scanner_device_id = sd.id
             WHERE dd.id = ? AND sv.workshop_id = ?`,
            [id, workshopId]
        );
        if (!row) return res.status(404).json({ error: 'DTC no encontrado en tu taller' });
        if (!row.plate_text) return res.status(409).json({ error: 'Este auto no tiene patente cargada — el equipo no puede identificarlo para borrar' });
        if (!row.device_online) return res.status(409).json({ error: 'El equipo no está conectado ahora mismo — no se puede enviar el borrado' });
        if (row.clear_status === 'pending') return res.status(409).json({ error: 'Ya hay un borrado en curso para esta falla' });

        await pool.query(
            `UPDATE DiagnosticDTC SET clear_status = 'pending', clear_requested_at = NOW(), clear_detail = NULL WHERE id = ?`,
            [id]
        );
        res.json({ ok: true, message: 'Pedido enviado — el equipo lo va a tomar en los próximos segundos.' });
    } catch (error) {
        console.error('[Scanner] Error pidiendo borrado de DTC:', error.message);
        res.status(500).json({ error: 'Error pidiendo el borrado' });
    }
};

// ---- 2) El equipo pregunta si hay un borrado pendiente para él ----
// Auth por device token (igual que /internal/diagnostics-log), NO por
// JWT de usuario — este endpoint lo llama el ESP32 directo, cada 5s
// (CLEAR_POLL_MS en el firmware).
const getPendingClearForDevice = async (req, res) => {
    try {
        const [[row]] = await pool.query(
            `SELECT dd.decoded_code, sv.plate_text
             FROM DiagnosticDTC dd
             JOIN DiagnosticSessions ds ON dd.session_id = ds.id
             JOIN ScanVehicles sv ON ds.scan_vehicle_id = sv.id
             WHERE ds.scanner_device_id = ? AND dd.clear_status = 'pending'
             ORDER BY dd.clear_requested_at ASC LIMIT 1`,
            [req.scannerDevice.id]
        );
        if (!row) return res.json({ pending: false });
        res.json({ pending: true, patente: row.plate_text, dtc_code: row.decoded_code });
    } catch (error) {
        console.error('[Scanner] Error consultando borrado pendiente:', error.message);
        res.status(500).json({ error: 'Error consultando borrado pendiente' });
    }
};

// ---- 3) El equipo reporta el resultado del Mode $04 ----
// Body esperado (ver BackendClient::reportClearResult en el firmware):
//   { patente, dtc_code, success, nrc_code, detail }
const reportClearResult = async (req, res) => {
    const { patente, dtc_code, success, detail } = req.body;
    if (!patente || !dtc_code) {
        return res.status(400).json({ error: 'Faltan patente y/o dtc_code en el body' });
    }
    try {
        const [[row]] = await pool.query(
            `SELECT dd.id
             FROM DiagnosticDTC dd
             JOIN DiagnosticSessions ds ON dd.session_id = ds.id
             JOIN ScanVehicles sv ON ds.scan_vehicle_id = sv.id
             WHERE ds.scanner_device_id = ? AND sv.plate_text = ? AND dd.decoded_code = ? AND dd.clear_status = 'pending'
             ORDER BY dd.clear_requested_at ASC LIMIT 1`,
            [req.scannerDevice.id, patente, dtc_code]
        );
        if (!row) {
            // No hay match contra un pedido pendiente — pudo ser un
            // reporte duplicado (el equipo reintentando) o el mecánico
            // canceló entre medio. Contestamos 200 igual para que el
            // equipo no quede reintentando en loop; queda logueado por
            // si hace falta revisar un caso puntual.
            console.warn(`[Scanner] clear-result sin pedido pendiente que matchee — device=${req.scannerDevice.device_uid} patente=${patente} dtc=${dtc_code}`);
            return res.json({ ok: true, matched: false });
        }

        await pool.query(
            `UPDATE DiagnosticDTC SET clear_status = ?, clear_detail = ?, cleared_at = ? WHERE id = ?`,
            [success ? 'success' : 'failed', detail || null, success ? new Date() : null, row.id]
        );
        res.json({ ok: true, matched: true });
    } catch (error) {
        console.error('[Scanner] Error guardando resultado de borrado:', error.message);
        res.status(500).json({ error: 'Error guardando el resultado del borrado' });
    }
};

// ---- Vistas de SUPER_ADMIN — vos viendo todos los talleres ----
// ============================================================
// [NUEVO 19/07/2026] Provisioning de equipos — SOLO super_admin.
// Flujo del barcode: acá se genera y pre-carga cada device_uid con
// formato ordenado (KAL-SCAN-XXXX) ANTES de despachar el equipo. Ese
// número es el que va impreso en el barcode de la tapa. Cuando el
// taller lo parea (claimScannerDevice), esa fila ya existe con
// workshop_id NULL y el UPSERT simplemente la reclama.
// ============================================================
const UID_PREFIX = 'KAL-SCAN-';

const provisionScannerDevice = async (req, res) => {
    try {
        // Buscar el número más alto ya usado con nuestro prefijo, para
        // seguir la serie sin huecos ni colisiones. Se hace en una
        // transacción con lock para que dos provisioning simultáneos no
        // saquen el mismo número.
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query(
                `SELECT device_uid FROM ScannerDevices
                 WHERE device_uid LIKE ? ORDER BY device_uid DESC LIMIT 1 FOR UPDATE`,
                [UID_PREFIX + '%']
            );

            let nextNum = 1;
            if (rows.length > 0) {
                const lastNum = parseInt(rows[0].device_uid.replace(UID_PREFIX, ''), 10);
                if (Number.isFinite(lastNum)) nextNum = lastNum + 1;
            }
            const deviceUid = UID_PREFIX + String(nextNum).padStart(4, '0');

            const [result] = await conn.query(
                `INSERT INTO ScannerDevices (device_uid, workshop_id, label, created_at)
                 VALUES (?, NULL, ?, NOW())`,
                [deviceUid, req.body.label || null]
            );
            await conn.commit();

            res.json({
                id: result.insertId,
                device_uid: deviceUid,
                message: `Equipo ${deviceUid} pre-cargado. Imprimí este código en la tapa — el taller lo va a escanear al parear.`,
            });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('[Scanner] Error en provisioning:', error.message);
        res.status(500).json({ error: 'Error generando el equipo' });
    }
};

// Lista de equipos provisionados, para tu control de stock: cuáles ya
// se vendieron (tienen workshop_id) y cuáles siguen sin asignar.
const listProvisionedDevices = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT d.id, d.device_uid, d.label, d.workshop_id, d.paired_at, d.last_seen_at,
                    d.created_at, w.name as workshop_name,
                    (d.workshop_id IS NOT NULL) as reclamado,
                    (d.last_seen_at IS NOT NULL AND d.last_seen_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)) as online
             FROM ScannerDevices d
             LEFT JOIN Workshops w ON d.workshop_id = w.id
             WHERE d.device_uid LIKE ?
             ORDER BY d.device_uid DESC`,
            [UID_PREFIX + '%']
        );
        res.json(rows);
    } catch (error) {
        console.error('[Scanner] Error listando equipos provisionados:', error.message);
        res.status(500).json({ error: 'Error listando equipos' });
    }
};

const listWorkshops = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT w.*,
                    (SELECT COUNT(*) FROM ScannerDevices d WHERE d.workshop_id = w.id) as equipos_pareados,
                    (SELECT COUNT(*) FROM ScanVehicles sv WHERE sv.workshop_id = w.id) as autos_escaneados,
                    (SELECT COUNT(*) FROM DiagnosticDTC dd JOIN DiagnosticSessions ds ON dd.session_id = ds.id
                       JOIN ScanVehicles sv2 ON ds.scan_vehicle_id = sv2.id WHERE sv2.workshop_id = w.id) as dtcs_totales
             FROM Workshops w ORDER BY w.created_at DESC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error listando talleres' });
    }
};

// Histórico completo de UN taller — autos + sesiones + DTC de cada
// uno. Deliberadamente NO incluye plate_photo_url/plate_text acá
// salvo que el super_admin lo pida explícito en otro endpoint más
// adelante — ver nota de privacidad al principio de la migración.
const getWorkshopHistory = async (req, res) => {
    const { id } = req.params;
    try {
        const [vehicles] = await pool.query(
            `SELECT sv.id, sv.vin, sv.brand, sv.model, sv.model_year, sv.customer_label, sv.created_at,
                    (SELECT COUNT(*) FROM DiagnosticSessions ds WHERE ds.scan_vehicle_id = sv.id) as sesiones,
                    (SELECT COUNT(*) FROM DiagnosticDTC dd JOIN DiagnosticSessions ds2 ON dd.session_id = ds2.id WHERE ds2.scan_vehicle_id = sv.id) as dtcs
             FROM ScanVehicles sv WHERE sv.workshop_id = ? ORDER BY sv.created_at DESC`,
            [id]
        );
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo el histórico del taller' });
    }
};

// ---- El propio usuario logueado pregunta "¿soy dueño de un taller?" ----
// [NUEVO 17/07/2026] Necesario para el Login: como el mecánico usa el
// mismo rol 'admin' que un cliente de flota, no hay forma de saber a
// qué vista mandarlo (dashboard de flota vs. /scanner) sin esto.
const getMyWorkshop = async (req, res) => {
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        if (!workshopId) return res.json(null);
        const [[workshop]] = await pool.query('SELECT id, name FROM Workshops WHERE id = ?', [workshopId]);
        res.json(workshop || null);
    } catch (error) {
        res.status(500).json({ error: 'Error consultando el taller' });
    }
};

const listMyDevices = async (req, res) => {
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        if (!workshopId) return res.json([]);
        const [rows] = await pool.query(
            `SELECT id, device_uid, label, mode, last_seen_at,
                    (last_seen_at IS NOT NULL AND last_seen_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)) as online
             FROM ScannerDevices WHERE workshop_id = ? ORDER BY paired_at DESC`,
            [workshopId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error listando equipos' });
    }
};

// ============================================================
// [NUEVO 19/07/2026] Las 3 herramientas extra del Plan Taller — el
// "plus" que justifica pagar mensualidad más allá de "conectar y
// listo": reporte para el cliente del taller, aviso de auto repetido,
// y estadísticas propias.
// ============================================================

// ---- 1) Reporte PDF de un vehículo escaneado — PARA EL CLIENTE DEL TALLER ----
// A diferencia de las vistas de super_admin (donde la patente/foto se
// excluyen a propósito por privacidad), ACÁ SÍ corresponde mostrarlas
// — es el propio taller entregándole el reporte a SU cliente, el
// dueño del auto. Es un documento completamente distinto en cuanto a
// qué información es apropiada mostrar.
const getVehicleReportPdf = async (req, res) => {
    const { id } = req.params;
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        const [[vehicle]] = await pool.query(
            `SELECT sv.*, w.name as workshop_name, w.phone as workshop_phone
             FROM ScanVehicles sv JOIN Workshops w ON sv.workshop_id = w.id
             WHERE sv.id = ? AND sv.workshop_id = ?`,
            [id, workshopId]
        );
        if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado en tu taller' });

        const [sessions] = await pool.query(
            `SELECT id, started_at, ended_at, status FROM DiagnosticSessions
             WHERE scan_vehicle_id = ? ORDER BY started_at DESC`,
            [id]
        );
        const sessionIds = sessions.map(s => s.id);
        let dtcs = [];
        if (sessionIds.length > 0) {
            [dtcs] = await pool.query(
                `SELECT session_id, detected_at, decoded_code, description_guess, confirmed_by_mechanic, mechanic_correction
                 FROM DiagnosticDTC WHERE session_id IN (?) ORDER BY detected_at DESC`,
                [sessionIds]
            );
        }

        // ---- Armado del PDF ----
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="diagnostico-${vehicle.plate_text || vehicle.id}.pdf"`);
        doc.pipe(res);

        // Encabezado
        doc.fontSize(20).fillColor('#1E293B').text(vehicle.workshop_name, { align: 'left' });
        doc.fontSize(10).fillColor('#64748B').text(vehicle.workshop_phone || '', { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(16).fillColor('#6366F1').text('Reporte de Diagnóstico OBD-II', { align: 'left' });
        doc.moveDown(1);
        doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Datos del vehículo — acá SÍ va la patente, es el reporte del cliente del taller
        doc.fontSize(11).fillColor('#1E293B');
        doc.text(`Patente: ${vehicle.plate_text || '—'}`);
        doc.text(`Marca / Modelo: ${vehicle.brand || '—'} ${vehicle.model || ''} ${vehicle.model_year ? `(${vehicle.model_year})` : ''}`);
        if (vehicle.vin) doc.text(`VIN: ${vehicle.vin}`);
        if (vehicle.customer_label) doc.text(`Cliente: ${vehicle.customer_label}`);
        doc.text(`Fecha del reporte: ${new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}`);
        doc.moveDown(1.5);

        if (dtcs.length === 0) {
            doc.fontSize(12).fillColor('#10B981').text('✓ Sin fallas detectadas en las sesiones registradas.');
        } else {
            doc.fontSize(13).fillColor('#1E293B').text('Códigos de falla detectados:', { underline: true });
            doc.moveDown(0.5);
            dtcs.forEach(d => {
                doc.fontSize(11).fillColor('#EF4444').text(`${d.decoded_code || '—'}`, { continued: true });
                doc.fillColor('#475569').text(`  —  ${d.description_guess || 'Sin descripción'}`);
                doc.fontSize(9).fillColor('#94A3B8').text(`Detectado: ${new Date(d.detected_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}`);
                if (d.confirmed_by_mechanic === 1) {
                    doc.fillColor('#10B981').text('✓ Confirmado por el mecánico');
                } else if (d.confirmed_by_mechanic === 0) {
                    doc.fillColor('#F59E0B').text(`⚠ Corregido por el mecánico: ${d.mechanic_correction || '(sin detalle)'}`);
                }
                doc.moveDown(0.8);
            });
        }

        doc.moveDown(2);
        doc.fontSize(8).fillColor('#94A3B8').text('Generado automáticamente por Kalyber Scanner — kalyber.com.ar', { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('[Scanner] Error generando reporte PDF:', error.message);
        if (!res.headersSent) res.status(500).json({ error: 'Error generando el reporte' });
    }
};

// ---- 2) "Este auto ya estuvo acá" — búsqueda por patente ANTES de escanear ----
const lookupScanVehicleByPlate = async (req, res) => {
    const { plate } = req.query;
    if (!plate || plate.trim().length < 3) return res.json(null);
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        const [[vehicle]] = await pool.query(
            `SELECT id, vin, brand, model, model_year, plate_text, customer_label, created_at
             FROM ScanVehicles WHERE workshop_id = ? AND plate_text = ? ORDER BY created_at DESC LIMIT 1`,
            [workshopId, plate.trim().toUpperCase()]
        );
        if (!vehicle) return res.json(null);

        const [[lastSession]] = await pool.query(
            `SELECT ds.id, ds.started_at,
                    (SELECT COUNT(*) FROM DiagnosticDTC dd WHERE dd.session_id = ds.id) as dtc_count
             FROM DiagnosticSessions ds WHERE ds.scan_vehicle_id = ? ORDER BY ds.started_at DESC LIMIT 1`,
            [vehicle.id]
        );
        const [[totals]] = await pool.query(
            `SELECT COUNT(*) as total_sesiones FROM DiagnosticSessions WHERE scan_vehicle_id = ?`,
            [vehicle.id]
        );

        res.json({ ...vehicle, total_sesiones: totals.total_sesiones, last_session: lastSession || null });
    } catch (error) {
        console.error('[Scanner] Error buscando vehículo por patente:', error.message);
        res.status(500).json({ error: 'Error buscando el vehículo' });
    }
};

// ---- 3) Estadísticas propias del taller ----
const getWorkshopStats = async (req, res) => {
    try {
        const workshopId = await resolveWorkshopId(req.user.id);
        if (!workshopId) return res.json(null);

        const [[totals]] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM ScanVehicles WHERE workshop_id = ?) as total_autos,
                (SELECT COUNT(*) FROM ScanVehicles WHERE workshop_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as autos_ultimo_mes,
                (SELECT COUNT(*) FROM DiagnosticDTC dd JOIN DiagnosticSessions ds ON dd.session_id = ds.id
                   JOIN ScanVehicles sv ON ds.scan_vehicle_id = sv.id WHERE sv.workshop_id = ?) as total_dtcs`,
            [workshopId, workshopId, workshopId]
        );

        // Top 5 marcas más escaneadas
        const [topBrands] = await pool.query(
            `SELECT brand, COUNT(*) as cantidad FROM ScanVehicles
             WHERE workshop_id = ? AND brand IS NOT NULL AND brand != ''
             GROUP BY brand ORDER BY cantidad DESC LIMIT 5`,
            [workshopId]
        );

        // Top 5 códigos DTC más comunes en este taller — esto es
        // justo el dato que le sirve al mecánico para saber qué
        // repuestos tener a mano.
        const [topDtcs] = await pool.query(
            `SELECT dd.decoded_code, dd.description_guess, COUNT(*) as cantidad
             FROM DiagnosticDTC dd
             JOIN DiagnosticSessions ds ON dd.session_id = ds.id
             JOIN ScanVehicles sv ON ds.scan_vehicle_id = sv.id
             WHERE sv.workshop_id = ? AND dd.decoded_code IS NOT NULL
             GROUP BY dd.decoded_code, dd.description_guess ORDER BY cantidad DESC LIMIT 5`,
            [workshopId]
        );

        res.json({ ...totals, topBrands, topDtcs });
    } catch (error) {
        console.error('[Scanner] Error obteniendo estadísticas del taller:', error.message);
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
};

module.exports = {
    createWorkshop,
    listWorkshops,
    getWorkshopHistory,
    getMyWorkshop,
    claimScannerDevice,
    listMyDevices,
    createScanVehicle,
    listScanVehicles,
    getScanVehicleHistory,
    startSession,
    endSession,
    ingestDiagnosticsLog,
    getSessionLive,
    confirmDtc,
    getVehicleReportPdf,
    lookupScanVehicleByPlate,
    getWorkshopStats,
    provisionScannerDevice,
    listProvisionedDevices,
    requestClearDtc,
    getPendingClearForDevice,
    reportClearResult,
};