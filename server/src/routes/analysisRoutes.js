const express = require('express');
const router  = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { getMeta, getOverview, getGameAnalytics, getGameSessions, getTopChildren, getChildrenSessions } = require('../controllers/analysisController');

router.get('/meta',                    adminAuth, getMeta);
router.get('/overview',                adminAuth, getOverview);
router.get('/top-children',            adminAuth, getTopChildren);
router.get('/children-sessions',       adminAuth, getChildrenSessions);
router.get('/game/:gameKey/sessions',  adminAuth, getGameSessions);
router.get('/game/:gameKey',           adminAuth, getGameAnalytics);

module.exports = router;
