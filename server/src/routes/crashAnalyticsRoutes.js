const express = require('express');
const router  = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
    getStatus,
    getApps,
    getSummary,
    getCrashes,
    getCrashEvents,
} = require('../controllers/crashAnalyticsController');

router.get('/status',                    adminAuth, getStatus);
router.get('/apps',                      adminAuth, getApps);
router.get('/summary',                   adminAuth, getSummary);
router.get('/crashes',                   adminAuth, getCrashes);
router.get('/crashes/:groupId/events',   adminAuth, getCrashEvents);

module.exports = router;
