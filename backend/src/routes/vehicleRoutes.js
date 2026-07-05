const express = require('express');
const router = express.Router();
const { getVehicles, addVehicle, updateVehicle, deleteVehicle, selectVehicleAsDriver } = require('../controllers/vehiclesController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.get('/', verifyToken, getVehicles); // los 3 roles pueden LEER (filtrado por tenant adentro del controller)
router.post('/', verifyToken, requireRole('super_admin', 'admin'), addVehicle);
router.patch('/:id', verifyToken, requireRole('super_admin', 'admin'), updateVehicle);
router.delete('/:id', verifyToken, requireRole('super_admin', 'admin'), deleteVehicle);
router.post('/select-as-driver', verifyToken, requireRole('driver'), selectVehicleAsDriver);

module.exports = router;
