const { pool } = require('../config/db');

// @desc Get all child groups (with member counts)
// @route GET /api/admin/child-groups
exports.getAllGroups = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT cg.*,
                   (SELECT COUNT(*) FROM child_group_members cgm WHERE cgm.group_id = cg.id) AS member_count
            FROM child_groups cg
            ORDER BY cg.name
        `);
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
        const [rows] = await pool.query('SELECT * FROM child_groups WHERE id = ?', [id]);

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

        const trimmedName = name ? name.trim() : '';
        const trimmedDescription = description ? description.trim() : '';

        if (!trimmedName) {
            return res.status(400).json({ message: 'Group name is required.' });
        }

        const [existing] = await pool.query('SELECT id FROM child_groups WHERE name = ?', [trimmedName]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'A group with this name already exists.' });
        }

        const [result] = await pool.query(
            'INSERT INTO child_groups (name, description, status) VALUES (?, ?, ?)',
            [trimmedName, trimmedDescription || null, 'active']
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

        const trimmedName = name ? name.trim() : '';
        const trimmedDescription = description ? description.trim() : '';

        if (!trimmedName || !status) {
            return res.status(400).json({ message: 'Group name and status are mandatory.' });
        }

        const [existing] = await pool.query('SELECT id FROM child_groups WHERE name = ? AND id != ?', [trimmedName, id]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'A group with this name already exists. Please use a unique name.' });
        }

        const [result] = await pool.query(
            'UPDATE child_groups SET name = ?, description = ?, status = ? WHERE id = ?',
            [trimmedName, trimmedDescription || null, status, id]
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
