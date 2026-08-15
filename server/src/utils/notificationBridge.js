const { pool } = require('../config/db');

// Six notification_templates rows mirror an on/off checkbox that already
// existed before the Notifications module (help_email_settings /
// contact_email_settings) — see AdminSettings.jsx's HelpEmailSettingsTab /
// ContactEmailSettingsTab. Rather than let those two switches drift apart,
// this map is the single definition of which legacy column each bridged
// trigger_key mirrors; both directions of sync (notificationController.js
// writing here, ticketSettingsController.js/contactController.js writing
// back) import this same map so there is exactly one place that knows the
// pairing.
const NOTIFICATION_BRIDGE = {
  ticket_created_user:        { table: 'help_email_settings',    column: 'send_user_email' },
  ticket_status_changed:      { table: 'help_email_settings',    column: 'send_user_email' },
  ticket_created_admin:       { table: 'help_email_settings',    column: 'send_admin_email' },
  ticket_admin_reply:         { table: 'help_email_settings',    column: 'send_on_admin_reply' },
  ticket_user_reply:          { table: 'help_email_settings',    column: 'send_on_user_reply' },
  contact_thank_you_en:       { table: 'contact_email_settings', column: 'send_sender_email' },
  contact_thank_you_hi:       { table: 'contact_email_settings', column: 'send_sender_email' },
  contact_admin_notification: { table: 'contact_email_settings', column: 'send_admin_email' },
};

// Called by notificationController.updateNotification after it writes
// notification_templates.status for a bridged trigger_key, so the legacy
// settings tab's checkbox reflects the change too.
const syncLegacyColumn = async (triggerKey, isOn) => {
  const bridge = NOTIFICATION_BRIDGE[triggerKey];
  if (!bridge) return;
  await pool.query(`UPDATE ${bridge.table} SET ${bridge.column} = ? WHERE id = 1`, [isOn ? 1 : 0]);
};

// Called by ticketSettingsController.updateHelpEmailSettings and
// contactController.updateContactEmailSettings after they write their own
// legacy column, so every trigger_key mirroring that column flips too.
const syncNotificationTemplates = async (table, column, isOn) => {
  const keys = Object.entries(NOTIFICATION_BRIDGE)
    .filter(([, b]) => b.table === table && b.column === column)
    .map(([key]) => key);
  if (!keys.length) return;
  await pool.query(
    `UPDATE notification_templates SET status = ? WHERE trigger_key IN (${keys.map(() => '?').join(',')})`,
    [isOn ? 'on' : 'off', ...keys]
  );
};

module.exports = { NOTIFICATION_BRIDGE, syncLegacyColumn, syncNotificationTemplates };
