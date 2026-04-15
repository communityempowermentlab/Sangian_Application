const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middleware/auth');

// All game routes should be protected
router.use(authMiddleware);

// Start a new game session
router.post('/sessions/start', gameController.startGameSession);

// Update a game session (pause, quit, progress, completion)
router.put('/sessions/update/:sessionId', gameController.updateGameSession);

// Get resume data (finds active/paused sessions)
router.get('/sessions/resume/:childId/:gameName', gameController.getResumeSession);

// Get game history for a child
router.get('/sessions/history/:childId', gameController.getGameHistory);

// Get game summaries (last played, attempts count) for a child
router.get('/sessions/summaries/:childId', gameController.getGameSummaries);

// Submit assessment data mapped internally to a session
router.post('/assessments', gameController.submitAssessment);

// ─── Report routes ────────────────────────────────────────────────────────────
// Overview: KPI aggregates for all 9 games
router.get('/reports/overview', gameController.getReportOverview);

// Detail: per-attempt listing for a specific game
router.get('/reports/detail/:gameName', gameController.getReportDetail);

module.exports = router;
