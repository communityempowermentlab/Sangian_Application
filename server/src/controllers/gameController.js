const { pool } = require('../config/db');

// Rover coin budget per question (t2 + 4 bonus coins) — mirrors client-side ROVER_Q_BUDGET
const ROVER_Q_BUDGET = {
    tq1: 7, tq2: 7, tq3: 7, tq4: 9,
    q1: 7, q2: 7, q3: 8,  q4: 6,  q5: 8,  q6: 9,  q7: 9,  q8: 8,
    q9: 10, q10: 9, q11: 10, q12: 11, q13: 9, q14: 9, q15: 11,
    q16: 13, q17: 12, q18: 12,
};

// Safely parse a session's saved_state JSON, tolerating already-parsed objects and
// (historically possible) double-encoded strings.
const parseSavedState = (raw) => {
    let parsed = raw;
    try {
        if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        }
    } catch (_) { parsed = {}; }
    return parsed || {};
};

// Sums each question's tracked play time from a session's saved_state (excluding Teaching
// questions for rover_mela/chalo_mela_chale), falling back to the continuous timerSeconds
// counter only when no per-question times were recorded at all. This is the single source
// of truth for the "Duration" / actual_game_time figure shown in report detail, CSV export,
// and the dashboard's Average Game Time KPI — keep all three wired through this function so
// they can't drift apart again.
const computeActualGameTime = (parsedState, gameName) => {
    // Teaching-question entries (e.g. number_recall_lottery[/_v2]) are stored separately
    // in saved_state.teachingScores but scored like standard questions — fold them in here
    // so Duration/avg-game-time stay consistent with the client's combined total.
    const teachingScores = Array.isArray(parsedState?.teachingScores) ? parsedState.teachingScores : [];
    const scores = [...teachingScores, ...(Array.isArray(parsedState?.allScores) ? parsedState.allScores : [])];
    const chorItems = Array.isArray(parsedState?.itemResults) ? parsedState.itemResults : [];
    const allItems = chorItems.length > 0 ? chorItems : scores;
    const scoringItems = ['rover_mela', 'chalo_mela_chale'].includes(gameName)
        ? allItems.filter(s => { const id = s.id || s.qId || ''; return !String(id).startsWith('tq'); })
        : allItems;
    let time = scoringItems.reduce((sum, s) => sum + (parseFloat(s.timeTaken ?? s.duration_ms) || 0), 0);
    if (time === 0 && parsedState?.timerSeconds) time = parsedState.timerSeconds;
    return time;
};

// The continuous per-session "Screentime" figure shown in report detail/CSV — falls back to
// timerSeconds for the handful of games that don't save a dedicated screentime field. Safe to
// share this fallback with computeActualGameTime() above: that one sums per-question time
// (usually well below the continuous session timer), so the two rarely coincide in practice.
const computeScreenTime = (parsedState) => parsedState?.screentime ?? parsedState?.timerSeconds ?? null;

// Maps every historical/alternate spelling of a game_name to its canonical catalog key —
// mirrors the CASE expression previously duplicated inline in the overview SQL query.
const normalizeGameName = (name) => {
    if (['Chalo Mela Chale', 'chalo_mela_chale', 'rover_mela', 'Rover Test', 'Rover Game'].includes(name)) return 'rover_mela';
    if (['chor_machaye_shor', 'cognitive_flex_chor'].includes(name)) return 'cognitive_flex_chor';
    if (['literacy_reading_skill', 'reading_skill', 'Padh ke batao'].includes(name)) return 'literacy_reading_skill';
    if (['numeracy_number_skill', 'Ankganit'].includes(name)) return 'numeracy_number_skill';
    if (['working_memory_herpher', 'Her Pher'].includes(name)) return 'working_memory_herpher';
    if (['working_memory_herpher_v2', 'Her Pher - Version 2'].includes(name)) return 'working_memory_herpher_v2';
    if (['atlantis_bagiya', 'Bagiya', 'Atlantis Test', 'Atlantis Game'].includes(name)) return 'atlantis_bagiya';
    return name;
};

// Start a new game session
exports.startGameSession = async (req, res) => {
    try {
        const { child_id, game_name, total_questions } = req.body;

        if (!child_id || !game_name) {
            return res.status(400).json({ success: false, message: 'child_id and game_name are required' });
        }

        let normalizedName = game_name;
        if (['Chalo Mela Chale', 'chalo_mela_chale'].includes(game_name)) {
            normalizedName = 'rover_mela';
        }
        if (game_name === 'chor_machaye_shor') {
            normalizedName = 'cognitive_flex_chor';
        }

        // Check if an active in_progress session already exists to prevent duplication
        const [existing] = await pool.query(
            `SELECT id FROM game_sessions 
             WHERE child_id = ? AND game_name = ? AND status = 'in_progress' 
             ORDER BY start_time DESC LIMIT 1`,
            [child_id, normalizedName]
        );

        let sessionId;
        if (existing.length > 0) {
            sessionId = existing[0].id;
        } else {
            const [result] = await pool.query(
                `INSERT INTO game_sessions 
                (child_id, game_name, start_time, total_questions, status, progress_level, score) 
                VALUES (?, ?, NOW(), ?, 'in_progress', 1, 0)`,
                [child_id, normalizedName, total_questions || 0]
            );
            sessionId = result.insertId;
        }

        // Get attempt number for this session
        const [[countResult]] = await pool.query(
            `SELECT COUNT(*) as attempt_no FROM game_sessions WHERE child_id = ? AND game_name = ? AND start_time <= (SELECT start_time FROM game_sessions WHERE id = ?)`,
            [child_id, normalizedName, sessionId]
        );

        res.status(existing.length > 0 ? 200 : 201).json({
            success: true,
            message: existing.length > 0 ? 'Active session reused' : 'Game session started',
            sessionId: sessionId,
            attempt_no: countResult.attempt_no
        });
    } catch (error) {
        console.error('Error starting game session:', error);
        res.status(500).json({ success: false, message: 'Server error starting game session' });
    }
};

// Update an existing game session
exports.updateGameSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { score, progress_level, status, quit_reason, saved_state } = req.body;

        // Verify session exists
        const [existing] = await pool.query('SELECT * FROM game_sessions WHERE id = ?', [sessionId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
        }

        const currentStatus = existing[0].status;

        // Guard: never overwrite a terminal status (quit/dropped) with completed.
        // This is the server-side safety net against client-side bugs.
        if (status === 'completed' && (currentStatus === 'quit' || currentStatus === 'dropped')) {
            return res.status(200).json({ success: true, message: 'Session already finalized — status preserved.' });
        }

        let updateQuery = 'UPDATE game_sessions SET ';
        let updateParams = [];
        
        if (score !== undefined) { updateQuery += 'score = ?, '; updateParams.push(score); }
        if (progress_level !== undefined) { updateQuery += 'progress_level = ?, '; updateParams.push(progress_level); }
        if (status) { updateQuery += 'status = ?, '; updateParams.push(status); }
        if (quit_reason !== undefined) { updateQuery += 'quit_reason = ?, '; updateParams.push(quit_reason); }
        if (saved_state !== undefined) { updateQuery += 'saved_state = ?, '; updateParams.push(JSON.stringify(saved_state)); }

        // If status became terminal (completed, quit, or dropped), mark end_time
        if (status === 'completed' || status === 'quit' || status === 'dropped') {
            updateQuery += 'end_time = NOW(), ';
        }

        // Remove trailing comma and space
        updateQuery = updateQuery.slice(0, -2);
        updateQuery += ' WHERE id = ?';
        updateParams.push(sessionId);

        await pool.query(updateQuery, updateParams);

        res.status(200).json({ success: true, message: 'Game session updated' });
    } catch (error) {
        console.error('Error updating game session:', error);
        res.status(500).json({ success: false, message: 'Server error updating game session' });
    }
};

// Check if a child has a session to resume
exports.getResumeSession = async (req, res) => {
    try {
        const { childId, gameName } = req.params;
        let normalizedName = gameName;
        if (['Chalo Mela Chale', 'chalo_mela_chale'].includes(gameName)) normalizedName = 'rover_mela';
        if (gameName === 'chor_machaye_shor') normalizedName = 'cognitive_flex_chor';

        // Find the absolute latest session for this game that is NOT finalized
        const [rows] = await pool.query(
            `SELECT * FROM game_sessions 
             WHERE child_id = ? AND game_name = ? AND status NOT IN ('completed', 'quit', 'dropped')
             ORDER BY start_time DESC LIMIT 1`,
            [childId, normalizedName]
        );
        if (rows.length > 0) {
            let savedState = rows[0].saved_state;
            if (typeof savedState === 'string') {
                try {
                    savedState = JSON.parse(savedState);
                } catch (e) {
                    console.error("Error parsing saved_state:", e);
                }
            }

            // Get attempt number for this child/game
            const [[countResult]] = await pool.query(
                `SELECT COUNT(*) as attempt_no FROM game_sessions 
                 WHERE child_id = ? AND game_name = ? AND start_time <= ?`,
                [childId, normalizedName, rows[0].start_time]
            );

            res.status(200).json({
                success: true,
                sessionInfo: {
                    ...rows[0],
                    saved_state: savedState,
                    attempt_no: countResult.attempt_no
                }
            });
        } else {
            res.status(200).json({
                success: true,
                sessionInfo: null
            });
        }
    } catch (error) {
        console.error('Error fetching resume session:', error);
        res.status(500).json({ success: false, message: 'Server error fetching session' });
    }
};

// Get complete history of games played
exports.getGameHistory = async (req, res) => {
    try {
        const { childId } = req.params;

        const [rows] = await pool.query(
            `SELECT gs.*, 
                   (SELECT file_path FROM game_dashboard_pdfs WHERE session_id = gs.id ORDER BY id DESC LIMIT 1) AS pdf_url 
             FROM game_sessions gs
             WHERE gs.child_id = ? 
             ORDER BY gs.start_time ASC`, // Changed to ASC to calculate attempt numbers easily
            [childId]
        );

        // Group by game_name to assign attempt numbers
        const gameCounts = {};
        const fs = require('fs');
        const path = require('path');
        
        const historyWithAttempts = rows.map(row => {
            const gName = row.game_name;
            gameCounts[gName] = (gameCounts[gName] || 0) + 1;
            
            // Check if PDF physically exists on the disk
            if (row.pdf_url) {
                const fileName = row.pdf_url.split('/').pop();
                const pdfPath = path.join(__dirname, '../../dashboard_pdfs', fileName);
                if (!fs.existsSync(pdfPath)) {
                    row.pdf_url = null; // Hide the button on frontend if file was deleted
                }
            }

            return { ...row, attempt_no: gameCounts[gName] };
        });

        // Re-sort to DESC for UI
        historyWithAttempts.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

        res.status(200).json({
            success: true,
            history: historyWithAttempts
        });
    } catch (error) {
        console.error('Error fetching game history:', error);
        res.status(500).json({ success: false, message: 'Server error fetching history' });
    }
};

// ─── REPORT: Overview KPIs for all games ──────────────────────────────────────
// Average Game Time and Average Screen Time are computed here in JS (rather than a SQL
// AVG(JSON_EXTRACT(...))) so they use the exact same per-session figures as the "Duration"
// and "Screentime" columns already shown in the report-detail table / CSV export:
//   - Game Time   <- computeActualGameTime()  (the "Duration" column: sum of per-question
//     tracked time, falling back to timerSeconds only when no per-question times exist)
//   - Screen Time <- computeScreenTime()      (the "Screentime" column: saved_state.screentime,
//     falling back to timerSeconds for games that don't save a dedicated screentime field)
exports.getReportOverview = async (req, res) => {
    try {
        const [sessions] = await pool.query(`
            SELECT game_name, child_id, status, score, saved_state
            FROM game_sessions
        `);

        const buckets = {};
        for (const row of sessions) {
            const gameName = normalizeGameName(row.game_name);
            if (!buckets[gameName]) {
                buckets[gameName] = {
                    game_name: gameName,
                    children: new Set(),
                    total_attempts: 0,
                    completed: 0, paused: 0, in_progress: 0, dropped_count: 0, quit_count: 0,
                    scoreSum: 0, scoreCount: 0,
                    gameTimeSum: 0, gameTimeCount: 0,
                    screenTimeSum: 0, screenTimeCount: 0,
                };
            }
            const b = buckets[gameName];
            b.children.add(row.child_id);
            b.total_attempts += 1;
            if (row.status === 'completed') b.completed += 1;
            else if (row.status === 'paused') b.paused += 1;
            else if (row.status === 'in_progress') b.in_progress += 1;
            else if (row.status === 'dropped') b.dropped_count += 1;
            else if (row.status === 'quit') b.quit_count += 1;

            if (row.status === 'completed') {
                if (typeof row.score === 'number') { b.scoreSum += row.score; b.scoreCount += 1; }

                const parsedState = parseSavedState(row.saved_state);

                const gameTime = computeActualGameTime(parsedState, gameName);
                if (gameTime > 0) { b.gameTimeSum += gameTime; b.gameTimeCount += 1; }

                const screenTime = computeScreenTime(parsedState);
                if (typeof screenTime === 'number') { b.screenTimeSum += screenTime; b.screenTimeCount += 1; }
            }
        }

        const data = Object.values(buckets).map(b => ({
            game_name: b.game_name,
            total_children: b.children.size,
            total_attempts: b.total_attempts,
            completed: b.completed,
            paused: b.paused,
            in_progress: b.in_progress,
            dropped_count: b.dropped_count,
            quit_count: b.quit_count,
            avg_score: b.scoreCount ? Math.round((b.scoreSum / b.scoreCount) * 10) / 10 : null,
            avg_game_time: b.gameTimeCount ? Math.round(b.gameTimeSum / b.gameTimeCount) : null,
            avg_screen_time: b.screenTimeCount ? Math.round(b.screenTimeSum / b.screenTimeCount) : null,
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error fetching report overview:', error);
        res.status(500).json({ success: false, message: 'Server error fetching report overview' });
    }
};

// ─── REPORT: Detailed attempt listing for one game ────────────────────────────
exports.getReportDetail = async (req, res) => {
    try {
        const { gameName } = req.params;
        const { child_id } = req.query;

        let gameFilter = [gameName];
        if (['rover_mela', 'chalo_mela_chale', 'Chalo Mela Chale'].includes(gameName)) {
            gameFilter = ['rover_mela', 'chalo_mela_chale', 'Chalo Mela Chale', 'Rover Test', 'Rover Game'];
        }
        if (['cognitive_flex_chor', 'chor_machaye_shor'].includes(gameName)) {
            gameFilter = ['cognitive_flex_chor', 'chor_machaye_shor'];
        }

        let queryStr = `
            SELECT
                gs.id               AS session_id,
                gs.child_id,
                c.name              AS child_name,
                gs.score,
                gs.total_questions,
                gs.progress_level,
                gs.status,
                gs.quit_reason,
                gs.start_time,
                gs.end_time,
                gs.saved_state,
                ga.q1_enjoyment,
                ga.q2_feeling,
                ga.q3_tiredness,
                ga.q4_play_again,
                ga.q5_behaviors,
                ga.additional_notes,
                (SELECT file_path FROM game_dashboard_pdfs WHERE session_id = gs.id ORDER BY id DESC LIMIT 1) AS pdf_url
            FROM game_sessions gs
            LEFT JOIN children c ON gs.child_id = c.child_id
            LEFT JOIN game_assessments ga
              ON ga.session_id = gs.id
              -- A session can end up with more than one assessment row (e.g. a
              -- resumed session re-prompting the end-of-game questionnaire) —
              -- a plain join would duplicate the whole session row per match,
              -- which also threw off child_attempt_no (computed by row order
              -- below). Only join the most recent submission.
              AND ga.id = (SELECT MAX(ga2.id) FROM game_assessments ga2 WHERE ga2.session_id = gs.id)
            WHERE gs.game_name IN (?)
        `;
        let queryParams = [gameFilter];
        
        if (child_id) {
            queryStr += ' AND gs.child_id = ?';
            queryParams.push(child_id);
        }
        
        queryStr += ' ORDER BY gs.start_time ASC';

        const [rows] = await pool.query(queryStr, queryParams);

        // Hide the "View PDF" link if the file was deleted from disk after the
        // DB row was created (mirrors the same check in getGameHistory).
        const fs = require('fs');
        const path = require('path');
        rows.forEach(row => {
            if (row.pdf_url) {
                const fileName = row.pdf_url.split('/').pop();
                const pdfPath = path.join(__dirname, '../../dashboard_pdfs', fileName);
                if (!fs.existsSync(pdfPath)) {
                    row.pdf_url = null;
                }
            }
        });

        // Calculate per-child attempt numbers
        const childAttemptCounts = {};
        const allUniqueKeys = new Set();
        const enriched = rows.map((row) => {
            const cid = row.child_id;
            childAttemptCounts[cid] = (childAttemptCounts[cid] || 0) + 1;
            const currentAttempt = childAttemptCounts[cid];

            const parsedState = parseSavedState(row.saved_state);

            // Teaching-question entries (e.g. number_recall_lottery[/_v2]) live separately
            // in saved_state.teachingScores but are scored like standard questions — fold
            // them into `scores` so every downstream figure (correct_count, question_scores,
            // raw_scores, CSV columns) matches the combined total shown on the client.
            const teachingScores = Array.isArray(parsedState?.teachingScores) ? parsedState.teachingScores : [];
            const scores = [...teachingScores, ...(Array.isArray(parsedState?.allScores) ? parsedState.allScores : [])];
            const chorItems = Array.isArray(parsedState?.itemResults) ? parsedState.itemResults : [];
            const questionScores = {};
            
            // Standard format (allScores)
            scores.forEach(s => {
                let qid = s.qId || s.id || s.question;
                if (qid !== undefined) {
                    // Extract numeric part if it starts with Q or q (like "Q1")
                    if (typeof qid === 'string' && qid.toUpperCase().startsWith('Q')) {
                        qid = qid.toLowerCase();
                    }
                    const key = (typeof qid === 'string' && (qid.startsWith('q') || qid.startsWith('tq')))
                        ? qid : `q${qid}`;
                    
                    // Filter out non-scored items for Triangle if any
                    if (gameName === 'triangle_rachna' && typeof key === 'string' && !key.startsWith('question')) return;

                    questionScores[key] = s.score;
                    allUniqueKeys.add(key);
                    questionScores[`${key}_time`] = s.timeTaken ?? s.duration_ms ?? null;
                    questionScores[`${key}_moves`] = s.moves ?? null;
                    questionScores[`${key}_replays`] = s.replayCount ?? 0;
                    if (gameName === 'atlantis_bagiya') {
                        questionScores[`${key}_item_replays`] = parsedState?.itemExposureReplays?.[s.screen] ?? 0;
                    }

                    if (gameName === 'working_memory_herpher' || gameName === 'working_memory_herpher_v2') {
                        questionScores[`${key}_correct`] = s.correctCount ?? null;
                        questionScores[`${key}_incorrect`] = s.incorrectSelections?.length ?? null;
                        questionScores[`${key}_total`] = s.expectedImages?.length ?? null;
                    }

                    if (gameName === 'auditory_dhyan') {
                        questionScores[`${key}_eoi`] = s.eoi ?? s.scoreObj?.eoi ?? 0;
                        questionScores[`${key}_eoo`] = s.eoo ?? s.scoreObj?.eoo ?? 0;
                        questionScores[`${key}_eoc`] = s.eoc ?? s.scoreObj?.eoc ?? 0;
                    }

                    if (gameName === 'triangle_rachna') {
                        const td = parsedState.questionDetails?.[qid] || {};
                        questionScores[`${key}_ass_q1`] = td.qAnswers?.q1 ? td.qAnswers.q1.toUpperCase() : '—';
                        questionScores[`${key}_ass_q2`] = td.qAnswers?.q2 ? td.qAnswers.q2.toUpperCase() : '—';
                        questionScores[`${key}_ass_q3`] = td.qAnswers?.q3 ? td.qAnswers.q3.toUpperCase() : '—';
                    }

                    if (['literacy_reading_skill', 'reading_skill'].includes(gameName)) {
                        // Look for assessment data in multiple potential locations for robustness
                        let ans = s.ssrAnswers || s.midTestAnswers || (parsedState.questionDetails?.[qid]?.ssrAnswers) || (parsedState.questionDetails?.[qid]?.qAnswers) || (parsedState.questionDetails?.[qid]);
                        
                        if (ans) {
                            if (typeof ans === 'string') {
                                try { ans = JSON.parse(ans); } catch(e) {}
                            }
                            // Support numeric keys (0,1,2), string keys ("0","1","2"), and labelled keys (q1,q2,q3)
                            const getAns = (i, k) => {
                                const val = ans[i] ?? ans[String(i)] ?? ans[k] ?? '—';
                                return String(val).toUpperCase();
                            };
                            questionScores[`${key}_ass_q1`] = getAns(0, 'q1');
                            questionScores[`${key}_ass_q2`] = getAns(1, 'q2');
                            questionScores[`${key}_ass_q3`] = getAns(2, 'q3');
                        }
                    }
                }
            });

            // TQ per-trial data (rover_mela) — stored separately from allScores
            const tqTrials = parsedState?.tqTrials || {};
            Object.entries(tqTrials).forEach(([key, data]) => {
                const baseId = key.replace(/_t[12]$/, '');
                const budget = ROVER_Q_BUDGET[baseId] || 0;
                const moves  = data.moves ?? 0;
                const score  = data.score ?? null;
                questionScores[key]                  = score;
                questionScores[`${key}_moves`]       = data.moves ?? null;
                questionScores[`${key}_time`]        = data.timeTaken ?? null;
                questionScores[`${key}_retakes`]     = data.retakeCount ?? 0;
                questionScores[`${key}_coins_kept`]  = (score > 0 && budget > 0) ? Math.max(0, budget - moves) : 0;
            });

            // FALLBACK for old sessions that don't have tqTrials yet:
            // derive tq1_t1 / tq1_t2 etc. from the existing allScores entries.
            // Each allScores entry for a TQ question has a `trial` field (1 or 2).
            if (Object.keys(tqTrials).length === 0 && ['rover_mela','chalo_mela_chale'].includes(gameName)) {
                scores.forEach(s => {
                    const qid = s.id || s.qId;
                    if (qid && typeof qid === 'string' && qid.startsWith('tq')) {
                        const trialNum  = s.trial || 1;
                        const trialKey  = `${qid}_t${trialNum}`;
                        const budget    = ROVER_Q_BUDGET[qid] || 0;
                        const moves     = s.moves || 0;
                        const score     = s.score ?? null;
                        questionScores[trialKey]                 = score;
                        questionScores[`${trialKey}_moves`]      = moves || null;
                        questionScores[`${trialKey}_time`]       = s.timeTaken ?? null;
                        questionScores[`${trialKey}_retakes`]    = 0;   // not tracked in old sessions
                        questionScores[`${trialKey}_coins_kept`] = (score > 0 && budget > 0) ? Math.max(0, budget - moves) : 0;
                    }
                });
            }

            // ChorMachayeShor format (itemResults)
            chorItems.forEach(item => {
                let key;
                if (item.itemId === 1 && item.trial === 2) key = 'q1t2';
                else if (item.itemId === 1) key = 'q1t1';
                else key = `q${item.itemId}`;
                
                questionScores[key] = item.score ?? null;
                questionScores[`${key}_moves`] = item.moves ?? null;
                questionScores[`${key}_time`] = item.timeTaken ?? null;
                allUniqueKeys.add(key);
            });

            // Global Metrics Calculation
            const allItems = (chorItems.length > 0) ? chorItems : scores;
            // For rover_mela/chalo_mela_chale: exclude TQ entries so Duration reflects only actual test question times
            const scoringItems = (['rover_mela', 'chalo_mela_chale'].includes(gameName))
                ? allItems.filter(s => { const id = s.id || s.qId || ''; return !String(id).startsWith('tq'); })
                : allItems;
            let totalMoves = scoringItems.reduce((sum, s) => sum + (parseInt(s.moves) || 0), 0);

            // Fallback for sessions where moves might be stored differently
            if (totalMoves === 0 && parsedState?.totalMoves) totalMoves = parsedState.totalMoves;
            const actualGameTime = computeActualGameTime(parsedState, gameName);

            let totalSessionTime = null;
            if (row.start_time && row.end_time) {
                totalSessionTime = Math.floor((new Date(row.end_time) - new Date(row.start_time)) / 1000);
            }

            let behaviors = row.q5_behaviors;
            try { if (typeof behaviors === 'string') behaviors = JSON.parse(behaviors); } catch (_) {}

            return {
                child_attempt_no: currentAttempt,
                session_id: row.session_id,
                child_id: row.child_id,
                child_name: row.child_name || '—',
                score: row.score,
                correct_count: (chorItems.length > 0)
                    ? chorItems.filter(r => r.completed).length
                    : scores.filter(s => s.score > 0).length,
                attempted_questions: (chorItems.length > 0) ? chorItems.length : scores.length,
                total_questions: row.total_questions,
                status: row.status,
                quit_reason: row.quit_reason,
                pauses: parsedState?.pauses || [],
                start_time: row.start_time,
                end_time: row.end_time,
                total_session_time: totalSessionTime,
                actual_game_time: (actualGameTime > 0) ? Math.round(actualGameTime) : (chorItems.length > 0 || scores.length > 0 ? 0 : null),
                total_moves: (totalMoves > 0) ? totalMoves : (chorItems.length > 0 || scores.length > 0 ? 0 : null),
                coins_collected: parsedState?.collectedCoins ??
                    // Fallback: compute from allScores for sessions before collectedCoins was tracked
                    (['rover_mela','chalo_mela_chale'].includes(gameName)
                        ? scores.reduce((sum, s) => {
                            const qid = s.id || s.qId;
                            if (!qid || typeof qid !== 'string' || qid.startsWith('tq')) return sum;
                            const budget = ROVER_Q_BUDGET[qid] || 0;
                            return sum + (s.score > 0 && budget > 0 ? Math.max(0, budget - (s.moves || 0)) : 0);
                          }, 0)
                        : null),
                retake_count:    parsedState?.retakeCount    ?? null,
                refresh_count:   parsedState?.refreshCount   ?? null,
                screentime:      computeScreenTime(parsedState),
                question_scores: questionScores,
                assessment: {
                    q1_enjoyment:   row.q1_enjoyment   || null,
                    q2_feeling:     row.q2_feeling      || null,
                    q3_tiredness:   row.q3_tiredness    || null,
                    q4_play_again:  row.q4_play_again   || null,
                    q5_behaviors:   Array.isArray(behaviors) ? behaviors.join(', ') : (behaviors || null),
                    additional_notes: row.additional_notes || null,
                },
                raw_scores: scores,
                pdf_url: row.pdf_url || null,
            };
        });

        // Re-sort to DESC for report listing
        enriched.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

        // Determine Columns
        let sortedQIds = [];
        if (['rover_mela', 'chalo_mela_chale'].includes(gameName)) {
            sortedQIds = [
                'tq1_t1', 'tq1_t2', 'tq2_t1', 'tq2_t2',
                'tq3_t1', 'tq3_t2', 'tq4_t1', 'tq4_t2',
                'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8',
                'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18',
            ];
        } else if (['cognitive_flex_chor', 'chor_machaye_shor'].includes(gameName)) {
            sortedQIds = ['q1t1', 'q1t2', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'];
        } else if (['number_recall_lottery', 'number_recall_lottery_v2'].includes(gameName)) {
            sortedQIds = ['qteaching1', 'qteaching2', ...Array.from({ length: 20 }, (_, i) => `q${i + 1}`)];
        } else {
            sortedQIds = Array.from(allUniqueKeys).sort((a, b) => {
                const na = parseInt(a.replace(/\D/g, '')) || 0;
                const nb = parseInt(b.replace(/\D/g, '')) || 0;
                return na - nb;
            });
        }

        res.status(200).json({
            success: true,
            version: '2026-04-26-0840', // Current fix timestamp
            gameName,
            columns: sortedQIds,
            data: enriched,
        });
    } catch (error) {
        console.error('Error fetching report detail:', error);
        res.status(500).json({ success: false, message: 'Server error fetching report detail' });
    }
};
// Submit assessment formulation tied to a session
exports.submitAssessment = async (req, res) => {

    try {
        const { session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again, q5_behaviors, additional_notes } = req.body;

        if (!session_id || !child_id) {
            return res.status(400).json({ success: false, message: 'session_id and child_id are required' });
        }

        const behaviorsArr = Array.isArray(q5_behaviors) ? q5_behaviors : [];
        if (behaviorsArr.length === 0) {
            return res.status(400).json({ success: false, message: 'Q5 is required: please select at least one observed behaviour.' });
        }

        const [result] = await pool.query(
            `INSERT INTO game_assessments 
             (session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again, q5_behaviors, additional_notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                session_id,
                child_id,
                q1_enjoyment,
                q2_feeling,
                q3_tiredness,
                q4_play_again,
                JSON.stringify(behaviorsArr),
                additional_notes || ''
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Assessment submitted successfully',
            assessmentId: result.insertId
        });
    } catch (error) {
        console.error('Error saving assessment:', error);
        res.status(500).json({ success: false, message: 'Server error submitting assessment' });
    }
};

// GET /sessions/summaries/:childId
exports.getGameSummaries = async (req, res) => {
    try {
        const { childId } = req.params;
        if (!childId) {
            console.error('getGameSummaries: Missing childId');
            return res.status(400).json({ success: false, message: 'childId is required' });
        }

        console.log(`Fetching game summaries for childId: ${childId}`);

        const [rows] = await pool.query(
            `SELECT
                CASE
                    WHEN game_name IN ('Chalo Mela Chale', 'chalo_mela_chale', 'rover_mela', 'Rover Test', 'Rover Game') THEN 'rover_mela'
                    WHEN game_name IN ('chor_machaye_shor', 'cognitive_flex_chor') THEN 'cognitive_flex_chor'
                    WHEN game_name IN ('literacy_reading_skill', 'reading_skill', 'Padh ke batao') THEN 'literacy_reading_skill'
                    WHEN game_name IN ('numeracy_number_skill', 'Ankganit') THEN 'numeracy_number_skill'
                    WHEN game_name IN ('working_memory_herpher', 'Her Pher') THEN 'working_memory_herpher'
                    WHEN game_name IN ('working_memory_herpher_v2', 'Her Pher - Version 2') THEN 'working_memory_herpher_v2'
                    WHEN game_name IN ('atlantis_bagiya', 'Bagiya', 'Atlantis Test', 'Atlantis Game') THEN 'atlantis_bagiya'
                    ELSE game_name
                END AS game_name,
                MAX(start_time) as last_played_at,
                COUNT(*) as total_attempts
            FROM game_sessions
            WHERE child_id = ?
            GROUP BY 1`,
            [childId]
        );

        console.log(`Summaries found for ${childId}: ${rows.length} games`);

        res.status(200).json({
            success: true,
            summaries: rows
        });
    } catch (error) {
        console.error('Error fetching game summaries:', error);
        res.status(500).json({ success: false, message: 'Server error fetching summaries' });
    }
};
// Check if there is a recently finished session that lacks an assessment
exports.getPendingAssessment = async (req, res) => {
    try {
        const { childId } = req.params;
        // Find the latest session that was finished but has no assessment record
        const [rows] = await pool.query(`
            SELECT gs.* 
            FROM game_sessions gs
            LEFT JOIN game_assessments ga ON gs.id = ga.session_id
            WHERE gs.child_id = ? 
              AND gs.status IN ('completed', 'quit', 'dropped')
              AND ga.id IS NULL
            ORDER BY gs.end_time DESC
            LIMIT 1
        `, [childId]);

        if (rows.length > 0) {
            res.status(200).json({ success: true, pendingSession: rows[0] });
        } else {
            res.status(200).json({ success: true, pendingSession: null });
        }
    } catch (error) {
        console.error('Error checking pending assessments:', error);
        res.status(500).json({ success: false, message: 'Server error checking pending assessments' });
    }
};

exports.uploadDashboardPdf = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No PDF file uploaded' });
        }
        
        const { child_id, session_id, game_name } = req.body;
        const file_name = req.file.filename;
        const file_path = `/dashboard_pdfs/${file_name}`;

        await pool.query(
            `INSERT INTO game_dashboard_pdfs 
             (child_id, session_id, game_name, file_name, file_path) 
             VALUES (?, ?, ?, ?, ?)`,
            [child_id, session_id, game_name, file_name, file_path]
        );

        res.status(200).json({
            success: true,
            message: 'Dashboard PDF uploaded successfully',
            file_path
        });
    } catch (error) {
        console.error('Error uploading dashboard PDF:', error);
        res.status(500).json({ success: false, message: 'Server error uploading PDF' });
    }
};
