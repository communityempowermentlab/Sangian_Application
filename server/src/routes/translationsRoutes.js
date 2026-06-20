const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();
const translationsController = require('../controllers/translationsController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (JWT required)
adminRouter.get('/', adminAuth, translationsController.getGrid);
adminRouter.put('/cell', adminAuth, translationsController.updateCell);
adminRouter.get('/languages', adminAuth, translationsController.getLanguageSettings);
adminRouter.put('/languages', adminAuth, translationsController.updateLanguageSettings);

// Public routes (no auth) — consumed by the web/mobile app at runtime
publicRouter.get('/languages', translationsController.getPublicLanguageSettings);
publicRouter.get('/:code', translationsController.getPublicTranslations);

module.exports = { adminRouter, publicRouter };
