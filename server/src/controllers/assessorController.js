const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

const PASSWORD_MIN_LEN = 8;
// Same admin-managed-account policy as adminAssessorController.js's
// isPasswordStrong (kept as its own copy, matching this codebase's existing
// convention of small per-controller helpers rather than a shared import).
function isPasswordStrong(pw) {
    return typeof pw === 'string' && pw.length >= PASSWORD_MIN_LEN && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

// @desc  An assessor's own profile — name + read-only email/mobile, plus
//        their organization (if org-bound). Nothing admin-scoped is
//        reachable through this route.
// @route GET /api/assessor/me
// @access Protected (assessorAuth)
exports.getMyProfile = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT a.id, a.name, a.email, a.mobile_number, a.status, a.org_id, o.org_name, a.created_at
             FROM assessors a LEFT JOIN organizations o ON a.org_id = o.id
             WHERE a.id = ?`,
            [req.assessor.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Assessor account not found.' });
        return res.json({ success: true, assessor: rows[0] });
    } catch (err) {
        console.error('getMyProfile (assessor) error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// @desc  Self-service password change — requires the current password,
//        unlike the Super Admin-initiated reset in adminAssessorController.js.
// @route PUT /api/assessor/change-password
// @access Protected (assessorAuth)
exports.changeMyPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
        }
        if (!isPasswordStrong(newPassword)) {
            return res.status(400).json({ success: false, message: `New password must be at least ${PASSWORD_MIN_LEN} characters and include a letter and a number.` });
        }

        const [rows] = await pool.query('SELECT password_hash FROM assessors WHERE id = ?', [req.assessor.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Assessor account not found.' });

        const currentOk = rows[0].password_hash && await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!currentOk) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE assessors SET password_hash = ? WHERE id = ?', [passwordHash, req.assessor.id]);

        return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error('changeMyPassword (assessor) error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// @desc  Personalized dashboard KPIs for the logged-in assessor. Everything
//        here is scoped to assessor_id = req.assessor.id — the assessor
//        never sees another assessor's, or another organization's, data.
//
//        "Children Assigned" is derived from login_sessions (the children
//        this assessor has actually looked up/logged in), since there is
//        no separate admin-managed "assign children to an assessor"
//        feature — this reflects real activity, not a roster.
// @route GET /api/assessor/dashboard
// @access Protected (assessorAuth)
exports.getDashboard = async (req, res) => {
    try {
        const assessorId = req.assessor.id;

        const [[childrenRow]] = await pool.query(
            `SELECT COUNT(DISTINCT child_id) AS childrenAssigned
             FROM login_sessions WHERE assessor_id = ? AND status = 'success'`,
            [assessorId]
        );

        const [[statsRow]] = await pool.query(
            `SELECT
                SUM(status = 'completed') AS totalCompleted,
                SUM(status IN ('in_progress', 'paused')) AS pending,
                SUM(status = 'completed' AND DATE(end_time) = CURDATE()) AS completedToday,
                ROUND(AVG(CASE WHEN status = 'completed' THEN score END), 1) AS avgScore,
                ROUND(AVG(CASE WHEN status = 'completed' AND end_time IS NOT NULL
                                THEN TIMESTAMPDIFF(SECOND, start_time, end_time) END) / 60, 1) AS avgTimeMinutes
             FROM game_sessions WHERE assessor_id = ?`,
            [assessorId]
        );

        const [recentActivity] = await pool.query(
            `SELECT gs.id, gs.child_id, c.name AS child_name, gs.game_name, gs.status, gs.score, gs.start_time, gs.end_time
             FROM game_sessions gs LEFT JOIN children c ON c.child_id = gs.child_id
             WHERE gs.assessor_id = ?
             ORDER BY gs.start_time DESC LIMIT 10`,
            [assessorId]
        );

        return res.json({
            success: true,
            kpis: {
                childrenAssigned: Number(childrenRow.childrenAssigned) || 0,
                totalCompleted: Number(statsRow.totalCompleted) || 0,
                pending: Number(statsRow.pending) || 0,
                completedToday: Number(statsRow.completedToday) || 0,
                avgScore: statsRow.avgScore != null ? Number(statsRow.avgScore) : null,
                avgTimeMinutes: statsRow.avgTimeMinutes != null ? Number(statsRow.avgTimeMinutes) : null,
            },
            recentActivity,
        });
    } catch (err) {
        console.error('getDashboard (assessor) error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
