const express = require('express');
const router = express.Router();
const { addDevice, getDevices, pairDevice, unpairDevice } = require('../controllers/devicesController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, getDevices);
router.post('/', verifyToken, addDevice);
router.post('/pair', verifyToken, pairDevice);
router.delete('/:imei/pair', verifyToken, unpairDevice);

module.exports = router;
