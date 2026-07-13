const express = require('express');
const router = express.Router();
const { addDevice, getDevices, pairDevice, unpairDevice, getDeviceRawData, updateDevice, deleteDevice, sendDeviceCommand, getDeviceCommandLog } = require('../controllers/devicesController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.get('/', verifyToken, requireRole('super_admin', 'admin'), getDevices);
// Alta de equipos por IMEI: SOLO super_admin (Puma Code programa los
// equipos y les da el ID listo). El admin cliente nunca da de alta,
// solo pares (ver /pair).
router.post('/', verifyToken, requireRole('super_admin'), addDevice);
router.post('/pair', verifyToken, requireRole('super_admin', 'admin'), pairDevice);
router.delete('/:imei/pair', verifyToken, requireRole('super_admin', 'admin'), unpairDevice);
router.get('/:id/raw', verifyToken, requireRole('super_admin', 'admin'), getDeviceRawData);
router.patch('/:id', verifyToken, requireRole('super_admin', 'admin'), updateDevice);
router.delete('/:id', verifyToken, requireRole('super_admin'), deleteDevice);
// [NUEVO 13/07/2026] Enviar comando crudo al equipo (AT command sobre
// TCP, protocolo 0x80) — SOLO super_admin. Ver nota en devicesController.js.
router.post('/:imei/command', verifyToken, requireRole('super_admin'), sendDeviceCommand);
router.get('/:imei/commands', verifyToken, requireRole('super_admin'), getDeviceCommandLog);

module.exports = router;