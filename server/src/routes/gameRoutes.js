const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middleware/auth');       // child session pass-through
const adminAuth = require('../middleware/adminAuth');       // admin JWT verification

// ── Child game session routes (accessible by authenticated children) ──────────
router.use(authMiddleware);

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../dashboard_pdfs')),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

router.post('/sessions/start',                          gameController.startGameSession);
router.put('/sessions/update/:sessionId',               gameController.updateGameSession);
router.get('/sessions/resume/:childId/:gameName',       gameController.getResumeSession);
router.get('/sessions/history/:childId',                gameController.getGameHistory);
router.get('/sessions/summaries/:childId',              gameController.getGameSummaries);
router.get('/sessions/pending-assessment/:childId',     gameController.getPendingAssessment);
router.post('/assessments',                             gameController.submitAssessment);
router.post('/pdfs/upload',                             upload.single('pdf'), gameController.uploadDashboardPdf);

// ── Admin-only report routes (valid admin JWT required) ───────────────────────
router.get('/reports/overview',                         adminAuth, gameController.getReportOverview);
router.get('/reports/detail/:gameName',                 adminAuth, gameController.getReportDetail);

module.exports = router;
