const { pool } = require('../config/db');
const { sendContactThankYou, sendContactAdminNotification } = require('../services/emailService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory rate limiter: max 5 submissions per IP per 10 min
const _rl = new Map();
const RL_WINDOW = 10 * 60 * 1000;
const RL_MAX    = 5;

function checkRateLimit(ip) {
    const now  = Date.now();
    const rec  = _rl.get(ip) || { count: 0, first: now };
    if (now - rec.first < RL_WINDOW) {
        if (rec.count >= RL_MAX) return false;
        rec.count++;
    } else {
        rec.count = 1;
        rec.first = now;
    }
    _rl.set(ip, rec);
    return true;
}

// ── Public ────────────────────────────────────────────────────────────────────

const submitContact = async (req, res) => {
    // Honeypot: bots fill the hidden 'website' field → silently drop
    if (req.body.website) return res.json({ success: true });

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ success: false, message: 'Too many submissions. Please try again later.' });
    }

    const { name, email, phone, subject, message } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !subject?.trim() || !message?.trim()) {
        return res.status(400).json({ success: false, message: 'Name, email, phone, subject, and message are required.' });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (name.length > 255 || subject.length > 500 || message.length > 5000) {
        return res.status(400).json({ success: false, message: 'Input exceeds maximum allowed length.' });
    }

    try {
        await pool.query(
            `INSERT INTO contact_messages (name, email, phone, subject, message, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name.trim(), email.trim(), phone?.trim() || null, subject.trim(), message.trim(), ip]
        );
        res.json({ success: true, message: 'Your message has been received. Our team will contact you soon.' });

        // Fire emails async after responding — don't block the user
        (async () => {
            try {
                const [[settings]] = await pool.query('SELECT * FROM contact_email_settings LIMIT 1');
                if (!settings) return;
                const lang = (req.body.lang === 'hi') ? 'hi' : 'en';
                if (settings.send_sender_email) {
                    sendContactThankYou(email.trim(), name.trim(), lang).catch(() => {});
                }
                if (settings.send_admin_email && settings.admin_email) {
                    sendContactAdminNotification(settings.admin_email, {
                        name: name.trim(), email: email.trim(),
                        phone: phone?.trim() || null,
                        subject: subject.trim(), message: message.trim(),
                    }).catch(() => {});
                }
            } catch {}
        })();
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to submit. Please try again.' });
    }
};

const getPublicContactInfo = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT title, content, content_hi, contact_email, contact_phone, contact_address, contact_map_link
             FROM cms_pages WHERE page_key = 'contact' AND status = 1`
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, info: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

const getContactInfo = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM cms_pages WHERE page_key = ?', ['contact']);
        if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, info: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateContactInfo = async (req, res) => {
    const { title, content, content_hi, contact_email, contact_phone, contact_address,
            contact_map_link, meta_title, meta_description, status } = req.body;
    try {
        const [existing] = await pool.query("SELECT id FROM cms_pages WHERE page_key = 'contact'");
        if (existing.length) {
            await pool.query(
                `UPDATE cms_pages SET title=?, content=?, content_hi=?, contact_email=?, contact_phone=?,
                 contact_address=?, contact_map_link=?, meta_title=?, meta_description=?, status=?
                 WHERE page_key='contact'`,
                [title || 'Contact Us', content || '', content_hi || null,
                 contact_email || null, contact_phone || null,
                 contact_address || null, contact_map_link || null,
                 meta_title || null, meta_description || null, status ?? 1]
            );
        } else {
            await pool.query(
                `INSERT INTO cms_pages (page_key, title, content, content_hi, contact_email, contact_phone,
                 contact_address, contact_map_link, meta_title, meta_description, status)
                 VALUES ('contact',?,?,?,?,?,?,?,?,?,1)`,
                [title || 'Contact Us', content || '', content_hi || null,
                 contact_email || null, contact_phone || null,
                 contact_address || null, contact_map_link || null,
                 meta_title || null, meta_description || null]
            );
        }
        res.json({ success: true, message: 'Contact info saved.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getMessages = async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const status = req.query.status;
    const offset = (page - 1) * limit;

    try {
        const where  = status ? 'WHERE status = ?' : '';
        const params = status ? [status] : [];
        const [rows]  = await pool.query(
            `SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM contact_messages ${where}`, params
        );
        res.json({ success: true, messages: rows, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateMessageStatus = async (req, res) => {
    const { id, status } = req.body;
    if (!id || !['new', 'in_progress', 'resolved'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid request.' });
    }
    try {
        await pool.query('UPDATE contact_messages SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const deleteMessage = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM contact_messages WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getContactEmailSettings = async (req, res) => {
    try {
        const [[row]] = await pool.query('SELECT * FROM contact_email_settings WHERE id = 1');
        if (!row) return res.json({ success: true, settings: { send_sender_email: 1, send_admin_email: 1, admin_email: '' } });
        res.json({ success: true, settings: row });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const updateContactEmailSettings = async (req, res) => {
    const { send_sender_email, send_admin_email, admin_email } = req.body;
    if (admin_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email)) {
        return res.status(400).json({ success: false, message: 'Invalid admin email address.' });
    }
    try {
        // Upsert pinned to id=1 — always one row, never inserts a second
        await pool.query(
            `INSERT INTO contact_email_settings (id, send_sender_email, send_admin_email, admin_email)
             VALUES (1, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               send_sender_email = VALUES(send_sender_email),
               send_admin_email  = VALUES(send_admin_email),
               admin_email       = VALUES(admin_email)`,
            [send_sender_email ? 1 : 0, send_admin_email ? 1 : 0, admin_email?.trim() || null]
        );
        res.json({ success: true, message: 'Email settings saved.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getNewMessageCount = async (req, res) => {
    try {
        const [[{ count }]] = await pool.query(
            "SELECT COUNT(*) AS count FROM contact_messages WHERE status = 'new'"
        );
        res.json({ success: true, count: Number(count) });
    } catch (err) {
        res.status(500).json({ success: false, count: 0 });
    }
};

module.exports = {
    submitContact, getPublicContactInfo,
    getContactInfo, updateContactInfo,
    getMessages, updateMessageStatus, deleteMessage,
    getContactEmailSettings, updateContactEmailSettings,
    getNewMessageCount,
};
