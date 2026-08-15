const express    = require('express');
const router     = express.Router();
const { registerChild, lookupChild } = require('../controllers/childController');
const { upload } = require('../middleware/upload');
const assessorAuth = require('../middleware/assessorAuth');

// Photo is optional on public registration
router.post('/register', upload.single('photo'), registerChild);
// Gated behind assessor login (see assessorAuthController.js) — the
// "search child" step at /login now requires an authenticated assessor.
router.get('/lookup/:childId', assessorAuth, lookupChild);

module.exports = router;
