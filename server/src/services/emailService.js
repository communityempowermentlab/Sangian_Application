const nodemailer = require('nodemailer');
const { pool }   = require('../config/db');

const BRAND_COLOR = '#4f46e5';

// ── HTML email wrapper ────────────────────────────────────────────────────────
// This chrome (header bar + footer disclaimer) is intentionally NOT part of
// the admin-editable template — it's the one piece of every system email
// that stays consistent regardless of what an Admin edits in Settings →
// Notifications. Admins control the heading + body inside it.
const wrap = (title, body) => `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr><td style="background:${BRAND_COLOR};padding:28px 36px">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.03em">🎫 Sangian Support</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px">Community Empowerment Lab</p>
        </td></tr>
        <tr><td style="padding:32px 36px">
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px;font-weight:800">${title}</h2>
          ${body}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">This is an automated email from the Sangian Assessment Platform.<br>© 2026 Community Empowerment Lab · Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

// ── Fetch SMTP config from DB ─────────────────────────────────────────────────
const getSmtp = async () => {
    const [[row]] = await pool.query('SELECT * FROM smtp_settings WHERE id = 1');
    return row || null;
};

// ── Fetch Help & Support admin recipient (Ticket Notifications settings) ─────
// Only the recipient address — the on/off decision for these emails now
// lives entirely in notification_templates (see sendFromTemplate below).
const getHelpAdminEmail = async () => {
    const [[row]] = await pool.query('SELECT admin_email FROM help_email_settings WHERE id = 1');
    return row?.admin_email || process.env.ADMIN_EMAIL || 'admin@sangian.com';
};

// ── Core send helper (dynamic SMTP from DB, optional per-template sender override) ─
// Returns a delivery-status object (rather than void) so every caller can
// log/report success vs failure consistently, for monitoring/troubleshooting
// — one place to get this right instead of duplicating logging per email type.
const send = async (to, subject, html, senderOverride) => {
    const smtp = await getSmtp();
    if (!smtp || !smtp.host || !smtp.username) {
        console.log(`📧 [EMAIL NOT SENT — SMTP unconfigured] To: ${to} | Subject: "${subject}"`);
        return { delivered: false, reason: 'smtp_not_configured' };
    }
    const transporter = nodemailer.createTransport({
        host:   smtp.host,
        port:   smtp.port || 587,
        secure: smtp.encryption === 'ssl',
        auth:   { user: smtp.username, pass: smtp.password },
    });
    const name  = senderOverride?.name  || smtp.from_name  || 'Sangian Support';
    const addr  = senderOverride?.email || smtp.from_email || (process.env.SMTP_FROM || 'support@sangian.celworld.org');
    const fromAddr = `${name} <${addr}>`;
    try {
        const info = await transporter.sendMail({ from: fromAddr, to, subject, html });
        console.log(`📧 [EMAIL SENT] To: ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`);
        return { delivered: true, messageId: info.messageId };
    } catch (err) {
        console.error(`📧 [EMAIL FAILED] To: ${to} | Subject: "${subject}" | Error: ${err.message}`);
        throw err;
    }
};

// ── Notification Management engine ────────────────────────────────────────────
// Every system email is admin-configured via the notification_templates
// table (Admin Settings → Notifications). This is the single place that
// checks a trigger's on/off status and renders its admin-edited content
// before anything reaches send(). See server/src/config/db.js for the
// table/seed and server/src/controllers/notificationController.js for the
// CRUD behind the admin UI.
// status/sender/available_variables always come from the base (English) row
// — only subject/heading/body_html can be overridden per language, via
// notification_template_translations. No override row for a language (or no
// `language` passed) just falls back to the base content, same as the
// Contact Us page description / CmsPublicPage.jsx pattern.
const getTemplate = async (triggerKey, language) => {
    const [[row]] = await pool.query('SELECT * FROM notification_templates WHERE trigger_key = ?', [triggerKey]);
    if (!row) return null;
    if (!language || language === 'en') return row;

    const [[translation]] = await pool.query(
        'SELECT subject, heading, body_html FROM notification_template_translations WHERE trigger_key = ? AND language = ?',
        [triggerKey, language]
    );
    return translation ? { ...row, ...translation } : row;
};

const renderTemplate = (str, vars) => (str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (!(key in vars)) return match; // leave unrecognized placeholders as-is, e.g. an admin typo
    return vars[key] === null || vars[key] === undefined ? '' : String(vars[key]);
});

const sendFromTemplate = async (triggerKey, to, vars, language) => {
    const template = await getTemplate(triggerKey, language);
    if (!template) {
        console.warn(`📧 [EMAIL SKIPPED — unknown trigger "${triggerKey}"] To: ${to}`);
        return { delivered: false, reason: 'template_not_found' };
    }
    if (template.status !== 'on') {
        console.log(`📧 [EMAIL SKIPPED — "${triggerKey}" is OFF] To: ${to}`);
        return { delivered: false, reason: 'disabled' };
    }
    const subject = renderTemplate(template.subject, vars);
    const heading  = renderTemplate(template.heading, vars);
    const bodyHtml = renderTemplate(template.body_html, vars);
    const html = wrap(heading, bodyHtml);
    const senderOverride = (template.sender_name || template.sender_email)
        ? { name: template.sender_name, email: template.sender_email }
        : null;
    return send(to, subject, html, senderOverride);
};

// ── OTP / verification code email ─────────────────────────────────────────────
// Shared by registration (individual/org), email/mobile-change flows
// (otpController.js) and the support-ticket portal's own email gate
// (ticketController.js) — same content either way.
const sendOtp = (email, otp) => sendFromTemplate('otp_verification', email, { otp });

// ── Individual registration success (full onboarding welcome email) ──────────
const sendIndividualWelcome = (email, fullName, mobile) => sendFromTemplate(
    'individual_registration_welcome', email, { full_name: fullName, email, mobile: mobile || '—' }
);

// ── Organization registration received (pending approval) ────────────────────
const sendOrgRegistrationReceived = (email, orgName) => sendFromTemplate(
    'org_registration_received', email, { org_name: orgName }
);

// ── Organization approved / rejected (Super Admin decision) ──────────────────
const sendOrgApproved = (email, orgName) => sendFromTemplate(
    'org_approved', email, { org_name: orgName }
);

const sendOrgRejected = (email, orgName, reason) => sendFromTemplate(
    'org_rejected', email, { org_name: orgName, rejection_reason: reason }
);

// ── Ticket created (user confirmation) ───────────────────────────────────────
const sendTicketCreated = (email, ticket) => sendFromTemplate(
    'ticket_created_user', email, { ticket_id: ticket.ticket_id, subject: ticket.title, status: 'Open' }
);

// ── New ticket (admin notification) ──────────────────────────────────────────
const sendNewTicketAdmin = async (ticket) => {
    const adminEmail = await getHelpAdminEmail();
    return sendFromTemplate('ticket_created_admin', adminEmail, {
        ticket_id: ticket.ticket_id, subject: ticket.title, from_email: ticket.email, message: ticket.description,
        admin_panel_url: `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/help-support`,
    });
};

// ── Admin replied (user notification) ────────────────────────────────────────
const sendAdminReply = (email, ticket_id, preview) => sendFromTemplate(
    'ticket_admin_reply', email, { ticket_id, reply_preview: preview }
);

// ── User replied (admin notification) ────────────────────────────────────────
const sendUserReply = async (ticket_id, email, preview) => {
    const adminEmail = await getHelpAdminEmail();
    return sendFromTemplate('ticket_user_reply', adminEmail, {
        ticket_id, from_email: email, reply_preview: preview,
        admin_panel_url: `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/help-support`,
    });
};

// ── Status changed (user notification) ───────────────────────────────────────
const STATUS_LABELS = {
    open: 'Open', in_progress: 'In Progress',
    waiting_for_user: 'Waiting for Your Reply',
    resolved: 'Resolved', closed: 'Closed',
};

const sendStatusChanged = (email, ticket_id, status) => sendFromTemplate(
    'ticket_status_changed', email, { ticket_id, status_label: STATUS_LABELS[status] || status }
);

// ── Status shared with customer (admin-triggered, English only) ──────────────
// "Share Status with Customer" button on the Ticket Details page — unlike
// sendStatusChanged (which fires automatically when status actually
// changes), this is a manual re-send of whatever the current status already
// is. No `language` arg is ever passed to sendFromTemplate here, so it
// always resolves the base (English) row — deliberately not
// language-specific, per the feature spec.
const STATUS_DESCRIPTIONS = {
    open:             'Your ticket has been received and is in our queue.',
    in_progress:      'Our support team is actively working on your ticket.',
    waiting_for_user: "We're waiting for additional information from you to proceed.",
    resolved:         'Your ticket has been resolved. If you need further assistance, feel free to reply.',
    closed:           'This ticket has been closed.',
};

const sendTicketStatusShared = (email, { ticket_id, subject, status }) => sendFromTemplate(
    'ticket_status_shared', email, {
        ticket_id, subject,
        status_label:       STATUS_LABELS[status] || status,
        status_description: STATUS_DESCRIPTIONS[status] || '',
        email,
    }
);

// ── Contact form — status shared with customer (admin-triggered, English
// only) ────────────────────────────────────────────────────────────────────
// "Share Status with Customer" on a Contact Us message's detail panel — same
// idea as sendTicketStatusShared above, for contact_messages' own 3-value
// status enum instead of the ticket system's 5-value one.
const CONTACT_STATUS_LABELS = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved' };
const CONTACT_STATUS_DESCRIPTIONS = {
    new:         'Your message has been received and is in our queue.',
    in_progress: 'Our team is actively working on your request.',
    resolved:    'Your request has been resolved. If you need anything else, feel free to reach out again.',
};

const sendContactStatusShared = (email, { reference, name, subject, status }) => sendFromTemplate(
    'contact_status_shared', email, {
        reference, name, subject,
        status_label:       CONTACT_STATUS_LABELS[status] || status,
        status_description: CONTACT_STATUS_DESCRIPTIONS[status] || '',
        email,
    }
);

// ── Contact form — thank-you to sender ───────────────────────────────────────
// One trigger for every language now (see notification_template_translations)
// — `lang` is whichever language the sender had selected on the Contact Us
// page; an unrecognized/untranslated code just falls back to English.
const sendContactThankYou = (email, name, lang = 'en') => sendFromTemplate(
    'contact_thank_you', email, { name }, lang
);

// ── Contact form — admin notification ────────────────────────────────────────
const sendContactAdminNotification = (adminEmail, { name, email, phone, subject, message }) => sendFromTemplate(
    'contact_admin_notification', adminEmail, {
        name, email, phone: phone || '—', subject, message,
        admin_panel_url: `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/contact`,
    }
);

module.exports = { sendOtp, sendIndividualWelcome, sendOrgRegistrationReceived, sendOrgApproved, sendOrgRejected, sendTicketCreated, sendNewTicketAdmin, sendAdminReply, sendUserReply, sendStatusChanged, sendTicketStatusShared, sendContactThankYou, sendContactAdminNotification, sendContactStatusShared };
