const { pool } = require('../config/db');
const { v4: uuidv4 } = require('crypto');

// Simple UUID without extra dependency
const makeRunId = () => {
    const bytes = require('crypto').randomBytes(16);
    return bytes.toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
};

// ── GET /api/testing/summary ─────────────────────────────────────────────────
const getSummary = async (req, res) => {
    try {
        const [[totals]] = await pool.query(`
            SELECT
                COUNT(*)                          AS total_results,
                SUM(status = 'passed')            AS passed,
                SUM(status = 'failed')            AS failed,
                SUM(status = 'warning')           AS warnings,
                SUM(status = 'error')             AS errors,
                SUM(severity = 'critical' AND status IN ('failed','error')) AS critical,
                SUM(dev_status = 'open' AND status IN ('failed','warning','error')) AS open_issues,
                SUM(dev_status = 'completed')     AS resolved
            FROM test_results
        `);

        const [[latestRun]] = await pool.query(`
            SELECT * FROM test_runs ORDER BY started_at DESC LIMIT 1
        `);

        const [suiteBreakdown] = await pool.query(`
            SELECT suite,
                   COUNT(*)                AS total,
                   SUM(status='passed')    AS passed,
                   SUM(status='failed')    AS failed,
                   SUM(status='warning')   AS warnings
            FROM test_results
            WHERE run_id = (SELECT run_id FROM test_runs ORDER BY started_at DESC LIMIT 1)
            GROUP BY suite
        `);

        const [runHistory] = await pool.query(`
            SELECT run_id, suite, status, total, passed, failed, warnings,
                   duration_ms, triggered_by, started_at, completed_at
            FROM test_runs ORDER BY started_at DESC LIMIT 10
        `);

        res.json({ totals, latestRun, suiteBreakdown, runHistory });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── GET /api/testing/results ─────────────────────────────────────────────────
const getResults = async (req, res) => {
    try {
        const { run_id, suite, status, severity, dev_status, page = 1, limit = 30 } = req.query;
        const params = [];
        let where = 'WHERE 1=1';

        // Default to latest run if no run_id specified
        let resolvedRunId = run_id;
        if (!resolvedRunId) {
            const [[latest]] = await pool.query(`SELECT run_id FROM test_runs ORDER BY started_at DESC LIMIT 1`);
            resolvedRunId = latest?.run_id;
        }
        if (resolvedRunId) { where += ' AND run_id = ?'; params.push(resolvedRunId); }
        if (suite && suite !== 'all')           { where += ' AND suite = ?';       params.push(suite); }
        if (status && status !== 'all')         { where += ' AND status = ?';      params.push(status); }
        if (severity && severity !== 'all')     { where += ' AND severity = ?';    params.push(severity); }
        if (dev_status && dev_status !== 'all') { where += ' AND dev_status = ?';  params.push(dev_status); }

        const offset = (Number(page) - 1) * Number(limit);
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM test_results ${where}`, params);
        const [rows] = await pool.query(
            `SELECT * FROM test_results ${where} ORDER BY
             FIELD(severity,'critical','high','medium','low','info'),
             FIELD(status,'error','failed','warning','skipped','passed'),
             id DESC
             LIMIT ? OFFSET ?`,
            [...params, Number(limit), offset]
        );

        res.json({ results: rows, total, page: Number(page), pages: Math.ceil(total / Number(limit)), runId: resolvedRunId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── GET /api/testing/results/:id ─────────────────────────────────────────────
const getResult = async (req, res) => {
    try {
        const [[row]] = await pool.query('SELECT * FROM test_results WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json({ result: row });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── PATCH /api/testing/results/:id/dev-status ────────────────────────────────
const updateDevStatus = async (req, res) => {
    try {
        const { dev_status, dev_note } = req.body;
        const valid = ['open','in_progress','completed','blocked'];
        if (!valid.includes(dev_status)) return res.status(400).json({ error: 'Invalid status' });
        await pool.query(
            'UPDATE test_results SET dev_status = ?, dev_note = ? WHERE id = ?',
            [dev_status, dev_note || null, req.params.id]
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── POST /api/testing/ingest  (called by Python engine) ─────────────────────
// Body: { run_id?, suite, triggered_by?, results: [{...}] }
const ingest = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { suite = 'all', triggered_by = 'python-engine', results = [] } = req.body;
        const runId = req.body.run_id || makeRunId();

        const passed   = results.filter(r => r.status === 'passed').length;
        const failed   = results.filter(r => r.status === 'failed').length;
        const warnings = results.filter(r => r.status === 'warning').length;
        const skipped  = results.filter(r => r.status === 'skipped').length;
        const totalMs  = results.reduce((s, r) => s + (r.duration_ms || 0), 0);

        // Upsert test run
        await conn.query(`
            INSERT INTO test_runs (run_id, suite, triggered_by, status, total, passed, failed, warnings, skipped, duration_ms, completed_at)
            VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                status = 'completed', total = VALUES(total), passed = VALUES(passed),
                failed = VALUES(failed), warnings = VALUES(warnings), skipped = VALUES(skipped),
                duration_ms = VALUES(duration_ms), completed_at = NOW()
        `, [runId, suite, triggered_by, results.length, passed, failed, warnings, skipped, totalMs]);

        // Insert results
        if (results.length > 0) {
            const rows = results.map(r => [
                runId,
                r.suite || suite,
                String(r.test_name || '').slice(0, 499),
                r.category || null,
                ['passed','failed','warning','skipped','error'].includes(r.status) ? r.status : 'passed',
                ['critical','high','medium','low','info'].includes(r.severity) ? r.severity : 'info',
                r.message ? String(r.message).slice(0, 2000) : null,
                r.details  ? String(r.details)               : null,
                r.duration_ms || 0,
            ]);
            await conn.query(
                `INSERT INTO test_results
                 (run_id, suite, test_name, category, status, severity, message, details, duration_ms)
                 VALUES ?`,
                [rows]
            );
        }

        await conn.commit();
        res.json({ ok: true, run_id: runId, ingested: results.length });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
};

// ── POST /api/testing/trigger  (start a run – sets pending flag) ─────────────
const triggerRun = async (req, res) => {
    try {
        const { suite = 'all' } = req.body;
        const runId = makeRunId();
        await pool.query(
            `INSERT INTO test_runs (run_id, suite, triggered_by, status) VALUES (?, ?, 'admin-panel', 'pending')`,
            [runId, suite]
        );
        res.json({ ok: true, run_id: runId, message: 'Run queued. Start the Python engine with this run_id.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── GET /api/testing/runs ────────────────────────────────────────────────────
const getRuns = async (req, res) => {
    try {
        const [runs] = await pool.query(
            `SELECT * FROM test_runs ORDER BY started_at DESC LIMIT 20`
        );
        res.json({ runs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

module.exports = { getSummary, getResults, getResult, updateDevStatus, ingest, triggerRun, getRuns };
