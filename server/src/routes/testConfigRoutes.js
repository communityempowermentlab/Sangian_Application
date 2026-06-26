const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();
const testConfigController = require('../controllers/testConfigController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (JWT required)
adminRouter.get('/', adminAuth, testConfigController.getList);
adminRouter.put('/order', adminAuth, testConfigController.updateOrder);
adminRouter.put('/:key', adminAuth, testConfigController.updateStatus);

// Public routes (no auth) — consumed by the front-end to filter visible games
publicRouter.get('/', testConfigController.getPublicEnabledMap);

module.exports = { adminRouter, publicRouter };
