const express = require('express');
const router = express.Router();
const { registerChild, lookupChild } = require('../controllers/childController');

router.post('/register', registerChild);
router.get('/lookup/:childId', lookupChild);

module.exports = router;
