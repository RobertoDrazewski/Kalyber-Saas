const express = require('express');
const router = express.Router();
const { addFuelLog, getFuelLogs } = require('../controllers/fuelController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.post('/', verifyToken, requireRole('super_admin', 'admin'), addFuelLog);
router.get('/vehicle/:vehicleId', verifyToken, requireRole('super_admin', 'admin'), getFuelLogs);

module.exports = router;