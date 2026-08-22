const { pool } = require('../config/db');
const { syncLegacyColumn } = require('../utils/notificationBridge');

// @route GET /api/admin/notifications
const getAllNotifications = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, trigger_key, trigger_label, category, description, status, subject, updated_at
             FROM notification_templates ORDER BY category, trigger_label`
        );
        return res.json({ notifications: rows });
    } catch (err) {
        console.error('getAllNotifications error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// @route GET /api/admin/notifications/:triggerKey
const getNotificationByKey = async (req, res) => {
    try {
        const [[row]] = await pool.query('SELECT * FROM notification_templates WHERE trigger_key = ?', [req.params.triggerKey]);
        if (!row) return res.status(404).json({ error: 'Notification not found.' });
        const [translations] = await pool.query(
            'SELECT language, subject, heading, body_html FROM notification_template_translations WHERE trigger_key = ?',
            [req.params.triggerKey]
        );
        return res.json({ notification: row, translations });
    } catch (err) {
        console.error('getNotificationByKey error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// @route PUT /api/admin/notifications/:triggerKey/translations/:lang
// Upserts one language's subject/heading/body_html override. All three
// blank clears the override instead (falls back to the English row) —
// see deleteNotificationTranslation.
const upsertNotificationTranslation = async (req, res) => {
    try {
        const { triggerKey, lang } = req.params;
        const { subject, heading, body_html } = req.body;

        if (!subject?.trim() && !heading?.trim() && !body_html?.trim()) {
            await pool.query(
                'DELETE FROM notification_template_translations WHERE trigger_key = ? AND language = ?',
                [triggerKey, lang]
            );
            return res.json({ success: true, cleared: true });
        }
        if (!subject?.trim() || !heading?.trim() || !body_html?.trim()) {
            return res.status(400).json({ error: 'Subject, heading and body are required (or leave all three blank to fall back to English).' });
        }

        await pool.query(
            `INSERT INTO notification_template_translations (trigger_key, language, subject, heading, body_html)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE subject = VALUES(subject), heading = VALUES(heading), body_html = VALUES(body_html)`,
            [triggerKey, lang, subject.trim(), heading.trim(), body_html]
        );
        return res.json({ success: true });
    } catch (err) {
        console.error('upsertNotificationTranslation error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// @route DELETE /api/admin/notifications/:triggerKey/translations/:lang
const deleteNotificationTranslation = async (req, res) => {
    try {
        const { triggerKey, lang } = req.params;
        await pool.query(
            'DELETE FROM notification_template_translations WHERE trigger_key = ? AND language = ?',
            [triggerKey, lang]
        );
        return res.json({ success: true });
    } catch (err) {
        console.error('deleteNotificationTranslation error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// @route PUT /api/admin/notifications/:triggerKey
const updateNotification = async (req, res) => {
    try {
        const { triggerKey } = req.params;
        const { subject, heading, body_html, sender_name, sender_email, status } = req.body;

        if (!subject?.trim() || !heading?.trim() || !body_html?.trim()) {
            return res.status(400).json({ error: 'Subject, heading and body are required.' });
        }
        if (!['on', 'off'].includes(status)) {
            return res.status(400).json({ error: 'Status must be "on" or "off".' });
        }

        const [result] = await pool.query(
            `UPDATE notification_templates
             SET subject = ?, heading = ?, body_html = ?, sender_name = ?, sender_email = ?, status = ?
             WHERE trigger_key = ?`,
            [subject.trim(), heading.trim(), body_html, sender_name?.trim() || null, sender_email?.trim() || null, status, triggerKey]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Notification not found.' });

        await syncLegacyColumn(triggerKey, status === 'on');

        return res.json({ success: true });
    } catch (err) {
        console.error('updateNotification error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// @route PATCH /api/admin/notifications/:triggerKey/status
// Lightweight ON/OFF flip for the list view — separate from updateNotification
// so toggling status never risks touching subject/heading/body_html (the list
// endpoint doesn't fetch those, so a full update from that screen would wipe
// them).
const updateNotificationStatus = async (req, res) => {
    try {
        const { triggerKey } = req.params;
        const { status } = req.body;
        if (!['on', 'off'].includes(status)) {
            return res.status(400).json({ error: 'Status must be "on" or "off".' });
        }

        const [result] = await pool.query('UPDATE notification_templates SET status = ? WHERE trigger_key = ?', [status, triggerKey]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Notification not found.' });

        await syncLegacyColumn(triggerKey, status === 'on');

        return res.json({ success: true });
    } catch (err) {
        console.error('updateNotificationStatus error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

module.exports = {
    getAllNotifications, getNotificationByKey, updateNotification, updateNotificationStatus,
    upsertNotificationTranslation, deleteNotificationTranslation,
};
