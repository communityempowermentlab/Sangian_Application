const express = require('express');
const router = express.Router();
const assessorAuthController = require('../controllers/assessorAuthController');
const assessorController = require('../controllers/assessorController');
const assessorAuth = require('../middleware/assessorAuth');

router.post('/login', assessorAuthController.loginAssessor);
router.post('/logout/:sessionId', assessorAuth, assessorAuthController.logoutAssessor);
router.get('/me', assessorAuth, assessorController.getMyProfile);
router.put('/change-password', assessorAuth, assessorController.changeMyPassword);
router.get('/dashboard', assessorAuth, assessorController.getDashboard);

module.exports = router;
