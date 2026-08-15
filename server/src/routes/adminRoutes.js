const express = require('express');
const router  = express.Router();
const adminController      = require('../controllers/adminController');
const adminChildController = require('../controllers/adminChildController');
const adminAssessorController = require('../controllers/adminAssessorController');
const adminChildGroupController = require('../controllers/adminChildGroupController');
const contactController    = require('../controllers/contactController');
const ticketController     = require('../controllers/ticketController');
const helpContentController = require('../controllers/helpContentController');
const smtpController       = require('../controllers/smtpController');
const ticketSettingsController = require('../controllers/ticketSettingsController');
const notificationController = require('../controllers/notificationController');
const adminOrgController   = require('../controllers/adminOrgController');
const adminIndividualController = require('../controllers/adminIndividualController');
const adminAuth            = require('../middleware/adminAuth');
const requireAdminOnly     = require('../middleware/requireAdminOnly');
const requireAdminOrOrgAuth = require('../middleware/requireAdminOrOrgAuth');
const resolveOrgScope       = require('../middleware/resolveOrgScope');
const { upload }           = require('../middleware/upload');
const { ticketUpload }     = require('../middleware/ticketUpload');
const { adminLogoUpload }  = require('../middleware/adminLogoUpload');

// ── Public routes (no auth required) ─────────────────────────────────────────
router.post('/login', adminController.loginAdmin);

// NOTE: every menu that used to be gated here (assessors/child-groups/
// dashboard) has since moved to requireAdminOrOrgAuth + resolveOrgScope on
// each route directly, so Organizations can reach them too, scoped to their
// own org — requireModuleAccessByPath's adminAuth call would otherwise
// reject an 'organization' JWT outright. Nothing currently needs the
// generic by-path wrapper; requireModuleAccessByPath itself stays available
// in requireModuleAccess.js for any future menu that's admin/staff-only.

// ── Dashboard — default landing page for admin/staff/organization alike.
// getDashboardStats/getLiveSessions read req.orgScope to filter KPIs down
// to the caller's own organization; Super Admin (isSuperAdmin) sees the
// unfiltered global view, unchanged from before. ─────────────────────────
router.get('/dashboard/stats',         requireAdminOrOrgAuth('dashboard'), resolveOrgScope, adminController.getDashboardStats);
router.get('/dashboard/live-sessions', requireAdminOrOrgAuth('dashboard'), resolveOrgScope, adminController.getLiveSessions);

// ── Protected routes (valid admin JWT required) ───────────────────────────────
// requireAdminOrOrgAuth() with no moduleKey — logging out isn't gated by any
// module grant, just needs a valid admin/staff/organization identity.
router.post('/logout/:sessionId', requireAdminOrOrgAuth(), adminController.logoutAdmin);

// Admin profile
router.get('/profile',            adminAuth, adminController.getAdminProfile);
router.put('/profile',            adminAuth, adminController.updateAdminProfile);
router.post('/profile/logo',      adminAuth, adminLogoUpload.single('logo'), adminController.updateAdminLogo);

// Children management — photo uploads handled via multipart/form-data.
// requireAdminOrOrgAuth('children') + resolveOrgScope replaces plain
// adminAuth here (see the note on requireModuleAccessByPath above) — admin
// and staff-with-'children'-grant behavior is unchanged, Organizations are
// newly able to reach these, scoped to their own children only.
router.get('/children',                   requireAdminOrOrgAuth('children'), resolveOrgScope, adminChildController.getAllChildren);
router.post('/children',                  requireAdminOrOrgAuth('children'), resolveOrgScope, upload.single('photo'), adminChildController.addChild);
router.get('/children/:childId/sessions', requireAdminOrOrgAuth('children'), resolveOrgScope, adminChildController.getChildSessions);
router.get('/children/:childId',          requireAdminOrOrgAuth('children'), resolveOrgScope, adminChildController.getChildById);
router.put('/children/:childId',          requireAdminOrOrgAuth('children'), resolveOrgScope, upload.single('photo'), adminChildController.updateChild);
router.put('/children/:childId/status',   requireAdminOrOrgAuth('children'), resolveOrgScope, adminChildController.toggleStatus);
router.get('/children/:childId/logs',     requireAdminOrOrgAuth('children'), resolveOrgScope, adminChildController.getChildLogs);

// Assessor management — org-scoped, same pattern as children. Admin and
// staff-with-'assessors'-grant behavior is unchanged, Organizations are
// newly able to reach these, scoped to their own assessors only.
router.get('/assessors',      requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.getAllAssessors);
router.post('/assessors',     requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.addAssessor);
router.get('/assessors/:id',  requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.getAssessorById);
router.put('/assessors/:id',  requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.updateAssessor);
router.put('/assessors/:id/reset-password', requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.resetAssessorPassword);
router.get('/assessors/:id/login-history', requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.getAssessorLoginHistory);
router.get('/assessors/:id/activity-log', requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.getAssessorActivityLog);
router.get('/assessors/:id/edit-logs', requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.getAssessorEditLogs);
router.post('/assessors/:id/sessions/:sessionId/force-logout', requireAdminOrOrgAuth('assessors'), resolveOrgScope, adminAssessorController.forceLogoutAssessorSession);

// Child Group management — org-scoped, same pattern as children/assessors/
// staff. Admin and staff-with-'child-groups'-grant behavior is unchanged,
// Organizations are newly able to reach these, scoped to their own groups
// only.
router.get('/child-groups',          requireAdminOrOrgAuth('child-groups'), resolveOrgScope, adminChildGroupController.getAllGroups);
router.post('/child-groups',         requireAdminOrOrgAuth('child-groups'), resolveOrgScope, adminChildGroupController.addGroup);
router.get('/child-groups/:id',      requireAdminOrOrgAuth('child-groups'), resolveOrgScope, adminChildGroupController.getGroupById);
router.put('/child-groups/:id',      requireAdminOrOrgAuth('child-groups'), resolveOrgScope, adminChildGroupController.updateGroup);

// Contact message badge count
router.get('/contact-messages/new-count', adminAuth, contactController.getNewMessageCount);

// Contact page management
router.get('/contact-info',                    adminAuth, contactController.getContactInfo);
router.post('/contact-info',                   adminAuth, contactController.updateContactInfo);
router.get('/contact-messages',                adminAuth, contactController.getMessages);
router.post('/contact-messages/update-status', adminAuth, contactController.updateMessageStatus);
router.delete('/contact-messages/:id',         adminAuth, contactController.deleteMessage);
router.get('/contact-email-settings',          adminAuth, contactController.getContactEmailSettings);
router.post('/contact-email-settings',         adminAuth, contactController.updateContactEmailSettings);

// ── Help & Support bilingual content management ───────────────────────────────
router.get('/help-content/:section/:lang',     adminAuth, helpContentController.adminGetContent);
router.post('/help-content',                   adminAuth, helpContentController.adminUpdateContent);

// ── Help & Support ticket management ─────────────────────────────────────────
router.get('/tickets/active-count',            adminAuth, ticketController.adminActiveTicketCount);
router.get('/tickets/stats',                   adminAuth, ticketController.adminTicketStats);
router.get('/tickets',                         adminAuth, ticketController.adminGetTickets);
router.get('/tickets/:ticket_id',              adminAuth, ticketController.adminGetTicket);
router.post('/tickets/:ticket_id/status',      adminAuth, ticketController.adminUpdateStatus);
router.post('/tickets/:ticket_id/reply',       adminAuth, ticketUpload.array('attachments', 3), ticketController.adminReply);

// ── SMTP settings ─────────────────────────────────────────────────────────────
router.get('/smtp-settings',    adminAuth, smtpController.getSmtpSettings);
router.post('/smtp-settings',   adminAuth, smtpController.updateSmtpSettings);
router.post('/smtp-test',       adminAuth, smtpController.testSmtpConnection);

// ── Help & Support email notification settings ────────────────────────────────
router.get('/help-email-settings',   adminAuth, ticketSettingsController.getHelpEmailSettings);
router.post('/help-email-settings',  adminAuth, ticketSettingsController.updateHelpEmailSettings);

// ── Notification Management (Settings → Notifications) ─────────────────────────
router.get('/notifications',              adminAuth, notificationController.getAllNotifications);
router.get('/notifications/:triggerKey',  adminAuth, notificationController.getNotificationByKey);
router.put('/notifications/:triggerKey',  adminAuth, notificationController.updateNotification);
router.patch('/notifications/:triggerKey/status', adminAuth, notificationController.updateNotificationStatus);

// ── Organization approval queue — Super Admin only (requireAdminOnly, not a
// grantable staff module — see adminOrgController.js) ─────────────────────
router.get('/organizations',              requireAdminOnly, adminOrgController.getAllOrganizations);
router.get('/organizations/:id',          requireAdminOnly, adminOrgController.getOrganizationById);
router.put('/organizations/:id',          requireAdminOnly, adminOrgController.updateOrganization);
router.put('/organizations/:id/contact',  requireAdminOnly, adminOrgController.updateOrganizationContact);
router.put('/organizations/:id/password', requireAdminOnly, adminOrgController.resetOrganizationPassword);
router.post('/organizations/:id/approve', requireAdminOnly, adminOrgController.approveOrganization);
router.post('/organizations/:id/reject',  requireAdminOnly, adminOrgController.rejectOrganization);
router.post('/organizations/:id/suspend', requireAdminOnly, adminOrgController.suspendOrganization);
router.post('/organizations/:id/activate',requireAdminOnly, adminOrgController.activateOrganization);
router.put('/organizations/:id/permissions', requireAdminOnly, adminOrgController.updateOrganizationPermissions);
router.post('/organizations/:id/sessions/:sessionId/force-logout', requireAdminOnly, adminOrgController.forceLogoutOrgSession);
router.get('/organizations/:id/login-history', requireAdminOnly, adminOrgController.getOrgLoginHistory);
router.get('/organizations/:id/activity-log', requireAdminOnly, adminOrgController.getOrgActivityLog);
router.get('/organizations/:id/edit-logs', requireAdminOnly, adminOrgController.getOrgEditLogs);

// ── Individual account oversight — Super Admin only, same precedent as
// organizations (individuals aren't org-scoped, so no org/staff actor
// should see this list). No approval workflow — accounts are active
// immediately on registration; just read + activate/deactivate. ──────────
router.get('/individuals',              requireAdminOnly, adminIndividualController.getAllIndividuals);
router.get('/individuals/:id',          requireAdminOnly, adminIndividualController.getIndividualById);
router.put('/individuals/:id/status',   requireAdminOnly, adminIndividualController.toggleStatus);
router.put('/individuals/:id/contact',  requireAdminOnly, adminIndividualController.updateIndividualContact);
router.put('/individuals/:id/profile',  requireAdminOnly, adminIndividualController.updateIndividualProfile);
router.put('/individuals/:id/password', requireAdminOnly, adminIndividualController.resetIndividualPassword);
router.get('/individuals/:id/login-history', requireAdminOnly, adminIndividualController.getIndividualLoginHistory);
router.get('/individuals/:id/edit-logs',requireAdminOnly, adminIndividualController.getIndividualEditLogs);

module.exports = router;
