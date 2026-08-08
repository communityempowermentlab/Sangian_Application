const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const requestIp = require('request-ip');
const axios = require('axios');
const { logStaffActivity } = require('../utils/logStaffActivity');
const { parseUserAgent, normalizeIp } = require('../utils/parseUserAgent');

// Basic JWT Secret for now. Ideally this goes in .env
const JWT_SECRET = process.env.JWT_SECRET || 'sangian-super-secret-key-123';

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
        const ip = normalizeIp(requestIp.getClientIp(req)) || 'Unknown';
        const location = await getLocationFromIp(ip);

        // Fetch admin — existing path, unchanged
        const [rows] = await pool.query('SELECT * FROM admins WHERE email = ?', [email.trim()]);

        if (rows.length > 0 && await bcrypt.compare(password, rows[0].password_hash)) {
            const admin = rows[0];

            const loginTime = new Date();
            const [sessionResult] = await pool.query(`
      INSERT INTO admin_login_sessions
      (admin_id, status, login_time, ip_address, device_type, browser, os, location)
      VALUES (?, 'success', ?, ?, ?, ?, ?, ?)
    `, [admin.id, loginTime, ip, deviceType, browser, os, location]);

            const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });

            return res.status(200).json({
                message: 'Login successful',
                token,
                sessionId: sessionResult.insertId,
                admin: {
                    id: admin.id,
                    name: admin.name,
                    email: admin.email,
                    role: 'admin'
                }
            });
        }

        // Not an admin (or wrong password) — try Staff Management's `staff`
        // table before failing. Same login page auto-determines the role.
        const [staffRows] = await pool.query('SELECT * FROM staff WHERE email = ?', [email.trim()]);

        if (staffRows.length > 0 && await bcrypt.compare(password, staffRows[0].password_hash)) {
            const staff = staffRows[0];

            if (staff.status !== 'active') {
                return res.status(403).json({ message: 'Your staff account is inactive. Contact your administrator.' });
            }

            const loginTime = new Date();
            const [sessionResult] = await pool.query(`
      INSERT INTO staff_login_sessions
      (staff_id, status, login_time, ip_address, device_type, browser, os, location)
      VALUES (?, 'success', ?, ?, ?, ?, ?, ?)
    `, [staff.id, loginTime, ip, deviceType, browser, os, location]);

            const token = jwt.sign({ id: staff.id, email: staff.email, name: staff.name, role: 'staff' }, JWT_SECRET, { expiresIn: '12h' });

            await logStaffActivity({
                staffId: staff.id, staffName: staff.name, module: 'auth', actionType: 'login',
                description: 'Staff logged in', req,
                menuName: 'Login', pageName: 'Login Page', sessionId: sessionResult.insertId,
            });

            return res.status(200).json({
                message: 'Login successful',
                token,
                sessionId: sessionResult.insertId,
                admin: {
                    id: staff.id,
                    name: staff.name,
                    email: staff.email,
                    role: 'staff'
                },
                permissions: Array.isArray(staff.permissions) ? staff.permissions : [],
            });
        }

        // Neither admin nor staff matched — log the failed attempt against
        // whichever table the email actually belongs to (same behavior as
        // before for admin emails; extended analogously for staff emails).
        if (rows.length > 0) {
            await pool.query(`
        INSERT INTO admin_login_sessions
        (admin_id, status, login_time, ip_address, device_type, browser, os, location)
        VALUES (?, 'failed', NOW(), ?, ?, ?, ?, ?)
      `, [rows[0].id, ip, deviceType, browser, os, location]);
        } else if (staffRows.length > 0) {
            await pool.query(`
        INSERT INTO staff_login_sessions
        (staff_id, status, login_time, ip_address, device_type, browser, os, location)
        VALUES (?, 'failed', NOW(), ?, ?, ?, ?, ?)
      `, [staffRows[0].id, ip, deviceType, browser, os, location]);
        } else {
            await pool.query(`
        INSERT INTO admin_login_sessions
        (admin_id, status, login_time, ip_address, device_type, browser, os, location)
        VALUES (NULL, 'failed', NOW(), ?, ?, ?, ?, ?)
      `, [ip, deviceType, browser, os, location]);
        }

        return res.status(401).json({ message: 'Invalid email or password.' });

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

        // req.admin is set by adminAuth on this route — role tells us which
        // session table this sessionId belongs to. Admin path is unchanged.
        const isStaff = req.admin?.role === 'staff';
        const table = isStaff ? 'staff_login_sessions' : 'admin_login_sessions';

        const query = `
      UPDATE ${table}
      SET
        logout_time = NOW(),
        session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
      WHERE id = ? AND status = 'success' AND logout_time IS NULL
    `;
        const [result] = await pool.query(query, [sessionId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Active admin session not found or already ended.' });
        }

        if (isStaff) {
            await logStaffActivity({
                staffId: req.admin.id, staffName: req.admin.name, module: 'auth', actionType: 'logout',
                description: 'Staff logged out', req,
                menuName: 'Login', pageName: 'Login Page', sessionId: Number(sessionId) || null,
            });
        }

        res.status(200).json({ message: 'Admin session ended successfully' });
    } catch (error) {
        console.error('Admin Logout Error:', error);
        res.status(500).json({ message: 'Server error during admin logout.' });
    }
};

// @desc    Dashboard aggregate stats
// @route   GET /api/admin/dashboard/stats
// @access  Protected
const getDashboardStats = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const [[sessionCounts]] = await conn.execute(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'completed')  AS completed,
                SUM(status = 'quit')       AS quit,
                SUM(status = 'paused')     AS paused,
                SUM(status = 'in_progress') AS in_progress,
                SUM(status = 'dropped')    AS dropped
            FROM game_sessions
        `);

        const [[childCount]]    = await conn.execute('SELECT COUNT(*) AS total FROM children');
        const [[assessorCount]] = await conn.execute('SELECT COUNT(*) AS total FROM assessors');

        const [[activeToday]] = await conn.execute(`
            SELECT COUNT(*) AS count FROM game_sessions
            WHERE status = 'in_progress' AND DATE(updated_at) = CURDATE()
        `);

        const [[newThisWeek]] = await conn.execute(`
            SELECT COUNT(*) AS count FROM children
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        `);

        const [recentActivity] = await conn.execute(`
            SELECT gs.id, gs.game_name, gs.status, gs.score, gs.updated_at, gs.created_at,
                   c.child_id, c.name AS child_name
            FROM game_sessions gs
            JOIN children c ON gs.child_id = c.child_id
            ORDER BY gs.updated_at DESC
            LIMIT 20
        `);

        const [gameStats] = await conn.execute(`
            SELECT
                CASE game_name WHEN 'chor_machaye_shor' THEN 'cognitive_flex_chor' ELSE game_name END AS game_name,
                COUNT(*) AS total,
                SUM(status = 'completed') AS completed,
                SUM(status = 'quit')      AS quit,
                SUM(status = 'dropped')   AS dropped,
                ROUND(AVG(CASE WHEN status = 'completed' AND score IS NOT NULL THEN score END), 1) AS avg_score
            FROM game_sessions
            GROUP BY CASE game_name WHEN 'chor_machaye_shor' THEN 'cognitive_flex_chor' ELSE game_name END
            ORDER BY total DESC
        `);

        const [weekTrend] = await conn.execute(`
            SELECT DATE(created_at) AS date, COUNT(*) AS count
            FROM game_sessions
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        res.json({
            success: true,
            kpi: {
                totalSessions:      Number(sessionCounts.total)       || 0,
                completed:          Number(sessionCounts.completed)    || 0,
                quit:               Number(sessionCounts.quit)         || 0,
                paused:             Number(sessionCounts.paused)       || 0,
                inProgress:         Number(sessionCounts.in_progress)  || 0,
                dropped:            Number(sessionCounts.dropped)      || 0,
                totalChildren:      Number(childCount.total)           || 0,
                totalAssessors:     Number(assessorCount.total)        || 0,
                activeToday:        Number(activeToday.count)          || 0,
                newChildrenThisWeek: Number(newThisWeek.count)         || 0,
            },
            recentActivity,
            gameStats,
            weekTrend,
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ success: false, message: 'Failed to load dashboard stats' });
    } finally {
        conn.release();
    }
};

// GET /api/admin/live-sessions — returns currently active in_progress sessions
const getLiveSessions = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT gs.id, gs.child_id, gs.game_name, gs.score, gs.progress_level,
                   gs.start_time, gs.updated_at,
                   TIMESTAMPDIFF(MINUTE, gs.start_time, NOW()) AS elapsed_minutes,
                   c.name AS child_name
            FROM game_sessions gs
            JOIN children c ON gs.child_id = c.child_id
            WHERE gs.status = 'in_progress'
            ORDER BY gs.updated_at DESC
            LIMIT 20
        `);
        res.json({ success: true, sessions: rows, timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load live sessions' });
    }
};

// ── Admin Profile ─────────────────────────────────────────────────────────────

const getAdminProfile = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, email, logo_url FROM admins WHERE id = ?', [req.admin.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Admin not found.' });
        res.json({ success: true, profile: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateAdminProfile = async (req, res) => {
    const { name, email, currentPassword, newPassword } = req.body;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name?.trim() || !email?.trim())       return res.status(400).json({ success: false, message: 'Name and email are required.' });
    if (!EMAIL_RE.test(email.trim()))           return res.status(400).json({ success: false, message: 'Invalid email address.' });
    try {
        const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Admin not found.' });
        const admin = rows[0];

        if (email.trim().toLowerCase() !== admin.email.toLowerCase()) {
            const [dup] = await pool.query('SELECT id FROM admins WHERE email = ? AND id != ?', [email.trim(), req.admin.id]);
            if (dup.length) return res.status(400).json({ success: false, message: 'Email already in use.' });
        }

        let passwordHash = admin.password_hash;
        if (newPassword?.trim()) {
            if (!currentPassword) return res.status(400).json({ success: false, message: 'Current password is required.' });
            if (!(await bcrypt.compare(currentPassword, admin.password_hash)))
                return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
            if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
            passwordHash = await bcrypt.hash(newPassword, 10);
        }

        await pool.query('UPDATE admins SET name=?, email=?, password_hash=? WHERE id=?',
            [name.trim(), email.trim(), passwordHash, req.admin.id]);

        res.json({ success: true, message: 'Profile updated.', profile: { name: name.trim(), email: email.trim() } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateAdminLogo = async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const logoUrl = `/uploads/admin/${req.file.filename}`;
    try {
        await pool.query('UPDATE admins SET logo_url=? WHERE id=?', [logoUrl, req.admin.id]);
        res.json({ success: true, message: 'Logo updated.', logoUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    loginAdmin,
    logoutAdmin,
    getDashboardStats,
    getLiveSessions,
    getAdminProfile,
    updateAdminProfile,
    updateAdminLogo,
};
