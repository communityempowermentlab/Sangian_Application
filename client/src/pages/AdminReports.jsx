import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';
import { generateReportData, GAME_CATALOG, getRoverBudget, getTeachingTotal } from '../utils/reportExportUtils';
import { logReportDownload } from '../utils/logActivity';
import { isOrgSession, isStaffSession } from '../utils/staffPermissions';

// Only a true Super Admin sees data across every company — org/staff
// sessions are already hard-scoped server-side to their own organization
// (see resolveOrgScope.js), so the filter would be a no-op (and they lack
// permission to call /admin/organizations at all).
const isAdminSession = !isOrgSession() && !isStaffSession();

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

const testStatusBadge = (enabled) => (
    <span style={{
        background: enabled ? '#f0fdf4' : '#fef2f2', color: enabled ? '#16a34a' : '#dc2626',
        padding: '2px 10px', borderRadius: '999px',
        fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em',
        whiteSpace: 'nowrap'
    }}>{enabled ? 'Active' : 'Inactive'}</span>
);

// ─── Format Helpers ────────────────────────────────────────────────────────
// Now imported from reportExportUtils when needed, except for UI formatters:

const fmtDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtOnlyDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtOnlyTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() : '—';

const fmtSecs = (v) => {
    if (v == null) return '—';
    const s = Math.round(Number(v));
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
};

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
    const [searchParams, setSearchParams] = useSearchParams();
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

    // Group filter — child groups, e.g. "Main Group" / "Testing Group" (Settings → Groups)
    const [groupOptions, setGroupOptions] = useState([]);
    const groupParam = searchParams.get('group') || '';
    const selectedGroupIds = groupParam ? groupParam.split(',') : [];

    useEffect(() => {
        axiosAdmin.get('/admin/child-groups')
            .then(res => setGroupOptions((res.data || []).filter(g => g.status === 'active')))
            .catch(err => console.error('Failed to fetch child groups:', err));
    }, []);

    // Company/Organization filter — single-select, admin-only (see isAdminSession above)
    const [orgOptions, setOrgOptions] = useState([]);
    const orgParam = searchParams.get('org') || '';

    useEffect(() => {
        if (!isAdminSession) return;
        axiosAdmin.get('/admin/organizations')
            .then(res => setOrgOptions(res.data.organizations || []))
            .catch(err => console.error('Failed to fetch organizations:', err));
    }, []);

    const setOrgFilter = useCallback((orgId) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (orgId) next.set('org', orgId);
            else next.delete('org');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    // Test order + enabled/disabled state — from Settings → Test Configuration → Test Visibility,
    // so the Reports card order and status badges always match that page.
    const [testConfig, setTestConfig] = useState([]);

    useEffect(() => {
        axiosAdmin.get('/admin/test-config')
            .then(({ data }) => setTestConfig(data.tests || []))
            .catch(err => console.error('Failed to fetch test config:', err));
    }, []);

    const orderedCatalog = useMemo(() => {
        if (!testConfig.length) return GAME_CATALOG;
        const pos = new Map(testConfig.map((t, i) => [t.key, i]));
        return [...GAME_CATALOG].sort((a, b) => (pos.get(a.key) ?? 999) - (pos.get(b.key) ?? 999));
    }, [testConfig]);

    const isTestEnabled = useCallback((key) => {
        const t = testConfig.find(t => t.key === key);
        return t ? t.enabled : true;
    }, [testConfig]);

    const toggleGroupFilter = useCallback((groupId) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            const current = (next.get('group') || '').split(',').filter(Boolean);
            const updated = current.includes(groupId) ? current.filter(x => x !== groupId) : [...current, groupId];
            if (updated.length) next.set('group', updated.join(','));
            else next.delete('group');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const clearGroupFilter = useCallback(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('group');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    // Reading Skill Expansion state
    const [expandedRows, setExpandedRows] = useState({}); // { sessionId: boolean }

    // Pause/Quit Details Modal state
    const [pqModal, setPqModal] = useState({ show: false, pauses: [], childName: '' });

    // Her Pher Data Modal state
    const [hpDataModal, setHpDataModal] = useState({ show: false, rowData: null });

    // ── Fetch overview on mount ────────────────────────────────────────────────
    const fetchOverview = useCallback(async (groupIds, orgId) => {
        setLoadingOv(true);
        try {
            const params = {};
            if (groupIds && groupIds.length) params.groupId = groupIds.join(',');
            if (orgId) params.organization_id = orgId;
            const res = await axiosAdmin.get('/games/reports/overview', { params });
            setOverview(res.data.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingOv(false);
        }
    }, []);

    useEffect(() => { fetchOverview(selectedGroupIds, orgParam); }, [fetchOverview, groupParam, orgParam]);

    // ── Apply a game selection (or null) to the local view state ──────────────
    // This is the ONLY place that writes activeGame/detail, and it's driven purely
    // by the effect below reacting to the `?game=` URL param — never called
    // directly from click handlers. That keeps the URL as the single source of
    // truth and avoids a race between local state and router state landing in
    // different render ticks.
    const showGame = useCallback(async (game, groupIds, orgId) => {
        setActiveGame(game);
        setFilterStatus(null);
        if (!game) {
            setDetail(null);
            setExpandedRows({});
            setPqModal({ show: false, pauses: [], childName: '', quitReason: '' });
            setHpDataModal({ show: false, rowData: null });
            return;
        }
        setLoadingDt(true);
        try {
            const params = {};
            if (groupIds && groupIds.length) params.groupId = groupIds.join(',');
            if (orgId) params.organization_id = orgId;
            const res = await axiosAdmin.get(`/games/reports/detail/${game.key}`, { params });
            setDetail({ columns: res.data.columns || [], data: res.data.data || [] });
        } catch (e) {
            console.error(e);
            setDetail({ columns: [], data: [] });
        } finally {
            setLoadingDt(false);
        }
    }, []);

    // ── User-facing actions: just update the URL; the effect below applies it ──
    const openGame = useCallback((game) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('game', game.key);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const closeDetail = useCallback(() => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.delete('game');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    // ── Single source of truth: apply whatever the `?game=` URL param says ─────
    // Fires on mount (restoring a refreshed page), when openGame/closeDetail change
    // the URL, when the user clicks the plain "Reports" nav link (URL changes but
    // this component doesn't unmount, since it's the same route), and on browser
    // back/forward.
    useEffect(() => {
        const gameKey = searchParams.get('game');
        const game = gameKey ? GAME_CATALOG.find(g => g.key === gameKey) : null;
        showGame(game || null, selectedGroupIds, orgParam);
    }, [searchParams, showGame]); // eslint-disable-line

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

    const exportCSV = () => {
        if (!detail) return;
        
        // Pass sorted data to generateReportData so the export respects sorting
        const detailToExport = { ...detail, data: sortedRows };
        const { headers, rows } = generateReportData(activeGame, detailToExport);
        
        const csv = [headers, ...rows].map(r => r.map(cell => {
            // Properly escape CSV cells containing quotes or commas
            let str = String(cell);
            if (str.includes('"') || str.includes('\n') || str.includes(',')) {
                // If it already has quotes around it from utility, we might have double quoting, but for now we'll escape
                if (str.startsWith('"') && str.endsWith('"')) {
                    return str; // Utility already wrapped it
                }
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${activeGame?.key}_report.csv`; a.click();

        logReportDownload({
            module: 'reports', menuName: 'Reports', pageName: activeGame?.title || activeGame?.key,
            reportName: `${activeGame?.title || activeGame?.key} Report`, reportType: activeGame?.key, format: 'CSV',
            filters: { status: filterStatus, groupIds: selectedGroupIds, sortField, sortDir },
        });
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
        // Group filter (pill chips)
        groupFilterWrap:  { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
        groupFilterLabel: { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', marginRight: 3 },
        groupChip: (active) => ({
            height: 28, padding: '0 14px', borderRadius: 20,
            border: active ? '1.5px solid #4f46e5' : '1.5px solid #e2e8f0',
            background: active ? '#4f46e5' : '#fff',
            color: active ? '#fff' : '#475569',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.14s', whiteSpace: 'nowrap',
        }),
        groupFilterSep: { display: 'inline-block', width: 1, height: 20, background: '#e2e8f0', margin: '0 4px' },
    };

    // ── Group filter bar (shared between overview and detail views) ───────────
    const GroupFilterBar = () => {
        if (groupOptions.length === 0) return null;
        return (
            <div style={S.groupFilterWrap}>
                <span style={S.groupFilterLabel}>Group</span>
                <button style={S.groupChip(selectedGroupIds.length === 0)} onClick={clearGroupFilter}>
                    All Children
                </button>
                <span style={S.groupFilterSep} />
                {groupOptions.map(g => (
                    <button
                        key={g.id}
                        style={S.groupChip(selectedGroupIds.includes(String(g.id)))}
                        onClick={() => toggleGroupFilter(String(g.id))}
                    >
                        {g.name}
                    </button>
                ))}
            </div>
        );
    };

    const CompanyFilterBar = () => {
        if (!isAdminSession || orgOptions.length === 0) return null;
        return (
            <div style={S.groupFilterWrap}>
                <span style={S.groupFilterLabel}>Company</span>
                <select
                    value={orgParam}
                    onChange={(e) => setOrgFilter(e.target.value)}
                    style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#334155', background: '#fff' }}
                >
                    <option value="">All Companies</option>
                    {orgOptions.map(o => (
                        <option key={o.id} value={o.id}>{o.org_name}</option>
                    ))}
                </select>
            </div>
        );
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

        // Padh ke Batao V2's real shape (see gameController.js's reading_stages) —
        // an adaptive path through up to 6 named stages, not a fixed question
        // count, so these are fixed columns (not derived from detail.columns)
        // matching HerPher/Auditory's own hardcoded-column convention. A stage
        // the child's path skipped just renders "—".
        const READING_V2_STAGE_COLS = [
            { key: 'paragraph',       label: 'Paragraph',        type: 'pass_fail' },
            { key: 'words',           label: 'Words',            type: 'score' },
            { key: 'letters',         label: 'Letters',          type: 'score' },
            { key: 'words_retry',     label: 'Words Retry',      type: 'score' },
            { key: 'paragraph_retry', label: 'Paragraph Retry',  type: 'pass_fail' },
            { key: 'story',           label: 'Story',            type: 'pass_fail' },
        ];

        // Labels match analysisController.js's CUSTOM_SCORE_BUCKETS.literacy_reading_skill_v2
        // exactly (Beginner/Letters/Words/Paragraph/Story) — the ASER reading-level
        // scheme this game's score (0-4) already represents everywhere else in the
        // app. row.reading_level itself is singular ('Letter'/'Word', from
        // ReadingSkillGameV2.jsx's LEVELS object) — mapped to the plural label here.
        const READING_V2_LEVEL_META = {
            Beginner:  { label: 'Beginner',  color: '#dc2626', bg: '#fee2e2' },
            Letter:    { label: 'Letters',   color: '#d97706', bg: '#fef3c7' },
            Word:      { label: 'Words',     color: '#ca8a04', bg: '#fef9c3' },
            Paragraph: { label: 'Paragraph', color: '#2563eb', bg: '#dbeafe' },
            Story:     { label: 'Story',     color: '#059669', bg: '#dcfce7' },
        };

        // Compact "how they got there" trail, e.g. "Paragraph ✗ → Words 3/5 →
        // Letters 5/5" — shows the actual adaptive path, not just the outcome.
        const readingV2PathSummary = (row) => {
            const path = row.reading_path || [];
            if (!path.length) return null;
            return path.map(stageKey => {
                const label = READING_V2_STAGE_COLS.find(c => c.key === stageKey)?.label || stageKey;
                const st = row.reading_stages?.[stageKey];
                if (!st) return label;
                return 'pass' in st ? `${label} ${st.pass ? '✓' : '✗'}` : `${label} ${st.correct}/${st.total}`;
            }).join(' → ');
        };

        const renderReadingV2Summary = (row) => {
            const meta = READING_V2_LEVEL_META[row.reading_level];
            const path = readingV2PathSummary(row);
            return (
                <div>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontWeight: 700, fontSize: '0.78rem', color: meta ? meta.color : '#64748b', background: meta ? meta.bg : '#f1f5f9' }}>
                        {meta ? meta.label : 'Incomplete'}
                    </span>
                    {path && <div style={{ marginTop: '4px', color: '#64748b', fontWeight: 500, fontSize: '0.68rem', whiteSpace: 'normal', maxWidth: 220 }}>{path}</div>}
                </div>
            );
        };

        // Ankganit V3's real shape (see gameController.js's numeracy_stages) — an
        // adaptive tree: Subtraction always first, then either Division (both
        // subtraction answers correct) or Number Recognition (10-99), and Number
        // Recognition (1-9) only if 10-99 also failed. Fixed columns, same
        // "—" convention as READING_V2_STAGE_COLS for stages the path skipped.
        const NUMERACY_V3_STAGE_COLS = [
            { key: 'subtraction',   label: 'Subtraction',              type: 'score' },
            { key: 'division',      label: 'Division',                 type: 'pass_fail' },
            { key: 'recognition99', label: 'Number Recognition (10-99)', type: 'score' },
            { key: 'recognition9',  label: 'Number Recognition (1-9)',   type: 'score' },
        ];

        // Labels/keys match analysisController.js's
        // CUSTOM_SCORE_BUCKETS.numeracy_number_skill_v3 exactly, including the
        // en-dashes in row.numeracy_level ('Number Recognition (1–9)' /
        // '(10–99)') — these are the literal finalLevel strings NumberSkillGameV3.jsx writes.
        const NUMERACY_V3_LEVEL_META = {
            Beginner:                        { label: 'Beginner',                   color: '#dc2626', bg: '#fee2e2' },
            'Number Recognition (1–9)':      { label: 'Number Recognition (1-9)',   color: '#d97706', bg: '#fef3c7' },
            'Number Recognition (10–99)':    { label: 'Number Recognition (10-99)', color: '#ca8a04', bg: '#fef9c3' },
            Subtraction:                     { label: 'Subtraction',                color: '#2563eb', bg: '#dbeafe' },
            Division:                        { label: 'Division',                   color: '#059669', bg: '#dcfce7' },
        };

        const numeracyV3PathSummary = (row) => {
            const path = row.numeracy_path || [];
            if (!path.length) return null;
            return path.map(stageKey => {
                const label = NUMERACY_V3_STAGE_COLS.find(c => c.key === stageKey)?.label || stageKey;
                const st = row.numeracy_stages?.[stageKey];
                if (!st) return label;
                return 'pass' in st ? `${label} ${st.pass ? '✓' : '✗'}` : `${label} ${st.correct}/${st.total}`;
            }).join(' → ');
        };

        const renderNumeracyV3Summary = (row) => {
            const meta = NUMERACY_V3_LEVEL_META[row.numeracy_level];
            const path = numeracyV3PathSummary(row);
            return (
                <div>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontWeight: 700, fontSize: '0.78rem', color: meta ? meta.color : '#64748b', background: meta ? meta.bg : '#f1f5f9' }}>
                        {meta ? meta.label : 'Incomplete'}
                    </span>
                    {path && <div style={{ marginTop: '4px', color: '#64748b', fontWeight: 500, fontSize: '0.68rem', whiteSpace: 'normal', maxWidth: 220 }}>{path}</div>}
                </div>
            );
        };

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
                    {testStatusBadge(isTestEnabled(activeGame.key))}
                </div>

                <GroupFilterBar />
                <CompanyFilterBar />

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
                                <div
                                    style={{ ...S.kpi(filterStatus === 'dropped'), ...(['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame.key) ? { cursor: 'not-allowed', opacity: 0.5 } : {}) }}
                                    onClick={() => !['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame.key) && setFilterStatus(filterStatus === 'dropped' ? null : 'dropped')}
                                    title={['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame.key) ? 'No dropout rule for Her Pher' : undefined}
                                >
                                    <div style={{ fontSize: '0.65rem', color: ['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame.key) ? '#94a3b8' : '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>Dropped</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: ['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame.key) ? '#94a3b8' : '#dc2626' }}>
                                        {['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame.key) ? '—' : (s.dropped_count ?? 0)}
                                    </div>
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
                                    <th style={{ ...S.th, position: 'sticky', left: 0, zIndex: 2, background: '#f1f5f9', minWidth: 40, width: 40, maxWidth: 40, borderRight: '1px solid #cbd5e1' }}>#</th>
                                    <th style={{ ...S.th, position: 'sticky', left: 40, zIndex: 2, background: '#f1f5f9', minWidth: 100, borderRight: '1px solid #cbd5e1' }} onClick={() => toggleSort('child_id')}>Child ID <SortIcon field="child_id"/></th>
                                    <th style={S.th} onClick={() => toggleSort('child_name')}>Name <SortIcon field="child_name"/></th>
                                    <th style={S.th} onClick={() => toggleSort('organization_name')}>Organization <SortIcon field="organization_name"/></th>
                                    <th style={S.th} onClick={() => toggleSort('assessor_name')}>Assessor <SortIcon field="assessor_name"/></th>
                                    <th style={{ ...S.th, textAlign: 'center' }}>Att. #</th>
                                    <th style={{ ...S.th, textAlign: 'center' }} onClick={() => toggleSort('session_id')}>Session ID <SortIcon field="session_id"/></th>
                                    <th style={S.th} onClick={() => toggleSort('start_time')}>Start Date <SortIcon field="start_time"/></th>
                                    <th style={S.th} onClick={() => toggleSort('start_time')}>Start Time</th>
                                    <th style={S.th} onClick={() => toggleSort('end_time')}>End Date <SortIcon field="end_time"/></th>
                                    <th style={S.th} onClick={() => toggleSort('end_time')}>End Time</th>
                                    <th style={{ ...S.th, textAlign: 'center', background: '#f0fdf4', color: '#065f46' }}>Duration</th>
                                    <th style={{ ...S.th, textAlign: 'center', background: '#eff6ff', color: '#1e40af' }}>Screentime</th>
                                    <th style={{ ...S.th, textAlign: 'center', background: '#f0fdf4', color: '#065f46' }} onClick={() => toggleSort('score')}>Score <SortIcon field="score"/></th>
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
                                    ) : ['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame?.key) ? (
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
                                            <th style={{ ...S.th, textAlign: 'center', background: '#fef3c7' }}>Coins</th>
                                            {detail?.columns?.map(c => {
                                                const isTQTrial = /^tq\d+_t[12]$/.test(c);
                                                const tqLabel = isTQTrial
                                                    ? c.replace(/^(tq\d+)_t([12])$/, (_, q, t) => `${q.toUpperCase()} Trial ${t}`)
                                                    : null;
                                                const scoreBg = isTQTrial ? (c.endsWith('_t1') ? '#dbeafe' : '#e0e7ff') : '#d1fae5';
                                                return (
                                                    <React.Fragment key={c}>
                                                        <th style={{ ...S.th, textAlign: 'center', background: scoreBg, minWidth: 70 }}>{isTQTrial ? tqLabel : `${c.toUpperCase()} Score`}</th>
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#fef9c3', minWidth: 60 }}>Moves</th>
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe', minWidth: 60 }}>Time(s)</th>
                                                        <th style={{ ...S.th, textAlign: 'center', background: '#fef3c7', minWidth: 60 }}>Coins</th>
                                                        {!isTQTrial && <th style={{ ...S.th, textAlign: 'center', background: '#ede9fe', minWidth: 60 }}>Replays</th>}
                                                    </React.Fragment>
                                                );
                                            })}
                                            <th style={{ ...S.th, textAlign: 'center', background: '#fce7f3', color: '#9d174d', minWidth: 90 }}>Total Teaching Score</th>
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
                                    ) : activeGame?.key === 'literacy_reading_skill_v2' ? (
                                        READING_V2_STAGE_COLS.map(sc => (
                                            <React.Fragment key={sc.key}>
                                                <th style={{ ...S.th, textAlign: 'center', background: sc.type === 'pass_fail' ? '#ede9fe' : '#d1fae5', minWidth: 80 }}>{sc.label}</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe', minWidth: 60 }}>{sc.label} Time(s)</th>
                                            </React.Fragment>
                                        ))
                                    ) : activeGame?.key === 'literacy_reading_skill' ? (
                                        <>
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
                                    ) : activeGame?.key === 'numeracy_number_skill_v3' ? (
                                        NUMERACY_V3_STAGE_COLS.map(sc => (
                                            <React.Fragment key={sc.key}>
                                                <th style={{ ...S.th, textAlign: 'center', background: sc.type === 'pass_fail' ? '#ede9fe' : '#d1fae5', minWidth: 80 }}>{sc.label}</th>
                                                <th style={{ ...S.th, textAlign: 'center', background: '#e0f2fe', minWidth: 60 }}>{sc.label} Time(s)</th>
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        detail.columns.map((c, idx) => {
                                            const isAtlantis = activeGame?.key === 'atlantis_bagiya';
                                            const colLabel = c.toUpperCase();
                                            const bg = idx % 2 === 0 ? '#e0f2fe' : '#f0fdf4';
                                            return (
                                                <React.Fragment key={c}>
                                                    <th style={{ ...S.th, textAlign: 'center', background: bg, minWidth: 52 }}>{colLabel}</th>
                                                    <th style={{ ...S.th, textAlign: 'center', background: bg, minWidth: 52 }}>TIME(S)</th>
                                                    {isAtlantis ? (
                                                        <>
                                                            <th style={{ ...S.th, textAlign: 'center', background: bg, minWidth: 52 }}>ITEM REPLAYS</th>
                                                            <th style={{ ...S.th, textAlign: 'center', background: bg, minWidth: 52 }}>RESP REPLAYS</th>
                                                        </>
                                                    ) : (activeGame?.key !== 'numeracy_number_skill' && activeGame?.key !== 'numeracy_number_skill_v2' && activeGame?.key !== 'numeracy_number_skill_v3') ? (
                                                        <th style={{ ...S.th, textAlign: 'center', background: bg, minWidth: 52 }}>REPLAYS</th>
                                                    ) : null}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                    
                                    <th style={{ ...S.th, textAlign: 'center' }} onClick={() => toggleSort('score')}>
                                        {['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3', 'auditory_dhyan'].includes(activeGame?.key) ? 'Total Score' : 'Score Summary'} <SortIcon field="score"/>
                                    </th>
                                    {['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame?.key) && (
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
                                    const isHerPher = activeGame?.key === 'working_memory_herpher' || activeGame?.key === 'working_memory_herpher_v2' || activeGame?.key === 'working_memory_herpher_v3';
                                    
                                    return (
                                        <React.Fragment key={row.session_id}>
                                            <tr style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                            <td style={{ ...S.td, position: 'sticky', left: 0, zIndex: 1, background: i % 2 === 0 ? '#fff' : '#f8fafc', minWidth: 40, width: 40, maxWidth: 40, borderRight: '1px solid #e2e8f0' }}>{i + 1}</td>
                                            <td style={{ ...S.td, fontWeight: 600, position: 'sticky', left: 40, zIndex: 1, background: i % 2 === 0 ? '#fff' : '#f8fafc', minWidth: 100, borderRight: '1px solid #e2e8f0' }}>{row.child_id}</td>
                                            <td style={S.td}>{row.child_name}</td>
                                            <td style={S.td}>{row.organization_name || '—'}</td>
                                            <td style={S.td}>{row.assessor_name || '—'}</td>
                                            <td style={{ ...S.td, textAlign: 'center' }}>
                                                <span style={{ 
                                                    background: '#f1f5f9', color: '#475569', 
                                                    padding: '2px 8px', borderRadius: '6px', 
                                                    fontSize: '0.7rem', fontWeight: 700 
                                                }}>
                                                    #{row.child_attempt_no || '1'}
                                                </span>
                                            </td>
                                            <td style={{ ...S.td, textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>{row.session_id}</td>
                                            <td style={{ ...S.td, textTransform: 'uppercase' }}>{fmtOnlyDate(row.start_time)}</td>
                                            <td style={{ ...S.td, color: '#64748b' }}>{fmtOnlyTime(row.start_time)}</td>
                                            <td style={{ ...S.td, textTransform: 'uppercase' }}>{fmtOnlyDate(row.end_time)}</td>
                                            <td style={{ ...S.td, color: '#64748b' }}>{fmtOnlyTime(row.end_time)}</td>
                                            <td style={{ ...S.tdCenter, color: '#065f46', fontWeight: 600 }}>
                                                {row.actual_game_time != null ? fmtSecs(row.actual_game_time) : '—'}
                                            </td>
                                            <td style={{ ...S.tdCenter, color: '#1e40af', fontWeight: 600 }}>
                                                {row.screentime != null ? fmtSecs(row.screentime) : '—'}
                                            </td>
                                            <td style={{ ...S.tdCenter, fontWeight: 700, color: '#065f46' }}>
                                                {row.score != null ? row.score : '—'}
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
                                            ) : ['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(activeGame?.key) ? (
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
                                                    {(() => {
                                                        const cols = (detail?.columns || []).filter(c => !/^tq\d+_t[12]$/.test(c));
                                                        const qs = row.question_scores || {};
                                                        const totalCoins = cols.reduce((s, c) => {
                                                            const sc = qs[c]; const mv = qs[`${c}_moves`] ?? 0;
                                                            return s + (sc > 0 ? Math.max(0, getRoverBudget(c) - mv) : 0);
                                                        }, 0);
                                                        return (
                                                            <td style={{ ...S.tdCenter, fontWeight: 700, color: '#92400e', background: '#fffbeb' }}>
                                                                {totalCoins}
                                                            </td>
                                                        );
                                                    })()}
                                                    {(detail?.columns || []).map(c => {
                                                        const isTQTrial = /^tq\d+_t[12]$/.test(c);
                                                        const qs = row.question_scores || {};
                                                        const score = qs[c];
                                                        const moves = qs[`${c}_moves`] ?? 0;
                                                        const budget = getRoverBudget(c);
                                                        const kept = isTQTrial
                                                            ? (qs[`${c}_coins_kept`] ?? 0)
                                                            : (score > 0 ? Math.max(0, budget - moves) : 0);
                                                        return (
                                                            <React.Fragment key={`rm-${c}`}>
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: score > 0 ? '#059669' : score === 0 ? '#dc2626' : '#94a3b8' }}>
                                                                    {score ?? '—'}
                                                                </td>
                                                                <td style={{ ...S.tdCenter, color: '#1e293b' }}>{moves || '—'}</td>
                                                                <td style={{ ...S.tdCenter, color: '#64748b' }}>{fmtSecs(qs[`${c}_time`])}</td>
                                                                <td style={{ ...S.tdCenter, color: kept > 0 ? '#b45309' : '#94a3b8', fontWeight: kept > 0 ? 700 : 400 }}>
                                                                    {score != null ? kept : 0}
                                                                </td>
                                                                {!isTQTrial && <td style={{ ...S.tdCenter, color: '#6d28d9', fontWeight: 600 }}>{qs[`${c}_replays`] ?? '—'}</td>}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    <td style={{ ...S.tdCenter, fontWeight: 700, color: '#9d174d', background: '#fdf2f8' }}>
                                                        {getTeachingTotal(row.question_scores)}
                                                    </td>
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
                                                            <td style={{ ...S.tdCenter, fontWeight: 700, color: v > 0 ? '#059669' : v === 0 ? '#dc2626' : '#94a3b8' }}>{v != null ? `${v}` : '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q1`] === 'YES' ? '#059669' : qs[`${c}_ass_q1`] === 'NO' ? '#dc2626' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{qs[`${c}_ass_q1`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q2`] === 'YES' ? '#059669' : qs[`${c}_ass_q2`] === 'NO' ? '#dc2626' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{qs[`${c}_ass_q2`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: qs[`${c}_ass_q3`] === 'YES' ? '#059669' : qs[`${c}_ass_q3`] === 'NO' ? '#dc2626' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>{qs[`${c}_ass_q3`] ?? '—'}</td>
                                                            <td style={{ ...S.tdCenter, color: '#64748b' }}>{fmtSecs(qs[`${c}_time`])}</td>
                                                        </React.Fragment>
                                                    );
                                                })
                                            ) : activeGame?.key === 'literacy_reading_skill_v2' ? (
                                                READING_V2_STAGE_COLS.map(sc => {
                                                    const st = row.reading_stages?.[sc.key];
                                                    return (
                                                        <React.Fragment key={sc.key}>
                                                            {sc.type === 'pass_fail' ? (
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: st == null ? '#94a3b8' : st.pass ? '#059669' : '#dc2626' }}>
                                                                    {st == null ? '—' : st.pass ? 'Pass' : 'Fail'}
                                                                </td>
                                                            ) : (
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: st == null ? '#94a3b8' : st.correct >= 4 ? '#059669' : '#dc2626' }}>
                                                                    {st == null ? '—' : `${st.correct} / ${st.total}`}
                                                                </td>
                                                            )}
                                                            <td style={{ ...S.tdCenter, color: '#64748b' }}>{st ? fmtSecs(st.time) : '—'}</td>
                                                        </React.Fragment>
                                                    );
                                                })
                                            ) : activeGame?.key === 'literacy_reading_skill' ? (
                                                <>
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
                                            ) : activeGame?.key === 'numeracy_number_skill_v3' ? (
                                                NUMERACY_V3_STAGE_COLS.map(sc => {
                                                    const st = row.numeracy_stages?.[sc.key];
                                                    return (
                                                        <React.Fragment key={sc.key}>
                                                            {sc.type === 'pass_fail' ? (
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: st == null ? '#94a3b8' : st.pass ? '#059669' : '#dc2626' }}>
                                                                    {st == null ? '—' : st.pass ? 'Pass' : 'Fail'}
                                                                </td>
                                                            ) : (
                                                                <td style={{ ...S.tdCenter, fontWeight: 700, color: st == null ? '#94a3b8' : st.correct >= (st.total - 1) ? '#059669' : '#dc2626' }}>
                                                                    {st == null ? '—' : `${st.correct} / ${st.total}`}
                                                                </td>
                                                            )}
                                                            <td style={{ ...S.tdCenter, color: '#64748b' }}>{st ? fmtSecs(st.time) : '—'}</td>
                                                        </React.Fragment>
                                                    );
                                                })
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
                                                            {isAtlantis ? (
                                                                <>
                                                                    <td style={{ ...S.tdCenter, color: '#6d28d9' }}>{row.question_scores[`${c}_item_replays`] ?? '—'}</td>
                                                                    <td style={{ ...S.tdCenter, color: '#6d28d9' }}>{row.question_scores[`${c}_replays`] ?? '—'}</td>
                                                                </>
                                                            ) : (activeGame?.key !== 'numeracy_number_skill' && activeGame?.key !== 'numeracy_number_skill_v2' && activeGame?.key !== 'numeracy_number_skill_v3') ? (
                                                                <td style={{ ...S.tdCenter, color: '#6d28d9' }}>{row.question_scores[`${c}_replays`] ?? '—'}</td>
                                                            ) : null}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                            
                                            <td style={{ ...S.tdCenter, fontWeight: 700, fontSize: '0.8rem', lineHeight: '1.4', whiteSpace: 'nowrap' }}>
                                                {['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3', 'auditory_dhyan'].includes(activeGame?.key)
                                                    ? (row.score ?? '—')
                                                    : activeGame?.key === 'literacy_reading_skill_v2'
                                                        ? renderReadingV2Summary(row)
                                                        : activeGame?.key === 'numeracy_number_skill_v3'
                                                            ? renderNumeracyV3Summary(row)
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

            <GroupFilterBar />
            <CompanyFilterBar />

            {loadingOv ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading overview…</div>
            ) : (
                <div style={S.grid}>
                    {orderedCatalog.map(game => {
                        const s = getStats(game.key);
                        return (
                            <div
                                key={game.key}
                                style={S.card(game.color)}
                                onClick={() => openGame(game)}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                        <span style={{ fontSize: '2rem', lineHeight: 1 }}>{game.icon}</span>
                                        <span style={S.cardTitle}>{game.title}</span>
                                    </div>
                                    {testStatusBadge(isTestEnabled(game.key))}
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
                                    <div
                                        style={S.kpi(false)}
                                        title={['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(game.key) ? 'No dropout rule for Her Pher' : undefined}
                                    >
                                        <div style={{ ...S.kpiVal, color: ['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(game.key) ? '#cbd5e1' : '#dc2626' }}>
                                            {['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(game.key) ? '—' : (s.dropped_count ?? 0)}
                                        </div>
                                        <div style={{ ...S.kpiLbl, color: ['working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3'].includes(game.key) ? '#cbd5e1' : undefined }}>Dropped</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={{ ...S.kpiVal, color: '#854d0e' }}>{s.paused ?? 0}</div>
                                        <div style={S.kpiLbl}>Paused</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={S.kpiVal}>{s.avg_score ?? '—'}</div>
                                        <div style={S.kpiLbl}>Avg Score</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={{ ...S.kpiVal, color: '#065f46' }}>{s.avg_game_time != null ? fmtSecs(s.avg_game_time) : '—'}</div>
                                        <div style={S.kpiLbl}>Avg Game Time</div>
                                    </div>
                                    <div style={S.kpi(false)}>
                                        <div style={{ ...S.kpiVal, color: '#1e40af' }}>{s.avg_screen_time != null ? fmtSecs(s.avg_screen_time) : '—'}</div>
                                        <div style={S.kpiLbl}>Avg Screen Time</div>
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
