const { pool } = require('../config/db');

// Same org-isolation convention as adminChildController.js's scopeClause —
// Super Admin sees/manages every group (including pre-existing org_id-NULL
// ones, unchanged); an org-bound staff account or Organization login only
// ever sees/manages groups stamped with their own org_id.
function scopeClause(orgScope, alias = 'cg') {
    if (orgScope.isSuperAdmin) return { sql: '', params: [] };
    const col = alias ? `${alias}.org_id` : 'org_id';
    return { sql: `${col} <=> ?`, params: [orgScope.orgId] };
}

// @desc Get all child groups (with member counts)
// @route GET /api/admin/child-groups
exports.getAllGroups = async (req, res) => {
    try {
        const scope = scopeClause(req.orgScope);
        const [rows] = await pool.query(`
            SELECT cg.*, o.org_name AS organization,
                   (SELECT COUNT(*) FROM child_group_members cgm WHERE cgm.group_id = cg.id) AS member_count
            FROM child_groups cg
            LEFT JOIN organizations o ON o.id = cg.org_id
            ${scope.sql ? `WHERE ${scope.sql}` : ''}
            ORDER BY cg.name
        `, scope.params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching child groups:', error);
        res.status(500).json({ message: 'Server error fetching child groups' });
    }
};

// @desc Get single child group by ID
// @route GET /api/admin/child-groups/:id
exports.getGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const scope = scopeClause(req.orgScope);
        const [rows] = await pool.query(
            `SELECT cg.*, o.org_name FROM child_groups cg LEFT JOIN organizations o ON o.id = cg.org_id
             WHERE cg.id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [id, ...scope.params]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Child group not found' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching child group:', error);
        res.status(500).json({ message: 'Server error fetching child group' });
    }
};

// @desc Add a new child group
// @route POST /api/admin/child-groups
exports.addGroup = async (req, res) => {
    try {
        const { name, description } = req.body;
        const { orgScope } = req;

        const trimmedName = name ? name.trim() : '';
        const trimmedDescription = description ? description.trim() : '';

        if (!trimmedName) {
            return res.status(400).json({ message: 'Group name is required.' });
        }

        // Super Admin must explicitly pick which organization a new group
        // belongs to (AdminChildGroupAdd.jsx's org picker, admin-only); an
        // org-bound staff account or Organization login always stamps its
        // own org_id instead — never trusted from the client.
        let orgId;
        if (orgScope.isSuperAdmin) {
            const requestedOrgId = req.body.org_id ? parseInt(req.body.org_id, 10) : null;
            if (!requestedOrgId) {
                return res.status(400).json({ message: 'Please select the organization this group belongs to.' });
            }
            const [orgRows] = await pool.query('SELECT id FROM organizations WHERE id = ?', [requestedOrgId]);
            if (!orgRows.length) {
                return res.status(400).json({ message: 'Selected organization not found.' });
            }
            orgId = requestedOrgId;
        } else {
            orgId = orgScope.orgId;
        }

        const [existing] = await pool.query('SELECT id FROM child_groups WHERE name = ?', [trimmedName]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'A group with this name already exists.' });
        }

        const [result] = await pool.query(
            'INSERT INTO child_groups (name, description, status, org_id) VALUES (?, ?, ?, ?)',
            [trimmedName, trimmedDescription || null, 'active', orgId]
        );

        res.status(201).json({
            message: 'Child group added successfully',
            groupId: result.insertId
        });
    } catch (error) {
        console.error('Error in addGroup:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'A group with this name already exists. (DB Constraint)' });
        }

        res.status(500).json({ message: `Server error adding child group: ${error.message || 'Unknown error'}` });
    }
};

// @desc Update a child group
// @route PUT /api/admin/child-groups/:id
exports.updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, status } = req.body;
        const { orgScope } = req;

        const trimmedName = name ? name.trim() : '';
        const trimmedDescription = description ? description.trim() : '';

        if (!trimmedName || !status) {
            return res.status(400).json({ message: 'Group name and status are mandatory.' });
        }

        const scope = scopeClause(orgScope);
        const [beforeRows] = await pool.query(
            `SELECT org_id FROM child_groups WHERE id = ? ${scope.sql ? `AND ${scope.sql}` : ''}`,
            [id, ...scope.params]
        );
        if (!beforeRows.length) return res.status(404).json({ message: 'Child group not found' });

        // Only Super Admin may reassign a group's organization
        // (AdminChildGroupEdit.jsx's org picker, admin-only); an org-bound
        // staff/Organization session keeps the group's existing org_id
        // untouched regardless of what's submitted.
        let orgId = beforeRows[0].org_id;
        if (orgScope.isSuperAdmin && req.body.org_id !== undefined) {
            const requestedOrgId = req.body.org_id ? parseInt(req.body.org_id, 10) : null;
            if (!requestedOrgId) {
                return res.status(400).json({ message: 'Please select the organization this group belongs to.' });
            }
            const [orgRows] = await pool.query('SELECT id FROM organizations WHERE id = ?', [requestedOrgId]);
            if (!orgRows.length) {
                return res.status(400).json({ message: 'Selected organization not found.' });
            }
            orgId = requestedOrgId;
        }

        const [existing] = await pool.query('SELECT id FROM child_groups WHERE name = ? AND id != ?', [trimmedName, id]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'A group with this name already exists. Please use a unique name.' });
        }

        const [result] = await pool.query(
            'UPDATE child_groups SET name = ?, description = ?, status = ?, org_id = ? WHERE id = ?',
            [trimmedName, trimmedDescription || null, status, orgId, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Child group not found' });
        }

        res.status(200).json({ message: 'Child group updated successfully' });
    } catch (error) {
        console.error('Error in updateGroup:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'A group with this name already exists. (DB Constraint)' });
        }

        res.status(500).json({ message: 'Server error updating child group' });
    }
};
