const express = require('express');
const router = express.Router();
const { createApiKey, listApiKeys, revokeApiKey } = require('../controllers/apiKeysController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.get('/', verifyToken, requireRole('super_admin', 'admin'), listApiKeys);
router.post('/', verifyToken, requireRole('super_admin', 'admin'), createApiKey);
router.delete('/:id', verifyToken, requireRole('super_admin', 'admin'), revokeApiKey);

module.exports = router;
