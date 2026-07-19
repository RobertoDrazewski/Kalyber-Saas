// ============================================================
// Herramientas de la vista del CHOFER (19/07/2026)
// Todo lo de acá está pensado para que el equipo le sea ÚTIL al
// chofer, no solo para controlarlo. El chofer solo puede ver SUS
// propios datos (los de su driver_id), nunca los de otro.
// ============================================================
const pool = require('../config/database');

// Tarifa por km por defecto si el chofer no configuró la suya. Es
// solo para ESTIMAR — nunca se presenta como el dato real de Uber.
// Valor conservador en pesos por km; el chofer lo ajusta a su
// realidad desde la app.
const DEFAULT_RATE_PER_KM = 400;

// Resuelve el driver_id del usuario logueado. Devuelve null si el
// usuario no es un chofer con registro en Drivers.
async function resolveDriverId(userId) {
    const [[driver]] = await pool.query('SELECT id, rate_per_km FROM Drivers WHERE user_id = ?', [userId]);
    return driver || null;
}

// ---- Helper: el auto que el chofer está manejando ahora ----
async function getMyCurrentVehicle(driverId) {
    const [[vehicle]] = await pool.query(
        `SELECT v.id, v.plate, v.brand, v.model, v.odometer_km
         FROM Vehicles v WHERE v.current_driver_id = ? LIMIT 1`,
        [driverId]
    );
    return vehicle || null;
}

// ============================================================
// HERRAMIENTA 1 — "Tu jornada": km y ganancia ESTIMADA
// ============================================================
const getMyEarnings = async (req, res) => {
    try {
        const driver = await resolveDriverId(req.user.id);
        if (!driver) return res.json({ error_soft: 'no_driver', hoy: null, semana: null, mes: null });

        const rate = driver.rate_per_km != null ? Number(driver.rate_per_km) : DEFAULT_RATE_PER_KM;

        // Agregados por período — km reales del GPS (tabla Trips), la
        // ganancia se calcula acá con la tarifa del chofer, NO se lee
        // de estimated_earnings (que puede haberse calculado con otra
        // tarifa en el pasado). Así, si el chofer ajusta su tarifa,
        // los números se actualizan coherentemente.
        const [[agg]] = await pool.query(
            `SELECT
                ROUND(SUM(CASE WHEN DATE(t.start_time) = CURDATE() THEN t.distance_km ELSE 0 END), 1) as km_hoy,
                ROUND(SUM(CASE WHEN YEARWEEK(t.start_time, 1) = YEARWEEK(CURDATE(), 1) THEN t.distance_km ELSE 0 END), 1) as km_semana,
                ROUND(SUM(CASE WHEN DATE_FORMAT(t.start_time, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN t.distance_km ELSE 0 END), 1) as km_mes,
                SUM(CASE WHEN DATE(t.start_time) = CURDATE() THEN 1 ELSE 0 END) as viajes_hoy
             FROM Trips t
             WHERE t.driver_id = ? AND t.source = 'real'`,
            [driver.id]
        );

        const kmHoy = Number(agg.km_hoy) || 0;
        const kmSemana = Number(agg.km_semana) || 0;
        const kmMes = Number(agg.km_mes) || 0;

        res.json({
            rate_per_km: rate,
            is_default_rate: driver.rate_per_km == null,
            hoy: { km: kmHoy, viajes: Number(agg.viajes_hoy) || 0, estimado: Math.round(kmHoy * rate) },
            semana: { km: kmSemana, estimado: Math.round(kmSemana * rate) },
            mes: { km: kmMes, estimado: Math.round(kmMes * rate) },
        });
    } catch (error) {
        console.error('[driverTools] getMyEarnings:', error.message);
        res.status(500).json({ error: 'Error obteniendo tu jornada' });
    }
};

// Actualizar la tarifa por km propia
const updateMyRate = async (req, res) => {
    const { rate_per_km } = req.body;
    const rate = Number(rate_per_km);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100000) {
        return res.status(400).json({ error: 'Tarifa inválida' });
    }
    try {
        const driver = await resolveDriverId(req.user.id);
        if (!driver) return res.status(403).json({ error: 'No sos un chofer registrado' });
        await pool.query('UPDATE Drivers SET rate_per_km = ? WHERE id = ?', [rate, driver.id]);
        res.json({ success: true, rate_per_km: rate });
    } catch (error) {
        res.status(500).json({ error: 'Error guardando la tarifa' });
    }
};

// ============================================================
// HERRAMIENTA 2 — "Chequeo del auto": telemetría en su idioma
// (semáforo verde/amarillo/rojo, no números crudos)
// ============================================================
const getMyVehicleCheck = async (req, res) => {
    try {
        const driver = await resolveDriverId(req.user.id);
        if (!driver) return res.json({ error_soft: 'no_driver' });

        const vehicle = await getMyCurrentVehicle(driver.id);
        if (!vehicle) return res.json({ error_soft: 'no_vehicle' });

        // Última telemetría real del auto
        const [[t]] = await pool.query(
            `SELECT coolant_temp, battery_voltage, fuel_level, engine_rpm, recorded_at
             FROM Telemetry_Raw WHERE vehicle_id = ?
             ORDER BY recorded_at DESC LIMIT 1`,
            [vehicle.id]
        );

        // Cada chequeo devuelve un estado: 'ok' | 'warn' | 'alert' | 'sin_dato'
        // Los umbrales son deliberadamente conservadores — mejor un
        // amarillo de más que asustar al chofer con un rojo dudoso.
        const checks = [];

        // Temperatura del motor
        if (t?.coolant_temp != null) {
            const temp = Number(t.coolant_temp);
            checks.push({
                key: 'temp', label: 'Temperatura del motor',
                estado: temp >= 110 ? 'alert' : temp >= 100 ? 'warn' : 'ok',
                detalle: `${Math.round(temp)}°C`,
                consejo: temp >= 110 ? 'Está muy caliente — pará y revisá el refrigerante.' : temp >= 100 ? 'Un poco alta, tenela de ojo.' : 'Todo normal.',
            });
        } else {
            checks.push({ key: 'temp', label: 'Temperatura del motor', estado: 'sin_dato', detalle: '—', consejo: 'El equipo todavía no reportó este dato.' });
        }

        // Batería
        if (t?.battery_voltage != null) {
            const v = Number(t.battery_voltage);
            // Con motor en marcha debería estar 13.5-14.8 (alternador
            // cargando). En reposo, 12.4-12.7 es sano. Marcamos alerta
            // solo si está claramente baja.
            checks.push({
                key: 'bateria', label: 'Batería',
                estado: v < 11.8 ? 'alert' : v < 12.3 ? 'warn' : 'ok',
                detalle: `${v.toFixed(1)}V`,
                consejo: v < 11.8 ? 'Batería baja — puede costar arrancar. Hacela revisar.' : v < 12.3 ? 'Un poco baja, prestale atención.' : 'Batería en buen estado.',
            });
        } else {
            checks.push({ key: 'bateria', label: 'Batería', estado: 'sin_dato', detalle: '—', consejo: 'El equipo todavía no reportó este dato.' });
        }

        // Combustible
        if (t?.fuel_level != null) {
            const f = Number(t.fuel_level);
            checks.push({
                key: 'combustible', label: 'Combustible',
                estado: f < 10 ? 'alert' : f < 20 ? 'warn' : 'ok',
                detalle: `${Math.round(f)}%`,
                consejo: f < 10 ? 'Casi vacío — cargá antes de seguir.' : f < 20 ? 'Vas bajo, buscá una estación pronto.' : 'Nivel OK.',
            });
        }

        // Estado general — el peor de los chequeos manda
        const estados = checks.map(c => c.estado).filter(e => e !== 'sin_dato');
        const general = estados.includes('alert') ? 'alert' : estados.includes('warn') ? 'warn' : estados.length ? 'ok' : 'sin_dato';

        res.json({
            plate: vehicle.plate,
            general,
            checks,
            last_update: t?.recorded_at || null,
        });
    } catch (error) {
        console.error('[driverTools] getMyVehicleCheck:', error.message);
        res.status(500).json({ error: 'Error chequeando tu auto' });
    }
};

// ============================================================
// HERRAMIENTA 3 — Score de manejo con causa-efecto (no un número frío)
// + HERRAMIENTA 4 — Logros / rachas
// (van juntas: ambas salen del historial de alarmas del chofer)
// ============================================================
const getMyDrivingSummary = async (req, res) => {
    try {
        const driver = await resolveDriverId(req.user.id);
        if (!driver) return res.json({ error_soft: 'no_driver' });

        const vehicle = await getMyCurrentVehicle(driver.id);
        if (!vehicle) return res.json({ error_soft: 'no_vehicle' });

        // Eventos de manejo del auto actual, últimos 30 días
        const [alarms] = await pool.query(
            `SELECT alarm_id, label, recorded_at FROM Telemetry_Alarms
             WHERE vehicle_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             ORDER BY recorded_at DESC`,
            [vehicle.id]
        );

        const harshEvents = alarms.filter(a => a.alarm_id === 0x30 || a.alarm_id === 0x29 || a.label === 'harsh_braking' || a.label === 'harsh_acceleration');
        const speedEvents = alarms.filter(a => a.label === 'overspeed' || a.alarm_id === 0x31);

        // "Días desde la última frenada brusca" — el gancho positivo
        // principal. Si nunca hubo, usamos el inicio de la ventana.
        let daysSinceHarsh = 30;
        if (harshEvents.length > 0) {
            const last = new Date(harshEvents[0].recorded_at);
            daysSinceHarsh = Math.floor((Date.now() - last.getTime()) / 86400000);
        }

        // km "limpios" recorridos (sin evento brusco) en el período —
        // aproximación: km totales del período de este chofer.
        const [[kmAgg]] = await pool.query(
            `SELECT ROUND(SUM(distance_km), 0) as km_periodo FROM Trips
             WHERE driver_id = ? AND source = 'real' AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
            [driver.id]
        );
        const kmPeriodo = Number(kmAgg.km_periodo) || 0;

        // --- Logros: se evalúan y se persisten la primera vez que se alcanzan ---
        const unlockedNow = [];
        const candidateAchievements = [
            { key: 'streak_7_no_harsh', cond: daysSinceHarsh >= 7, label: '7 días sin frenadas bruscas', emoji: '🎯' },
            { key: 'streak_14_no_harsh', cond: daysSinceHarsh >= 14, label: '2 semanas sin frenadas bruscas', emoji: '🏆' },
            { key: 'km_500_clean', cond: kmPeriodo >= 500 && harshEvents.length === 0, label: '500 km sin un solo evento brusco', emoji: '✨' },
            { key: 'km_1000', cond: kmPeriodo >= 1000, label: '1000 km recorridos este mes', emoji: '🚗' },
            { key: 'no_speeding_week', cond: speedEvents.length === 0 && kmPeriodo > 50, label: 'Semana sin excesos de velocidad', emoji: '🛡️' },
        ];

        const [existing] = await pool.query(
            'SELECT achievement_key FROM DriverAchievements WHERE driver_id = ?',
            [driver.id]
        );
        const existingKeys = new Set(existing.map(e => e.achievement_key));

        for (const a of candidateAchievements) {
            if (a.cond && !existingKeys.has(a.key)) {
                await pool.query(
                    'INSERT IGNORE INTO DriverAchievements (driver_id, achievement_key) VALUES (?, ?)',
                    [driver.id, a.key]
                );
                unlockedNow.push(a);
            }
        }

        // Todos los logros que el chofer YA tiene (para mostrarlos)
        const achievedList = candidateAchievements
            .filter(a => existingKeys.has(a.key) || unlockedNow.some(u => u.key === a.key))
            .map(a => ({ key: a.key, label: a.label, emoji: a.emoji }));

        // Mensaje de causa-efecto — traduce el score a beneficio PROPIO
        let insight;
        if (harshEvents.length === 0 && kmPeriodo > 0) {
            insight = `Llevás ${daysSinceHarsh} días sin frenadas bruscas. Manejar suave alarga la vida de tus pastillas y ahorra combustible — es plata que queda en tu bolsillo.`;
        } else if (daysSinceHarsh >= 3) {
            insight = `${daysSinceHarsh} días sin una frenada brusca. Seguí así: menos desgaste de frenos = menos gastos de mantenimiento.`;
        } else {
            insight = `Tuviste ${harshEvents.length} frenada(s) brusca(s) esta última semana. Aflojar un poco el freno cuida las pastillas y el consumo — a la larga es menos plata en el taller.`;
        }

        res.json({
            plate: vehicle.plate,
            dias_sin_frenada: daysSinceHarsh,
            frenadas_mes: harshEvents.length,
            excesos_mes: speedEvents.length,
            km_mes: kmPeriodo,
            insight,
            logros: achievedList,
            recien_desbloqueados: unlockedNow.map(a => ({ key: a.key, label: a.label, emoji: a.emoji })),
        });
    } catch (error) {
        console.error('[driverTools] getMyDrivingSummary:', error.message);
        res.status(500).json({ error: 'Error obteniendo tu resumen de manejo' });
    }
};

module.exports = {
    getMyEarnings,
    updateMyRate,
    getMyVehicleCheck,
    getMyDrivingSummary,
};
