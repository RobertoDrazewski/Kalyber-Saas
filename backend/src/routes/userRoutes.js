const express = require('express');
const router = express.Router();
const { getUsers } = require('../controllers/usersController');
const { verifyToken } = require('../middlewares/authMiddleware'); // 1. Importar

// 2. Colocar verifyToken en el medio
router.get('/', verifyToken, getUsers);


module.exports = router;