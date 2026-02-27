const { pool } = require('../config/db');

// @desc    Register a child
// @route   POST /api/children/register
// @access  Public
const registerChild = async (req, res) => {
    try {
        const { name, dob, gender, mobile } = req.body;

        // Basic Validation
        if (!name || !dob || !gender || !mobile) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        if (mobile.trim().length !== 10) {
            return res.status(400).json({ message: 'Mobile number must be exactly 10 digits.' });
        }

        // Convert string to proper date just for safely
        const dobDate = new Date(dob);
        if (isNaN(dobDate.getTime())) {
            return res.status(400).json({ message: 'Invalid Date of Birth.' });
        }

        // Insert Query
        const query = `
      INSERT INTO children (name, dob, gender, mobile)
      VALUES (?, ?, ?, ?)
    `;

        const [result] = await pool.query(query, [name.trim(), dob, gender.trim(), mobile.trim()]);

        const childIdStr = 'CH' + String(result.insertId).padStart(3, '0');
        await pool.query('UPDATE children SET child_id = ? WHERE id = ?', [childIdStr, result.insertId]);

        res.status(201).json({
            message: 'Child registered successfully!',
            childId: childIdStr
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error while registering the child. Please try again later.' });
    }
};

// @desc    Lookup a child by child_id
// @route   GET /api/children/lookup/:childId
// @access  Public
const lookupChild = async (req, res) => {
    try {
        const { childId } = req.params;

        if (!childId) {
            return res.status(400).json({ message: 'Child ID is required.' });
        }

        const [rows] = await pool.query(
            'SELECT child_id, name, dob, gender, mobile FROM children WHERE child_id = ?',
            [childId.toUpperCase()]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Child ID not found.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Lookup Error:', error);
        res.status(500).json({ message: 'Server error while looking up child.' });
    }
};

module.exports = {
    registerChild,
    lookupChild
};
