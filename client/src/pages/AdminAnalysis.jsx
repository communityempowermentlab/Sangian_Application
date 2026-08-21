import './AdminAnalysis.css';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { GAME_CATALOG } from '../utils/reportExportUtils';
import { isOrgSession, isStaffSession, getAssignedTests } from '../utils/staffPermissions';
import OverviewV2Panel from './AdminAnalysisV2Panel';
import { downloadElementAsPdf } from '../utils/pdfExportUtils';
import KpiInfoIcon from '../components/KpiInfoIcon';
import { logReportDownload } from '../utils/logActivity';

// ── Constants ─────────────────────────────────────────────

// Per-game max scores (V2 games are config-driven: Lottery V2 = 23 questions, Ankganit V2 = 30)
const GAME_MAX_SCORES = {
  atlantis_bagiya: 108, number_recall_lottery: 22, number_recall_lottery_v2: 22,
  rover_mela: 44, auditory_dhyan: 33, working_memory_herpher: 25, working_memory_herpher_v2: 16,
  working_memory_herpher_v3: 25,
  numeracy_number_skill: 26, numeracy_number_skill_v2: 30, literacy_reading_skill: 22,
  literacy_reading_skill_v2: 4, // ASER adaptive flow: ordinal reading level 0-4 (Beginner..Story), not a point score
  numeracy_number_skill_v3: 4, // ASER adaptive flow: ordinal level 0-4 (Beginner..Division), not a point score
  cognitive_flex_chor: 57, triangle_rachna: 48,
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
  working_memory_herpher_v3: { field: 'score_herpher_v3',  sortId: 'herpher_v3' },
  numeracy_number_skill:     { field: 'score_ankganit',    sortId: 'ankganit' },
  numeracy_number_skill_v2:  { field: 'score_ankganit_v2', sortId: 'ankganit_v2' },
  numeracy_number_skill_v3:  { field: 'score_ankganit_v3', sortId: 'ankganit_v3' },
  literacy_reading_skill:    { field: 'score_reading',     sortId: 'reading' },
  literacy_reading_skill_v2: { field: 'score_reading_v2',  sortId: 'reading_v2' },
  cognitive_flex_chor:       { field: 'score_chor',        sortId: 'chor' },
  triangle_rachna:           { field: 'score_rachna',      sortId: 'rachna' },
};

const STATUS_COLORS = {
  completed: '#22c55e', in_progress: '#4f46e5',
  quit: '#f59e0b', dropped: '#ef4444', paused: '#8b5cf6',
};

const GENDER_COLORS  = { male: '#3b82f6', female: '#ec4899', other: '#8b5cf6', prefer_not_to_say: '#94a3b8', unknown: '#cbd5e1' };
const GENDER_LABELS  = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say', unknown: 'Unknown' };
const DIFFICULTY_COLORS = { Easy: '#22c55e', Moderate: '#f59e0b', Hard: '#ef4444' };

// Display-only labels for Her Pher question categories — purely cosmetic,
// not stored anywhere; falls back to the raw category key if unmapped.
const CATEGORY_NAMES = {
  item1: 'Fruits', item2: 'Vegetables', item3: 'Sports', item4: 'Cloth',
  item5: 'Kitchen', item6: 'Household', item7: 'Animal', item8: 'Transport',
  // Rachna tags each scored question with its own in-game key (question3..
  // question27) — labelled here as "Item N" to match the ordinal shown to
  // the child in-game (getQuestionTitle in TriangleRachnaGame.jsx).
  question3: 'Item 1',   question4: 'Item 2',   question6: 'Item 3',   question7: 'Item 4',
  question8: 'Item 5',   question9: 'Item 6',   question10: 'Item 7',  question11: 'Item 8',
  question12: 'Item 9',  question13: 'Item 10', question14: 'Item 11', question15: 'Item 12',
  question16: 'Item 13', question17: 'Item 14', question18: 'Item 15', question19: 'Item 16',
  question20: 'Item 17', question21: 'Item 18', question22: 'Item 19', question23: 'Item 20',
  question24: 'Item 21', question25: 'Item 22', question26: 'Item 23', question27: 'Item 24',
};

// Rachna's target-image filename doesn't always match the question key —
// question11/12 reuse the teaching_question11/12 art (see getTargetImageName
// in TriangleRachnaGame.jsx, which this mirrors).
function getRachnaTargetImage(category) {
  if (category === 'question11') return '/assets/images/rachna/teaching_question11.png';
  if (category === 'question12') return '/assets/images/rachna/teaching_question12.png';
  return `/assets/images/rachna/${category}.png`;
}

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

const EMPTY_FILTERS = { startDate: '', endDate: '', genders: [], statuses: [], childId: '', gameKeys: [], groupIds: [], ageGroups: [], attempts: [] };

// One chip per registration year (7-16) — each covers exactly one completed
// year of age (see AGE_YEARS/AGE_MAP in analysisController.js for the exact
// day-boundary definition this mirrors).
const AGE_CHIP_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const year = 7 + i;
  return { key: `${year}`, label: `${year}y`, color: '#f59e0b' };
});

// Attempt number is per-test (the Nth time a child played that specific
// test) — same meaning as the "Attempt" column on Top Active Children and
// the per-game Recent Sessions table. '6+' catches everything beyond, since
// per-game replay counts trail off fast in practice.
const ATTEMPT_CHIP_OPTIONS = [
  { key: '1',  label: 'Baseline (Visit 1)', color: '#0891b2' },
  { key: '2',  label: 'Retest (Visit 2)', color: '#0891b2' },
  { key: '3',  label: '3rd Attempt', color: '#0891b2' },
  { key: '4',  label: '4th Attempt', color: '#0891b2' },
  { key: '5',  label: '5th Attempt', color: '#0891b2' },
  { key: '6+', label: '6th+ Attempt', color: '#0891b2' },
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

// Mirrors exactly the columns the on-screen Question Category Breakdown
// table shows for this game (see the flags computed in GamePanel) so the
// export never claims data the table itself hides.
async function exportCategoryBreakdownExcel(categoryBreakdown, gameMeta, totalSessions, cols) {
  const { showTargetImageCol, showChildrenReachedCol, showCorrectnessMetrics } = cols;
  const XLSX = await import('xlsx');

  const headers = [
    'Rank', 'Category', 'Cat-Name',
    ...(showTargetImageCol ? ['Target Image URL'] : []),
    ...(showChildrenReachedCol ? ['Children Reached', '% Reached'] : []),
    'Difficulty', 'Avg Score',
    ...(showCorrectnessMetrics ? ['Avg Correct', 'Accuracy %', 'Miss Rate %', 'Perfect Rate %'] : []),
    'Avg Time (sec)',
  ];
  const rows = categoryBreakdown.map(row => [
    row.rank,
    row.category,
    CATEGORY_NAMES[row.category] || '—',
    ...(showTargetImageCol ? [`${window.location.origin}${getRachnaTargetImage(row.category)}`] : []),
    ...(showChildrenReachedCol ? [
      row.attempts,
      totalSessions > 0 ? Number(((row.attempts / totalSessions) * 100).toFixed(1)) : '',
    ] : []),
    row.difficulty,
    row.avgScore,
    ...(showCorrectnessMetrics ? [
      row.avgCorrectCount ?? '',
      row.accuracyPct ?? '',
      row.missRatePct ?? '',
      row.perfectRatePct ?? '',
    ] : []),
    row.avgTimeTakenSec ?? '',
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Category Breakdown');
  XLSX.writeFile(wb, `${(gameMeta.title || 'game').replace(/[^a-zA-Z0-9]/g, '_')}_category_breakdown.xlsx`);
}

// Renders elementId to a canvas for the image/PDF export buttons below.
// Captures a clone in an off-screen, unclipped wrapper rather than the live
// element — the live table sits in a horizontally-scrolling container
// (.ana-table-wrap { overflow-x: auto }), so capturing it in place would
// crop to whatever's currently scrolled into view instead of every column.
async function captureElementCanvas(elementId, headerLines = []) {
  const element = document.getElementById(elementId);
  if (!element) return null;
  const html2canvas = (await import('html2canvas')).default;

  const originalNodes = element.querySelectorAll('*');
  const clone = element.cloneNode(true);
  const cloneNodes = clone.querySelectorAll('*');
  cloneNodes.forEach((node, i) => {
    const cs = window.getComputedStyle(originalNodes[i]);
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') node.style.overflowX = 'visible';
    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') node.style.overflowY = 'visible';
  });
  clone.style.overflowX = 'visible';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed', 'top:-99999px', 'left:0',
    `width:${Math.max(element.scrollWidth, element.offsetWidth)}px`,
    'background:#ffffff', 'padding:16px',
    'z-index:-9999', 'pointer-events:none',
    'font-family:system-ui,-apple-system,sans-serif',
  ].join(';');

  // Search-parameter header — so a downloaded file is self-describing about
  // which date range/group/filters produced it, without needing the browser
  // tab it came from.
  if (headerLines.length > 0) {
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom:14px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;';
    header.innerHTML = headerLines.map((line, i) => {
      const size = i === 0 ? '16px' : '12.5px';
      const weight = i === 0 ? '700' : '500';
      const color = i === 0 ? '#0f172a' : '#475569';
      return `<div style="font-size:${size};font-weight:${weight};color:${color};margin-bottom:3px;">${line}</div>`;
    }).join('');
    wrapper.appendChild(header);
  }

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const canvas = await html2canvas(wrapper, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: wrapper.scrollWidth,
    windowHeight: wrapper.scrollHeight,
  });

  document.body.removeChild(wrapper);
  return canvas;
}

async function exportElementAsImage(elementId, filenameBase, headerLines = []) {
  const canvas = await captureElementCanvas(elementId, headerLines);
  if (!canvas) return;
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${filenameBase}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function exportElementAsPDF(elementId, filenameBase, headerLines = []) {
  const canvas = await captureElementCanvas(elementId, headerLines);
  if (!canvas) return;
  const { jsPDF } = await import('jspdf');
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  // Landscape, page sized to the table's own aspect ratio — these tables
  // run wide (many columns), so a fixed-aspect page would either crop
  // columns or leave large margins.
  const pdfWidth  = 297;
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  const pdf = new jsPDF('l', 'mm', [pdfWidth, pdfHeight]);
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${filenameBase}.pdf`);
}

async function exportChildrenExcel(children, catalog, filters) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Sheet 1 — one row per (child, attempt number), same as the on-screen table
  const headers = ['#', 'Child ID', 'Name', 'Attempt', 'Completed', 'Test',
                   ...catalog.map(g => `${g.title} (${GAME_MAX_SCORES[g.key] ?? '—'})`),
                   'Total Score', 'Total Time (mins)', 'Last Played'];
  const rows = children.map((c, i) => [
    i + 1,
    c.child_id || '',
    c.name || '',
    c.attemptNo ?? '',
    Number(c.completed) || 0,
    Number(c.testCount) || 0,
    ...catalog.map(g => {
      const v = c[CHILD_SCORE_COLS[g.key]?.field];
      return v != null ? Number(v) : '';
    }),
    Number(c.totalScore) || 0,
    c.totalTimeMins != null ? Number(c.totalTimeMins) : '',
    c.lastPlayed || '',
  ]);
  const summaryWs = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Sheet 2 — one row per individual session, across all tests, for these children
  const sessHeaders = ['Child ID', 'Name', 'Gender', 'Age', 'Test', 'Attempt No', 'Status', 'Quit Reason',
                       'Score', 'Progress (items reached)', 'Total Items', 'Duration (sec)', 'Start Time', 'End Time'];
  let sessRows = [];
  try {
    const childIds = [...new Set(children.map(c => c.child_id).filter(Boolean))].join(',');
    const { data } = await axiosAdmin.get('/analysis/children-sessions', {
      params: { ...buildApiParams(filters), childIds },
    });
    sessRows = (data.sessions || []).map(s => [
      s.child_id || '',
      s.childName || '',
      s.gender || '',
      s.age ?? '',
      s.gameTitle || s.gameKey || '',
      s.attemptNo ?? '',
      s.status || '',
      s.quit_reason || '',
      s.score ?? '',
      s.progress_level ?? '',
      s.total_questions ?? '',
      s.durationSec ?? '',
      s.start_time || '',
      s.end_time || '',
    ]);
  } catch (err) {
    console.error('Failed to fetch session-wise data for export:', err);
  }
  const sessionsWs = XLSX.utils.aoa_to_sheet([sessHeaders, ...sessRows]);
  XLSX.utils.book_append_sheet(wb, sessionsWs, 'Sessions');

  XLSX.writeFile(wb, 'top_active_children_export.xlsx');
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
  if (f.attempts?.length)  p.attempt  = f.attempts.join(',');
  return p;
}

function filtersEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Rebuilds a filters object from the URL's query string — the exact inverse
// of buildApiParams — so a refresh (or a shared/bookmarked link) restores
// whatever was applied instead of resetting to defaults. dateDefaults only
// fills in startDate/endDate when the URL doesn't already have them.
function filtersFromSearchParams(sp, dateDefaults) {
  const splitList = (key) => { const v = sp.get(key); return v ? v.split(',').filter(Boolean) : []; };
  return {
    startDate: sp.get('startDate') || dateDefaults.startDate,
    endDate:   sp.get('endDate')   || dateDefaults.endDate,
    genders:   splitList('gender'),
    statuses:  splitList('status'),
    childId:   sp.get('childId') || '',
    gameKeys:  splitList('gameKey'),
    groupIds:  splitList('groupId'),
    ageGroups: splitList('ageGroup'),
    attempts:  splitList('attempt'),
  };
}

// Human-readable filter summary for the Image/PDF exports — a downloaded
// file should be self-describing about which search parameters produced it,
// since it can end up shared or archived away from the browser tab it came
// from. Returns an array of lines (title, filter summary, generated-at).
function buildFilterSummaryLines(title, filters, groupOptions = []) {
  const dateRange = filters?.startDate && filters?.endDate
    ? `${filters.startDate} to ${filters.endDate}`
    : 'All time';
  const groupLabel = (filters?.groupIds || [])
    .map(id => groupOptions.find(g => String(g.id) === String(id))?.name)
    .filter(Boolean).join(', ') || 'All';
  const genderLabel = (filters?.genders || []).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ') || 'All';
  const ageLabel = (filters?.ageGroups || []).join(', ') || 'All';
  const statusLabel = (filters?.statuses || [])
    .map(s => STATUS_CHIP_OPTIONS.find(o => o.key === s)?.label || s).join(', ') || 'All';
  const attemptLabel = (filters?.attempts || [])
    .map(a => ATTEMPT_CHIP_OPTIONS.find(o => o.key === a)?.label || a).join(', ') || 'All';

  const parts = [
    `Date Range: ${dateRange}`,
    `Group: ${groupLabel}`,
    `Gender: ${genderLabel}`,
    `Age: ${ageLabel}`,
    `Status: ${statusLabel}`,
    `Attempt: ${attemptLabel}`,
  ];
  if (filters?.childId?.trim()) parts.push(`Child ID: ${filters.childId.trim()}`);

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  }).replace(/am|pm/g, m => m.toUpperCase());

  return [title, parts.join('   •   '), `Generated: ${generatedAt}`];
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

function HBar({ label, value, maxValue, color, badge, labelWidth, title }) {
  const pct = maxValue > 0 ? Math.min(Math.round((value / maxValue) * 100), 100) : 0;
  return (
    <div className="ana-hbar-row">
      <div className="ana-hbar-label" style={labelWidth ? { flex: `0 0 ${labelWidth}px` } : undefined}>
        {label}
        {title && <span className="ana-hbar-hint" title={title}>ⓘ</span>}
      </div>
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

function KpiCard({ icon, label, value, sub, color = '#4f46e5', info, showKpiInfoIcon }) {
  return (
    <div className="ana-kpi-card">
      <div className="ana-kpi-icon" style={{ background: `${color}1a`, color }}>{icon}</div>
      <div className="ana-kpi-body">
        <div className="ana-kpi-val" style={{ color }}>{value ?? '—'}</div>
        <div className="ana-kpi-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {showKpiInfoIcon && info && <KpiInfoIcon {...info} />}
        </div>
        {sub && <div className="ana-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Card({ title, children, noPad, stretch, info, showKpiInfoIcon }) {
  return (
    <div className={`ana-card${stretch ? ' ana-card--stretch' : ''}`}>
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

function SkeletonCard() {
  return <div className="ana-skeleton-card"><div className="ana-skeleton-pulse" /></div>;
}

// ── Overview Panel ────────────────────────────────────────

function OverviewPanel({ data, loading, filters, catalog = GAME_CATALOG, excelExportEnabled = true, showKpiInfoIcon }) {
  // Default view follows the Settings → Test Configuration → Test Visibility
  // drag-and-drop sequence (see testOrderPos below); users may still click
  // any column to sort by that metric instead.
  const [sortKey, setSortKey] = React.useState('game');
  const [sortDir, setSortDir] = React.useState('asc');
  const [childSortKey, setChildSortKey] = React.useState('attempt');
  const [childSortDir, setChildSortDir] = React.useState('desc');

  const [childrenData, setChildrenData] = React.useState([]);
  const [childrenPage, setChildrenPage] = React.useState(0);
  const [loadingChildren, setLoadingChildren] = React.useState(false);
  const [hasMoreChildren, setHasMoreChildren] = React.useState(true);
  const [exportingChildren, setExportingChildren] = React.useState(false);

  const handleExportChildren = async () => {
    setExportingChildren(true);
    try {
      await exportChildrenExcel(childrenData, catalog, filters);
      logReportDownload({
        module: 'analysis', menuName: 'Analysis', pageName: 'Children Overview',
        reportName: 'Children Overview', reportType: 'children', format: 'Excel',
        filters, dateRangeStart: filters?.startDate, dateRangeEnd: filters?.endDate,
      });
    } finally {
      setExportingChildren(false);
    }
  };

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

  // Settings → Test Configuration → Test Visibility drag-and-drop order —
  // `catalog` is already sorted that way by the parent (orderedCatalog), so
  // its index doubles as the display-sequence position for every game.
  const testOrderPos = new Map(catalog.map((c, i) => [c.key, i]));
  const byGameOrdered = [...byGame].sort((a, b) => (testOrderPos.get(a.gameKey) ?? 999) - (testOrderPos.get(b.gameKey) ?? 999));

  const SORT_FIELDS = {
    game:       g => testOrderPos.get(g.gameKey) ?? 999,
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
        <KpiCard 
          icon="🎮" 
          label="Total Assessments"
          value={fmt(kpis.totalSessions)}
          color="#4f46e5"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Total Assessments",
            definition: "Total number of test sessions started by eligible children.",
            formula: "Count of all test sessions",
            eligibility: ["Matches all selected filters (Date, Age, Gender, Group)"]
          }}
        />
        <KpiCard 
          icon="👦" 
          label="Participants Assessed"
          value={fmt(kpis.uniqueChildren)}
          color="#0891b2"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Participants Assessed",
            definition: "Total number of distinct children who started at least one test.",
            formula: "Count of distinct child IDs",
            eligibility: ["Child has at least one session matching the selected filters"]
          }}
        />
        <KpiCard 
          icon="✅" 
          label="Completion Rate" 
          value={`${fmt(kpis.completionRate)}%`} 
          sub={`${fmt(kpis.completedSessions)} completed`} 
          color="#22c55e"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Completion Rate",
            definition: "Percentage of started sessions that were successfully completed.",
            formula: "(Completed Sessions ÷ Total Sessions) × 100",
            eligibility: ["Matches all selected filters"]
          }}
        />
        <KpiCard 
          icon="📊" 
          label="Avg Score"       
          value={fmt(kpis.avgScore, 1)} 
          sub="across all tests" 
          color="#7c3aed"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Average Score",
            definition: "Average absolute score achieved across all completed tests.",
            formula: "Total Score Achieved ÷ Number of Completed Sessions",
            eligibility: ["Only COMPLETED sessions are included"]
          }}
        />
        <KpiCard
          icon="⏱️"
          label="Avg Duration"
          value={kpis.avgDurationMins ? `${fmt(kpis.avgDurationMins, 1)} min` : '—'}
          color="#f59e0b"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Average Duration",
            definition: "Average active time taken to complete a test session.",
            formula: "Sum of timerSeconds of completed tests ÷ Number of completed tests",
            eligibility: ["Only COMPLETED sessions are included"]
          }}
        />
        <KpiCard
          icon="🎯"
          label="Mean Score"
          value={fmt(kpis.meanScoreAll, 1)}
          sub="across all tests"
          color="#14b8a6"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Mean Score",
            definition: "Mean absolute score achieved, averaged across every test in the study — incomplete sessions count as 0.",
            formula: "Sum of Scores of ALL Sessions ÷ Total Number of Sessions",
            eligibility: ["ALL sessions are included, not just completed ones", "Matches all selected filters (Date, Age, Gender, Group)"]
          }}
        />
        <KpiCard
          icon="⏳"
          label="Mean Assessment Duration"
          value={kpis.meanDurationAllMins ? `${fmt(kpis.meanDurationAllMins, 1)} min` : '—'}
          sub="across all tests"
          color="#0ea5e9"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Mean Assessment Duration",
            definition: "Mean active time taken per test, averaged across every test in the study — incomplete sessions count as 0.",
            formula: "Sum of Durations of ALL Sessions ÷ Total Number of Sessions",
            eligibility: ["ALL sessions are included, not just completed ones", "Matches all selected filters (Date, Age, Gender, Group)"]
          }}
        />
        <KpiCard
          icon="📐"
          label="Median Score"
          value={fmt(kpis.medianScore, 1)}
          sub="middle value, across all tests"
          color="#a855f7"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Median Score",
            definition: "The middle score when every completed test's score is sorted from lowest to highest — less skewed by outliers than the mean.",
            formula: "Middle value of sorted scores (average of the two middle values if the count is even)",
            eligibility: ["Only sessions with a recorded score are included", "Matches all selected filters (Date, Age, Gender, Group)"]
          }}
        />
        <KpiCard
          icon="📏"
          label="SD of Score"
          value={fmt(kpis.sdScore, 1)}
          sub="spread of scores, across all tests"
          color="#f43f5e"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Standard Deviation of Score",
            definition: "How much individual scores typically vary from the average — a low value means scores cluster tightly around the mean, a high value means they're spread out.",
            formula: "Population standard deviation of all recorded scores: √(Σ(score − mean)² ÷ N)",
            eligibility: ["Only sessions with a recorded score are included", "Matches all selected filters (Date, Age, Gender, Group)"]
          }}
        />
      </div>

      <div className="ana-grid-2">
        <Card
          title="Assessments by Test"
          stretch
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Assessments by Test",
            definition: "Number of test sessions started for each game.",
            formula: "Count of test sessions grouped by test",
            eligibility: ["Matches all selected filters"]
          }}
        >
          <div className="ana-hbar-list">
            {byGame.length === 0
              ? <div className="ana-chart-empty">No test data for selected filters</div>
              : byGameOrdered.map(g => {
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
          <Card title="Assessment Status">
            {statusSegs.length === 0
              ? <div className="ana-card-body"><div className="ana-chart-empty">No status data</div></div>
              : <div className="ana-donut-row">
                  <DonutChart segments={statusSegs} size={100} centerLabel={fmt(kpis.totalSessions)} centerSub="total" />
                  <Legend items={statusSegs} />
                </div>
            }
          </Card>
          <Card title="Participant Sex wise Distribution">
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

      <Card title="Participant Assessment Progress">
        <div className={loading ? 'ana-faded' : ''}>
          <TrendLine data={dailyTrend} valueKey="sessions" color="#4f46e5" secondKey="completed" secondColor="#22c55e" primaryLabel="Total Assessments" secondaryLabel="Completed Assessments" />
          <TrendLabels data={dailyTrend} />
          <div className="ana-trend-legend">
            <span><span className="ana-dot" style={{ background: '#4f46e5' }} /> Total Assessments</span>
            <span><span className="ana-dot ana-dot-dash" style={{ background: '#22c55e' }} /> Completed Assessments</span>
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

      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', width: '100%' }}>
            <span>Top Active Children{childrenData.length ? ` (${childrenData.length} loaded)` : ''}</span>
            {excelExportEnabled && childrenData.length > 0 && (
              <button className="ana-btn" data-pdf-ignore="true" style={{ fontSize: '12px' }} onClick={handleExportChildren} disabled={exportingChildren}>
                {exportingChildren ? '⏳ Exporting…' : '📥 Export Excel'}
              </button>
            )}
          </span>
        }
        noPad
      >
        <div className="ana-table-wrap">
          <table className="ana-table ana-table-bordered">
            <thead><tr>
              <th>#</th>
              <SortThChild label="Child ID" sortId="childId" />
              <SortThChild label="Name" sortId="name" />
              <SortThChild label="Attempt" sortId="attempt" />
              <SortThChild label="Completed" sortId="completed" />
              <SortThChild label="Test" sortId="testCount" />
              {catalog.map(g => (
                <SortThChild key={g.key} label={`${g.title} (${GAME_MAX_SCORES[g.key] ?? '—'})`} sortId={CHILD_SCORE_COLS[g.key]?.sortId} />
              ))}
              <SortThChild label="Total Score" sortId="totalScore" />
              <SortThChild label="Total Time" sortId="totalTime" />
              <SortThChild label="Last Played" sortId="lastPlayed" />
            </tr></thead>
            <tbody>
              {childrenData.map((c, i) => (
                <tr key={`${c.child_id}-${c.attemptNo ?? 'x'}-${i}`}>
                  <td><span className="ana-rank">{i + 1}</span></td>
                  <td><code>{c.child_id}</code></td>
                  <td>{c.name || '—'}</td>
                  <td title={`Attempt #${c.attemptNo} — the ${c.attemptNo === 1 ? '1st' : c.attemptNo === 2 ? '2nd' : c.attemptNo === 3 ? '3rd' : `${c.attemptNo}th`} time this child played each test grouped in this row`}>
                    #{c.attemptNo}
                  </td>
                  <td>{fmt(c.completed)}</td>
                  <td>{fmt(c.testCount)}</td>
                  {catalog.map(g => (
                    <td key={g.key}>{fmt(c[CHILD_SCORE_COLS[g.key]?.field], 1)}</td>
                  ))}
                  <td>{fmt(c.totalScore)}</td>
                  <td>{formatHoursMins(c.totalTimeMins)}</td>
                  <td>{formatDate(c.lastPlayed)}</td>
                </tr>
              ))}
              {childrenData.length === 0 && !loadingChildren && <tr><td colSpan={9 + GAME_CATALOG.length} className="ana-table-empty">No children data</td></tr>}
              {loadingChildren && <tr><td colSpan={9 + GAME_CATALOG.length} className="ana-table-empty">Loading...</td></tr>}
            </tbody>
          </table>
          {hasMoreChildren && !loadingChildren && childrenData.length > 0 && (
            <div style={{ textAlign: 'center', padding: '15px' }} data-pdf-ignore="true">
              <button className="ana-btn" onClick={() => setChildrenPage(p => p + 1)}>Load More</button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Game Panel ────────────────────────────────────────────

function GamePanel({ gameMeta, gameKey, data, loading, filters, showKpiInfoIcon, csvExportEnabled = true, groupOptions = [] }) {
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
    attemptBuckets = {}, categoryBreakdown = [],
  } = data;

  // scoreDist is an ordered array of [label, count, description?] tuples from the
  // API — not a plain object, since JS would otherwise reorder pure-integer-looking
  // keys (e.g. "21") ahead of range keys (e.g. "1-10"), scrambling bucket order.
  const scoreEntries   = scoreDist || [];
  // Named-level games (e.g. Padh ke Batao V2's Beginner/Letters/Word/.../Story) get
  // a wider label column so the level name doesn't wrap/clip like a bare number would.
  const scoreHasNamedLevels = scoreEntries.some(([label]) => isNaN(Number(label)));
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
  const maxCategoryScore = Math.max(...categoryBreakdown.map(c => Number(c.avgScore) || 0), 0.01);
  const showChildrenReachedCol = gameKey === 'working_memory_herpher_v2' || gameKey === 'triangle_rachna';
  const showTargetImageCol = gameKey === 'triangle_rachna';
  // Avg Correct / Miss Rate / Perfect Rate info-icon tooltips describe the
  // image-matching mechanic (correctCount/missedImages/incorrectSelections)
  // that only Her Pher V2 has — Rachna's own columns are always '—', so its
  // Children Reached column shouldn't also turn on those unrelated icons.
  const showHerPherV2InfoIcons = gameKey === 'working_memory_herpher_v2';
  // Avg Correct/Accuracy/Miss Rate/Perfect Rate only mean anything for games
  // whose allScores[] entries carry correctCount/expectedImages/etc (Her
  // Pher's image-matching mechanic) — data-driven so it hides itself for any
  // future category-breakdown game (like Rachna) that doesn't have it,
  // instead of hardcoding a gameKey list that can go stale.
  const showCorrectnessMetrics = categoryBreakdown.some(r =>
    r.avgCorrectCount != null || r.accuracyPct != null || r.missRatePct != null || r.perfectRatePct != null
  );

  return (
    <div className="ana-content">
      <div className="ana-kpi-row">
        <KpiCard
          icon="👦"
          label="Children Assessed"
          value={fmt(kpis.uniqueChildren)}
          color="#0891b2"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Children Assessed",
            definition: "Total number of distinct children who started this game.",
            formula: "Count of distinct child IDs",
            eligibility: ["Child has at least one session matching the selected filters"]
          }}
        />
        <KpiCard
          icon="🎮"
          label="Total Assessments"
          value={fmt(kpis.totalSessions)}
          color={gameMeta.color}
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Total Assessments",
            definition: "Total number of test sessions started for this specific game.",
            formula: "Count of all test sessions",
            eligibility: ["Matches all selected filters"]
          }}
        />
        <KpiCard
          icon="✅"
          label="Completion Rate"
          value={`${kpis.completionRate ?? 0}%`}
          sub={`${fmt(kpis.completedSessions)} Tests`}
          color="#22c55e"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Completion Rate",
            definition: "Percentage of started sessions that were successfully completed.",
            formula: "(Completed Sessions ÷ Total Sessions) × 100",
            eligibility: ["Matches all selected filters"]
          }}
        />
        <KpiCard 
          icon="📊" 
          label="Avg Score"       
          value={fmt(kpis.avgScore, 1)} 
          sub={`${kpis.avgScorePct ?? 0}% of max (${data.meta?.maxScore})`} 
          color="#7c3aed" 
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Average Score",
            definition: `Average score achieved by children on ${gameMeta.title}.`,
            formula: "Total Score Achieved ÷ Number of Completed Sessions",
            eligibility: ["Only COMPLETED sessions are included"]
          }}
        />
        <KpiCard
          icon="⏱️"
          label="Avg Duration"
          value={kpis.avgDurationMins ? `${fmt(kpis.avgDurationMins, 1)} min` : '—'}
          color="#f59e0b"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Average Duration",
            definition: "Average active time taken to complete this game.",
            formula: "Sum of timerSeconds of completed tests ÷ Number of completed tests",
            eligibility: ["Only COMPLETED sessions are included"]
          }}
        />
        <KpiCard
          icon="🎯"
          label="Mean Score"
          value={fmt(kpis.meanScoreAll, 1)}
          sub="across all tests"
          color="#14b8a6"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Mean Score",
            definition: `Mean score achieved by children on ${gameMeta.title}, averaged across every test — incomplete sessions count as 0.`,
            formula: "Sum of Scores of ALL Sessions ÷ Total Number of Sessions",
            eligibility: ["ALL sessions are included, not just completed ones", "Matches all selected filters"]
          }}
        />
        <KpiCard
          icon="⏳"
          label="Mean Assessment Duration"
          value={kpis.meanDurationAllMins ? `${fmt(kpis.meanDurationAllMins, 1)} min` : '—'}
          sub="across all tests"
          color="#0ea5e9"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Mean Assessment Duration",
            definition: `Mean active time taken per test of ${gameMeta.title}, averaged across every test — incomplete sessions count as 0.`,
            formula: "Sum of Durations of ALL Sessions ÷ Total Number of Sessions",
            eligibility: ["ALL sessions are included, not just completed ones", "Matches all selected filters"]
          }}
        />
        <KpiCard
          icon="📐"
          label="Median Score"
          value={fmt(kpis.medianScore, 1)}
          sub="middle value, across all tests"
          color="#a855f7"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Median Score",
            definition: `The middle score when every completed ${gameMeta.title} session's score is sorted from lowest to highest — less skewed by outliers than the mean.`,
            formula: "Middle value of sorted scores (average of the two middle values if the count is even)",
            eligibility: ["Only sessions with a recorded score are included", "Matches all selected filters"]
          }}
        />
        <KpiCard
          icon="📏"
          label="SD of Score"
          value={fmt(kpis.sdScore, 1)}
          sub="spread of scores, across all tests"
          color="#f43f5e"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Standard Deviation of Score",
            definition: `How much individual scores on ${gameMeta.title} typically vary from the average — a low value means scores cluster tightly around the mean, a high value means they're spread out.`,
            formula: "Population standard deviation of all recorded scores: √(Σ(score − mean)² ÷ N)",
            eligibility: ["Only sessions with a recorded score are included", "Matches all selected filters"]
          }}
        />
      </div>

      <div className="ana-grid-3">
        <Card
          title={['literacy_reading_skill_v2', 'numeracy_number_skill_v3'].includes(gameKey) ? 'Level Wise Distribution' : 'Score Distribution'}
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Score Distribution",
            definition: "Count of sessions falling into different percentage score buckets.",
            formula: "Grouped by buckets (e.g. 90-100%, 80-89%)",
            eligibility: ["Only COMPLETED sessions are included"]
          }}
        >
          <div className="ana-hbar-list">
            {totalScored === 0
              ? <div className="ana-chart-empty">No scored sessions for selected filters</div>
              : <>
                  {scoreEntries.map(([range, count, description]) => (
                    <HBar key={range} label={range} value={Number(count)} maxValue={maxScoreCount} color={gameMeta.color}
                      labelWidth={scoreHasNamedLevels ? 92 : 56}
                      title={description}
                      badge={`${Math.round((Number(count) / totalScored) * 100)}%`} />
                  ))}
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    {totalScored} scored session{totalScored === 1 ? '' : 's'} — includes partial scores of dropped / quit sessions
                  </div>
                </>
            }
          </div>
        </Card>

        <Card 
          title="Session Status"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Session Status",
            definition: "Breakdown of sessions by their final status.",
            formula: "Count of sessions grouped by Status (completed, quit, etc.)",
            eligibility: ["Matches all selected filters"]
          }}
        >
          {statusSegs.length === 0
            ? <div className="ana-card-body"><div className="ana-chart-empty">No data</div></div>
            : <div className="ana-donut-row">
                <DonutChart segments={statusSegs} size={90} centerLabel={`${kpis.completionRate ?? 0}%`} centerSub="done" />
                <Legend items={statusSegs} />
              </div>
          }
        </Card>

        <Card 
          title="Gender Breakdown"
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Gender Breakdown",
            definition: "Distribution of test sessions by gender.",
            formula: "Count of test sessions grouped by gender",
            eligibility: ["Matches all selected filters"]
          }}
        >
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

      <Card title="Participant Assessment Progress">
        <div className={loading ? 'ana-faded' : ''}>
          <TrendLine data={dailyTrend} valueKey="sessions" color={gameMeta.color} secondKey="completed" secondColor="#22c55e" primaryLabel="Total Assessments" secondaryLabel="Completed Assessments" />
          <TrendLabels data={dailyTrend} />
          <div className="ana-trend-legend">
            <span><span className="ana-dot" style={{ background: gameMeta.color }} /> Total Assessments</span>
            <span><span className="ana-dot ana-dot-dash" style={{ background: '#22c55e' }} /> Completed Assessments</span>
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

      {categoryBreakdown.length > 0 && (
        <Card
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', width: '100%' }}>
              <span>Question Category Breakdown</span>
              {csvExportEnabled && (
                <span style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="ana-btn"
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      exportCategoryBreakdownExcel(categoryBreakdown, gameMeta, kpis.totalSessions, {
                        showTargetImageCol, showChildrenReachedCol, showCorrectnessMetrics,
                      });
                      logReportDownload({
                        module: 'analysis', menuName: 'Analysis', pageName: `${gameMeta.title || 'Game'} — Category Breakdown`,
                        reportName: 'Question Category Breakdown', reportType: gameMeta.key, format: 'Excel',
                        filters, dateRangeStart: filters?.startDate, dateRangeEnd: filters?.endDate,
                      });
                    }}
                  >
                    📥 Export Excel
                  </button>
                  <button
                    className="ana-btn"
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      exportElementAsImage(
                        'category-breakdown-table',
                        `${(gameMeta.title || 'game').replace(/[^a-zA-Z0-9]/g, '_')}_category_breakdown`,
                        buildFilterSummaryLines(`${gameMeta.title || 'Game'} — Question Category Breakdown`, filters, groupOptions)
                      );
                      logReportDownload({
                        module: 'analysis', menuName: 'Analysis', pageName: `${gameMeta.title || 'Game'} — Category Breakdown`,
                        reportName: 'Question Category Breakdown', reportType: gameMeta.key, format: 'Image',
                        filters, dateRangeStart: filters?.startDate, dateRangeEnd: filters?.endDate,
                      });
                    }}
                  >
                    🖼️ Export Image
                  </button>
                  <button
                    className="ana-btn"
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      exportElementAsPDF(
                        'category-breakdown-table',
                        `${(gameMeta.title || 'game').replace(/[^a-zA-Z0-9]/g, '_')}_category_breakdown`,
                        buildFilterSummaryLines(`${gameMeta.title || 'Game'} — Question Category Breakdown`, filters, groupOptions)
                      );
                      logReportDownload({
                        module: 'analysis', menuName: 'Analysis', pageName: `${gameMeta.title || 'Game'} — Category Breakdown`,
                        reportName: 'Question Category Breakdown', reportType: gameMeta.key, format: 'PDF',
                        filters, dateRangeStart: filters?.startDate, dateRangeEnd: filters?.endDate,
                      });
                    }}
                  >
                    📄 Export PDF
                  </button>
                </span>
              )}
            </span>
          }
          showKpiInfoIcon={showKpiInfoIcon}
          info={{
            name: "Question Category Breakdown",
            definition: "Per-question performance across the game's question categories, ranked from easiest to hardest.",
            formula: "Children Reached = number of sessions (matching all filters) that completed this question — naturally decreases for later questions since some children quit or auto-stop before reaching them. % Reached = Children Reached ÷ Total Tests (the game's total session count for the same filters) × 100. Avg Score = mean per-question score across those sessions. Miss Rate = missed images ÷ expected images, summed across attempts. Perfect Rate = share of attempts with a flawless match (0 missed, 0 incorrect). Difficulty tier = position-based thirds by avg score.",
            eligibility: ["Matches all selected filters", "Only available for games with per-question category data (Her Pher, Rachna)"]
          }}
          noPad
        >
          <div className="ana-table-wrap" id="category-breakdown-table">
            <table className="ana-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Category</th>
                  <th>Cat-Name</th>
                  {showTargetImageCol && <th>Target Image</th>}
                  {showChildrenReachedCol && <th>Children Reached</th>}
                  {showChildrenReachedCol && <th>% Reached</th>}
                  <th>Difficulty</th>
                  <th>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Avg Score
                      {showKpiInfoIcon && (
                      <KpiInfoIcon
                        name="Avg Score (per category)"
                        definition="The average number of POINTS children earned on this question category, across every session matching your current filters (date range, group, age group, gender, status, attempt number). This is NOT a percentage of correct answers — see Important Notes below."
                        formula="Avg Score = (sum of the score each session earned on this category) ÷ (number of sessions that reached & completed this category). Each session contributes at most one score per category — the practice round (item0) is always excluded, and a session only counts toward a category if it actually got that far before ending (whether finished, quit, or auto-stopped)."
                        dataSource="game_sessions.saved_state.allScores[] — one JSON entry per scored question, unnested and grouped by category"
                        example={[
                          "Illustrative only — not this page's live numbers:",
                          "5 sessions reach this category and score 2, 1, 2, 0, 2 (each score is always a whole number).",
                          "Sum = 2+1+2+0+2 = 7. Count = 5.",
                          "Avg Score = 7 ÷ 5 = 1.40",
                        ]}
                        notes="Score ≠ accuracy: the game awards points in coarse tiers, not proportionally to correct clicks. E.g. on V2's Item 1 (10 images), getting 10/10, 9/10, or 8/10 correct all earn the same 2 points — only 7/10 drops to 1 point, and 6/10 or below scores 0. So a child scoring 8/10 and a child scoring 10/10 can show identical Avg Scores here. For the actual % of images matched correctly, see the 'Accuracy %' column instead — that's a true percentage. Max points per category also isn't the same for every game: it's a flat 2 for every category on V2, but ranges 2–4 on V1 depending on the question (later questions are worth more). Attempt counts naturally shrink for later categories — children who quit or got auto-stopped earlier in the sequence never reach them — so compare averages alongside the attempt/reach count, not in isolation."
                      />
                      )}
                    </span>
                  </th>
                  {showCorrectnessMetrics && (
                  <th>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Avg Correct
                      {showKpiInfoIcon && showHerPherV2InfoIcons && (
                        <KpiInfoIcon
                          name="Avg Correct (per category)"
                          definition="The average number of distinct images children correctly matched on this category, out of that question's expected set — pooled across every session matching your current filters. This is a raw match count, not a score or a percentage."
                          formula="Avg Correct = AVG(correctCount) = (sum of every reaching session's correctCount) ÷ (count of those sessions). correctCount is always a whole number, so the sum going into this average is always a whole number too — only the final average can come out fractional."
                          dataSource="game_sessions.saved_state.allScores[].correctCount — one whole-number value per session, averaged per category"
                          example={[
                            "Illustrative only — not this page's live numbers:",
                            "70 sessions reach a category; correctCount sum = 542 (a whole number).",
                            "Avg Correct = 542 ÷ 70 = 7.74",
                          ]}
                          notes="Avg Correct ÷ that question's expected-image count = the same figure as Accuracy %, just expressed as a raw count instead of a percentage."
                        />
                      )}
                    </span>
                  </th>
                  )}
                  {showCorrectnessMetrics && (
                  <th>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Accuracy %
                      {showKpiInfoIcon && (
                      <KpiInfoIcon
                        name="Accuracy % (per category)"
                        definition="What share of the images children were actually expected to find on this category, they correctly matched — pooled across every session matching your current filters. This is a plain accuracy percentage, unlike Avg Score (which is the game's own tiered point score, not a percentage)."
                        formula="Accuracy % = (sum of correctCount across every session that reached this category) ÷ (sum of each of those sessions' expected-image count) × 100. Using each session's own expected-image count (rather than a single fixed number) keeps this correct even though the max images per category differs — e.g. 6 on V1's easiest question vs 14 on V3's hardest."
                        dataSource="game_sessions.saved_state.allScores[].correctCount and .expectedImages[] — summed, then divided, across all reaching sessions"
                        example={[
                          "Illustrative only — not this page's live numbers:",
                          "3 sessions reach a 10-image category and get 8, 9, and 6 correct.",
                          "Total correct = 8+9+6 = 23. Total possible = 3 × 10 = 30.",
                          "Accuracy % = 23 ÷ 30 × 100 = 76.7%",
                        ]}
                        notes="This is the same number as 100% − Miss Rate (both are derived from correct vs. expected images), so the two columns should always agree."
                      />
                      )}
                    </span>
                  </th>
                  )}
                  {showCorrectnessMetrics && (
                  <th>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Miss Rate
                      {showKpiInfoIcon && showHerPherV2InfoIcons && (
                        <KpiInfoIcon
                          name="Miss Rate (per category)"
                          definition="What share of the images children were expected to find on this category, they never matched at all — pooled across every session matching your current filters. This is the exact mirror of Accuracy %: Miss Rate = 100% − Accuracy %, always."
                          formula="Miss Rate = (sum of missed-image counts across every session that reached this category) ÷ (sum of each of those sessions' expected-image count) × 100."
                          dataSource="game_sessions.saved_state.allScores[].missedImages[] and .expectedImages[] — summed, then divided, across all reaching sessions"
                          example={[
                            "Illustrative only — not this page's live numbers:",
                            "5 sessions reach a 10-image category with missed counts: 0, 1, 0, 2, 0.",
                            "Total missed = 0+1+0+2+0 = 3. Total expected = 5 × 10 = 50.",
                            "Miss Rate = 3 ÷ 50 × 100 = 6.0%",
                          ]}
                          notes="This is an image-level rate, not a session-level one — a session that missed just 1 of 10 images barely moves this number, even though it wasn't a perfect run. See Perfect Rate for the session-level view."
                        />
                      )}
                    </span>
                  </th>
                  )}
                  {showCorrectnessMetrics && (
                  <th>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Perfect Rate
                      {showKpiInfoIcon && showHerPherV2InfoIcons && (
                        <KpiInfoIcon
                          name="Perfect Rate (per category)"
                          definition="What share of the SESSIONS that reached this category had a completely flawless run — zero missed images AND zero duplicate/incorrect clicks. Unlike Miss Rate and Accuracy %, this counts whole sessions, not individual images."
                          formula="Perfect Rate = (count of sessions with 0 missed images AND 0 incorrect selections) ÷ (count of sessions that reached this category) × 100."
                          dataSource="game_sessions.saved_state.allScores[].missedImages[] and .incorrectSelections[] — one pass/fail flag per session, then counted"
                          example={[
                            "Illustrative only — not this page's live numbers:",
                            "5 sessions reach a category; 2 have 0 missed and 0 duplicates, 3 don't.",
                            "Perfect Rate = 2 ÷ 5 × 100 = 40.0%",
                          ]}
                          notes="A session that gets 9 out of 10 images right still counts as a zero here, even though it barely affects Miss Rate — that's why Perfect Rate is often much lower than (100% − Miss Rate) would suggest."
                        />
                      )}
                    </span>
                  </th>
                  )}
                  <th>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map(row => (
                  <tr key={row.category}>
                    <td><span className="ana-rank">{row.rank}</span></td>
                    <td style={{ fontWeight: 600 }}>{row.category}</td>
                    <td>{CATEGORY_NAMES[row.category] || '—'}</td>
                    {showTargetImageCol && (
                      <td>
                        <a href={getRachnaTargetImage(row.category)} target="_blank" rel="noreferrer">
                          <img
                            src={getRachnaTargetImage(row.category)}
                            alt={CATEGORY_NAMES[row.category] || row.category}
                            style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'zoom-in' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </a>
                      </td>
                    )}
                    {showChildrenReachedCol && <td style={{ fontWeight: 600 }}>{fmt(row.attempts)}</td>}
                    {showChildrenReachedCol && (
                      <td>{kpis.totalSessions > 0 ? `${((row.attempts / kpis.totalSessions) * 100).toFixed(1)}%` : '—'}</td>
                    )}
                    <td>
                      <span
                        className="ana-status-pill"
                        style={{ background: `${DIFFICULTY_COLORS[row.difficulty]}22`, color: DIFFICULTY_COLORS[row.difficulty] }}
                      >
                        {row.difficulty}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="ana-hbar-track" style={{ width: '64px' }}>
                          <div
                            className="ana-hbar-fill"
                            style={{ width: `${Math.round((row.avgScore / maxCategoryScore) * 100)}%`, background: gameMeta.color }}
                          />
                        </div>
                        <span>{fmt(row.avgScore, 2)}</span>
                      </div>
                    </td>
                    {showCorrectnessMetrics && <td>{fmt(row.avgCorrectCount, 2)}</td>}
                    {showCorrectnessMetrics && <td>{row.accuracyPct != null ? `${row.accuracyPct}%` : '—'}</td>}
                    {showCorrectnessMetrics && <td>{row.missRatePct != null ? `${row.missRatePct}%` : '—'}</td>}
                    {showCorrectnessMetrics && <td>{row.perfectRatePct != null ? `${row.perfectRatePct}%` : '—'}</td>}
                    <td>{row.avgTimeTakenSec != null ? `${fmt(row.avgTimeTakenSec, 1)}s` : '—'}</td>
                  </tr>
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
            {csvExportEnabled && sessions.length > 0 && (
              <button className="ana-btn" style={{ fontSize: '12px' }} onClick={() => {
                exportSessionsCSV(sessions, gameMeta, maxGameScore);
                logReportDownload({
                  module: 'analysis', menuName: 'Analysis', pageName: `${gameMeta.title || 'Game'} — Recent Sessions`,
                  reportName: 'Recent Sessions', reportType: gameMeta.key, format: 'CSV',
                  filters, dateRangeStart: filters?.startDate, dateRangeEnd: filters?.endDate,
                });
              }}>
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

function FilterBar({ pending, onChange, onApply, onReset, meta, activeTab, hasChanges, loading, groupOptions, catalog = GAME_CATALOG, testGroups = [] }) {
  const toggle = (key, val) => onChange(prev => ({
    ...prev,
    [key]: prev[key].includes(val) ? prev[key].filter(x => x !== val) : [...prev[key], val],
  }));

  return (
    <div className="ana-filter-panel">
      <div className="ana-filter-row">
        <div className="ana-filter-field">
          <span className="ana-filter-label">Assessment From</span>
          <input type="date" value={pending.startDate}
            onChange={e => onChange(p => ({ ...p, startDate: e.target.value }))} />
        </div>
        <div className="ana-filter-field">
          <span className="ana-filter-label">Assessment To</span>
          <input type="date" value={pending.endDate}
            onChange={e => onChange(p => ({ ...p, endDate: e.target.value }))} />
        </div>
        <div className="ana-filter-field ana-filter-child">
          <span className="ana-filter-label">Participant ID / Name</span>
          <input type="text" placeholder="Search…" value={pending.childId}
            onChange={e => onChange(p => ({ ...p, childId: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && onApply()} />
        </div>
      </div>

      <div className="ana-filter-row">
        <ChipGroup label="Sex"
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
        <ChipGroup label="Assessment Status"
          options={STATUS_CHIP_OPTIONS}
          selected={pending.statuses}
          onToggle={v => toggle('statuses', v)}
        />
        <span className="ana-filter-sep" />
        <ChipGroup label="Assessment Visit"
          options={ATTEMPT_CHIP_OPTIONS}
          selected={pending.attempts}
          onToggle={v => toggle('attempts', v)}
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
        {(activeTab === 'overall' || activeTab === 'overall-v2') && (
          <>
            <span className="ana-filter-sep" />
            <ChipGroup label="Assessment"
              options={catalog.map(g => ({ key: g.key, label: g.title, color: g.color }))}
              selected={pending.gameKeys}
              onToggle={v => toggle('gameKeys', v)}
            />
          </>
        )}
        {(activeTab === 'overall' || activeTab === 'overall-v2') && testGroups.length > 0 && (
          <>
            <span className="ana-filter-sep" />
            <div className="ana-chip-group">
              <span className="ana-chip-label">Assessment Group</span>
              <button
                className={`ana-chip${pending.gameKeys.length === 0 ? ' active' : ''}`}
                onClick={() => onChange(p => ({ ...p, gameKeys: [] }))}
              >
                All Assessments
              </button>
              {testGroups.map(g => {
                const isActive = pending.gameKeys.length === g.gameKeys.length && g.gameKeys.every(k => pending.gameKeys.includes(k));
                return (
                  <button key={g.id}
                    className={`ana-chip${isActive ? ' active' : ''}`}
                    style={isActive ? { '--chip-color': '#f59e0b' } : {}}
                    onClick={() => onChange(p => ({ ...p, gameKeys: [...g.gameKeys] }))}
                    title={g.gameKeys.map(k => catalog.find(c => c.key === k)?.title || k).join(', ')}
                  >
                    {g.name} ({g.gameKeys.length})
                  </button>
                );
              })}
            </div>
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
  const [overviewV2Data,  setOverviewV2Data] = useState(null);
  const [gameData,        setGameData]      = useState({});
  const [loading,         setLoading]       = useState(false);
  const [error,           setError]         = useState(null);
  const [groupOptions,    setGroupOptions]  = useState([]);
  const [testOrder,       setTestOrder]     = useState(null);   // ordered keys from Settings → Test Configuration
  const [excelExportEnabled, setExcelExportEnabled] = useState(true); // Settings → Analysis Dashboard toggle
  const [showKpiInfoIcon, setShowKpiInfoIcon] = useState(false); // Settings → Analysis Dashboard toggle
  const [csvExportEnabled, setCsvExportEnabled] = useState(true); // Settings → Analysis Dashboard toggle
  const [testGroups,      setTestGroups]     = useState([]); // Settings → Test Configuration → Test Groups
  const metaFetchedRef = useRef(false);

  useEffect(() => {
    axiosAdmin.get('/admin/child-groups')
      .then(res => setGroupOptions(res.data.filter(g => g.status === 'active')))
      .catch(err => console.error('Failed to fetch child groups:', err));
    axiosAdmin.get('/admin/test-config')
      .then(({ data }) => setTestOrder((data.tests || []).map(t => t.key)))
      .catch(err => console.error('Failed to fetch test config order:', err));
    axiosAdmin.get('/admin/analysis-settings')
      .then(({ data }) => {
        setExcelExportEnabled(data.topChildrenExcelExport !== false);
        setShowKpiInfoIcon(data.showKpiInfoIcon === true);
        setCsvExportEnabled(data.gameCsvExport !== false);
      })
      .catch(err => console.error('Failed to fetch analysis settings:', err));
    axiosAdmin.get('/admin/test-groups')
      .then(({ data }) => setTestGroups(data.groups || []))
      .catch(err => console.error('Failed to fetch test groups:', err));
  }, []);

  // All tests, ordered as configured in Admin Settings → Test Configuration
  const orderedCatalog = React.useMemo(() => {
    let catalog = GAME_CATALOG;
    // Organization-wise Test Assignment — UX filtering only, mirrors the
    // server-side enforcement (assignedTestsGuard.js); Super Admin and
    // unrestricted org/staff sessions see the full catalog exactly as
    // before this feature.
    if (isOrgSession() || isStaffSession()) {
      const assignedTests = getAssignedTests();
      if (assignedTests !== null) catalog = catalog.filter(g => assignedTests.includes(g.key));
    }
    if (!testOrder?.length) return catalog;
    const pos = new Map(testOrder.map((k, i) => [k, i]));
    return [...catalog].sort((a, b) => (pos.get(a.key) ?? 999) - (pos.get(b.key) ?? 999));
  }, [testOrder]);

  // Fetch meta once on mount → set default date range, then restore whatever
  // filters were already in the URL (e.g. from a refresh or shared link) on
  // top of those defaults.
  useEffect(() => {
    if (metaFetchedRef.current) return;
    metaFetchedRef.current = true;
    axiosAdmin.get('/analysis/meta')
      .then(({ data }) => {
        setMeta(data);
        const dateDefaults = { startDate: data.minDate || todayStr(), endDate: data.today || todayStr() };
        const restored = filtersFromSearchParams(searchParams, dateDefaults);
        setPendingFilters(restored);
        setFilters(restored);
      })
      .catch(() => {
        const today = todayStr();
        const restored = filtersFromSearchParams(searchParams, { startDate: today, endDate: today });
        setPendingFilters(restored);
        setFilters(restored);
      });
  }, []); // eslint-disable-line -- read the URL once, at whatever it was on mount

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
      } else if (activeTab === 'overall-v2') {
        const { data } = await axiosAdmin.get('/analysis/overview-v2', { params });
        setOverviewV2Data(data);
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
  // straight into that dashboard) and on browser back/forward. Tab clicks
  // themselves just update local state — the writer effect below pushes it
  // (together with the current filters) into the URL right after.
  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'overall');
  }, [searchParams]);

  // Keep the URL in sync with the applied filters + active tab, so refreshing
  // the page (or opening a shared/bookmarked link) restores exactly this
  // state instead of resetting to defaults.
  useEffect(() => {
    if (!filters) return;
    const params = buildApiParams(filters);
    if (activeTab !== 'overall') params.tab = activeTab;
    setSearchParams(params, { replace: true });
  }, [filters, activeTab]); // eslint-disable-line

  const handleTabChange = (tab) => {
    setError(null);
    setActiveTab(tab);
  };

  const [pdfExporting, setPdfExporting] = useState(false);
  const handleDownloadPdf = async () => {
    setPdfExporting(true);
    try {
      const label = activeTab === 'overall' ? 'Platform_Overview' : 'Overall_V2_Executive_Analytics';
      await downloadElementAsPdf('ana-dashboard-capture', `Sangian_${label}_${todayStr()}.pdf`);
    } catch (err) {
      console.error('Failed to generate dashboard PDF:', err);
    } finally {
      setPdfExporting(false);
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
        testGroups={testGroups}
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

          <button
            className={`ana-tab-item${activeTab === 'overall-v2' ? ' active' : ''}`}
            onClick={() => handleTabChange('overall-v2')}
          >
            <span className="ana-tab-icon">🧠</span>
            <div className="ana-tab-text">
              <div className="ana-tab-name">Overall V2</div>
              <div className="ana-tab-sub">Executive Insights</div>
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
        <main className="ana-right-panel" id="ana-dashboard-capture">

          <div className="ana-panel-header">
            <h2 className="ana-panel-title">
              {activeTab === 'overall'
                ? 'Study Overview'
                : activeTab === 'overall-v2'
                ? 'Overall V2 — Executive Analytics'
                : <>{activeGame?.icon} {activeGame?.title} Analytics</>
              }
            </h2>
            {activeTab !== 'overall' && activeTab !== 'overall-v2' && activeGame && activeGame.tag && (
              <span className="ana-panel-tag" style={{ background: `${activeGame.color}1a`, color: activeGame.color }}>
                {activeGame.tag}
              </span>
            )}
            {activeTab !== 'overall' && activeTab !== 'overall-v2' && gameData[activeTab]?.meta?.maxScore != null && (
              <span className="ana-panel-tag" style={{ background: '#f1f5f9', color: '#64748b' }}>
                Max Score: <strong>{gameData[activeTab].meta.maxScore}</strong>
              </span>
            )}
            {loading && <span className="ana-loading-chip" data-pdf-ignore="true">⏳ Loading…</span>}
            <div className="ana-panel-actions" data-pdf-ignore="true">
              {(activeTab === 'overall' || activeTab === 'overall-v2') && (
                <button
                  className="ana-btn-pdf"
                  onClick={handleDownloadPdf}
                  title="Download this dashboard as a PDF"
                  disabled={loading || pdfExporting}
                >
                  {pdfExporting ? <span className="ana-spinner-sm" /> : '📄'}
                  {' '}{pdfExporting ? 'Generating…' : 'Download PDF'}
                </button>
              )}
              <button className="ana-btn-refresh" onClick={fetchData} title="Refresh" disabled={loading}>
                🔄
              </button>
            </div>
          </div>

          {error && (
            <div className="ana-error-bar">
              ⚠️ {error}
              <button onClick={fetchData}>Retry</button>
            </div>
          )}

          {activeTab === 'overall'
            ? <OverviewPanel data={overviewData} loading={loading} filters={filters} catalog={orderedCatalog} excelExportEnabled={excelExportEnabled} showKpiInfoIcon={showKpiInfoIcon} />
            : activeTab === 'overall-v2'
            ? <OverviewV2Panel data={overviewV2Data} loading={loading} showKpiInfoIcon={showKpiInfoIcon} catalog={orderedCatalog} />
            : <GamePanel
                showKpiInfoIcon={showKpiInfoIcon}
                csvExportEnabled={csvExportEnabled}
                gameMeta={activeGame || { title: activeTab, icon: '🎮', color: '#4f46e5', tag: '' }}
                gameKey={activeTab}
                data={gameData[activeTab]}
                loading={loading}
                filters={filters}
                groupOptions={groupOptions}
              />
          }
        </main>
      </div>
    </div>
  );
}
