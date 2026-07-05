const express = require('express');
const router = express.Router();
const { sendContactEmail, sendQuoteEmail, sendCartQuote } = require('../controllers/contactController');

router.post('/', sendContactEmail);
router.post('/quote', sendQuoteEmail);
router.post('/cart-quote', sendCartQuote);

module.exports = router;
