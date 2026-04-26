const { pool }   = require('../config/db');
const path       = require('path');
const fs         = require('fs');
const { UPLOAD_DIR } = require('../middleware/upload');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Rename the temp upload file to <childId>_<ts>.<ext> and return the new filename. */
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

// ── Controllers ───────────────────────────────────────────────────────────────

// @route   GET /api/admin/children
exports.getAllChildren = async (req, res) => {
    try {
        const [children] = await pool.query(`
            SELECT c.child_id, c.name, c.dob, c.gender, c.mobile, c.status, c.photo, c.created_at,
                   (SELECT login_time FROM login_sessions ls
                    WHERE ls.child_id = c.child_id AND ls.status = 'success'
                    ORDER BY login_time DESC LIMIT 1) AS last_login
            FROM children c
            ORDER BY c.created_at DESC
        `);
        res.status(200).json(children);
    } catch (error) {
        console.error('Error fetching children for admin:', error);
        res.status(500).json({ message: 'Server error while fetching children.' });
    }
};

// @route   POST /api/admin/children
exports.addChild = async (req, res) => {
    try {
        const { name, dob, gender, mobile } = req.body;

        if (!name || !dob || !gender || !mobile) {
            // Clean up any uploaded file on validation failure
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const [result] = await pool.query(
            'INSERT INTO children (name, dob, gender, mobile, status) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), dob, gender.trim(), mobile.trim(), 'active']
        );

        const childIdStr = 'CH' + String(result.insertId).padStart(3, '0');
        await pool.query('UPDATE children SET child_id = ? WHERE id = ?', [childIdStr, result.insertId]);

        // Handle photo upload
        let photoFilename = null;
        if (req.file) {
            photoFilename = finalizePhoto(req.file, childIdStr);
            await pool.query('UPDATE children SET photo = ? WHERE child_id = ?', [photoFilename, childIdStr]);
        }

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
        const [rows] = await pool.query(
            'SELECT child_id, name, dob, gender, mobile, status, photo FROM children WHERE child_id = ?',
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
exports.updateChild = async (req, res) => {
    try {
        const { childId } = req.params;
        const { name, dob, gender, mobile, status } = req.body;

        if (!name || !dob || !gender || !mobile || !status) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const [result] = await pool.query(
            'UPDATE children SET name = ?, dob = ?, gender = ?, mobile = ?, status = ? WHERE child_id = ?',
            [name.trim(), dob, gender.trim(), mobile.trim(), status, childId]
        );

        if (result.affectedRows === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: 'Child ID not found.' });
        }

        // Handle photo replacement
        if (req.file) {
            // Delete the old photo file first
            const [current] = await pool.query('SELECT photo FROM children WHERE child_id = ?', [childId]);
            deletePhoto(current[0]?.photo);

            const newFilename = finalizePhoto(req.file, childId);
            await pool.query('UPDATE children SET photo = ? WHERE child_id = ?', [newFilename, childId]);
        }

        res.status(200).json({ message: 'Child updated successfully.' });
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        console.error('Error updating child:', error);
        res.status(500).json({ message: 'Server error while updating child details.' });
    }
};

// @route   PUT /api/admin/children/:childId/status
exports.toggleStatus = async (req, res) => {
    try {
        const { childId } = req.params;
        const { status }  = req.body;

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

// @route   GET /api/admin/children/:childId/sessions
exports.getChildSessions = async (req, res) => {
    try {
        const { childId } = req.params;
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
