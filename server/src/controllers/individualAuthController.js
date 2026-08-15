const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requestIp = require('request-ip');
const axios = require('axios');
const JWT_SECRET = require('../config/jwtSecret');
const { parseUserAgent, normalizeIp } = require('../utils/parseUserAgent');
const { isChannelVerified } = require('./otpController');
const email = require('../services/emailService');
const { normalizeIndianMobile } = require('../utils/mobileNumber');
const { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } = require('../utils/passwordStrength');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_GENDERS = ['female', 'male', 'other', 'prefer_not_to_say'];

// Same IP→location lookup as adminController.js/sessionController.js
// (duplicated locally, matching this codebase's existing convention rather
// than introducing a new shared util for a 12-line helper).
const getLocationFromIp = async (ip) => {
  try {
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return 'Localhost';
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    if (response.data && response.data.status === 'success') {
      return `${response.data.city}, ${response.data.regionName}, ${response.data.country}`;
    }
  } catch (error) {
    console.error('IP location lookup failed', error.message);
  }
  return 'Unknown';
};

// An Individual plays the games as their own player profile — one linked
// `children` row per individual, auto-provisioned here (at registration,
// or via completeProfile for an account that predates this feature). This
// is the ONLY new data-model piece needed: every game page, RequireChildAuth,
// resume/restart, and PDF generation already work off `children`/
// `game_sessions` and are completely untouched — the individual simply
// becomes a normal "logged-in child" as far as that whole engine is
// concerned once `currentChild`/`sessionId` are set client-side.
// child_id is generated the same way childController.js's registerChild
// falls back when none is supplied — the new row's own numeric id, as a
// string — but written back with an UPDATE ... WHERE id = ? (not WHERE
// child_id = ?, which registerChild's own fallback path never actually
// backfills — see childController.js). Returns the same shape
// childController.js's lookupChild does, so the client can store it
// directly as `currentChild`.
async function provisionLinkedChild(individualId, name, mobile, dob, gender) {
  const [result] = await pool.query(
    'INSERT INTO children (name, dob, gender, mobile, individual_id, status) VALUES (?, ?, ?, ?, ?, ?)',
    [name, dob, gender, mobile, individualId, 'active']
  );
  const childId = String(result.insertId);
  await pool.query('UPDATE children SET child_id = ? WHERE id = ?', [childId, result.insertId]);
  return { child_id: childId, name, dob, gender, mobile, status: 'active', photo: null };
}

// Opens a login_sessions row for the individual's linked child and returns
// its id — the same table/shape sessionController.js's startSession
// writes, so the client's stored `sessionId` behaves identically to the
// existing child-login flow (Navbar's logout, RequireChildAuth, etc. all
// already just read this from localStorage without knowing who created it).
async function openChildSession(childId, individualId, req) {
  const { browser, os, deviceType } = parseUserAgent(req.headers['user-agent']);
  const ip = normalizeIp(requestIp.getClientIp(req)) || 'Unknown';
  const location = await getLocationFromIp(ip);
  const [result] = await pool.query(
    `INSERT INTO login_sessions (child_id, status, login_time, ip_address, device_type, browser, os, location, individual_id)
     VALUES (?, 'success', ?, ?, ?, ?, ?, ?, ?)`,
    [childId, new Date(), ip, deviceType, browser, os, location, individualId]
  );
  return result.insertId;
}

// @desc  Register an Individual — requires both email and mobile to already
//        be OTP-verified (purpose='individual_registration') before the
//        account is created. Also collects DOB/gender so the linked child
//        profile (see provisionLinkedChild) can be created immediately,
//        with no separate "complete your profile" step for new signups.
// @route POST /api/individual/register
// @access Public
const registerIndividual = async (req, res) => {
  try {
    const full_name = (req.body.full_name || '').trim();
    const emailAddr = (req.body.email || '').trim().toLowerCase();
    const mobile = normalizeIndianMobile(req.body.mobile);
    const password = req.body.password || '';
    const dob = req.body.dob || '';
    const gender = (req.body.gender || '').trim();

    if (!full_name) return res.status(400).json({ success: false, message: 'Full name is required.' });
    if (!EMAIL_RE.test(emailAddr)) return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    if (!mobile) return res.status(400).json({ success: false, message: 'A valid 10-digit Indian mobile number is required.' });
    if (!isStrongPassword(password)) return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS_MESSAGE });
    if (!dob || isNaN(new Date(dob).getTime())) return res.status(400).json({ success: false, message: 'A valid date of birth is required.' });
    if (!VALID_GENDERS.includes(gender)) return res.status(400).json({ success: false, message: 'Please select a gender.' });

    const emailVerified = await isChannelVerified('email', emailAddr, 'individual_registration');
    const mobileVerified = await isChannelVerified('phone', mobile, 'individual_registration');
    if (!emailVerified || !mobileVerified) {
      return res.status(400).json({ success: false, message: 'Please verify both your email and mobile number with OTP before registering.' });
    }

    const [existing] = await pool.query('SELECT id FROM individual_users WHERE email = ?', [emailAddr]);
    if (existing.length) return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    const [existingMobile] = await pool.query('SELECT id FROM individual_users WHERE mobile = ?', [mobile]);
    if (existingMobile.length) return res.status(400).json({ success: false, message: 'An account with this mobile number already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO individual_users (full_name, email, mobile, password_hash, email_verified, mobile_verified, status)
       VALUES (?, ?, ?, ?, 1, 1, 'active')`,
      [full_name, emailAddr, mobile, passwordHash]
    );

    await provisionLinkedChild(result.insertId, full_name, mobile, dob, gender);

    const token = jwt.sign({ id: result.insertId, email: emailAddr, role: 'individual' }, JWT_SECRET, { expiresIn: '12h' });

    // Fire-and-forget success email — registration itself must not fail if
    // this errors (the OTP step already proved the address is reachable).
    // sendIndividualWelcome (via emailService's send()) already logs
    // delivered/failed status server-side for monitoring/troubleshooting.
    email.sendIndividualWelcome(emailAddr, full_name, mobile).catch(e => console.error('Individual welcome email error:', e.message));

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: { id: result.insertId, full_name, email: emailAddr, role: 'individual' },
    });
  } catch (err) {
    console.error('registerIndividual error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// @desc  Individual login — by email or mobile + password. Also bridges
//        into the shared child-gameplay engine: resolves (or, for an
//        account that predates the linked-child feature, flags as missing)
//        the individual's own child profile, and opens a login_sessions
//        row for it so the client can set `currentChild`/`sessionId` in
//        localStorage exactly like the existing child-login flow — every
//        game page then works completely unmodified.
// @route POST /api/individual/login
// @access Public
const loginIndividual = async (req, res) => {
  try {
    const identifier = (req.body.identifier || '').trim();
    const password = req.body.password || '';
    if (!identifier || !password) return res.status(400).json({ success: false, message: 'Please provide your email/mobile and password.' });

    const [rows] = await pool.query(
      'SELECT * FROM individual_users WHERE email = ? OR mobile = ?',
      [identifier.toLowerCase(), identifier]
    );

    const userAgent = req.headers['user-agent'];
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const ip = normalizeIp(requestIp.getClientIp(req)) || 'Unknown';
    const location = await getLocationFromIp(ip);
    const loginTime = new Date();

    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
      if (rows.length) {
        await pool.query(
          `INSERT INTO individual_login_sessions (individual_id, status, login_time, ip_address, device_type, browser, os, location)
           VALUES (?, 'failed', ?, ?, ?, ?, ?, ?)`,
          [rows[0].id, loginTime, ip, deviceType, browser, os, location]
        );
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = rows[0];
    if (user.status !== 'active') return res.status(403).json({ success: false, message: 'Your account is inactive.' });

    const [sessionResult] = await pool.query(
      `INSERT INTO individual_login_sessions (individual_id, status, login_time, ip_address, device_type, browser, os, location)
       VALUES (?, 'success', ?, ?, ?, ?, ?, ?)`,
      [user.id, loginTime, ip, deviceType, browser, os, location]
    );

    const token = jwt.sign({ id: user.id, email: user.email, role: 'individual' }, JWT_SECRET, { expiresIn: '12h' });

    const [childRows] = await pool.query(
      'SELECT child_id, name, dob, gender, mobile, status, photo FROM children WHERE individual_id = ?',
      [user.id]
    );

    const response = {
      success: true,
      message: 'Login successful.',
      token,
      sessionId: sessionResult.insertId,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: 'individual' },
    };

    if (childRows.length) {
      const child = childRows[0];
      response.child = child;
      response.gameSessionId = await openChildSession(child.child_id, user.id, req);
    } else {
      // Only possible for an individual_users row created before this
      // feature existed (dob/gender were never collected) — the client
      // must collect them via completeProfile before gameplay can start.
      response.needsProfileCompletion = true;
    }

    return res.json(response);
  } catch (err) {
    console.error('loginIndividual error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// @desc  One-time completion for an individual account that predates the
//        linked-child feature (registered without dob/gender). Creates the
//        linked child profile and opens its first game session, same as a
//        fresh registration would have.
// @route POST /api/individual/complete-profile
// @access Protected (individualAuth)
const completeProfile = async (req, res) => {
  try {
    const dob = req.body.dob || '';
    const gender = (req.body.gender || '').trim();
    if (!dob || isNaN(new Date(dob).getTime())) return res.status(400).json({ success: false, message: 'A valid date of birth is required.' });
    if (!VALID_GENDERS.includes(gender)) return res.status(400).json({ success: false, message: 'Please select a gender.' });

    const [existingChild] = await pool.query('SELECT child_id FROM children WHERE individual_id = ?', [req.individual.id]);
    if (existingChild.length) return res.status(400).json({ success: false, message: 'Profile already completed.' });

    const [[user]] = await pool.query('SELECT full_name, mobile FROM individual_users WHERE id = ?', [req.individual.id]);
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    const child = await provisionLinkedChild(req.individual.id, user.full_name, user.mobile, dob, gender);
    const gameSessionId = await openChildSession(child.child_id, req.individual.id, req);

    return res.json({ success: true, message: 'Profile completed.', child, gameSessionId });
  } catch (err) {
    console.error('completeProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Individual logout.
// @route POST /api/individual/logout/:sessionId
// @access Protected (individualAuth)
const logoutIndividual = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ success: false, message: 'Session ID is required.' });

    const [result] = await pool.query(
      `UPDATE individual_login_sessions
       SET logout_time = NOW(), session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
       WHERE id = ? AND status = 'success' AND logout_time IS NULL`,
      [sessionId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Active session not found or already ended.' });

    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('logoutIndividual error:', err);
    return res.status(500).json({ success: false, message: 'Server error during logout.' });
  }
};

// @desc  Own-profile read — includes dob/gender/photo from the linked
//        child profile (see provisionLinkedChild) purely for display on
//        the Account page; nothing org/admin-scoped is reachable by it.
// @route GET /api/individual/me
// @access Protected (individualAuth)
const getMyProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.mobile, u.status, u.registration_date,
              c.child_id, c.dob, c.gender, c.photo
       FROM individual_users u
       LEFT JOIN children c ON c.individual_id = u.id
       WHERE u.id = ?`,
      [req.individual.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Account not found.' });
    return res.json({ success: true, profile: rows[0] });
  } catch (err) {
    console.error('getMyProfile (individual) error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Self-service profile update — Full Name, Date of Birth, Gender.
//        Email/mobile stay read-only here (they're login identifiers,
//        changed only by a Super Admin via the OTP-gated admin endpoint —
//        see adminIndividualController.js's updateIndividualContact).
//        Keeps the linked child's own name/dob/gender in sync since the
//        individual IS that child for gameplay purposes (see
//        provisionLinkedChild) — letting them drift would show one name on
//        the Account page and a different one on game PDFs/scoreboards.
// @route PUT /api/individual/profile
// @access Protected (individualAuth)
const updateMyProfile = async (req, res) => {
  try {
    const fullName = (req.body.full_name || '').trim();
    const dob = req.body.dob || '';
    const gender = (req.body.gender || '').trim();
    if (!fullName) return res.status(400).json({ success: false, message: 'Full name is required.' });
    if (!dob || isNaN(new Date(dob).getTime())) return res.status(400).json({ success: false, message: 'A valid date of birth is required.' });
    if (!VALID_GENDERS.includes(gender)) return res.status(400).json({ success: false, message: 'Please select a valid gender.' });

    const [userRows] = await pool.query('SELECT id FROM individual_users WHERE id = ?', [req.individual.id]);
    if (!userRows.length) return res.status(404).json({ success: false, message: 'Account not found.' });

    await pool.query('UPDATE individual_users SET full_name = ? WHERE id = ?', [fullName, req.individual.id]);
    await pool.query('UPDATE children SET name = ?, dob = ?, gender = ? WHERE individual_id = ?', [fullName, dob, gender, req.individual.id]);

    return res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('updateMyProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Re-establishes the linked child_id/game-session bridge for an
//        already-authenticated individual whose localStorage lost
//        `currentChild`/`sessionId` without their individualToken being
//        cleared — e.g. quitting a game, which (like every one of the
//        ~15 game pages) treats a missing session as a plain child logout
//        and clears currentChild, leaving the individual still logged in
//        per their own token but stranded with nothing to resume into.
//        Same shape as loginIndividual's bridging, just without
//        re-checking a password.
// @route POST /api/individual/ensure-session
// @access Protected (individualAuth)
const ensureSession = async (req, res) => {
  try {
    const [childRows] = await pool.query(
      'SELECT child_id, name, dob, gender, mobile, status, photo FROM children WHERE individual_id = ?',
      [req.individual.id]
    );
    if (!childRows.length) return res.status(404).json({ success: false, message: 'No linked profile found for this account.' });

    const child = childRows[0];
    const gameSessionId = await openChildSession(child.child_id, req.individual.id, req);
    return res.json({ success: true, child, gameSessionId });
  } catch (err) {
    console.error('ensureSession (individual) error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Self-service password change — requires the current password,
//        matching the same self-service pattern as
//        assessorController.js's changeMyPassword. Uses the stronger
//        public-facing password policy (isStrongPassword) since Individual
//        is a self-registered public account, not an admin-managed one —
//        the same policy this account was created under at registration.
// @route PUT /api/individual/change-password
// @access Protected (individualAuth)
const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS_MESSAGE });
    }

    const [rows] = await pool.query('SELECT password_hash FROM individual_users WHERE id = ?', [req.individual.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Account not found.' });

    const currentOk = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!currentOk) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE individual_users SET password_hash = ? WHERE id = ?', [passwordHash, req.individual.id]);

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('changeMyPassword (individual) error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { registerIndividual, loginIndividual, logoutIndividual, getMyProfile, updateMyProfile, completeProfile, changeMyPassword, ensureSession };
