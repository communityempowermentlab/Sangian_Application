const { pool } = require('../config/db');

// Start a new game session
exports.startGameSession = async (req, res) => {
    try {
        const { child_id, game_name, total_questions } = req.body;

        if (!child_id || !game_name) {
            return res.status(400).json({ success: false, message: 'child_id and game_name are required' });
        }

        const [result] = await pool.query(
            `INSERT INTO game_sessions 
            (child_id, game_name, start_time, total_questions, status, progress_level, score) 
            VALUES (?, ?, NOW(), ?, 'in_progress', 1, 0)`,
            [child_id, game_name, total_questions || 0]
        );

        res.status(201).json({
            success: true,
            message: 'Game session started',
            sessionId: result.insertId
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

        let updateQuery = 'UPDATE game_sessions SET ';
        let updateParams = [];
        
        if (score !== undefined) { updateQuery += 'score = ?, '; updateParams.push(score); }
        if (progress_level !== undefined) { updateQuery += 'progress_level = ?, '; updateParams.push(progress_level); }
        if (status) { updateQuery += 'status = ?, '; updateParams.push(status); }
        if (quit_reason !== undefined) { updateQuery += 'quit_reason = ?, '; updateParams.push(quit_reason); }
        if (saved_state !== undefined) { updateQuery += 'saved_state = ?, '; updateParams.push(JSON.stringify(saved_state)); }

        // If status became completed or quit, mark end_time
        if (status === 'completed' || status === 'quit') {
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

        // Find the absolute latest session for this game
        const [rows] = await pool.query(
            `SELECT * FROM game_sessions 
             WHERE child_id = ? AND game_name = ?
             ORDER BY start_time DESC LIMIT 1`,
            [childId, gameName]
        );

        // Only offer resume if the very last recorded session was not completed
        if (rows.length > 0 && ['in_progress', 'paused', 'quit'].includes(rows[0].status)) {
            // Parse saved state
            let savedState = rows[0].saved_state;
            if (typeof savedState === 'string') {
                try { savedState = JSON.parse(savedState); } catch (e) {}
            }
            
            res.status(200).json({
                success: true,
                sessionInfo: {
                    ...rows[0],
                    saved_state: savedState
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
            'SELECT * FROM game_sessions WHERE child_id = ? ORDER BY start_time DESC',
            [childId]
        );

        res.status(200).json({
            success: true,
            history: rows
        });
    } catch (error) {
        console.error('Error fetching game history:', error);
        res.status(500).json({ success: false, message: 'Server error fetching history' });
    }
};

// ─── REPORT: Overview KPIs for all games ──────────────────────────────────────
exports.getReportOverview = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                game_name,
                COUNT(DISTINCT child_id)                        AS total_children,
                COUNT(*)                                        AS total_attempts,
                SUM(status = 'completed')                       AS completed,
                SUM(status = 'paused')                          AS paused,
                SUM(status = 'quit')                            AS quit_count,
                ROUND(AVG(CASE WHEN status='completed' THEN score END), 1) AS avg_score
            FROM game_sessions
            GROUP BY game_name
        `);
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching report overview:', error);
        res.status(500).json({ success: false, message: 'Server error fetching report overview' });
    }
};

// ─── REPORT: Detailed attempt listing for one game ────────────────────────────
exports.getReportDetail = async (req, res) => {
    try {
        const { gameName } = req.params;

        const [rows] = await pool.query(`
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
                ga.additional_notes
            FROM game_sessions gs
            LEFT JOIN children c ON gs.child_id = c.child_id
            LEFT JOIN game_assessments ga ON ga.session_id = gs.id
            WHERE gs.game_name = ?
            ORDER BY gs.start_time DESC
        `, [gameName]);

        // Parse saved_state JSON and flatten per-question scores
        const enriched = rows.map((row, idx) => {
            let parsedState = null;
            try {
                parsedState = typeof row.saved_state === 'string'
                    ? JSON.parse(row.saved_state)
                    : row.saved_state;
            } catch (_) {}

            const scores = parsedState?.allScores || [];
            const questionScores = {};
            scores.forEach(s => {
                questionScores[`q${s.qId}`] = s.score;
                questionScores[`q${s.qId}_time`] = s.timeTaken ?? null;
            });

            let actualGameTime = parsedState?.timerSeconds ?? null;
            let totalSessionTime = null;
            if (row.start_time && row.end_time) {
                totalSessionTime = Math.floor((new Date(row.end_time) - new Date(row.start_time)) / 1000);
            }

            // Parse behaviors JSON array if stored as string
            let behaviors = row.q5_behaviors;
            try {
                if (typeof behaviors === 'string') behaviors = JSON.parse(behaviors);
            } catch (_) {}

            return {
                attempt_no: idx + 1,
                session_id: row.session_id,
                child_id: row.child_id,
                child_name: row.child_name || '—',
                score: row.score,
                total_questions: row.total_questions,
                status: row.status,
                quit_reason: row.quit_reason,
                start_time: row.start_time,
                end_time: row.end_time,
                total_session_time: totalSessionTime,
                actual_game_time: actualGameTime,
                question_scores: questionScores,
                assessment: {
                    q1_enjoyment:   row.q1_enjoyment   || null,
                    q2_feeling:     row.q2_feeling      || null,
                    q3_tiredness:   row.q3_tiredness    || null,
                    q4_play_again:  row.q4_play_again   || null,
                    q5_behaviors:   Array.isArray(behaviors) ? behaviors.join(', ') : (behaviors || null),
                    additional_notes: row.additional_notes || null,
                },
            };
        });

        // Determine column set: find max qId across all rows
        const allQIds = new Set();
        enriched.forEach(r => {
            Object.keys(r.question_scores).forEach(k => {
                if (!k.endsWith('_time')) allQIds.add(k);
            });
        });
        const sortedQIds = [...allQIds].sort((a, b) => {
            const na = parseInt(a.slice(1)); const nb = parseInt(b.slice(1));
            return na - nb;
        });

        res.status(200).json({
            success: true,
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
                JSON.stringify(q5_behaviors || []),
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
