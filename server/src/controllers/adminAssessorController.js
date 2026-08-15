const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { normalizeIndianMobile } = require('../utils/mobileNumber');
const { logAssessorActivity } = require('../utils/logAssessorActivity');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LEN = 8;
// Same admin-managed-account policy as staffController.js's isPasswordStrong
// — assessors are admin-created/managed accounts (like Staff), not
// self-registered public accounts, so they use this lighter policy rather
// than the stronger public-facing isStrongPassword used for Organizations/
// Individuals.
function isPasswordStrong(pw) {
    return typeof pw === 'string' && pw.length >= PASSWORD_MIN_LEN && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

// Org isolation helper — same convention as adminChildController.js's
// scopeClause. A Super Admin sees everything (including pre-existing
// org_id-NULL assessors, unchanged from before this feature); an org-bound
// staff account or an Organization login sees only rows stamped with their
// own org_id, never NULL/other-org rows.
const scopeClause = (orgScope, alias = 'a') => {
    if (orgScope.isSuperAdmin) return { sql: '', params: [] };
    const col = alias ? `${alias}.org_id` : 'org_id';
    // Null-safe equality (<=>) — plain `=` never matches when orgId is NULL.
    return { sql: `${col} <=> ?`, params: [orgScope.orgId] };
};

// Who's performing an admin-side action on an assessor's record — used for
// activity/edit-log attribution. Mirrors the actor resolution already done
// inline at each logOrgActivity call site in adminOrgController.js.
const resolveActor = (req) => ({
    actorType: req.admin?.role === 'organization' ? 'organization' : req.admin?.role === 'staff' ? 'staff' : 'admin',
    actorId: req.admin?.id ?? null,
    actorName: req.admin?.name || req.admin?.email || 'Unknown',
});

const PROFILE_FIELD_LABELS = {
    name: 'Name',
    email: 'Email',
    mobile_number: 'Mobile Number',
    status: 'Status',
    remarks: 'Remarks',
};

// Same normalization as adminOrgController.js's getIp — used only for the
// per-field edit log's ip_address column (logAssessorActivity derives its
// own IP independently via request-ip).
const getIp = (req) => {
    let ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '';
    if (ip === '::1') ip = '127.0.0.1';
    if (ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
    return ip;
};

// @desc Get all assessors within scope
// @route GET /api/admin/assessors
exports.getAllAssessors = async (req, res) => {
    try {
        const scope = scopeClause(req.orgScope);
        const [rows] = await pool.query(
            `SELECT a.id, a.org_id, a.name, a.email, a.mobile_number, a.status, a.remarks,
                    a.created_at, a.updated_at, o.org_name,
                    (SELECT MAX(login_time) FROM assessor_login_sessions
                      WHERE assessor_id = a.id AND status = 'success') AS last_login
             FROM assessors a LEFT JOIN organizations o ON a.org_id = o.id
             ${scope.sql ? `WHERE ${scope.sql}` : ''}
             ORDER BY a.created_at DESC`,
            scope.params
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching assessors:', error);
        res.status(500).json({ message: 'Server error fetching assessors' });
    }
};

// @desc Get single assessor by ID
// @route GET /api/admin/assessors/:id
exports.getAssessorById = async (req, res) => {
    try {
        const { id } = req.params;
        const scope = scopeClause(req.orgScope);
        const [rows] = await pool.query(
            `SELECT a.id, a.org_id, a.name, a.email, a.mobile_number, a.status, a.remarks,
                    a.created_at, a.updated_at, o.org_name
             FROM assessors a LEFT JOIN organizations o ON a.org_id = o.id
             WHERE a.id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [id, ...scope.params]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Assessor not found' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching assessor:', error);
        res.status(500).json({ message: 'Server error fetching assessor' });
    }
};

// @desc Add a new assessor
// @route POST /api/admin/assessors
exports.addAssessor = async (req, res) => {
    try {
        const { orgScope } = req;
        const { name, email, mobile_number, password, remarks } = req.body;

        // Normalize input
        const normalizedEmail = email ? email.toLowerCase().trim() : '';
        const trimmedName = name ? name.trim() : '';
        const normalizedMobile = normalizeIndianMobile(mobile_number);
        const trimmedRemarks = remarks ? remarks.trim() : null;

        if (!trimmedName || !normalizedEmail || !mobile_number || !password) {
            return res.status(400).json({ message: 'Name, email, mobile number, and password are mandatory' });
        }
        if (!EMAIL_RE.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }
        if (!normalizedMobile) {
            return res.status(400).json({ message: 'Please enter a valid 10-digit Indian mobile number.' });
        }
        if (!isPasswordStrong(password)) {
            return res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN_LEN} characters and include a letter and a number.` });
        }

        // Super Admin's created-assessor stays org_id-NULL (same as before
        // this feature existed); an org-bound staff account or Organization
        // login always stamps its own org_id — never trusted from the client.
        const orgId = orgScope.isSuperAdmin ? null : orgScope.orgId;

        // Email/mobile uniqueness is scoped PER ORGANIZATION, not global —
        // the same email+password can be reused by an assessor registering
        // under a different organization, but not twice within the same
        // organization. Null-safe (<=>) so Super-Admin-managed assessors
        // (org_id NULL) are their own uniqueness bucket too. Login then
        // disambiguates same-email rows by which one's password matches
        // (see assessorAuthController.js).
        const [existingEmail] = await pool.query('SELECT id FROM assessors WHERE email = ? AND org_id <=> ?', [normalizedEmail, orgId]);
        if (existingEmail && existingEmail.length > 0) {
            return res.status(400).json({
                message: 'Email ID already exists for an assessor in this organization.'
            });
        }
        const [existingMobile] = await pool.query('SELECT id FROM assessors WHERE mobile_number = ? AND org_id <=> ?', [normalizedMobile, orgId]);
        if (existingMobile && existingMobile.length > 0) {
            return res.status(400).json({
                message: 'Mobile number already exists for an assessor in this organization.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO assessors (name, email, mobile_number, status, org_id, password_hash, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [trimmedName, normalizedEmail, normalizedMobile, 'active', orgId, passwordHash, trimmedRemarks]
        );

        const actor = resolveActor(req);
        await logAssessorActivity({
            assessorId: result.insertId, assessorName: trimmedName, ...actor,
            module: 'assessors', actionType: 'create', description: `Assessor "${trimmedName}" created`, req,
        });

        res.status(201).json({
            message: 'Assessor added successfully',
            assessorId: result.insertId
        });
    } catch (error) {
        console.error('Error in addAssessor:', error);

        // Handle database-level unique constraint failure just in case the check above missed it
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email ID already exists. (DB Constraint)' });
        }

        res.status(500).json({
            message: `Server error adding assessor: ${error.message || 'Unknown error'}`
        });
    }
};

// @desc Update an assessor
// @route PUT /api/admin/assessors/:id
exports.updateAssessor = async (req, res) => {
    try {
        const { orgScope } = req;
        const { id } = req.params;
        const { name, email, mobile_number, status, remarks } = req.body;

        // Normalize input
        const normalizedEmail = email ? email.toLowerCase().trim() : '';
        const trimmedName = name ? name.trim() : '';
        const normalizedMobile = normalizeIndianMobile(mobile_number);
        const trimmedRemarks = remarks ? remarks.trim() : null;

        if (!trimmedName || !normalizedEmail || !mobile_number || !status) {
            return res.status(400).json({ message: 'All fields are mandatory' });
        }
        if (!EMAIL_RE.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }
        if (!normalizedMobile) {
            return res.status(400).json({ message: 'Please enter a valid 10-digit Indian mobile number.' });
        }

        const scope = scopeClause(orgScope, '');
        const [existingRow] = await pool.query(
            `SELECT id, org_id, name, email, mobile_number, status, remarks FROM assessors WHERE id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [id, ...scope.params]
        );
        if (!existingRow.length) return res.status(404).json({ message: 'Assessor not found' });
        const before = existingRow[0];
        const rowOrgId = before.org_id;

        // Check if email/mobile belongs to someone else IN THE SAME
        // ORGANIZATION — uniqueness is per-organization, not global (see
        // addAssessor). The assessor's own org_id (not the caller's
        // orgScope) is what matters here, since org_id isn't editable
        // through this form.
        const [existingEmail] = await pool.query('SELECT id FROM assessors WHERE email = ? AND org_id <=> ? AND id != ?', [normalizedEmail, rowOrgId, id]);
        if (existingEmail && existingEmail.length > 0) {
            return res.status(400).json({ message: 'Email ID already exists for an assessor in this organization.' });
        }
        const [existingMobile] = await pool.query('SELECT id FROM assessors WHERE mobile_number = ? AND org_id <=> ? AND id != ?', [normalizedMobile, rowOrgId, id]);
        if (existingMobile && existingMobile.length > 0) {
            return res.status(400).json({ message: 'Mobile number already exists for an assessor in this organization.' });
        }

        const [result] = await pool.query(
            'UPDATE assessors SET name = ?, email = ?, mobile_number = ?, status = ?, remarks = ? WHERE id = ?',
            [trimmedName, normalizedEmail, normalizedMobile, status, trimmedRemarks, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Assessor not found' });
        }

        // Clean per-field diff trail for the Edit History tab — only rows
        // that actually changed, mirroring updateOrganizationContact's
        // emailChanged/mobileChanged pattern in adminOrgController.js.
        const actor = resolveActor(req);
        const after = { name: trimmedName, email: normalizedEmail, mobile_number: normalizedMobile, status, remarks: trimmedRemarks };
        const ip = getIp(req);
        for (const field of Object.keys(PROFILE_FIELD_LABELS)) {
            const oldVal = before[field] ?? null;
            const newVal = after[field] ?? null;
            if (String(oldVal ?? '') !== String(newVal ?? '')) {
                await pool.query(
                    'INSERT INTO assessor_profile_edit_logs (assessor_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [id, PROFILE_FIELD_LABELS[field], oldVal, newVal, actor.actorId, actor.actorName, ip]
                );
            }
        }

        await logAssessorActivity({
            assessorId: id, assessorName: trimmedName, ...actor,
            module: 'assessors', actionType: 'update', description: `Assessor "${trimmedName}" details updated`, req,
        });

        res.status(200).json({ message: 'Assessor updated successfully' });
    } catch (error) {
        console.error('Error in updateAssessor:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email ID already exists. (DB Constraint)' });
        }

        res.status(500).json({ message: 'Server error updating assessor' });
    }
};

// Admin-initiated reset — sets a new password directly (no current-password
// check), mirroring staffController.js's resetStaffPassword.
// @route PUT /api/admin/assessors/:id/reset-password
exports.resetAssessorPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!isPasswordStrong(newPassword)) {
            return res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN_LEN} characters and include a letter and a number.` });
        }

        const scope = scopeClause(req.orgScope, '');
        const [rows] = await pool.query(
            `SELECT name, email FROM assessors WHERE id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [req.params.id, ...scope.params]
        );
        if (!rows.length) return res.status(404).json({ message: 'Assessor not found' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE assessors SET password_hash = ? WHERE id = ?', [passwordHash, req.params.id]);

        const actor = resolveActor(req);
        await logAssessorActivity({
            assessorId: req.params.id, assessorName: rows[0].name, ...actor,
            module: 'assessors', actionType: 'password_reset', description: 'Password reset by Super Admin', req,
        });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('resetAssessorPassword error:', error);
        res.status(500).json({ message: 'Server error resetting password' });
    }
};

// "Session Expired" isn't stored — a session that never got an explicit
// logout call is only distinguishable from "still active" by whether the
// JWT it was issued with has expired, computed at read time against the
// same 12h lifetime assessorAuthController.js signs with. Mirrors
// adminOrgController.js's LOGOUT_STATUS_CASE, adapted to
// assessor_login_sessions.
const LOGOUT_STATUS_CASE = `
    CASE
        WHEN ls.status = 'failed' THEN NULL
        WHEN ls.logout_type = 'forced' THEN 'force_logout'
        WHEN ls.logout_time IS NOT NULL THEN 'normal'
        WHEN ls.login_time < DATE_SUB(NOW(), INTERVAL 12 HOUR) THEN 'session_expired'
        ELSE 'active'
    END
`;

// @desc  Per-session login/logout audit trail for one assessor — direct
//        port of adminOrgController.js's getOrgLoginHistory.
// @route GET /api/admin/assessors/:id/login-history
exports.getAssessorLoginHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const scope = scopeClause(req.orgScope);
        const [assessorRows] = await pool.query(
            `SELECT a.id, a.name, a.email FROM assessors a WHERE a.id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [id, ...scope.params]
        );
        if (!assessorRows.length) return res.status(404).json({ success: false, message: 'Assessor not found' });

        const {
            search = '', startDate = '', endDate = '',
            sortKey = 'login_time', sortDir = 'desc', page = 1, limit = 20,
        } = req.query;

        const clauses = ['ls.assessor_id = ?'];
        const params = [id];
        if (search.trim()) {
            clauses.push('(ls.ip_address LIKE ? OR ls.browser LIKE ? OR ls.os LIKE ? OR ls.device_type LIKE ?)');
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }
        if (startDate) { clauses.push('DATE(ls.login_time) >= ?'); params.push(startDate); }
        if (endDate) { clauses.push('DATE(ls.login_time) <= ?'); params.push(endDate); }
        const where = `WHERE ${clauses.join(' AND ')}`;

        const SORTABLE = new Set(['login_time', 'logout_time', 'session_duration', 'ip_address', 'browser', 'os', 'device_type']);
        const col = SORTABLE.has(sortKey) ? sortKey : 'login_time';
        const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(5000, Math.max(1, parseInt(limit, 10) || 20));
        const offset = (pageNum - 1) * pageSize;

        const [rows] = await pool.query(`
            SELECT ls.id, ls.status AS login_status, ls.login_time, ls.logout_time, ls.session_duration,
                   ls.ip_address, ls.browser, ls.os, ls.device_type, ls.failure_reason,
                   ${LOGOUT_STATUS_CASE} AS logout_status
            FROM assessor_login_sessions ls
            ${where}
            ORDER BY ls.${col} ${dir}
            LIMIT ? OFFSET ?
        `, [...params, pageSize, offset]);

        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM assessor_login_sessions ls ${where}`, params);

        const [[summary]] = await pool.query(`
            SELECT
                SUM(ls.status = 'success') AS total_logins,
                SUM(ls.status = 'failed')  AS total_failed,
                MAX(CASE WHEN ls.status = 'success' THEN ls.login_time END) AS last_login,
                MAX(ls.logout_time) AS last_logout,
                SUM(COALESCE(ls.session_duration, 0)) AS total_working_seconds,
                AVG(ls.session_duration) AS avg_session_seconds
            FROM assessor_login_sessions ls
            ${where}
        `, params);

        return res.json({
            success: true,
            assessor: assessorRows[0],
            sessions: rows,
            total, page: pageNum, limit: pageSize,
            summary: {
                totalLogins: Number(summary.total_logins) || 0,
                totalFailed: Number(summary.total_failed) || 0,
                lastLogin: summary.last_login,
                lastLogout: summary.last_logout,
                totalWorkingSeconds: Number(summary.total_working_seconds) || 0,
                avgSessionSeconds: summary.avg_session_seconds != null ? Number(summary.avg_session_seconds) : null,
            },
        });
    } catch (error) {
        console.error('getAssessorLoginHistory error:', error);
        res.status(500).json({ success: false, message: 'Failed to load login history.' });
    }
};

// @desc  Full activity audit trail for one assessor — direct port of
//        adminOrgController.js's getOrgActivityLog.
// @route GET /api/admin/assessors/:id/activity-log
exports.getAssessorActivityLog = async (req, res) => {
    try {
        const { id } = req.params;
        const scope = scopeClause(req.orgScope);
        const [assessorRows] = await pool.query(
            `SELECT a.id FROM assessors a WHERE a.id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [id, ...scope.params]
        );
        if (!assessorRows.length) return res.status(404).json({ success: false, message: 'Assessor not found' });

        const {
            module = '', actionType = '', sessionId = '', search = '',
            startDate = '', endDate = '', sortKey = 'created_at', sortDir = 'desc',
            page = 1, limit = 50,
        } = req.query;

        const clauses = ['assessor_id = ?'];
        const params = [id];
        if (module) { clauses.push('module = ?'); params.push(module); }
        if (actionType) { clauses.push('action_type = ?'); params.push(actionType); }
        if (sessionId) { clauses.push('session_id = ?'); params.push(sessionId); }
        if (startDate) { clauses.push('DATE(created_at) >= ?'); params.push(startDate); }
        if (endDate) { clauses.push('DATE(created_at) <= ?'); params.push(endDate); }
        if (search.trim()) {
            clauses.push('(actor_name LIKE ? OR description LIKE ? OR record_name LIKE ?)');
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;

        const SORTABLE = new Set(['created_at', 'module', 'action_type', 'actor_name']);
        const col = SORTABLE.has(sortKey) ? sortKey : 'created_at';
        const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(5000, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * pageSize;

        const [rows] = await pool.query(
            `SELECT id, actor_type, actor_id, actor_name, module, action_type, description,
                    record_type, record_id, record_name, previous_value, new_value, metadata,
                    ip_address, browser, os, device_type, session_id, status, error_message, created_at
             FROM assessor_activity_logs ${where}
             ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM assessor_activity_logs ${where}`, params);

        return res.json({ success: true, logs: rows, total, page: pageNum, limit: pageSize });
    } catch (error) {
        console.error('getAssessorActivityLog error:', error);
        res.status(500).json({ success: false, message: 'Failed to load activity log.' });
    }
};

// @desc  Full field-level edit history for one assessor's profile —
//        direct port of adminOrgController.js's getOrgEditLogs.
// @route GET /api/admin/assessors/:id/edit-logs
exports.getAssessorEditLogs = async (req, res) => {
    try {
        const scope = scopeClause(req.orgScope);
        const [assessorRows] = await pool.query(
            `SELECT a.id FROM assessors a WHERE a.id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [req.params.id, ...scope.params]
        );
        if (!assessorRows.length) return res.status(404).json({ success: false, message: 'Assessor not found' });

        const [rows] = await pool.query(
            `SELECT id, field_name, old_value, new_value, updated_by_name, ip_address, action_type, created_at
             FROM assessor_profile_edit_logs WHERE assessor_id = ? ORDER BY created_at DESC`,
            [req.params.id]
        );
        return res.json({ success: true, logs: rows });
    } catch (error) {
        console.error('getAssessorEditLogs error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// @desc  Immediately end one of an assessor's active login sessions.
//        assessorAuth.js doesn't cross-check a live session-open row on
//        every request (unlike requireAdminOrOrgAuth.js for organizations),
//        so this closes the session_sessions row for audit purposes but the
//        JWT itself remains valid until it naturally expires (12h) — same
//        caveat as any stateless-JWT force-logout without a token blocklist.
// @route POST /api/admin/assessors/:id/sessions/:sessionId/force-logout
exports.forceLogoutAssessorSession = async (req, res) => {
    try {
        const { id, sessionId } = req.params;
        const scope = scopeClause(req.orgScope);
        const [assessorRows] = await pool.query(
            `SELECT a.id, a.name FROM assessors a WHERE a.id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [id, ...scope.params]
        );
        if (!assessorRows.length) return res.status(404).json({ success: false, message: 'Assessor not found' });

        const [result] = await pool.query(`
            UPDATE assessor_login_sessions
            SET logout_time = NOW(), session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW()), logout_type = 'forced'
            WHERE id = ? AND assessor_id = ? AND status = 'success' AND logout_time IS NULL
        `, [sessionId, id]);

        if (!result.affectedRows) {
            return res.status(404).json({ success: false, message: 'Active session not found or already ended.' });
        }

        const actor = resolveActor(req);
        await logAssessorActivity({
            assessorId: id, assessorName: assessorRows[0].name, ...actor,
            module: 'assessors', actionType: 'force_logout', description: `Force-logged-out session #${sessionId}`, req,
            recordType: 'assessor_login_sessions', recordId: sessionId,
        });

        return res.json({ success: true, message: 'Session ended.' });
    } catch (error) {
        console.error('forceLogoutAssessorSession error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
