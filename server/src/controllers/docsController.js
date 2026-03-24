const pool = require('../config/db');

// ─── Get current document for a game key ─────────────────────────────────────
exports.getDoc = async (req, res) => {
    try {
        const { gameKey } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM game_documents WHERE game_key = ?',
            [gameKey]
        );
        if (rows.length === 0) {
            return res.status(200).json({ success: true, doc: null });
        }
        res.status(200).json({ success: true, doc: rows[0] });
    } catch (err) {
        console.error('getDoc error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── Save (create or update) document for a game key ─────────────────────────
exports.saveDoc = async (req, res) => {
    try {
        const { gameKey } = req.params;
        const { content, saved_by } = req.body;

        if (!content) return res.status(400).json({ success: false, message: 'Content is required' });

        // Archive current version before overwriting
        const [existing] = await pool.query(
            'SELECT content FROM game_documents WHERE game_key = ?',
            [gameKey]
        );
        if (existing.length > 0 && existing[0].content) {
            await pool.query(
                'INSERT INTO game_document_versions (game_key, content, saved_by) VALUES (?, ?, ?)',
                [gameKey, existing[0].content, saved_by || 'admin']
            );
        }

        // Upsert the main document
        await pool.query(
            `INSERT INTO game_documents (game_key, content, updated_by)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE content = VALUES(content), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
            [gameKey, content, saved_by || 'admin']
        );

        res.status(200).json({ success: true, message: 'Document saved successfully' });
    } catch (err) {
        console.error('saveDoc error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── Get version history list for a game key ─────────────────────────────────
exports.getVersions = async (req, res) => {
    try {
        const { gameKey } = req.params;
        const [rows] = await pool.query(
            'SELECT id, game_key, saved_by, saved_at FROM game_document_versions WHERE game_key = ? ORDER BY saved_at DESC',
            [gameKey]
        );
        res.status(200).json({ success: true, versions: rows });
    } catch (err) {
        console.error('getVersions error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── Get specific version content ────────────────────────────────────────────
exports.getVersion = async (req, res) => {
    try {
        const { versionId } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM game_document_versions WHERE id = ?',
            [versionId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Version not found' });
        }
        res.status(200).json({ success: true, version: rows[0] });
    } catch (err) {
        console.error('getVersion error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
