const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { logStaffActivity } = require('../utils/logStaffActivity');
const { logOrgActivity } = require('../utils/logOrgActivity');

// staff_activity_logs (above) is a staff/admin-centric trail; this is the
// separate org-facing trail a Super Admin reviews per-organization (see
// AdminOrganizationDetail.jsx) — only fires when the staff record actually
// belongs to an organization.
const logStaffOrgActivity = async (req, orgId, actionType, description, extra = {}) => {
    if (!orgId) return;
    const [orgRows] = await pool.query('SELECT org_name FROM organizations WHERE id = ?', [orgId]);
    await logOrgActivity({
        orgId, orgName: orgRows[0]?.org_name,
        actorType: req.admin.role, actorId: req.admin.id, actorName: req.admin.name || req.admin.email,
        module: 'staff', actionType, description, req,
        ...extra,
    });
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LEN = 8;

// "Follow security standards": at least 8 chars, one letter, one number —
// same baseline enforced client-side in AdminStaffAdd/Edit.
function isPasswordStrong(pw) {
    return typeof pw === 'string' && pw.length >= PASSWORD_MIN_LEN && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

function normalizePermissions(permissions) {
    if (!Array.isArray(permissions)) return [];
    return permissions.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim());
}

// Same org-isolation convention as adminChildController.js's scopeClause —
// Super Admin sees/manages every staff row (including pre-existing org_id-
// NULL ones, unchanged); an org-bound staff account or Organization login
// only ever sees/manages staff stamped with their own org_id.
function scopeClause(orgScope, alias = '') {
    if (orgScope.isSuperAdmin) return { sql: '', params: [] };
    const col = alias ? `${alias}.org_id` : 'org_id';
    // Null-safe equality (<=>) — see adminChildController.js's scopeClause
    // for why plain `=` is wrong when orgId is NULL.
    return { sql: `${col} <=> ?`, params: [orgScope.orgId] };
}

// ── Staff List (search + filter + pagination + sort) ───────────────────────
// @route GET /api/admin/staff
exports.getAllStaff = async (req, res) => {
    try {
        const {
            search = '', status = '', sortKey = 'created_at', sortDir = 'desc',
            page = 1, limit = 20,
        } = req.query;

        const clauses = [];
        const params = [];
        if (search.trim()) {
            clauses.push('(name LIKE ? OR email LIKE ? OR mobile LIKE ?)');
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }
        if (status === 'active' || status === 'inactive') {
            clauses.push('status = ?');
            params.push(status);
        }
        const scope = scopeClause(req.orgScope);
        if (scope.sql) { clauses.push(scope.sql); params.push(...scope.params); }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

        const SORTABLE = new Set(['name', 'email', 'mobile', 'status', 'created_at', 'last_login']);
        const col = SORTABLE.has(sortKey) ? sortKey : 'created_at';
        const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const offset = (pageNum - 1) * pageSize;

        // last_login is derived from staff_login_sessions rather than stored
        // redundantly on `staff` — always reflects the true latest session.
        const listQuery = `
            SELECT s.id, s.name, s.email, s.mobile, s.status, s.permissions, s.created_at, s.org_id, o.org_name,
                   (SELECT MAX(login_time) FROM staff_login_sessions
                     WHERE staff_id = s.id AND status = 'success') AS last_login
            FROM staff s
            LEFT JOIN organizations o ON s.org_id = o.id
            ${where}
            ORDER BY ${col === 'last_login' ? 'last_login' : `s.${col}`} ${dir}
            LIMIT ? OFFSET ?
        `;
        const [rows] = await pool.query(listQuery, [...params, pageSize, offset]);

        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM staff ${where}`, params);

        res.json({ success: true, staff: rows, total, page: pageNum, limit: pageSize });
    } catch (error) {
        console.error('getAllStaff error:', error);
        res.status(500).json({ success: false, message: 'Failed to load staff list' });
    }
};

// @route GET /api/admin/staff/:id
exports.getStaffById = async (req, res) => {
    try {
        const scope = scopeClause(req.orgScope);
        const [rows] = await pool.query(
            `SELECT s.id, s.name, s.email, s.mobile, s.status, s.permissions, s.created_at, s.updated_at, s.org_id, o.org_name
             FROM staff s LEFT JOIN organizations o ON o.id = s.org_id
             WHERE s.id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [req.params.id, ...scope.params]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });
        res.json({ success: true, staff: rows[0] });
    } catch (error) {
        console.error('getStaffById error:', error);
        res.status(500).json({ success: false, message: 'Failed to load staff' });
    }
};

// @route POST /api/admin/staff
exports.addStaff = async (req, res) => {
    try {
        const { name, email, mobile, password, status, permissions } = req.body;
        const trimmedName = name?.trim() || '';
        const normalizedEmail = email?.trim().toLowerCase() || '';
        const trimmedMobile = mobile?.trim() || '';

        if (!trimmedName || !normalizedEmail || !trimmedMobile || !password) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }
        if (!EMAIL_RE.test(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'Invalid email address.' });
        }
        if (!isPasswordStrong(password)) {
            return res.status(400).json({ success: false, message: `Password must be at least ${PASSWORD_MIN_LEN} characters and include a letter and a number.` });
        }

        const [dupEmail] = await pool.query('SELECT id FROM staff WHERE email = ?', [normalizedEmail]);
        if (dupEmail.length) return res.status(400).json({ success: false, message: 'Email is already registered.' });
        const [dupMobile] = await pool.query('SELECT id FROM staff WHERE mobile = ?', [trimmedMobile]);
        if (dupMobile.length) return res.status(400).json({ success: false, message: 'Mobile number is already registered.' });

        const passwordHash = await bcrypt.hash(password, 10);
        const perms = normalizePermissions(permissions);

        // Super Admin must explicitly pick which organization a new staff
        // account belongs to (AdminStaffAdd.jsx's org picker, admin-only);
        // an org-bound staff account or Organization login always stamps
        // its own org_id instead — never trusted from the client.
        let orgId;
        if (req.orgScope.isSuperAdmin) {
            const requestedOrgId = req.body.org_id ? parseInt(req.body.org_id, 10) : null;
            if (!requestedOrgId) {
                return res.status(400).json({ success: false, message: 'Please select the organization this staff account belongs to.' });
            }
            const [orgRows] = await pool.query('SELECT id FROM organizations WHERE id = ?', [requestedOrgId]);
            if (!orgRows.length) {
                return res.status(400).json({ success: false, message: 'Selected organization not found.' });
            }
            orgId = requestedOrgId;
        } else {
            orgId = req.orgScope.orgId;
        }

        const [result] = await pool.query(
            'INSERT INTO staff (name, email, mobile, password_hash, status, permissions, org_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [trimmedName, normalizedEmail, trimmedMobile, passwordHash, status === 'inactive' ? 'inactive' : 'active', JSON.stringify(perms), orgId]
        );

        // logStaffActivity is a staff/admin audit trail keyed to req.admin —
        // an Organization actor has no req.admin identity (see
        // requireAdminOrOrgAuth), so this is admin/staff-only, same as
        // before this feature existed.
        if (req.admin) {
            await logStaffActivity({
                staffId: req.admin.role === 'staff' ? req.admin.id : null, staffName: req.admin.name || req.admin.email, module: 'staff', actionType: 'create',
                description: `Created staff account "${trimmedName}" (${normalizedEmail})`, req,
                menuName: 'Staff', pageName: 'Add Staff', recordId: result.insertId, recordName: trimmedName,
            });
        }

        await logStaffOrgActivity(req, orgId, 'add', `Added staff "${trimmedName}" (${normalizedEmail})`, {
            recordType: 'staff', recordId: result.insertId, recordName: trimmedName,
        });

        res.status(201).json({ success: true, message: 'Staff account created successfully', staffId: result.insertId });
    } catch (error) {
        console.error('addStaff error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Email or mobile number is already registered.' });
        }
        res.status(500).json({ success: false, message: 'Server error creating staff account' });
    }
};

// @route PUT /api/admin/staff/:id
exports.updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, mobile, status, permissions } = req.body;
        const trimmedName = name?.trim() || '';
        const normalizedEmail = email?.trim().toLowerCase() || '';
        const trimmedMobile = mobile?.trim() || '';

        if (!trimmedName || !normalizedEmail || !trimmedMobile || !status) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }
        if (!EMAIL_RE.test(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'Invalid email address.' });
        }

        const [dupEmail] = await pool.query('SELECT id FROM staff WHERE email = ? AND id != ?', [normalizedEmail, id]);
        if (dupEmail.length) return res.status(400).json({ success: false, message: 'Email is already registered to another staff member.' });
        const [dupMobile] = await pool.query('SELECT id FROM staff WHERE mobile = ? AND id != ?', [trimmedMobile, id]);
        if (dupMobile.length) return res.status(400).json({ success: false, message: 'Mobile number is already registered to another staff member.' });

        const scope = scopeClause(req.orgScope);
        const [beforeRows] = await pool.query(`SELECT name, email, mobile, status, permissions, org_id FROM staff WHERE id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`, [id, ...scope.params]);
        if (!beforeRows.length) return res.status(404).json({ success: false, message: 'Staff not found' });
        const before = beforeRows[0];

        // Only Super Admin may reassign a staff account's organization
        // (AdminStaffEdit.jsx's org picker, admin-only); an org-bound
        // staff/Organization session keeps the account's existing org_id
        // untouched regardless of what's submitted.
        let newOrgId = before.org_id;
        if (req.orgScope.isSuperAdmin && req.body.org_id !== undefined) {
            const requestedOrgId = req.body.org_id ? parseInt(req.body.org_id, 10) : null;
            if (!requestedOrgId) {
                return res.status(400).json({ success: false, message: 'Please select the organization this staff account belongs to.' });
            }
            const [orgRows] = await pool.query('SELECT id FROM organizations WHERE id = ?', [requestedOrgId]);
            if (!orgRows.length) {
                return res.status(400).json({ success: false, message: 'Selected organization not found.' });
            }
            newOrgId = requestedOrgId;
        }

        const perms = normalizePermissions(permissions);
        const newStatus = status === 'inactive' ? 'inactive' : 'active';
        // Existence already confirmed above via beforeRows — unlike that
        // SELECT, UPDATE's affectedRows is 0 both when the row is missing
        // AND when none of the columns actually changed value (MySQL's
        // default, without the CLIENT_FOUND_ROWS flag), so it can't be used
        // as the "not found" signal here without misreporting a genuine
        // no-op save (e.g. clicking Save without editing anything) as 404.
        await pool.query(
            'UPDATE staff SET name=?, email=?, mobile=?, status=?, permissions=?, org_id=? WHERE id=?',
            [trimmedName, normalizedEmail, trimmedMobile, newStatus, JSON.stringify(perms), newOrgId, id]
        );

        // Only the fields that actually changed — keeps the diff readable
        // instead of restating the whole record on every edit.
        const previous = {};
        const updated = {};
        const beforePerms = Array.isArray(before.permissions) ? before.permissions : [];
        if (before.name !== trimmedName) { previous.name = before.name; updated.name = trimmedName; }
        if (before.email !== normalizedEmail) { previous.email = before.email; updated.email = normalizedEmail; }
        if (before.mobile !== trimmedMobile) { previous.mobile = before.mobile; updated.mobile = trimmedMobile; }
        if (before.status !== newStatus) { previous.status = before.status; updated.status = newStatus; }
        if (JSON.stringify([...beforePerms].sort()) !== JSON.stringify([...perms].sort())) {
            previous.permissions = beforePerms; updated.permissions = perms;
        }
        if (newOrgId !== before.org_id) {
            const orgIds = [before.org_id, newOrgId].filter(v => v !== null && v !== undefined);
            let orgNameMap = {};
            if (orgIds.length) {
                const [orgNameRows] = await pool.query('SELECT id, org_name FROM organizations WHERE id IN (?)', [orgIds]);
                orgNameMap = Object.fromEntries(orgNameRows.map(o => [o.id, o.org_name]));
            }
            previous.organization = orgNameMap[before.org_id] || 'None';
            updated.organization = orgNameMap[newOrgId] || 'None';
        }

        if (req.admin) {
            await logStaffActivity({
                staffId: req.admin.role === 'staff' ? req.admin.id : null, staffName: req.admin.name || req.admin.email, module: 'staff', actionType: 'edit',
                description: `Updated staff account "${trimmedName}" (${normalizedEmail})`, req,
                menuName: 'Staff', pageName: 'Edit Staff', recordId: id, recordName: trimmedName,
                metadata: Object.keys(updated).length ? { previous, updated } : null,
            });
        }

        await logStaffOrgActivity(req, before.org_id, 'edit', `Updated staff "${trimmedName}" (${normalizedEmail})`, {
            recordType: 'staff', recordId: id, recordName: trimmedName,
            previousValue: Object.keys(previous).length ? previous : null,
            newValue: Object.keys(updated).length ? updated : null,
        });

        res.json({ success: true, message: 'Staff account updated successfully' });
    } catch (error) {
        console.error('updateStaff error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Email or mobile number is already registered.' });
        }
        res.status(500).json({ success: false, message: 'Server error updating staff account' });
    }
};

// @route DELETE /api/admin/staff/:id
exports.deleteStaff = async (req, res) => {
    try {
        const scope = scopeClause(req.orgScope);
        const [rows] = await pool.query(`SELECT name, email, org_id FROM staff WHERE id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`, [req.params.id, ...scope.params]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });

        await pool.query('DELETE FROM staff WHERE id = ?', [req.params.id]);

        if (req.admin) {
            await logStaffActivity({
                staffId: req.admin.role === 'staff' ? req.admin.id : null, staffName: req.admin.name || req.admin.email, module: 'staff', actionType: 'delete',
                description: `Deleted staff account "${rows[0].name}" (${rows[0].email})`, req,
                menuName: 'Staff', pageName: 'Staff List', recordId: req.params.id, recordName: rows[0].name,
            });
        }

        await logStaffOrgActivity(req, rows[0].org_id, 'delete', `Deleted staff "${rows[0].name}" (${rows[0].email})`, {
            recordType: 'staff', recordId: req.params.id, recordName: rows[0].name,
        });

        res.json({ success: true, message: 'Staff account deleted' });
    } catch (error) {
        console.error('deleteStaff error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting staff account' });
    }
};

// Admin-initiated reset — sets a new password directly (no current-password check).
// @route PUT /api/admin/staff/:id/reset-password
exports.resetStaffPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!isPasswordStrong(newPassword)) {
            return res.status(400).json({ success: false, message: `Password must be at least ${PASSWORD_MIN_LEN} characters and include a letter and a number.` });
        }
        const scope = scopeClause(req.orgScope);
        const [rows] = await pool.query(`SELECT name, email FROM staff WHERE id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`, [req.params.id, ...scope.params]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE staff SET password_hash=? WHERE id=?', [passwordHash, req.params.id]);

        if (req.admin) {
            await logStaffActivity({
                staffId: req.admin.role === 'staff' ? req.admin.id : null, staffName: req.admin.name || req.admin.email, module: 'staff', actionType: 'password_change',
                description: `Reset password for staff "${rows[0].name}" (${rows[0].email})`, req,
                menuName: 'Staff', pageName: 'Staff List', recordId: req.params.id, recordName: rows[0].name,
            });
        }

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('resetStaffPassword error:', error);
        res.status(500).json({ success: false, message: 'Server error resetting password' });
    }
};

// ── Self-service profile (either role can reach these — always about "me") ─

// @route GET /api/admin/staff/me/profile
exports.getMyProfile = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, email, mobile, status, permissions, created_at FROM staff WHERE id = ?',
            [req.admin.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });
        res.json({ success: true, profile: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @route PUT /api/admin/staff/me/profile
exports.updateMyProfile = async (req, res) => {
    try {
        const { name, mobile } = req.body;
        const trimmedName = name?.trim() || '';
        const trimmedMobile = mobile?.trim() || '';
        if (!trimmedName || !trimmedMobile) {
            return res.status(400).json({ success: false, message: 'Name and mobile number are required.' });
        }
        const [dupMobile] = await pool.query('SELECT id FROM staff WHERE mobile = ? AND id != ?', [trimmedMobile, req.admin.id]);
        if (dupMobile.length) return res.status(400).json({ success: false, message: 'Mobile number is already registered to another staff member.' });

        await pool.query('UPDATE staff SET name=?, mobile=? WHERE id=?', [trimmedName, trimmedMobile, req.admin.id]);

        await logStaffActivity({
            staffId: req.admin.id, staffName: trimmedName, module: 'profile', actionType: 'profile_update',
            description: 'Updated own profile', req,
            menuName: 'Profile', pageName: 'My Profile', recordId: req.admin.id,
        });

        res.json({ success: true, message: 'Profile updated.', profile: { name: trimmedName, mobile: trimmedMobile } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Self-service — requires current password, unlike admin-initiated reset.
// @route PUT /api/admin/staff/me/change-password
exports.changeMyPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required.' });
        }
        if (!isPasswordStrong(newPassword)) {
            return res.status(400).json({ success: false, message: `New password must be at least ${PASSWORD_MIN_LEN} characters and include a letter and a number.` });
        }
        const [rows] = await pool.query('SELECT name, password_hash FROM staff WHERE id = ?', [req.admin.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Staff not found' });
        if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE staff SET password_hash=? WHERE id=?', [passwordHash, req.admin.id]);

        await logStaffActivity({
            staffId: req.admin.id, staffName: rows[0].name, module: 'profile', actionType: 'password_change',
            description: 'Changed own password', req,
            menuName: 'Profile', pageName: 'My Profile', recordId: req.admin.id,
        });

        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ── Activity Log ─────────────────────────────────────────────────────────

// @route GET /api/admin/staff/activity-log
exports.getActivityLog = async (req, res) => {
    try {
        const {
            staffId = '', module = '', actionType = '', sessionId = '', search = '',
            startDate = '', endDate = '', sortKey = 'created_at', sortDir = 'desc',
            page = 1, limit = 50,
        } = req.query;
        const clauses = [];
        const params = [];
        if (staffId) { clauses.push('staff_id = ?'); params.push(staffId); }
        if (module) { clauses.push('module = ?'); params.push(module); }
        if (actionType) { clauses.push('action_type = ?'); params.push(actionType); }
        if (sessionId) { clauses.push('session_id = ?'); params.push(sessionId); }
        if (startDate) { clauses.push('DATE(created_at) >= ?'); params.push(startDate); }
        if (endDate) { clauses.push('DATE(created_at) <= ?'); params.push(endDate); }
        if (search.trim()) {
            clauses.push('(staff_name LIKE ? OR description LIKE ? OR page_name LIKE ? OR record_name LIKE ?)');
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

        const SORTABLE = new Set(['created_at', 'module', 'action_type', 'staff_name']);
        const col = SORTABLE.has(sortKey) ? sortKey : 'created_at';
        const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        // Higher ceiling than the on-screen default (50) — the Excel/PDF
        // export buttons request the full filtered log in one page.
        const pageSize = Math.min(5000, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * pageSize;

        const [rows] = await pool.query(
            `SELECT id, staff_id, staff_name, module, action_type, description,
                    menu_name, page_name, record_id, record_name, metadata,
                    ip_address, browser, os, device_type, session_id, created_at
             FROM staff_activity_logs ${where}
             ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM staff_activity_logs ${where}`, params);

        res.json({ success: true, logs: rows, total, page: pageNum, limit: pageSize });
    } catch (error) {
        console.error('getActivityLog error:', error);
        res.status(500).json({ success: false, message: 'Failed to load activity log' });
    }
};

// Fire-and-forget navigation tracker — the frontend calls this on every
// route change for a staff-role session (see AdminLayout.jsx), so "menu
// accessed / page visited" is captured without instrumenting every existing
// controller. No-ops for an admin session (nothing to audit them against).
// @route POST /api/admin/staff/log-page-view
exports.logPageView = async (req, res) => {
    try {
        if (req.admin.role !== 'staff') return res.status(204).end();
        const { module, menuName, pageName } = req.body;
        await logStaffActivity({
            staffId: req.admin.id, staffName: req.admin.name, module: module || 'navigation', actionType: 'page_view',
            description: `Visited ${pageName || 'a page'}`, req, menuName, pageName,
        });
        res.status(204).end();
    } catch (error) {
        console.error('logPageView error:', error);
        res.status(204).end();
    }
};

// Fire-and-forget report/export download tracker — called from the
// Reports and Analysis pages' existing export buttons (Excel/PDF/CSV/image)
// right after the file is generated client-side, so which report, with
// which filters, in which format is captured without a server round-trip
// being part of the export itself. Same staff-only scope as logPageView.
// @route POST /api/admin/staff/log-report-download
exports.logReportDownload = async (req, res) => {
    try {
        if (req.admin.role !== 'staff') return res.status(204).end();
        const { module, menuName, pageName, reportName, reportType, format, filters, dateRangeStart, dateRangeEnd, status } = req.body;
        await logStaffActivity({
            staffId: req.admin.id, staffName: req.admin.name, module: module || 'reports', actionType: 'export',
            description: `Downloaded "${reportName || 'report'}" (${format || 'unknown format'})`, req,
            menuName, pageName, recordName: reportName || null,
            metadata: {
                reportType: reportType || null,
                format: format || null,
                filters: filters || null,
                dateRange: (dateRangeStart || dateRangeEnd) ? { start: dateRangeStart || null, end: dateRangeEnd || null } : null,
                status: status || 'success',
            },
        });
        res.status(204).end();
    } catch (error) {
        console.error('logReportDownload error:', error);
        res.status(204).end();
    }
};

// ── Attendance (derived from staff_login_sessions — no separate table) ─────

// @route GET /api/admin/staff/attendance
exports.getAttendance = async (req, res) => {
    try {
        const { staffId = '', startDate = '', endDate = '' } = req.query;
        const clauses = ["ls.status = 'success'", 'ls.login_time IS NOT NULL'];
        const params = [];
        if (staffId) { clauses.push('ls.staff_id = ?'); params.push(staffId); }
        if (startDate) { clauses.push('DATE(ls.login_time) >= ?'); params.push(startDate); }
        if (endDate) { clauses.push('DATE(ls.login_time) <= ?'); params.push(endDate); }
        const where = `WHERE ${clauses.join(' AND ')}`;

        const [rows] = await pool.query(`
            SELECT ls.staff_id, s.name AS staff_name, DATE(ls.login_time) AS date,
                   MIN(ls.login_time) AS check_in,
                   MAX(COALESCE(ls.logout_time, ls.login_time)) AS check_out,
                   SUM(COALESCE(ls.session_duration, 0)) AS total_seconds,
                   COUNT(*) AS session_count
            FROM staff_login_sessions ls
            JOIN staff s ON s.id = ls.staff_id
            ${where}
            GROUP BY ls.staff_id, DATE(ls.login_time)
            ORDER BY date DESC, staff_name ASC
        `, params);

        res.json({ success: true, attendance: rows });
    } catch (error) {
        console.error('getAttendance error:', error);
        res.status(500).json({ success: false, message: 'Failed to load attendance' });
    }
};

// ── Login History (per-session audit trail for one staff member) ──────────

// "Session Expired" isn't stored — a session that never got an explicit
// logout call is only distinguishable from "still active" by whether the
// JWT it was issued with has expired, so it's computed at read time against
// the same 12h lifetime used when the token is signed (loginAdmin's
// `expiresIn: '12h'`). Kept as one CASE expression shared by the row query
// and the summary counts below so both agree on the same cutoff.
const LOGOUT_STATUS_CASE = `
    CASE
        WHEN ls.status = 'failed' THEN NULL
        WHEN ls.logout_status = 'force_logout' THEN 'force_logout'
        WHEN ls.logout_time IS NOT NULL THEN 'normal'
        WHEN ls.login_time < DATE_SUB(NOW(), INTERVAL 12 HOUR) THEN 'session_expired'
        ELSE 'active'
    END
`;

// @route GET /api/admin/staff/:id/login-history
exports.getStaffLoginHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            search = '', startDate = '', endDate = '',
            sortKey = 'login_time', sortDir = 'desc', page = 1, limit = 20,
        } = req.query;

        const [staffRows] = await pool.query('SELECT id, name, email FROM staff WHERE id = ?', [id]);
        if (!staffRows.length) return res.status(404).json({ success: false, message: 'Staff not found' });

        const clauses = ['ls.staff_id = ?'];
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
        // Higher ceiling than other lists (200) — the Excel/PDF export buttons
        // request the full filtered history in one page (not just what's on
        // screen), and login sessions can accumulate into the thousands over
        // a long-lived account.
        const pageSize = Math.min(5000, Math.max(1, parseInt(limit, 10) || 20));
        const offset = (pageNum - 1) * pageSize;

        const [rows] = await pool.query(`
            SELECT ls.id, ls.status AS login_status, ls.login_time, ls.logout_time, ls.session_duration,
                   ls.ip_address, ls.browser, ls.os, ls.device_type,
                   ${LOGOUT_STATUS_CASE} AS logout_status
            FROM staff_login_sessions ls
            ${where}
            ORDER BY ls.${col} ${dir}
            LIMIT ? OFFSET ?
        `, [...params, pageSize, offset]);

        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM staff_login_sessions ls ${where}`, params);

        const [[summary]] = await pool.query(`
            SELECT
                SUM(ls.status = 'success') AS total_logins,
                SUM(ls.status = 'failed')  AS total_failed,
                MAX(CASE WHEN ls.status = 'success' THEN ls.login_time END) AS last_login,
                MAX(ls.logout_time) AS last_logout,
                SUM(COALESCE(ls.session_duration, 0)) AS total_working_seconds,
                AVG(ls.session_duration) AS avg_session_seconds
            FROM staff_login_sessions ls
            ${where}
        `, params);

        res.json({
            success: true,
            staff: staffRows[0],
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
        console.error('getStaffLoginHistory error:', error);
        res.status(500).json({ success: false, message: 'Failed to load login history' });
    }
};

// Admin-only — ends a staff member's still-active session on demand (e.g. a
// lost/stolen device, or troubleshooting a stuck session). Deliberately not
// available to a staff account even with the 'staff' module grant, since
// forcing another session closed is a stronger action than managing staff
// records; enforced by the requireAdminOnly route middleware (see
// staffRoutes.js), same as the Log History pages this button lives on.
// @route POST /api/admin/staff/:id/sessions/:sessionId/force-logout
exports.forceLogoutStaffSession = async (req, res) => {
    try {
        const { id, sessionId } = req.params;

        const [staffRows] = await pool.query('SELECT name, email FROM staff WHERE id = ?', [id]);
        if (!staffRows.length) return res.status(404).json({ success: false, message: 'Staff not found' });

        const [result] = await pool.query(`
            UPDATE staff_login_sessions
            SET logout_time = NOW(),
                session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW()),
                logout_status = 'force_logout'
            WHERE id = ? AND staff_id = ? AND status = 'success' AND logout_time IS NULL
        `, [sessionId, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Active session not found or already ended.' });
        }

        await logStaffActivity({
            staffId: null, staffName: req.admin.name || req.admin.email, module: 'staff', actionType: 'force_logout',
            description: `Force-logged-out staff "${staffRows[0].name}" (${staffRows[0].email}), session #${sessionId}`,
            req, menuName: 'Staff', pageName: 'Log History', recordId: sessionId,
        });

        res.json({ success: true, message: 'Session ended.' });
    } catch (error) {
        console.error('forceLogoutStaffSession error:', error);
        res.status(500).json({ success: false, message: 'Server error ending session' });
    }
};
