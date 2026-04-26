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
        
        // Normalize input
        const normalizedEmail = email ? email.toLowerCase().trim() : '';
        const trimmedName = name ? name.trim() : '';
        const trimmedMobile = mobile_number ? mobile_number.trim() : '';

        console.log('--- ADD ASSESSOR DEBUG ---');
        console.log('Normalized Payload:', { name: trimmedName, email: normalizedEmail, mobile_number: trimmedMobile });

        if (!trimmedName || !normalizedEmail || !trimmedMobile) {
            return res.status(400).json({ message: 'All fields are mandatory' });
        }

        // 1. Explicit Check for Email Uniqueness
        // We use binary comparison if needed, but standard SQL match should be sufficient
        const [existing] = await pool.query('SELECT id FROM assessors WHERE email = ?', [normalizedEmail]);
        console.log('Uniqueness check result:', existing);

        if (existing && existing.length > 0) {
            console.warn('Conflict: Email already exists in DB');
            return res.status(400).json({ 
                message: 'Email ID already exists. This email is already registered in the system.' 
            });
        }

        // 2. Perform Insert
        const [result] = await pool.query(
            'INSERT INTO assessors (name, email, mobile_number, status) VALUES (?, ?, ?, ?)',
            [trimmedName, normalizedEmail, trimmedMobile, 'active']
        );
        
        console.log('Insert success. New ID:', result.insertId);

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
        const { id } = req.params;
        const { name, email, mobile_number, status } = req.body;
        
        // Normalize input
        const normalizedEmail = email ? email.toLowerCase().trim() : '';
        const trimmedName = name ? name.trim() : '';
        const trimmedMobile = mobile_number ? mobile_number.trim() : '';

        console.log('--- UPDATE ASSESSOR DEBUG --- ID:', id);

        if (!trimmedName || !normalizedEmail || !trimmedMobile || !status) {
            return res.status(400).json({ message: 'All fields are mandatory' });
        }

        // Check if email belongs to someone else
        const [existing] = await pool.query('SELECT id FROM assessors WHERE email = ? AND id != ?', [normalizedEmail, id]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'Email ID already exists. Please use a unique email.' });
        }

        const [result] = await pool.query(
            'UPDATE assessors SET name = ?, email = ?, mobile_number = ?, status = ? WHERE id = ?',
            [trimmedName, normalizedEmail, trimmedMobile, status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Assessor not found' });
        }

        res.status(200).json({ message: 'Assessor updated successfully' });
    } catch (error) {
        console.error('Error in updateAssessor:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Email ID already exists. (DB Constraint)' });
        }

        res.status(500).json({ message: 'Server error updating assessor' });
    }
};


