const express = require('express');
const router = express.Router();
const { getTrips, getCalendar, getDayDetail, reconstructTrips } = require('../controllers/tripsController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, getTrips);
router.get('/calendar', verifyToken, getCalendar);
router.get('/calendar/:day', verifyToken, getDayDetail);
router.post('/reconstruct', verifyToken, reconstructTrips);

module.exports = router;
