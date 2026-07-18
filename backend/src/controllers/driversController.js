const pool = require('../config/database');
const { effectiveOwnerId } = require('../middlewares/requireRole');
const gt06Internal = require('../services/gt06InternalClient'); // FIX 13/07/2026: ver nota en gt06InternalClient.js — llamar a gt06Server directo daba un activeSockets vacío, este proceso corre separado del que tiene los equipos conectados

// Código corto de activación — alternativa fácil de tipear al IMEI
// completo. NO es secuencial/adivinable como un id de base de datos:
// 6 caracteres al azar (sin 0/O/1/I para no confundir al escribirlo
// a mano), suficiente para no chocar ni ser adivinado por otro cliente.
function generateActivationCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0,O,1,I
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

// ============================================================
// Alta de equipo (por IMEI) — SOLO super_admin (ver deviceRoutes.js).
//
// FIX clave: el equipo se crea SIN owner_id (queda "en stock",
// owner_id = NULL). Antes se creaba con owner_id = super_admin.id,
// lo que hacía que NINGÚN admin pudiera parearlo después (ver
// pairDevice más abajo) — el bug que iba a bloquear la activación
// de los equipos que llegan mañana.
// ============================================================
const addDevice = async (req, res) => {
    const { imei, label, model, phone_number } = req.body;
    if (!imei) return res.status(400).json({ error: 'Falta el IMEI' });
    if (model && !['VL04', 'VL502'].includes(model)) {
        return res.status(400).json({ error: 'Modelo inválido (tiene que ser VL04 o VL502)' });
    }
    try {
        let activationCode, inserted = false, result;
        // Reintenta si por casualidad choca con uno ya existente (muy
        // improbable con 33^6 combinaciones, pero mejor cubrirlo).
        for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
            activationCode = generateActivationCode();
            try {
                [result] = await pool.query(
                    `INSERT INTO Devices (imei, label, model, phone_number, activation_code, status, owner_id) VALUES (?, ?, ?, ?, ?, 'unpaired', NULL)`,
                    [imei, label || null, model || 'VL502', phone_number || null, activationCode]
                );
                inserted = true;
            } catch (err) {
                if (err.code === 'ER_DUP_ENTRY' && err.message.includes('activation_code')) continue; // reintentar con otro código
                throw err;
            }
        }
        res.json({ id: result.insertId, imei, label, model: model || 'VL502', phone_number, activation_code: activationCode, status: 'unpaired' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ese IMEI ya está registrado' });
        }
        res.status(500).json({ error: 'Error dando de alta el equipo' });
    }
};

// Para un admin, solo le mostramos SU equipo ya reclamado — no la
// bolsa de stock sin asignar (para eso está el flujo de "vincular
// por IMEI" en pairDevice, que no necesita listar nada). super_admin
// sí ve todo, incluido el stock sin reclamar (owner_id IS NULL), para
// llevar el inventario.
const getDevices = async (req, res) => {
    try {
        const ownerId = effectiveOwnerId(req);
        let query = `
            SELECT dev.*, v.plate as vehicle_plate,
                   u.name as owner_name, u.company_name as owner_company
            FROM Devices dev
            LEFT JOIN Vehicles v ON dev.vehicle_id = v.id
            LEFT JOIN Users u ON dev.owner_id = u.id
        `;
        const params = [];
        if (ownerId) {
            query += ' WHERE dev.owner_id = ?';
            params.push(ownerId);
        }
        query += ' ORDER BY dev.created_at DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo equipos' });
    }
};

// ============================================================
// Diagnóstico: "todo lo que la base de datos guarda" de un equipo
// puntual — pensado para debug real, no para el uso diario. Devuelve
// el equipo, a qué cliente/vehículo está pareado, y las últimas
// lecturas crudas de Telemetry_Raw tal cual quedaron guardadas, sin
// procesar ni maquillar nada.
// ============================================================
const getDeviceRawData = async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    try {
        const ownerId = effectiveOwnerId(req);
        const [[device]] = await pool.query(`
            SELECT dev.*, v.plate as vehicle_plate, v.brand, v.model as vehicle_model,
                   v.odometer_km, u.name as owner_name, u.company_name as owner_company
            FROM Devices dev
            LEFT JOIN Vehicles v ON dev.vehicle_id = v.id
            LEFT JOIN Users u ON dev.owner_id = u.id
            WHERE dev.id = ?
        `, [id]);

        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (ownerId && device.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese equipo no pertenece a tu flota' });
        }

        let readings = [];
        if (device.vehicle_id) {
            const [rows] = await pool.query(
                `SELECT * FROM Telemetry_Raw WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT ?`,
                [device.vehicle_id, limit]
            );
            readings = rows;
        }

        res.json({ device, readings });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo los datos crudos del equipo' });
    }
};

// ============================================================
// Pareo de equipo a vehículo — ACÁ estaba el bug crítico.
//
// Ahora, si el equipo todavía no tiene dueño (owner_id IS NULL,
// o sea vino de stock dado de alta por super_admin), este pareo
// además "reclama" el equipo: le asigna owner_id = la flota de
// quien está pareando. A partir de ahí ese equipo ya es de esa
// flota y nadie más lo puede tomar.
// ============================================================
const pairDevice = async (req, res) => {
    // El cliente puede pegar el IMEI completo O el código corto de
    // activación — lo que tenga más a mano. Cualquiera de los dos
    // identifica el mismo equipo, sin ambigüedad.
    const { imei, activation_code, vehicle_id } = req.body;
    const ownerId = effectiveOwnerId(req);

    if (!imei && !activation_code) {
        return res.status(400).json({ error: 'Ingresá el IMEI o el código de activación del equipo' });
    }

    // Un admin necesita saber a qué flota está pareando; super_admin
    // puede pasar ?owner_id=X en la query para hacerlo en nombre de
    // un cliente puntual. Si es super_admin y no pasa owner_id, no
    // sabemos de quién es la flota — se lo pedimos explícito.
    if (!ownerId && req.user.role === 'super_admin') {
        return res.status(400).json({ error: 'Como super_admin, indicá ?owner_id=<id del admin> para saber a qué flota asignar el equipo' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[device]] = activation_code
            ? await connection.query('SELECT id, vehicle_id, owner_id FROM Devices WHERE activation_code = ?', [activation_code.toUpperCase()])
            : await connection.query('SELECT id, vehicle_id, owner_id FROM Devices WHERE imei = ?', [imei]);
        if (!device) {
            await connection.rollback();
            return res.status(404).json({ error: 'No se encontró ningún equipo con ese IMEI/código' });
        }

        if (device.owner_id === null) {
            // Equipo sin reclamar: se lo asignamos a esta flota ahora mismo.
            await connection.query('UPDATE Devices SET owner_id = ? WHERE id = ?', [ownerId, device.id]);
        } else if (device.owner_id !== ownerId) {
            await connection.rollback();
            return res.status(403).json({ error: 'Ese equipo ya pertenece a otra flota' });
        }

        if (device.vehicle_id) {
            await connection.rollback();
            return res.status(400).json({ error: 'Ese equipo ya está pareado a otro vehículo' });
        }
        const [[vehicle]] = await connection.query('SELECT owner_id FROM Vehicles WHERE id = ?', [vehicle_id]);
        if (!vehicle) {
            await connection.rollback();
            return res.status(404).json({ error: 'Vehículo no encontrado' });
        }
        if (vehicle.owner_id !== ownerId) {
            await connection.rollback();
            return res.status(403).json({ error: 'Ese vehículo no pertenece a tu flota' });
        }
        await connection.query('UPDATE Devices SET vehicle_id = ?, status = "paired" WHERE id = ?', [vehicle_id, device.id]);
        await connection.query('UPDATE Vehicles SET device_id = ? WHERE id = ?', [device.id, vehicle_id]);
        await connection.commit();
        res.json({ message: 'Equipo pareado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error('❌ Error pareando el equipo:', error);
        res.status(500).json({ error: 'Error pareando el equipo' });
    } finally {
        connection.release();
    }
};

const unpairDevice = async (req, res) => {
    const { imei } = req.params;
    try {
        const ownerId = effectiveOwnerId(req);
        const [[device]] = await pool.query('SELECT id, vehicle_id, owner_id FROM Devices WHERE imei = ?', [imei]);
        if (!device) return res.status(404).json({ error: 'IMEI no encontrado' });
        if (ownerId && device.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese equipo no pertenece a tu flota' });
        }
        await pool.query('UPDATE Vehicles SET device_id = NULL WHERE id = ?', [device.vehicle_id]);
        await pool.query('UPDATE Devices SET vehicle_id = NULL, status = "unpaired" WHERE id = ?', [device.id]);
        res.json({ message: 'Equipo despareado' });
    } catch (error) {
        res.status(500).json({ error: 'Error despareando el equipo' });
    }
};

// Editar un equipo (etiqueta o modelo) — no toca el pareo, para eso
// están pairDevice/unpairDevice.
const updateDevice = async (req, res) => {
    const { id } = req.params;
    const { label, model, phone_number } = req.body;
    if (model && !['VL04', 'VL502'].includes(model)) {
        return res.status(400).json({ error: 'Modelo inválido (tiene que ser VL04 o VL502)' });
    }
    try {
        const ownerId = effectiveOwnerId(req);
        const [[device]] = await pool.query('SELECT owner_id FROM Devices WHERE id = ?', [id]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (ownerId && device.owner_id !== ownerId) {
            return res.status(403).json({ error: 'Ese equipo no pertenece a tu flota' });
        }
        await pool.query(
            `UPDATE Devices SET label = COALESCE(?, label), model = COALESCE(?, model), phone_number = COALESCE(?, phone_number) WHERE id = ?`,
            [label, model, phone_number, id]
        );
        res.json({ message: 'Equipo actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'Error actualizando el equipo' });
    }
};

// Eliminar un equipo por completo (no solo desparear) — SOLO
// super_admin, ya que es Puma Code quien programa/gestiona el
// inventario físico. Si estaba pareado, primero lo desconecta del
// vehículo para no dejar una referencia rota.
const deleteDevice = async (req, res) => {
    const { id } = req.params;
    try {
        const [[device]] = await pool.query('SELECT vehicle_id FROM Devices WHERE id = ?', [id]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (device.vehicle_id) {
            await pool.query('UPDATE Vehicles SET device_id = NULL WHERE id = ?', [device.vehicle_id]);
        }
        await pool.query('DELETE FROM Devices WHERE id = ?', [id]);
        res.json({ message: 'Equipo eliminado — el IMEI queda libre para volver a darlo de alta si hace falta' });
    } catch (error) {
        res.status(500).json({ error: 'Error eliminando el equipo' });
    }
};

// ============================================================
// Enviar un comando de TEXTO crudo al equipo por la conexión TCP
// activa. SOLO super_admin.
//
// VL04 (protocolo 0x80, Online Command del manual Concox) — comandos
// de texto tipo AT, confirmado funcionando (SPEED, HORCOL, FENCE,
// etc). VL502 (protocolo 0x8300, JT808 "Text Info") — [ACTUALIZADO
// 14/07/2026] ahora se permite mandarlo, PERO el mensaje sigue
// devolviendo la advertencia de que 0x8300 es para MOSTRAR texto en
// el terminal, no para configurar nada — sirve como canal de
// diagnóstico/prueba, no para parámetros reales. Para configurar el
// VL502 de verdad usar sendDeviceParams (0x8103) más abajo.
//
// Cada comando se guarda en CommandLog con su correlationId — cuando
// el equipo conteste (0x21 en GT06, 0x0001 en JT808), gt06Server.js
// actualiza esa misma fila con la respuesta real.
// ============================================================
const sendDeviceCommand = async (req, res) => {
    const { imei } = req.params;
    const { command } = req.body;
    if (!command || typeof command !== 'string' || command.length > 200) {
        return res.status(400).json({ error: 'Falta el comando o es demasiado largo' });
    }
    try {
        const [[device]] = await pool.query('SELECT id, model FROM Devices WHERE imei = ?', [imei]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });

        const result = await gt06Internal.sendCommandToDevice(imei, command);
        if (!result.sent) {
            await pool.query(
                `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
                 VALUES (?, ?, ?, ?, 'failed', ?)`,
                [device.id, imei, command, `failed-${Date.now()}`, req.user.id]
            ).catch(() => {});
            return res.status(409).json({ error: result.reason });
        }

        await pool.query(
            `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
             VALUES (?, ?, ?, ?, 'sent', ?)`,
            [device.id, imei, command, result.correlationId, req.user.id]
        ).catch(err => {
            if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
            console.warn('[devicesController] CommandLog no existe todavía — corré migration_command_log.sql');
        });

        const vl502Warning = device.model === 'VL502'
            ? ' ATENCIÓN: en VL502 esto va por el mensaje 0x8300 (texto), que probablemente no configura nada real — es un canal de diagnóstico, no de configuración.'
            : '';

        res.json({
            message: `Comando "${command}" enviado a IMEI ${imei}.${vl502Warning}`,
            correlation_id: result.correlationId,
        });
    } catch (error) {
        console.error('❌ Error enviando comando al equipo:', error);
        res.status(500).json({ error: 'Error enviando el comando' });
    }
};

// ============================================================
// [NUEVO 14/07/2026] Configuración estructurada para VL502 — mensaje
// JT808 0x8103 real (Set Terminal Parameters), NO texto libre. Acepta
// cualquier combinación de: heartbeatIntervalSec, reportIntervalSec
// (reporte por TIEMPO), reportDistanceM (reporte por DISTANCIA —
// esto el VL04 no lo tiene), sleepIntervalSec, alarmIntervalSec.
// SOLO super_admin, SOLO VL502.
// ============================================================
const sendDeviceParams = async (req, res) => {
    const { imei } = req.params;
    const params = req.body || {};
    // [AMPLIADO 16/07/2026] apn/serverAddr/serverPort agregados — sirven
    // para reconfigurar el servidor del VL502 por TCP (0x8103), como vía
    // alternativa cuando el SMS no es confiable (ej: plataformas que
    // mandan por ICCID sin número de teléfono asociado, que muchos
    // equipos Concox/Jimi terminan ignorando si no matchea su número
    // "maestro" autorizado).
    const allowedKeys = ['heartbeatIntervalSec', 'reportIntervalSec', 'sleepIntervalSec', 'alarmIntervalSec', 'reportDistanceM', 'apn', 'serverAddr', 'serverPort', 'vehicleTypeCode'];
    const filtered = Object.fromEntries(
        Object.entries(params).filter(([k, v]) => allowedKeys.includes(k) && v !== '' && v != null)
    );
    if (Object.keys(filtered).length === 0) {
        return res.status(400).json({ error: `Mandá al menos uno de: ${allowedKeys.join(', ')}` });
    }

    try {
        const [[device]] = await pool.query('SELECT id, model FROM Devices WHERE imei = ?', [imei]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (device.model !== 'VL502') {
            return res.status(400).json({ error: 'Este endpoint es solo para VL502 (JT808 0x8103). Para VL04 usá /command con TIMER,...#' });
        }

        const result = await gt06Internal.sendParamsCommand(imei, filtered);
        const commandLabel = `SET_PARAMS(0x8103): ${Object.entries(filtered).map(([k, v]) => `${k}=${v}`).join(', ')}`;

        if (!result.sent) {
            await pool.query(
                `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
                 VALUES (?, ?, ?, ?, 'failed', ?)`,
                [device.id, imei, commandLabel, `failed-${Date.now()}`, req.user.id]
            ).catch(() => {});
            return res.status(409).json({ error: result.reason });
        }

        await pool.query(
            `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
             VALUES (?, ?, ?, ?, 'sent', ?)`,
            [device.id, imei, commandLabel, result.correlationId, req.user.id]
        ).catch(err => {
            if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
        });

        res.json({
            message: `Parámetros enviados a IMEI ${imei}: ${Object.keys(filtered).join(', ')}. SIN CONFIRMAR contra prueba real todavía — verificá que el equipo conteste "éxito" y que el intervalo de reporte cambie de verdad.`,
            correlation_id: result.correlationId,
        });
    } catch (error) {
        console.error('❌ Error enviando parámetros al equipo:', error);
        res.status(500).json({ error: 'Error enviando los parámetros' });
    }
};

// ============================================================
// [NUEVO 14/07/2026] Consulta de umbrales de manejo — SOLO VL502
// (0x8106). Pedido puntual: el Ford Focus manejó ~46 minutos reales
// con giros/frenadas/arranques y JAMÁS mandó un solo paquete de
// alarma de manejo (subtipo 0x03) — ni frenada brusca, ni giro
// brusco, ni colisión propia del acelerómetro. Esto consulta los
// umbrales reales que tiene guardado el equipo ahora mismo, para
// saber si están configurados en un valor que nunca se alcanza
// manejando normal, sin arriesgarse a cambiar nada (0x8106 solo LEE,
// no escribe — a diferencia de sendDeviceParams que sí configura).
const DRIVING_THRESHOLD_PARAM_IDS = [0xF20B, 0xF20C, 0xF20D, 0xF016, 0xF017];
const sendDeviceQueryDrivingThresholds = async (req, res) => {
    const { imei } = req.params;
    try {
        const [[device]] = await pool.query('SELECT id, model FROM Devices WHERE imei = ?', [imei]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (device.model !== 'VL502') {
            return res.status(400).json({ error: 'La consulta de umbrales de manejo (0x8106) solo aplica a VL502 — el VL04 no tiene un equivalente confirmado todavía.' });
        }

        const result = await gt06Internal.sendQueryParamsCommand(imei, DRIVING_THRESHOLD_PARAM_IDS);
        const commandLabel = `QUERY_PARAMS(0x8106): 0xF20B (accel), 0xF20C (frenada), 0xF20D (giro), 0xF016/0xF017 (comunicación OBD)`;

        if (!result.sent) {
            await pool.query(
                `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
                 VALUES (?, ?, ?, ?, 'failed', ?)`,
                [device.id, imei, commandLabel, `failed-${Date.now()}`, req.user.id]
            ).catch(() => {});
            return res.status(409).json({ error: result.reason });
        }

        await pool.query(
            `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
             VALUES (?, ?, ?, ?, 'sent', ?)`,
            [device.id, imei, commandLabel, result.correlationId, req.user.id]
        ).catch(err => {
            if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
        });

        res.json({
            message: `Consulta enviada a IMEI ${imei}. Mirá el historial de comandos en unos segundos — cuando conteste, vas a ver los valores reales de cada umbral en la respuesta.`,
            correlation_id: result.correlationId,
        });
    } catch (error) {
        console.error('❌ Error consultando umbrales de manejo:', error);
        res.status(500).json({ error: 'Error consultando los umbrales de manejo' });
    }
};

// ============================================================
// [NUEVO 15/07/2026] Consulta de versión de firmware/hardware —
// SOLO VL502 (0x8106, parámetros 0xF005/0xF006, de solo lectura
// según el manual). Pedido puntual: antes de decidir si vale la pena
// evaluar otro equipo (GV500), primero hay que saber qué versión
// exacta de firmware tiene el VL502 actual — puede que una
// actualización del fabricante ya resuelva lo que hoy falta (DTC,
// frenada brusca, geocerca nativa), sin gastar en hardware nuevo.
const VERSION_PARAM_IDS = [0xF005, 0xF006];
const sendDeviceQueryVersion = async (req, res) => {
    const { imei } = req.params;
    try {
        const [[device]] = await pool.query('SELECT id, model FROM Devices WHERE imei = ?', [imei]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (device.model !== 'VL502') {
            return res.status(400).json({ error: 'La consulta de versión (0x8106) solo aplica a VL502 por ahora.' });
        }

        const result = await gt06Internal.sendQueryParamsCommand(imei, VERSION_PARAM_IDS);
        const commandLabel = `QUERY_PARAMS(0x8106): 0xF005 (versión hardware), 0xF006 (versión firmware)`;

        if (!result.sent) {
            await pool.query(
                `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
                 VALUES (?, ?, ?, ?, 'failed', ?)`,
                [device.id, imei, commandLabel, `failed-${Date.now()}`, req.user.id]
            ).catch(() => {});
            return res.status(409).json({ error: result.reason });
        }

        await pool.query(
            `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
             VALUES (?, ?, ?, ?, 'sent', ?)`,
            [device.id, imei, commandLabel, result.correlationId, req.user.id]
        ).catch(err => {
            if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
        });

        res.json({
            message: `Consulta de versión enviada a IMEI ${imei}. Revisá el historial de comandos en unos segundos.`,
            correlation_id: result.correlationId,
        });
    } catch (error) {
        console.error('❌ Error consultando versión de firmware:', error);
        res.status(500).json({ error: 'Error consultando la versión de firmware' });
    }
};

// [NUEVO 18/07/2026] Consulta real de qué vehicleTypeCode (0xF00D)
// tiene GUARDADO el equipo ahora mismo — no inferido por cómo se ven
// los datos, sino preguntándole directo. Motivo: mandamos este
// parámetro por curl varias veces hoy sin ver nunca una confirmación
// explícita de "éxito" (el equipo estaba desconectado en varios de
// esos intentos) — antes de seguir asumiendo que quedó aplicado,
// mejor confirmarlo con el equipo mismo.
const VEHICLE_TYPE_PARAM_IDS = [0xF00D];
const sendDeviceQueryVehicleType = async (req, res) => {
    const { imei } = req.params;
    try {
        const [[device]] = await pool.query('SELECT id, model FROM Devices WHERE imei = ?', [imei]);
        if (!device) return res.status(404).json({ error: 'Equipo no encontrado' });
        if (device.model !== 'VL502') {
            return res.status(400).json({ error: 'La consulta de vehicleTypeCode (0x8106) solo aplica a VL502.' });
        }

        const result = await gt06Internal.sendQueryParamsCommand(imei, VEHICLE_TYPE_PARAM_IDS);
        const commandLabel = `QUERY_PARAMS(0x8106): 0xF00D (vehicleTypeCode — confirmar marca/combustible configurado)`;

        if (!result.sent) {
            await pool.query(
                `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
                 VALUES (?, ?, ?, ?, 'failed', ?)`,
                [device.id, imei, commandLabel, `failed-${Date.now()}`, req.user.id]
            ).catch(() => {});
            return res.status(409).json({ error: result.reason });
        }

        await pool.query(
            `INSERT INTO CommandLog (device_id, imei, command_text, correlation_id, status, sent_by)
             VALUES (?, ?, ?, ?, 'sent', ?)`,
            [device.id, imei, commandLabel, result.correlationId, req.user.id]
        ).catch(err => {
            if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
        });

        res.json({
            message: `Consulta enviada a IMEI ${imei}. Mirá el historial de comandos en unos segundos — el valor hexadecimal que responda hay que convertirlo: 3 = Ford nafta, 8195 = Ford diésel, 8196 = Toyota diésel (el que quedó de la prueba de hoy en la Hilux).`,
            correlation_id: result.correlationId,
        });
    } catch (error) {
        console.error('❌ Error consultando vehicleTypeCode:', error);
        res.status(500).json({ error: 'Error consultando el vehicleTypeCode' });
    }
};

// [NUEVO] Historial de comandos mandados a un equipo puntual, con su
// estado real (sent = esperando respuesta, acked = el equipo
// confirmó, failed = no se pudo mandar). El panel hace polling de
// esto para mostrar el tildecito apenas cambia de sent a acked.
const getDeviceCommandLog = async (req, res) => {
    const { imei } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    try {
        const [rows] = await pool.query(
            `SELECT id, command_text, status, response_text, created_at, responded_at
             FROM CommandLog WHERE imei = ? ORDER BY created_at DESC LIMIT ?`,
            [imei, limit]
        );
        res.json(rows);
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json({ error: 'La tabla CommandLog no existe todavía — falta correr migration_command_log.sql' });
        }
        res.status(500).json({ error: 'Error obteniendo historial de comandos' });
    }
};

module.exports = { addDevice, getDevices, pairDevice, unpairDevice, getDeviceRawData, updateDevice, deleteDevice, sendDeviceCommand, sendDeviceParams, sendDeviceQueryDrivingThresholds, sendDeviceQueryVersion, sendDeviceQueryVehicleType, getDeviceCommandLog };