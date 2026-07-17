const express = require('express');
const router = express.Router();
const {
    createWorkshop,
    listWorkshops,
    getWorkshopHistory,
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

// [NOTA] Por ahora el mecánico usa el rol 'admin' ya existente (no hay
// un rol 'mechanic' dedicado todavía) — funciona porque este producto
// vive en tablas completamente separadas (Workshops/ScanVehicles/...),
// así que no hay riesgo de que un mecánico vea flotas de otro cliente
// ni viceversa. Si el día de mañana hace falta separar permisos más
// fino dentro de un mismo taller (ej: empleados vs. dueño), ahí sí
// conviene sumar un rol dedicado.

// Alta de taller: SOLO super_admin, con datos comerciales completos
// (mismo criterio que el alta de Devices por IMEI — administrativo
// nuestro, no autoservicio del cliente).
router.post('/workshops', verifyToken, requireRole('super_admin'), createWorkshop);
router.get('/workshops', verifyToken, requireRole('super_admin'), listWorkshops);
router.get('/workshops/:id/history', verifyToken, requireRole('super_admin'), getWorkshopHistory);

router.post('/devices/claim', verifyToken, requireRole('super_admin', 'admin'), claimScannerDevice);
router.get('/devices', verifyToken, requireRole('super_admin', 'admin'), listMyDevices);

router.post('/vehicles', verifyToken, requireRole('super_admin', 'admin'), createScanVehicle);
router.get('/vehicles', verifyToken, requireRole('super_admin', 'admin'), listScanVehicles);

router.post('/sessions', verifyToken, requireRole('super_admin', 'admin'), startSession);
router.post('/sessions/:id/end', verifyToken, requireRole('super_admin', 'admin'), endSession);
router.get('/sessions/:id/live', verifyToken, requireRole('super_admin', 'admin'), getSessionLive);
router.patch('/dtc/:id/confirm', verifyToken, requireRole('super_admin', 'admin'), confirmDtc);

// Único endpoint que llama el ESP32 directamente — auth por device
// token, nunca por JWT de usuario.
router.post('/internal/diagnostics-log', requireDeviceToken, ingestDiagnosticsLog);

module.exports = router;
