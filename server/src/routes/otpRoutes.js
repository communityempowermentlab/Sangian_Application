const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');

// Public — used by both the Individual and Organization registration flows
// (purpose in the body disambiguates which). No auth exists yet at this
// point in either flow.
router.post('/send-email-otp', otpController.sendEmailOtp);
router.post('/send-phone-otp', otpController.sendPhoneOtp);
router.post('/verify', otpController.verifyOtp);

module.exports = router;
