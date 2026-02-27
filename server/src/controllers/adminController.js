const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UAParser = require('ua-parser-js');
const requestIp = require('request-ip');
const axios = require('axios');

// Basic JWT Secret for now. Ideally this goes in .env
const JWT_SECRET = process.env.JWT_SECRET || 'sangian-super-secret-key-123';

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

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password.' });
        }

        // Get client info
        const userAgent = req.headers['user-agent'];
        const { browser, os, deviceType } = parseUserAgent(userAgent);
        const ip = requestIp.getClientIp(req) || 'Unknown';
        const location = await getLocationFromIp(ip);

        // Fetch admin
        const [rows] = await pool.query('SELECT * FROM admins WHERE email = ?', [email.trim()]);

        // Auth Failed
        if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password_hash))) {
            // Log failed attempt if it corresponds to an actual admin email or just raw generic
            const adminId = rows.length > 0 ? rows[0].id : null;
            await pool.query(`
        INSERT INTO admin_login_sessions 
        (admin_id, status, login_time, ip_address, device_type, browser, os, location)
        VALUES (?, 'failed', NOW(), ?, ?, ?, ?, ?)
      `, [adminId, ip, deviceType, browser, os, location]);

            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const admin = rows[0];

        // Auth Success - Log Session
        const loginTime = new Date();
        const [sessionResult] = await pool.query(`
      INSERT INTO admin_login_sessions 
      (admin_id, status, login_time, ip_address, device_type, browser, os, location)
      VALUES (?, 'success', ?, ?, ?, ?, ?, ?)
    `, [admin.id, loginTime, ip, deviceType, browser, os, location]);

        // Generate JWT
        const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });

        res.status(200).json({
            message: 'Login successful',
            token,
            sessionId: sessionResult.insertId,
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email
            }
        });

    } catch (error) {
        console.error('Admin Login Error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
};

// @desc    Admin logout
// @route   POST /api/admin/logout/:sessionId
// @access  Public
const logoutAdmin = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) return res.status(400).json({ message: 'Session ID is required.' });

        const query = `
      UPDATE admin_login_sessions 
      SET 
        logout_time = NOW(),
        session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
      WHERE id = ? AND status = 'success' AND logout_time IS NULL
    `;
        const [result] = await pool.query(query, [sessionId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Active admin session not found or already ended.' });
        }

        res.status(200).json({ message: 'Admin session ended successfully' });
    } catch (error) {
        console.error('Admin Logout Error:', error);
        res.status(500).json({ message: 'Server error during admin logout.' });
    }
};

module.exports = {
    loginAdmin,
    logoutAdmin
};
