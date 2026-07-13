const express = require('express');
const router = express.Router();
const { getVehicleGeofences, createGeofence, deleteGeofence, resyncGeofence } = require('../controllers/geofencesController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/vehicle/:id', verifyToken, getVehicleGeofences);
router.post('/', verifyToken, createGeofence);
router.post('/:id/resync', verifyToken, resyncGeofence);
router.delete('/:id', verifyToken, deleteGeofence);

module.exports = router;