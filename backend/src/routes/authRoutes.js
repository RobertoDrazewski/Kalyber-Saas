const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');

// El login NO lleva verifyToken (debe ser público) y es método POST
router.post('/login', login);

module.exports = router;