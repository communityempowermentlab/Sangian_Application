const express = require('express');
const router = express.Router();
const assessorAuthController = require('../controllers/assessorAuthController');
const assessorController = require('../controllers/assessorController');
const assessorAuth = require('../middleware/assessorAuth');
const { upload } = require('../middleware/upload');

router.post('/login', assessorAuthController.loginAssessor);
router.post('/logout/:sessionId', assessorAuth, assessorAuthController.logoutAssessor);
router.get('/me', assessorAuth, assessorController.getMyProfile);
router.put('/change-password', assessorAuth, assessorController.changeMyPassword);
router.get('/dashboard', assessorAuth, assessorController.getDashboard);

// "Add New Child" — org/creator are always derived server-side from the
// authenticated assessor inside addChild itself, never accepted from the
// request body. See assessorController.js's addChild for the full
// authorization chain (active assessor -> active org -> insert).
router.get('/child-groups', assessorAuth, assessorController.getChildGroups);
router.post('/children', assessorAuth, upload.single('photo'), assessorController.addChild);

module.exports = router;
