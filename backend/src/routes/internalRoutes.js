const express = require('express');
const router = express.Router();
const { requireInternalSecret } = require('../middlewares/internalAuth');
const internal = require('../controllers/internalController');

router.use(requireInternalSecret);
router.get('/status', internal.getStatus);

module.exports = router;
