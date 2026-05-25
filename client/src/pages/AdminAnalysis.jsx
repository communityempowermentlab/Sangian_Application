import React, { useState, useEffect, useCallback, useRef } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import './AdminAnalysis.css';

// ── Constants ─────────────────────────────────────────────

const GAME_CATALOG = [
  { key: 'atlantis_bagiya',        icon: '🧠', title: 'Bagiya',            tag: 'Visual Memory',    color: '#6366f1' },
  { key: 'number_recall_lottery',  icon: '🎟️', title: 'Lottery Ka Ticket', tag: 'Auditory Span',    color: '#f59e0b' },
  { key: 'rover_mela',             icon: '🗺️', title: 'Chalo Mela Chalen', tag: 'Spatial Planning', color: '#10b981' },
  { key: 'auditory_dhyan',         icon: '👂', title: 'Dhyan Kahan Hai',   tag: 'Listening Focus',  color: '#8b5cf6' },
  { key: 'working_memory_herpher', icon: '🔄', title: 'Her Pher',          tag: 'Dynamic Memory',   color: '#0891b2' },
  { key: 'numeracy_number_skill',  icon: '🔢', title: 'Ankganit',          tag: 'Academic – Maths', color: '#7c3aed' },
  { key: 'literacy_reading_skill', icon: '📖', title: 'Padh ke Batao',     tag: 'Academic – Lang',  color: '#059669' },
  { key: 'cognitive_flex_chor',    icon: '⚡', title: 'Chor Machaye Shor', tag: 'Rule Switching',   color: '#dc2626' },
  { key: 'triangle_rachna',        icon: '🔺', title: 'Rachna',            tag: 'Construction',     color: '#ef4444' },
];

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

const EMPTY_FILTERS = { startDate: '', endDate: '', genders: [], statuses: [], childId: '', gameKeys: [] };

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
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return d; }
}

function formatDuration(secs) {
  if (!secs || secs <= 0) return '—';
  const m = Math.floor(secs / 60), s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function buildApiParams(f) {
  const p = {};
  if (f.startDate)        p.startDate = f.startDate;
  if (f.endDate)          p.endDate   = f.endDate;
  if (f.genders?.length)  p.gender    = f.genders.join(',');
  if (f.statuses?.length) p.status    = f.statuses.join(',');
  if (f.childId?.trim())  p.childId   = f.childId.trim();
  if (f.gameKeys?.length) p.gameKey   = f.gameKeys.join(',');
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

function TrendLine({ data = [], valueKey = 'sessions', color = '#4f46e5', secondKey, secondColor }) {
  if (!data.length) return <div className="ana-chart-empty">No trend data available</div>;
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

  return (
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
      {data.map((_, i) => <circle key={i} cx={xs[i]} cy={ys1[i]} r="2.5" fill={color} />)}
    </svg>
  );
}

function TrendLabels({ data = [], dateKey = 'date' }) {
  if (data.length < 2) return null;
  return (
    <div className="ana-trend-labels">
      <span>{formatDate(data[0]?.[dateKey])}</span>
      <span>{formatDate(data[data.length - 1]?.[dateKey])}</span>
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

function Card({ title, children, noPad }) {
  return (
    <div className="ana-card">
      {title && <div className="ana-card-title">{title}</div>}
      <div className={noPad ? '' : 'ana-card-body'}>{children}</div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="ana-skeleton-card"><div className="ana-skeleton-pulse" /></div>;
}

// ── Overview Panel ────────────────────────────────────────

function OverviewPanel({ data, loading }) {
  if (loading && !data) return (
    <div className="ana-content">
      <div className="ana-kpi-row">{Array(5).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>
      <SkeletonCard /><SkeletonCard />
    </div>
  );
  if (!data) return <div className="ana-empty-state"><div className="ana-empty-icon">📊</div><div>No assessment data available for selected filters.</div></div>;

  const { kpis, byGame = [], dailyTrend = [], statusDist = [], genderDist = [], topChildren = [] } = data;

  const statusSegs = statusDist.map(r => ({ label: r.status?.replace('_', ' '), color: STATUS_COLORS[r.status] || '#94a3b8', value: Number(r.count) }));
  const genderSegs = genderDist.map(r => ({ label: GENDER_LABELS[r.gender] || r.gender || 'Unknown', color: GENDER_COLORS[r.gender] || '#94a3b8', value: Number(r.children) }));
  const maxSessions = Math.max(...byGame.map(g => Number(g.sessions) || 0), 1);

  return (
    <div className="ana-content">
      <div className="ana-kpi-row">
        <KpiCard icon="🎮" label="Total Sessions"  value={fmt(kpis.totalSessions)}  color="#4f46e5" />
        <KpiCard icon="👦" label="Unique Children" value={fmt(kpis.uniqueChildren)} color="#0891b2" />
        <KpiCard icon="✅" label="Completion Rate" value={`${fmt(kpis.completionRate)}%`} sub={`${fmt(kpis.completedSessions)} completed`} color="#22c55e" />
        <KpiCard icon="📊" label="Avg Score"       value={fmt(kpis.avgScore, 1)} sub="across all games" color="#7c3aed" />
        <KpiCard icon="⏱️" label="Avg Duration"    value={kpis.avgDurationMins ? `${fmt(kpis.avgDurationMins, 1)} min` : '—'} color="#f59e0b" />
      </div>

      <div className="ana-grid-2">
        <Card title="Sessions by Game">
          <div className="ana-hbar-list">
            {byGame.length === 0
              ? <div className="ana-chart-empty">No game data for selected filters</div>
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

      <Card title="Game Performance Summary" noPad>
        <div className="ana-table-wrap">
          <table className="ana-table">
            <thead>
              <tr><th>Game</th><th>Sessions</th><th>Children</th><th>Completed</th><th>Dropped</th><th>Compl.%</th><th>Avg Score</th><th>Avg Time</th></tr>
            </thead>
            <tbody>
              {byGame.map(g => {
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
              {byGame.length === 0 && <tr><td colSpan="8" className="ana-table-empty">No sessions recorded for selected filters</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Top Active Children" noPad>
        <div className="ana-table-wrap">
          <table className="ana-table">
            <thead><tr><th>#</th><th>Child ID</th><th>Name</th><th>Sessions</th><th>Completed</th><th>Avg Score</th><th>Last Played</th></tr></thead>
            <tbody>
              {topChildren.map((c, i) => (
                <tr key={c.child_id}>
                  <td><span className="ana-rank">{i + 1}</span></td>
                  <td><code>{c.child_id}</code></td>
                  <td>{c.name || '—'}</td>
                  <td>{fmt(c.sessions)}</td>
                  <td>{fmt(c.completed)}</td>
                  <td>{fmt(c.avgScore, 1)}</td>
                  <td>{formatDate(c.lastPlayed)}</td>
                </tr>
              ))}
              {topChildren.length === 0 && <tr><td colSpan="7" className="ana-table-empty">No children data</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Game Panel ────────────────────────────────────────────

function GamePanel({ gameMeta, data, loading }) {
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
    attemptBuckets = {}, recentSessions = [],
  } = data;

  const scoreEntries   = scoreDist ? Object.entries(scoreDist) : [];
  const maxScoreCount  = Math.max(...scoreEntries.map(([, v]) => Number(v) || 0), 1);

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

  const behaviorEntries = Object.entries(behaviorFreq).sort((a, b) => b[1] - a[1]);
  const maxBehavior     = Math.max(...behaviorEntries.map(([, v]) => v), 1);
  const attemptEntries  = Object.entries(attemptBuckets);
  const maxAttempt      = Math.max(...attemptEntries.map(([, v]) => v), 1);

  return (
    <div className="ana-content">
      <div className="ana-game-header" style={{ borderColor: gameMeta.color, background: `${gameMeta.color}0d` }}>
        <div className="ana-game-header-icon" style={{ background: gameMeta.color }}>{gameMeta.icon}</div>
        <div>
          <div className="ana-game-header-title" style={{ color: gameMeta.color }}>{gameMeta.title}</div>
          <div className="ana-game-header-tag">{gameMeta.tag}</div>
        </div>
        <div className="ana-game-header-meta">Max Score: <strong>{data.meta?.maxScore ?? '—'}</strong></div>
      </div>

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
            {scoreEntries.length === 0
              ? <div className="ana-chart-empty">No completed sessions</div>
              : scoreEntries.map(([range, count]) => (
                  <HBar key={range} label={range} value={Number(count)} maxValue={maxScoreCount} color={gameMeta.color} />
                ))
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

      <Card title="Recent Sessions (last 20)" noPad>
        <div className="ana-table-wrap">
          <table className="ana-table">
            <thead>
              <tr><th>Child</th><th>Status</th><th>Score</th><th>Progress</th><th>Duration</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recentSessions.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="ana-child-cell">
                      <code>{s.child_id}</code>
                      {s.childName && <span className="ana-child-name">{s.childName}</span>}
                    </div>
                  </td>
                  <td>
                    <span className="ana-status-pill" style={{ background: `${STATUS_COLORS[s.status] || '#94a3b8'}22`, color: STATUS_COLORS[s.status] || '#64748b' }}>
                      {s.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{fmt(s.score)} / {fmt(s.total_questions)}</td>
                  <td>Lv {s.progress_level}</td>
                  <td>{formatDuration(s.durationSec)}</td>
                  <td>{formatDate(s.start_time)}</td>
                </tr>
              ))}
              {recentSessions.length === 0 && <tr><td colSpan="6" className="ana-table-empty">No sessions recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────

function FilterBar({ pending, onChange, onApply, onReset, meta, activeTab, hasChanges, loading }) {
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
        <ChipGroup label="Status"
          options={STATUS_CHIP_OPTIONS}
          selected={pending.statuses}
          onToggle={v => toggle('statuses', v)}
        />
        {activeTab === 'overall' && (
          <>
            <span className="ana-filter-sep" />
            <ChipGroup label="Game"
              options={GAME_CATALOG.map(g => ({ key: g.key, label: g.title, color: g.color }))}
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
  const [meta,            setMeta]          = useState(null);
  const [activeTab,       setActiveTab]     = useState('overall');
  const [pendingFilters,  setPendingFilters] = useState(EMPTY_FILTERS);
  const [filters,         setFilters]       = useState(null);   // null = meta not yet loaded
  const [overviewData,    setOverviewData]  = useState(null);
  const [gameData,        setGameData]      = useState({});
  const [loading,         setLoading]       = useState(false);
  const [error,           setError]         = useState(null);
  const metaFetchedRef = useRef(false);

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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
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

          <div className="ana-tab-divider">Games</div>

          {GAME_CATALOG.map(g => (
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
            {activeTab !== 'overall' && activeGame && (
              <span className="ana-panel-tag" style={{ background: `${activeGame.color}1a`, color: activeGame.color }}>
                {activeGame.tag}
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
            ? <OverviewPanel data={overviewData} loading={loading} />
            : <GamePanel
                gameMeta={activeGame || { title: activeTab, icon: '🎮', color: '#4f46e5', tag: '' }}
                data={gameData[activeTab]}
                loading={loading}
              />
          }
        </main>
      </div>
    </div>
  );
}
