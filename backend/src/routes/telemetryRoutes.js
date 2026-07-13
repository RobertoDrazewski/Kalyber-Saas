const express = require('express');
const router = express.Router();
const {
    getLiveTelemetry, getVehicleSeries, getVehicleAlarms, getVehicleDTC, getVehicleTripsDevice, ingestRealReading,
} = require('../controllers/telemetryController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/live', verifyToken, getLiveTelemetry);
router.get('/vehicle/:id', verifyToken, getVehicleSeries);
router.get('/vehicle/:id/alarms', verifyToken, getVehicleAlarms);         // [NUEVO] historial de frenadas/giros/colisión/geocerca/exceso de velocidad
router.get('/vehicle/:id/dtc', verifyToken, getVehicleDTC);               // [NUEVO] códigos de falla del motor
router.get('/vehicle/:id/trips-device', verifyToken, getVehicleTripsDevice); // [NUEVO] viajes reportados por el propio equipo
router.post('/ingest', ingestRealReading); // el equipo real llama esto sin JWT (usa IMEI como credencial)

module.exports = router;
