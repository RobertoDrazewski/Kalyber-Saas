const express = require('express');
const router = express.Router();
const { sendContactEmail, sendQuoteEmail } = require('../controllers/contactController');

router.post('/', sendContactEmail);
router.post('/quote', sendQuoteEmail);

module.exports = router;