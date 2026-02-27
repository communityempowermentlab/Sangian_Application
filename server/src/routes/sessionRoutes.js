const express = require('express');
const router = express.Router();
const { startSession, failedSession, endSession } = require('../controllers/sessionController');

router.post('/start', startSession);
router.post('/fail', failedSession);
router.post('/end/:sessionId', endSession);

module.exports = router;
