const { pool }       = require('../config/db');
const path           = require('path');
const fs             = require('fs');
const { UPLOAD_DIR } = require('../middleware/upload');
const { checkChildEligibility } = require('../utils/validateAssessorChild');

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
        const { child_id, name, dob, gender, mobile, father_name, mother_name } = req.body;

        // Basic Validation
        if (!name || !dob || !gender || !mobile || !father_name || !mother_name) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Name, date of birth, gender, mobile, father name, and mother name are required.' });
        }
        
        if (father_name.trim().length > 225 || mother_name.trim().length > 225) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Father name and Mother name cannot exceed 225 characters.' });
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

        // Check uniqueness
        if (child_id) {
            const [existing] = await pool.query('SELECT id FROM children WHERE child_id = ?', [child_id.trim()]);
            if (existing.length > 0) {
                if (req.file) fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Child ID already exists. Please choose a unique ID.' });
            }
        }

        const remarks = req.body.remarks || '';
        const gram_sabha = req.body.gram_sabha || '';
        const hamlet = req.body.hamlet || '';

        // Optional org_id — e.g. a per-organization public registration
        // link (?org_id=5). This endpoint is unauthenticated, so the value
        // is never trusted at face value: it's only honored when it names
        // an existing, approved organization; otherwise the child is
        // registered exactly as before (org_id NULL), preserving today's
        // default self-registration flow unchanged.
        let orgId = null;
        if (req.body.org_id) {
            const [orgRows] = await pool.query(
                "SELECT id FROM organizations WHERE id = ? AND registration_status = 'approved'",
                [req.body.org_id]
            );
            if (orgRows.length) orgId = orgRows[0].id;
        }

        const [result] = await pool.query(
            'INSERT INTO children (child_id, name, dob, gender, mobile, father_name, mother_name, remarks, gram_sabha, hamlet, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [child_id ? child_id.trim() : null, name.trim(), dob, gender.trim(), mobile.trim(), father_name.trim(), mother_name.trim(), remarks.trim(), gram_sabha.trim(), hamlet.trim(), orgId]
        );

        const childIdStr = child_id ? child_id.trim() : result.insertId.toString();

        // Optional photo upload
        if (req.file) {
            const photoFilename = finalizePhoto(req.file, childIdStr);
            await pool.query('UPDATE children SET photo = ? WHERE child_id = ?', [photoFilename, childIdStr]);
        }

        console.log('Registration Success:', { insertId: result.insertId, childId: childIdStr });
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

        const normalizedId = childId.toUpperCase();

        // Child Selection checkpoint (see the Assessor spec's "Child Status
        // Validation During Assessment") — validates existence, Active
        // status, and organization association in one place, shared with
        // the re-validation at Start Assessment (sessionController.js).
        // This route is gated behind assessorAuth (childRoutes.js), so
        // req.assessor is always set here.
        const eligibility = await checkChildEligibility(normalizedId, req.assessor.id);
        if (!eligibility.ok) {
            return res.status(eligibility.code).json({ message: eligibility.message, eligible: false });
        }

        const [rows] = await pool.query(
            'SELECT child_id, name, dob, gender, mobile, status, photo FROM children WHERE child_id = ?',
            [normalizedId]
        );
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
