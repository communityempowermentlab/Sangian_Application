import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import KpiInfoIcon from '../components/KpiInfoIcon';
import './AdminAnalysis.css';

// ── Local formatting + primitives ────────────────────────────────────────
// Deliberately not shared with AdminAnalysis.jsx: that file renders this
// panel as a tab, so importing back from it would create a circular module
// dependency. These mirror its styling (same ana-* CSS classes) exactly.

function fmt(n, dec = 0) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num.toLocaleString('en-IN', { maximumFractionDigits: dec });
}
const fmtPct  = (n) => (n == null ? '—' : `${fmt(n, 1)}%`);
const fmtMins = (n) => (n == null ? '—' : `${fmt(n, 1)} min`);

const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say', unknown: 'Unknown' };
const GENDER_COLORS = { male: '#3b82f6', female: '#ec4899', other: '#8b5cf6', prefer_not_to_say: '#94a3b8', unknown: '#cbd5e1' };
// One entry per registration year (7-16), matching the Age filter's single-year
// bands. Colors step through a single-hue ordinal ramp (light→dark = young→old)
// rather than 10 unrelated hues — distinct categorical colors don't scale past
// ~8 series, and age is inherently ordered, so a light-to-dark sweep is both the
// visually correct encoding and the only one that stays legible at this count.
// Every use of these colors (donut, legend, table) always pairs the color with
// a text label, so identity is never carried by color alone.
const AGE_YEARS  = Array.from({ length: 10 }, (_, i) => 7 + i);
const AGE_RAMP   = ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
const AGE_LABELS = Object.fromEntries(AGE_YEARS.map(y => [`${y}`, `${y} yrs`]));
const AGE_COLORS = Object.fromEntries(AGE_YEARS.map((y, i) => [`${y}`, AGE_RAMP[i]]));

function KpiCard({ icon, label, value, sub, color = '#4f46e5', onClick, info, showKpiInfoIcon }) {
  return (
    <div 
      className={`ana-kpi-card ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer', transition: 'transform 0.1s', ':active': { transform: 'scale(0.98)' } } : {}}
      title={onClick ? "Click to view these children" : ""}
    >
      <div className="ana-kpi-icon" style={{ background: `${color}1a`, color }}>{icon}</div>
      <div className="ana-kpi-body">
        <div className="ana-kpi-val" style={{ color }}>{value ?? '—'}</div>
        <div className="ana-kpi-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {showKpiInfoIcon && info && <KpiInfoIcon {...info} />}
          {onClick && <span style={{ fontSize: '0.9em', opacity: 0.6 }}>↗</span>}
        </div>
        {sub && <div className="ana-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Card({ title, children, noPad, info, showKpiInfoIcon }) {
  return (
    <div className="ana-card">
      {title && (
        <div className="ana-card-title" style={{ display: 'flex', alignItems: 'center' }}>
          {title}
          {showKpiInfoIcon && info && <KpiInfoIcon {...info} />}
        </div>
      )}
      <div className={noPad ? '' : 'ana-card-body'}>{children}</div>
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

function Legend({ items = [], onItemClick }) {
  return (
    <div className="ana-legend">
      {items.map((it, i) => {
        const clickable = Boolean(onItemClick && it.onClickData);
        return (
          <div 
            key={i} 
            className={`ana-legend-item ${clickable ? 'clickable' : ''}`}
            onClick={clickable ? () => onItemClick(it.onClickData) : undefined}
            style={clickable ? { cursor: 'pointer', transition: 'transform 0.1s', ':active': { transform: 'scale(0.98)' } } : {}}
            title={clickable ? "Click to view these children" : ""}
          >
            <span className="ana-legend-dot" style={{ background: it.color }} />
            <span className="ana-legend-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {it.label}
              {clickable && <span style={{ fontSize: '0.9em', opacity: 0.6 }}>↗</span>}
            </span>
            {it.value != null && <strong>{fmt(it.value)}</strong>}
          </div>
        );
      })}
    </div>
  );
}

function SkeletonCard() {
  return <div className="ana-skeleton-card"><div className="ana-skeleton-pulse" /></div>;
}

function InsightsList({ insights }) {
  if (!insights?.length) return <div className="ana-chart-empty">Not enough data yet to generate insights for the selected filters.</div>;
  return (
    <ul className="anv2-insights-list">
      {insights.map((ins, i) => (
        <li key={i}><span className="anv2-insight-icon">{ins.icon}</span><span>{ins.text}</span></li>
      ))}
    </ul>
  );
}

function HighlightCard({ icon, label, test, valueKey, valueFmt, color, info, showKpiInfoIcon }) {
  return (
    <div className="anv2-highlight-card">
      <div className="anv2-highlight-icon" style={{ background: `${color}1a`, color }}>{icon}</div>
      <div className="anv2-highlight-body">
        <div className="anv2-highlight-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {showKpiInfoIcon && info && <KpiInfoIcon {...info} />}
        </div>
        <div className="anv2-highlight-test">{test ? test.title : '—'}</div>
        {test && <div className="anv2-highlight-val" style={{ color }}>{valueFmt(test[valueKey])}</div>}
      </div>
    </div>
  );
}

function ScoreDistBar({ dist = [], onClick }) {
  const max = Math.max(...dist.map(d => d.count), 1);
  return (
    <div
      className={`anv2-dist-row${onClick ? ' anv2-dist-row--clickable' : ''}`}
      title={onClick ? 'Click for detailed score distribution' : dist.map(d => `${d.label}: ${d.count}`).join(' · ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {dist.map(d => (
        <div key={d.label} className="anv2-dist-bar-wrap">
          <div className="anv2-dist-bar" style={{ height: `${d.count > 0 ? Math.max(8, (d.count / max) * 100) : 2}%` }} />
        </div>
      ))}
    </div>
  );
}

// Detailed single-test Score Distribution popup — opened by clicking a row's
// mini chart. Portals to document.body: .ana-right-panel scrolls internally
// (overflow-y: auto), which breaks position:fixed for in-tree elements the
// same way it does for TrendLine's hover tooltip in AdminAnalysis.jsx.
function ScoreDistModal({ test, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!test) return null;
  const dist = test.scoreDist || [];
  const total = dist.reduce((s, d) => s + d.count, 0);
  const max = Math.max(...dist.map(d => d.count), 1);

  const stats = [
    { label: 'Attempts', value: fmt(test.totalAttempts) },
    { label: 'Avg Score', value: fmtPct(test.avgScorePct) },
    { label: 'Max Achieved', value: fmt(test.maxScoreAchieved) },
    { label: 'Min Achieved', value: fmt(test.minScoreAchieved) },
    { label: 'Completion', value: `${test.completionPct}%` },
    { label: 'Drop-off', value: `${test.dropOffPct}%` },
    { label: 'Avg Time', value: fmtMins(test.avgDurationMins) },
    { label: '1st / Repeat', value: `${fmt(test.firstAttempts)} / ${fmt(test.repeatAttempts)}` },
  ];

  return createPortal(
    <div className="anv2-modal-backdrop" onClick={onClose}>
      <div className="anv2-modal-panel" onClick={e => e.stopPropagation()}>
        <button type="button" className="anv2-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        <div className="anv2-modal-header">
          <span className="anv2-modal-swatch" style={{ background: test.color }} />
          <div>
            <h3>{test.title}</h3>
            {test.tag && <div className="anv2-modal-tag">{test.tag}</div>}
          </div>
        </div>

        <div className="anv2-modal-stats">
          {stats.map(s => (
            <div key={s.label} className="anv2-modal-stat">
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </div>
          ))}
        </div>

        <div className="anv2-modal-section-title">Score Distribution</div>
        {total === 0
          ? <div className="ana-chart-empty">No scored attempts for this test in the selected filters</div>
          : <div className="anv2-modal-hbar-list">
              {dist.map(d => (
                <div key={d.label} className="anv2-modal-hbar-row">
                  <div className="anv2-modal-hbar-label">{d.label}</div>
                  <div className="anv2-modal-hbar-track">
                    <div className="anv2-modal-hbar-fill" style={{ width: `${(d.count / max) * 100}%`, background: test.color }} />
                  </div>
                  <div className="anv2-modal-hbar-val">
                    {fmt(d.count)} <span>({total ? Math.round((d.count / total) * 100) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>,
    document.body
  );
}

function RankList({ title, rows = [], valueKey, valueFmt, emptyLabel, info, showKpiInfoIcon }) {
  return (
    <Card title={title} info={info} showKpiInfoIcon={showKpiInfoIcon}>
      {!rows.length
        ? <div className="ana-chart-empty">{emptyLabel || 'No data for selected filters'}</div>
        : <ol className="anv2-rank-list">
            {rows.map((r, i) => (
              <li key={r.gameKey}>
                <span className="anv2-rank-badge">{i + 1}</span>
                <span className="anv2-rank-name" style={{ color: r.color }}>{r.title}</span>
                <span className="anv2-rank-val">{valueFmt(r[valueKey])}</span>
              </li>
            ))}
          </ol>
      }
    </Card>
  );
}

// ── Main Panel ────────────────────────────────────────────

export default function OverviewV2Panel({ data, loading, showKpiInfoIcon, catalog = [] }) {
  const [selectedTest, setSelectedTest] = React.useState(null);
  // Default view follows the Settings → Test Configuration → Test Visibility
  // drag-and-drop sequence (see testOrderPos below); users may still click
  // any column to sort by that metric instead.
  const [testSortKey, setTestSortKey] = React.useState('title');
  const [testSortDir, setTestSortDir] = React.useState('asc');
  const navigate = useNavigate();

  // `catalog` is already sorted per that configured sequence (orderedCatalog
  // in AdminAnalysis.jsx), so its index doubles as the display-sequence
  // position for every game.
  const testOrderPos = new Map(catalog.map((c, i) => [c.key, i]));

  function handleTestSort(key) {
    if (testSortKey === key) setTestSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTestSortKey(key); setTestSortDir(key === 'title' ? 'asc' : 'desc'); }
  }

  const TEST_SORT_FIELDS = {
    title:            t => testOrderPos.get(t.gameKey) ?? 999,
    totalAttempts:    t => Number(t.totalAttempts) || 0,
    avgScorePct:      t => Number(t.avgScorePct) || 0,
    maxScoreAchieved: t => Number(t.maxScoreAchieved) || 0,
    minScoreAchieved: t => Number(t.minScoreAchieved) || 0,
    completionPct:    t => Number(t.completionPct) || 0,
    dropOffPct:       t => Number(t.dropOffPct) || 0,
    avgDurationMins:  t => Number(t.avgDurationMins) || 0,
    firstAttempts:    t => Number(t.firstAttempts) || 0,
  };

  function TestSortTh({ label, sortId, title }) {
    const active = testSortKey === sortId;
    return (
      <th className={`ana-th-sort${active ? ' active' : ''}`} onClick={() => handleTestSort(sortId)} title={title}>
        {label}
        <span className="ana-sort-icon">{active ? (testSortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span>
      </th>
    );
  }

  if (loading && !data) return (
    <div className="ana-content">
      <div className="ana-kpi-row">{Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>
      <SkeletonCard /><SkeletonCard />
    </div>
  );
  if (!data) return <div className="ana-empty-state"><div className="ana-empty-icon">📊</div><div>No assessment data available for selected filters.</div></div>;

  const {
    kpis = {}, ageAnalysis = [], genderAnalysis = [], testAnalysis = [],
    highlights = {}, timeAnalytics = {}, rankings = {}, insights = [], trend,
  } = data;

  const sortedTestAnalysis = [...testAnalysis].sort((a, b) => {
    const fn = TEST_SORT_FIELDS[testSortKey] || TEST_SORT_FIELDS.totalAttempts;
    const av = fn(a), bv = fn(b);
    return testSortDir === 'asc' ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
  });

  const genderSegs = (kpis.genderDist || []).map(g => ({ 
    label: GENDER_LABELS[g.gender] || g.gender, 
    color: GENDER_COLORS[g.gender] || '#94a3b8', 
    value: g.count,
    onClickData: { gender: g.gender }
  }));
  
  const ageSegs = (kpis.ageGroupDist || []).map(a => ({ 
    label: AGE_LABELS[a.ageBand] || a.ageBand, 
    color: AGE_COLORS[a.ageBand] || '#94a3b8', 
    value: a.count,
    onClickData: { ageBand: a.ageBand }
  }));

  const handleLegendClick = (data) => {
    if (kpis.registeredChildrenIds && kpis.registeredChildrenIds.length > 0) {
      sessionStorage.setItem('childrenListFilterIds', JSON.stringify(kpis.registeredChildrenIds));
      if (data.gender) {
        sessionStorage.setItem('childrenListDemoFilters', JSON.stringify({ genders: [data.gender] }));
      }
      if (data.ageBand) {
        sessionStorage.setItem('childrenListDemoFilters', JSON.stringify({ ageBands: [data.ageBand] }));
      }
      navigate('/admin/children');
    }
  };

  return (
    <div className="ana-content anv2">

      <div className="ana-kpi-row">
        <KpiCard 
          icon="👦" 
          label="Registered Children"      
          value={fmt(kpis.totalRegisteredChildren)} 
          color="#0891b2" 
          onClick={() => {
            if (kpis.registeredChildrenIds && kpis.registeredChildrenIds.length > 0) {
              sessionStorage.setItem('childrenListFilterIds', JSON.stringify(kpis.registeredChildrenIds));
              navigate('/admin/children');
            }
          }}
        />
        <KpiCard 
          icon="🎮" 
          label="Tests Conducted"          
          value={fmt(kpis.totalTestsConducted)} 
          color="#4f46e5"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Tests Conducted",
            definition: "Total number of test sessions started by eligible children.",
            formula: "Count of all test sessions (irrespective of completion status)",
            dataSource: "Database: `sangian` | Table: `test_sessions`",
            filtersApplied: ["Date Range", "Age", "Gender", "Group ID"],
            inclusionCriteria: ["All started sessions within date range"],
            exclusionCriteria: ["Deleted or anomalous sessions"],
            dateRange: "Based on dashboard date picker selection",
            example: "If 10 children started 2 sessions each today, Total = 20.",
            eligibility: ["Matches all selected filters"]
          }}
        />
        <KpiCard 
          icon="✅" 
          label="Tests Completed"    
          value={fmt(kpis.totalAssessmentsCompleted)} 
          sub={kpis.totalTestsConducted ? `${Math.round((kpis.totalAssessmentsCompleted / kpis.totalTestsConducted) * 100)}% of tests` : undefined}
          color="#22c55e" 
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Tests Completed",
            definition: "Total number of test sessions that were successfully finished by the child.",
            formula: "Count of test sessions where status is 'completed'",
            eligibility: [
              "Child matches the selected Date Range",
              "Child matches selected Age, Gender, and Group filters"
            ]
          }}
        />
        <KpiCard 
          icon="🔁" 
          label="Repeat Tests"       
          value={fmt(kpis.totalRepeatAssessments)} 
          sub={kpis.totalTestsConducted ? `${Math.round((kpis.totalRepeatAssessments / kpis.totalTestsConducted) * 100)}% of tests` : undefined}
          color="#8b5cf6" 
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Repeat Tests",
            definition: "Number of tests played by children who had already played that specific test before.",
            formula: "Count of test sessions where attemptNo >= 2",
            eligibility: [
              "Child matches the selected Date Range",
              "Child matches selected Age, Gender, and Group filters"
            ]
          }}
        />
        <KpiCard 
          icon="📊" 
          label="Avg Overall Score"        
          value={fmtPct(kpis.avgOverallScorePct)} 
          sub="% of max, across all tests" 
          color="#7c3aed" 
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Average Overall Score",
            definition: "Average score percentage achieved across all eligible completed tests.",
            formula: "(Total Score Achieved ÷ Total Maximum Possible Score) × 100",
            eligibility: [
              "Only COMPLETED test sessions are included",
              "Child matches selected filters"
            ],
            example: [
              "Test 1: 8/10",
              "Test 2: 15/20",
              "Calculation: (23 / 30) × 100 = 76.7%"
            ]
          }}
        />
        <KpiCard
          icon="⏱️"
          label="Avg Completion Time"
          value={fmtMins(kpis.avgCompletionTimeMins)}
          color="#f59e0b"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Average Completion Time",
            definition: "Average active time taken to complete a single test session.",
            formula: "Sum of timerSeconds of all completed tests ÷ Number of completed tests",
            eligibility: [
              "Only COMPLETED test sessions are included",
              "Paused time is NOT included (timer is paused in-game)"
            ],
            notes: "This represents active play time per game."
          }}
        />
        <KpiCard
          icon="🎯"
          label="Mean Score"
          value={fmtPct(kpis.meanScorePctAll)}
          sub="% of max, across all tests"
          color="#14b8a6"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Mean Score",
            definition: "Mean score percentage, averaged across every test — incomplete sessions count as 0%.",
            formula: "Sum of Score % of ALL Sessions ÷ Total Number of Sessions",
            eligibility: [
              "ALL sessions are included, not just completed ones",
              "Child matches selected filters"
            ]
          }}
        />
        <KpiCard
          icon="⏳"
          label="Mean Assessment Duration"
          value={fmtMins(kpis.meanDurationAllMins)}
          sub="across all tests"
          color="#0ea5e9"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Mean Assessment Duration",
            definition: "Mean active time taken per test, averaged across every test — incomplete sessions count as 0.",
            formula: "Sum of Durations of ALL Sessions ÷ Total Number of Sessions",
            eligibility: [
              "ALL sessions are included, not just completed ones",
              "Paused time is NOT included (timer is paused in-game)"
            ]
          }}
        />
      </div>

      <div className="ana-grid-2">
        <Card 
          title="Male vs Female Distribution"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Gender-wise Performance",
            definition: "Distribution of unique children by gender.",
            formula: "Count of distinct children grouped by gender",
            eligibility: [
              "Child has at least one test session in the selected filters",
              "Matches age and group filters"
            ]
          }}
        >
          {genderSegs.length === 0
            ? <div className="ana-card-body"><div className="ana-chart-empty">No data</div></div>
            : <div className="ana-donut-row">
                <DonutChart segments={genderSegs} size={100} centerLabel={fmt(genderSegs.reduce((s, g) => s + g.value, 0))} centerSub="children" />
                <Legend items={genderSegs} onItemClick={handleLegendClick} />
              </div>
          }
        </Card>
        <Card 
          title="Age Group Distribution (7–11 & 12–16)"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Age-wise Analysis",
            definition: "Distribution of unique children based on their age bracket at the time of the test.",
            formula: "Count of distinct children grouped by Age Band (7-11 or 12-16)",
            eligibility: [
              "Child has at least one test session in the selected filters",
              "Matches gender and group filters"
            ],
            notes: "Age is dynamically calculated based on the child's Date of Birth at the time the data was generated."
          }}
        >
          {ageSegs.length === 0
            ? <div className="ana-card-body"><div className="ana-chart-empty">No data</div></div>
            : <div className="ana-donut-row">
                <DonutChart segments={ageSegs} size={100} centerLabel={fmt(ageSegs.reduce((s, g) => s + g.value, 0))} centerSub="children" />
                <Legend items={ageSegs} onItemClick={handleLegendClick} />
              </div>
          }
        </Card>
      </div>

      <Card title="🧠 Intelligent Insights">
        <InsightsList insights={insights} />
        {trend && trend.prevSessions > 0 && (
          <div className="anv2-trend-chip">
            vs. previous period of equal length: {fmt(trend.prevSessions)} tests conducted, {trend.prevAvgScorePct != null ? `${trend.prevAvgScorePct}%` : '—'} avg score
          </div>
        )}
      </Card>

      <Card 
        title="Age-wise Performance Analysis" 
        noPad 
        showKpiInfoIcon={showKpiInfoIcon}
        info={{
          name: "Age-wise Performance",
          definition: "Performance metrics grouped by age band.",
          formula: "Data grouped by computed Age Band at the time of session generation",
          eligibility: ["Matches all selected filters"]
        }}
      >
        <div className="ana-table-wrap">
          <table className="ana-table ana-table-bordered">
            <thead><tr>
              <th>Age Group</th><th>Children Assessed</th><th>Completed</th><th>Avg Score</th><th>Avg Time</th>
              <th>Highest Test</th><th>Lowest Test</th><th>Performance</th><th>Repeat Rate</th>
            </tr></thead>
            <tbody>
              {ageAnalysis.map(a => (
                <tr key={a.ageBand}>
                  <td><strong style={{ color: AGE_COLORS[a.ageBand] }}>{AGE_LABELS[a.ageBand] || a.ageBand}</strong></td>
                  <td>{fmt(a.childrenAssessed)}</td>
                  <td>{fmt(a.completedAssessments)}</td>
                  <td>{fmtPct(a.avgScorePct)}</td>
                  <td>{fmtMins(a.avgDurationMins)}</td>
                  <td>{a.highestScoringTest ? `${a.highestScoringTest.title} (${fmtPct(a.highestScoringTest.avgScorePct)})` : '—'}</td>
                  <td>{a.lowestScoringTest ? `${a.lowestScoringTest.title} (${fmtPct(a.lowestScoringTest.avgScorePct)})` : '—'}</td>
                  <td><span className="ana-pct-bar" style={{ '--p': `${a.overallPerformancePct || 0}%` }}>{fmtPct(a.overallPerformancePct)}</span></td>
                  <td>{fmt(a.repeatAssessmentRate)}%</td>
                </tr>
              ))}
              {ageAnalysis.length === 0 && <tr><td colSpan={9} className="ana-table-empty">No data for selected filters</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Test Highlights">
        <div className="anv2-highlight-grid">
          <HighlightCard 
            icon="🏆" 
            label="Most Scored Test"          
            test={highlights.mostScored}    
            valueKey="avgScorePct"  
            valueFmt={fmtPct}                          
            color="#22c55e" 
            showKpiInfoIcon={showKpiInfoIcon}
            info={{
              name: "Most Scored Test",
              definition: "The test with the highest average score percentage among all tests.",
              formula: "Max(Average Score Percentage)",
              eligibility: ["Requires at least one completed test session"]
            }}
          />
          <HighlightCard 
            icon="⚠️" 
            label="Highest Drop-off Rate"     
            test={highlights.highestDrop}   
            valueKey="dropOffPct"   
            valueFmt={v => `${v}%`}                    
            color="#ef4444" 
            showKpiInfoIcon={showKpiInfoIcon}
            info={{
              name: "Highest Drop-off Rate",
              definition: "The test that has the highest percentage of incomplete sessions.",
              formula: "(Incomplete Sessions ÷ Total Sessions) × 100",
              eligibility: ["Requires at least one started test session"]
            }}
          />
          <HighlightCard 
            icon="⏱️" 
            label="Longest Avg Duration"      
            test={highlights.longestTest}   
            valueKey="avgDurationMins" 
            valueFmt={fmtMins}                      
            color="#f59e0b" 
            showKpiInfoIcon={showKpiInfoIcon}
            info={{
              name: "Longest Average Duration",
              definition: "The test that takes children the longest time to complete on average.",
              formula: "Max(Average Completion Time in Minutes)",
              eligibility: ["Only COMPLETED test sessions are included"]
            }}
          />
          <HighlightCard 
            icon="🔁" 
            label="Most Repeated Test"        
            test={highlights.mostRepeated}  
            valueKey="repeatAttempts" 
            valueFmt={fmt}                          
            color="#8b5cf6" 
            showKpiInfoIcon={showKpiInfoIcon}
            info={{
              name: "Most Repeated Test",
              definition: "The test with the highest number of repeat attempts (2nd attempt or higher).",
              formula: "Max(Count of sessions with attemptNo >= 2)",
              eligibility: ["Requires at least one repeat attempt"]
            }}
          />
        </div>
      </Card>

      <Card 
        title="Test-wise Performance Analysis" 
        noPad
        showKpiInfoIcon={showKpiInfoIcon}
        info={{
          name: "Test-wise Performance",
          definition: "Detailed metrics for each individual game.",
          formula: "Data grouped by gameKey",
          eligibility: ["Matches all selected filters"]
        }}
      >
        <div className="ana-table-wrap">
          <table className="ana-table">
            <thead><tr>
              <TestSortTh label="Test" sortId="title" />
              <TestSortTh label="Attempts" sortId="totalAttempts" />
              <TestSortTh label="Avg Score" sortId="avgScorePct" />
              <TestSortTh label="Max" sortId="maxScoreAchieved" />
              <TestSortTh label="Min" sortId="minScoreAchieved" />
              <th title="Share of scores in each 0–100% band, relative to that test's own max">Score Distribution</th>
              <TestSortTh label="Compl.%" sortId="completionPct" />
              <TestSortTh label="Drop-off%" sortId="dropOffPct" />
              <TestSortTh label="Avg Time" sortId="avgDurationMins" />
              <TestSortTh label="1st / Repeat" sortId="firstAttempts" title="Sorted by 1st-attempt count" />
            </tr></thead>
            <tbody>
              {sortedTestAnalysis.map(t => (
                <tr key={t.gameKey}>
                  <td><span className="ana-game-chip" style={{ background: `${t.color}1a`, color: t.color }}>{t.title}</span></td>
                  <td>{fmt(t.totalAttempts)}</td>
                  <td>{fmtPct(t.avgScorePct)}</td>
                  <td>{fmt(t.maxScoreAchieved)}</td>
                  <td>{fmt(t.minScoreAchieved)}</td>
                  <td><ScoreDistBar dist={t.scoreDist} onClick={() => setSelectedTest(t)} /></td>
                  <td><span className="ana-pct-bar" style={{ '--p': `${t.completionPct}%` }}>{t.completionPct}%</span></td>
                  <td>{t.dropOffPct}%</td>
                  <td>{fmtMins(t.avgDurationMins)}</td>
                  <td>{fmt(t.firstAttempts)} / {fmt(t.repeatAttempts)}</td>
                </tr>
              ))}
              {testAnalysis.length === 0 && <tr><td colSpan={10} className="ana-table-empty">No data for selected filters</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card 
        title="Gender-wise Performance" 
        noPad
        showKpiInfoIcon={showKpiInfoIcon}
        info={{
          name: "Gender-wise Performance",
          definition: "Performance metrics grouped by gender.",
          formula: "Data grouped by Gender",
          eligibility: ["Matches all selected filters"]
        }}
      >
        <div className="ana-table-wrap">
          <table className="ana-table ana-table-bordered">
            <thead><tr><th>Gender</th><th>Children</th><th>Avg Score</th><th>Avg Time</th><th>Completion Rate</th><th>Best Test</th><th>Lowest Test</th><th>Repeat %</th></tr></thead>
            <tbody>
              {genderAnalysis.map(g => (
                <tr key={g.gender}>
                  <td><span style={{ color: GENDER_COLORS[g.gender] || '#64748b', fontWeight: 600 }}>{GENDER_LABELS[g.gender] || g.gender}</span></td>
                  <td>{fmt(g.children)}</td>
                  <td>{fmtPct(g.avgScorePct)}</td>
                  <td>{fmtMins(g.avgDurationMins)}</td>
                  <td>{fmt(g.completionRate)}%</td>
                  <td>{g.bestTest?.title || '—'}</td>
                  <td>{g.lowestTest?.title || '—'}</td>
                  <td>{fmt(g.repeatAssessmentRate)}%</td>
                </tr>
              ))}
              {genderAnalysis.length === 0 && <tr><td colSpan={8} className="ana-table-empty">No data for selected filters</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Time Analytics">
        <div className="anv2-highlight-grid">
          <HighlightCard icon="⚡" label="Fastest Test" test={timeAnalytics.fastestTest} valueKey="avgDurationMins" valueFmt={fmtMins} color="#22c55e" />
          <HighlightCard icon="🐢" label="Longest Test" test={timeAnalytics.longestTest} valueKey="avgDurationMins" valueFmt={fmtMins} color="#ef4444" />
        </div>
        <div className="anv2-time-stats">
          <div><span>Avg Duration / Child (all tests)</span><strong>{fmtMins(timeAnalytics.avgDurationPerChildMins)}</strong></div>
          {timeAnalytics.byAgeGroup?.map(a => (
            <div key={a.ageBand}><span>Avg Time — {AGE_LABELS[a.ageBand] || a.ageBand}</span><strong>{fmtMins(a.avgDurationMins)}</strong></div>
          ))}
          {timeAnalytics.byGender?.map(g => (
            <div key={g.gender}><span>Avg Time — {GENDER_LABELS[g.gender] || g.gender}</span><strong>{fmtMins(g.avgDurationMins)}</strong></div>
          ))}
        </div>
      </Card>

      <div className="ana-grid-3">
        <RankList 
          title="Top 5 by Score" 
          rows={rankings.topByScore} 
          valueKey="avgScorePct" 
          valueFmt={fmtPct} 
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Top 5 Tests by Score",
            definition: "The top 5 tests ordered by highest average score percentage.",
            formula: "Sorted by (Average Score Percentage) DESC",
            eligibility: ["Only COMPLETED test sessions are included"]
          }}
        />
        <RankList 
          title="Top 5 by Completion" 
          rows={rankings.topByCompletion} 
          valueKey="completionPct" 
          valueFmt={v => `${v}%`} 
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Top 5 Tests by Completion",
            definition: "The top 5 tests ordered by highest completion rate.",
            formula: "Sorted by ((Completed Sessions ÷ Total Sessions) × 100) DESC",
            eligibility: ["All test sessions"]
          }}
        />
        <RankList 
          title="Top 5 by Sessions" 
          rows={rankings.topBySessions} 
          valueKey="totalAttempts" 
          valueFmt={fmt} 
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Top 5 Tests by Sessions",
            definition: "The top 5 tests ordered by total number of sessions started.",
            formula: "Sorted by (Total Sessions Count) DESC",
            eligibility: ["All test sessions"]
          }}
        />
      </div>

      {selectedTest && <ScoreDistModal test={selectedTest} onClose={() => setSelectedTest(null)} />}

    </div>
  );
}
