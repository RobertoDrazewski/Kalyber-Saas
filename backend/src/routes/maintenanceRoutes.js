const express = require('express');
const router = express.Router();
const { getMaintenanceAlerts, getFleetHealth, getEventsForVehicle, addEvent, updateEvent, deleteEvent } = require('../controllers/maintenanceController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.get('/alerts', verifyToken, getMaintenanceAlerts);
router.get('/fleet-health', verifyToken, getFleetHealth);
router.get('/events/:vehicleId', verifyToken, getEventsForVehicle);
router.post('/events', verifyToken, requireRole('super_admin', 'admin', 'driver'), addEvent);
router.patch('/events/:id', verifyToken, requireRole('super_admin', 'admin'), updateEvent);
router.delete('/events/:id', verifyToken, requireRole('super_admin', 'admin'), deleteEvent);

module.exports = router;
