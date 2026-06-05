const nodemailer = require('nodemailer');

const SMTP_CONFIGURED = !!(process.env.SMTP_USER && process.env.SMTP_HOST);

let transporter = null;

if (SMTP_CONFIGURED) {
    transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port:   parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

const FROM = process.env.SMTP_FROM || 'Sangian Support <support@sangian.celworld.org>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sangian.com';
const BRAND_COLOR = '#4f46e5';

// ── HTML email wrapper ────────────────────────────────────────────────────────
const wrap = (title, body) => `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:${BRAND_COLOR};padding:28px 36px">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.03em">🎫 Sangian Support</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px">Community Empowerment Lab</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 36px">
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:22px;font-weight:800">${title}</h2>
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">This is an automated email from the Sangian Assessment Platform.<br>© 2026 Community Empowerment Lab · Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const btn = (text, url) =>
    `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:${BRAND_COLOR};color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">${text}</a>`;

// ── Send helper ───────────────────────────────────────────────────────────────
const send = async (to, subject, html) => {
    if (!SMTP_CONFIGURED) {
        console.log('\n📧 [EMAIL - not configured, logging instead]');
        console.log(`To: ${to}\nSubject: ${subject}\n---`);
        return;
    }
    await transporter.sendMail({ from: FROM, to, subject, html });
};

// ── OTP email ─────────────────────────────────────────────────────────────────
const sendOtp = (email, otp) => send(
    email,
    'Your Verification Code – Sangian Support',
    wrap('Verify Your Email', `
        <p style="color:#374151;font-size:15px;line-height:1.6">Use the code below to verify your email and access the support ticket system.</p>
        <div style="margin:24px 0;text-align:center">
          <div style="display:inline-block;background:#eef2ff;border:2px dashed ${BRAND_COLOR};border-radius:14px;padding:20px 40px">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:${BRAND_COLOR}">${otp}</span>
          </div>
        </div>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">⏱️ This code is valid for <strong>10 minutes</strong>.<br>If you did not request this, please ignore this email.</p>
    `)
);

// ── Ticket created (user) ─────────────────────────────────────────────────────
const sendTicketCreated = (email, ticket) => send(
    email,
    `Ticket ${ticket.ticket_id} Created – Sangian Support`,
    wrap('Your ticket has been submitted!', `
        <p style="color:#374151;font-size:15px;line-height:1.6">Thank you for reaching out. We have received your support request and will get back to you within <strong>1–2 business days</strong>.</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse">
          <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px 8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:120px">Ticket ID</td>
              <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-top:none;font-size:15px;font-weight:800;color:${BRAND_COLOR}">${ticket.ticket_id}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Subject</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">${ticket.title}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Status</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#16a34a;font-weight:700">Open</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">To check your ticket status or add a reply, visit the Help &amp; Support page and use your email to access your tickets.</p>
    `)
);

// ── New ticket (admin notification) ──────────────────────────────────────────
const sendNewTicketAdmin = (ticket) => send(
    ADMIN_EMAIL,
    `New Support Ticket ${ticket.ticket_id} – ${ticket.title}`,
    wrap(`New ticket from ${ticket.email}`, `
        <p style="color:#374151;font-size:15px;line-height:1.6">A new support ticket has been submitted.</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse">
          <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:120px">Ticket ID</td>
              <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;font-size:15px;font-weight:800;color:${BRAND_COLOR}">${ticket.ticket_id}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">From</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">${ticket.email}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Subject</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">${ticket.title}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;vertical-align:top">Message</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#374151;line-height:1.6">${ticket.description}</td></tr>
        </table>
        ${btn('View in Admin Panel', `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/help-support`)}
    `)
);

// ── Admin replied (user notification) ────────────────────────────────────────
const sendAdminReply = (email, ticket_id, preview) => send(
    email,
    `New Reply on Ticket ${ticket_id} – Sangian Support`,
    wrap('The support team has replied to your ticket', `
        <p style="color:#374151;font-size:15px;line-height:1.6">You have a new reply on ticket <strong>${ticket_id}</strong>.</p>
        <blockquote style="margin:16px 0;padding:14px 18px;background:#f8fafc;border-left:4px solid ${BRAND_COLOR};border-radius:0 10px 10px 0">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">${preview}</p>
        </blockquote>
        <p style="color:#6b7280;font-size:13px">Log in to the Help &amp; Support page to view the full reply and respond.</p>
    `)
);

// ── User replied (admin notification) ────────────────────────────────────────
const sendUserReply = (ticket_id, email, preview) => send(
    ADMIN_EMAIL,
    `User Reply on Ticket ${ticket_id}`,
    wrap(`New reply from ${email}`, `
        <p style="color:#374151;font-size:15px;line-height:1.6">The user has replied to ticket <strong>${ticket_id}</strong>.</p>
        <blockquote style="margin:16px 0;padding:14px 18px;background:#f8fafc;border-left:4px solid #ec4899;border-radius:0 10px 10px 0">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">${preview}</p>
        </blockquote>
        ${btn('Reply in Admin Panel', `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/help-support`)}
    `)
);

// ── Status changed (user notification) ───────────────────────────────────────
const STATUS_LABELS = {
    open: 'Open', in_progress: 'In Progress',
    waiting_for_user: 'Waiting for Your Reply',
    resolved: 'Resolved', closed: 'Closed',
};

const sendStatusChanged = (email, ticket_id, status) => send(
    email,
    `Ticket ${ticket_id} Status Updated – ${STATUS_LABELS[status] || status}`,
    wrap('Your ticket status has been updated', `
        <p style="color:#374151;font-size:15px;line-height:1.6">The status of your support ticket <strong>${ticket_id}</strong> has been updated.</p>
        <div style="margin:20px 0;padding:14px 20px;background:#eef2ff;border-radius:10px;display:inline-block">
          <span style="font-size:16px;font-weight:800;color:${BRAND_COLOR}">New Status: ${STATUS_LABELS[status] || status}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">Visit the Help &amp; Support page to view your ticket details.</p>
    `)
);

module.exports = { sendOtp, sendTicketCreated, sendNewTicketAdmin, sendAdminReply, sendUserReply, sendStatusChanged };
