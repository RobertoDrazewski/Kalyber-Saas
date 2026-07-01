const express = require('express');
const router = express.Router();
const { getDrivers } = require('../controllers/driversController');
const { verifyToken } = require('../middlewares/authMiddleware'); // 1. Importar

// 2. Colocar verifyToken en el medio
router.get('/', verifyToken, getDrivers);

module.exports = router;