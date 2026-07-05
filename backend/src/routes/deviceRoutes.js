const express = require('express');
const router = express.Router();
const { addDevice, getDevices, pairDevice, unpairDevice } = require('../controllers/devicesController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.get('/', verifyToken, requireRole('super_admin', 'admin'), getDevices);
// Alta de equipos por IMEI: SOLO super_admin (Puma Code programa los
// equipos y les da el ID listo). El admin cliente nunca da de alta,
// solo pares (ver /pair).
router.post('/', verifyToken, requireRole('super_admin'), addDevice);
router.post('/pair', verifyToken, requireRole('super_admin', 'admin'), pairDevice);
router.delete('/:imei/pair', verifyToken, requireRole('super_admin', 'admin'), unpairDevice);

module.exports = router;
