const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { isChannelVerified } = require('./otpController');
const { normalizeIndianMobile } = require('../utils/mobileNumber');
const { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } = require('../utils/passwordStrength');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getIp = (req) => {
  let ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '';
  if (ip === '::1') ip = '127.0.0.1';
  if (ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
  return ip;
};

// Super-Admin-only oversight of Individual accounts — same precedent as
// adminOrgController.js (organizations): individuals aren't org-scoped, so
// there's no org/staff actor that should see this list, only the Super Admin.
// Unlike organizations, individuals don't need approval (they're active
// immediately on registration — see individualAuthController.js), so this
// is read + activate/deactivate only, no approve/reject workflow.

// @desc  List individual users, optionally filtered by status/search.
// @route GET /api/admin/individuals
const getAllIndividuals = async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = [];
    const params = [];

    if (status) { where.push('status = ?'); params.push(status); }
    if (search) {
      where.push('(full_name LIKE ? OR email LIKE ? OR mobile LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.email_verified, u.mobile_verified, u.status, u.registration_date, u.updated_at,
              (SELECT MAX(login_time) FROM individual_login_sessions WHERE individual_id = u.id AND status = 'success') AS last_login
       FROM individual_users u ${whereStr} ORDER BY u.registration_date DESC`,
      params
    );
    return res.json({ success: true, individuals: rows });
  } catch (err) {
    console.error('getAllIndividuals error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Single individual detail — dob/gender/photo come from the linked
//        child profile (children.individual_id, auto-provisioned at
//        registration — see individualAuthController.js), not
//        individual_users itself.
// @route GET /api/admin/individuals/:id
const getIndividualById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.email_verified, u.mobile_verified, u.status, u.registration_date, u.updated_at,
              c.dob, c.gender, c.photo
       FROM individual_users u
       LEFT JOIN children c ON c.individual_id = u.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Individual not found.' });
    return res.json({ success: true, individual: rows[0] });
  } catch (err) {
    console.error('getIndividualById error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Activate/deactivate an individual account.
// @route PUT /api/admin/individuals/:id/status
const toggleStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status value.' });

    const [result] = await pool.query('UPDATE individual_users SET status = ? WHERE id = ?', [status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Individual not found.' });

    return res.json({ success: true, message: `Individual status updated to ${status}.` });
  } catch (err) {
    console.error('toggleStatus (individual) error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Change an Individual's name, email, and/or mobile number.
//        full_name has no uniqueness/OTP requirement — it's a display
//        label, not an identifier used for login or contact. Email/mobile
//        are identifiers: either one actually being CHANGED (not just
//        re-submitted with its current value) must have already passed the
//        OTP flow for the new value (POST /api/otp/send-email-otp|
//        send-phone-otp then /api/otp/verify with
//        purpose='individual_email_change'|'individual_mobile_change' —
//        see otpController.js, and OtpGate.jsx on the client, same
//        mechanism registration already uses). This proves the new
//        address/number is actually reachable before it's assigned to
//        someone else's account, not just typed into a form. Every changed
//        field is recorded in individual_profile_edit_logs — see
//        getIndividualEditLogs.
// @route PUT /api/admin/individuals/:id/contact
const updateIndividualContact = async (req, res) => {
  try {
    const { id } = req.params;
    const newName = (req.body.full_name || '').trim();
    const newEmail = (req.body.email || '').trim().toLowerCase();
    const newMobile = normalizeIndianMobile(req.body.mobile);

    if (!newName) return res.status(400).json({ success: false, message: 'Full name is required.' });
    if (!newEmail || !EMAIL_RE.test(newEmail)) return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    if (!newMobile) return res.status(400).json({ success: false, message: 'A valid 10-digit Indian mobile number is required.' });

    const [rows] = await pool.query('SELECT id, full_name, email, mobile FROM individual_users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Individual not found.' });
    const current = rows[0];

    const nameChanged = newName !== current.full_name;
    const emailChanged = newEmail !== current.email.toLowerCase();
    const mobileChanged = newMobile !== current.mobile;
    if (!nameChanged && !emailChanged && !mobileChanged) return res.status(400).json({ success: false, message: 'No changes to save.' });

    // Uniqueness — re-checked here as the DB-level backstop (matches
    // registration's convention), on top of individual_users' UNIQUE
    // constraints on email/mobile which would reject the UPDATE anyway;
    // this just produces a clean 409 instead of a raw ER_DUP_ENTRY.
    if (emailChanged) {
      const [dup] = await pool.query('SELECT id FROM individual_users WHERE email = ? AND id != ?', [newEmail, id]);
      if (dup.length) return res.status(409).json({ success: false, message: 'This email address is already registered to another account.' });
      if (!(await isChannelVerified('email', newEmail, 'individual_email_change'))) {
        return res.status(400).json({ success: false, message: 'Please verify the new email address with OTP before saving.' });
      }
    }
    if (mobileChanged) {
      const [dup] = await pool.query('SELECT id FROM individual_users WHERE mobile = ? AND id != ?', [newMobile, id]);
      if (dup.length) return res.status(409).json({ success: false, message: 'This mobile number is already registered to another account.' });
      if (!(await isChannelVerified('phone', newMobile, 'individual_mobile_change'))) {
        return res.status(400).json({ success: false, message: 'Please verify the new mobile number with OTP before saving.' });
      }
    }

    const updates = [];
    const params = [];
    if (nameChanged) { updates.push('full_name = ?'); params.push(newName); }
    if (emailChanged) { updates.push('email = ?', 'email_verified = 1'); params.push(newEmail); }
    if (mobileChanged) { updates.push('mobile = ?', 'mobile_verified = 1'); params.push(newMobile); }
    params.push(id);
    await pool.query(`UPDATE individual_users SET ${updates.join(', ')} WHERE id = ?`, params);

    const adminId = req.admin?.id || null;
    const adminName = req.admin?.name || req.admin?.email || 'Admin';
    const ip = getIp(req);
    const logRows = [];
    if (nameChanged) logRows.push([id, 'Full Name', current.full_name, newName, adminId, adminName, ip]);
    if (emailChanged) logRows.push([id, 'Email', current.email, newEmail, adminId, adminName, ip]);
    if (mobileChanged) logRows.push([id, 'Mobile Number', current.mobile, newMobile, adminId, adminName, ip]);
    for (const row of logRows) {
      await pool.query(
        'INSERT INTO individual_profile_edit_logs (individual_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        row
      );
    }

    return res.json({ success: true, message: 'Account details updated successfully.' });
  } catch (err) {
    console.error('updateIndividualContact error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email or mobile number is already registered to another account.' });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Super-Admin-initiated password reset — sets a new password
//        directly (no current-password check), same precedent as
//        adminOrgController.js's resetOrganizationPassword. Uses the
//        stronger public-facing password policy (isStrongPassword) since
//        individuals registered under that same policy. Logged to
//        individual_profile_edit_logs as a field entry (no old/new value
//        recorded, matching the org equivalent's convention of never
//        storing password values anywhere).
// @route PUT /api/admin/individuals/:id/password
const resetIndividualPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS_MESSAGE });
    }

    const [rows] = await pool.query('SELECT id FROM individual_users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Individual not found.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE individual_users SET password_hash = ? WHERE id = ?', [passwordHash, req.params.id]);

    const adminId = req.admin?.id || null;
    const adminName = req.admin?.name || req.admin?.email || 'Admin';
    await pool.query(
      'INSERT INTO individual_profile_edit_logs (individual_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address, action_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.params.id, 'Password', null, null, adminId, adminName, getIp(req), 'password_reset']
    );

    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('resetIndividualPassword error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const VALID_GENDERS = ['female', 'male', 'other', 'prefer_not_to_say'];

// mysql2 returns a DATE column as a JS Date at LOCAL midnight for that
// calendar day — converting it back with .toISOString() re-interprets
// those components as UTC and shifts the date backward by the server's UTC
// offset (e.g. IST: 1991-01-15 local midnight -> "1991-01-14T18:30:00Z").
// Local getters avoid that shift entirely.
function toDateOnlyString(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// @desc  Update an Individual's Date of Birth / Gender — these live on the
//        linked child profile (children.individual_id), not
//        individual_users. Unlike email/mobile, neither is a login
//        identifier, so no OTP re-verification is needed — a plain
//        Super-Admin edit, logged the same way as the contact fields.
// @route PUT /api/admin/individuals/:id/profile
const updateIndividualProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const dob = req.body.dob || '';
    const gender = (req.body.gender || '').trim();
    if (!dob || isNaN(new Date(dob).getTime())) return res.status(400).json({ success: false, message: 'A valid date of birth is required.' });
    if (!VALID_GENDERS.includes(gender)) return res.status(400).json({ success: false, message: 'Please select a valid gender.' });

    const [userRows] = await pool.query('SELECT id FROM individual_users WHERE id = ?', [id]);
    if (!userRows.length) return res.status(404).json({ success: false, message: 'Individual not found.' });

    const [childRows] = await pool.query('SELECT dob, gender FROM children WHERE individual_id = ?', [id]);
    if (!childRows.length) return res.status(404).json({ success: false, message: 'No linked profile found for this individual.' });
    const current = childRows[0];

    const currentDob = toDateOnlyString(current.dob);
    const dobChanged = dob !== currentDob;
    const genderChanged = gender !== current.gender;
    if (!dobChanged && !genderChanged) return res.status(400).json({ success: false, message: 'No changes to save.' });

    await pool.query('UPDATE children SET dob = ?, gender = ? WHERE individual_id = ?', [dob, gender, id]);

    const adminId = req.admin?.id || null;
    const adminName = req.admin?.name || req.admin?.email || 'Admin';
    const ip = getIp(req);
    if (dobChanged) {
      await pool.query(
        'INSERT INTO individual_profile_edit_logs (individual_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, 'Date of Birth', currentDob || null, dob, adminId, adminName, ip]
      );
    }
    if (genderChanged) {
      await pool.query(
        'INSERT INTO individual_profile_edit_logs (individual_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, 'Gender', current.gender, gender, adminId, adminName, ip]
      );
    }

    return res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('updateIndividualProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Per-session login/logout history for one individual — direct port
//        of assessorController.js's getAssessorLoginHistory, scoped to
//        individual_login_sessions (a simpler table — no logout_type/
//        failure_reason columns yet, so no force-logout/derived-status
//        here, just a straightforward read).
// @route GET /api/admin/individuals/:id/login-history
const getIndividualLoginHistory = async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT id FROM individual_users WHERE id = ?', [req.params.id]);
    if (!userRows.length) return res.status(404).json({ success: false, message: 'Individual not found.' });

    const [rows] = await pool.query(
      `SELECT id, status, login_time, logout_time, session_duration, ip_address, device_type, browser, os, location
       FROM individual_login_sessions WHERE individual_id = ? ORDER BY login_time DESC LIMIT 100`,
      [req.params.id]
    );

    const [[summary]] = await pool.query(
      `SELECT SUM(status = 'success') AS total_logins, SUM(status = 'failed') AS total_failed,
              MAX(CASE WHEN status = 'success' THEN login_time END) AS last_login
       FROM individual_login_sessions WHERE individual_id = ?`,
      [req.params.id]
    );

    return res.json({
      success: true,
      sessions: rows,
      summary: {
        totalLogins: Number(summary.total_logins) || 0,
        totalFailed: Number(summary.total_failed) || 0,
        lastLogin: summary.last_login,
      },
    });
  } catch (err) {
    console.error('getIndividualLoginHistory error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load login history.' });
  }
};

// @desc  Full field-level edit history for one individual's account.
// @route GET /api/admin/individuals/:id/edit-logs
const getIndividualEditLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, field_name, old_value, new_value, updated_by_name, ip_address, action_type, created_at
       FROM individual_profile_edit_logs WHERE individual_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    return res.json({ success: true, logs: rows });
  } catch (err) {
    console.error('getIndividualEditLogs error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getAllIndividuals, getIndividualById, toggleStatus, updateIndividualContact, updateIndividualProfile,
  resetIndividualPassword, getIndividualLoginHistory, getIndividualEditLogs,
};
