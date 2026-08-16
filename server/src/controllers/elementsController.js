const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');
const { HERPHER_V3_TEST_ID, HERPHER_V3_IMAGE_COUNTS } = require('../config/herPherV3');

const getElements = async (req, res) => {
    try {
        const { test_id, asset_type } = req.query;
        let query = 'SELECT * FROM test_elements WHERE 1=1';
        const params = [];

        if (test_id) {
            query += ' AND test_id = ?';
            params.push(test_id);
        }
        if (asset_type) {
            query += ' AND asset_type = ?';
            params.push(asset_type);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(query, params);
        res.json({ success: true, elements: rows });
    } catch (error) {
        console.error('getElements error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch elements' });
    }
};

const getAllElementsPublic = async (req, res) => {
    try {
        const { test_id } = req.query;
        let query = 'SELECT * FROM test_elements WHERE is_active = 1';
        let params = [];
        
        if (test_id) {
            query += ' AND test_id = ?';
            params.push(test_id);
        }
        
        const [rows] = await pool.query(query, params);
        res.json({ success: true, elements: rows });
    } catch (error) {
        console.error('getAllElementsPublic error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch elements' });
    }
};

const uploadElement = async (req, res) => {
    try {
        const { test_id, asset_type, language } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        if (!test_id || !asset_type || !language) {
            // Cleanup the uploaded file if we are rejecting the request
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const file_name = req.file.originalname;
        const file_path = `/uploads/elements/${req.file.filename}`;
        
        const { replace_id } = req.body;

        // Her Pher V3's item0-item8 categories each hold an exact, fixed
        // image count (server/src/config/herPherV3.js) that can only ever
        // be provisioned by the initial seed — there is no "add a new one"
        // case, only swapping an existing image's content. Enforced here so
        // it can't be bypassed via a direct API call, not just the Admin
        // UI. Every other test_id (including this same test_id's own
        // splash_screen/audio_ rows) skips this entirely.
        if (test_id === HERPHER_V3_TEST_ID) {
            const requiredCount = HERPHER_V3_IMAGE_COUNTS[asset_type];
            if (/^item\d+$/.test(asset_type) && requiredCount === undefined) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ success: false, message: 'Invalid element for this test.' });
            }
            if (requiredCount !== undefined) {
                if (!replace_id) {
                    fs.unlinkSync(req.file.path);
                    return res.status(400).json({ success: false, message: `This element's image count is fixed at exactly ${requiredCount} — upload a replacement for an existing image instead of adding a new one.` });
                }
                // Replacing an existing image never changes the count, but
                // confirm replace_id actually belongs to this element —
                // otherwise an arbitrary id would blindly delete an
                // unrelated row (see the DELETE below).
                const [replaceRows] = await pool.query(
                    'SELECT id FROM test_elements WHERE id = ? AND test_id = ? AND asset_type = ?',
                    [replace_id, test_id, asset_type]
                );
                if (!replaceRows.length) {
                    fs.unlinkSync(req.file.path);
                    return res.status(400).json({ success: false, message: 'Cannot replace: original image not found in this element.' });
                }
            }
        }

        // Rachna's question asset_types (question3, teachingQ1, sampleA, ...)
        // are one-row-per-question, like splash_screen, but unlike splash_screen
        // that row may already carry a saved `config` (shape composition) —
        // a delete-then-insert here would silently wipe it. Update the file
        // fields in place instead, or insert fresh if no row exists yet.
        if (test_id === 'triangle_rachna' && asset_type !== 'splash_screen') {
            const [existing] = await pool.query(
                'SELECT id FROM test_elements WHERE test_id = ? AND asset_type = ? AND language = ?',
                [test_id, asset_type, language]
            );
            if (existing.length > 0) {
                await pool.query(
                    'UPDATE test_elements SET file_name = ?, file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [file_name, file_path, existing[0].id]
                );
            } else {
                await pool.query(
                    'INSERT INTO test_elements (test_id, asset_type, language, file_name, file_path) VALUES (?, ?, ?, ?, ?)',
                    [test_id, asset_type, language, file_name, file_path]
                );
            }
            return res.json({ success: true, message: 'Element uploaded successfully', file_path });
        }

        // If it is a splash screen, we act as if it replaces everything for that language.
        // For Her Pher (or other multi-image items) replacing one specific image, the old
        // row is deleted by id first — necessary because a new upload can arrive with a
        // different file_name than the row it's replacing, so a plain INSERT ... ON
        // DUPLICATE KEY UPDATE wouldn't reliably land on the same row otherwise.
        //
        // The delete and the insert below run in one transaction — previously they were
        // two independent pool.query() calls, so a dropped connection or client abort
        // between them could delete the old image and never insert its replacement,
        // permanently losing that slot (this is exactly what happened to Her Pher V3's
        // Item 4/5.png in production, discovered because V3's fixed-count invariant made
        // the gap visible — but the same risk exists for every test using this endpoint).
        const needsDelete = asset_type === 'splash_screen' || !!replace_id;
        const insertQuery = `
            INSERT INTO test_elements (test_id, asset_type, language, file_name, file_path)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                file_path = VALUES(file_path),
                updated_at = CURRENT_TIMESTAMP
        `;

        if (needsDelete) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                if (asset_type === 'splash_screen') {
                    await connection.query('DELETE FROM test_elements WHERE test_id = ? AND asset_type = ? AND language = ?', [test_id, asset_type, language]);
                } else {
                    await connection.query('DELETE FROM test_elements WHERE id = ?', [replace_id]);
                }
                await connection.query(insertQuery, [test_id, asset_type, language, file_name, file_path]);
                await connection.commit();
            } catch (txError) {
                await connection.rollback();
                throw txError;
            } finally {
                connection.release();
            }
        } else {
            await pool.query(insertQuery, [test_id, asset_type, language, file_name, file_path]);
        }

        res.json({ success: true, message: 'Element uploaded successfully', file_path });
    } catch (error) {
        console.error('uploadElement error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload element' });
    }
};

const deleteElement = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the file path to delete the physical file if it's an uploaded one
        const [rows] = await pool.query('SELECT file_path, test_id, asset_type FROM test_elements WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Element not found' });
        }

        // Her Pher V3's fixed-count elements can't be deleted — that always
        // drops the count, with no in-UI way to restore it. Use Replace.
        if (rows[0].test_id === HERPHER_V3_TEST_ID && HERPHER_V3_IMAGE_COUNTS[rows[0].asset_type] !== undefined) {
            return res.status(400).json({ success: false, message: 'This element requires a fixed image count and cannot have images deleted — use Replace instead.' });
        }

        const filePath = rows[0].file_path;

        await pool.query('DELETE FROM test_elements WHERE id = ?', [id]);

        // Only delete physical file if it was uploaded to /uploads/elements/
        // (file_path can be null for a config-only row that never had an image)
        if (filePath && filePath.startsWith('/uploads/elements/')) {
            const absolutePath = path.join(__dirname, '..', '..', filePath);
            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
            }
        }

        res.json({ success: true, message: 'Element deleted successfully' });
    } catch (error) {
        console.error('deleteElement error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete element' });
    }
};

// Upserts just the structured `config` JSON for an element (e.g. Rachna's
// per-question shape composition) — independent of the file-upload flow, so
// an admin can edit shapes without also needing to (re-)upload an image, and
// without clobbering an image that's already been uploaded for that question.
//
// Deliberately does NOT go through uploadElement's (test_id, asset_type,
// language, file_name) unique-key upsert: that key includes file_name, so
// inserting a config-only row and later uploading an image for the same
// question (or vice versa) would land on two different file_name values and
// create a *second* row instead of updating the first — the game only reads
// one row per (test_id, asset_type, language). Instead this enforces that
// same "one row per question" invariant directly: look up by
// (test_id, asset_type, language) alone, update in place if found, else
// insert a fresh config-only row (file_name='' — not NULL, since MySQL
// treats every NULL as distinct in a unique index and a NULL file_name
// would let a later image upload create a duplicate row rather than
// colliding with this one, see uploadElement's matching Rachna branch).
const updateElementConfig = async (req, res) => {
    try {
        const { test_id, asset_type, language, config } = req.body;

        if (!test_id || !asset_type || !language || config === undefined) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // question10/question15 carry Rachna's hardcoded early-exit drop-rule
        // (cumulative-score check keyed to those exact question keys in
        // proceedToNext) — deactivating either would silently disable that
        // safeguard, so it's blocked here as well as in the admin UI.
        const RACHNA_PROTECTED_KEYS = new Set(['question10', 'question15']);
        if (test_id === 'triangle_rachna' && RACHNA_PROTECTED_KEYS.has(asset_type) && config?.active === false) {
            return res.status(400).json({ success: false, message: 'This question triggers the drop-rule and cannot be deactivated' });
        }

        const [existing] = await pool.query(
            'SELECT id FROM test_elements WHERE test_id = ? AND asset_type = ? AND language = ?',
            [test_id, asset_type, language]
        );

        if (existing.length > 0) {
            await pool.query(
                'UPDATE test_elements SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [JSON.stringify(config), existing[0].id]
            );
        } else {
            await pool.query(
                "INSERT INTO test_elements (test_id, asset_type, language, file_name, config) VALUES (?, ?, ?, '', ?)",
                [test_id, asset_type, language, JSON.stringify(config)]
            );
        }

        const [rows] = await pool.query(
            'SELECT * FROM test_elements WHERE test_id = ? AND asset_type = ? AND language = ?',
            [test_id, asset_type, language]
        );

        res.json({ success: true, message: 'Config saved successfully', element: rows[0] || null });
    } catch (error) {
        console.error('updateElementConfig error:', error);
        res.status(500).json({ success: false, message: 'Failed to save config' });
    }
};

const toggleElementStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT test_id, asset_type, is_active FROM test_elements WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Element not found' });
        }
        const { test_id, asset_type, is_active } = rows[0];

        // Her Pher V3's fixed-count elements can't dip below or exceed their
        // required active count — see uploadElement's matching guard above.
        if (test_id === HERPHER_V3_TEST_ID) {
            const requiredCount = HERPHER_V3_IMAGE_COUNTS[asset_type];
            if (requiredCount !== undefined) {
                const [[{ activeCount }]] = await pool.query(
                    'SELECT COUNT(*) AS activeCount FROM test_elements WHERE test_id = ? AND asset_type = ? AND is_active = 1',
                    [test_id, asset_type]
                );
                if (is_active === 1 && activeCount <= requiredCount) {
                    return res.status(400).json({ success: false, message: `This element requires exactly ${requiredCount} images at all times — replace this image instead of disabling it.` });
                }
                if (is_active === 0 && activeCount >= requiredCount) {
                    return res.status(400).json({ success: false, message: `This element already has its required ${requiredCount} images active.` });
                }
            }
        }

        const newStatus = is_active === 1 ? 0 : 1;
        await pool.query('UPDATE test_elements SET is_active = ? WHERE id = ?', [newStatus, id]);

        res.json({ success: true, message: 'Status updated successfully', is_active: newStatus });
    } catch (error) {
        console.error('toggleElementStatus error:', error);
        res.status(500).json({ success: false, message: 'Failed to update element status' });
    }
};

module.exports = {
    getElements,
    getAllElementsPublic,
    uploadElement,
    updateElementConfig,
    deleteElement,
    toggleElementStatus
};
