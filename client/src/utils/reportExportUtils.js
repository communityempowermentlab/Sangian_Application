// ─── Catalogue of all 9 games ─────────────────────────────────────────────────
export const GAME_CATALOG = [
    { key: 'atlantis_bagiya',           icon: '🧠', title: 'Bagiya',        local: '',           tag: '',                 color: '#6366f1' },
    { key: 'number_recall_lottery',     icon: '🎟️', title: 'Lottery Ka Ticket',        local: '',tag: '',                 color: '#f59e0b' },
    { key: 'number_recall_lottery_v2',  icon: '🎟️', title: 'Lottery Ka Ticket - Version 2', local: '',tag: '', color: '#f59e0b' },
    { key: 'rover_mela',                icon: '🗺️', title: 'Chalo Mela Chalen',           local: '', tag: '',                 color: '#10b981' },
    { key: 'auditory_dhyan',            icon: '👂', title: 'Dhyan Kahan Hai',   local: '',  tag: '',                 color: '#8b5cf6' },
    { key: 'working_memory_herpher',    icon: '🔄', title: 'Her Pher',       local: '',         tag: '',                 color: '#0891b2' },
    { key: 'working_memory_herpher_v2', icon: '🔄', title: 'Her Pher - Version 2', local: '', tag: '', color: '#0891b2' },
    { key: 'working_memory_herpher_v3', icon: '🔄', title: 'Her Pher - Version 3', local: '', tag: '', color: '#0891b2' },
    { key: 'numeracy_number_skill',     icon: '🔢', title: 'Ankganit',        local: '',    tag: '',                 color: '#7c3aed' },
    { key: 'numeracy_number_skill_v2',  icon: '🔢', title: 'Ankganit - Version 2', local: '', tag: '', color: '#7c3aed' },
    { key: 'numeracy_number_skill_v3',  icon: '🔢', title: 'Ankganit - Version 3', local: '', tag: '', color: '#7c3aed' },
    { key: 'literacy_reading_skill',    icon: '📖', title: 'Padh ke batao',        local: '',   tag: '',                 color: '#059669' },
    { key: 'literacy_reading_skill_v2', icon: '📖', title: 'Padh ke batao - Version 2', local: '', tag: '', color: '#059669' },
    { key: 'cognitive_flex_chor',       icon: '⚡', title: 'Chor Machaye Shor',       local: '',tag: '',                color: '#dc2626' },
    { key: 'triangle_rachna',           icon: '🔺', title: 'Rachna',             local: '',           tag: '',     color: '#ef4444' },
];

// ─── Format Helpers ────────────────────────────────────────────────────────
export const fmtOnlyDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtOnlyTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() : '—';

export const fmtSecs = (v) => {
    if (v == null) return '—';
    const s = Math.round(Number(v));
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
};

const ROVER_Q_BUDGET = {
    q1: 7, q2: 7, q3: 8, q4: 6, q5: 8, q6: 9, q7: 9, q8: 8,
    q9: 10, q10: 9, q11: 10, q12: 11, q13: 9, q14: 9, q15: 11,
    q16: 13, q17: 12, q18: 12,
};
export const getRoverBudget = (id) => ROVER_Q_BUDGET[id] || 0;

export const getTeachingTotal = (qs) => [1, 2, 3, 4].reduce(
    (sum, n) => sum + Math.max(qs?.[`tq${n}_t1`] ?? 0, qs?.[`tq${n}_t2`] ?? 0),
    0
);

export const chorColLabel = (c) => {
    if (c === 'q1t1') return 'Item 1 (T1)';
    if (c === 'q1t2') return 'Item 1 (T2)';
    const m = c.match(/^q(\d+)$/);
    if (m) return `Item ${m[1]}`;
    return c.toUpperCase();
};

export const generateReportData = (activeGame, detail) => {
    if (!detail) return { headers: [], rows: [] };
    
    const assessmentKeys = ['q1_enjoyment','q2_feeling','q3_tiredness','q4_play_again','q5_behaviors','additional_notes'];
    const assessmentLabels = ['Enjoyed?','Feeling?','Tired?','Play Again?','Behaviours','Notes'];
    
    const isAuditory = activeGame?.key === 'auditory_dhyan';
    const isHerPher  = activeGame?.key === 'working_memory_herpher' || activeGame?.key === 'working_memory_herpher_v2' || activeGame?.key === 'working_memory_herpher_v3';
    const isChorCSV  = activeGame?.key === 'cognitive_flex_chor';
    const qHeaders = [];
    
    if (isAuditory) {
        [1, 2, 3, 4].forEach(q => {
            qHeaders.push(
                `Q${q}_Correct Response`,
                `Q${q}_Total Correct Responses`,
                `Q${q}_Total EOI`,
                `Q${q}_Total EOO`,
                `Q${q}_Total EOC`,
                `Q${q}_Total Playtime(s)`
            );
        });
    } else if (isHerPher) {
        [2,3,4,5,6,7,8,9].forEach((qId, i) => {
            const label = `Q${i+1}`;
            qHeaders.push(`${label} Total Images`, `${label} User Correct`, `${label} Incorrect`, `${label} Score`, `${label} Time(s)`);
        });
    } else if (activeGame?.key === 'triangle_rachna') {
        detail.columns.forEach((c, idx) => {
            const colLabel = `Q${idx + 1}`;
            qHeaders.push(`${colLabel} Score`);
            qHeaders.push(`${colLabel} Gap > 2?`);
            qHeaders.push(`${colLabel} Align > 2?`);
            qHeaders.push(`${colLabel} Match Tgt?`);
            qHeaders.push(`${colLabel} Time(s)`);
        });
    } else if (['literacy_reading_skill', 'literacy_reading_skill_v2'].includes(activeGame?.key)) {
        detail.columns.forEach((c, idx) => {
            const colLabel = `Q${idx + 1}`;
            qHeaders.push(`${colLabel} Score`);
            qHeaders.push(`${colLabel} Time(s)`);
            if (c.includes('story') || c.includes('paragraph')) {
                qHeaders.push(`${colLabel} SSR 1 Ans`);
                qHeaders.push(`${colLabel} SSR 1 Score`);
                qHeaders.push(`${colLabel} SSR 2 Ans`);
                qHeaders.push(`${colLabel} SSR 2 Score`);
                qHeaders.push(`${colLabel} SSR 3 Ans`);
                qHeaders.push(`${colLabel} SSR 3 Score`);
            }
        });
    } else if (isChorCSV) {
        detail.columns.forEach((c) => {
            const colLabel = chorColLabel(c);
            qHeaders.push(colLabel);
            qHeaders.push(`${colLabel} Moves`);
            qHeaders.push(`${colLabel} Time(s)`);
        });
    } else if (activeGame?.key === 'atlantis_bagiya') {
        detail.columns.forEach((c) => {
            const colLabel = c.toUpperCase();
            qHeaders.push(colLabel);
            qHeaders.push(`${colLabel} Time(s)`);
            qHeaders.push(`${colLabel} Item Replays`);
            qHeaders.push(`${colLabel} Resp Replays`);
        });
    } else {
        const isRover = activeGame?.key === 'rover_mela' || activeGame?.title?.includes('Chalo Mela');
        if (isRover) {
            qHeaders.push(
                'Coins Budget (Session)', 'Coins Collected (Session)', 'Coin Efficiency (%)',
                'Coins Earned (Actual)', 'Retake Count', 'Refresh Count',
            );
            detail.columns.forEach((c) => {
                const isTQTrial = /^tq\d+_t[12]$/.test(c);
                const colLabel = isTQTrial
                    ? c.replace(/^(tq\d+)_t([12])$/, (_, q, t) => `${q.toUpperCase()} Trial ${t}`)
                    : c.toUpperCase();
                qHeaders.push(`${colLabel} Score`);
                qHeaders.push(`${colLabel} Moves`);
                qHeaders.push(`${colLabel} Time(s)`);
                qHeaders.push(`${colLabel} Retake`);
                qHeaders.push(`${colLabel} 🪙 Kept`);
                if (!isTQTrial) qHeaders.push(`${colLabel} Replays`);
            });
            qHeaders.push('Total Teaching Score');
        } else {
            detail.columns.forEach((c) => {
                const colLabel = c.toUpperCase();
                qHeaders.push(colLabel);
                qHeaders.push(`${colLabel} Time(s)`);
                if (activeGame?.key !== 'numeracy_number_skill' && activeGame?.key !== 'numeracy_number_skill_v2' && activeGame?.key !== 'numeracy_number_skill_v3') {
                    qHeaders.push(`${colLabel} Replays`);
                }
            });
        }
    }

    const headers = [
        'Session ID', 'Child ID', 'Child Name', 'Att. #', 'Start Date', 'Start Time', 'End Date', 'End Time',
        'Duration', 'Screentime',
        'Status', 'Total Correct', 'Total Questions', 'Final Score', 'Total Time(s)',
        ...qHeaders,
        'Attempted Questions', 'Actual Game Time(s)', 'Total Session Time(s)', 'Paused Questions', 'Pause Reasons',
        ...assessmentLabels
    ];
        
    const sortedRows = [...detail.data].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
    const rows = sortedRows.map(r => {
        const rowArr = [
            r.session_id, r.child_id, r.child_name, `#${r.child_attempt_no || '1'}`,
            fmtOnlyDate(r.start_time), fmtOnlyTime(r.start_time),
            fmtOnlyDate(r.end_time), fmtOnlyTime(r.end_time),
            r.actual_game_time != null ? fmtSecs(r.actual_game_time) : '—',
            r.screentime != null ? fmtSecs(r.screentime) : '—',
            r.status,
            r.correct_count ?? 0,
            r.total_questions ?? 0,
            `${r.correct_count ?? 0} / ${r.total_questions ?? 0}`,
            r.actual_game_time ? Math.round(r.actual_game_time) : '—'
        ];
        
        if (isAuditory) {
            const totalCorrectMap = { 1: 4, 2: 5, 3: 9, 4: 15 };
            [1, 2, 3, 4].forEach(q => {
                const qs = r.question_scores;
                rowArr.push(
                    qs[`q${q}`] ?? '',
                    totalCorrectMap[q],
                    qs[`q${q}_eoi`] ?? '',
                    qs[`q${q}_eoo`] ?? '',
                    qs[`q${q}_eoc`] ?? '',
                    qs[`q${q}_time`] ? Math.round(qs[`q${q}_time`]) : ''
                );
            });
        } else if (isHerPher) {
            [2,3,4,5,6,7,8,9].forEach(qId => {
                const qs = r.question_scores;
                rowArr.push(
                    qs[`q${qId}_total`] ?? '',
                    qs[`q${qId}_correct`] ?? '',
                    qs[`q${qId}_incorrect`] ?? '',
                    qs[`q${qId}`] ?? '',
                    qs[`q${qId}_time`] ? Math.round(qs[`q${qId}_time`]) : ''
                );
            });
        } else if (activeGame?.key === 'triangle_rachna') {
            detail?.columns?.forEach(c => {
                const qs = r.question_scores || {};
                rowArr.push(
                    qs[c] ?? '',
                    qs[`${c}_ass_q1`] ?? '',
                    qs[`${c}_ass_q2`] ?? '',
                    qs[`${c}_ass_q3`] ?? '',
                    qs[`${c}_time`] ? Math.round(qs[`${c}_time`]) : ''
                );
            });
        } else if (['literacy_reading_skill', 'literacy_reading_skill_v2'].includes(activeGame?.key)) {
            detail?.columns?.forEach(c => {
                const qs = r.question_scores || {};
                rowArr.push(qs[c] ?? '', qs[`${c}_time`] ? Math.round(qs[`${c}_time`]) : '');
                if (c.includes('story') || c.includes('paragraph')) {
                    const ssr = qs[`${c}_ssr`] || [];
                    rowArr.push(ssr[0]?.answer || '', ssr[0]?.score ?? '');
                    rowArr.push(ssr[1]?.answer || '', ssr[1]?.score ?? '');
                    rowArr.push(ssr[2]?.answer || '', ssr[2]?.score ?? '');
                }
            });
        } else if (isChorCSV) {
            detail?.columns?.forEach(c => {
                rowArr.push(r.question_scores?.[c] ?? '');
                rowArr.push(r.question_scores?.[`${c}_moves`] ?? '');
                rowArr.push(r.question_scores?.[`${c}_time`] ? Math.round(r.question_scores[`${c}_time`]) : '');
            });
        } else if (activeGame?.key === 'atlantis_bagiya') {
            detail?.columns?.forEach(c => {
                rowArr.push(r.question_scores?.[c] ?? '');
                rowArr.push(r.question_scores?.[`${c}_time`] ? Math.round(r.question_scores[`${c}_time`]) : '');
                rowArr.push(r.question_scores?.[`${c}_item_replays`] ?? '');
                rowArr.push(r.question_scores?.[`${c}_replays`] ?? '');
            });
        } else {
            const isRoverCSV = activeGame?.key === 'rover_mela' || activeGame?.title?.includes('Chalo Mela');
            if (isRoverCSV) {
                const budgetCols = (detail?.columns || []).filter(c => !/^tq\d+_t[12]$/.test(c));
                const allCols = detail?.columns || [];
                const totalBudget = budgetCols.reduce((s, c) => s + getRoverBudget(c), 0);
                const totalCollected = budgetCols.reduce((s, c) => {
                    const sc = r.question_scores?.[c]; const mv = r.question_scores?.[`${c}_moves`] ?? 0;
                    return s + (sc > 0 ? Math.max(0, getRoverBudget(c) - mv) : 0);
                }, 0);
                const efficiency = totalBudget > 0 ? Math.round((totalCollected / totalBudget) * 100) : 0;
                rowArr.push(
                    totalBudget, totalCollected, `${efficiency}%`,
                    r.coins_collected ?? '', r.retake_count ?? '', r.refresh_count ?? '',
                );
                allCols.forEach(c => {
                    const isTQTrial = /^tq\d+_t[12]$/.test(c);
                    const qs    = r.question_scores || {};
                    const sc    = qs[c] ?? '';
                    const moves = qs[`${c}_moves`] ?? '';
                    const time  = qs[`${c}_time`] ? Math.round(qs[`${c}_time`]) : '';
                    const retake = qs[`${c}_retakes`] ?? '';
                    const mv   = typeof moves === 'number' ? moves : (parseInt(moves) || 0);
                    const scNum = typeof sc === 'number' ? sc : (parseInt(sc) || 0);
                    const kept = isTQTrial
                        ? (qs[`${c}_coins_kept`] ?? 0)
                        : (scNum > 0 ? Math.max(0, getRoverBudget(c) - mv) : 0);
                    rowArr.push(sc, moves, time, retake, kept);
                    if (!isTQTrial) rowArr.push(qs[`${c}_replays`] ?? '');
                });
                rowArr.push(getTeachingTotal(r.question_scores));
            } else {
                (detail?.columns || []).forEach(c => {
                    const qs = r.question_scores || {};
                    rowArr.push(qs[c] ?? '');
                    rowArr.push(qs[`${c}_time`] ? Math.round(qs[`${c}_time`]) : '');
                    if (activeGame?.key !== 'numeracy_number_skill' && activeGame?.key !== 'numeracy_number_skill_v2' && activeGame?.key !== 'numeracy_number_skill_v3') {
                        rowArr.push(qs[`${c}_replays`] ?? '');
                    }
                });
            }
        }
        
        rowArr.push(
            r.attempted_questions ?? '', 
            r.actual_game_time ? Math.round(r.actual_game_time) : '',
            r.screentime != null ? Math.round(r.screentime) : '',
            (r.pauses||[]).map(p=>'Q'+(p.questionNumber||p.questionKey)).join('\n'),
            (r.pauses||[]).map(p=>(p.reason||'')).join('\n'),
            ...assessmentKeys.map(k => (r.assessment?.[k] || '').toString())
        );
        return rowArr;
    });

    return { headers, rows };
};
