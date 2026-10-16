const express = require('express');
const adminRouter = express.Router();
const scoreBinSettingsController = require('../controllers/scoreBinSettingsController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (JWT required) — Settings → Score Distribution. The Analysis
// dashboards read these settings server-side, so no public route is needed.
adminRouter.get('/', adminAuth, scoreBinSettingsController.getConfig);
adminRouter.put('/:gameKey', adminAuth, scoreBinSettingsController.updateGame);

module.exports = { adminRouter };
