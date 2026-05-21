const express   = require('express');
const router    = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
    logError, getSummary, getErrors,
    getError, updateStatus, bulkUpdateStatus, purgeResolved, generateSampleLogs,
} = require('../controllers/crashLogController');

// Public — frontend error reporter (no admin token required)
router.post('/log', logError);

// Admin-protected
router.get('/summary',           adminAuth, getSummary);
router.get('/list',              adminAuth, getErrors);
router.get('/:id',               adminAuth, getError);
router.patch('/bulk-status',     adminAuth, bulkUpdateStatus);
router.patch('/:id/status',      adminAuth, updateStatus);
router.delete('/purge',          adminAuth, purgeResolved);
router.post('/generate-samples', adminAuth, generateSampleLogs);

module.exports = router;
