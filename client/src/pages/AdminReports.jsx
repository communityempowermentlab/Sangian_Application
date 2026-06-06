import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';
// ─── Catalogue of all 9 games ─────────────────────────────────────────────────
const GAME_CATALOG = [
    { key: 'atlantis_bagiya',           icon: '🧠', title: 'Bagiya',        local: '',           tag: 'Visual Memory',    color: '#6366f1' },
    { key: 'number_recall_lottery',     icon: '🎟️', title: 'Lottery Ka Ticket',        local: '',tag: 'Auditory Span',    color: '#f59e0b' },
    { key: 'rover_mela',                icon: '🗺️', title: 'Chalo Mela Chalen',           local: '', tag: 'Spatial Planning', color: '#10b981' },
    { key: 'auditory_dhyan',            icon: '👂', title: 'Dhyan Kahan Hai',   local: '',  tag: 'Listening Focus',  color: '#8b5cf6' },
    { key: 'working_memory_herpher',    icon: '🔄', title: 'Her Pher',       local: '',         tag: 'Dynamic Memory',   color: '#0891b2' },
    { key: 'numeracy_number_skill',     icon: '🔢', title: 'Ankganit',        local: '',    tag: 'Academic – Maths', color: '#7c3aed' },
    { key: 'literacy_reading_skill',    icon: '📖', title: 'Padh ke batao',        local: '',   tag: 'Academic – Lang',  color: '#059669' },
    { key: 'cognitive_flex_chor',       icon: '⚡', title: 'Chor Machaye Shor',       local: '',tag: 'Rule Switching',   color: '#dc2626' },
    { key: 'triangle_rachna',           icon: '🔺', title: 'Rachna',             local: '',           tag: 'Construction',     color: '#ef4444' },
];

const statusBadge = (status) => {
    const map = {
        completed: { label: 'Completed', bg: '#d1fae5', color: '#065f46' },
        paused:    { label: 'Paused',    bg: '#fef9c3', color: '#854d0e' },
        quit:      { label: 'Quit',      bg: '#fee2e2', color: '#991b1b' },
        dropped:   { label: 'Dropped',   bg: '#ffedd5', color: '#9a3412' },
        in_progress:{ label: 'In Progress', bg: '#dbeafe', color: '#1e40af' },
    };
    const s = map[status] || { label: status, bg: '#f3f4f6', color: '#374151' };
    return (
        <span style={{
            background: s.bg, color: s.color,
            padding: '2px 10px', borderRadius: '999px',
            fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap'
        }}>{s.label}</span>
    );
};

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtOnlyDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtOnlyTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() : '—';

// Format a raw-seconds value → "45s" under 1 min, "2m 05s" at 1 min+
const fmtSecs = (v) => {
    if (v == null) return '—';
    const s = Math.round(Number(v));
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
};

// ─── Rover coin budget per question (t2 + 4 bonus) ────────────────────────────
const ROVER_Q_BUDGET = {
  tq1: 7, tq2: 7, tq3: 7, tq4: 9,
  q1: 7, q2: 7, q3: 8, q4: 6, q5: 8, q6: 9, q7: 9, q8: 8,
  q9: 10, q10: 9, q11: 10, q12: 11, q13: 9, q14: 9, q15: 11,
  q16: 13, q17: 12, q18: 12,
};
const getRoverBudget = (id) => ROVER_Q_BUDGET[id] || 0;

// ─── ChorMachayeShor column label helper ──────────────────────────────────────
const chorColLabel = (c) => {
    if (c === 'q1t1') return 'Item 1 (T1)';
    if (c === 'q1t2') return 'Item 1 (T2)';
    const m = c.match(/^q(\d+)$/);
    if (m) return `Item ${m[1]}`;
    return c.toUpperCase();
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminReports = () => {
    const navigate = useNavigate();
    const [overview, setOverview]       = useState([]);  // aggregated per game
    const [loadingOv, setLoadingOv]     = useState(true);

    // Drill-down state
    const [activeGame, setActiveGame]   = useState(null); // game catalog entry
    const [detail, setDetail]           = useState(null); // { columns, data }
    const [loadingDt, setLoadingDt]     = useState(false);

    // Sort state for detail table
    const [sortField, setSortField]     = useState('start_time');
    const [sortDir, setSortDir]         = useState('desc');

    // Filter state
    const [filterStatus, setFilterStatus] = useState(null);

    // Reading Skill Expansion state
    const [expandedRows, setExpandedRows] = useState({}); // { sessionId: boolean }

    // Pause/Quit Details Modal state
    const [pqModal, setPqModal] = useState({ show: false, pauses: [], childName: '' });

    // Her Pher Data Modal state
    const [hpDataModal, setHpDataModal] = useState({ show: false, rowData: null });

    const closeDetail = () => { setActiveGame(null); setDetail(null); setFilterStatus(null); setExpandedRows({}); setPqModal({ show: false, pauses: [], childName: '', quitReason: '' }); setHpDataModal({ show: false, rowData: null }); };

    // ── Fetch overview on mount ────────────────────────────────────────────────
    const fetchOverview = useCallback(async () => {
        setLoadingOv(true);
        try {
            const res = await axiosAdmin.get('/games/reports/overview');
            setOverview(res.data.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingOv(false);
        }
    }, []);

    useEffect(() => { fetchOverview(); }, [fetchOverview]);

    // ── Fetch detail for a specific game ──────────────────────────────────────
    const openGame = async (game) => {
        setActiveGame(game);
        setLoadingDt(true);
        setFilterStatus(null);
        try {
            const res = await axiosAdmin.get(`/games/reports/detail/${game.key}`);
            setDetail({ columns: res.data.columns || [], data: res.data.data || [] });
        } catch (e) {
            console.error(e);
            setDetail({ columns: [], data: [] });
        } finally {
            setLoadingDt(false);
        }
    };

    // ── Merge overview DB data with catalog ───────────────────────────────────
    const getStats = (key) => overview.find(r => r.game_name === key) || {};

    // ── Filtered rows ─────────────────────────────────────────────────────────
    const filteredRows = detail ? detail.data.filter(r => {
        if (!filterStatus) return true;
        if (filterStatus === 'attempts') return true;
        return r.status === filterStatus;
    }) : [];

    // ── Sorted detail rows ────────────────────────────────────────────────────
    const sortedRows = [...filteredRows].sort((a, b) => {
        let va = a[sortField], vb = b[sortField];
        if (sortField === 'start_time') { va = new Date(va); vb = new Date(vb); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <span style={{ opacity: 0.3 }}>⇅</span>;
        return <span>{sortDir === 'asc' ? '↑' : '↓'}</span>;
    };

    // ── Export CSV ────────────────────────────────────────────────────────────
    const exportCSV = () => {
        if (!detail) return;
        const assessmentKeys = ['q1_enjoyment','q2_feeling','q3_tiredness','q4_play_again','q5_behaviors','additional_notes'];
        const assessmentLabels = ['Enjoyed?','Feeling?','Tired?','Play Again?','Behaviours','Notes'];
        
        const isAuditory = activeGame?.key === 'auditory_dhyan';
        const isHerPher  = activeGame?.key === 'working_memory_herpher';
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
            // Q1–Q8 = internal qIds 2–9 (qId 1 is sample, excluded)
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
        } else if (activeGame?.key === 'literacy_reading_skill') {
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
        } else {
            const isRover = activeGame?.key === 'rover_mela' || activeGame?.title?.includes('Chalo Mela');
            if (isRover) {
                // Coin summary columns come first (matching datatable layout)
                qHeaders.push(
                    'Coins Budget (Session)', 'Coins Collected (Session)', 'Coin Efficiency (%)',
                    'Coins Earned (Actual)', 'Retake Count', 'Refresh Count',
                );
            }
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
                if (!isTQTrial && isRover) {
                    qHeaders.push(`${colLabel} Replays`);
                }
            });
        }

        const headers = [
            'Session ID', 'Child ID', 'Child Name', 'Start Date', 'Start Time', 'End Date', 'End Time',
            'Status', 'Total Correct', 'Total Questions', 'Final Score', 'Total Moves', 'Total Time(s)',
            ...qHeaders,
            'Attempted Questions', 'Actual Game Time(s)', 'Total Session Time(s)', 'Paused Questions', 'Pause Reasons',
            ...assessmentLabels
        ];
            
        const rows = sortedRows.map(r => {
            const rowArr = [
                r.session_id, r.child_id, r.child_name,
                fmtOnlyDate(r.start_time), fmtOnlyTime(r.start_time),
                fmtOnlyDate(r.end_time), fmtOnlyTime(r.end_time),
                r.status,
                r.correct_count ?? 0,
                r.total_questions ?? 0,
                `${r.correct_count ?? 0} / ${r.total_questions ?? 0}`,
                r.total_moves ?? '—',
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
            } else if (activeGame?.key === 'literacy_reading_skill') {
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
            } else {
                const isRoverCSV = activeGame?.key === 'rover_mela' || activeGame?.title?.includes('Chalo Mela');
                if (isRoverCSV) {
                    // Session-level coin summary (same columns added to qHeaders above)
                    const cols = detail?.columns || [];
                    const totalBudget = cols.reduce((s, c) => s + getRoverBudget(c.replace(/_t[12]$/, '')), 0);
                    const totalCollected = cols.reduce((s, c) => {
                        const isTQTrial = /^tq\d+_t[12]$/.test(c);
                        if (isTQTrial) return s;
                        const sc = r.question_scores?.[c]; const mv = r.question_scores?.[`${c}_moves`] ?? 0;
                        return s + (sc > 0 ? Math.max(0, getRoverBudget(c) - mv) : 0);
                    }, 0);
                    const efficiency = totalBudget > 0 ? Math.round((totalCollected / totalBudget) * 100) : 0;
                    rowArr.push(
                        totalBudget, totalCollected, `${efficiency}%`,
                        r.coins_collected ?? '', r.retake_count ?? '', r.refresh_count ?? '',
                    );
                }
                detail?.columns?.forEach(c => {
                    const isTQTrial = /^tq\d+_t[12]$/.test(c);
                    const qs    = r.question_scores || {};
                    const sc    = qs[c] ?? '';
                    const moves = qs[`${c}_moves`] ?? '';
                    const time  = qs[`${c}_time`] ? Math.round(qs[`${c}_time`]) : '';
                    const retake = qs[`${c}_retakes`] ?? '';
                    const mv   = typeof moves === 'number' ? moves : (parseInt(moves) || 0);
                    const scNum = typeof sc === 'number' ? sc : (parseInt(sc) || 0);
                    const kept = isTQTrial
                        ? (qs[`${c}_coins_kept`] ?? (scNum > 0 ? Math.max(0, getRoverBudget(c.replace(/_t[12]$/, '')) - mv) : 0))
                        : (scNum > 0 ? Math.max(0, getRoverBudget(c) - mv) : 0);
                    rowArr.push(sc, moves, time, retake, kept);
                    if (!isTQTrial && isRoverCSV) {
                        rowArr.push(qs[`${c}_replays`] ?? '');
                    }
                });
            }
            
            rowArr.push(
                r.attempted_questions ?? '', 
                r.actual_game_time ? Math.round(r.actual_game_time) : '',
                r.total_session_time ? Math.round(r.total_session_time) : '',
                `"${(r.pauses||[]).map(p=>'Q'+(p.questionNumber||p.questionKey)).join('\n')}"`,
                `"${(r.pauses||[]).map(p=>(p.reason||'').replace(/"/g, '""')).join('\n')}"`,
                ...assessmentKeys.map(k => `"${(r.assessment?.[k] || '').toString().replace(/"/g, '""')}"`)
            );
            return rowArr;
        });
        
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${activeGame?.key}_report.csv`; a.click();
    };

    // ── Styles ────────────────────────────────────────────────────────────────
    const S = {
        page: { padding: '28px 32px', fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#f8fafc' },
        pageTitle: { fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 },
        pageSub:   { fontSize: '0.9rem', color: '#64748b', marginBottom: 28 },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 20 },
        card: (color) => ({
            background: '#fff', borderRadius: 16, padding: '20px 22px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
            borderTop: `4px solid ${color}`, transition: 'transform 0.15s, box-shadow 0.15s',
        }),
        cardIcon:  { fontSize: '2rem', marginBottom: 8 },
        cardTitle: { fontWeight: 700, fontSize: '1rem', color: '#0f172a' },
        cardLocal: { fontSize: '0.78rem', color: '#94a3b8', marginBottom: 12 },
        tag:       (color) => ({ display: 'inline-block', background: color + '18', color, padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, marginBottom: 16 }),
        kpiRow:    { display: 'flex', gap: 14, flexWrap: 'wrap' },
        kpi:       (isActive) => ({ flex: 1, minWidth: 65, background: isActive ? '#f1f5f9' : '#f8fafc', borderRadius: 10, padding: '8px 12px', textAlign: 'center', border: isActive ? '2px solid #6366f1' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s ease' }),
        kpiVal:    { fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' },
        kpiLbl:    { fontSize: '0.68rem', color: '#94a3b8', marginTop: 1 },
        // Detail view
        breadcrumb:{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
        backBtn:   { background: '#f1f5f9', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', padding: '6px 14px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 },
        tableWrap: { overflowX: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 16 },
        table:     { width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', minWidth: 900 },
        th:        { background: '#f1f5f9', padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' },
        td:        { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155', verticalAlign: 'middle', whiteSpace: 'nowrap' },
        tdCenter:  { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155', textAlign: 'center', verticalAlign: 'middle' },
        scoreCell: (v, isTriangle) => ({
            padding: '9px 12px', borderBottom: '1px solid #f1f5f9',
            textAlign: 'center', verticalAlign: 'middle',
            color: v > 0 ? '#059669' : v === 0 ? '#dc2626' : '#94a3b8',
            fontWeight: v !== null && v !== undefined ? 700 : 400,
        }),
        topBar:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
        exportBtn: { background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
    };

    // ─────────────────────────────────────────────────────────────────────────
    // DETAIL VIEW
    // ─────────────────────────────────────────────────────────────────────────
    if (activeGame) {
        const ASSESSMENT_COLS = [
            { key: 'q1_enjoyment',    label: 'A-Q1 Enjoyed?' },
            { key: 'q2_feeling',      label: 'A-Q2 Feeling?' },
            { key: 'q3_tiredness',    label: 'A-Q3 Tired?' },
            { key: 'q4_play_again',   label: 'A-Q4 Play Again?' },
            { key: 'q5_behaviors',    label: 'A-Q5 Behaviours' },
            { key: 'additional_notes',label: 'Notes' },
        ];

        return (
            <main style={S.page}>
                {/* Breadcrumb */}
                <div style={S.breadcrumb}>
                    <button style={S.backBtn} onClick={closeDetail}>← Back</button>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Reports</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>/</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                        {activeGame.icon} {activeGame.title}
                    </span>
                </div>

                <div style={S.topBar}>
                    <div style={{ flex: 1 }}>
                        <div style={S.pageTitle}>{activeGame.title} — Attempt Log</div>
                        <div style={S.pageSub}>One row per attempt · Latest first · {filteredRows.length} records</div>
                    </div>
                    
                    {/* Real-time Summary Header */}
                    {(() => {
                        const s = getStats(activeGame.key);
                        return (
                            <div style={{ display: 'flex', gap: '16px', marginRight: '32px', background: '#fff', padding: '8px 20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <div style={S.kpi(filterStatus === 'attempts')} onClick={() => setFilterStatus(filterStatus === 'attempts' ? null : 'attempts')}>
                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Attempts</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{s.total_attempts ?? 0}</div>
                                </div>
                                <div style={S.kpi(filterStatus === 'in_progress')} onClick={() => setFilterStatus(filterStatus === 'in_progress' ? null : 'in_progress')}>
                                    <div style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase' }}>In Progress</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb' }}>{s.in_progress ?? 0}</div>
                                </div>
                                <div style={S.kpi(filterStatus === 'completed')} onClick={() => setFilterStatus(filterStatus === 'completed' ? null : 'completed')}>
                                    <div style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Completed</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{s.completed ?? 0}</div>
                                </div>
                                <div style={S.kpi(filterStatus === 'quit')} onClick={() => setFilterStatus(filterStatus === 'quit' ? null : 'quit')}>
                                    <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Quit</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>{s.quit_count ?? 0}</div>
                                </div>
                                <div style={S.kpi(filterStatus === 'dropped')} onClick={() => setFilterStatus(filterStatus === 'dropped' ? null : 'dropped')}>
                                    <div style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>Dropped</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>{s.dropped_count ?? 0}</div>
                                </div>
                                <div style={S.kpi(filterStatus === 'paused')} onClick={() => setFilterStatus(filterStatus === 'paused' ? null : 'paused')}>
                                    <div style={{ fontSize: '0.65rem', color: '#854d0e', fontWeight: 700, textTransform: 'uppercase' }}>Paused</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#854d0e' }}>{s.paused ?? 0}</div>
                                </div>
                            </div>
                        );
                    })()}

                    <button style={S.exportBtn} onClick={exportCSV}>⬇ Export CSV</button>
                </div>

                {loadingDt ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: '1rem' }}>Loading…</div>
                ) : detail?.data.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: '1rem' }}>
                        No attempts recorded yet for this test.
                    </div>
                ) : (
                    <div style={S.tableWrap}>
                        <table style={S.table}>
                            <thead>
                                <tr>
                                    <th style={S.th}>#</th>
                                    <th style={S.th} onClick={() => toggleSort('child_id')}>Child ID <SortIcon field="child_id"/></th>
                                    <th style={S.th} onClick={() => toggleSort('child_name')}>Name <SortIcon field="child_name"/></th>
                                    <th style={{ ...S.th, textAlign: 'center' }}>Att. #</th>
                                    <th style={S.th} onClick={() => toggleSort('start_time')}>Start Date <SortIcon field="start_time"/></th>
                                    <th style={S.th} onClick={() => toggleSort('start_time')}>Start Time</th>
                                    <th style={S.th} onClick={() => toggleSort('end_time')}>End Date <SortIcon field="end_time"/></th>
                                    <th style={S.th} onClick={() => toggleSort('end_time')}>End Time</th>
                                    <th style={{ ...S.th, textAlign: 'center', background: '#f0fdf4', color: '#065f46' }}>Duration</th>
                                    <th style={{ ...S.th, textAlign: 'center', background: '#eff6ff', color: '#1e40af' }}>Screentime</th>
                                    {/* Per-question score columns */}
                                    {activeGame?.key === 'auditory_dhyan' ? (
                                        [1, 2, 3, 4].map(q => (
                                            <React.Fragment key={`qh-${q}`}>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe' }}>Q{q} Correct</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe' }}>Q{q} Max Score</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#fee2e2' }}>Q{q} EOI</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#fee2e2' }}>Q{q} EOO</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#fee2e2' }}>Q{q} EOC</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#fef3c7' }}>Q{q} Playtime(s)</th>
                                            </React.Fragment>
                                        ))
                                    ) : activeGame?.key === 'working_memory_herpher' ? (
                                        [1,2,3,4,5,6,7,8].map(q => (
                                            <React.Fragment key={`hph-${q}`}>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#e2e8f0', minWidth: 60 }}>Q{q} Total Images</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#dbeafe', minWidth: 60 }}>Q{q} User Correct</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#fee2e2', minWidth: 60 }}>Q{q} Incorrect</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#d1fae5', minWidth: 60 }}>Q{q} Score</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#fef9c3', minWidth: 60 }}>Q{q} Time(s)</th>
                                            </React.Fragment>
                                        ))
                                    ) : activeGame?.key === 'cognitive_flex_chor' ? (
                                        <>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#fef9c3' }}>Total Moves</th>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe' }}>Total Time</th>
                                            {detail?.columns?.map(c => (
                                                <React.Fragment key={c}>
                                                    <th style={{ ...S.th, textAlign: 'center', background: '#d1fae5', minWidth: 80 }}>{chorColLabel(c)} Score</th>
                                                    <th style={{ ...S.th, textAlign: 'center', background: '#fef9c3', minWidth: 60 }}>Moves</th>
                                                    <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe', minWidth: 60 }}>Time(s)</th>
                                                </React.Fragment>
                                            ))}
                                        </>
                                    ) : (activeGame?.key === 'rover_mela' || activeGame?.title?.includes('Chalo Mela')) ? (
                                        <>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#fef9c3' }}>Total Moves</th>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe' }}>Total Time</th>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#fef3c7' }}>🪙 Budget</th>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#fef3c7' }}>🪙 Collected</th>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#fef3c7' }}>🪙 Coins Earned</th>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#fce7f3' }}>Retakes</th>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#ede9fe' }}>Refreshes</th>
                                            {detail?.columns?.map(c => {
                                                const isTQTrial = /^tq\d+_t[12]$/.test(c);
                                                const tqTrialLabel = isTQTrial
                                                    ? c.replace(/^(tq\d+)_t([12])$/, (_, q, t) => `${q.toUpperCase()} Trial ${t}`)
                                                    : null;
                                                const bg = isTQTrial
                                                    ? (c.endsWith('_t1') ? '#dbeafe' : '#e0e7ff')
                                                    : '#d1fae5';
                                                return (
                                                    <React.Fragment key={c}>
                                                        <th style={{ ...S.th, textAlign: 'center', background: bg, minWidth: 70 }}>
                                                            {isTQTrial ? tqTrialLabel : `${c.toUpperCase()} Score`}
                                                        </th>
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#fef9c3', minWidth: 60 }}>Moves</th>
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe', minWidth: 60 }}>Time(s)</th>
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#fce7f3', minWidth: 60 }}>Retake</th>
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#fef3c7', minWidth: 60 }}>🪙 Kept</th>
                                                        {!isTQTrial && <th style={{ ...S.th, textAlign: 'center', background: '#ede9fe', minWidth: 60 }}>Replays</th>}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </>
                                    ) : activeGame?.key === 'triangle_rachna' ? (
                                        detail.columns.map((c, idx) => {
                                            const colLabel = `Q${idx + 1}`;
                                            return (
                                                <React.Fragment key={c}>
                                                    <th style={{ ...S.th, textAlign: 'center', background: '#dbeafe', minWidth: 60 }}>{colLabel} Score</th>
                                                    <th style={{ ...S.th, textAlign: 'center', background: '#e0e7ff', minWidth: 60 }}>{colLabel} Gap &gt; 2?</th>
                                                    <th style={{ ...S.th, textAlign: 'center', background: '#e0e7ff', minWidth: 60 }}>{colLabel} Align &gt; 2?</th>
                                                    <th style={{ ...S.th, textAlign: 'center', background: '#e0e7ff', minWidth: 60 }}>{colLabel} Match?</th>
                                                    <th style={{ ...S.th, textAlign: 'center', background: '#fef9c3', minWidth: 60 }}>{colLabel} Time(s)</th>
                                                </React.Fragment>
                                            );
                                        })
                                    ) : activeGame?.key === 'literacy_reading_skill' ? (
                                        <>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#d1fae5' }}>Total Score</th>
                                            <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe' }}>Total Time</th>
                                            {detail?.columns?.map((c, idx) => {
                                                const qNum = idx + 1;
                                                const isSSR = qNum === 21 || qNum === 22;
                                                return (
                                                    <React.Fragment key={c}>
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#d1fae5', minWidth: 60 }}>Q{qNum} Score</th>
                                                        {isSSR && (
                                                            <>
                                                                <th style={{ ...S.th, textAlign: 'center', background: '#ede9fe', minWidth: 60 }}>Skip Words?</th>
                                                                <th style={{ ...S.th, textAlign: 'center', background: '#ede9fe', minWidth: 60 }}>Pronunc. Err?</th>
                                                                <th style={{ ...S.th, textAlign: 'center', background: '#ede9fe', minWidth: 60 }}>Need Help?</th>
                                                            </>
                                                        )}
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe', minWidth: 60 }}>Time(s)</th>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        detail.columns.map((c, idx) => {
                                            const isAtlantis = activeGame?.key === 'atlantis_bagiya';
                                            const colLabel = c.toUpperCase();
                                            return (
                                                <React.Fragment key={c}>
                                                    <th style={{ ...S.th, textAlign: 'center', minWidth: 52 }}>{colLabel}</th>
                                                    <th style={{ ...S.th, textAlign: 'center', minWidth: 52 }}>TIME(S)</th>
                                                    {activeGame?.key !== 'numeracy_number_skill' && (
                                                        <th style={{ ...S.th, textAlign: 'center', minWidth: 52 }}>REPLAYS</th>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                    
                                    <th style={{ ...S.th, textAlign: 'center' }} onClick={() => toggleSort('score')}>
                                        {['working_memory_herpher', 'auditory_dhyan'].includes(activeGame?.key) ? 'Total Score' : 'Score Summary'} <SortIcon field="score"/>
                                    </th>
                                    {activeGame?.key === 'working_memory_herpher' && (
                                        <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe' }}>Match Analysis</th>
                                    )}
                                    <th style={{ ...S.th, textAlign: 'center' }}>Status</th>
                                    
                                    <th style={{ ...S.th, textAlign: 'center' }}>Pause & Quit</th>

                                    {/* Assessment columns — visually separated */}
                                    {ASSESSMENT_COLS.map(ac => (
                                        <th key={ac.key} style={{ ...S.th, background: '#ede9fe', color: '#6d28d9', minWidth: 120 }}>{ac.label}</th>
                                    ))}
                                    <th style={{ ...S.th, textAlign: 'center', background: '#fee2e2', color: '#b91c1c', minWidth: 110 }}>📄 PDF</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((row, i) => {
                                    const isRover = activeGame?.key === 'rover_mela' || activeGame?.title?.includes('Chalo Mela');
                                    const isChor = activeGame?.key === 'cognitive_flex_chor' || activeGame?.title?.includes('Chor Machaye');
                                    const isHerPher = activeGame?.key === 'working_memory_herpher';
                                    
                                    return (
                                        <React.Fragment key={row.session_id}>
                                            <tr style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            <td style={S.td}>{i + 1}</td>
                                            <td style={{ ...S.td, fontWeight: 600 }}>{row.child_id}</td>
                                            <td style={S.td}>{row.child_name}</td>
                                            <td style={{ ...S.td, textAlign: 'center' }}>
                                                <span style={{ 
                                                    background: '#f1f5f9', color: '#475569', 
                                                    padding: '2px 8px', borderRadius: '6px', 
                                                    fontSize: '0.7rem', fontWeight: 700 
                                                }}>
                                                    #{row.child_attempt_no || '1'}
                                                </span>
                                            </td>
                                            <td style={{ ...S.td, textTransform: 'uppercase' }}>{fmtOnlyDate(row.start_time)}</td>
                                            <td style={{ ...S.td, color: '#64748b' }}>{fmtOnlyTime(row.start_time)}</td>
                                            <td style={{ ...S.td, textTransform: 'uppercase' }}>{fmtOnlyDate(row.end_time)}</td>
                                            <td style={{ ...S.td, color: '#64748b' }}>{fmtOnlyTime(row.end_time)}</td>
                                            <td style={{ ...S.tdCenter, color: '#065f46', fontWeight: 600 }}>
                                                {(() => {
                                                    const dur = Object.entries(row.question_scores || {})
                                                        .filter(([k]) => k.endsWith('_time'))
                                                        .reduce((acc, [, v]) => acc + (Number(v) || 0), 0);
                                                    return dur > 0 ? fmtSecs(dur) : '—';
                                                })()}
                                            </td>
                                            <td style={{ ...S.tdCenter, color: '#1e40af', fontWeight: 600 }}>
                                                {(() => {
                                                    const st = row.saved_state?.screentime ?? row.saved_state?.timerSeconds;
                                                    if (st != null && st > 0) return fmtSecs(Math.round(st));
                                                    if (row.end_time && row.start_time)
                                                        return fmtSecs(Math.round((new Date(row.end_time) - new Date(row.start_time)) / 1000));
                                                    return '—';
                                                })()}
                                            </td>

                                            {activeGame?.key === 'auditory_dhyan' ? (
                                                [1, 2, 3, 4].map(q => {
                                                    const totalCorrectMap = { 1: 4, 2: 5, 3: 9, 4: 15 };
                                                    const qs = row.question_scores;
                                                    return (
                                                        <React.Fragment key={`qd-${q}`}>
                                                            <td style={{ ...S.tdCenter, fontWeight: 700, color: '#0369a1' }}>{qs[`q${q}`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#64748b' }}>{totalCorrectMap[q]}</td>
                                                            <td style={{ ...S.tdCenter, color: '#991b1b' }}>{qs[`q${q}_eoi`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#991b1b' }}>{qs[`q${q}_eoo`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#991b1b' }}>{qs[`q${q}_eoc`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#854d0e' }}>{fmtSecs(qs[`q${q}_time`])}</td>
                                                        </React.Fragment>
                                                    );
                                                })
                                            ) : activeGame?.key === 'working_memory_herpher' ? (
                                                [2,3,4,5,6,7,8,9].map((qId, i) => {
                                                    const qs = row.question_scores;
                                                    const total = qs[`q${qId}_total`];
                                                    const correct = qs[`q${qId}_correct`];
                                                    const incorrect = qs[`q${qId}_incorrect`];
                                                    const score = qs[`q${qId}`];
                                                    const time = qs[`q${qId}_time`];
                                                    return (
                                                        <React.Fragment key={`hp-${qId}`}>
                                                            <td style={{ ...S.tdCenter, color: '#475569', fontWeight: 600 }}>{total ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#0369a1', fontWeight: 600 }}>{correct ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#991b1b', fontWeight: 600 }}>{incorrect ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: score > 0 ? '#059669' : '#94a3b8', fontWeight: 700 }}>{score ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#64748b' }}>{fmtSecs(time)}</td>
                                                        </React.Fragment>
                                                    );
                                                })
                                            ) : isRover ? (
                                                <>
                                                    <td style={{ ...S.tdCenter, fontWeight: 700, color: '#1e293b' }}>{row.total_moves ?? '—'}</td>
                                                    <td style={{ ...S.tdCenter, fontWeight: 600, color: '#64748b' }}>{fmtSecs(row.actual_game_time)}</td>
                                                    {(() => {
                                                        const cols = detail?.columns || [];
                                                        const qs = row.question_scores || {};
                                                        const totalBudget = cols.reduce((s, c) => s + getRoverBudget(c.replace(/_t[12]$/, '')), 0);
                                                        const totalCollected = cols.reduce((s, c) => {
                                                            const isTQTrial = /^tq\d+_t[12]$/.test(c);
                                                            if (isTQTrial) return s;
                                                            const sc = qs[c]; const mv = qs[`${c}_moves`] ?? 0;
                                                            return s + (sc > 0 ? Math.max(0, getRoverBudget(c) - mv) : 0);
                                                        }, 0);
                                                        return (
                                                            <>
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: '#b45309' }}>{totalBudget}</td>
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: '#b45309' }}>{totalCollected}</td>
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: '#92400e', background: '#fffbeb' }}>
                                                                    {row.coins_collected ?? '—'}
                                                                </td>
                                                                <td style={{ ...S.tdCenter, color: '#9d174d' }}>{row.retake_count ?? '—'}</td>
                                                                <td style={{ ...S.tdCenter, color: '#5b21b6' }}>{row.refresh_count ?? '—'}</td>
                                                            </>
                                                        );
                                                    })()}
                                                    {(detail?.columns || []).map(c => {
                                                        const qs = row.question_scores || {};
                                                        const score = qs[c];
                                                        const moves = qs[`${c}_moves`] ?? 0;
                                                        const isTQTrial = /^tq\d+_t[12]$/.test(c);
                                                        const budget  = getRoverBudget(c.replace(/_t[12]$/, ''));
                                                        const kept    = isTQTrial
                                                            ? (qs[`${c}_coins_kept`] ?? (score > 0 ? Math.max(0, budget - moves) : 0))
                                                            : (score > 0 ? Math.max(0, budget - moves) : 0);
                                                        const retakes = qs[`${c}_retakes`] ?? '—';
                                                        const trialBg = isTQTrial
                                                            ? (c.endsWith('_t1') ? 'rgba(219,234,254,0.25)' : 'rgba(224,231,255,0.25)')
                                                            : 'transparent';
                                                        return (
                                                            <React.Fragment key={`rm-${c}`}>
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, background: trialBg,
                                                                    color: score > 0 ? '#059669' : score === 0 ? '#dc2626' : '#94a3b8' }}>
                                                                    {score ?? '—'}
                                                                </td>
                                                                <td style={{ ...S.tdCenter, color: '#1e293b', background: trialBg }}>{moves || '—'}</td>
                                                                <td style={{ ...S.tdCenter, color: '#64748b', background: trialBg }}>{fmtSecs(qs[`${c}_time`])}</td>
                                                                <td style={{ ...S.tdCenter, color: '#9d174d', background: trialBg }}>{score != null ? retakes : '—'}</td>
                                                                <td style={{ ...S.tdCenter, color: kept > 0 ? '#b45309' : '#94a3b8', fontWeight: kept > 0 ? 700 : 400, background: trialBg }}>
                                                                    {score != null ? (kept > 0 ? `+${kept}` : '0') : '—'}
                                                                </td>
                                                                {!isTQTrial && <td style={{ ...S.tdCenter, color: '#6d28d9', fontWeight: 600 }}>{qs[`${c}_replays`] ?? '—'}</td>}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </>
                                            ) : isChor ? (
                                                <>
                                                    <td style={{ ...S.tdCenter, fontWeight: 700, color: '#1e293b' }}>{row.total_moves ?? '—'}</td>
                                                    <td style={{ ...S.tdCenter, fontWeight: 600, color: '#64748b' }}>{fmtSecs(row.actual_game_time)}</td>
                                                    {(detail?.columns || []).map(c => {
                                                        const qs = row.question_scores || {};
                                                        const score = qs[c];
                                                        return (
                                                            <React.Fragment key={`chor-${c}`}>
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: score > 0 ? '#059669' : score === 0 ? '#dc2626' : '#94a3b8' }}>{score ?? '—'}</td>
                                                                <td style={{ ...S.tdCenter, color: '#1e293b' }}>{qs[`${c}_moves`] ?? '—'}</td>
                                                                <td style={{ ...S.tdCenter, color: '#64748b' }}>{fmtSecs(qs[`${c}_time`])}</td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </>
                                            ) : activeGame?.key === 'triangle_rachna' ? (
                                                detail.columns.map(c => {
                                                    const qs = row.question_scores;
                                                    const v = qs[c];
                                                    return (
                                                        <React.Fragment key={`tr-${c}`}>
                                                            <td style={{ ...S.tdCenter, fontWeight: 700, color: v > 0 ? '#059669' : v === 0 ? '#dc2626' : '#94a3b8' }}>{v != null ? `${v}/2` : '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q1`] === 'YES' ? '#059669' : qs[`${c}_ass_q1`] === 'NO' ? '#dc2626' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{qs[`${c}_ass_q1`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q2`] === 'YES' ? '#059669' : qs[`${c}_ass_q2`] === 'NO' ? '#dc2626' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{qs[`${c}_ass_q2`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q3`] === 'YES' ? '#059669' : qs[`${c}_ass_q3`] === 'NO' ? '#dc2626' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{qs[`${c}_ass_q3`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#64748b' }}>{fmtSecs(qs[`${c}_time`])}</td>
                                                        </React.Fragment>
                                                    );
                                                })
                                            ) : activeGame?.key === 'literacy_reading_skill' ? (
                                                <>
                                                    <td style={{ ...S.tdCenter, fontWeight: 700, color: '#059669' }}>{row.score != null ? `${row.score}/22` : '—'}</td>
                                                    <td style={{ ...S.tdCenter, color: '#64748b' }}>{fmtSecs(row.actual_game_time)}</td>
                                                    {detail?.columns?.map((c, idx) => {
                                                        const qNum = idx + 1;
                                                        const isSSR = qNum === 21 || qNum === 22;
                                                        const qs = row.question_scores;
                                                        const score = qs[c];
                                                        return (
                                                            <React.Fragment key={`rs-${c}`}>
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: score > 0 ? '#059669' : score === 0 ? '#dc2626' : '#94a3b8' }}>{score ?? '—'}</td>
                                                                {isSSR && (
                                                                    <>
                                                                        <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q1`] === 'YES' ? '#dc2626' : qs[`${c}_ass_q1`] === 'NO' ? '#059669' : '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{qs[`${c}_ass_q1`] ?? '—'}</td>
                                                                        <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q2`] === 'YES' ? '#dc2626' : qs[`${c}_ass_q2`] === 'NO' ? '#059669' : '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{qs[`${c}_ass_q2`] ?? '—'}</td>
                                                                        <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q3`] === 'YES' ? '#dc2626' : qs[`${c}_ass_q3`] === 'NO' ? '#059669' : '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{qs[`${c}_ass_q3`] ?? '—'}</td>
                                                                    </>
                                                                )}
                                                                <td style={{ ...S.tdCenter, color: '#64748b' }}>{fmtSecs(qs[`${c}_time`])}</td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </>
                                            ) : (
                                                detail.columns.map(c => {
                                                    const v = row.question_scores[c];
                                                    const isAtlantis = activeGame?.key === 'atlantis_bagiya';
                                                    return (
                                                        <React.Fragment key={c}>
                                                            <td style={S.scoreCell(v, isAtlantis)}>
                                                                {v != null ? v : '—'}
                                                            </td>
                                                            <td style={S.tdCenter}>{fmtSecs(row.question_scores[`${c}_time`])}</td>
                                                            {activeGame?.key !== 'numeracy_number_skill' && (
                                                                <td style={{ ...S.tdCenter, color: '#6d28d9' }}>{row.question_scores[`${c}_replays`] ?? '—'}</td>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                            
                                            <td style={{ ...S.tdCenter, fontWeight: 700, fontSize: '0.8rem', lineHeight: '1.4', whiteSpace: 'nowrap' }}>
                                                {['working_memory_herpher', 'auditory_dhyan'].includes(activeGame?.key)
                                                    ? (row.score ?? '—')
                                                    : (
                                                        <>
                                                           <div style={{ color: '#059669', marginBottom: '2px' }}>Corr: {row.correct_count ?? 0} / {row.total_questions ?? '—'}</div>
                                                           <div style={{ color: '#64748b' }}>Att: {row.attempted_questions ?? '—'} / {row.total_questions ?? '—'}</div>
                                                        </>
                                                    )
                                                }
                                            </td>
                                            {isHerPher && (
                                                <td style={S.tdCenter}>
                                                    <button 
                                                        onClick={() => setHpDataModal({ show: true, rowData: row })}
                                                        style={{ background:'#38bdf8', color:'#fff', padding:'4px 12px', border:'none', borderRadius:'12px', fontWeight:'bold', fontSize:'0.8rem', cursor:'pointer' }}
                                                    >
                                                        View Data
                                                    </button>
                                                </td>
                                            )}
                                            <td style={S.tdCenter}>
                                                {statusBadge(row.status)}
                                            </td>
                                            <td style={S.tdCenter}>
                                                {row.pauses && row.pauses.length > 0 ? (
                                                    <button 
                                                        onClick={() => setPqModal({ show: true, pauses: row.pauses, childName: row.child_name, quitReason: row.quit_reason })}
                                                        style={{ background:'#fef08a', color:'#854d0e', padding:'4px 12px', border:'none', borderRadius:'12px', fontWeight:'bold', fontSize:'0.8rem', cursor:'pointer' }}
                                                    >
                                                        View Details ({row.pauses.length})
                                                    </button>
                                                ) : row.quit_reason ? (
                                                    <button 
                                                        onClick={() => setPqModal({ show: true, pauses: [], childName: row.child_name, quitReason: row.quit_reason })}
                                                        style={{ background:'#fee2e2', color:'#991b1b', padding:'4px 12px', border:'none', borderRadius:'12px', fontWeight:'bold', fontSize:'0.8rem', cursor:'pointer' }}
                                                    >
                                                        View Details
                                                    </button>
                                                ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                                            </td>
                                            {ASSESSMENT_COLS.map(ac => (
                                                <td key={ac.key} style={{ ...S.td, background: '#faf5ff', fontSize: '0.8rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    title={row.assessment?.[ac.key] || ''}>
                                                    {row.assessment?.[ac.key] || <span style={{ color: '#d1d5db' }}>—</span>}
                                                </td>
                                            ))}
                                            <td style={{ ...S.tdCenter, background: '#f8fafc', borderLeft: '1px solid #f1f5f9' }}>
                                                {row.pdf_url ? (
                                                    <button
                                                        onClick={() => window.open(`${API_URL.replace('/api', '')}${row.pdf_url}`, '_blank')}
                                                        style={{ background:'#fee2e2', color:'#991b1b', padding:'4px 12px', border:'none', borderRadius:'12px', fontWeight:'bold', fontSize:'0.8rem', cursor:'pointer', whiteSpace:'nowrap' }}
                                                    >
                                                        View PDF
                                                    </button>
                                                ) : (
                                                    <span style={{ color: '#cbd5e1' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* PAUSE/QUIT DETAILS MODAL */}
                {pqModal.show && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal" style={{ maxWidth: '600px', width: '90%' }}>
                            <div className="admin-modal-header">
                                <div className="admin-modal-icon" style={{ background: '#fef3c7', borderColor: '#fcd34d' }}>⏳</div>
                                <div>
                                    <div className="admin-modal-title">Pause & Quit Details</div>
                                    <div className="admin-modal-subtitle">{pqModal.childName}</div>
                                </div>
                            </div>
                            
                            <div style={{ padding: '16px 0', maxHeight: '400px', overflowY: 'auto' }}>
                                {pqModal.quitReason && (
                                    <div style={{ marginBottom: '20px', padding: '12px', background: '#fee2e2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', marginBottom: '4px' }}>Final Quit Reason</div>
                                        <div style={{ fontSize: '0.95rem', color: '#7f1d1d', fontWeight: 600 }}>"{pqModal.quitReason}"</div>
                                    </div>
                                )}

                                {pqModal.pauses.length > 0 ? (
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {pqModal.pauses.map((p, idx) => (
                                            <div key={idx} style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366f1' }}>Event #{idx + 1}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.timestamp ? new Date(p.timestamp).toLocaleString() : '—'}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', marginBottom: '6px' }}>
                                                    <strong>Position:</strong> {p.questionNumber ? `Q${p.questionNumber}` : (p.questionKey || '—')} 
                                                    {p.timerSeconds !== undefined ? ` at ${Math.floor(p.timerSeconds/60)}m ${p.timerSeconds%60}s` : ''}
                                                </div>
                                                <div style={{ fontSize: '0.9rem', color: '#334155', fontStyle: 'italic', background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                                                    "{p.reason || 'No remarks provided'}"
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    !pqModal.quitReason && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No pause/quit remarks found.</div>
                                )}
                            </div>

                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-ghost" onClick={() => setPqModal({ show: false, pauses: [], childName: '' })}>Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* HER PHER MATCH ANALYSIS MODAL */}
                {hpDataModal.show && (
                    <div className="admin-modal-overlay">
                        <div className="admin-modal" style={{ maxWidth: '800px', width: '90%' }}>
                            <div className="admin-modal-header">
                                <div className="admin-modal-icon" style={{ background: '#e0f2fe', borderColor: '#bae6fd' }}>🔍</div>
                                <div>
                                    <div className="admin-modal-title">Match Analysis Data</div>
                                    <div className="admin-modal-subtitle">{hpDataModal.rowData?.child_name} (Session: {hpDataModal.rowData?.session_id})</div>
                                </div>
                            </div>
                            
                            <div style={{ padding: '16px 0', maxHeight: '500px', overflowY: 'auto' }}>
                                {hpDataModal.rowData?.raw_scores && hpDataModal.rowData.raw_scores.length > 0 ? (
                                    <div style={{ display: 'grid', gap: '16px' }}>
                                        {hpDataModal.rowData.raw_scores.map((scoreObj, idx) => {
                                            const qId = scoreObj.qId || scoreObj.id;
                                            if (!qId || qId === 1) return null; // Skip if no ID or sample question
                                            const qNum = (typeof qId === 'number') ? qId - 1 : qId; // qId 2 is Q1
                                            
                                            return (
                                                <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #cbd5e1', paddingBottom: '8px' }}>
                                                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Question {qNum} <span style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 500}}>({scoreObj.category || 'Unknown Category'})</span></span>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: scoreObj.score > 0 ? '#059669' : '#dc2626' }}>Score: {scoreObj.score ?? 0}</span>
                                                    </div>
                                                    
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Expected Images ({scoreObj.expectedImages?.length || 0})</div>
                                                            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9', minHeight: '36px', wordWrap: 'break-word' }}>
                                                                {scoreObj.expectedImages?.join(', ') || '—'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: '#475569', marginBottom: '4px' }}>User Selections ({scoreObj.selectedImages?.length || 0})</div>
                                                            <div style={{ background: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #f1f5f9', minHeight: '36px', wordWrap: 'break-word' }}>
                                                                {scoreObj.selectedImages?.join(', ') || '—'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '0.8rem' }}>
                                                        <div style={{ flex: 1, background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '8px', borderRadius: '6px' }}>
                                                            <strong style={{ color: '#059669', display: 'block', marginBottom: '2px' }}>Matched ({scoreObj.matchedImages?.length || 0})</strong>
                                                            <span style={{ color: '#047857' }}>{scoreObj.matchedImages?.join(', ') || 'None'}</span>
                                                        </div>
                                                        <div style={{ flex: 1, background: '#fef2f2', border: '1px solid #fecaca', padding: '8px', borderRadius: '6px' }}>
                                                            <strong style={{ color: '#dc2626', display: 'block', marginBottom: '2px' }}>Incorrect ({scoreObj.incorrectSelections?.length || 0})</strong>
                                                            <span style={{ color: '#b91c1c' }}>{scoreObj.incorrectSelections?.join(', ') || 'None'}</span>
                                                        </div>
                                                        <div style={{ flex: 1, background: '#fffbeb', border: '1px solid #fde68a', padding: '8px', borderRadius: '6px' }}>
                                                            <strong style={{ color: '#d97706', display: 'block', marginBottom: '2px' }}>Missed ({scoreObj.missedImages?.length || 0})</strong>
                                                            <span style={{ color: '#b45309' }}>{scoreObj.missedImages?.join(', ') || 'None'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 20px' }}>
                                        No detailed match data available for this session. (Complete a new assessment to see matching details).
                                    </div>
                                )}
                            </div>

                            <div className="admin-modal-actions">
                                <button className="admin-btn admin-btn-ghost" onClick={() => setHpDataModal({ show: false, rowData: null })}>Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OVERVIEW VIEW
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <main style={S.page}>
            <div style={S.pageTitle}>📈 Reports</div>
            <div style={S.pageSub}>Click a test card to view detailed attempt data.</div>

            {loadingOv ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading overview…</div>
            ) : (
                <div style={S.grid}>
                    {GAME_CATALOG.map(game => {
                        const s = getStats(game.key);
                        return (
                            <div
                                key={game.key}
                                style={S.card(game.color)}
                                onClick={() => openGame(game)}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                    <span style={{ fontSize: '2rem', lineHeight: 1 }}>{game.icon}</span>
                                    <span style={S.cardTitle}>{game.title}</span>
                                </div>

                                <div style={S.kpiRow}>
                                    <div style={S.kpi(false)}>
                                        <div style={S.kpiVal}>{s.total_children ?? 0}</div>
                                        <div style={S.kpiLbl}>Children</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={S.kpiVal}>{s.total_attempts ?? 0}</div>
                                        <div style={S.kpiLbl}>Attempts</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={{ ...S.kpiVal, color: '#2563eb' }}>{s.in_progress ?? 0}</div>
                                        <div style={S.kpiLbl}>In Progress</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={{ ...S.kpiVal, color: '#059669' }}>{s.completed ?? 0}</div>
                                        <div style={S.kpiLbl}>Completed</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={{ ...S.kpiVal, color: '#ef4444' }}>{s.quit_count ?? 0}</div>
                                        <div style={S.kpiLbl}>Quit</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={{ ...S.kpiVal, color: '#dc2626' }}>{s.dropped_count ?? 0}</div>
                                        <div style={S.kpiLbl}>Dropped</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={{ ...S.kpiVal, color: '#854d0e' }}>{s.paused ?? 0}</div>
                                        <div style={S.kpiLbl}>Paused</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={S.kpiVal}>{s.avg_score ?? '—'}</div>
                                        <div style={S.kpiLbl}>Avg Score</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
};

export default AdminReports;
