const express = require('express');
const router = express.Router();
const { getMaintenanceAlerts, getFleetHealth } = require('../controllers/maintenanceController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/alerts', verifyToken, getMaintenanceAlerts);
router.get('/fleet-health', verifyToken, getFleetHealth);

module.exports = router;
