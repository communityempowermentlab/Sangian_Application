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
        const { child_id, name, dob, gender, mobile } = req.body;

        if (!child_id || !name || !dob || !gender || !mobile) {
            // Clean up any uploaded file on validation failure
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'All fields are required.' });
        }
        
        // Check if child_id already exists
        const [existing] = await pool.query('SELECT id FROM children WHERE child_id = ?', [child_id.trim()]);
        if (existing.length > 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Child ID already exists. Please choose a unique ID.' });
        }

        const [result] = await pool.query(
            'INSERT INTO children (child_id, name, dob, gender, mobile, status) VALUES (?, ?, ?, ?, ?, ?)',
            [child_id.trim(), name.trim(), dob, gender.trim(), mobile.trim(), 'active']
        );

        const childIdStr = child_id.trim();

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
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { childId } = req.params;
        const { new_child_id, name, dob, gender, mobile, status } = req.body;

        const [oldRecord] = await connection.query('SELECT id, child_id, name, dob, gender, mobile, status, photo FROM children WHERE child_id = ?', [childId]);
        if (oldRecord.length === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            await connection.rollback();
            return res.status(404).json({ message: 'Child ID not found.' });
        }
        const oldData = oldRecord[0];

        if (!name || !dob || !gender || !mobile || !status) {
            if (req.file) fs.unlinkSync(req.file.path);
            await connection.rollback();
            return res.status(400).json({ message: 'All fields are required.' });
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
                'UPDATE children SET child_id = ?, name = ?, dob = ?, gender = ?, mobile = ?, status = ? WHERE child_id = ?',
                [trimmedNewId, name.trim(), dob, gender.trim(), mobile.trim(), status, childId]
            );

            if (result.affectedRows === 0) {
                if (req.file) fs.unlinkSync(req.file.path);
                await connection.rollback();
                return res.status(404).json({ message: 'Child ID not found.' });
            }

            targetChildId = trimmedNewId;
        } else {
            const [result] = await connection.query(
                'UPDATE children SET name = ?, dob = ?, gender = ?, mobile = ?, status = ? WHERE child_id = ?',
                [name.trim(), dob, gender.trim(), mobile.trim(), status, childId]
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
        if (req.file && newFilename !== oldData.photo) {
            logs.push(['Photo', oldData.photo || 'None', newFilename]);
        }

        for (const log of logs) {
            await connection.query(
                'INSERT INTO child_profile_edit_logs (children_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [oldData.id, log[0], log[1], log[2], adminId, adminName, ipAddress]
            );
        }

        await connection.commit();
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

// @route   GET /api/admin/children/:childId/logs
exports.getChildLogs = async (req, res) => {
    try {
        const { childId } = req.params;
        const [logs] = await pool.query(
            `SELECT l.id, l.field_name, l.old_value, l.new_value, l.updated_by_name, l.ip_address, l.action_type, l.created_at
             FROM child_profile_edit_logs l
             JOIN children c ON l.children_id = c.id
             WHERE c.child_id = ? ORDER BY l.created_at DESC`,
            [childId]
        );
        res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching child edit logs:', error);
        res.status(500).json({ message: 'Server error while fetching edit logs.' });
    }
};
