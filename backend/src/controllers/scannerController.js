const crypto = require('crypto');
const pool = require('../config/database');
const { hashDeviceToken } = require('../middlewares/deviceAuth');

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
                    (SELECT COUNT(*) FROM DiagnosticSessions ds WHERE ds.scan_vehicle_id = sv.id) as total_sesiones
             FROM ScanVehicles sv WHERE sv.workshop_id = ? ORDER BY sv.created_at DESC`,
            [workshopId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error listando vehículos' });
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

        const [dtcResult] = await pool.query(
            `INSERT INTO DiagnosticDTC (session_id, decoded_code, description_guess, source) VALUES (?, ?, ?, ?)`,
            [session.id, dtc_code, dtc_description_es || null, ['local', 'remote', 'unknown'].includes(dtc_source) ? dtc_source : 'unknown']
        );

        res.status(201).json({ session_id: session.id, dtc_id: dtcResult.insertId });
    } catch (error) {
        console.error('[Scanner] Error en ingesta de diagnóstico:', error.message);
        res.status(500).json({ error: 'Error guardando el diagnóstico' });
    }
};

// ---- Vista en vivo para el mecánico — últimas tramas + DTCs de una sesión ----
const getSessionLive = async (req, res) => {
    const { id } = req.params;
    try {
        const [frames] = await pool.query(
            `SELECT id, recorded_at, protocol, can_id, raw_frame_hex, decoded_pid, decoded_value, decoded_unit
             FROM DiagnosticFrames WHERE session_id = ? ORDER BY recorded_at DESC LIMIT 200`,
            [id]
        );
        const [dtcs] = await pool.query(
            `SELECT id, detected_at, raw_code_hex, decoded_code, description_guess, confirmed_by_mechanic, mechanic_correction
             FROM DiagnosticDTC WHERE session_id = ? ORDER BY detected_at DESC`,
            [id]
        );
        res.json({ frames: frames.reverse(), dtcs });
    } catch (error) {
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

// ---- Vistas de SUPER_ADMIN — vos viendo todos los talleres ----
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

module.exports = {
    createWorkshop,
    listWorkshops,
    getWorkshopHistory,
    getMyWorkshop,
    claimScannerDevice,
    listMyDevices,
    createScanVehicle,
    listScanVehicles,
    startSession,
    endSession,
    ingestDiagnosticsLog,
    getSessionLive,
    confirmDtc,
};
