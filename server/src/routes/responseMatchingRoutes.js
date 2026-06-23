const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();
const responseMatchingController = require('../controllers/responseMatchingController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (JWT required)
adminRouter.get('/', adminAuth, responseMatchingController.getConfig);
adminRouter.put('/', adminAuth, responseMatchingController.updateConfig);

// Public routes (no auth) — consumed by every game that needs the matching mode
publicRouter.get('/', responseMatchingController.getPublicConfig);

module.exports = { adminRouter, publicRouter };
