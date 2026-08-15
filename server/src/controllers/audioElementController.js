const { pool } = require('../config/db');

// Admin-defined, ordered "audio slots" per test (e.g. "Splash Screen Audio",
// "Audio 1", "Audio 2"...). The actual per-language files live in
// test_elements as asset_type = 'audio_' + element_key — this controller
// only manages the slot's identity/order/fallback/status; file upload/
// delete/preview/toggle go through the existing elementsController.js
// endpoints unchanged (test_id + asset_type='audio_'+element_key + language).

const slugify = (label) => label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'audio';

// @route GET /api/admin/audio-elements?test_id=X
const getAudioElements = async (req, res) => {
    try {
        const { test_id } = req.query;
        let query = 'SELECT * FROM audio_elements WHERE 1=1';
        const params = [];
        if (test_id) { query += ' AND test_id = ?'; params.push(test_id); }
        query += ' ORDER BY display_order ASC, id ASC';
        const [rows] = await pool.query(query, params);
        res.json({ success: true, elements: rows });
    } catch (error) {
        console.error('getAudioElements error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch audio elements' });
    }
};

// @route GET /api/public/audio-elements?test_id=X
const getAudioElementsPublic = async (req, res) => {
    try {
        const { test_id } = req.query;
        let query = "SELECT * FROM audio_elements WHERE status = 'active'";
        const params = [];
        if (test_id) { query += ' AND test_id = ?'; params.push(test_id); }
        query += ' ORDER BY display_order ASC, id ASC';
        const [rows] = await pool.query(query, params);
        res.json({ success: true, elements: rows });
    } catch (error) {
        console.error('getAudioElementsPublic error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch audio elements' });
    }
};

// @route POST /api/admin/audio-elements  { test_id, label }
const addAudioElement = async (req, res) => {
    try {
        const { test_id, label } = req.body;
        if (!test_id || !label?.trim()) {
            return res.status(400).json({ success: false, message: 'test_id and label are required' });
        }

        const baseKey = slugify(label);
        let element_key = baseKey;
        let suffix = 2;
        // De-dupe within this test — 'audio_1' already taken -> 'audio_1_2', etc.
        for (;;) {
            const [existing] = await pool.query(
                'SELECT id FROM audio_elements WHERE test_id = ? AND element_key = ?',
                [test_id, element_key]
            );
            if (!existing.length) break;
            element_key = `${baseKey}_${suffix++}`;
        }

        const [[{ maxOrder }]] = await pool.query(
            'SELECT COALESCE(MAX(display_order), -1) AS maxOrder FROM audio_elements WHERE test_id = ?',
            [test_id]
        );

        const [result] = await pool.query(
            'INSERT INTO audio_elements (test_id, element_key, label, display_order) VALUES (?, ?, ?, ?)',
            [test_id, element_key, label.trim(), maxOrder + 1]
        );

        res.json({ success: true, message: 'Audio element added', id: result.insertId, element_key });
    } catch (error) {
        console.error('addAudioElement error:', error);
        res.status(500).json({ success: false, message: 'Failed to add audio element' });
    }
};

// @route PUT /api/admin/audio-elements/:id  { label?, display_order?, fallback_language?, status? }
const updateAudioElement = async (req, res) => {
    try {
        const { id } = req.params;
        const { label, display_order, fallback_language, status } = req.body;

        const fields = [];
        const params = [];
        if (label !== undefined) { fields.push('label = ?'); params.push(label.trim()); }
        if (display_order !== undefined) { fields.push('display_order = ?'); params.push(display_order); }
        if (fallback_language !== undefined) { fields.push('fallback_language = ?'); params.push(fallback_language || null); }
        if (status !== undefined) {
            if (!['active', 'inactive'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Status must be "active" or "inactive"' });
            }
            fields.push('status = ?'); params.push(status);
        }
        if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });

        params.push(id);
        const [result] = await pool.query(`UPDATE audio_elements SET ${fields.join(', ')} WHERE id = ?`, params);
        if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Audio element not found' });

        res.json({ success: true, message: 'Audio element updated' });
    } catch (error) {
        console.error('updateAudioElement error:', error);
        res.status(500).json({ success: false, message: 'Failed to update audio element' });
    }
};

// @route DELETE /api/admin/audio-elements/:id
// Cascades: removes every language's uploaded file for this slot (DB rows +
// physical files under /uploads/elements/) before removing the slot itself,
// mirroring elementsController.deleteElement's own cleanup convention.
const deleteAudioElement = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT test_id, element_key FROM audio_elements WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Audio element not found' });
        const { test_id, element_key } = rows[0];
        const assetType = `audio_${element_key}`;

        const fs = require('fs');
        const path = require('path');
        const [fileRows] = await pool.query(
            'SELECT file_path FROM test_elements WHERE test_id = ? AND asset_type = ?',
            [test_id, assetType]
        );
        for (const f of fileRows) {
            if (f.file_path && f.file_path.startsWith('/uploads/elements/')) {
                const absolutePath = path.join(__dirname, '..', '..', f.file_path);
                if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
            }
        }
        await pool.query('DELETE FROM test_elements WHERE test_id = ? AND asset_type = ?', [test_id, assetType]);
        await pool.query('DELETE FROM audio_elements WHERE id = ?', [id]);

        res.json({ success: true, message: 'Audio element deleted' });
    } catch (error) {
        console.error('deleteAudioElement error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete audio element' });
    }
};

module.exports = { getAudioElements, getAudioElementsPublic, addAudioElement, updateAudioElement, deleteAudioElement };
