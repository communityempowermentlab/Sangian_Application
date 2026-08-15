const express = require('express');
const router = express.Router();
const orgAuthController = require('../controllers/orgAuthController');
const requireAdminOrOrgAuth = require('../middleware/requireAdminOrOrgAuth');

// Login/logout are retired from here — organizations authenticate through
// the unified POST /api/admin/login and POST /api/admin/logout/:sessionId
// now (see adminController.js), same as admin/staff. Only registration
// (a genuinely separate, unauthenticated concern) stays on this router.
router.post('/register', orgAuthController.registerOrganization);
// Org-facing Settings page (AdminOrgSettings.jsx) — gated by the 'settings'
// module grant like any other module, since Settings is an optional
// per-org feature the Super Admin turns on, not auto-enabled (see
// ORG_PERMISSION_MODULES in adminOrgController.js). Checking the module
// grants full read+write, same flat all-or-nothing model every other
// module uses — see requireAdminOrOrgAuth.js.
router.get('/me', requireAdminOrOrgAuth('settings'), orgAuthController.getMyOrgProfile);
router.put('/me', requireAdminOrOrgAuth('settings'), orgAuthController.updateMyOrgProfile);

module.exports = router;
