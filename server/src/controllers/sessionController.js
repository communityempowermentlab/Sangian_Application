const { pool } = require('../config/db');
const UAParser = require('ua-parser-js');
const requestIp = require('request-ip');
const axios = require('axios');
const { checkChildEligibility } = require('../utils/validateAssessorChild');

// Helper to get basic browser/os/device data
const parseUserAgent = (userAgent) => {
    const parser = new UAParser(userAgent);
    return {
        browser: parser.getBrowser().name || 'Unknown',
        os: parser.getOS().name || 'Unknown',
        deviceType: parser.getDevice().type || 'Desktop'
    };
};

// Helper to get approximate location based on IP
const getLocationFromIp = async (ip) => {
    try {
        // Handling localhost explicitly
        if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
            return 'Localhost';
        }
        const response = await axios.get(`http://ip-api.com/json/${ip}`);
        if (response.data && response.data.status === 'success') {
            return `${response.data.city}, ${response.data.regionName}, ${response.data.country}`;
        }
    } catch (error) {
        console.error('IP location lookup failed', error.message);
    }
    return 'Unknown';
};

// @desc    Start login session
// @route   POST /api/sessions/start
// @access  Public
const startSession = async (req, res) => {
    try {
        const { childId } = req.body;
        if (!childId) return res.status(400).json({ message: 'Child ID is required.' });

        // Re-Validation Before Starting the Game — the child may have been
        // deactivated by an admin in the gap between the assessor's search
        // (childController.js's lookupChild) and clicking "Go to
        // Assessment" here. req.assessor is set by assessorAuth (this
        // route is gated behind it — see sessionRoutes.js).
        const eligibility = await checkChildEligibility(childId.toUpperCase(), req.assessor.id);
        if (!eligibility.ok) {
            return res.status(eligibility.code).json({ message: eligibility.message, eligible: false });
        }

        // Identify user agent and IP
        const userAgent = req.headers['user-agent'];
        const { browser, os, deviceType } = parseUserAgent(userAgent);
        const ip = requestIp.getClientIp(req) || 'Unknown';
        const location = await getLocationFromIp(ip);
        const loginTime = new Date();

        // req.assessor is set by assessorAuth (this route is gated behind
        // it — see sessionRoutes.js) — stamped here so gameController.js's
        // startGameSession can later derive which assessor supervised this
        // child's session, without touching any of the ~15 game pages.
        const query = `
      INSERT INTO login_sessions
      (child_id, status, login_time, ip_address, device_type, browser, os, location, assessor_id)
      VALUES (?, 'success', ?, ?, ?, ?, ?, ?, ?)
    `;
        const [result] = await pool.query(query, [
            childId.toUpperCase(), loginTime, ip, deviceType, browser, os, location, req.assessor?.id || null
        ]);

        res.status(201).json({
            message: 'Session started successfully',
            sessionId: result.insertId
        });
    } catch (error) {
        console.error('Session Start Error:', error);
        res.status(500).json({ message: 'Server error while starting session.' });
    }
};

// @desc    Log failed search attempt
// @route   POST /api/sessions/fail
// @access  Public
const failedSession = async (req, res) => {
    try {
        const { attemptedChildId } = req.body;

        const userAgent = req.headers['user-agent'];
        const { browser, os, deviceType } = parseUserAgent(userAgent);
        const ip = requestIp.getClientIp(req) || 'Unknown';
        const location = await getLocationFromIp(ip);

        const query = `
      INSERT INTO login_sessions
      (child_id, status, login_time, ip_address, device_type, browser, os, location, assessor_id)
      VALUES (?, 'failed', NOW(), ?, ?, ?, ?, ?, ?)
    `;
        await pool.query(query, [
            attemptedChildId || 'UNKNOWN', ip, deviceType, browser, os, location, req.assessor?.id || null
        ]);

        res.status(200).json({ message: 'Failed attempt logged' });
    } catch (error) {
        console.error('Session Fail Error:', error);
        res.status(500).json({ message: 'Server error while logging failed session.' });
    }
};

// @desc    End login session
// @route   POST /api/sessions/end/:sessionId
// @access  Public
const endSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) return res.status(400).json({ message: 'Session ID is required.' });

        // We calculate duration using TIMESTAMPDIFF
        const query = `
      UPDATE login_sessions 
      SET 
        logout_time = NOW(),
        session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
      WHERE id = ? AND status = 'success' AND logout_time IS NULL
    `;
        const [result] = await pool.query(query, [sessionId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Active session not found or already ended.' });
        }

        res.status(200).json({ message: 'Session ended successfully' });
    } catch (error) {
        console.error('Session End Error:', error);
        res.status(500).json({ message: 'Server error while ending session.' });
    }
};

module.exports = {
    startSession,
    failedSession,
    endSession
};
