const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/usersController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

router.get('/', verifyToken, requireRole('super_admin', 'admin'), getUsers);
router.post('/', verifyToken, requireRole('super_admin', 'admin'), createUser);
router.patch('/:id', verifyToken, requireRole('super_admin', 'admin'), updateUser);
router.delete('/:id', verifyToken, requireRole('super_admin', 'admin'), deleteUser);

module.exports = router;
