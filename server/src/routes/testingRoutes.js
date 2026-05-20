const express   = require('express');
const router    = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
    getSummary, getResults, getResult,
    updateDevStatus, ingest, triggerRun, getRuns,
} = require('../controllers/testingController');

// Python engine posts results here (uses a shared secret instead of admin JWT)
const engineAuth = (req, res, next) => {
    const secret = req.headers['x-engine-secret'];
    if (secret && secret === (process.env.TESTING_ENGINE_SECRET || 'sangian-test-engine-secret')) {
        return next();
    }
    // Also allow admin JWT
    return adminAuth(req, res, next);
};

router.get('/summary',              adminAuth,  getSummary);
router.get('/runs',                 adminAuth,  getRuns);
router.get('/results',              adminAuth,  getResults);
router.get('/results/:id',          adminAuth,  getResult);
router.patch('/results/:id/status', adminAuth,  updateDevStatus);
router.post('/trigger',             adminAuth,  triggerRun);
router.post('/ingest',              engineAuth, ingest);

module.exports = router;
