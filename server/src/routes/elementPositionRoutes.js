const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();
const elementPositionController = require('../controllers/elementPositionController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (JWT required)
adminRouter.get('/:gameKey', adminAuth, elementPositionController.getAll);
adminRouter.put('/:gameKey/:screenNum', adminAuth, elementPositionController.updateScreen);
adminRouter.post('/:gameKey/:screenNum/reset', adminAuth, elementPositionController.resetScreen);

// Public routes (no auth) — consumed by the game client
publicRouter.get('/:gameKey', elementPositionController.getPublicAll);

module.exports = { adminRouter, publicRouter };
