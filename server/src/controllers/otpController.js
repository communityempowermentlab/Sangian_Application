const { pool } = require('../config/db');
const email = require('../services/emailService');
const { sendOtpSms } = require('../services/smsService');
const { normalizeIndianMobile } = require('../utils/mobileNumber');

// Generalizes ticketController.js's sendOtp/verifyOtp pattern against the
// new otp_verifications table (channel + purpose columns) instead of the
// ticket-only email_verifications table — see db.js's otp_verifications for
// why these are kept separate.

// individual_email_change/individual_mobile_change and org_email_change/
// org_mobile_change: used by the Admin panel's Individual/Organization edit
// flows (adminIndividualController.js / adminOrgController.js) to verify a
// NEW email/mobile actually belongs to someone reachable there before it's
// applied to an existing account — same send/verify mechanics as
// registration, just a different purpose tag so the flows' OTPs never
// collide (see idx_channel_identifier_purpose in db.js).
const VALID_PURPOSES = [
  'individual_registration', 'org_registration',
  'individual_email_change', 'individual_mobile_change',
  'org_email_change', 'org_mobile_change',
];

// Purposes whose identifier space is the organizations table (org_email/
// org_mobile) rather than individual_users (email/mobile).
const ORG_PURPOSES = ['org_registration', 'org_email_change', 'org_mobile_change'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── In-memory rate limit, same shape as ticketController.js's, keyed by
// channel:identifier so email and phone limits for the same person don't
// collide. ──────────────────────────────────────────────────────────────
const otpRateLimit = new Map();
const OTP_WINDOW_MS = 10 * 60 * 1000; // 10 min
const OTP_MAX_SEND = 5;

const checkOtpRateLimit = (key) => {
  const now = Date.now();
  const rec = otpRateLimit.get(key);
  if (!rec || now - rec.windowStart > OTP_WINDOW_MS) {
    otpRateLimit.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (rec.count >= OTP_MAX_SEND) return false;
  rec.count++;
  return true;
};

const randomOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// Checks whether an email/mobile is already registered in the table this
// purpose creates accounts in — checked BEFORE an OTP is generated/sent, so
// a returning user (or someone re-typing an already-registered address)
// gets an immediate, clear rejection instead of burning an email/SMS send
// on an OTP they were never going to be able to use (the account-creation
// endpoints re-check this again at insert time regardless — see
// individualAuthController.js/orgAuthController.js — to close the race
// window between this check and actual registration).
const isIdentifierTaken = async (channel, identifier, purpose) => {
  const isOrg = ORG_PURPOSES.includes(purpose);
  const table = isOrg ? 'organizations' : 'individual_users';
  const column = isOrg
    ? (channel === 'email' ? 'org_email' : 'org_mobile')
    : (channel === 'email' ? 'email' : 'mobile');
  const [rows] = await pool.query(`SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`, [identifier]);
  return rows.length > 0;
};

const insertOtp = async (channel, identifier, purpose) => {
  const otp = randomOtp();
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await pool.query('DELETE FROM otp_verifications WHERE channel = ? AND identifier = ? AND purpose = ?', [channel, identifier, purpose]);
  await pool.query(
    'INSERT INTO otp_verifications (channel, identifier, purpose, otp, expires_at, verified, attempts) VALUES (?, ?, ?, ?, ?, 0, 0)',
    [channel, identifier, purpose, otp, expires]
  );
  return otp;
};

// ── POST /api/otp/send-email-otp ──────────────────────────────────────────
// Sends a real email — no on-screen dev-mode fallback for this channel
// (unlike phone, which has no SMS gateway yet). If SMTP isn't configured
// (Admin > Settings > SMTP), this fails loudly instead of silently
// exposing the OTP, so a misconfiguration is caught during setup rather
// than masked.
const sendEmailOtp = async (req, res) => {
  try {
    const raw = (req.body.email || '').trim().toLowerCase();
    const purpose = req.body.purpose;
    if (!raw || !EMAIL_RE.test(raw)) return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    if (!VALID_PURPOSES.includes(purpose)) return res.status(400).json({ success: false, message: 'Invalid or missing purpose.' });

    if (!checkOtpRateLimit(`email:${raw}`)) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Please wait 10 minutes before trying again.' });
    }

    if (await isIdentifierTaken('email', raw, purpose)) {
      return res.status(409).json({ success: false, message: 'This email address is already registered. Please log in instead.', alreadyRegistered: true });
    }

    const [[smtp]] = await pool.query('SELECT host, username FROM smtp_settings WHERE id = 1');
    if (!smtp?.host || !smtp?.username) {
      return res.status(503).json({ success: false, message: 'Email delivery is not configured yet. Please contact the administrator.' });
    }

    const otp = await insertOtp('email', raw, purpose);

    try {
      await email.sendOtp(raw, otp);
    } catch (sendErr) {
      console.error('Registration OTP email error:', sendErr.message);
      return res.status(502).json({ success: false, message: 'Failed to send the OTP email. Please try again shortly.' });
    }

    return res.json({ success: true, message: 'OTP sent to your email address.' });
  } catch (err) {
    console.error('sendEmailOtp error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ── POST /api/otp/send-phone-otp ──────────────────────────────────────────
const sendPhoneOtp = async (req, res) => {
  try {
    const mobile = normalizeIndianMobile(req.body.mobile);
    const purpose = req.body.purpose;
    if (!mobile) return res.status(400).json({ success: false, message: 'A valid 10-digit Indian mobile number is required.' });
    if (!VALID_PURPOSES.includes(purpose)) return res.status(400).json({ success: false, message: 'Invalid or missing purpose.' });

    if (!checkOtpRateLimit(`phone:${mobile}`)) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Please wait 10 minutes before trying again.' });
    }

    if (await isIdentifierTaken('phone', mobile, purpose)) {
      return res.status(409).json({ success: false, message: 'This mobile number is already registered. Please log in instead.', alreadyRegistered: true });
    }

    const otp = await insertOtp('phone', mobile, purpose);

    // Real gateway send (see smsService.js) — no on-screen dev-mode
    // fallback anymore, matching email: if the gateway call fails, the
    // request fails loudly instead of silently exposing the code.
    try {
      await sendOtpSms(mobile, otp);
    } catch (e) {
      console.error('Registration OTP SMS error:', e.message);
      return res.status(502).json({ success: false, message: 'Failed to send the OTP SMS. Please try again shortly.' });
    }

    return res.json({ success: true, message: 'OTP sent to your mobile number.' });
  } catch (err) {
    console.error('sendPhoneOtp error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ── POST /api/otp/verify ──────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
  try {
    const channel = req.body.channel;
    const purpose = req.body.purpose;
    const otp = (req.body.otp || '').trim();
    let identifier = (req.body.identifier || '').trim();

    if (!['email', 'phone'].includes(channel)) return res.status(400).json({ success: false, message: 'Invalid channel.' });
    if (!VALID_PURPOSES.includes(purpose)) return res.status(400).json({ success: false, message: 'Invalid or missing purpose.' });
    if (channel === 'email') identifier = identifier.toLowerCase();
    if (channel === 'phone') identifier = normalizeIndianMobile(identifier) || identifier;
    if (!identifier || !otp) return res.status(400).json({ success: false, message: 'Identifier and OTP are required.' });

    const [rows] = await pool.query(
      'SELECT * FROM otp_verifications WHERE channel = ? AND identifier = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
      [channel, identifier, purpose]
    );
    if (!rows.length) return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });

    const record = rows[0];
    if (new Date() > new Date(record.expires_at)) return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    if (record.attempts >= 5) return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });

    if (record.otp !== otp) {
      await pool.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
    }

    await pool.query('UPDATE otp_verifications SET verified = 1 WHERE id = ?', [record.id]);
    return res.json({ success: true, message: 'Verified.' });
  } catch (err) {
    console.error('verifyOtp error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// Shared helper used by individualAuthController/orgAuthController to
// confirm both channels were verified for a given identifier pair before
// completing registration.
const isChannelVerified = async (channel, identifier, purpose) => {
  const normalized = channel === 'email' ? identifier.trim().toLowerCase() : (normalizeIndianMobile(identifier) || identifier.trim());
  const [rows] = await pool.query(
    'SELECT verified FROM otp_verifications WHERE channel = ? AND identifier = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
    [channel, normalized, purpose]
  );
  return rows.length > 0 && rows[0].verified === 1;
};

module.exports = { sendEmailOtp, sendPhoneOtp, verifyOtp, isChannelVerified };
