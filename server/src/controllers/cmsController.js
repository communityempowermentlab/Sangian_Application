const { pool } = require('../config/db');

const getPage = async (req, res) => {
    const { page_key } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM cms_pages WHERE page_key = ?', [page_key]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Page not found' });
        res.json({ success: true, page: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updatePage = async (req, res) => {
    const { page_key, title, content, meta_title, meta_description, meta_keywords, slug, status } = req.body;
    if (!page_key || !title) {
        return res.status(400).json({ success: false, message: 'page_key and title are required' });
    }
    try {
        const [existing] = await pool.query('SELECT id FROM cms_pages WHERE page_key = ?', [page_key]);
        if (existing.length) {
            await pool.query(
                `UPDATE cms_pages
                 SET title = ?, content = ?, meta_title = ?, meta_description = ?,
                     meta_keywords = ?, slug = ?, status = ?
                 WHERE page_key = ?`,
                [title, content ?? '', meta_title ?? null, meta_description ?? null,
                 meta_keywords ?? null, slug ?? null, status ?? 1, page_key]
            );
        } else {
            await pool.query(
                `INSERT INTO cms_pages (page_key, title, content, meta_title, meta_description, meta_keywords, slug, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [page_key, title, content ?? '', meta_title ?? null, meta_description ?? null,
                 meta_keywords ?? null, slug ?? null, status ?? 1]
            );
        }
        res.json({ success: true, message: 'Page saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getPublicPage = async (req, res) => {
    const { page_key } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT title, content, meta_title, meta_description, meta_keywords, slug
             FROM cms_pages WHERE page_key = ? AND status = 1`,
            [page_key]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Page not found' });
        res.json({ success: true, page: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { getPage, updatePage, getPublicPage };
