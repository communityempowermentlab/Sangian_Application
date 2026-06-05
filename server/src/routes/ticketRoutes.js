const express = require('express');
const router  = express.Router();
const tc      = require('../controllers/ticketController');
const { ticketUpload } = require('../middleware/ticketUpload');

// ── OTP verification ──────────────────────────────────────────────────────────
router.post('/send-otp',    tc.sendOtp);
router.post('/verify-otp',  tc.verifyOtp);

// ── Ticket operations (email-verified token required) ─────────────────────────
router.post('/create',
    tc.requireVerifiedEmail,
    ticketUpload.array('attachments', 3),
    tc.createTicket
);

router.get('/my-tickets',   tc.requireVerifiedEmail, tc.getMyTickets);
router.get('/:ticket_id',   tc.requireVerifiedEmail, tc.getTicketDetail);

router.post('/:ticket_id/reply',
    tc.requireVerifiedEmail,
    ticketUpload.array('attachments', 3),
    tc.replyToTicket
);

module.exports = router;
