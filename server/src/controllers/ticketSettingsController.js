const { pool } = require('../config/db');
const { syncNotificationTemplates } = require('../utils/notificationBridge');

const getHelpEmailSettings = async (req, res) => {
    try {
        const [[row]] = await pool.query('SELECT * FROM help_email_settings WHERE id = 1');
        return res.json({ settings: row || {} });
    } catch (err) {
        console.error('getHelpEmailSettings error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

const updateHelpEmailSettings = async (req, res) => {
    try {
        const { send_user_email, send_admin_email, send_on_admin_reply, send_on_user_reply, admin_email } = req.body;

        await pool.query(
            `INSERT INTO help_email_settings
             (id, send_user_email, send_admin_email, send_on_admin_reply, send_on_user_reply, admin_email)
             VALUES (1, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             send_user_email     = VALUES(send_user_email),
             send_admin_email    = VALUES(send_admin_email),
             send_on_admin_reply = VALUES(send_on_admin_reply),
             send_on_user_reply  = VALUES(send_on_user_reply),
             admin_email         = VALUES(admin_email)`,
            [
                send_user_email     ? 1 : 0,
                send_admin_email    ? 1 : 0,
                send_on_admin_reply ? 1 : 0,
                send_on_user_reply  ? 1 : 0,
                admin_email || null,
            ]
        );

        // Keep Settings → Notifications in sync — see notificationBridge.js.
        await syncNotificationTemplates('help_email_settings', 'send_user_email', !!send_user_email);
        await syncNotificationTemplates('help_email_settings', 'send_admin_email', !!send_admin_email);
        await syncNotificationTemplates('help_email_settings', 'send_on_admin_reply', !!send_on_admin_reply);
        await syncNotificationTemplates('help_email_settings', 'send_on_user_reply', !!send_on_user_reply);

        return res.json({ success: true });
    } catch (err) {
        console.error('updateHelpEmailSettings error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

module.exports = { getHelpEmailSettings, updateHelpEmailSettings };
