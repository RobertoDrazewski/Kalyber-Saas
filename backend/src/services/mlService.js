// ============================================================
// Motor de diagnóstico predictivo.
//
// Alcance real (importante ser honestos con esto en el producto):
// un OBD2 no mide desgaste físico de pastillas de freno ni de
// neumáticos. Lo que SÍ podemos hacer con lo que llega del equipo:
//
//  - Frenos / neumáticos / fluidos: heurística por kilometraje +
//    eventos de manejo (frenadas bruscas). Es una estimación útil,
//    no una medición directa.
//  - Motor / batería / temperatura: medición directa del PID del
//    OBD2, esto sí es dato duro.
//  - Anomalías: detección estadística (z-score) contra el propio
//    historial de CADA auto — no comparamos contra un auto genérico,
//    comparamos el auto contra sí mismo.
// ============================================================

const pool = require('../config/database');
const { sendMaintenanceAlert } = require('./maintenanceAlertService');

const KM_TIRE_ROTATION = 9000; // rotación sugerida cada 9.000 km
const KM_BRAKE_CHECK = 25000;  // revisión de frenos sugerida cada 25.000 km
const KM_FLUIDS_CHECK = 10000; // fluidos cada 10.000 km

function meanStd(values) {
    if (values.length === 0) return { mean: 0, std: 0 };
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return { mean, std: Math.sqrt(variance) };
}

/**
 * Detección de anomalías por z-score contra el historial reciente
 * del propio vehículo (últimas N lecturas). |z| > 3 se considera
 * anómalo — umbral conservador para no generar falsos positivos.
 */
function detectAnomaly(currentValue, historyValues, label) {
    if (historyValues.length < 8) return null; // no hay suficiente historial propio todavía
    const { mean, std } = meanStd(historyValues);
    if (std === 0) return null;
    const z = (currentValue - mean) / std;
    if (Math.abs(z) > 3) {
        return `${label} fuera de lo normal para este auto (z=${z.toFixed(1)})`;
    }
    return null;
}

function wearScoreByKm(kmSinceEvent, kmInterval) {
    const ratio = kmSinceEvent / kmInterval;
    const score = Math.max(0, 100 - ratio * 100);
    return Math.round(score * 10) / 10;
}

function adjustBrakeScoreByHarshEvents(baseScore, harshBrakeCount, totalReadings) {
    if (totalReadings === 0) return baseScore;
    const harshRatio = harshBrakeCount / totalReadings;
    const penalty = Math.min(40, harshRatio * 200);
    return Math.max(0, Math.round((baseScore - penalty) * 10) / 10);
}

function buildRecommendation({ tireScore, brakeScore, anomalies, harshBrakeCount, hasLoggedMaintenance }) {
    const notes = [];
    const noHistoryNote = hasLoggedMaintenance ? '' : ' (todavía no se cargó ningún mantenimiento para este auto — el score asume "nunca se hizo", no un desgaste confirmado.)';

    if (tireScore < 40) notes.push(`Rotación de neumáticos vencida según kilometraje, agendar cuanto antes.${noHistoryNote}`);
    else if (tireScore < 60) notes.push('Rotación de neumáticos se acerca, planificar en las próximas semanas.');

    if (brakeScore < 40) {
        // No afirmamos "patrón de frenadas bruscas" salvo que REALMENTE
        // haya al menos una detectada — antes esto se decía siempre,
        // aunque harshBrakeCount fuera 0 (que es el caso de TODO el VL04
        // hasta ahora, porque nunca confirmamos ese canal de datos).
        const motivo = harshBrakeCount > 0
            ? `kilometraje elevado + ${harshBrakeCount} frenada(s) brusca(s) detectada(s) recientemente`
            : `kilometraje elevado`;
        notes.push(`Revisión de frenos recomendada: ${motivo}.${noHistoryNote}`);
    } else if (brakeScore < 60) {
        notes.push('Frenos dentro de rango pero con desgaste a vigilar.');
    }

    if (anomalies.length > 0) notes.push(...anomalies);

    if (notes.length === 0) return null;
    return notes.join(' ');
}

/**
 * Punto de entrada principal: recibe una lectura cruda (real o
 * simulada) ya insertada en Telemetry_Raw, calcula heurísticas
 * contra el historial de ESE vehículo, y persiste un snapshot en
 * Telemetry_Heuristics. Se llama igual sin importar el origen del
 * dato — es la misma tubería para el auto real y para el simulador.
 */
async function processReading(vehicleId, reading, source = 'real') {
    const [[vehicle]] = await pool.query('SELECT odometer_km FROM Vehicles WHERE id = ?', [vehicleId]);
    if (!vehicle) return null;

    const [[lastTireEvent]] = await pool.query(
        `SELECT km_at_event FROM MaintenanceEvents WHERE vehicle_id = ? AND type = 'neumaticos' ORDER BY event_date DESC LIMIT 1`,
        [vehicleId]
    );
    const [[lastBrakeEvent]] = await pool.query(
        `SELECT km_at_event FROM MaintenanceEvents WHERE vehicle_id = ? AND type = 'frenos' ORDER BY event_date DESC LIMIT 1`,
        [vehicleId]
    );

    const kmSinceTire = vehicle.odometer_km - (lastTireEvent?.km_at_event || 0);
    const kmSinceBrake = vehicle.odometer_km - (lastBrakeEvent?.km_at_event || 0);

    const tireScore = wearScoreByKm(kmSinceTire, KM_TIRE_ROTATION);
    let brakeScore = wearScoreByKm(kmSinceBrake, KM_BRAKE_CHECK);

    const [recentReadings] = await pool.query(
        `SELECT engine_rpm, engine_load, coolant_temp, battery_voltage, harsh_brake
         FROM Telemetry_Raw WHERE vehicle_id = ? ORDER BY recorded_at DESC LIMIT 50`,
        [vehicleId]
    );
    const harshCount = recentReadings.filter(r => r.harsh_brake).length;
    brakeScore = adjustBrakeScoreByHarshEvents(brakeScore, harshCount, recentReadings.length || 1);

    const anomalies = [];
    const rpmHist = recentReadings.map(r => r.engine_rpm).filter(v => v != null);
    const loadHist = recentReadings.map(r => r.engine_load).filter(v => v != null);
    const tempHist = recentReadings.map(r => r.coolant_temp).filter(v => v != null);
    const voltHist = recentReadings.map(r => r.battery_voltage).filter(v => v != null);

    const rpmAnomaly = detectAnomaly(reading.engine_rpm, rpmHist, 'RPM');
    const loadAnomaly = detectAnomaly(reading.engine_load, loadHist, 'Carga de motor');
    const tempAnomaly = detectAnomaly(reading.coolant_temp, tempHist, 'Temperatura de motor');
    const voltAnomaly = detectAnomaly(reading.battery_voltage, voltHist, 'Voltaje de batería');
    [rpmAnomaly, loadAnomaly, tempAnomaly, voltAnomaly].forEach(a => { if (a) anomalies.push(a); });

    if (reading.battery_voltage != null && reading.battery_voltage < 11.8) {
        anomalies.push('Voltaje de batería bajo (posible batería en fin de vida).');
    }

    const driverScore = Math.max(0, Math.round((100 - harshCount * 4) * 10) / 10);
    const hasLoggedMaintenance = !!(lastTireEvent || lastBrakeEvent);
    const recommendation = buildRecommendation({ tireScore, brakeScore, anomalies, harshBrakeCount: harshCount, hasLoggedMaintenance });

    await pool.query(
        `INSERT INTO Telemetry_Heuristics
         (vehicle_id, engine_rpm, speed_kmh, engine_load, tire_wear_score, brake_wear_score, driver_score, anomaly_flag, anomaly_detail, ai_recommendation, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            vehicleId,
            reading.engine_rpm ?? null,
            reading.speed_kmh ?? null,
            reading.engine_load ?? null,
            tireScore,
            brakeScore,
            driverScore,
            anomalies.length > 0 ? 1 : 0,
            anomalies.length > 0 ? anomalies.join(' | ') : null,
            recommendation,
            source
        ]
    );

    // Avisamos al admin de la flota por mail cuando el score cruza el
    // umbral crítico — con cooldown de 7 días para no hacer spam (ver
    // maintenanceAlertService.js).
    if (tireScore < 40) {
        sendMaintenanceAlert(vehicleId, 'neumaticos', `Rotación de neumáticos vencida según kilometraje (score actual: ${tireScore}/100).`);
    }
    if (brakeScore < 40) {
        sendMaintenanceAlert(vehicleId, 'frenos', `Revisión de frenos recomendada por kilometraje (score actual: ${brakeScore}/100).`);
    }

    return { tireScore, brakeScore, driverScore, anomalies, recommendation };
}

module.exports = { processReading, wearScoreByKm, detectAnomaly, KM_TIRE_ROTATION, KM_BRAKE_CHECK, KM_FLUIDS_CHECK };
