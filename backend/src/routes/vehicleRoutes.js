const express = require('express');
const router = express.Router();
const { getVehicles, addVehicle, updateVehicle, deleteVehicle } = require('../controllers/vehiclesController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, getVehicles);
router.post('/', verifyToken, addVehicle);
router.patch('/:id', verifyToken, updateVehicle);
router.delete('/:id', verifyToken, deleteVehicle);

module.exports = router;
