const { pool } = require('../config/db');
const path = require('path');
const fs   = require('fs');

// ─── Upload Screenshot ────────────────────────────────────────────────────────
exports.uploadScreenshot = async (req, res) => {
  try {
    const { game_key, language, screen_type, title, description, sort_order } = req.body;
    if (!req.file)     return res.status(400).json({ success: false, message: 'No file uploaded' });
    if (!game_key)     return res.status(400).json({ success: false, message: 'game_key is required' });
    if (!title)        return res.status(400).json({ success: false, message: 'title is required' });

    const image_path = `/uploads/screenshots/${req.file.filename}`;

    await pool.query(
      `INSERT INTO screenshot_library (game_key, language, screen_type, title, description, image_path, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [game_key, language || 'en', screen_type || 'gameplay', title, description || '', image_path, parseInt(sort_order) || 0]
    );

    await _markNeedsRepublish(game_key, language || 'en');
    res.json({ success: true, message: 'Screenshot uploaded successfully' });
  } catch (e) {
    console.error('uploadScreenshot error:', e);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
};

// ─── List Screenshots ─────────────────────────────────────────────────────────
exports.getScreenshots = async (req, res) => {
  try {
    const { game_key, language, publish_status } = req.query;
    let q = 'SELECT * FROM screenshot_library WHERE 1=1';
    const params = [];
    if (game_key)       { q += ' AND game_key = ?';       params.push(game_key); }
    if (language)       { q += ' AND language = ?';       params.push(language); }
    if (publish_status) { q += ' AND publish_status = ?'; params.push(publish_status); }
    q += ' ORDER BY sort_order ASC, created_at ASC';

    const [rows] = await pool.query(q, params);
    res.json({ success: true, screenshots: rows });
  } catch (e) {
    console.error('getScreenshots error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch screenshots' });
  }
};

// ─── Update Screenshot Metadata ───────────────────────────────────────────────
exports.updateScreenshot = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, screen_type, sort_order, language, publish_status } = req.body;

    const setClauses = [];
    const params = [];

    if (title          !== undefined) { setClauses.push('title = ?');          params.push(title); }
    if (description    !== undefined) { setClauses.push('description = ?');    params.push(description); }
    if (screen_type    !== undefined) { setClauses.push('screen_type = ?');    params.push(screen_type); }
    if (sort_order     !== undefined) { setClauses.push('sort_order = ?');     params.push(parseInt(sort_order)); }
    if (language       !== undefined) { setClauses.push('language = ?');       params.push(language); }
    if (publish_status !== undefined) { setClauses.push('publish_status = ?'); params.push(publish_status); }

    if (req.file) {
      setClauses.push('image_path = ?');
      params.push(`/uploads/screenshots/${req.file.filename}`);
    }

    if (setClauses.length === 0) return res.json({ success: true });

    params.push(id);
    await pool.query(`UPDATE screenshot_library SET ${setClauses.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.query('SELECT game_key, language FROM screenshot_library WHERE id = ?', [id]);
    if (rows[0]) await _markNeedsRepublish(rows[0].game_key, rows[0].language);

    res.json({ success: true });
  } catch (e) {
    console.error('updateScreenshot error:', e);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// ─── Delete Screenshot ────────────────────────────────────────────────────────
exports.deleteScreenshot = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM screenshot_library WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Not found' });

    // Remove file from disk
    const filePath = path.join(__dirname, '../../../', rows[0].image_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query('DELETE FROM screenshot_library WHERE id = ?', [id]);
    await _markNeedsRepublish(rows[0].game_key, rows[0].language);

    res.json({ success: true });
  } catch (e) {
    console.error('deleteScreenshot error:', e);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
};

// ─── Reorder Screenshots ──────────────────────────────────────────────────────
exports.reorderScreenshots = async (req, res) => {
  try {
    const { ordered_ids } = req.body;
    if (!Array.isArray(ordered_ids)) return res.status(400).json({ success: false });
    for (let i = 0; i < ordered_ids.length; i++) {
      await pool.query('UPDATE screenshot_library SET sort_order = ? WHERE id = ?', [i, ordered_ids[i]]);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
};

// ─── Publish Manual ───────────────────────────────────────────────────────────
exports.publishManual = async (req, res) => {
  try {
    const { game_key, language } = req.body;
    if (!game_key || !language) return res.status(400).json({ success: false, message: 'game_key and language required' });

    // Mark all screenshots as published
    await pool.query(
      `UPDATE screenshot_library SET publish_status = 'published' WHERE game_key = ? AND language = ?`,
      [game_key, language]
    );

    const [[{ cnt }]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM screenshot_library WHERE game_key = ? AND language = ? AND publish_status = 'published'`,
      [game_key, language]
    );

    await pool.query(
      `INSERT INTO game_manual_publish_status (game_key, language, published_at, screenshot_count, needs_republish)
       VALUES (?, ?, NOW(), ?, 0)
       ON DUPLICATE KEY UPDATE published_at = NOW(), screenshot_count = ?, needs_republish = 0`,
      [game_key, language, cnt, cnt]
    );

    res.json({ success: true, message: 'Manual published successfully', screenshot_count: cnt });
  } catch (e) {
    console.error('publishManual error:', e);
    res.status(500).json({ success: false, message: 'Publish failed' });
  }
};

// ─── Get Manual Publish Status (all games × languages) ───────────────────────
exports.getManualStatus = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM game_manual_publish_status');
    res.json({ success: true, statuses: rows });
  } catch (e) {
    res.status(500).json({ success: false, statuses: [] });
  }
};

// ─── Internal helper ─────────────────────────────────────────────────────────
async function _markNeedsRepublish(game_key, language) {
  await pool.query(
    `INSERT INTO game_manual_publish_status (game_key, language, needs_republish)
     VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE needs_republish = 1`,
    [game_key, language]
  );
}
