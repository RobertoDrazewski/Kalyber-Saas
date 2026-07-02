const express = require('express');
const router = express.Router();
const { getDrivers, addDriver, updateDriver, deleteDriver } = require('../controllers/driversController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, getDrivers);
router.post('/', verifyToken, addDriver);
router.patch('/:id', verifyToken, updateDriver);
router.delete('/:id', verifyToken, deleteDriver);

module.exports = router;
