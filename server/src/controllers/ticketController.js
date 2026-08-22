const { pool }   = require('../config/db');
const jwt         = require('jsonwebtoken');
const email       = require('../services/emailService');

const JWT_SECRET  = process.env.JWT_SECRET || 'your_jwt_secret_key';

// ── OTP rate-limit store (in-memory, per email) ───────────────────────────────
// Key: email → { count, windowStart }
const otpRateLimit = new Map();
const OTP_WINDOW_MS   = 10 * 60 * 1000; // 10 min
const OTP_MAX_SEND    = 5;              // max sends per window per email

const checkOtpRateLimit = (emailAddr) => {
    const now  = Date.now();
    const rec  = otpRateLimit.get(emailAddr);
    if (!rec || now - rec.windowStart > OTP_WINDOW_MS) {
        otpRateLimit.set(emailAddr, { count: 1, windowStart: now });
        return true;
    }
    if (rec.count >= OTP_MAX_SEND) return false;
    rec.count++;
    return true;
};

const randomOtp = () => String(Math.floor(100000 + Math.random() * 900000));

// ── POST /api/tickets/send-otp ────────────────────────────────────────────────
const sendOtp = async (req, res) => {
    try {
        const raw = (req.body.email || '').trim().toLowerCase();
        if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
            return res.status(400).json({ error: 'Valid email address is required.' });
        }

        if (!checkOtpRateLimit(raw)) {
            return res.status(429).json({ error: 'Too many OTP requests. Please wait 10 minutes before trying again.' });
        }

        const otp     = randomOtp();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        const conn = await pool.getConnection();
        // Upsert: delete old verifications for this email and insert fresh
        await conn.query('DELETE FROM email_verifications WHERE email = ?', [raw]);
        await conn.query(
            'INSERT INTO email_verifications (email, otp, expires_at, verified, attempts) VALUES (?, ?, ?, 0, 0)',
            [raw, otp, expires]
        );
        conn.release();

        const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_HOST);

        // Send email (fire-and-forget; don't fail the response on email error)
        email.sendOtp(raw, otp).catch(e => console.error('OTP email error:', e.message));

        // In dev mode (no SMTP), return OTP in the response body so it can be displayed in the UI
        const response = { success: true, message: 'OTP sent to your email address.' };
        if (!smtpConfigured) {
            response.devOtp = otp;
            response.devNote = 'Email not configured — OTP shown here for development only.';
        }

        return res.json(response);
    } catch (err) {
        console.error('sendOtp error:', err);
        return res.status(500).json({ error: 'Server error. Please try again.' });
    }
};

// ── POST /api/tickets/verify-otp ──────────────────────────────────────────────
const verifyOtp = async (req, res) => {
    try {
        const raw  = (req.body.email || '').trim().toLowerCase();
        const otp  = (req.body.otp   || '').trim();

        if (!raw || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required.' });
        }

        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            'SELECT * FROM email_verifications WHERE email = ? ORDER BY created_at DESC LIMIT 1',
            [raw]
        );

        if (!rows.length) {
            conn.release();
            return res.status(400).json({ error: 'No OTP found for this email. Please request a new one.' });
        }

        const record = rows[0];

        if (new Date() > new Date(record.expires_at)) {
            conn.release();
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        if (record.attempts >= 5) {
            conn.release();
            return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
        }

        if (record.otp !== otp) {
            await conn.query(
                'UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?',
                [record.id]
            );
            conn.release();
            return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
        }

        // Mark verified
        await conn.query('UPDATE email_verifications SET verified = 1 WHERE id = ?', [record.id]);
        conn.release();

        // Issue a short-lived "verified email" token (30 min)
        const token = jwt.sign({ email: raw, purpose: 'ticket_access' }, JWT_SECRET, { expiresIn: '30m' });

        return res.json({ success: true, token, email: raw });
    } catch (err) {
        console.error('verifyOtp error:', err);
        return res.status(500).json({ error: 'Server error. Please try again.' });
    }
};

// ── Verified-token middleware (public ticket routes) ──────────────────────────
const requireVerifiedEmail = (req, res, next) => {
    const header = req.headers['x-ticket-token'] || req.headers.authorization;
    const token  = header && header.startsWith('Bearer ') ? header.slice(7) : header;
    if (!token) return res.status(401).json({ error: 'Email verification required.' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.purpose !== 'ticket_access') throw new Error('Invalid token purpose');
        req.verifiedEmail = payload.email;
        next();
    } catch {
        return res.status(401).json({ error: 'Verification token is invalid or expired. Please verify your email again.' });
    }
};

// ── POST /api/tickets/create ──────────────────────────────────────────────────
const createTicket = async (req, res) => {
    try {
        const { title, description } = req.body;
        const userEmail = req.verifiedEmail;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Ticket title is required.' });
        }
        if (!description || !description.trim()) {
            return res.status(400).json({ error: 'Description is required.' });
        }
        if (title.trim().length > 255) {
            return res.status(400).json({ error: 'Title must be under 255 characters.' });
        }

        // Handle up to 3 attachments
        const files = req.files || [];
        if (files.length > 3) {
            return res.status(400).json({ error: 'Maximum 3 attachments allowed.' });
        }
        const attachments = files.map(f => `/uploads/tickets/${f.filename}`);

        const conn = await pool.getConnection();

        // Insert ticket (ticket_id set after getting insertId)
        const [result] = await conn.query(
            `INSERT INTO tickets (ticket_id, email, title, description, status)
             VALUES ('PENDING', ?, ?, ?, 'open')`,
            [userEmail, title.trim(), description.trim()]
        );

        const insertId  = result.insertId;
        const year      = new Date().getFullYear();
        const ticket_id = `SGN-${year}-${String(insertId).padStart(5, '0')}`;

        await conn.query('UPDATE tickets SET ticket_id = ? WHERE id = ?', [ticket_id, insertId]);

        // Insert first message (user's description) including any attachments
        await conn.query(
            `INSERT INTO ticket_messages (ticket_id, sender_type, message, attachments, is_read)
             VALUES (?, 'user', ?, ?, 1)`,
            [ticket_id, description.trim(), attachments.length ? JSON.stringify(attachments) : null]
        );

        conn.release();

        const ticketData = { ticket_id, email: userEmail, title: title.trim(), description: description.trim() };

        // Emails — fire-and-forget
        email.sendTicketCreated(userEmail, ticketData).catch(e => console.error('Email error:', e.message));
        email.sendNewTicketAdmin(ticketData).catch(e => console.error('Email error:', e.message));

        return res.json({ success: true, ticket_id });
    } catch (err) {
        console.error('createTicket error:', err);
        return res.status(500).json({ error: 'Server error. Please try again.' });
    }
};

// ── GET /api/tickets/my-tickets ───────────────────────────────────────────────
const getMyTickets = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT t.ticket_id, t.title, t.status, t.created_at, t.updated_at,
                    (SELECT COUNT(*) FROM ticket_messages tm
                     WHERE tm.ticket_id = t.ticket_id AND tm.sender_type = 'admin' AND tm.is_read = 0) AS unread_count
             FROM tickets t WHERE t.email = ?
             ORDER BY t.created_at DESC`,
            [req.verifiedEmail]
        );
        return res.json({ tickets: rows });
    } catch (err) {
        console.error('getMyTickets error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ── GET /api/tickets/:ticket_id ───────────────────────────────────────────────
const getTicketDetail = async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const [tickets] = await pool.query(
            'SELECT * FROM tickets WHERE ticket_id = ? AND email = ?',
            [ticket_id, req.verifiedEmail]
        );
        if (!tickets.length) {
            return res.status(404).json({ error: 'Ticket not found or access denied.' });
        }

        const [messages] = await pool.query(
            'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
            [ticket_id]
        );

        // Mark all unread admin messages as read now that user has opened the ticket
        await pool.query(
            `UPDATE ticket_messages SET is_read = 1
             WHERE ticket_id = ? AND sender_type = 'admin' AND is_read = 0`,
            [ticket_id]
        );

        return res.json({ ticket: tickets[0], messages });
    } catch (err) {
        console.error('getTicketDetail error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ── POST /api/tickets/:ticket_id/reply ────────────────────────────────────────
const replyToTicket = async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { message }   = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        const files = req.files || [];
        if (files.length > 3) {
            return res.status(400).json({ error: 'Maximum 3 attachments allowed.' });
        }
        const attachments = files.map(f => `/uploads/tickets/${f.filename}`);

        const conn = await pool.getConnection();
        const [tickets] = await conn.query(
            'SELECT * FROM tickets WHERE ticket_id = ? AND email = ?',
            [ticket_id, req.verifiedEmail]
        );

        if (!tickets.length) {
            conn.release();
            return res.status(404).json({ error: 'Ticket not found or access denied.' });
        }

        const ticket = tickets[0];
        if (ticket.status === 'closed') {
            conn.release();
            return res.status(400).json({ error: 'This ticket is closed and cannot receive new replies.' });
        }

        await conn.query(
            `INSERT INTO ticket_messages (ticket_id, sender_type, message, attachments)
             VALUES (?, 'user', ?, ?)`,
            [ticket_id, message.trim(), attachments.length ? JSON.stringify(attachments) : null]
        );

        // If ticket was waiting for user, move it back to in_progress
        if (ticket.status === 'waiting_for_user') {
            await conn.query("UPDATE tickets SET status = 'in_progress' WHERE ticket_id = ?", [ticket_id]);
        }

        conn.release();

        const preview = message.trim().substring(0, 200) + (message.trim().length > 200 ? '…' : '');
        email.sendUserReply(ticket_id, req.verifiedEmail, preview).catch(e => console.error('Email error:', e.message));

        return res.json({ success: true });
    } catch (err) {
        console.error('replyToTicket error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/tickets ────────────────────────────────────────────────────
const adminGetTickets = async (req, res) => {
    try {
        const { status, email: emailFilter, ticket_id: idFilter, date_from, date_to, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where  = [];
        let params = [];

        if (status)      { where.push('status = ?');         params.push(status); }
        if (emailFilter) { where.push('email LIKE ?');        params.push(`%${emailFilter}%`); }
        if (idFilter)    { where.push('ticket_id LIKE ?');    params.push(`%${idFilter}%`); }
        if (date_from)   { where.push('created_at >= ?');     params.push(date_from); }
        if (date_to)     { where.push('created_at <= ?');     params.push(date_to + ' 23:59:59'); }

        const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [rows]    = await pool.query(
            `SELECT ticket_id, email, title, status, created_at, updated_at FROM tickets ${whereStr}
             ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM tickets ${whereStr}`, params
        );

        // Unread reply counts (messages since last admin message)
        const ticketIds = rows.map(r => r.ticket_id);
        let unreads = {};
        if (ticketIds.length) {
            const placeholders = ticketIds.map(() => '?').join(',');
            const [unreadRows] = await pool.query(
                `SELECT t.ticket_id,
                 COUNT(m.id) AS unread
                 FROM tickets t
                 LEFT JOIN ticket_messages m ON m.ticket_id = t.ticket_id
                   AND m.sender_type = 'user'
                   AND m.created_at > COALESCE(
                     (SELECT MAX(m2.created_at) FROM ticket_messages m2
                      WHERE m2.ticket_id = t.ticket_id AND m2.sender_type = 'admin'), '1970-01-01')
                 WHERE t.ticket_id IN (${placeholders})
                 GROUP BY t.ticket_id`,
                ticketIds
            );
            unreadRows.forEach(r => { unreads[r.ticket_id] = r.unread; });
        }

        const enriched = rows.map(r => ({ ...r, unread_replies: unreads[r.ticket_id] || 0 }));

        return res.json({ tickets: enriched, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        console.error('adminGetTickets error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ── GET /api/admin/tickets/:ticket_id ─────────────────────────────────────────
const adminGetTicket = async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const [tickets] = await pool.query('SELECT * FROM tickets WHERE ticket_id = ?', [ticket_id]);
        if (!tickets.length) return res.status(404).json({ error: 'Ticket not found.' });

        const [messages] = await pool.query(
            'SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC',
            [ticket_id]
        );

        return res.json({ ticket: tickets[0], messages });
    } catch (err) {
        console.error('adminGetTicket error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ── POST /api/admin/tickets/:ticket_id/status ─────────────────────────────────
const adminUpdateStatus = async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { status }    = req.body;

        const valid = ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'];
        if (!valid.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value.' });
        }

        const [result] = await pool.query(
            'UPDATE tickets SET status = ? WHERE ticket_id = ?', [status, ticket_id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Ticket not found.' });

        const [[ticket]] = await pool.query('SELECT email FROM tickets WHERE ticket_id = ?', [ticket_id]);
        email.sendStatusChanged(ticket.email, ticket_id, status).catch(e => console.error('Email error:', e.message));

        return res.json({ success: true });
    } catch (err) {
        console.error('adminUpdateStatus error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ── POST /api/admin/tickets/:ticket_id/share-status ───────────────────────────
// "Share Status with Customer" button on the Ticket Details page — a manual
// re-send of the ticket's current status, independent of adminUpdateStatus
// above (which only emails when the status actually changes).
const adminShareStatus = async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const [[ticket]] = await pool.query(
            'SELECT ticket_id, email, title, status FROM tickets WHERE ticket_id = ?', [ticket_id]
        );
        if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

        const result = await email.sendTicketStatusShared(ticket.email, {
            ticket_id: ticket.ticket_id, subject: ticket.title, status: ticket.status,
        });
        if (!result.delivered) {
            const message = result.reason === 'disabled'
                ? 'This notification is turned off in Settings → Notifications.'
                : 'Failed to send the email — check SMTP settings.';
            return res.json({ success: false, message });
        }

        return res.json({ success: true, message: 'Status shared with the customer.' });
    } catch (err) {
        console.error('adminShareStatus error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ── POST /api/admin/tickets/:ticket_id/reply ──────────────────────────────────
const adminReply = async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { message }   = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required.' });
        }

        const files = req.files || [];
        if (files.length > 3) {
            return res.status(400).json({ error: 'Maximum 3 attachments allowed.' });
        }
        const attachments = files.map(f => `/uploads/tickets/${f.filename}`);

        const conn = await pool.getConnection();
        const [tickets] = await conn.query('SELECT * FROM tickets WHERE ticket_id = ?', [ticket_id]);
        if (!tickets.length) {
            conn.release();
            return res.status(404).json({ error: 'Ticket not found.' });
        }

        await conn.query(
            `INSERT INTO ticket_messages (ticket_id, sender_type, message, attachments, is_read)
             VALUES (?, 'admin', ?, ?, 0)`,
            [ticket_id, message.trim(), attachments.length ? JSON.stringify(attachments) : null]
        );

        // Move ticket to in_progress if it was open
        if (tickets[0].status === 'open') {
            await conn.query("UPDATE tickets SET status = 'in_progress' WHERE ticket_id = ?", [ticket_id]);
        }

        conn.release();

        const preview = message.trim().substring(0, 200) + (message.trim().length > 200 ? '…' : '');
        email.sendAdminReply(tickets[0].email, ticket_id, preview).catch(e => console.error('Email error:', e.message));

        return res.json({ success: true });
    } catch (err) {
        console.error('adminReply error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ── GET /api/admin/tickets/stats ──────────────────────────────────────────────
const adminTicketStats = async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT status, COUNT(*) AS count FROM tickets GROUP BY status`
        );
        const stats = { open: 0, in_progress: 0, waiting_for_user: 0, resolved: 0, closed: 0, total: 0 };
        rows.forEach(r => { stats[r.status] = r.count; stats.total += r.count; });
        return res.json(stats);
    } catch (err) {
        console.error('adminTicketStats error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

// ── GET /api/admin/tickets/active-count ───────────────────────────────────────
const adminActiveTicketCount = async (_req, res) => {
    try {
        const [[{ count }]] = await pool.query(
            `SELECT COUNT(*) AS count FROM tickets WHERE status NOT IN ('closed')`
        );
        return res.json({ success: true, count });
    } catch (err) {
        console.error('adminActiveTicketCount error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

module.exports = {
    sendOtp, verifyOtp, requireVerifiedEmail,
    createTicket, getMyTickets, getTicketDetail, replyToTicket,
    adminGetTickets, adminGetTicket, adminUpdateStatus, adminShareStatus, adminReply, adminTicketStats,
    adminActiveTicketCount,
};
