const { pool } = require('../config/db');

// @desc Get all assessors
// @route GET /api/admin/assessors
exports.getAllAssessors = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM assessors ORDER BY created_at DESC');
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
        const [rows] = await pool.query('SELECT * FROM assessors WHERE id = ?', [id]);
        
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
        const { name, email, mobile_number } = req.body;
        console.log('--- ADD ASSESSOR DEBUG ---');
        console.log('Payload:', { name, email, mobile_number });

        if (!name || !email || !mobile_number) {
            return res.status(400).json({ message: 'All fields are mandatory' });
        }

        // Check if email already exists
        const [existing] = await pool.query('SELECT id FROM assessors WHERE email = ?', [email]);
        console.log('Query result for email:', email, 'Count:', existing.length);

        if (existing.length > 0) {
            console.warn('Conflict detected: Email already exists');
            return res.status(400).json({ 
                message: 'Email ID already exists. This email is already registered. (Code: 0950)' 
            });
        }

        const [result] = await pool.query(
            'INSERT INTO assessors (name, email, mobile_number, status) VALUES (?, ?, ?, ?)',
            [name, email, mobile_number, 'active']
        );
        console.log('Insert success. ID:', result.insertId);

        res.status(201).json({
            message: 'Assessor added successfully',
            assessorId: result.insertId
        });
    } catch (error) {
        console.error('Error adding assessor:', error);
        res.status(500).json({ message: 'Server error adding assessor (Code: 0950)' });
    }
};

// @desc Update an assessor
// @route PUT /api/admin/assessors/:id
exports.updateAssessor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, mobile_number, status } = req.body;
        console.log('--- UPDATE ASSESSOR DEBUG ---', id);

        if (!name || !email || !mobile_number || !status) {
            return res.status(400).json({ message: 'All fields are mandatory' });
        }

        // Check if email belongs to someone else
        const [existing] = await pool.query('SELECT id FROM assessors WHERE email = ? AND id != ?', [email, id]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email ID already exists. (Code: 0950)' });
        }

        const [result] = await pool.query(
            'UPDATE assessors SET name = ?, email = ?, mobile_number = ?, status = ? WHERE id = ?',
            [name, email, mobile_number, status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Assessor not found' });
        }

        res.status(200).json({ message: 'Assessor updated successfully' });
    } catch (error) {
        console.error('Error updating assessor:', error);
        res.status(500).json({ message: 'Server error updating assessor' });
    }
};


