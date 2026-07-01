const express = require('express');
const router = express.Router();
const { getLiveTelemetry, getVehicleSeries, ingestRealReading } = require('../controllers/telemetryController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/live', verifyToken, getLiveTelemetry);
router.get('/vehicle/:id', verifyToken, getVehicleSeries);
router.post('/ingest', ingestRealReading); // el equipo real llama esto sin JWT (usa IMEI como credencial)

module.exports = router;
