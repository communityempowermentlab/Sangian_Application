import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { GAME_CATALOG } from '../utils/reportExportUtils';
import './AdminAnalysis.css';

// ── Constants ─────────────────────────────────────────────

// Per-game max scores (V2 games are config-driven: Lottery V2 = 23 questions, Ankganit V2 = 30)
const GAME_MAX_SCORES = {
  atlantis_bagiya: 108, number_recall_lottery: 22, number_recall_lottery_v2: 23,
  rover_mela: 44, auditory_dhyan: 33, working_memory_herpher: 25, working_memory_herpher_v2: 25,
  numeracy_number_skill: 26, numeracy_number_skill_v2: 30, literacy_reading_skill: 22,
  cognitive_flex_chor: 87, triangle_rachna: 48,
};

// Game key → per-game average-score field / sort key returned by /analysis/top-children
const CHILD_SCORE_COLS = {
  atlantis_bagiya:           { field: 'score_bagiya',      sortId: 'bagiya' },
  number_recall_lottery:     { field: 'score_lottery',     sortId: 'lottery' },
  number_recall_lottery_v2:  { field: 'score_lottery_v2',  sortId: 'lottery_v2' },
  rover_mela:                { field: 'score_mela',        sortId: 'mela' },
  auditory_dhyan:            { field: 'score_dhyan',       sortId: 'dhyan' },
  working_memory_herpher:    { field: 'score_herpher',     sortId: 'herpher' },
  working_memory_herpher_v2: { field: 'score_herpher_v2',  sortId: 'herpher_v2' },
  numeracy_number_skill:     { field: 'score_ankganit',    sortId: 'ankganit' },
  numeracy_number_skill_v2:  { field: 'score_ankganit_v2', sortId: 'ankganit_v2' },
  literacy_reading_skill:    { field: 'score_reading',     sortId: 'reading' },
  cognitive_flex_chor:       { field: 'score_chor',        sortId: 'chor' },
  triangle_rachna:           { field: 'score_rachna',      sortId: 'rachna' },
};

const STATUS_COLORS = {
  completed: '#22c55e', in_progress: '#4f46e5',
  quit: '#f59e0b', dropped: '#ef4444', paused: '#8b5cf6',
};

const GENDER_COLORS  = { male: '#3b82f6', female: '#ec4899', other: '#8b5cf6', prefer_not_to_say: '#94a3b8', unknown: '#cbd5e1' };
const GENDER_LABELS  = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say', unknown: 'Unknown' };

const STATUS_CHIP_OPTIONS = [
  { key: 'completed',   label: 'Completed',   color: '#22c55e' },
  { key: 'in_progress', label: 'In Progress', color: '#4f46e5' },
  { key: 'quit',        label: 'Quit',        color: '#f59e0b' },
  { key: 'dropped',     label: 'Dropped',     color: '#ef4444' },
  { key: 'paused',      label: 'Paused',      color: '#8b5cf6' },
];


const ASSESS_LABELS = {
  q1: { title: 'Enjoyment',  opts: { emoji_5: '😄 Very Fun', emoji_4: '🙂 Fun', emoji_3: '😐 Okay', emoji_2: '😕 Boring', emoji_1: '😞 Not Fun' } },
  q2: { title: 'Feeling',    opts: { excited: 'Excited', happy: 'Happy', okay: 'Okay', sad: 'Sad', scared: 'Scared' } },
  q3: { title: 'Tiredness',  opts: { not_tired: 'Not Tired', little_tired: 'A Little', very_tired: 'Very Tired' } },
  q4: { title: 'Play Again', opts: { yes: 'Yes', maybe: 'Maybe', no: 'No' } },
};

const ASSESS_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#0891b2', '#ec4899'];

const EMPTY_FILTERS = { startDate: '', endDate: '', genders: [], statuses: [], childId: '', gameKeys: [], groupIds: [], ageGroups: [] };

const AGE_CHIP_OPTIONS = [
  { key: '7-9',   label: '7-9 yrs',   color: '#f59e0b' },
  { key: '10-12', label: '10-12 yrs', color: '#f59e0b' },
  { key: '13-16', label: '13-16 yrs', color: '#f59e0b' },
];

// ── Helpers ───────────────────────────────────────────────

const todayStr = () => new Date().toISOString().slice(0, 10);

function fmt(n, dec = 0) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num.toLocaleString('en-IN', { maximumFractionDigits: dec });
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return d; }
}

function formatDateOnly(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return d; }
}

function timeAgo(d) {
  if (!d) return '—';
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60)          return 'just now';
  if (secs < 3600)        return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400)       return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 30 * 86400)  return `${Math.floor(secs / 86400)}d ago`;
  if (secs < 365 * 86400) return `${Math.floor(secs / (30 * 86400))}mo ago`;
  return `${Math.floor(secs / (365 * 86400))}y ago`;
}

const scoreBandColor = (pct) => pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';

function exportSessionsCSV(sessions, gameMeta, maxGameScore) {
  const headers = ['#', 'Child ID', 'Name', 'Gender', 'Age', 'Attempt No', 'Status', 'Quit Reason',
                   'Score', 'Max Score', 'Score %', 'Prev Attempt Score', 'Score Change',
                   'Progress (items reached)', 'Total Items', 'Duration (sec)', 'Start Time', 'End Time'];
  const rows = sessions.map((s, i) => [
    i + 1,
    s.child_id || '',
    `"${s.childName || ''}"`,
    s.gender || '',
    s.age ?? '',
    s.attemptNo ?? '',
    s.status || '',
    `"${s.quit_reason || ''}"`,
    s.score ?? '',
    maxGameScore ?? '',
    maxGameScore && s.score != null ? Math.round((s.score / maxGameScore) * 100) : '',
    s.prevScore ?? '',
    s.prevScore != null && s.score != null ? s.score - s.prevScore : '',
    s.progress_level ?? '',
    s.total_questions ?? '',
    s.durationSec ?? '',
    s.start_time || '',
    s.end_time || '',
  ]);
  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(gameMeta.title || 'game').replace(/[^a-zA-Z0-9]/g, '_')}_sessions_export.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDuration(secs) {
  if (!secs || secs <= 0) return '—';
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatHoursMins(totalMins) {
  if (!totalMins || totalMins <= 0) return '—';
  const mins = Math.round(Number(totalMins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function buildApiParams(f) {
  const p = {};
  if (f.startDate)        p.startDate = f.startDate;
  if (f.endDate)          p.endDate   = f.endDate;
  if (f.genders?.length)  p.gender    = f.genders.join(',');
  if (f.statuses?.length) p.status    = f.statuses.join(',');
  if (f.childId?.trim())  p.childId   = f.childId.trim();
  if (f.gameKeys?.length)  p.gameKey  = f.gameKeys.join(',');
  if (f.groupIds?.length)  p.groupId  = f.groupIds.join(',');
  if (f.ageGroups?.length) p.ageGroup = f.ageGroups.join(',');
  return p;
}

function filtersEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Primitive chart / UI components ──────────────────────

function ChipGroup({ label, options, selected, onToggle }) {
  return (
    <div className="ana-chip-group">
      <span className="ana-chip-label">{label}</span>
      {options.map(opt => (
        <button key={opt.key}
          className={`ana-chip${selected.includes(opt.key) ? ' active' : ''}`}
          style={selected.includes(opt.key) ? { '--chip-color': opt.color } : {}}
          onClick={() => onToggle(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TrendLine({ data = [], valueKey = 'sessions', color = '#4f46e5', secondKey, secondColor,
                     primaryLabel = 'Sessions', secondaryLabel = 'Completed', dateKey = 'date' }) {
  const [hover, setHover] = React.useState(null);   // { idx, x, y } — x/y are viewport coords
  if (!data.length) return <div className="ana-chart-empty">No trend data available</div>;
  const hoverIdx = hover?.idx ?? null;
  const W = 400, H = 80, P = 8;
  const vals1 = data.map(d => Number(d[valueKey]) || 0);
  const vals2 = secondKey ? data.map(d => Number(d[secondKey]) || 0) : [];
  const max   = Math.max(...vals1, ...(secondKey ? vals2 : []), 1);
  const xs    = data.map((_, i) => P + (i / Math.max(data.length - 1, 1)) * (W - 2 * P));
  const ys1   = vals1.map(v => H - P - ((v / max) * (H - 2 * P)));
  const pts1  = xs.map((x, i) => `${x.toFixed(1)},${ys1[i].toFixed(1)}`).join(' ');
  const ys2   = vals2.map(v => H - P - ((v / max) * (H - 2 * P)));
  const pts2  = secondKey ? xs.map((x, i) => `${x.toFixed(1)},${ys2[i].toFixed(1)}`).join(' ') : '';
  const uid   = valueKey.replace(/[^a-z]/gi, '');

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fracX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((fracX - P) / Math.max(W - 2 * P, 1)) * (data.length - 1));
    setHover({ idx: Math.max(0, Math.min(data.length - 1, idx)), x: e.clientX, y: e.clientY });
  };

  const hovered = hoverIdx != null ? data[hoverIdx] : null;
  const flipX = hover ? hover.x > window.innerWidth - 240 : false;
  const flipY = hover ? hover.y < 140 : false;

  return (
    <div style={{ position: 'relative' }} onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="ana-trend-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`tg-${uid}-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`${P},${H} ${pts1} ${W - P},${H}`} fill={`url(#tg-${uid}-${color.replace('#','')})`} />
        <polyline points={pts1} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {secondKey && pts2 && (
          <polyline points={pts2} fill="none" stroke={secondColor || '#22c55e'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 2" />
        )}
        {hoverIdx != null && (
          <line x1={xs[hoverIdx]} y1="0" x2={xs[hoverIdx]} y2={H} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
        )}
        {data.map((_, i) => <circle key={i} cx={xs[i]} cy={ys1[i]} r={i === hoverIdx ? 4 : 2.5} fill={color} />)}
        {hoverIdx != null && secondKey && <circle cx={xs[hoverIdx]} cy={ys2[hoverIdx]} r="3.5" fill={secondColor || '#22c55e'} />}
      </svg>
      {/* Rendered via portal to <body>: transformed ancestors break position:fixed
          coordinates for in-tree elements, which pushed the tooltip off-target */}
      {hovered && createPortal(
        <div style={{
          position: 'fixed',
          left: hover.x + (flipX ? -14 : 14),
          top: hover.y + (flipY ? 14 : -12),
          transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '0' : '-100%'})`,
          background: '#1e293b', color: '#fff', borderRadius: '8px', padding: '8px 12px',
          fontSize: '12px', lineHeight: '1.6', whiteSpace: 'nowrap', pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 10000,
        }}>
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>{formatDateOnly(hovered[dateKey])}</div>
          <div><span style={{ color }}>●</span> {primaryLabel}: <strong>{fmt(hovered[valueKey])}</strong></div>
          {secondKey && <div><span style={{ color: secondColor || '#22c55e' }}>●</span> {secondaryLabel}: <strong>{fmt(hovered[secondKey])}</strong></div>}
          {hovered.avgScore != null && <div><span style={{ color: '#a78bfa' }}>●</span> Avg Score: <strong>{fmt(hovered.avgScore, 1)}</strong></div>}
        </div>,
        document.body
      )}
    </div>
  );
}

function TrendLabels({ data = [], dateKey = 'date' }) {
  if (data.length < 2) return null;
  return (
    <div className="ana-trend-labels">
      <span>{formatDateOnly(data[0]?.[dateKey])}</span>
      <span>{formatDateOnly(data[data.length - 1]?.[dateKey])}</span>
    </div>
  );
}

function DonutChart({ segments = [], size = 110, centerLabel, centerSub }) {
  const total = segments.reduce((s, sg) => s + (Number(sg.value) || 0), 0) || 1;
  const active = segments.filter(sg => (Number(sg.value) || 0) > 0);
  let acc = 0;
  const stops = active.map(sg => {
    const start = (acc / total) * 360;
    acc += Number(sg.value) || 0;
    const end = (acc / total) * 360;
    return `${sg.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  const bg = stops.length ? `conic-gradient(${stops.join(', ')})` : '#f1f5f9';
  return (
    <div className="ana-donut" style={{ width: size, height: size }}>
      <div className="ana-donut-ring" style={{ background: bg }} />
      <div className="ana-donut-hole">
        {centerLabel && <span className="ana-donut-val">{centerLabel}</span>}
        {centerSub   && <span className="ana-donut-sub">{centerSub}</span>}
      </div>
    </div>
  );
}

function Legend({ items = [] }) {
  return (
    <div className="ana-legend">
      {items.map((it, i) => (
        <div key={i} className="ana-legend-item">
          <span className="ana-legend-dot" style={{ background: it.color }} />
          <span className="ana-legend-text">{it.label}</span>
          {it.value != null && <strong>{fmt(it.value)}</strong>}
        </div>
      ))}
    </div>
  );
}

function HBar({ label, value, maxValue, color, badge }) {
  const pct = maxValue > 0 ? Math.min(Math.round((value / maxValue) * 100), 100) : 0;
  return (
    <div className="ana-hbar-row">
      <div className="ana-hbar-label">{label}</div>
      <div className="ana-hbar-track">
        <div className="ana-hbar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="ana-hbar-val">
        {fmt(value)}
        {badge && <span className="ana-hbar-badge">{badge}</span>}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color = '#4f46e5' }) {
  return (
    <div className="ana-kpi-card">
      <div className="ana-kpi-icon" style={{ background: `${color}1a`, color }}>{icon}</div>
      <div className="ana-kpi-body">
        <div className="ana-kpi-val" style={{ color }}>{value ?? '—'}</div>
        <div className="ana-kpi-label">{label}</div>
        {sub && <div className="ana-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Card({ title, children, noPad, stretch }) {
  return (
    <div className={`ana-card${stretch ? ' ana-card--stretch' : ''}`}>
      {title && <div className="ana-card-title">{title}</div>}
      <div className={noPad ? '' : 'ana-card-body'}>{children}</div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="ana-skeleton-card"><div className="ana-skeleton-pulse" /></div>;
}

// ── Overview Panel ────────────────────────────────────────

function OverviewPanel({ data, loading, filters, catalog = GAME_CATALOG }) {
  const [sortKey, setSortKey] = React.useState('sessions');
  const [sortDir, setSortDir] = React.useState('desc');
  const [childSortKey, setChildSortKey] = React.useState('sessions');
  const [childSortDir, setChildSortDir] = React.useState('desc');

  const [childrenData, setChildrenData] = React.useState([]);
  const [childrenPage, setChildrenPage] = React.useState(0);
  const [loadingChildren, setLoadingChildren] = React.useState(false);
  const [hasMoreChildren, setHasMoreChildren] = React.useState(true);

  React.useEffect(() => {
    setChildrenPage(0);
  }, [filters]);

  React.useEffect(() => {
    if (!filters) return;
    let isMounted = true;
    const fetchChildren = async () => {
      setLoadingChildren(true);
      try {
        const { data: resData } = await axiosAdmin.get('/analysis/top-children', {
          params: { ...buildApiParams(filters), limit: 50, offset: childrenPage * 50, sortKey: childSortKey, sortDir: childSortDir }
        });
        if (!isMounted) return;
        const newChildren = resData.topChildren || [];
        setHasMoreChildren(newChildren.length === 50);
        if (childrenPage === 0) setChildrenData(newChildren);
        else setChildrenData(prev => [...prev, ...newChildren]);
      } catch (err) {
        console.error('Error fetching children:', err);
      } finally {
        if (isMounted) setLoadingChildren(false);
      }
    };
    fetchChildren();
    return () => { isMounted = false; };
  }, [filters, childSortKey, childSortDir, childrenPage]);

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  if (loading && !data) return (
    <div className="ana-content">
      <div className="ana-kpi-row">{Array(5).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>
      <SkeletonCard /><SkeletonCard />
    </div>
  );
  if (!data) return <div className="ana-empty-state"><div className="ana-empty-icon">📊</div><div>No assessment data available for selected filters.</div></div>;

  const { kpis, byGame = [], dailyTrend = [], statusDist = [], genderDist = [] } = data;

  const statusSegs = statusDist.map(r => ({ label: r.status?.replace('_', ' '), color: STATUS_COLORS[r.status] || '#94a3b8', value: Number(r.count) }));
  const genderSegs = genderDist.map(r => ({ label: GENDER_LABELS[r.gender] || r.gender || 'Unknown', color: GENDER_COLORS[r.gender] || '#94a3b8', value: Number(r.children) }));
  const maxSessions = Math.max(...byGame.map(g => Number(g.sessions) || 0), 1);

  const SORT_FIELDS = {
    game:       g => (GAME_CATALOG.find(c => c.key === g.gameKey)?.title || g.gameKey || '').toLowerCase(),
    sessions:   g => Number(g.sessions) || 0,
    children:   g => Number(g.children) || 0,
    completed:  g => Number(g.completed) || 0,
    dropped:    g => Number(g.dropped) || 0,
    completion: g => Number(g.completionRate) || 0,
    avgScore:   g => Number(g.avgScore) || 0,
    avgTime:    g => Number(g.avgDurationMins) || 0,
  };
  const sortedByGame = [...byGame].sort((a, b) => {
    const fn = SORT_FIELDS[sortKey] || SORT_FIELDS.sessions;
    const av = fn(a), bv = fn(b);
    return sortDir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
  });

  function SortTh({ label, sortId }) {
    const active = sortKey === sortId;
    return (
      <th className={`ana-th-sort${active ? ' active' : ''}`} onClick={() => handleSort(sortId)}>
        {label}
        <span className="ana-sort-icon">{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span>
      </th>
    );
  }

  function handleChildSort(key) {
    if (childSortKey === key) setChildSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setChildSortKey(key); setChildSortDir('desc'); }
    setChildrenPage(0);
  }

  function SortThChild({ label, sortId }) {
    const active = childSortKey === sortId;
    return (
      <th className={`ana-th-sort${active ? ' active' : ''}`} onClick={() => handleChildSort(sortId)}>
        {label}
        <span className="ana-sort-icon">{active ? (childSortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span>
      </th>
    );
  }

  return (
    <div className="ana-content">
      <div className="ana-kpi-row">
        <KpiCard icon="🎮" label="Total Sessions"  value={fmt(kpis.totalSessions)}  color="#4f46e5" />
        <KpiCard icon="👦" label="Unique Children" value={fmt(kpis.uniqueChildren)} color="#0891b2" />
        <KpiCard icon="✅" label="Completion Rate" value={`${fmt(kpis.completionRate)}%`} sub={`${fmt(kpis.completedSessions)} completed`} color="#22c55e" />
        <KpiCard icon="📊" label="Avg Score"       value={fmt(kpis.avgScore, 1)} sub="across all tests" color="#7c3aed" />
        <KpiCard icon="⏱️" label="Avg Duration"    value={kpis.avgDurationMins ? `${fmt(kpis.avgDurationMins, 1)} min` : '—'} color="#f59e0b" />
      </div>

      <div className="ana-grid-2">
        <Card title="Sessions by Test" stretch>
          <div className="ana-hbar-list">
            {byGame.length === 0
              ? <div className="ana-chart-empty">No test data for selected filters</div>
              : byGame.map(g => {
                const meta = GAME_CATALOG.find(c => c.key === g.gameKey) || {};
                return (
                  <HBar key={g.gameKey}
                    label={<span>{meta.icon || ''} {g.title || g.gameKey}</span>}
                    value={Number(g.sessions)}
                    maxValue={maxSessions}
                    color={g.color || '#4f46e5'}
                    badge={`${g.completionRate ?? 0}%`}
                  />
                );
              })
            }
          </div>
        </Card>

        <div className="ana-col-gap">
          <Card title="Session Status">
            {statusSegs.length === 0
              ? <div className="ana-card-body"><div className="ana-chart-empty">No status data</div></div>
              : <div className="ana-donut-row">
                  <DonutChart segments={statusSegs} size={100} centerLabel={fmt(kpis.totalSessions)} centerSub="total" />
                  <Legend items={statusSegs} />
                </div>
            }
          </Card>
          <Card title="Gender Distribution">
            {genderSegs.length === 0
              ? <div className="ana-card-body"><div className="ana-chart-empty">No gender data</div></div>
              : <div className="ana-donut-row">
                  <DonutChart segments={genderSegs} size={100} centerLabel={fmt(kpis.uniqueChildren)} centerSub="children" />
                  <Legend items={genderSegs} />
                </div>
            }
          </Card>
        </div>
      </div>

      <Card title="Daily Activity Trend">
        <div className={loading ? 'ana-faded' : ''}>
          <TrendLine data={dailyTrend} valueKey="sessions" color="#4f46e5" secondKey="completed" secondColor="#22c55e" />
          <TrendLabels data={dailyTrend} />
          <div className="ana-trend-legend">
            <span><span className="ana-dot" style={{ background: '#4f46e5' }} /> Sessions</span>
            <span><span className="ana-dot ana-dot-dash" style={{ background: '#22c55e' }} /> Completed</span>
          </div>
        </div>
      </Card>

      <Card title="Test Performance Summary" noPad>
        <div className="ana-table-wrap">
          <table className="ana-table">
            <thead>
              <tr>
                <SortTh label="Test"      sortId="game" />
                <SortTh label="Sessions"  sortId="sessions" />
                <SortTh label="Children"  sortId="children" />
                <SortTh label="Completed" sortId="completed" />
                <SortTh label="Dropped"   sortId="dropped" />
                <SortTh label="Compl.%"   sortId="completion" />
                <SortTh label="Avg Score" sortId="avgScore" />
                <SortTh label="Avg Time"  sortId="avgTime" />
              </tr>
            </thead>
            <tbody>
              {sortedByGame.map(g => {
                const meta = GAME_CATALOG.find(c => c.key === g.gameKey) || {};
                return (
                  <tr key={g.gameKey}>
                    <td><span className="ana-game-chip" style={{ background: `${meta.color || g.color || '#4f46e5'}1a`, color: meta.color || g.color }}>{meta.icon} {meta.title || g.gameKey}</span></td>
                    <td>{fmt(g.sessions)}</td>
                    <td>{fmt(g.children)}</td>
                    <td>{fmt(g.completed)}</td>
                    <td>{fmt(g.dropped)}</td>
                    <td><span className="ana-pct-bar" style={{ '--p': `${g.completionRate || 0}%` }}>{g.completionRate ?? 0}%</span></td>
                    <td>{fmt(g.avgScore, 1)}</td>
                    <td>{g.avgDurationMins ? `${fmt(g.avgDurationMins, 1)} min` : '—'}</td>
                  </tr>
                );
              })}
              {sortedByGame.length === 0 && <tr><td colSpan="8" className="ana-table-empty">No sessions recorded for selected filters</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Top Active Children" noPad>
        <div className="ana-table-wrap">
          <table className="ana-table ana-table-bordered">
            <thead><tr>
              <th>#</th>
              <SortThChild label="Child ID" sortId="childId" />
              <SortThChild label="Name" sortId="name" />
              <SortThChild label="Completed" sortId="completed" />
              <SortThChild label="Sessions" sortId="sessions" />
              {catalog.map(g => (
                <SortThChild key={g.key} label={`${g.title} (${GAME_MAX_SCORES[g.key] ?? '—'})`} sortId={CHILD_SCORE_COLS[g.key]?.sortId} />
              ))}
              <SortThChild label="Total Score" sortId="totalScore" />
              <SortThChild label="Total Time" sortId="totalTime" />
              <SortThChild label="Last Played" sortId="lastPlayed" />
            </tr></thead>
            <tbody>
              {childrenData.map((c, i) => (
                <tr key={c.child_id}>
                  <td><span className="ana-rank">{i + 1}</span></td>
                  <td><code>{c.child_id}</code></td>
                  <td>{c.name || '—'}</td>
                  <td>{fmt(c.completed)}</td>
                  <td>{fmt(c.sessions)}</td>
                  {catalog.map(g => (
                    <td key={g.key}>{fmt(c[CHILD_SCORE_COLS[g.key]?.field], 1)}</td>
                  ))}
                  <td>{fmt(c.totalScore)}</td>
                  <td>{formatHoursMins(c.totalTimeMins)}</td>
                  <td>{formatDate(c.lastPlayed)}</td>
                </tr>
              ))}
              {childrenData.length === 0 && !loadingChildren && <tr><td colSpan={8 + GAME_CATALOG.length} className="ana-table-empty">No children data</td></tr>}
              {loadingChildren && <tr><td colSpan={8 + GAME_CATALOG.length} className="ana-table-empty">Loading...</td></tr>}
            </tbody>
          </table>
          {hasMoreChildren && !loadingChildren && childrenData.length > 0 && (
            <div style={{ textAlign: 'center', padding: '15px' }}>
              <button className="ana-btn" onClick={() => setChildrenPage(p => p + 1)}>Load More</button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Game Panel ────────────────────────────────────────────

function GamePanel({ gameMeta, gameKey, data, loading, filters }) {
  const [sessions,         setSessions]         = React.useState([]);
  const [sessionsPage,     setSessionsPage]     = React.useState(0);
  const [loadingSessions,  setLoadingSessions]  = React.useState(false);
  const [hasMoreSessions,  setHasMoreSessions]  = React.useState(true);
  const [sessionSortKey,   setSessionSortKey]   = React.useState('time');
  const [sessionSortDir,   setSessionSortDir]   = React.useState('desc');

  React.useEffect(() => {
    setSessionsPage(0);
  }, [filters, gameKey]);

  const handleSessionSort = (key) => {
    if (sessionSortKey === key) setSessionSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSessionSortKey(key); setSessionSortDir('desc'); }
    setSessionsPage(0);
  };

  function SortThSess({ label, sortId, hint }) {
    const active = sessionSortKey === sortId;
    return (
      <th className={`ana-th-sort${active ? ' active' : ''}`} onClick={() => handleSessionSort(sortId)} title={hint}>
        {label}
        <span className="ana-sort-icon">{active ? (sessionSortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span>
      </th>
    );
  }

  React.useEffect(() => {
    if (!filters || !gameKey) return;
    let isMounted = true;
    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const { data: resData } = await axiosAdmin.get(`/analysis/game/${gameKey}/sessions`, {
          params: { ...buildApiParams(filters), limit: 50, offset: sessionsPage * 50, sortKey: sessionSortKey, sortDir: sessionSortDir }
        });
        if (!isMounted) return;
        const rows = resData.sessions || [];
        setHasMoreSessions(rows.length === 50);
        if (sessionsPage === 0) setSessions(rows);
        else setSessions(prev => [...prev, ...rows]);
      } catch (err) {
        console.error('Error fetching game sessions:', err);
      } finally {
        if (isMounted) setLoadingSessions(false);
      }
    };
    fetchSessions();
    return () => { isMounted = false; };
  }, [filters, gameKey, sessionsPage, sessionSortKey, sessionSortDir]);

  if (loading && !data) return (
    <div className="ana-content">
      <div className="ana-kpi-row">{Array(5).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>
      <SkeletonCard /><SkeletonCard />
    </div>
  );
  if (!data) return <div className="ana-empty-state"><div className="ana-empty-icon">{gameMeta.icon}</div><div>No assessment data available for selected filters.</div></div>;

  const {
    kpis, scoreDist, quitReasons = [], genderBreakdown = [],
    dailyTrend = [], assessmentDist = {}, behaviorFreq = {},
    attemptBuckets = {},
  } = data;

  const scoreEntries   = scoreDist ? Object.entries(scoreDist) : [];
  const maxScoreCount  = Math.max(...scoreEntries.map(([, v]) => Number(v) || 0), 1);
  const totalScored    = scoreEntries.reduce((s, [, v]) => s + (Number(v) || 0), 0);

  const statusSegs = [
    { label: 'Completed',    color: '#22c55e', value: Number(kpis.completedSessions) || 0 },
    { label: 'Dropped/Quit', color: '#ef4444', value: Number(kpis.droppedSessions)   || 0 },
    { label: 'Other',        color: '#cbd5e1', value: Math.max(0, (Number(kpis.totalSessions) || 0) - (Number(kpis.completedSessions) || 0) - (Number(kpis.droppedSessions) || 0)) },
  ].filter(s => s.value > 0);

  const maxGenderSess = Math.max(...genderBreakdown.map(g => Number(g.sessions) || 0), 1);

  function buildAssessSegs(distObj, qKey) {
    const opts = ASSESS_LABELS[qKey]?.opts || {};
    return Object.entries(distObj || {}).map(([k, v], i) => ({
      label: opts[k] || k, value: Number(v), color: ASSESS_COLORS[i % ASSESS_COLORS.length]
    }));
  }

  const maxGameScore = GAME_MAX_SCORES[gameKey] ?? data.meta?.maxScore ?? null;

  const behaviorEntries = Object.entries(behaviorFreq).sort((a, b) => b[1] - a[1]);
  const maxBehavior     = Math.max(...behaviorEntries.map(([, v]) => v), 1);
  const attemptEntries  = Object.entries(attemptBuckets);
  const maxAttempt      = Math.max(...attemptEntries.map(([, v]) => v), 1);

  return (
    <div className="ana-content">
      <div className="ana-kpi-row">
        <KpiCard icon="🎮" label="Total Sessions"  value={fmt(kpis.totalSessions)}  color={gameMeta.color} />
        <KpiCard icon="👦" label="Unique Children" value={fmt(kpis.uniqueChildren)} color="#0891b2" />
        <KpiCard icon="✅" label="Completion Rate" value={`${kpis.completionRate ?? 0}%`} sub={`${fmt(kpis.completedSessions)} sessions`} color="#22c55e" />
        <KpiCard icon="📊" label="Avg Score"       value={fmt(kpis.avgScore, 1)} sub={`${kpis.avgScorePct ?? 0}% of max (${data.meta?.maxScore})`} color="#7c3aed" />
        <KpiCard icon="⏱️" label="Avg Duration"    value={kpis.avgDurationMins ? `${fmt(kpis.avgDurationMins, 1)} min` : '—'} color="#f59e0b" />
      </div>

      <div className="ana-grid-3">
        <Card title="Score Distribution">
          <div className="ana-hbar-list">
            {totalScored === 0
              ? <div className="ana-chart-empty">No scored sessions for selected filters</div>
              : <>
                  {scoreEntries.map(([range, count]) => (
                    <HBar key={range} label={range} value={Number(count)} maxValue={maxScoreCount} color={gameMeta.color}
                      badge={`${Math.round((Number(count) / totalScored) * 100)}%`} />
                  ))}
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    {totalScored} scored session{totalScored === 1 ? '' : 's'} — includes partial scores of dropped / quit sessions
                  </div>
                </>
            }
          </div>
        </Card>

        <Card title="Session Status">
          {statusSegs.length === 0
            ? <div className="ana-card-body"><div className="ana-chart-empty">No data</div></div>
            : <div className="ana-donut-row">
                <DonutChart segments={statusSegs} size={90} centerLabel={`${kpis.completionRate ?? 0}%`} centerSub="done" />
                <Legend items={statusSegs} />
              </div>
          }
        </Card>

        <Card title="Gender Breakdown">
          <div className="ana-hbar-list">
            {genderBreakdown.length === 0
              ? <div className="ana-chart-empty">No data</div>
              : genderBreakdown.map(g => (
                  <HBar key={g.gender}
                    label={GENDER_LABELS[g.gender] || g.gender || 'Unknown'}
                    value={Number(g.sessions)}
                    maxValue={maxGenderSess}
                    color={GENDER_COLORS[g.gender] || '#94a3b8'}
                    badge={g.avgScore != null ? `avg ${fmt(g.avgScore, 1)}` : undefined}
                  />
                ))
            }
          </div>
        </Card>
      </div>

      <Card title="Daily Sessions Trend">
        <div className={loading ? 'ana-faded' : ''}>
          <TrendLine data={dailyTrend} valueKey="sessions" color={gameMeta.color} secondKey="completed" secondColor="#22c55e" />
          <TrendLabels data={dailyTrend} />
          <div className="ana-trend-legend">
            <span><span className="ana-dot" style={{ background: gameMeta.color }} /> Sessions</span>
            <span><span className="ana-dot ana-dot-dash" style={{ background: '#22c55e' }} /> Completed</span>
          </div>
        </div>
      </Card>

      {Object.values(assessmentDist).some(d => Object.keys(d || {}).length > 0) && (
        <Card title="Assessment Responses">
          <div className="ana-assess-grid">
            {['q1', 'q2', 'q3', 'q4'].map(qKey => {
              const segs = buildAssessSegs(assessmentDist[qKey], qKey);
              if (!segs.length) return null;
              const total = segs.reduce((s, sg) => s + sg.value, 0);
              return (
                <div key={qKey} className="ana-assess-cell">
                  <div className="ana-assess-title">{ASSESS_LABELS[qKey]?.title}</div>
                  <div className="ana-donut-row">
                    <DonutChart segments={segs} size={80} centerLabel={fmt(total)} centerSub="resp." />
                    <Legend items={segs} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {(behaviorEntries.length > 0 || attemptEntries.length > 0) && (
        <div className="ana-grid-2">
          {behaviorEntries.length > 0 && (
            <Card title="Observed Behaviors">
              <div className="ana-hbar-list">
                {behaviorEntries.slice(0, 10).map(([b, count]) => (
                  <HBar key={b} label={b} value={count} maxValue={maxBehavior} color="#8b5cf6" />
                ))}
              </div>
            </Card>
          )}
          {attemptEntries.length > 0 && (
            <Card title="Attempt Patterns">
              <div className="ana-hbar-list">
                {attemptEntries.map(([bucket, count]) => (
                  <HBar key={bucket} label={`${bucket} attempt${bucket === '1' ? '' : 's'}`} value={count} maxValue={maxAttempt} color="#f59e0b" />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {quitReasons.length > 0 && (
        <Card title="Quit / Drop Reasons" noPad>
          <div className="ana-table-wrap">
            <table className="ana-table">
              <thead><tr><th>Reason</th><th>Count</th></tr></thead>
              <tbody>
                {quitReasons.map(r => (
                  <tr key={r.quit_reason}><td>{r.quit_reason || 'Not specified'}</td><td>{fmt(r.count)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', width: '100%' }}>
            <span>Recent Sessions{sessions.length ? ` (${sessions.length} loaded)` : ''}</span>
            {sessions.length > 0 && (
              <button className="ana-btn" style={{ fontSize: '12px' }} onClick={() => exportSessionsCSV(sessions, gameMeta, maxGameScore)}>
                📥 Export CSV
              </button>
            )}
          </span>
        }
        noPad
      >
        <div className="ana-table-wrap">
          <table className="ana-table">
            <thead>
              <tr>
                <th>#</th>
                <SortThSess label="Child"    sortId="child" />
                <SortThSess label="Attempt"  sortId="attempt" />
                <SortThSess label="Status"   sortId="status" />
                <SortThSess label="Score"    sortId="score" />
                <SortThSess label="Progress" sortId="progress" hint="How far into the game the session reached (questions/screens completed)" />
                <SortThSess label="Duration" sortId="duration" />
                <SortThSess label="When"     sortId="time" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const pct   = maxGameScore && s.score != null ? Math.round((s.score / maxGameScore) * 100) : null;
                const delta = s.prevScore != null && s.score != null ? s.score - s.prevScore : null;
                const shortSession = s.durationSec != null && s.durationSec < 30;
                const totalQ   = Number(s.total_questions) || null;
                const reached  = Number(s.progress_level) || 0;
                const progPct  = totalQ ? Math.min(100, Math.round((reached / totalQ) * 100)) : null;
                return (
                  <tr key={s.id}>
                    <td><span className="ana-rank">{i + 1}</span></td>
                    <td>
                      <div className="ana-child-cell">
                        <code>{s.child_id}</code>
                        {s.childName && <span className="ana-child-name">{s.childName}</span>}
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {s.gender === 'male' ? '♂' : s.gender === 'female' ? '♀' : ''}{s.age != null ? ` ${s.age}y` : ''}
                        </span>
                      </div>
                    </td>
                    <td title={`Attempt no. ${s.attemptNo} of this child on this test (all-time)`}>
                      <span style={{ fontWeight: 600, color: s.attemptNo === 1 ? '#0891b2' : '#64748b' }}>
                        #{s.attemptNo}{s.attemptNo === 1 ? ' 🆕' : ''}
                      </span>
                    </td>
                    <td>
                      <span className="ana-status-pill" style={{ background: `${STATUS_COLORS[s.status] || '#94a3b8'}22`, color: STATUS_COLORS[s.status] || '#64748b' }}>
                        {s.status?.replace('_', ' ')}
                      </span>
                      {s.quit_reason && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.quit_reason}>
                          {s.quit_reason}
                        </div>
                      )}
                    </td>
                    <td style={{ minWidth: '110px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong>{fmt(s.score)}</strong>
                        {pct != null && <span style={{ fontSize: '11px', color: scoreBandColor(pct) }}>{pct}%</span>}
                        {delta != null && delta !== 0 && (
                          <span title={`vs previous attempt (${fmt(s.prevScore)})`} style={{ fontSize: '11px', fontWeight: 700, color: delta > 0 ? '#22c55e' : '#ef4444' }}>
                            {delta > 0 ? `▲+${delta}` : `▼${delta}`}
                          </span>
                        )}
                      </div>
                      {pct != null && (
                        <div style={{ width: '80px', height: '4px', borderRadius: '2px', background: '#f1f5f9', marginTop: '3px' }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: '2px', background: scoreBandColor(pct) }} />
                        </div>
                      )}
                    </td>
                    <td style={{ minWidth: '90px' }} title={totalQ
                        ? `Reached item ${reached} of ${totalQ} before the session ended`
                        : `Reached item/screen ${reached} (this test doesn't record a total)`}>
                      <div style={{ fontSize: '12.5px' }}>
                        {totalQ ? <><strong>{reached}</strong>/{totalQ} <span style={{ fontSize: '11px', color: '#94a3b8' }}>{progPct}%</span></> : <strong>{reached}</strong>}
                      </div>
                      {progPct != null && (
                        <div style={{ width: '70px', height: '4px', borderRadius: '2px', background: '#f1f5f9', marginTop: '3px' }}>
                          <div style={{ width: `${progPct}%`, height: '100%', borderRadius: '2px', background: progPct >= 100 ? '#22c55e' : '#0891b2' }} />
                        </div>
                      )}
                    </td>
                    <td>
                      {formatDuration(s.durationSec)}
                      {shortSession && <span title="Unusually short session (under 30s) — possibly an accidental start" style={{ marginLeft: '4px', cursor: 'help' }}>⚠️</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>{timeAgo(s.start_time)}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(s.start_time)}</div>
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && !loadingSessions && <tr><td colSpan="8" className="ana-table-empty">No sessions recorded</td></tr>}
              {loadingSessions && <tr><td colSpan="8" className="ana-table-empty">Loading...</td></tr>}
            </tbody>
          </table>
          {hasMoreSessions && !loadingSessions && sessions.length > 0 && (
            <div style={{ textAlign: 'center', padding: '15px' }}>
              <button className="ana-btn" onClick={() => setSessionsPage(p => p + 1)}>Load More</button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────

function FilterBar({ pending, onChange, onApply, onReset, meta, activeTab, hasChanges, loading, groupOptions, catalog = GAME_CATALOG }) {
  const toggle = (key, val) => onChange(prev => ({
    ...prev,
    [key]: prev[key].includes(val) ? prev[key].filter(x => x !== val) : [...prev[key], val],
  }));

  return (
    <div className="ana-filter-panel">
      <div className="ana-filter-row">
        <div className="ana-filter-field">
          <span className="ana-filter-label">From Date</span>
          <input type="date" value={pending.startDate}
            onChange={e => onChange(p => ({ ...p, startDate: e.target.value }))} />
        </div>
        <div className="ana-filter-field">
          <span className="ana-filter-label">To Date</span>
          <input type="date" value={pending.endDate}
            onChange={e => onChange(p => ({ ...p, endDate: e.target.value }))} />
        </div>
        <div className="ana-filter-field ana-filter-child">
          <span className="ana-filter-label">Child (ID / Name)</span>
          <input type="text" placeholder="Search…" value={pending.childId}
            onChange={e => onChange(p => ({ ...p, childId: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && onApply()} />
        </div>
      </div>

      <div className="ana-filter-row">
        <ChipGroup label="Gender"
          options={[{ key: 'male', label: 'Male', color: '#3b82f6' }, { key: 'female', label: 'Female', color: '#ec4899' }]}
          selected={pending.genders}
          onToggle={v => toggle('genders', v)}
        />
        <span className="ana-filter-sep" />
        <ChipGroup label="Age"
          options={AGE_CHIP_OPTIONS}
          selected={pending.ageGroups}
          onToggle={v => toggle('ageGroups', v)}
        />
        <span className="ana-filter-sep" />
        <ChipGroup label="Status"
          options={STATUS_CHIP_OPTIONS}
          selected={pending.statuses}
          onToggle={v => toggle('statuses', v)}
        />
        {groupOptions.length > 0 && (
          <>
            <span className="ana-filter-sep" />
            <ChipGroup label="Group"
              options={groupOptions.map(g => ({ key: String(g.id), label: g.name, color: '#6366f1' }))}
              selected={pending.groupIds}
              onToggle={v => toggle('groupIds', v)}
            />
          </>
        )}
        {activeTab === 'overall' && (
          <>
            <span className="ana-filter-sep" />
            <ChipGroup label="Test"
              options={catalog.map(g => ({ key: g.key, label: g.title, color: g.color }))}
              selected={pending.gameKeys}
              onToggle={v => toggle('gameKeys', v)}
            />
          </>
        )}
      </div>

      <div className="ana-filter-actions">
        <button className="ana-btn-apply" onClick={onApply} disabled={loading}>
          {loading ? <span className="ana-spinner-sm" /> : '✓'}
          {' '}Apply Filters
          {hasChanges && <span className="ana-filter-dot" />}
        </button>
        <button className="ana-btn-ghost" onClick={onReset} disabled={loading}>
          ↺ Reset
        </button>
        {meta && (
          <span className="ana-filter-meta">
            Data from <strong>{meta.minDate}</strong> · <strong>{fmt(meta.totalSessions)}</strong> sessions total
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export default function AdminAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [meta,            setMeta]          = useState(null);
  const [activeTab,       setActiveTab]     = useState(() => searchParams.get('tab') || 'overall');
  const [pendingFilters,  setPendingFilters] = useState(EMPTY_FILTERS);
  const [filters,         setFilters]       = useState(null);   // null = meta not yet loaded
  const [overviewData,    setOverviewData]  = useState(null);
  const [gameData,        setGameData]      = useState({});
  const [loading,         setLoading]       = useState(false);
  const [error,           setError]         = useState(null);
  const [groupOptions,    setGroupOptions]  = useState([]);
  const [testOrder,       setTestOrder]     = useState(null);   // ordered keys from Settings → Test Configuration
  const metaFetchedRef = useRef(false);

  useEffect(() => {
    axiosAdmin.get('/admin/child-groups')
      .then(res => setGroupOptions(res.data.filter(g => g.status === 'active')))
      .catch(err => console.error('Failed to fetch child groups:', err));
    axiosAdmin.get('/admin/test-config')
      .then(({ data }) => setTestOrder((data.tests || []).map(t => t.key)))
      .catch(err => console.error('Failed to fetch test config order:', err));
  }, []);

  // All tests, ordered as configured in Admin Settings → Test Configuration
  const orderedCatalog = React.useMemo(() => {
    if (!testOrder?.length) return GAME_CATALOG;
    const pos = new Map(testOrder.map((k, i) => [k, i]));
    return [...GAME_CATALOG].sort((a, b) => (pos.get(a.key) ?? 999) - (pos.get(b.key) ?? 999));
  }, [testOrder]);

  // Fetch meta once on mount → set default date range
  useEffect(() => {
    if (metaFetchedRef.current) return;
    metaFetchedRef.current = true;
    axiosAdmin.get('/analysis/meta')
      .then(({ data }) => {
        setMeta(data);
        const defaults = {
          ...EMPTY_FILTERS,
          startDate: data.minDate || todayStr(),
          endDate:   data.today  || todayStr(),
        };
        setPendingFilters(defaults);
        setFilters(defaults);
      })
      .catch(() => {
        const today   = todayStr();
        const defaults = { ...EMPTY_FILTERS, startDate: today, endDate: today };
        setPendingFilters(defaults);
        setFilters(defaults);
      });
  }, []);

  // Fetch analytics data whenever applied filters or active tab change
  const fetchData = useCallback(async () => {
    if (!filters) return;
    setLoading(true);
    setError(null);
    try {
      const params = buildApiParams(filters);
      if (activeTab === 'overall') {
        const { data } = await axiosAdmin.get('/analysis/overview', { params });
        setOverviewData(data);
      } else {
        const { data } = await axiosAdmin.get(`/analysis/game/${activeTab}`, { params });
        setGameData(prev => ({ ...prev, [activeTab]: data }));
      }
    } catch (err) {
      console.error('Analysis fetch error:', err);
      const msg = err.response?.data?.error
        || err.response?.data?.message
        || (err.message && err.message !== 'Network Error' ? err.message : null)
        || 'Failed to load analytics data. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyFilters = useCallback(() => {
    setFilters({ ...pendingFilters });
  }, [pendingFilters]);

  const resetFilters = useCallback(() => {
    const defaults = {
      ...EMPTY_FILTERS,
      startDate: meta?.minDate || todayStr(),
      endDate:   meta?.today  || todayStr(),
    };
    setPendingFilters(defaults);
    setFilters(defaults);
  }, [meta]);

  // ── Single source of truth: apply whatever the `?tab=` URL param says ──────
  // Fires on mount (so a bookmarked/shared /admin/analysis?tab=... link opens
  // straight into that dashboard), when handleTabChange updates the URL, and
  // on browser back/forward.
  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'overall');
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setError(null);
    if (tab === 'overall') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  const hasChanges = filters ? !filtersEqual(pendingFilters, filters) : false;
  const activeGame = GAME_CATALOG.find(g => g.key === activeTab);

  if (!filters) {
    return (
      <div className="ana-page">
        <div className="ana-init-loader">
          <div className="ana-spinner" />
          <span>Loading analytics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ana-page">

      {/* Filter Panel */}
      <FilterBar
        pending={pendingFilters}
        onChange={setPendingFilters}
        onApply={applyFilters}
        onReset={resetFilters}
        meta={meta}
        activeTab={activeTab}
        hasChanges={hasChanges}
        loading={loading}
        groupOptions={groupOptions}
        catalog={orderedCatalog}
      />

      <div className="ana-layout">

        {/* Left Tab Panel */}
        <aside className="ana-left-panel">
          <button
            className={`ana-tab-item${activeTab === 'overall' ? ' active' : ''}`}
            onClick={() => handleTabChange('overall')}
          >
            <span className="ana-tab-icon">📊</span>
            <div className="ana-tab-text">
              <div className="ana-tab-name">Overall</div>
              <div className="ana-tab-sub">Platform Analytics</div>
            </div>
          </button>

          <div className="ana-tab-divider">Tests</div>

          {orderedCatalog.map(g => (
            <button key={g.key}
              className={`ana-tab-item${activeTab === g.key ? ' active' : ''}`}
              onClick={() => handleTabChange(g.key)}
              style={activeTab === g.key ? { '--tab-color': g.color } : {}}
            >
              <span className="ana-tab-icon">{g.icon}</span>
              <div className="ana-tab-text">
                <div className="ana-tab-name">{g.title}</div>
                <div className="ana-tab-sub">{g.tag}</div>
              </div>
              {activeTab === g.key && <span className="ana-tab-active-bar" style={{ background: g.color }} />}
            </button>
          ))}
        </aside>

        {/* Right Content Panel */}
        <main className="ana-right-panel">

          <div className="ana-panel-header">
            <h2 className="ana-panel-title">
              {activeTab === 'overall'
                ? 'Platform Overview'
                : <>{activeGame?.icon} {activeGame?.title} Analytics</>
              }
            </h2>
            {activeTab !== 'overall' && activeGame && activeGame.tag && (
              <span className="ana-panel-tag" style={{ background: `${activeGame.color}1a`, color: activeGame.color }}>
                {activeGame.tag}
              </span>
            )}
            {activeTab !== 'overall' && gameData[activeTab]?.meta?.maxScore != null && (
              <span className="ana-panel-tag" style={{ background: '#f1f5f9', color: '#64748b' }}>
                Max Score: <strong>{gameData[activeTab].meta.maxScore}</strong>
              </span>
            )}
            {loading && <span className="ana-loading-chip">⏳ Loading…</span>}
            <button className="ana-btn-refresh" onClick={fetchData} title="Refresh" disabled={loading}>
              🔄
            </button>
          </div>

          {error && (
            <div className="ana-error-bar">
              ⚠️ {error}
              <button onClick={fetchData}>Retry</button>
            </div>
          )}

          {activeTab === 'overall'
            ? <OverviewPanel data={overviewData} loading={loading} filters={filters} catalog={orderedCatalog} />
            : <GamePanel
                gameMeta={activeGame || { title: activeTab, icon: '🎮', color: '#4f46e5', tag: '' }}
                gameKey={activeTab}
                data={gameData[activeTab]}
                loading={loading}
                filters={filters}
              />
          }
        </main>
      </div>
    </div>
  );
}
