const express = require('express');
const adminRouter  = express.Router();
const publicRouter = express.Router();
const { getPage, updatePage, getPublicPage } = require('../controllers/cmsController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (JWT required)
adminRouter.post('/update',      adminAuth, updatePage);
adminRouter.get('/:page_key',    adminAuth, getPage);

// Public routes (no auth)
publicRouter.get('/:page_key', getPublicPage);

module.exports = { adminRouter, publicRouter };
