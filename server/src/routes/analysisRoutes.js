const express = require('express');
const router  = express.Router();
const requireAdminOrOrgAuth = require('../middleware/requireAdminOrOrgAuth');
const resolveOrgScope = require('../middleware/resolveOrgScope');
const { getMeta, getOverview, getOverviewV2, getGameAnalytics, getGameSessions, getTopChildren, getChildrenSessions, getRegisteredParticipants } = require('../controllers/analysisController');

// Org-scoped — an Organization sees analysis only for its own children's
// game sessions (req.orgScope filters game_sessions.org_id in each
// controller function below), Super Admin/staff-with-'analysis'-grant see
// everything, unchanged.
router.get('/meta',                    requireAdminOrOrgAuth('analysis'), resolveOrgScope, getMeta);
router.get('/overview',                requireAdminOrOrgAuth('analysis'), resolveOrgScope, getOverview);
router.get('/overview-v2',             requireAdminOrOrgAuth('analysis'), resolveOrgScope, getOverviewV2);
router.get('/top-children',            requireAdminOrOrgAuth('analysis'), resolveOrgScope, getTopChildren);
router.get('/registered-participants', requireAdminOrOrgAuth('analysis'), resolveOrgScope, getRegisteredParticipants);
router.get('/children-sessions',       requireAdminOrOrgAuth('analysis'), resolveOrgScope, getChildrenSessions);
router.get('/game/:gameKey/sessions',  requireAdminOrOrgAuth('analysis'), resolveOrgScope, getGameSessions);
router.get('/game/:gameKey',           requireAdminOrOrgAuth('analysis'), resolveOrgScope, getGameAnalytics);

module.exports = router;
