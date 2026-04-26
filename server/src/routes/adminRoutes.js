const express = require('express');
const router  = express.Router();
const adminController      = require('../controllers/adminController');
const adminChildController = require('../controllers/adminChildController');
const adminAssessorController = require('../controllers/adminAssessorController');
const adminAuth            = require('../middleware/adminAuth');
const { upload }           = require('../middleware/upload');

// ── Public routes (no auth required) ─────────────────────────────────────────
router.post('/login', adminController.loginAdmin);

// ── Protected routes (valid admin JWT required) ───────────────────────────────
router.post('/logout/:sessionId', adminAuth, adminController.logoutAdmin);

// Children management — photo uploads handled via multipart/form-data
router.get('/children',                   adminAuth, adminChildController.getAllChildren);
router.post('/children',                  adminAuth, upload.single('photo'), adminChildController.addChild);
router.get('/children/:childId/sessions', adminAuth, adminChildController.getChildSessions);
router.get('/children/:childId',          adminAuth, adminChildController.getChildById);
router.put('/children/:childId',          adminAuth, upload.single('photo'), adminChildController.updateChild);
router.put('/children/:childId/status',   adminAuth, adminChildController.toggleStatus);

// Assessor management
router.get('/assessors',      adminAuth, adminAssessorController.getAllAssessors);
router.post('/assessors',     adminAuth, adminAssessorController.addAssessor);
router.get('/assessors/:id',  adminAuth, adminAssessorController.getAssessorById);
router.put('/assessors/:id',  adminAuth, adminAssessorController.updateAssessor);

module.exports = router;
