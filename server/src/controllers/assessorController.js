const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { parseSavedState, computeActualGameTime } = require('./gameController');
const { finalizePhoto } = require('./adminChildController');
const { logAssessorActivity } = require('../utils/logAssessorActivity');

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

        const [recentActivityRows] = await pool.query(
            `SELECT gs.id, gs.child_id, c.name AS child_name, gs.game_name, gs.status, gs.score, gs.start_time, gs.end_time, gs.saved_state
             FROM game_sessions gs LEFT JOIN children c ON c.child_id = gs.child_id
             WHERE gs.assessor_id = ?
             ORDER BY gs.start_time DESC LIMIT 10`,
            [assessorId]
        );

        // Duration — same computeActualGameTime() used for the "Duration"
        // column in getGameHistory (Individual Detail Reports tab / My
        // Account), report detail/CSV, and the Average Game Time KPI above,
        // so this figure matches those exactly rather than drifting.
        // saved_state itself is dropped from the response — it's internal
        // session data, not meant for a non-admin client.
        const recentActivity = recentActivityRows.map(({ saved_state, ...row }) => {
            const actualTime = computeActualGameTime(parseSavedState(saved_state), row.game_name);
            return { ...row, actual_game_time: actualTime > 0 ? Math.round(actualTime) : null };
        });

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

// Re-verifies the calling assessor is active and org-bound fresh from the
// DB on every call — assessorAuth only checks the JWT signature, not
// current account/org status (unlike requireAdminOrOrgAuth's staff/org
// branches, which do). Returns { assessor } or writes an error response
// and returns null.
const verifyActiveAssessorWithOrg = async (req, res) => {
    const [rows] = await pool.query('SELECT id, name, org_id, status FROM assessors WHERE id = ?', [req.assessor.id]);
    if (!rows.length || rows[0].status !== 'active') {
        res.status(403).json({ success: false, message: 'Forbidden: account inactive.' });
        return null;
    }
    const assessor = rows[0];
    if (!assessor.org_id) {
        res.status(400).json({ success: false, message: 'You are not currently assigned to an organization. Please contact your administrator.' });
        return null;
    }
    const [orgRows] = await pool.query('SELECT status, registration_status FROM organizations WHERE id = ?', [assessor.org_id]);
    if (!orgRows.length || orgRows[0].status !== 'active' || orgRows[0].registration_status !== 'approved') {
        res.status(403).json({ success: false, message: 'Your organization account is currently inactive. Please contact the administrator.' });
        return null;
    }
    return assessor;
};

// @desc  Active Child Groups belonging to the assessor's own organization —
//        same list Admin's Add Child form offers, scoped the same way
//        adminChildGroupController.getAllGroups scopes an org session.
// @route GET /api/assessor/child-groups
// @access Protected (assessorAuth)
exports.getChildGroups = async (req, res) => {
    try {
        const assessor = await verifyActiveAssessorWithOrg(req, res);
        if (!assessor) return;
        const [rows] = await pool.query(
            `SELECT id, name FROM child_groups WHERE org_id <=> ? AND status = 'active' ORDER BY name`,
            [assessor.org_id]
        );
        return res.json(rows);
    } catch (err) {
        console.error('getChildGroups (assessor) error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// @desc  Assessor self-service "Add New Child" — mirrors
//        adminChildController.addChild's fields/validation/DB insert
//        exactly, but org_id and created_by_assessor_id are always derived
//        from the authenticated assessor (never trusted from the request
//        body): org_id = this assessor's own organization, creator =
//        req.assessor.id. An assessor can never pick another organization
//        or claim another assessor created the child.
// @route POST /api/assessor/children
// @access Protected (assessorAuth)
exports.addChild = async (req, res) => {
    try {
        const assessor = await verifyActiveAssessorWithOrg(req, res);
        if (!assessor) {
            if (req.file) fs.unlinkSync(req.file.path);
            return;
        }

        const { child_id, name, dob, gender, mobile, father_name, mother_name, remarks, gram_sabha, hamlet } = req.body;

        if (!child_id || !name || !dob || !gender || !mobile || !father_name || !mother_name) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Child ID, name, DOB, gender, mobile, father name, and mother name are required.' });
        }

        if (father_name.trim().length > 225 || mother_name.trim().length > 225) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Father name and Mother name cannot exceed 225 characters.' });
        }

        const [existing] = await pool.query('SELECT id FROM children WHERE child_id = ?', [child_id.trim()]);
        if (existing.length > 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Child ID already exists. Please choose a unique ID.' });
        }

        const orgId = assessor.org_id;

        const [result] = await pool.query(
            'INSERT INTO children (child_id, name, dob, gender, mobile, father_name, mother_name, remarks, gram_sabha, hamlet, status, org_id, created_by_assessor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [child_id.trim(), name.trim(), dob, gender.trim(), mobile.trim(), (father_name || '').trim(), (mother_name || '').trim(), (remarks || '').trim(), (gram_sabha || '').trim(), (hamlet || '').trim(), 'active', orgId, assessor.id]
        );

        const childIdStr = child_id.trim();

        let photoFilename = null;
        if (req.file) {
            photoFilename = finalizePhoto(req.file, childIdStr);
            await pool.query('UPDATE children SET photo = ? WHERE child_id = ?', [photoFilename, childIdStr]);
        }

        if (req.body.group_ids) {
            try {
                const groupIds = JSON.parse(req.body.group_ids);
                if (Array.isArray(groupIds) && groupIds.length > 0) {
                    const values = groupIds.map(gid => [result.insertId, gid]);
                    await pool.query('INSERT INTO child_group_members (children_id, group_id) VALUES ?', [values]);
                }
            } catch (e) {
                console.error('Failed to assign groups on child creation (assessor):', e);
            }
        }

        await logAssessorActivity({
            assessorId: assessor.id, assessorName: assessor.name, actorType: 'assessor', actorId: assessor.id, actorName: assessor.name,
            module: 'children', actionType: 'add', description: `Registered child "${name.trim()}" (${childIdStr})`,
            recordType: 'child', recordId: childIdStr, recordName: name.trim(), req,
        });

        res.status(201).json({
            message: 'Child registered successfully.',
            child_id: childIdStr,
            photo: photoFilename,
        });
    } catch (error) {
        // req.file.path only still exists if the error happened before
        // finalizePhoto renamed it (the file's already moved otherwise) —
        // guard with existsSync so this can't itself throw on an already-
        // finalized upload.
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('Registration Error by Assessor:', error);
        res.status(500).json({ message: 'Server error during child registration.' });
    }
};
