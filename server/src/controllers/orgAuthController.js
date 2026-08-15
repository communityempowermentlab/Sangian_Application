const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { isChannelVerified } = require('./otpController');
const email = require('../services/emailService');
const { normalizeIndianMobile } = require('../utils/mobileNumber');
const { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } = require('../utils/passwordStrength');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @desc  Register an Organization — requires both org email and org mobile
//        to already be OTP-verified (purpose='org_registration'). Lands in
//        registration_status='pending' — cannot log in until a Super Admin
//        approves it (see adminOrgController.js).
// @route POST /api/org/register
// @access Public
const registerOrganization = async (req, res) => {
  try {
    const org_name = (req.body.org_name || '').trim();
    const org_type = (req.body.org_type || 'ngo').trim();
    const org_email = (req.body.org_email || '').trim().toLowerCase();
    const org_mobile = normalizeIndianMobile(req.body.org_mobile);
    const address = (req.body.address || '').trim();
    const city = (req.body.city || '').trim();
    const state = (req.body.state || '').trim();
    const country = (req.body.country || '').trim();
    const contact_person_name = (req.body.contact_person_name || '').trim();
    const contact_person_designation = (req.body.contact_person_designation || '').trim();
    const password = req.body.password || '';

    if (!org_name) return res.status(400).json({ success: false, message: 'Organization name is required.' });
    if (!EMAIL_RE.test(org_email)) return res.status(400).json({ success: false, message: 'A valid organization email is required.' });
    if (!org_mobile) return res.status(400).json({ success: false, message: 'A valid 10-digit Indian mobile number is required.' });
    if (!contact_person_name) return res.status(400).json({ success: false, message: 'Contact person name is required.' });
    if (!isStrongPassword(password)) return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS_MESSAGE });

    const emailVerified = await isChannelVerified('email', org_email, 'org_registration');
    const mobileVerified = await isChannelVerified('phone', org_mobile, 'org_registration');
    if (!emailVerified || !mobileVerified) {
      return res.status(400).json({ success: false, message: 'Please verify both the organization email and mobile number with OTP before registering.' });
    }

    const [existing] = await pool.query('SELECT id FROM organizations WHERE org_email = ?', [org_email]);
    if (existing.length) return res.status(400).json({ success: false, message: 'An organization with this email already exists.' });
    const [existingMobile] = await pool.query('SELECT id FROM organizations WHERE org_mobile = ?', [org_mobile]);
    if (existingMobile.length) return res.status(400).json({ success: false, message: 'An organization with this mobile number already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO organizations
        (org_name, org_type, org_email, org_mobile, password_hash, address, city, state, country,
         contact_person_name, contact_person_designation, email_verified, mobile_verified, registration_status, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'pending', 'active')`,
      [org_name, org_type || 'ngo', org_email, org_mobile, passwordHash, address, city, state, country, contact_person_name, contact_person_designation]
    );

    // Fire-and-forget success email — registration itself must not fail if
    // this errors (the OTP step already proved the address is reachable).
    email.sendOrgRegistrationReceived(org_email, org_name).catch(e => console.error('Org registration email error:', e.message));

    return res.status(201).json({
      success: true,
      message: 'Registration submitted. Your organization will be able to log in once approved by an administrator.',
      organization: { id: result.insertId, org_name, org_email, registration_status: 'pending' },
    });
  } catch (err) {
    console.error('registerOrganization error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// @desc  Own-organization profile read. Login/logout are retired from this
//        controller — see adminController.js's unified loginAdmin/logoutAdmin.
// @route GET /api/org/me
// @access Protected (requireAdminOrOrgAuth)
const getMyOrgProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, org_name, org_type, org_email, org_mobile, address, city, state, country,
              contact_person_name, contact_person_designation, registration_status, status, created_at
       FROM organizations WHERE id = ?`,
      [req.org.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Organization not found.' });
    return res.json({ success: true, profile: rows[0] });
  } catch (err) {
    console.error('getMyOrgProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Own-organization profile edit — org-facing Settings page (see
//        AdminOrgSettings.jsx). Deliberately separate from
//        adminOrgController.js's updateOrganization (Super-Admin-only,
//        touches any org) — this can only ever touch req.org.id's own row,
//        and excludes fields an org shouldn't self-edit (org_email/
//        org_mobile changes go through the same OTP-verification flow as
//        registration; registration_status/status are Super-Admin-only).
// @route PUT /api/org/me
// @access Protected (requireAdminOrOrgAuth('settings'))
const updateMyOrgProfile = async (req, res) => {
  try {
    const fields = ['address', 'city', 'state', 'country', 'contact_person_name', 'contact_person_designation'];
    const updates = [];
    const params = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    });
    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update.' });

    params.push(req.org.id);
    await pool.query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params);
    return res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    console.error('updateMyOrgProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { registerOrganization, getMyOrgProfile, updateMyOrgProfile };
