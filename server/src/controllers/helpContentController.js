const { pool } = require('../config/db');
const { getLanguageSettings } = require('../services/translationsService');

const VALID_SECTIONS = ['create_ticket', 'my_tickets', 'faq'];
// Sourced from server/translations/language-settings.json so this always
// matches the languages configured in the admin Languages tab.
const getValidLanguages = () => getLanguageSettings().languages.map((l) => l.shortCode);

// ── Admin: GET /api/admin/help-content/:section/:lang ─────────────────────────
const adminGetContent = async (req, res) => {
    const { section, lang } = req.params;
    if (!VALID_SECTIONS.includes(section) || !getValidLanguages().includes(lang)) {
        return res.status(400).json({ error: 'Invalid section or language.' });
    }
    try {
        const [rows] = await pool.query(
            'SELECT * FROM help_support_content WHERE section_key = ? AND language = ?',
            [section, lang]
        );
        if (!rows.length) return res.status(404).json({ error: 'Content not found.' });
        return res.json({ success: true, content: rows[0] });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ── Admin: POST /api/admin/help-content ───────────────────────────────────────
const adminUpdateContent = async (req, res) => {
    const { section_key, language, title, content } = req.body;
    if (!VALID_SECTIONS.includes(section_key) || !getValidLanguages().includes(language)) {
        return res.status(400).json({ error: 'Invalid section or language.' });
    }
    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required.' });
    }
    try {
        await pool.query(
            `INSERT INTO help_support_content (section_key, language, title, content)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)`,
            [section_key, language, title.trim(), content ?? '']
        );
        return res.json({ success: true, message: 'Content saved.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ── Public: GET /api/help-content/:section/:lang ──────────────────────────────
const publicGetContent = async (req, res) => {
    const { section, lang } = req.params;
    const safeLang = getValidLanguages().includes(lang) ? lang : 'en';
    if (!VALID_SECTIONS.includes(section)) {
        return res.status(400).json({ error: 'Invalid section.' });
    }
    try {
        const [rows] = await pool.query(
            'SELECT title, content FROM help_support_content WHERE section_key = ? AND language = ?',
            [section, safeLang]
        );
        if (!rows.length) {
            // Fallback to English if requested language has no content
            const [enRows] = await pool.query(
                'SELECT title, content FROM help_support_content WHERE section_key = ? AND language = ?',
                [section, 'en']
            );
            if (!enRows.length) return res.status(404).json({ error: 'Content not found.' });
            return res.json({ success: true, content: enRows[0] });
        }
        return res.json({ success: true, content: rows[0] });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// ── Public: GET /api/help-content/all/:lang ───────────────────────────────────
const publicGetAll = async (req, res) => {
    const { lang } = req.params;
    const safeLang = getValidLanguages().includes(lang) ? lang : 'en';
    try {
        const [rows] = await pool.query(
            'SELECT section_key, title, content FROM help_support_content WHERE language = ?',
            [safeLang]
        );
        // Fallback: for any missing sections, pull from 'en'
        const found = new Set(rows.map(r => r.section_key));
        const missing = VALID_SECTIONS.filter(s => !found.has(s));
        if (missing.length) {
            const placeholders = missing.map(() => '?').join(',');
            const [enRows] = await pool.query(
                `SELECT section_key, title, content FROM help_support_content WHERE language = 'en' AND section_key IN (${placeholders})`,
                missing
            );
            rows.push(...enRows);
        }
        const map = {};
        rows.forEach(r => { map[r.section_key] = { title: r.title, content: r.content }; });
        return res.json({ success: true, content: map });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports = { adminGetContent, adminUpdateContent, publicGetContent, publicGetAll };
