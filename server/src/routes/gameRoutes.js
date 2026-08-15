const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const assessmentSessionController = require('../controllers/assessmentSessionController');
const traceabilityController = require('../controllers/traceabilityController');
const authMiddleware = require('../middleware/auth');       // child session pass-through
const requireAdminOrOrgAuth = require('../middleware/requireAdminOrOrgAuth');
const resolveOrgScope = require('../middleware/resolveOrgScope');

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

// ── Assessment sessions (traceability chain — see assessmentSessionController.js) ──
// Starting one is an admin/staff/org action (picking a child + conducting
// role before handing off to the child) — same guard as children routes.
// Ending one is reached from the child-facing play flow, no auth of its
// own, matching every other child game-session endpoint on this router.
router.post('/assessment-sessions',                     requireAdminOrOrgAuth('children'), resolveOrgScope, assessmentSessionController.startAssessmentSession);
router.put('/assessment-sessions/:id/end',               assessmentSessionController.endAssessmentSession);
router.get('/assessment-sessions/:id',                   requireAdminOrOrgAuth('children'), resolveOrgScope, assessmentSessionController.getAssessmentSessionById);

// ── Report routes — org-scoped: an Organization sees only its own
// children's game sessions (req.orgScope filters game_sessions.org_id),
// Super Admin/staff-with-'reports'-grant see everything, unchanged. ───────
router.get('/reports/overview',                         requireAdminOrOrgAuth('reports'), resolveOrgScope, gameController.getReportOverview);
router.get('/reports/detail/:gameName',                 requireAdminOrOrgAuth('reports'), resolveOrgScope, gameController.getReportDetail);
router.get('/reports/assessment-trail',                 requireAdminOrOrgAuth('children'), resolveOrgScope, traceabilityController.getAssessmentTrail);

module.exports = router;
