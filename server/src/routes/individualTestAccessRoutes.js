const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();
const controller = require('../controllers/individualTestAccessController');
const adminAuth = require('../middleware/adminAuth');

// Admin/staff only — this is a platform-wide Individual User setting,
// entirely independent of Organization-wise Test Assignment. Organizations
// never read or write it (unlike test-config's own GET, which orgs need
// for their own display ordering).
adminRouter.get('/', adminAuth, controller.getList);
adminRouter.put('/:key', adminAuth, controller.updateAccess);

// Public — consumed by Home.jsx to gate an Individual User's own play.
publicRouter.get('/', controller.getPublicAllowedMap);

module.exports = { adminRouter, publicRouter };
