const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();
const testConfigController = require('../controllers/testConfigController');
const adminAuth = require('../middleware/adminAuth');
const requireAdminOrOrgAuth = require('../middleware/requireAdminOrOrgAuth');

// Read access: admin, staff, AND organization/org-bound-staff sessions —
// Reports/Analysis (AdminReports.jsx, AdminAnalysis.jsx) fetch this to sort
// their test cards/tabs/charts to match this page's configured sequence,
// and that must work for an organization's own login too, not just Super
// Admin. No moduleKey: this is read-only display metadata (title/category/
// enabled/order), not gated behind any specific module grant — same
// self-service-exemption pattern as the logout route below.
adminRouter.get('/', requireAdminOrOrgAuth(), testConfigController.getList);

// Write access stays Super-Admin/staff only — organizations must never be
// able to change global test visibility or ordering.
adminRouter.put('/order', adminAuth, testConfigController.updateOrder);
adminRouter.put('/:key', adminAuth, testConfigController.updateStatus);

// Public routes (no auth) — consumed by the front-end to filter visible games
publicRouter.get('/', testConfigController.getPublicEnabledMap);

module.exports = { adminRouter, publicRouter };
