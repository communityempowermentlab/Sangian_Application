const { pool }   = require('../config/db');
const path       = require('path');
const fs         = require('fs');
const { UPLOAD_DIR } = require('../middleware/upload');
const { logOrgActivity } = require('../utils/logOrgActivity');

// Only children belonging to an organization are logged to the org
// activity trail (Super Admin CRUD on org_id-NULL, pre-existing children
// isn't "organization activity"). actorType/actorName come from whichever
// identity requireAdminOrOrgAuth authenticated — see its req.admin shape.
// org_name is looked up fresh rather than trusted from req.admin.name,
// since that's only actually the org's own name for an 'organization'
// session — for an org-bound staff actor it's the staff member's name.
const logChildActivity = async (req, orgId, actionType, description, extra = {}) => {
    if (!orgId) return;
    const [orgRows] = await pool.query('SELECT org_name FROM organizations WHERE id = ?', [orgId]);
    await logOrgActivity({
        orgId, orgName: orgRows[0]?.org_name,
        actorType: req.admin.role,
        actorId: req.admin.id,
        actorName: req.admin.name || req.admin.email,
        module: 'children', actionType, description, req,
        ...extra,
    });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Rename the temp upload file to <childId>_<ts>.<ext> and return the new filename. */
// Exported (in addition to the local const use below) so
// assessorController.js's addChild can reuse the exact same file-handling
// logic rather than duplicating it — purely additive, doesn't change how
// this file uses them itself.
const finalizePhoto = (tmpFile, childId) => {
    const ext         = path.extname(tmpFile.filename);
    const newFilename = `${childId}_${Date.now()}${ext}`;
    const newPath     = path.join(UPLOAD_DIR, newFilename);
    fs.renameSync(tmpFile.path, newPath);
    return newFilename;
};

/** Delete a stored photo file if it exists. */
const deletePhoto = (filename) => {
    if (!filename) return;
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

exports.finalizePhoto = finalizePhoto;
exports.deletePhoto = deletePhoto;

// ── Controllers ───────────────────────────────────────────────────────────────

// Org isolation helper — a Super Admin sees everything (including
// pre-existing org_id-NULL children, unchanged from before this feature);
// an org-bound staff account or an Organization login sees only rows
// stamped with their own org_id, never NULL/other-org rows. Used by every
// function below that touches a specific child or the children list.
const scopeClause = (orgScope, alias = 'c') => {
    if (orgScope.isSuperAdmin) return { sql: '', params: [] };
    const col = alias ? `${alias}.org_id` : 'org_id';
    // Null-safe equality (<=>) — plain `=` never matches when orgId is NULL
    // (SQL's NULL = NULL is unknown, not true), which would make legacy
    // org_id-NULL staff unable to see their own org_id-NULL children.
    return { sql: `${col} <=> ?`, params: [orgScope.orgId] };
};

// @route   GET /api/admin/children
exports.getAllChildren = async (req, res) => {
    try {
        const scope = scopeClause(req.orgScope);
        // Individual Users are a separate, self-contained section (Admin >
        // Individuals, and their own "My Account" page) — their linked
        // child profile must not appear in the Registered Children list,
        // for Super Admin or any Organization alike. Same exclusion
        // already applied to admin Reports/Analysis.
        const whereClauses = ['c.individual_id IS NULL', ...(scope.sql ? [scope.sql] : [])];
        const [children] = await pool.query(`
            SELECT c.child_id, c.name, c.dob, c.gender, c.mobile, c.father_name, c.mother_name, c.remarks, c.gram_sabha, c.hamlet, c.status, c.photo, c.created_at,
                   c.org_id, o.org_name, c.created_by_assessor_id, ca.name AS created_by_assessor_name,
                   (SELECT login_time FROM login_sessions ls
                    WHERE ls.child_id = c.child_id AND ls.status = 'success'
                    ORDER BY login_time DESC LIMIT 1) AS last_login,
                   (SELECT GROUP_CONCAT(cg.id ORDER BY cg.name)
                    FROM child_group_members cgm JOIN child_groups cg ON cg.id = cgm.group_id
                    WHERE cgm.children_id = c.id) AS group_ids,
                   (SELECT GROUP_CONCAT(cg.name ORDER BY cg.name)
                    FROM child_group_members cgm JOIN child_groups cg ON cg.id = cgm.group_id
                    WHERE cgm.children_id = c.id) AS group_names,
                   COALESCE(agg.total_sessions, 0)     AS total_sessions,
                   COALESCE(agg.completed_sessions, 0) AS completed_sessions,
                   COALESCE(agg.games_played, 0)       AS games_played,
                   COALESCE(agg.games_completed, 0)    AS games_completed,
                   agg.last_activity                   AS last_activity
            FROM children c
            LEFT JOIN organizations o ON c.org_id = o.id
            LEFT JOIN assessors ca ON ca.id = c.created_by_assessor_id
            LEFT JOIN (
                SELECT child_id,
                       COUNT(*)                                                          AS total_sessions,
                       CAST(SUM(status = 'completed') AS UNSIGNED)                       AS completed_sessions,
                       COUNT(DISTINCT game_name)                                         AS games_played,
                       COUNT(DISTINCT CASE WHEN status = 'completed' THEN game_name END) AS games_completed,
                       MAX(created_at)                                                   AS last_activity
                FROM game_sessions
                GROUP BY child_id
            ) agg ON agg.child_id = c.child_id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY c.created_at DESC
        `, scope.params);
        res.status(200).json(children);
    } catch (error) {
        console.error('Error fetching children for admin:', error);
        res.status(500).json({ message: 'Server error while fetching children.' });
    }
};

// @route   POST /api/admin/children
exports.addChild = async (req, res) => {
    try {
        const { child_id, name, dob, gender, mobile, father_name, mother_name, remarks, gram_sabha, hamlet } = req.body;

        if (!child_id || !name || !dob || !gender || !mobile || !father_name || !mother_name) {
            // Clean up any uploaded file on validation failure
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Child ID, name, DOB, gender, mobile, father name, and mother name are required.' });
        }

        if (father_name.trim().length > 225 || mother_name.trim().length > 225) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Father name and Mother name cannot exceed 225 characters.' });
        }
        
        // Check if child_id already exists
        const [existing] = await pool.query('SELECT id FROM children WHERE child_id = ?', [child_id.trim()]);
        if (existing.length > 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Child ID already exists. Please choose a unique ID.' });
        }

        // Super Admin must explicitly pick which organization a new child
        // belongs to (AdminChildAdd.jsx's org picker, admin-only); an
        // org-bound staff account or Organization login always stamps its
        // own org_id instead — never trusted from the client, always
        // derived from the authenticated scope.
        let orgId;
        if (req.orgScope.isSuperAdmin) {
            const requestedOrgId = req.body.org_id ? parseInt(req.body.org_id, 10) : null;
            if (!requestedOrgId) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Please select the organization this child belongs to.' });
            }
            const [orgRows] = await pool.query('SELECT id FROM organizations WHERE id = ?', [requestedOrgId]);
            if (!orgRows.length) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Selected organization not found.' });
            }
            orgId = requestedOrgId;
        } else {
            orgId = req.orgScope.orgId;
        }

        const [result] = await pool.query(
            'INSERT INTO children (child_id, name, dob, gender, mobile, father_name, mother_name, remarks, gram_sabha, hamlet, status, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [child_id.trim(), name.trim(), dob, gender.trim(), mobile.trim(), (father_name||'').trim(), (mother_name||'').trim(), (remarks||'').trim(), (gram_sabha||'').trim(), (hamlet||'').trim(), 'active', orgId]
        );

        const childIdStr = child_id.trim();

        // Handle photo upload
        let photoFilename = null;
        if (req.file) {
            photoFilename = finalizePhoto(req.file, childIdStr);
            await pool.query('UPDATE children SET photo = ? WHERE child_id = ?', [photoFilename, childIdStr]);
        }

        // Handle group assignment
        if (req.body.group_ids) {
            try {
                const groupIds = JSON.parse(req.body.group_ids);
                if (Array.isArray(groupIds) && groupIds.length > 0) {
                    const values = groupIds.map(gid => [result.insertId, gid]);
                    await pool.query('INSERT INTO child_group_members (children_id, group_id) VALUES ?', [values]);
                }
            } catch (e) {
                console.error('Failed to assign groups on child creation:', e);
            }
        }

        await logChildActivity(req, orgId, 'add', `Registered child "${name.trim()}" (${childIdStr})`, {
            recordType: 'child', recordId: childIdStr, recordName: name.trim(),
        });

        res.status(201).json({
            message: 'Child registered successfully by Admin.',
            child_id: childIdStr,
            photo: photoFilename,
        });
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        console.error('Registration Error by Admin:', error);
        res.status(500).json({ message: 'Server error during child registration.' });
    }
};

// @route   GET /api/admin/children/:childId
exports.getChildById = async (req, res) => {
    try {
        const { childId } = req.params;
        const scope = scopeClause(req.orgScope);
        const [rows] = await pool.query(`
            SELECT c.child_id, c.name, c.dob, c.gender, c.mobile, c.father_name, c.mother_name, c.remarks, c.gram_sabha, c.hamlet, c.status, c.photo,
                   c.org_id, o.org_name, c.created_by_assessor_id, ca.name AS created_by_assessor_name,
                   (SELECT GROUP_CONCAT(cg.id ORDER BY cg.name)
                    FROM child_group_members cgm JOIN child_groups cg ON cg.id = cgm.group_id
                    WHERE cgm.children_id = c.id) AS group_ids,
                   (SELECT GROUP_CONCAT(cg.name ORDER BY cg.name)
                    FROM child_group_members cgm JOIN child_groups cg ON cg.id = cgm.group_id
                    WHERE cgm.children_id = c.id) AS group_names
            FROM children c LEFT JOIN organizations o ON o.id = c.org_id
            LEFT JOIN assessors ca ON ca.id = c.created_by_assessor_id
            WHERE c.child_id = ? ${scope.sql ? `AND ${scope.sql}` : ''}
        `, [childId, ...scope.params]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Child ID not found.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching child details:', error);
        res.status(500).json({ message: 'Server error while fetching child details.' });
    }
};

// @route   PUT /api/admin/children/:childId
exports.updateChild = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { childId } = req.params;
        const { new_child_id, name, dob, gender, mobile, father_name, mother_name, remarks, gram_sabha, hamlet, status } = req.body;

        const [oldRecord] = await connection.query('SELECT id, child_id, name, dob, gender, mobile, father_name, mother_name, remarks, gram_sabha, hamlet, status, photo, org_id FROM children WHERE child_id = ?', [childId]);
        if (oldRecord.length === 0 || (!req.orgScope.isSuperAdmin && oldRecord[0].org_id !== req.orgScope.orgId)) {
            if (req.file) fs.unlinkSync(req.file.path);
            await connection.rollback();
            return res.status(404).json({ message: 'Child ID not found.' });
        }
        const oldData = oldRecord[0];

        if (!new_child_id || !name || !dob || !gender || !mobile || !father_name || !mother_name) {
            if (req.file) fs.unlinkSync(req.file.path);
            await connection.rollback();
            return res.status(400).json({ message: 'Child ID, name, DOB, gender, mobile, father name, and mother name are required.' });
        }

        // Only Super Admin may reassign a child's organization (AdminChildEdit.jsx's
        // org picker, admin-only); an org-bound staff/Organization session keeps
        // the child's existing org_id untouched regardless of what's submitted.
        let newOrgId = oldData.org_id;
        if (req.orgScope.isSuperAdmin && req.body.org_id !== undefined) {
            const requestedOrgId = req.body.org_id ? parseInt(req.body.org_id, 10) : null;
            if (!requestedOrgId) {
                if (req.file) fs.unlinkSync(req.file.path);
                await connection.rollback();
                return res.status(400).json({ message: 'Please select the organization this child belongs to.' });
            }
            const [orgRows] = await connection.query('SELECT id FROM organizations WHERE id = ?', [requestedOrgId]);
            if (!orgRows.length) {
                if (req.file) fs.unlinkSync(req.file.path);
                await connection.rollback();
                return res.status(400).json({ message: 'Selected organization not found.' });
            }
            newOrgId = requestedOrgId;
        }

        if (father_name.trim().length > 225 || mother_name.trim().length > 225) {
            if (req.file) fs.unlinkSync(req.file.path);
            await connection.rollback();
            return res.status(400).json({ message: 'Father name and Mother name cannot exceed 225 characters.' });
        }

        let targetChildId = childId;

        if (new_child_id && new_child_id.trim() !== childId) {
            const trimmedNewId = new_child_id.trim();
            const [existing] = await connection.query('SELECT id FROM children WHERE child_id = ?', [trimmedNewId]);
            if (existing.length > 0) {
                if (req.file) fs.unlinkSync(req.file.path);
                await connection.rollback();
                return res.status(400).json({ message: 'The new Child ID already exists. Please choose a unique ID.' });
            }
            
            // Update other tables manually
            await connection.query('UPDATE game_assessments SET child_id = ? WHERE child_id = ?', [trimmedNewId, childId]);
            await connection.query('UPDATE game_dashboard_pdfs SET child_id = ? WHERE child_id = ?', [trimmedNewId, childId]);
            await connection.query('UPDATE game_sessions SET child_id = ? WHERE child_id = ?', [trimmedNewId, childId]);
            await connection.query('UPDATE login_sessions SET child_id = ? WHERE child_id = ?', [trimmedNewId, childId]);

            // Update main table child_id along with other fields
            const [result] = await connection.query(
                'UPDATE children SET child_id = ?, name = ?, dob = ?, gender = ?, mobile = ?, father_name = ?, mother_name = ?, remarks = ?, gram_sabha = ?, hamlet = ?, status = ?, org_id = ? WHERE child_id = ?',
                [trimmedNewId, name.trim(), dob, gender.trim(), mobile.trim(), (father_name||'').trim(), (mother_name||'').trim(), (remarks||'').trim(), (gram_sabha||'').trim(), (hamlet||'').trim(), status, newOrgId, childId]
            );

            if (result.affectedRows === 0) {
                if (req.file) fs.unlinkSync(req.file.path);
                await connection.rollback();
                return res.status(404).json({ message: 'Child ID not found.' });
            }

            targetChildId = trimmedNewId;
        } else {
            const [result] = await connection.query(
                'UPDATE children SET name = ?, dob = ?, gender = ?, mobile = ?, father_name = ?, mother_name = ?, remarks = ?, gram_sabha = ?, hamlet = ?, status = ?, org_id = ? WHERE child_id = ?',
                [name.trim(), dob, gender.trim(), mobile.trim(), (father_name||'').trim(), (mother_name||'').trim(), (remarks||'').trim(), (gram_sabha||'').trim(), (hamlet||'').trim(), status, newOrgId, childId]
            );

            if (result.affectedRows === 0) {
                if (req.file) fs.unlinkSync(req.file.path);
                await connection.rollback();
                return res.status(404).json({ message: 'Child ID not found.' });
            }
        }

        // Handle photo replacement
        let newFilename = oldData.photo;
        if (req.file) {
            const [current] = await connection.query('SELECT photo FROM children WHERE child_id = ?', [targetChildId]);
            deletePhoto(current[0]?.photo);

            newFilename = finalizePhoto(req.file, targetChildId);
            await connection.query('UPDATE children SET photo = ? WHERE child_id = ?', [newFilename, targetChildId]);
        }

        // Sync group assignment (many-to-many, keyed on the stable numeric id —
        // see child_group_members in db.js for why child_id isn't used here)
        const [oldGroupRows] = await connection.query(
            'SELECT cg.name FROM child_group_members cgm JOIN child_groups cg ON cg.id = cgm.group_id WHERE cgm.children_id = ? ORDER BY cg.name',
            [oldData.id]
        );
        const oldGroupNames = oldGroupRows.map(g => g.name);
        let newGroupNames = oldGroupNames;

        if (req.body.group_ids !== undefined) {
            let groupIds = [];
            try {
                groupIds = JSON.parse(req.body.group_ids);
                if (!Array.isArray(groupIds)) groupIds = [];
            } catch (e) {
                groupIds = [];
            }

            await connection.query('DELETE FROM child_group_members WHERE children_id = ?', [oldData.id]);
            if (groupIds.length > 0) {
                const [newGroupRows] = await connection.query('SELECT id, name FROM child_groups WHERE id IN (?) ORDER BY name', [groupIds]);
                newGroupNames = newGroupRows.map(g => g.name);
                const values = newGroupRows.map(g => [oldData.id, g.id]);
                await connection.query('INSERT INTO child_group_members (children_id, group_id) VALUES ?', [values]);
            } else {
                newGroupNames = [];
            }
        }

        // Log changes
        const adminId = req.admin?.id || null;
        let adminName = req.admin?.email || 'Admin';
        if (adminId) {
            const [adminRows] = await connection.query('SELECT name FROM admins WHERE id = ?', [adminId]);
            if (adminRows.length > 0 && adminRows[0].name) adminName = adminRows[0].name;
        }
        let ipAddress = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '';
        if (ipAddress === '::1') ipAddress = '127.0.0.1';
        if (ipAddress.includes('::ffff:')) ipAddress = ipAddress.split('::ffff:')[1];

        const logs = [];
        if (targetChildId !== oldData.child_id) {
            logs.push(['Child ID', oldData.child_id, targetChildId]);
        }
        if (name.trim() !== oldData.name) {
            logs.push(['Full Name', oldData.name, name.trim()]);
        }
        const oldDob = oldData.dob ? new Date(oldData.dob).toISOString().split('T')[0] : '';
        if (dob !== oldDob) {
            logs.push(['Date of Birth', oldDob, dob]);
        }
        if (gender.trim() !== oldData.gender) {
            logs.push(['Gender', oldData.gender, gender.trim()]);
        }
        if (mobile.trim() !== oldData.mobile) {
            logs.push(['Mobile Number', oldData.mobile, mobile.trim()]);
        }
        if (status !== oldData.status) {
            logs.push(['Status', oldData.status, status]);
        }
        if (newOrgId !== oldData.org_id) {
            const orgIds = [oldData.org_id, newOrgId].filter(v => v !== null && v !== undefined);
            let orgNameMap = {};
            if (orgIds.length) {
                const [orgNameRows] = await connection.query('SELECT id, org_name FROM organizations WHERE id IN (?)', [orgIds]);
                orgNameMap = Object.fromEntries(orgNameRows.map(o => [o.id, o.org_name]));
            }
            logs.push(['Organization', orgNameMap[oldData.org_id] || 'None', orgNameMap[newOrgId] || 'None']);
        }
        if ((father_name || '').trim() !== (oldData.father_name || '')) {
            logs.push(['Father Name', oldData.father_name || '', (father_name || '').trim()]);
        }
        if ((mother_name || '').trim() !== (oldData.mother_name || '')) {
            logs.push(['Mother Name', oldData.mother_name || '', (mother_name || '').trim()]);
        }
        if ((remarks || '').trim() !== (oldData.remarks || '')) {
            logs.push(['Remarks', oldData.remarks || '', (remarks || '').trim()]);
        }
        if ((gram_sabha || '').trim() !== (oldData.gram_sabha || '')) {
            logs.push(['Gram Sabha', oldData.gram_sabha || '', (gram_sabha || '').trim()]);
        }
        if ((hamlet || '').trim() !== (oldData.hamlet || '')) {
            logs.push(['Hamlet Name', oldData.hamlet || '', (hamlet || '').trim()]);
        }
        if (req.file && newFilename !== oldData.photo) {
            logs.push(['Photo', oldData.photo || 'None', newFilename]);
        }
        if (oldGroupNames.join(', ') !== newGroupNames.join(', ')) {
            logs.push(['Groups', oldGroupNames.join(', ') || 'None', newGroupNames.join(', ') || 'None']);
        }

        for (const log of logs) {
            await connection.query(
                'INSERT INTO child_profile_edit_logs (children_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [oldData.id, log[0], log[1], log[2], adminId, adminName, ipAddress]
            );
        }

        await connection.commit();

        if (logs.length) {
            await logChildActivity(req, oldData.org_id, 'edit', `Updated child "${name.trim()}" (${targetChildId})`, {
                recordType: 'child', recordId: targetChildId, recordName: name.trim(),
                previousValue: Object.fromEntries(logs.map(([field, oldVal]) => [field, oldVal])),
                newValue: Object.fromEntries(logs.map(([field, , newVal]) => [field, newVal])),
            });
        }

        res.status(200).json({ message: 'Child updated successfully.', new_child_id: targetChildId });
    } catch (error) {
        await connection.rollback();
        if (req.file) fs.unlinkSync(req.file.path);
        console.error('Error updating child:', error);
        res.status(500).json({ message: 'Server error while updating child details.' });
    } finally {
        connection.release();
    }
};

// @route   PUT /api/admin/children/:childId/status
exports.toggleStatus = async (req, res) => {
    try {
        const { childId } = req.params;
        const { status }  = req.body;

        // 'suspended'/'deleted' (soft-delete) are accepted here too — all
        // four values behave identically to the Assessor flow (only
        // 'active' is ever eligible for a new or continuing assessment,
        // see validateAssessorChild.js), they just record *why* an admin
        // blocked the child. No dedicated Suspend/Delete admin UI exists
        // yet — this endpoint just no longer rejects those values.
        if (!['active', 'inactive', 'suspended', 'deleted'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const scope = scopeClause(req.orgScope);
        const [result] = await pool.query(
            `UPDATE children SET status = ? WHERE child_id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [status, childId, ...scope.params]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Child ID not found.' });
        }

        await logChildActivity(req, req.orgScope.isSuperAdmin ? null : req.orgScope.orgId, 'edit', `Set child ${childId} status to ${status}`, {
            recordType: 'child', recordId: childId,
        });

        res.status(200).json({ message: `Child status updated to ${status}.` });
    } catch (error) {
        console.error('Error updating child status:', error);
        res.status(500).json({ message: 'Server error while updating status.' });
    }
};

// @route   GET /api/admin/children/:childId/sessions
exports.getChildSessions = async (req, res) => {
    try {
        const { childId } = req.params;
        const scope = scopeClause(req.orgScope, '');
        // Confirm the child is within scope before returning its session
        // history — login_sessions has no org_id of its own (bare child_id
        // string, see db.js), so ownership must be checked via `children`
        // first, otherwise an org could learn another org's session data by
        // guessing/enumerating child_id values.
        const [owner] = await pool.query(
            `SELECT id FROM children WHERE child_id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [childId, ...scope.params]
        );
        if (!owner.length) return res.status(404).json({ message: 'Child ID not found.' });

        const [sessions] = await pool.query(
            `SELECT id, status, login_time, logout_time, session_duration,
                    ip_address, device_type, browser, os, location
             FROM login_sessions WHERE child_id = ? ORDER BY login_time DESC`,
            [childId]
        );
        res.status(200).json(sessions);
    } catch (error) {
        console.error('Error fetching child sessions:', error);
        res.status(500).json({ message: 'Server error while fetching child sessions.' });
    }
};

// @route   GET /api/admin/children/:childId/logs
exports.getChildLogs = async (req, res) => {
    try {
        const { childId } = req.params;
        const scope = scopeClause(req.orgScope);
        const [logs] = await pool.query(
            `SELECT l.id, l.field_name, l.old_value, l.new_value, l.updated_by_name, l.ip_address, l.action_type, l.created_at
             FROM child_profile_edit_logs l
             JOIN children c ON l.children_id = c.id
             WHERE c.child_id = ? ${scope.sql ? `AND ${scope.sql}` : ''}
             ORDER BY l.created_at DESC`,
            [childId, ...scope.params]
        );
        res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching child edit logs:', error);
        res.status(500).json({ message: 'Server error while fetching edit logs.' });
    }
};
