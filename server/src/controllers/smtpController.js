const { pool } = require('../config/db');

const getSmtpSettings = async (req, res) => {
    try {
        const [[row]] = await pool.query('SELECT * FROM smtp_settings WHERE id = 1');
        if (!row) return res.json({ settings: {} });
        const safe = { ...row };
        if (safe.password) safe.password = '••••••••';
        return res.json({ settings: safe });
    } catch (err) {
        console.error('getSmtpSettings error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

const updateSmtpSettings = async (req, res) => {
    try {
        const { host, port, username, password, encryption, from_email, from_name } = req.body;

        const fields = {
            host:       host       || null,
            port:       parseInt(port) || 587,
            username:   username   || null,
            encryption: ['none', 'tls', 'ssl'].includes(encryption) ? encryption : 'tls',
            from_email: from_email || null,
            from_name:  from_name  || 'Sangian Support',
        };
        if (password && password !== '••••••••') fields.password = password;

        const cols   = Object.keys(fields);
        const vals   = Object.values(fields);
        const setStr = cols.map(c => `${c} = ?`).join(', ');

        await pool.query(
            `INSERT INTO smtp_settings (id, ${cols.join(', ')}) VALUES (1, ${cols.map(() => '?').join(', ')})
             ON DUPLICATE KEY UPDATE ${setStr}`,
            [...vals, ...vals]
        );
        return res.json({ success: true });
    } catch (err) {
        console.error('updateSmtpSettings error:', err);
        return res.status(500).json({ error: 'Server error.' });
    }
};

const testSmtpConnection = async (req, res) => {
    try {
        const nodemailer = require('nodemailer');
        const [[row]] = await pool.query('SELECT * FROM smtp_settings WHERE id = 1');
        if (!row || !row.host || !row.username) {
            return res.status(400).json({ error: 'SMTP is not configured yet.' });
        }
        const transporter = nodemailer.createTransport({
            host:   row.host,
            port:   row.port || 587,
            secure: row.encryption === 'ssl',
            auth:   { user: row.username, pass: row.password },
        });
        await transporter.verify();
        return res.json({ success: true, message: 'SMTP connection successful.' });
    } catch (err) {
        return res.status(400).json({ error: `SMTP connection failed: ${err.message}` });
    }
};

module.exports = { getSmtpSettings, updateSmtpSettings, testSmtpConnection };
