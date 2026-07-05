const express = require('express');
const router = express.Router();
const { addDevice, getDevices, pairDevice, unpairDevice } = require('../controllers/devicesController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.get('/', verifyToken, requireRole('super_admin', 'admin'), getDevices);
router.post('/', verifyToken, requireRole('super_admin', 'admin'), addDevice);
router.post('/pair', verifyToken, requireRole('super_admin', 'admin'), pairDevice);
router.delete('/:imei/pair', verifyToken, requireRole('super_admin', 'admin'), unpairDevice);

module.exports = router;
