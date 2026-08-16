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

        // Replacing one specific image (Her Pher and any other multi-image item) updates
        // that exact row's file_path IN PLACE, by id — it deliberately never touches
        // file_name. The row's file_name is its stable slot identity (e.g. "5.png"
        // always means "the 5th slot" from then on, regardless of what the admin's own
        // local file happens to be called); the admin listing also sorts by created_at,
        // so an in-place update keeps a replaced image from jumping to the front of the
        // list the way a fresh insert would.
        //
        // This isn't just tidiness: the table's uniqueness is (test_id, asset_type,
        // language, file_name), so the previous delete-then-insert-with-the-uploaded-
        // file's-own-name approach meant uploading a locally-named "5.png" to replace
        // some OTHER slot would silently UPDATE the real "5.png" row instead of the
        // slot actually being replaced (ON DUPLICATE KEY UPDATE matching on that
        // coincidental name collision) — deleting the intended slot's row with nothing
        // ever inserted in its place, and overwriting an unrelated slot's image. This is
        // exactly what a user reported after finding Her Pher V3 categories intermittently
        // short by one image. Matching by id side-steps file_name entirely, so a same-
        // named local file can never collide with a different slot again.
        if (replace_id) {
            await pool.query('UPDATE test_elements SET file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [file_path, replace_id]);
            return res.json({ success: true, message: 'Element uploaded successfully', file_path });
        }

        // If it is a splash screen, we act as if it replaces everything for that language —
        // delete+insert run in one transaction (previously two independent pool.query()
        // calls, so a dropped connection between them could delete the old splash image
        // and never insert its replacement).
        const insertQuery = `
            INSERT INTO test_elements (test_id, asset_type, language, file_name, file_path)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                file_path = VALUES(file_path),
                updated_at = CURRENT_TIMESTAMP
        `;

        if (asset_type === 'splash_screen') {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                await connection.query('DELETE FROM test_elements WHERE test_id = ? AND asset_type = ? AND language = ?', [test_id, asset_type, language]);
                await connection.query(insertQuery, [test_id, asset_type, language, file_name, file_path]);
                await connection.commit();
            } catch (txError) {
                await connection.rollback();
                throw txError;
            } finally {
                connection.release();
            }
        } else {
            // Plain "Add" (a genuinely new row, no replace_id — only reachable for
            // non-strict tests; Her Pher V3 always requires replace_id). Stores the
            // multer-generated filename rather than the admin's own local file_name:
            // guarantees this INSERT always lands as a distinct new row and can never
            // silently collide with — and overwrite — an unrelated existing image that
            // happens to share the same original local filename (same class of bug as
            // the replace path above, for the same unique key).
            await pool.query(insertQuery, [test_id, asset_type, language, req.file.filename, file_path]);
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

        // q1/q2/q3 carry rover_mela's hardcoded clinical drop-out rule (their
        // scores are read directly in ChaloMelaChaleGame.jsx's Next-button
        // handler) — deactivating any of them would silently be scored as 0
        // there, wrongly biasing the drop-rule. Locked here as well as in
        // the admin UI (MelaElements.jsx never renders a toggle for these).
        const MELA_PROTECTED_KEYS = new Set(['q1', 'q2', 'q3']);
        if (test_id === 'rover_mela' && MELA_PROTECTED_KEYS.has(asset_type) && config?.active === false) {
            return res.status(400).json({ success: false, message: 'This question feeds the clinical drop-out rule and cannot be deactivated' });
        }

        // Bagiya's 13 main screens form a cumulative recall chain — a later
        // screen quizzes items whose names were only ever introduced by a
        // specific earlier screen, and 4 screens carry score-based early-exit
        // safety checkpoints keyed to their screen number. Arbitrary
        // deactivation could silently produce an invalid test or skip a
        // safety check, so this test can only be SHORTENED FROM THE END:
        // the active set must always stay a contiguous prefix {1..K}, and
        // Screen 1 can never be turned off. Screen 12 stands in for the
        // combined Screens 12-13 unit (13 has no separate config — it's
        // "12, continued", see AtlantisBagiyaGame.jsx).
        const BAGIYA_SCREEN_KEY = /^screen_(1[0-2]|[1-9])$/;
        if (test_id === 'atlantis_bagiya' && BAGIYA_SCREEN_KEY.test(asset_type)) {
            const screenNum = parseInt(asset_type.slice('screen_'.length), 10);
            const isDeactivating = config?.active === false;

            if (isDeactivating && screenNum === 1) {
                return res.status(400).json({ success: false, message: 'Screen 1 cannot be turned off — Bagiya must always have at least one active screen.' });
            }

            const [screenRows] = await pool.query(
                "SELECT asset_type, config FROM test_elements WHERE test_id = ? AND asset_type LIKE 'screen\\_%' AND language = ?",
                [test_id, language]
            );
            const activeMap = {};
            for (let n = 1; n <= 12; n++) activeMap[n] = true;
            for (const row of screenRows) {
                const n = parseInt(row.asset_type.slice('screen_'.length), 10);
                const rowConfig = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
                if (rowConfig?.active === false) activeMap[n] = false;
            }

            if (isDeactivating) {
                const laterActive = Object.keys(activeMap).some(n => Number(n) > screenNum && activeMap[n]);
                if (laterActive) {
                    return res.status(400).json({ success: false, message: 'Bagiya can only be shortened from the end — deactivate the last active screen first, then work backward.' });
                }
            } else {
                const earlierInactive = Object.keys(activeMap).some(n => Number(n) < screenNum && !activeMap[n]);
                if (earlierInactive) {
                    return res.status(400).json({ success: false, message: 'Bagiya can only be re-extended from the end — activate the earlier deactivated screens first.' });
                }
            }
        }

        // Chor's 11 items are asset_type 'item1'..'item11'. checkDropCondition
        // in ChorMachayeShorGame.jsx adapts to whichever items were actually
        // played (not keyed to fixed ids), so unlike Rachna/Mela there's no
        // item-specific protection needed here — only the universal "a test
        // needs at least one active item" sanity check.
        const CHOR_ITEM_KEYS = Array.from({ length: 11 }, (_, i) => `item${i + 1}`);
        if (test_id === 'cognitive_flex_chor' && CHOR_ITEM_KEYS.includes(asset_type) && config?.active === false) {
            const [itemRows] = await pool.query(
                'SELECT asset_type, config FROM test_elements WHERE test_id = ? AND asset_type IN (?) AND language = ?',
                [test_id, CHOR_ITEM_KEYS, language]
            );
            const activeCount = CHOR_ITEM_KEYS.reduce((count, key) => {
                if (key === asset_type) return count; // the one being deactivated by this request
                const row = itemRows.find(r => r.asset_type === key);
                const rowConfig = row ? (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) : null;
                return count + (rowConfig?.active !== false ? 1 : 0);
            }, 0);
            if (activeCount === 0) {
                return res.status(400).json({ success: false, message: 'At least one item must remain active — cannot deactivate the last remaining active item.' });
            }
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
