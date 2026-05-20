const { pool } = require('../config/db');

// ── POST /api/errors/log  (public – called by frontend error tracker) ─────────
const logError = async (req, res) => {
    try {
        const {
            fingerprint, message, stack, error_type, source_type,
            severity, page_url, page_title, browser, os,
            device_type, app_version, session_id,
        } = req.body;

        if (!message) return res.status(400).json({ ok: false });

        await pool.query(
            `INSERT INTO crash_logs
             (fingerprint, message, stack, error_type, source_type, severity,
              page_url, page_title, browser, os, device_type, app_version, session_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fingerprint || '00000000',
                String(message).slice(0, 2000),
                stack ? String(stack).slice(0, 8000) : null,
                error_type || 'Error',
                source_type || 'window_error',
                ['fatal','error','warning','info'].includes(severity) ? severity : 'error',
                page_url   ? String(page_url).slice(0, 1000)   : null,
                page_title ? String(page_title).slice(0, 500)  : null,
                browser    ? String(browser).slice(0, 150)     : null,
                os         ? String(os).slice(0, 150)          : null,
                device_type ? String(device_type).slice(0, 50) : null,
                app_version ? String(app_version).slice(0, 50) : null,
                session_id  ? String(session_id).slice(0, 100) : null,
            ]
        );
        res.json({ ok: true });
    } catch (e) {
        console.error('crashLog insert error:', e.message);
        res.status(500).json({ ok: false });
    }
};

// ── GET /api/errors/summary  (admin) ─────────────────────────────────────────
const getSummary = async (req, res) => {
    try {
        const [[totals]] = await pool.query(`
            SELECT
                COUNT(*)                                         AS total,
                SUM(severity = 'fatal')                          AS fatal,
                SUM(severity = 'error')                          AS errors,
                SUM(severity = 'warning')                        AS warnings,
                SUM(severity = 'info')                           AS info,
                SUM(status   = 'open')                           AS open,
                SUM(status   = 'resolved')                       AS resolved,
                SUM(status   = 'ignored')                        AS ignored,
                COUNT(DISTINCT fingerprint)                      AS unique_errors,
                COUNT(DISTINCT session_id)                       AS affected_sessions,
                COUNT(DISTINCT DATE(created_at))                 AS active_days
            FROM crash_logs
        `);

        // Errors in last 24h vs previous 24h for trend
        const [[trend]] = await pool.query(`
            SELECT
                SUM(created_at >= NOW() - INTERVAL 24 HOUR)     AS last_24h,
                SUM(created_at BETWEEN NOW() - INTERVAL 48 HOUR AND NOW() - INTERVAL 24 HOUR) AS prev_24h
            FROM crash_logs WHERE status != 'ignored'
        `);

        // Last 7 days daily count for sparkline
        const [daily] = await pool.query(`
            SELECT DATE(created_at) AS day, COUNT(*) AS count
            FROM crash_logs
            WHERE created_at >= NOW() - INTERVAL 7 DAY
            GROUP BY day ORDER BY day ASC
        `);

        res.json({ summary: { ...totals, ...trend, daily } });
    } catch (e) {
        console.error('getSummary error:', e.message);
        res.status(500).json({ error: e.message });
    }
};

// ── GET /api/errors/list  (admin) ─────────────────────────────────────────────
const getErrors = async (req, res) => {
    try {
        const {
            severity, status = 'open', search,
            page = 1, limit = 30,
            sort = 'newest',
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);
        const params = [];
        let where = 'WHERE 1=1';

        if (severity && severity !== 'all') { where += ' AND severity = ?'; params.push(severity); }
        if (status   && status   !== 'all') { where += ' AND status = ?';   params.push(status);   }
        if (search)  { where += ' AND (message LIKE ? OR error_type LIKE ? OR page_url LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }

        const orderBy = sort === 'oldest' ? 'created_at ASC' : sort === 'frequent' ? 'id DESC' : 'created_at DESC';

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM crash_logs ${where}`, params
        );

        const [rows] = await pool.query(
            `SELECT id, fingerprint, message, error_type, source_type, severity,
                    page_url, page_title, browser, os, device_type,
                    app_version, status, session_id, created_at
             FROM crash_logs ${where}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`,
            [...params, Number(limit), offset]
        );

        res.json({ errors: rows, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── GET /api/errors/:id  (admin) ──────────────────────────────────────────────
const getError = async (req, res) => {
    try {
        const [[row]] = await pool.query('SELECT * FROM crash_logs WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Not found' });

        // Fetch related errors (same fingerprint)
        const [related] = await pool.query(
            `SELECT id, message, severity, status, created_at
             FROM crash_logs WHERE fingerprint = ? AND id != ? ORDER BY created_at DESC LIMIT 5`,
            [row.fingerprint, row.id]
        );

        res.json({ error: row, related });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── PATCH /api/errors/:id/status  (admin) ────────────────────────────────────
const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['open','resolved','ignored'].includes(status))
            return res.status(400).json({ error: 'Invalid status' });

        await pool.query('UPDATE crash_logs SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── PATCH /api/errors/bulk-status  (admin) ────────────────────────────────────
const bulkUpdateStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
        if (!['open','resolved','ignored'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
        await pool.query('UPDATE crash_logs SET status = ? WHERE id IN (?)', [status, ids]);
        res.json({ ok: true, updated: ids.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── DELETE /api/errors/purge  (admin) ────────────────────────────────────────
const purgeResolved = async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM crash_logs WHERE status IN ('resolved','ignored')"
        );
        res.json({ ok: true, deleted: result.affectedRows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = { logError, getSummary, getErrors, getError, updateStatus, bulkUpdateStatus, purgeResolved };
