const express = require('express');
const router = express.Router();
const individualAuthController = require('../controllers/individualAuthController');
const individualAuth = require('../middleware/individualAuth');

router.post('/register', individualAuthController.registerIndividual);
router.post('/login', individualAuthController.loginIndividual);
router.post('/logout/:sessionId', individualAuth, individualAuthController.logoutIndividual);
router.get('/me', individualAuth, individualAuthController.getMyProfile);
router.put('/profile', individualAuth, individualAuthController.updateMyProfile);
router.post('/complete-profile', individualAuth, individualAuthController.completeProfile);
router.put('/change-password', individualAuth, individualAuthController.changeMyPassword);
router.post('/ensure-session', individualAuth, individualAuthController.ensureSession);

module.exports = router;
