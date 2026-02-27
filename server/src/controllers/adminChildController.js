const { pool } = require('../config/db');

// @route   GET /api/admin/children
// @desc    Get all children (with pagination/search placeholders)
// @access  Private (Admin)
exports.getAllChildren = async (req, res) => {
    try {
        const [children] = await pool.query(
            'SELECT child_id, name, dob, gender, mobile, status, created_at FROM children ORDER BY created_at DESC'
        );
        res.status(200).json(children);
    } catch (error) {
        console.error('Error fetching children for admin:', error);
        res.status(500).json({ message: 'Server error while fetching children.' });
    }
};

// @route   POST /api/admin/children
// @desc    Add a new child (Admin panel)
// @access  Private (Admin)
exports.addChild = async (req, res) => {
    try {
        const { name, dob, gender, mobile } = req.body;

        if (!name || !dob || !gender || !mobile) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Insert new child with a temporary null or placeholder ID, we will update it immediately
        const [result] = await pool.query(
            'INSERT INTO children (name, dob, gender, mobile, status) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), dob, gender.trim(), mobile.trim(), 'active']
        );

        // Generate CH00X sequential ID logic (mirrored from childController)
        const childIdStr = 'CH' + String(result.insertId).padStart(3, '0');
        await pool.query('UPDATE children SET child_id = ? WHERE id = ?', [childIdStr, result.insertId]);

        res.status(201).json({
            message: 'Child registered successfully by Admin.',
            child_id: childIdStr
        });
    } catch (error) {
        console.error('Registration Error by Admin:', error);
        res.status(500).json({ message: 'Server error during child registration.' });
    }
};

// @route   GET /api/admin/children/:childId
// @desc    Get a single child's details for editing
// @access  Private (Admin)
exports.getChildById = async (req, res) => {
    try {
        const { childId } = req.params;
        const [rows] = await pool.query(
            'SELECT child_id, name, dob, gender, mobile, status FROM children WHERE child_id = ?',
            [childId]
        );

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
// @desc    Update a child's details (including status)
// @access  Private (Admin)
exports.updateChild = async (req, res) => {
    try {
        const { childId } = req.params;
        const { name, dob, gender, mobile, status } = req.body;

        if (!name || !dob || !gender || !mobile || !status) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const [result] = await pool.query(
            'UPDATE children SET name = ?, dob = ?, gender = ?, mobile = ?, status = ? WHERE child_id = ?',
            [name.trim(), dob, gender.trim(), mobile.trim(), status, childId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Child ID not found.' });
        }

        res.status(200).json({ message: 'Child updated successfully.' });
    } catch (error) {
        console.error('Error updating child:', error);
        res.status(500).json({ message: 'Server error while updating child details.' });
    }
};

// @route   PUT /api/admin/children/:childId/status
// @desc    Toggle child active/inactive status
// @access  Private (Admin)
exports.toggleStatus = async (req, res) => {
    try {
        const { childId } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const [result] = await pool.query(
            'UPDATE children SET status = ? WHERE child_id = ?',
            [status, childId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Child ID not found.' });
        }

        res.status(200).json({ message: `Child status updated to ${status}.` });
    } catch (error) {
        console.error('Error updating child status:', error);
        res.status(500).json({ message: 'Server error while updating status.' });
    }
};
