const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();
const orgTypeController = require('../controllers/orgTypeController');
const adminAuth = require('../middleware/adminAuth');

// Admin routes (admin/staff JWT required) — nav visibility under the 'meta'
// module is gated client-side (AdminMeta.jsx/staffPermissions.js), same
// precedent as this tab's other sections (contact-info, help-content).
// Deletion is intentionally not offered — deactivating a type keeps its
// value intact for organizations already using it (see updateOrgType).
adminRouter.get('/',      adminAuth, orgTypeController.getAllOrgTypes);
adminRouter.post('/',     adminAuth, orgTypeController.addOrgType);
adminRouter.put('/:id',   adminAuth, orgTypeController.updateOrgType);

// Public — consumed by the Organization registration form's dropdown.
publicRouter.get('/', orgTypeController.getPublicOrgTypes);

module.exports = { adminRouter, publicRouter };
