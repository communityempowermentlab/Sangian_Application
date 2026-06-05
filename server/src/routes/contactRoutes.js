const express = require('express');
const router  = express.Router();
const { submitContact, getPublicContactInfo } = require('../controllers/contactController');

router.get('/info',   getPublicContactInfo);
router.post('/submit', submitContact);

module.exports = router;
