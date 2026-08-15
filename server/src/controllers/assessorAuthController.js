const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requestIp = require('request-ip');
const axios = require('axios');
const JWT_SECRET = require('../config/jwtSecret');
const { parseUserAgent, normalizeIp } = require('../utils/parseUserAgent');
const { logAssessorActivity } = require('../utils/logAssessorActivity');

// Same IP→location lookup as individualAuthController.js/adminController.js
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

// @desc  Assessor login — by email + password. This gates the existing
//        child-search step at /login (client Login.jsx): only an
//        authenticated assessor session can look up a child or start an
//        assessment session (see childRoutes.js/sessionRoutes.js).
// @route POST /api/assessor/login
// @access Public
const loginAssessor = async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide your email and password.' });

    // Email is only unique PER ORGANIZATION (see adminAssessorController.js),
    // so more than one assessor row can share the same email across
    // different organizations. Disambiguate by finding the row whose
    // password actually matches — in practice this is deterministic since
    // each org sets its own assessor's password independently.
    const [rows] = await pool.query('SELECT * FROM assessors WHERE email = ?', [email]);

    const userAgent = req.headers['user-agent'];
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const ip = normalizeIp(requestIp.getClientIp(req)) || 'Unknown';
    const location = await getLocationFromIp(ip);
    const loginTime = new Date();

    let assessor = null;
    for (const row of rows) {
      if (row.password_hash && await bcrypt.compare(password, row.password_hash)) {
        assessor = row;
        break;
      }
    }

    if (!assessor) {
      // Only log a failed attempt when it's unambiguously attributable to
      // one assessor — with multiple same-email rows we can't tell which
      // one the caller meant, so skip the audit entry rather than guess.
      if (rows.length === 1) {
        await pool.query(
          `INSERT INTO assessor_login_sessions (assessor_id, status, login_time, ip_address, device_type, browser, os, location, failure_reason)
           VALUES (?, 'failed', ?, ?, ?, ?, ?, ?, ?)`,
          [rows[0].id, loginTime, ip, deviceType, browser, os, location, 'Incorrect password']
        );
        await logAssessorActivity({
          assessorId: rows[0].id, assessorName: rows[0].name, actorType: 'assessor', actorId: rows[0].id, actorName: rows[0].name,
          module: 'auth', actionType: 'login_failed', description: 'Failed login attempt (incorrect password)', req,
          status: 'failure', errorMessage: 'Incorrect password',
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (assessor.status !== 'active') return res.status(403).json({ success: false, message: 'Your assessor account is inactive. Please contact the administrator.' });

    const [sessionResult] = await pool.query(
      `INSERT INTO assessor_login_sessions (assessor_id, status, login_time, ip_address, device_type, browser, os, location)
       VALUES (?, 'success', ?, ?, ?, ?, ?, ?)`,
      [assessor.id, loginTime, ip, deviceType, browser, os, location]
    );

    const token = jwt.sign({ id: assessor.id, email: assessor.email, role: 'assessor' }, JWT_SECRET, { expiresIn: '12h' });

    await logAssessorActivity({
      assessorId: assessor.id, assessorName: assessor.name, actorType: 'assessor', actorId: assessor.id, actorName: assessor.name,
      module: 'auth', actionType: 'login', description: 'Assessor logged in', req,
      sessionId: sessionResult.insertId,
    });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      sessionId: sessionResult.insertId,
      assessor: { id: assessor.id, name: assessor.name, email: assessor.email, role: 'assessor' },
    });
  } catch (err) {
    console.error('loginAssessor error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// @desc  Assessor logout.
// @route POST /api/assessor/logout/:sessionId
// @access Protected (assessorAuth)
const logoutAssessor = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ success: false, message: 'Session ID is required.' });

    // A manual self-initiated logout here is distinct from a Super Admin's
    // forced logout (adminAssessorController.js's forceLogoutAssessorSession,
    // which sets logout_type='forced' directly without going through this route).
    const [result] = await pool.query(
      `UPDATE assessor_login_sessions
       SET logout_time = NOW(), session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW()), logout_type = 'manual'
       WHERE id = ? AND status = 'success' AND logout_time IS NULL`,
      [sessionId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Active session not found or already ended.' });

    const [[assessorRow]] = await pool.query('SELECT name FROM assessors WHERE id = ?', [req.assessor.id]);
    const assessorName = assessorRow?.name || req.assessor.email;
    await logAssessorActivity({
      assessorId: req.assessor.id, assessorName, actorType: 'assessor', actorId: req.assessor.id, actorName: assessorName,
      module: 'auth', actionType: 'logout', description: 'Assessor logged out', req,
      sessionId: Number(sessionId) || null,
    });

    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('logoutAssessor error:', err);
    return res.status(500).json({ success: false, message: 'Server error during logout.' });
  }
};

module.exports = { loginAssessor, logoutAssessor };
