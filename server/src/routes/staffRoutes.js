const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const adminAuth = require('../middleware/adminAuth');
const requireModuleAccess = require('../middleware/requireModuleAccess');
const requireAdminOnly = require('../middleware/requireAdminOnly');

// Self-service profile routes — reachable by the logged-in staff member
// themself (or an admin) regardless of the 'staff' module grant; managing
// your own profile isn't a "menu" a staff account can be denied. Only
// adminAuth applies here, not requireModuleAccess.
router.get('/me/profile',            adminAuth, staffController.getMyProfile);
router.put('/me/profile',            adminAuth, staffController.updateMyProfile);
router.put('/me/change-password',    adminAuth, staffController.changeMyPassword);

// Navigation / report-download trackers — any logged-in role may call these
// (both no-op for admin inside the controller); not a "menu" so no
// requireModuleAccess.
router.post('/log-page-view',        adminAuth, staffController.logPageView);
router.post('/log-report-download',  adminAuth, staffController.logReportDownload);

// Log History (Login History + Activity History) — administrator-only,
// deliberately NOT gated by requireModuleAccess('staff'): a staff account
// must never see this even if granted the 'staff' module, since the whole
// point is oversight of staff by admins.
router.get('/activity-log',          requireAdminOnly, staffController.getActivityLog);
router.get('/:id/login-history',     requireAdminOnly, staffController.getStaffLoginHistory);
router.post('/:id/sessions/:sessionId/force-logout', requireAdminOnly, staffController.forceLogoutStaffSession);

// Staff Management itself — gated by the 'staff' module grant for staff
// accounts; always allowed for admin (requireModuleAccess short-circuits).
router.get('/',                      requireModuleAccess('staff'), staffController.getAllStaff);
router.get('/attendance',            requireModuleAccess('staff'), staffController.getAttendance);
router.get('/:id',                   requireModuleAccess('staff'), staffController.getStaffById);
router.post('/',                     requireModuleAccess('staff'), staffController.addStaff);
router.put('/:id',                   requireModuleAccess('staff'), staffController.updateStaff);
router.delete('/:id',                requireModuleAccess('staff'), staffController.deleteStaff);
router.put('/:id/reset-password',    requireModuleAccess('staff'), staffController.resetStaffPassword);

module.exports = router;
