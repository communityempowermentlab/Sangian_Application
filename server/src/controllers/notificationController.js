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
        return res.json({ notification: row });
    } catch (err) {
        console.error('getNotificationByKey error:', err);
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

module.exports = { getAllNotifications, getNotificationByKey, updateNotification, updateNotificationStatus };
