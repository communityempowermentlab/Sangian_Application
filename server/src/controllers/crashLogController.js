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

// ── POST /api/errors/generate-samples  (admin) ───────────────────────────────
const generateSampleLogs = async (req, res) => {
    const samples = [
        // ── Frontend / React Errors ───────────────────────────────────────────
        {
            fingerprint: 'a1b2c3d4', severity: 'fatal', source_type: 'window_error',
            error_type: 'TypeError', message: "Cannot read properties of undefined (reading 'map')",
            stack: "TypeError: Cannot read properties of undefined (reading 'map')\n    at ChaloMelaChaleGame (ChaloMelaChaleGame.jsx:287:23)\n    at renderWithHooks (react-dom.development.js:14985:18)\n    at mountIndeterminateComponent (react-dom.development.js:17811:13)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Chrome', os: 'Windows', device_type: 'Desktop', session_id: 'sess_001',
        },
        {
            fingerprint: 'd4e5f6a1', severity: 'fatal', source_type: 'window_error',
            error_type: 'ReferenceError', message: "isMountedRef is not defined",
            stack: "ReferenceError: isMountedRef is not defined\n    at useEffect (ChaloMelaChaleGame.jsx:379:5)\n    at commitHookEffectListMount (react-dom.development.js:23150:26)\n    at commitPassiveMountOnFiber (react-dom.development.js:24926:13)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Firefox', os: 'macOS', device_type: 'Desktop', session_id: 'sess_004',
        },
        {
            fingerprint: 'c9e1a3b5', severity: 'fatal', source_type: 'window_error',
            error_type: 'RenderError', message: 'Broken route navigation — /games/chalo_mela_chale returned blank component',
            stack: "Error: Element type is invalid: expected a string or class/function but got: undefined\n    at createFiberFromElement (react-dom.development.js:6482:11)\n    at createFiberFromTypeAndProps (react-dom.development.js:6515:7)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Chrome', os: 'Windows', device_type: 'Desktop', session_id: 'sess_015',
        },
        // ── Game Errors ───────────────────────────────────────────────────────
        {
            fingerprint: 'b2c3d4e5', severity: 'error', source_type: 'window_error',
            error_type: 'NotAllowedError', message: 'Audio playback failed: NotAllowedError — autoplay policy blocked',
            stack: "NotAllowedError: play() failed because the user didn't interact with the document first.\n    at playAudio (ChaloMelaChaleGame.jsx:556:19)\n    at startAutoDemoA (ChaloMelaChaleGame.jsx:733:5)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Safari', os: 'macOS', device_type: 'Desktop', session_id: 'sess_002',
        },
        {
            fingerprint: 'c3d4e5f6', severity: 'warning', source_type: 'manual',
            error_type: 'AudioLeakError', message: 'Audio continues playing after navigation to dashboard',
            stack: "Error: Audio leak detected — background audio active after component unmount\n    at stopAll (ChaloMelaChaleGame.jsx:368:5)\n    at handlePauseAction (ChaloMelaChaleGame.jsx:1014:5)\n    at onClick (ChaloMelaChaleGame.jsx:1569:7)",
            page_url: '/', page_title: 'Dashboard',
            browser: 'Chrome', os: 'Windows', device_type: 'Desktop', session_id: 'sess_003',
        },
        {
            fingerprint: 'e5f6a1b2', severity: 'error', source_type: 'manual',
            error_type: 'GameStateError', message: 'Timer started before game state was initialised — questionState.id is empty',
            stack: "Error: Timer fired but questionState.id is empty\n    at startTrial (ChaloMelaChaleGame.jsx:607:5)\n    at safeSetTimeout.callback (ChaloMelaChaleGame.jsx:668:5)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Edge', os: 'Windows', device_type: 'Desktop', session_id: 'sess_005',
        },
        {
            fingerprint: 'f6a1b2c3', severity: 'warning', source_type: 'manual',
            error_type: 'ScoreError', message: 'Score calculation mismatch: computed 3 but allScores reported 5',
            stack: "Error: Score mismatch detected\n    at handleResult (ChaloMelaChaleGame.jsx:810:5)\n    at handleGridClick (ChaloMelaChaleGame.jsx:806:7)\n    at onClick (ChaloMelaChaleGame.jsx:1344:45)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Chrome', os: 'Android', device_type: 'Mobile', session_id: 'sess_006',
        },
        {
            fingerprint: 'a1c3e5f7', severity: 'error', source_type: 'promise_rejection',
            error_type: 'SessionResumeError', message: "Failed to resume paused game session — Cannot destructure 'allScores' of undefined",
            stack: "TypeError: Cannot destructure property 'allScores' of undefined\n    at resumeGame (ChaloMelaChaleGame.jsx:444:15)\n    at onClick (ChaloMelaChaleGame.jsx:1592:5)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Chrome', os: 'iOS', device_type: 'Mobile', session_id: 'sess_007',
        },
        // ── API Errors ────────────────────────────────────────────────────────
        {
            fingerprint: 'b2d4f6a8', severity: 'fatal', source_type: 'promise_rejection',
            error_type: 'AxiosError', message: 'API Error 500: Internal Server Error — POST /api/games/sessions/start',
            stack: "AxiosError: Request failed with status code 500\n    at settle (axios.js:193:12)\n    at XMLHttpRequest.onloadend (axios.js:1549:7)\n    at startNewGame (ChaloMelaChaleGame.jsx:485:25)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Chrome', os: 'Windows', device_type: 'Desktop', session_id: 'sess_008',
        },
        {
            fingerprint: 'c3e5a7b9', severity: 'error', source_type: 'promise_rejection',
            error_type: 'AuthError', message: 'API Error 401: Authentication failed — token expired',
            stack: "AxiosError: Request failed with status code 401\n    at settle (axios.js:193:12)\n    at loadErrors (AdminSettings.jsx:397:25)\n    at async useEffect (AdminSettings.jsx:415:5)",
            page_url: '/admin/settings', page_title: 'Admin Settings',
            browser: 'Safari', os: 'macOS', device_type: 'Desktop', session_id: 'sess_009',
        },
        {
            fingerprint: 'd4f6b8c0', severity: 'warning', source_type: 'promise_rejection',
            error_type: 'TimeoutError', message: 'Network timeout — PUT /api/games/sessions/update (>30s)',
            stack: "AxiosError: timeout of 30000ms exceeded\n    at createError (axios.js:16:15)\n    at dispatchXhrRequest (axios.js:210:26)\n    at saveToServer (ChaloMelaChaleGame.jsx:519:25)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Firefox', os: 'Windows', device_type: 'Desktop', session_id: 'sess_010',
        },
        // ── Device / Browser Errors ───────────────────────────────────────────
        {
            fingerprint: 'e5a7c9d1', severity: 'error', source_type: 'window_error',
            error_type: 'DOMException', message: "Media autoplay blocked — browser requires user gesture first",
            stack: "DOMException: play() failed because the user didn't interact with the document first.\n    at HTMLAudioElement.play (<anonymous>)\n    at playAudio (ChaloMelaChaleGame.jsx:568:19)\n    at useEffect (ChaloMelaChaleGame.jsx:748:7)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Chrome', os: 'Android', device_type: 'Mobile', session_id: 'sess_011',
        },
        {
            fingerprint: 'f6b8d0e2', severity: 'warning', source_type: 'window_error',
            error_type: 'ResourceError', message: 'Low memory warning — game asset failed to load on mobile device',
            stack: "Error: Image load failed: /assets/images/chalo_mela_chale/7-T2.png\n    at HTMLImageElement.onerror (<anonymous>:1:1)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Chrome', os: 'Android', device_type: 'Mobile', session_id: 'sess_012',
        },
        {
            fingerprint: 'a7c9e1f3', severity: 'fatal', source_type: 'window_error',
            error_type: 'HydrationError', message: 'Blank screen after page reload — React hydration mismatch',
            stack: "Error: Hydration failed because the initial UI does not match what was rendered on the server.\n    at throwOnHydrationMismatch (react-dom.development.js:12507:9)\n    at tryToClaimNextHydratableInstance (react-dom.development.js:14388:5)",
            page_url: '/', page_title: 'Dashboard',
            browser: 'Safari', os: 'iOS', device_type: 'Mobile', session_id: 'sess_013',
        },
        {
            fingerprint: 'b8d0f2a4', severity: 'error', source_type: 'window_error',
            error_type: 'ResourceNotFoundError', message: 'Failed to load game audio: SB_splash.wav — 404 Not Found',
            stack: "Error: GET /assets/audios/chalo_mela_chale/SB_splash.wav 404 (Not Found)\n    at playAudio (ChaloMelaChaleGame.jsx:555:20)\n    at useEffect (ChaloMelaChaleGame.jsx:748:9)",
            page_url: '/games/chalo_mela_chale', page_title: 'Chalo Mela Chalen',
            browser: 'Edge', os: 'Windows', device_type: 'Desktop', session_id: 'sess_014',
        },
    ];

    try {
        await Promise.all(samples.map(s =>
            pool.query(
                `INSERT INTO crash_logs
                 (fingerprint, message, stack, error_type, source_type, severity,
                  page_url, page_title, browser, os, device_type, app_version, session_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    s.fingerprint, s.message, s.stack, s.error_type, s.source_type,
                    s.severity, s.page_url, s.page_title, s.browser, s.os,
                    s.device_type, '1.0.0', s.session_id,
                ]
            )
        ));
        res.json({ ok: true, inserted: samples.length });
    } catch (e) {
        console.error('generateSampleLogs error:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
};

module.exports = { logError, getSummary, getErrors, getError, updateStatus, bulkUpdateStatus, purgeResolved, generateSampleLogs };
