const express    = require('express');
const router     = express.Router();
const { registerChild, lookupChild, getAssignedTestsForChild } = require('../controllers/childController');
const { upload } = require('../middleware/upload');
const assessorAuth = require('../middleware/assessorAuth');

// Photo is optional on public registration
router.post('/register', upload.single('photo'), registerChild);
// Gated behind assessor login (see assessorAuthController.js) — the
// "search child" step at /login now requires an authenticated assessor.
router.get('/lookup/:childId', assessorAuth, lookupChild);
// Public like /register above — Home.jsx's game-selection screen only has
// the child_id it already knows from localStorage, no assessor/admin token.
router.get('/assigned-tests/:childId', getAssignedTestsForChild);

module.exports = router;
