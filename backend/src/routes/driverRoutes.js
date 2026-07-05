const express = require('express');
const router = express.Router();
const { getDrivers, updateDriver, deleteDriver } = require('../controllers/driversController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

// El alta (POST) se sacó de acá — ahora los choferes se crean desde
// /api/users (rol 'driver'), que es la única herramienta de creación.
router.get('/', verifyToken, requireRole('super_admin', 'admin'), getDrivers);
router.patch('/:id', verifyToken, requireRole('super_admin', 'admin'), updateDriver);
router.delete('/:id', verifyToken, requireRole('super_admin', 'admin'), deleteDriver);

module.exports = router;
