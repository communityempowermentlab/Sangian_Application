const express = require('express');
const router = express.Router();
const { startSession, failedSession, endSession } = require('../controllers/sessionController');
const assessorAuth = require('../middleware/assessorAuth');

// Gated behind assessor login — part of the "search child" step at /login
// (see assessorAuthController.js). /end is unrelated (fired later, once an
// assessment session is already underway) and stays public.
router.post('/start', assessorAuth, startSession);
router.post('/fail', assessorAuth, failedSession);
router.post('/end/:sessionId', endSession);

module.exports = router;
