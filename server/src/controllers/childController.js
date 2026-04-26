const { pool }       = require('../config/db');
const path           = require('path');
const fs             = require('fs');
const { UPLOAD_DIR } = require('../middleware/upload');

const finalizePhoto = (tmpFile, childId) => {
    const ext         = path.extname(tmpFile.filename);
    const newFilename = `${childId}_${Date.now()}${ext}`;
    const newPath     = path.join(UPLOAD_DIR, newFilename);
    fs.renameSync(tmpFile.path, newPath);
    return newFilename;
};

// @desc    Register a child
// @route   POST /api/children/register
// @access  Public
const registerChild = async (req, res) => {
    try {
        const { name, dob, gender, mobile } = req.body;

        // Basic Validation
        if (!name || !dob || !gender || !mobile) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'All fields are required.' });
        }

        if (mobile.trim().length !== 10) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Mobile number must be exactly 10 digits.' });
        }

        const dobDate = new Date(dob);
        if (isNaN(dobDate.getTime())) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Invalid Date of Birth.' });
        }

        const [result] = await pool.query(
            'INSERT INTO children (name, dob, gender, mobile) VALUES (?, ?, ?, ?)',
            [name.trim(), dob, gender.trim(), mobile.trim()]
        );

        const childIdStr = 'CH' + String(result.insertId).padStart(3, '0');
        await pool.query('UPDATE children SET child_id = ? WHERE id = ?', [childIdStr, result.insertId]);

        // Optional photo upload
        if (req.file) {
            const photoFilename = finalizePhoto(req.file, childIdStr);
            await pool.query('UPDATE children SET photo = ? WHERE child_id = ?', [photoFilename, childIdStr]);
        }

        res.status(201).json({
            message: 'Child registered successfully!',
            childId: childIdStr,
        });

    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
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
            'SELECT child_id, name, dob, gender, mobile, status, photo FROM children WHERE child_id = ?',
            [childId.toUpperCase()]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Child ID not found.' });
        }

        const child = rows[0];

        // Block lookup if child is deactivated
        if (child.status === 'inactive') {
            return res.status(403).json({
                message: 'Account deactivated. Please contact an administrator.',
                isInactive: true
            });
        }

        res.status(200).json(child);
    } catch (error) {
        console.error('Lookup Error:', error);
        res.status(500).json({ message: 'Server error while looking up child.' });
    }
};

module.exports = {
    registerChild,
    lookupChild
};
