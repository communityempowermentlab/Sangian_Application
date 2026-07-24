const express = require('express');
const router  = express.Router();
const adminController      = require('../controllers/adminController');
const adminChildController = require('../controllers/adminChildController');
const adminAssessorController = require('../controllers/adminAssessorController');
const contactController    = require('../controllers/contactController');
const ticketController     = require('../controllers/ticketController');
const helpContentController = require('../controllers/helpContentController');
const smtpController       = require('../controllers/smtpController');
const ticketSettingsController = require('../controllers/ticketSettingsController');
const adminAuth            = require('../middleware/adminAuth');
const { upload }           = require('../middleware/upload');
const { ticketUpload }     = require('../middleware/ticketUpload');
const { adminLogoUpload }  = require('../middleware/adminLogoUpload');

// ── Public routes (no auth required) ─────────────────────────────────────────
router.post('/login', adminController.loginAdmin);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard/stats',         adminAuth, adminController.getDashboardStats);
router.get('/dashboard/live-sessions', adminAuth, adminController.getLiveSessions);

// ── Protected routes (valid admin JWT required) ───────────────────────────────
router.post('/logout/:sessionId', adminAuth, adminController.logoutAdmin);

// Admin profile
router.get('/profile',            adminAuth, adminController.getAdminProfile);
router.put('/profile',            adminAuth, adminController.updateAdminProfile);
router.post('/profile/logo',      adminAuth, adminLogoUpload.single('logo'), adminController.updateAdminLogo);

// Children management — photo uploads handled via multipart/form-data
router.get('/children',                   adminAuth, adminChildController.getAllChildren);
router.post('/children',                  adminAuth, upload.single('photo'), adminChildController.addChild);
router.get('/children/:childId/sessions', adminAuth, adminChildController.getChildSessions);
router.get('/children/:childId',          adminAuth, adminChildController.getChildById);
router.put('/children/:childId',          adminAuth, upload.single('photo'), adminChildController.updateChild);
router.put('/children/:childId/status',   adminAuth, adminChildController.toggleStatus);
router.get('/children/:childId/logs',     adminAuth, adminChildController.getChildLogs);

// Assessor management
router.get('/assessors',      adminAuth, adminAssessorController.getAllAssessors);
router.post('/assessors',     adminAuth, adminAssessorController.addAssessor);
router.get('/assessors/:id',  adminAuth, adminAssessorController.getAssessorById);
router.put('/assessors/:id',  adminAuth, adminAssessorController.updateAssessor);

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

module.exports = router;
