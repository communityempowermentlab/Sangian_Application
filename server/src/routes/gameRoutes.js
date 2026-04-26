const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middleware/auth');       // child session pass-through
const adminAuth = require('../middleware/adminAuth');       // admin JWT verification

// ── Child game session routes (accessible by authenticated children) ──────────
router.use(authMiddleware);

router.post('/sessions/start',                          gameController.startGameSession);
router.put('/sessions/update/:sessionId',               gameController.updateGameSession);
router.get('/sessions/resume/:childId/:gameName',       gameController.getResumeSession);
router.get('/sessions/history/:childId',                gameController.getGameHistory);
router.get('/sessions/summaries/:childId',              gameController.getGameSummaries);
router.get('/sessions/pending-assessment/:childId',     gameController.getPendingAssessment);
router.post('/assessments',                             gameController.submitAssessment);

// ── Admin-only report routes (valid admin JWT required) ───────────────────────
router.get('/reports/overview',                         adminAuth, gameController.getReportOverview);
router.get('/reports/detail/:gameName',                 adminAuth, gameController.getReportDetail);

module.exports = router;
