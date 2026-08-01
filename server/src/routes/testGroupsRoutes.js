const express = require('express');
const adminRouter = express.Router();
const testGroupsController = require('../controllers/testGroupsController');
const adminAuth = require('../middleware/adminAuth');

// Admin-only — consumed by the (already admin-only) Analysis dashboard as
// quick Test-filter presets, and managed from Settings → Test Groups.
adminRouter.get('/',       adminAuth, testGroupsController.getList);
adminRouter.post('/',      adminAuth, testGroupsController.createGroup);
adminRouter.put('/:id',    adminAuth, testGroupsController.updateGroup);
adminRouter.delete('/:id', adminAuth, testGroupsController.deleteGroup);

module.exports = { adminRouter };
