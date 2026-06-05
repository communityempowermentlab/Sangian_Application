const express = require('express');
const router  = express.Router();
const hc      = require('../controllers/helpContentController');

router.get('/all/:lang',        hc.publicGetAll);
router.get('/:section/:lang',   hc.publicGetContent);

module.exports = router;
