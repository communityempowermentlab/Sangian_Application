const nodemailer = require('nodemailer');
const { pool }   = require('../config/db');

const BRAND_COLOR = '#4f46e5';

// ── HTML email wrapper ────────────────────────────────────────────────────────
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

const btn = (text, url) =>
    `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:${BRAND_COLOR};color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">${text}</a>`;

// ── Fetch SMTP config from DB ─────────────────────────────────────────────────
const getSmtp = async () => {
    const [[row]] = await pool.query('SELECT * FROM smtp_settings WHERE id = 1');
    return row || null;
};

// ── Fetch Help & Support email settings from DB ───────────────────────────────
const getHelpSettings = async () => {
    const [[row]] = await pool.query('SELECT * FROM help_email_settings WHERE id = 1');
    return row || { send_user_email: 1, send_admin_email: 1, send_on_admin_reply: 1, send_on_user_reply: 1, admin_email: null };
};

// ── Core send helper (dynamic SMTP from DB) ───────────────────────────────────
// Returns a delivery-status object (rather than void) so every caller can
// log/report success vs failure consistently, for monitoring/troubleshooting
// — one place to get this right instead of duplicating logging per email type.
const send = async (to, subject, html) => {
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
    const fromAddr = smtp.from_email
        ? `${smtp.from_name || 'Sangian Support'} <${smtp.from_email}>`
        : (process.env.SMTP_FROM || 'Sangian Support <support@sangian.celworld.org>');
    try {
        const info = await transporter.sendMail({ from: fromAddr, to, subject, html });
        console.log(`📧 [EMAIL SENT] To: ${to} | Subject: "${subject}" | MessageId: ${info.messageId}`);
        return { delivered: true, messageId: info.messageId };
    } catch (err) {
        console.error(`📧 [EMAIL FAILED] To: ${to} | Subject: "${subject}" | Error: ${err.message}`);
        throw err;
    }
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

// ── Individual registration success (full onboarding welcome email) ──────────
// mobile is optional — displayed only when provided, per spec ("Registered
// Mobile Number (optional)").
const sendIndividualWelcome = (email, fullName, mobile) => send(
    email,
    'Welcome! Your Registration is Successful',
    wrap('Welcome!', `
        <p style="color:#374151;font-size:15px;line-height:1.6">Dear <strong>${fullName}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">Your registration has been completed successfully, and your account is now active.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">You can now log in using your registered ${mobile ? 'mobile number/' : ''}email address and start using the application.</p>

        <table style="width:100%;margin:20px 0;border-collapse:collapse">
          <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px 8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:140px">Registered Name</td>
              <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">${fullName}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Email</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">${email}</td></tr>
          ${mobile ? `<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Mobile</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:14px;color:#1f2937">${mobile}</td></tr>` : ''}
        </table>

        <h3 style="margin:24px 0 10px;color:#0f172a;font-size:16px;font-weight:800">What's Next?</h3>
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:14px;line-height:1.9">
          <li>Log in to your account.</li>
          <li>Complete your profile (if applicable).</li>
          <li>Start your assigned assessments/games.</li>
          <li>Follow the on-screen instructions while playing.</li>
        </ul>

        <h3 style="margin:24px 0 10px;color:#0f172a;font-size:16px;font-weight:800">Game/Assessment Information</h3>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 8px">The application includes various games/assessments designed to evaluate different skills. Before starting, please ensure that:</p>
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:14px;line-height:1.9">
          <li>You are in a quiet environment.</li>
          <li>You have a stable internet connection.</li>
          <li>You carefully read the instructions displayed before each game.</li>
          <li>Complete each assessment without interruption.</li>
        </ul>

        <h3 style="margin:24px 0 10px;color:#0f172a;font-size:16px;font-weight:800">Scoring</h3>
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:14px;line-height:1.9">
          <li>Your score will be calculated automatically after completing each assessment.</li>
          <li>Results will be available in your account (if enabled).</li>
          <li>Follow all instructions carefully to achieve the most accurate results.</li>
        </ul>

        <h3 style="margin:24px 0 10px;color:#0f172a;font-size:16px;font-weight:800">Need Help?</h3>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">If you experience any issues while logging in or playing the games, please contact our support team.</p>

        <p style="color:#374151;font-size:15px;line-height:1.6">Thank you for registering with us. We wish you the very best!</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin-top:20px">Regards,<br><strong>The Support Team</strong></p>

        <p style="color:#6b7280;font-size:12px;line-height:1.6;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">If you did not create this account, please contact support immediately.</p>
    `)
);

// ── Organization registration received (pending approval) ────────────────────
const sendOrgRegistrationReceived = (email, orgName) => send(
    email,
    'Registration Received – Sangian',
    wrap('Thank you for registering!', `
        <p style="color:#374151;font-size:15px;line-height:1.6">Hi,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">We've received your registration for <strong>${orgName}</strong> on the Sangian Assessment Platform. Your organization is now awaiting review by an administrator.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">You'll be able to log in as soon as it's approved — no further action is needed from you right now.</p>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">If you did not submit this registration, please contact support.</p>
    `)
);

// ── Ticket created (user confirmation) ───────────────────────────────────────
const sendTicketCreated = async (email, ticket) => {
    const settings = await getHelpSettings();
    if (!settings.send_user_email) return;
    return send(
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
};

// ── New ticket (admin notification) ──────────────────────────────────────────
const sendNewTicketAdmin = async (ticket) => {
    const settings = await getHelpSettings();
    if (!settings.send_admin_email) return;
    const adminEmail = settings.admin_email || process.env.ADMIN_EMAIL || 'admin@sangian.com';
    return send(
        adminEmail,
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
};

// ── Admin replied (user notification) ────────────────────────────────────────
const sendAdminReply = async (email, ticket_id, preview) => {
    const settings = await getHelpSettings();
    if (!settings.send_on_admin_reply) return;
    return send(
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
};

// ── User replied (admin notification) ────────────────────────────────────────
const sendUserReply = async (ticket_id, email, preview) => {
    const settings = await getHelpSettings();
    if (!settings.send_on_user_reply) return;
    const adminEmail = settings.admin_email || process.env.ADMIN_EMAIL || 'admin@sangian.com';
    return send(
        adminEmail,
        `User Reply on Ticket ${ticket_id}`,
        wrap(`New reply from ${email}`, `
            <p style="color:#374151;font-size:15px;line-height:1.6">The user has replied to ticket <strong>${ticket_id}</strong>.</p>
            <blockquote style="margin:16px 0;padding:14px 18px;background:#f8fafc;border-left:4px solid #ec4899;border-radius:0 10px 10px 0">
              <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">${preview}</p>
            </blockquote>
            ${btn('Reply in Admin Panel', `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/help-support`)}
        `)
    );
};

// ── Status changed (user notification) ───────────────────────────────────────
const STATUS_LABELS = {
    open: 'Open', in_progress: 'In Progress',
    waiting_for_user: 'Waiting for Your Reply',
    resolved: 'Resolved', closed: 'Closed',
};

const sendStatusChanged = async (email, ticket_id, status) => {
    const settings = await getHelpSettings();
    if (!settings.send_user_email) return;
    return send(
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
};

// ── Contact form — thank-you to sender ───────────────────────────────────────
const sendContactThankYou = (email, name, lang = 'en') => {
    const isHi = lang === 'hi';
    return send(
        email,
        isHi
            ? 'आपसे संपर्क करने के लिए धन्यवाद – संगियान सपोर्ट'
            : 'Thank You for Reaching Out – Sangian Support',
        wrap(
            isHi ? `धन्यवाद, ${name}!` : `Thank You, ${name}!`,
            isHi ? `
                <p style="color:#374151;font-size:15px;line-height:1.6">आपका संदेश कम्युनिटी एम्पावरमेंट लैब टीम को सफलतापूर्वक प्राप्त हो गया है।</p>
                <div style="margin:20px 0;padding:16px 20px;background:#eef2ff;border-radius:10px;border-left:4px solid ${BRAND_COLOR}">
                  <p style="margin:0;color:${BRAND_COLOR};font-size:15px;font-weight:700">✅ आपका संदेश सफलतापूर्वक भेज दिया गया है।</p>
                </div>
                <p style="color:#374151;font-size:14px;line-height:1.6">हम आमतौर पर <strong>1–2 कार्य दिवसों</strong> के भीतर आपके ईमेल पते पर उत्तर देते हैं।</p>
                <p style="color:#6b7280;font-size:13px;line-height:1.6">इस दौरान, त्वरित उत्तरों के लिए हमारा सहायता और समर्थन अनुभाग देखें।</p>
            ` : `
                <p style="color:#374151;font-size:15px;line-height:1.6">We have successfully received your message and our team will review it shortly.</p>
                <div style="margin:20px 0;padding:16px 20px;background:#eef2ff;border-radius:10px;border-left:4px solid ${BRAND_COLOR}">
                  <p style="margin:0;color:${BRAND_COLOR};font-size:15px;font-weight:700">✅ Your message has been received successfully.</p>
                </div>
                <p style="color:#374151;font-size:14px;line-height:1.6">We typically respond within <strong>1–2 business days</strong> at the email address you provided.</p>
                <p style="color:#6b7280;font-size:13px;line-height:1.6">In the meantime, feel free to explore our assessment platform or check our Help &amp; Support section for quick answers.</p>
            `
        )
    );
};

// ── Contact form — admin notification ────────────────────────────────────────
const sendContactAdminNotification = (adminEmail, { name, email, phone, subject, message }) => send(
    adminEmail,
    `New Contact Form – ${subject}`,
    wrap(`New message from ${name}`, `
        <p style="color:#374151;font-size:15px;line-height:1.6">A new contact form submission has been received.</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse">
          <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:100px">Name</td>
              <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;font-size:14px;color:#1f2937;font-weight:700">${name}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Email</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">${email}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Phone</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">${phone || '—'}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Subject</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">${subject}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;vertical-align:top">Message</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#374151;line-height:1.6">${message}</td></tr>
        </table>
        ${btn('View in Admin Panel', `${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/contact`)}
    `)
);

module.exports = { sendOtp, sendIndividualWelcome, sendOrgRegistrationReceived, sendTicketCreated, sendNewTicketAdmin, sendAdminReply, sendUserReply, sendStatusChanged, sendContactThankYou, sendContactAdminNotification };
