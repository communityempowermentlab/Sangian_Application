const express = require('express');
const adminRouter = express.Router();
const analysisSettingsController = require('../controllers/analysisSettingsController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (JWT required) — consumed by the Analysis dashboard itself, which
// is already admin-only, so no separate public route is needed here.
adminRouter.get('/', adminAuth, analysisSettingsController.getConfig);
adminRouter.put('/', adminAuth, analysisSettingsController.updateConfig);

module.exports = { adminRouter };
