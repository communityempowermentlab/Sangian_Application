import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';

// ─── Catalogue of all 9 games ─────────────────────────────────────────────────
const GAME_CATALOG = [
    { key: 'atlantis_bagiya',           icon: '🧠', title: 'Atlantis Game',        local: 'BAGIYA',           tag: 'Visual Memory',    color: '#6366f1' },
    { key: 'number_recall_lottery',     icon: '🎟️', title: 'Number Recall',        local: 'LOTTERY KA TICKET',tag: 'Auditory Span',    color: '#f59e0b' },
    { key: 'rover_mela',                icon: '🗺️', title: 'Rover Game',           local: 'CHALO MELA CHALE', tag: 'Spatial Planning', color: '#10b981' },
    { key: 'triangle_rachna',           icon: '🔺', title: 'Triangle',             local: 'RACHNA',           tag: 'Construction',     color: '#ef4444' },
    { key: 'auditory_dhyan',            icon: '👂', title: 'Auditory Attention',   local: 'DHYAN KAHAN HAI',  tag: 'Listening Focus',  color: '#8b5cf6' },
    { key: 'working_memory_herpher',    icon: '🔄', title: 'Working Memory',       local: 'HER PHER',         tag: 'Dynamic Memory',   color: '#0891b2' },
    { key: 'cognitive_flex_chor',       icon: '⚡', title: 'Cognitive Flex',       local: 'CHOR MACHAYE SHOR',tag: 'Rule Switching',   color: '#dc2626' },
    { key: 'numeracy_number_skill',     icon: '🔢', title: 'Numeracy Test',        local: 'Number Skills',    tag: 'Academic – Maths', color: '#7c3aed' },
    { key: 'literacy_reading_skill',    icon: '📖', title: 'Literacy Test',        local: 'Reading Skills',   tag: 'Academic – Lang',  color: '#059669' },
];

const statusBadge = (status) => {
    const map = {
        completed: { label: 'Completed', bg: '#d1fae5', color: '#065f46' },
        paused:    { label: 'Paused',    bg: '#fef9c3', color: '#854d0e' },
        quit:      { label: 'Quit',      bg: '#fee2e2', color: '#991b1b' },
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

    // ── Fetch overview on mount ────────────────────────────────────────────────
    const fetchOverview = useCallback(async () => {
        setLoadingOv(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await axios.get(`${API_URL}/games/reports/overview`, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
        try {
            const token = localStorage.getItem('adminToken');
            const res = await axios.get(`${API_URL}/games/reports/detail/${game.key}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDetail({ columns: res.data.columns || [], data: res.data.data || [] });
        } catch (e) {
            console.error(e);
            setDetail({ columns: [], data: [] });
        } finally {
            setLoadingDt(false);
        }
    };

    const closeDetail = () => { setActiveGame(null); setDetail(null); };

    // ── Merge overview DB data with catalog ───────────────────────────────────
    const getStats = (key) => overview.find(r => r.game_name === key) || {};

    // ── Sorted detail rows ────────────────────────────────────────────────────
    const sortedRows = detail ? [...detail.data].sort((a, b) => {
        let va = a[sortField], vb = b[sortField];
        if (sortField === 'start_time') { va = new Date(va); vb = new Date(vb); }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    }) : [];

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
                qHeaders.push(`${label} Correct Responses`, `${label} Score`, `${label} Time(s)`);
            });
        } else {
            detail.columns.forEach(c => {
                qHeaders.push(c.toUpperCase());
                qHeaders.push(`${c.toUpperCase()} Time(s)`);
            });
        }

        const headers = ['Session ID', 'Child ID', 'Child Name', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Total Session Time(s)', 'Actual Game Time(s)', 'Status', 'Paused Questions', 'Pause Reasons',
            ...qHeaders, 'Attempted Questions', 'Total Questions',
            ...assessmentLabels];
            
        const rows = sortedRows.map(r => {
            const rowArr = [
                r.session_id, r.child_id, r.child_name,
                fmtOnlyDate(r.start_time), fmtOnlyTime(r.start_time),
                fmtOnlyDate(r.end_time), fmtOnlyTime(r.end_time),
                r.total_session_time ?? '', r.actual_game_time ?? '',
                r.status,
                `"${(r.pauses||[]).map(p=>'Q'+p.questionNumber).join('\n')}"`,
                `"${(r.pauses||[]).map(p=>(p.reason||'').replace(/"/g, '""')).join('\n')}"`
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
                        qs[`q${q}_time`] ?? ''
                    );
                });
            } else if (isHerPher) {
                [2,3,4,5,6,7,8,9].forEach(qId => {
                    const qs = r.question_scores;
                    rowArr.push(
                        qs[`q${qId}_correct`] ?? '',
                        qs[`q${qId}`] ?? '',
                        qs[`q${qId}_time`] ?? ''
                    );
                });
            } else {
                detail.columns.forEach(c => {
                    rowArr.push(r.question_scores[c] ?? '');
                    rowArr.push(r.question_scores[`${c}_time`] ?? '');
                });
            }
            
            rowArr.push(r.attempted_questions ?? '', r.total_questions, ...assessmentKeys.map(k => `"${(r.assessment?.[k] || '').toString().replace(/"/g, '""')}"`));
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
        kpi:       { flex: 1, minWidth: 65, background: '#f8fafc', borderRadius: 10, padding: '8px 12px', textAlign: 'center' },
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
        scoreCell: (v) => ({
            padding: '9px 12px', borderBottom: '1px solid #f1f5f9',
            textAlign: 'center', verticalAlign: 'middle',
            color: v === 1 ? '#059669' : v === 0 ? '#dc2626' : '#94a3b8',
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
                    <div>
                        <div style={S.pageTitle}>{activeGame.title} — Attempt Log</div>
                        <div style={S.pageSub}>One row per attempt · Latest first · {detail?.data.length ?? '…'} records</div>
                    </div>
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
                                    <th style={S.th} onClick={() => toggleSort('start_time')}>Start Date <SortIcon field="start_time"/></th>
                                    <th style={S.th} onClick={() => toggleSort('start_time')}>Start Time</th>
                                    <th style={S.th} onClick={() => toggleSort('end_time')}>End Date <SortIcon field="end_time"/></th>
                                    <th style={S.th} onClick={() => toggleSort('end_time')}>End Time</th>
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
                                                <th style={{ ...S.th, textAlign: 'center', background: '#dbeafe', minWidth: 60 }}>Q{q} Correct</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#d1fae5', minWidth: 60 }}>Q{q} Score</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#fef9c3', minWidth: 60 }}>Q{q} Time(s)</th>
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        detail.columns.map(c => (
                                            <React.Fragment key={c}>
                                                <th style={{ ...S.th, textAlign: 'center', minWidth: 52 }}>{c.toUpperCase()}</th>
                                                <th style={{ ...S.th, textAlign: 'center', minWidth: 52 }}>TIME(S)</th>
                                            </React.Fragment>
                                        ))
                                    )}
                                    
                                    {activeGame?.key !== 'auditory_dhyan' && (
                                        <th style={{ ...S.th, textAlign: 'center' }} onClick={() => toggleSort('score')}>
                                            {activeGame?.key === 'working_memory_herpher' ? 'Total Score' : 'Score'} <SortIcon field="score"/>
                                        </th>
                                    )}
                                    <th style={{ ...S.th, textAlign: 'center' }}>Status</th>
                                    {/* Assessment columns — visually separated */}
                                    {ASSESSMENT_COLS.map(ac => (
                                        <th key={ac.key} style={{ ...S.th, background: '#ede9fe', color: '#6d28d9', minWidth: 120 }}>{ac.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((row, i) => (
                                    <tr key={row.session_id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                        <td style={S.td}>{i + 1}</td>
                                        <td style={{ ...S.td, fontWeight: 600 }}>{row.child_id}</td>
                                        <td style={S.td}>{row.child_name}</td>
                                        <td style={{ ...S.td, textTransform: 'uppercase' }}>{fmtOnlyDate(row.start_time)}</td>
                                        <td style={{ ...S.td, color: '#64748b' }}>{fmtOnlyTime(row.start_time)}</td>
                                        <td style={{ ...S.td, textTransform: 'uppercase' }}>{fmtOnlyDate(row.end_time)}</td>
                                        <td style={{ ...S.td, color: '#64748b' }}>{fmtOnlyTime(row.end_time)}</td>
                                        
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
                                                        <td style={{ ...S.tdCenter, color: '#854d0e' }}>{qs[`q${q}_time`] ?? '—'}</td>
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : activeGame?.key === 'working_memory_herpher' ? (
                                            // Q1–Q8 = internal qIds 2–9 (qId 1 = sample, excluded)
                                            [2,3,4,5,6,7,8,9].map((qId, i) => {
                                                const qs = row.question_scores;
                                                const correct = qs[`q${qId}_correct`];
                                                const score = qs[`q${qId}`];
                                                const time = qs[`q${qId}_time`];
                                                return (
                                                    <React.Fragment key={`hp-${qId}`}>
                                                        <td style={{ ...S.tdCenter, color: '#0369a1', fontWeight: 600 }}>{correct ?? '—'}</td>
                                                        <td style={{ ...S.tdCenter, color: score > 0 ? '#059669' : '#94a3b8', fontWeight: 700 }}>{score ?? '—'}</td>
                                                        <td style={{ ...S.tdCenter, color: '#64748b' }}>{time != null ? `${time}s` : '—'}</td>
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            detail.columns.map(c => {
                                                const v = row.question_scores[c];
                                                return (
                                                    <React.Fragment key={c}>
                                                        <td style={S.scoreCell(v)}>
                                                            {v === 1 ? '✔' : v === 0 ? '✖' : '—'}
                                                        </td>
                                                        <td style={S.tdCenter}>{row.question_scores[`${c}_time`] ? `${row.question_scores[`${c}_time`]}s` : '—'}</td>
                                                    </React.Fragment>
                                                );
                                            })
                                        )}
                                        
                                        {activeGame?.key !== 'auditory_dhyan' && (
                                            <td style={{ ...S.tdCenter, fontWeight: 700 }}>
                                                {activeGame?.key === 'working_memory_herpher'
                                                    ? (row.score ?? '—')
                                                    : `${row.attempted_questions ?? '—'} / ${row.total_questions ?? '—'}`
                                                }
                                            </td>
                                        )}
                                        <td style={S.tdCenter}>{statusBadge(row.status)}</td>
                                        {/* Assessment answer cells */}
                                        {ASSESSMENT_COLS.map(ac => (
                                            <td key={ac.key} style={{ ...S.td, background: '#faf5ff', fontSize: '0.8rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                title={row.assessment?.[ac.key] || ''}>
                                                {row.assessment?.[ac.key] || <span style={{ color: '#d1d5db' }}>—</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                <div style={S.cardIcon}>{game.icon}</div>
                                <div style={S.cardTitle}>{game.title}</div>
                                <div style={S.cardLocal}>({game.local})</div>
                                <div style={S.tag(game.color)}>{game.tag}</div>

                                <div style={S.kpiRow}>
                                    <div style={S.kpi}>
                                        <div style={S.kpiVal}>{s.total_children ?? 0}</div>
                                        <div style={S.kpiLbl}>Children</div>
                                    </div>
                                    <div style={S.kpi}>
                                        <div style={S.kpiVal}>{s.total_attempts ?? 0}</div>
                                        <div style={S.kpiLbl}>Attempts</div>
                                    </div>
                                    <div style={S.kpi}>
                                        <div style={{ ...S.kpiVal, color: '#059669' }}>{s.completed ?? 0}</div>
                                        <div style={S.kpiLbl}>Completed</div>
                                    </div>
                                    <div style={S.kpi}>
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
