const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/scannerController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');
const { requireDeviceToken } = require('../middlewares/deviceAuth');

// [ACTUALIZADO 17/07/2026] Ahora 'taller' es un rol propio de Users
// (ver migration-taller-role.sql) — ya no comparte 'admin' con los
// clientes de flota. Esto resuelve de raíz la confusión de antes:
// antes había que cruzar contra Workshops.owner_user_id para saber si
// un 'admin' era en realidad un mecánico; ahora el rol mismo ya lo dice.

// Alta de taller: SOLO super_admin, con datos comerciales completos
// (mismo criterio que el alta de Devices por IMEI — administrativo
// nuestro, no autoservicio del cliente).
router.post('/workshops', verifyToken, requireRole('super_admin'), createWorkshop);
router.get('/workshops', verifyToken, requireRole('super_admin'), listWorkshops);
router.get('/workshops/:id/history', verifyToken, requireRole('super_admin'), getWorkshopHistory);
router.get('/my-workshop', verifyToken, requireRole('super_admin', 'taller'), getMyWorkshop);

router.post('/devices/claim', verifyToken, requireRole('super_admin', 'taller'), claimScannerDevice);
router.get('/devices', verifyToken, requireRole('super_admin', 'taller'), listMyDevices);

router.post('/vehicles', verifyToken, requireRole('super_admin', 'taller'), createScanVehicle);
router.get('/vehicles', verifyToken, requireRole('super_admin', 'taller'), listScanVehicles);

router.post('/sessions', verifyToken, requireRole('super_admin', 'taller'), startSession);
router.post('/sessions/:id/end', verifyToken, requireRole('super_admin', 'taller'), endSession);
router.get('/sessions/:id/live', verifyToken, requireRole('super_admin', 'taller'), getSessionLive);
router.patch('/dtc/:id/confirm', verifyToken, requireRole('super_admin', 'taller'), confirmDtc);

// Único endpoint que llama el ESP32 directamente — auth por device
// token, nunca por JWT de usuario.
router.post('/internal/diagnostics-log', requireDeviceToken, ingestDiagnosticsLog);

module.exports = router;