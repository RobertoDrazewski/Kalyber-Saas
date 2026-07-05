const express = require('express');
const router = express.Router();
const { getDrivers, addDriver, updateDriver, deleteDriver } = require('../controllers/driversController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.get('/', verifyToken, requireRole('super_admin', 'admin'), getDrivers);
router.post('/', verifyToken, requireRole('super_admin', 'admin'), addDriver);
router.patch('/:id', verifyToken, requireRole('super_admin', 'admin'), updateDriver);
router.delete('/:id', verifyToken, requireRole('super_admin', 'admin'), deleteDriver);

module.exports = router;
