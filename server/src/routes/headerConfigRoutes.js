const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();
const headerConfigController = require('../controllers/headerConfigController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (JWT required)
adminRouter.get('/', adminAuth, headerConfigController.getConfig);
adminRouter.put('/', adminAuth, headerConfigController.updateConfig);

// Public routes (no auth) — consumed by every game's header
publicRouter.get('/', headerConfigController.getPublicConfig);

module.exports = { adminRouter, publicRouter };
