import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import './AdminDashboard.css';

const GAME_LABELS = {
  'literacy_reading_skill':  'Reading Skill',
  'numeracy_number_skill':   'Number Skill',
  'number_recall_lottery':   'Number Recall',
  'atlantis_bagiya':         'Atlantis Bagiya',
  'working_memory_herpher':  'Her Pher',
  'auditory_dhyan':          'Auditory Attention',
  'triangle_rachna':         'Triangle Rachna',
  'rover_mela':              'Chalo Mela Chale',
  'cognitive_flex_chor':     'Chor Machaye Shor',
};

const GAME_COLORS = [
  '#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#ec4899','#84cc16','#f97316',
];

const STATUS_META = {
  completed:  { label: 'Completed',  color: '#10b981', bg: '#ecfdf5' },
  quit:       { label: 'Quit',       color: '#ef4444', bg: '#fef2f2' },
  paused:     { label: 'Paused',     color: '#f59e0b', bg: '#fffbeb' },
  in_progress:{ label: 'In Progress',color: '#3b82f6', bg: '#eff6ff' },
  dropped:    { label: 'Dropped',    color: '#6b7280', bg: '#f9fafb' },
};

const fmt = (n) => Number(n || 0).toLocaleString();

const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)  return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
};

const KpiCard = ({ icon, label, value, sub, color, bg }) => (
  <div className="db-kpi-card" style={{ borderTop: `3px solid ${color}` }}>
    <div className="db-kpi-icon" style={{ background: bg, color }}>
      <span>{icon}</span>
    </div>
    <div className="db-kpi-body">
      <div className="db-kpi-value">{fmt(value)}</div>
      <div className="db-kpi-label">{label}</div>
      {sub && <div className="db-kpi-sub">{sub}</div>}
    </div>
  </div>
);

const BarChart = ({ data }) => {
  if (!data || data.length === 0) return <div className="db-empty">No game data yet</div>;
  const maxTotal = Math.max(...data.map(d => Number(d.total) || 0), 1);

  return (
    <div className="db-barchart">
      {data.map((g, i) => {
        const total     = Number(g.total)     || 0;
        const completed = Number(g.completed) || 0;
        const quit      = Number(g.quit)      || 0;
        const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
        const barW      = total > 0 ? Math.round((total / maxTotal) * 100) : 0;
        const label     = GAME_LABELS[g.game_name] || g.game_name;

        return (
          <div key={g.game_name} className="db-bar-row">
            <div className="db-bar-label" title={label}>{label}</div>
            <div className="db-bar-track">
              <div
                className="db-bar-fill"
                style={{ width: `${barW}%`, background: GAME_COLORS[i % GAME_COLORS.length] }}
              >
                <div
                  className="db-bar-done"
                  style={{ width: `${pct}%`, opacity: 0.35 }}
                />
              </div>
            </div>
            <div className="db-bar-stats">
              <span className="db-bar-total">{total}</span>
              <span className="db-bar-pct" style={{ color: GAME_COLORS[i % GAME_COLORS.length] }}>
                {pct}%
              </span>
            </div>
          </div>
        );
      })}
      <div className="db-bar-legend">
        <span className="db-leg-dot" style={{ background: '#4f46e5' }} /> Total attempts
        <span className="db-leg-dot" style={{ background: '#10b981', marginLeft: 16 }} /> Completed (% overlay)
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate  = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const res = await axiosAdmin.get('/admin/dashboard/stats');
      if (res.data.success) {
        setStats(res.data);
        setRefreshedAt(new Date());
      }
    } catch (err) {
      setError('Could not load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const kpi = stats?.kpi || {};

  return (
    <main className="admin-content db-root" aria-label="Dashboard">

      {/* ── Header ── */}
      <div className="db-header">
        <div>
          <h1 className="db-title">Dashboard</h1>
          <p className="db-subtitle">
            {refreshedAt
              ? `Last updated ${refreshedAt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}`
              : 'Loading…'}
          </p>
        </div>
        <div className="db-header-actions">
          <button className="db-refresh-btn" onClick={fetchStats} disabled={loading}>
            {loading ? '⟳ Refreshing…' : '⟳ Refresh'}
          </button>
          <button className="db-action-btn" onClick={() => navigate('/admin/reports')}>
            📊 Reports
          </button>
        </div>
      </div>

      {error && (
        <div className="db-error-banner">
          ⚠ {error}
          <button onClick={fetchStats}>Retry</button>
        </div>
      )}

      {/* ── KPI Row ── */}
      <section className="db-kpi-grid">
        <KpiCard icon="📋" label="Total Sessions"    value={kpi.totalSessions}  color="#4f46e5" bg="#eef2ff" sub={`${kpi.activeToday || 0} active today`} />
        <KpiCard icon="✅" label="Completed"         value={kpi.completed}      color="#10b981" bg="#ecfdf5" sub={kpi.totalSessions > 0 ? `${Math.round((kpi.completed/kpi.totalSessions)*100)}% rate` : '—'} />
        <KpiCard icon="🚪" label="Quit"              value={kpi.quit}           color="#ef4444" bg="#fef2f2" />
        <KpiCard icon="⏸"  label="Paused"           value={kpi.paused}         color="#f59e0b" bg="#fffbeb" />
        <KpiCard icon="👦" label="Total Children"    value={kpi.totalChildren}  color="#8b5cf6" bg="#f5f3ff" sub={`+${kpi.newChildrenThisWeek || 0} this week`} />
        <KpiCard icon="👤" label="Total Assessors"   value={kpi.totalAssessors} color="#06b6d4" bg="#ecfeff" />
      </section>

      {/* ── Middle Row: Activity + Quick Actions ── */}
      <section className="db-mid-grid">

        {/* Recent Activity */}
        <div className="db-panel db-activity-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">Recent Activity</span>
            <span className="db-panel-badge">{stats?.recentActivity?.length || 0}</span>
          </div>
          <div className="db-activity-list">
            {loading && <div className="db-skeleton-list">{[...Array(6)].map((_,i) => <div key={i} className="db-skeleton-item"/>)}</div>}
            {!loading && (!stats?.recentActivity?.length) && (
              <div className="db-empty">No activity yet</div>
            )}
            {!loading && stats?.recentActivity?.map(item => {
              const meta   = STATUS_META[item.status] || STATUS_META.in_progress;
              const gLabel = GAME_LABELS[item.game_name] || item.game_name;
              return (
                <div key={item.id} className="db-activity-item">
                  <div className="db-activity-dot" style={{ background: meta.color }} />
                  <div className="db-activity-body">
                    <div className="db-activity-main">
                      <strong>{item.child_name}</strong>
                      <span className="db-activity-muted"> ({item.child_id})</span>
                    </div>
                    <div className="db-activity-detail">
                      {gLabel}
                      <span className="db-activity-badge" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      {item.score != null && item.status === 'completed' && (
                        <span className="db-activity-score">Score: {item.score}</span>
                      )}
                    </div>
                  </div>
                  <div className="db-activity-time">{timeAgo(item.updated_at)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="db-panel db-actions-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">Quick Actions</span>
          </div>
          <div className="db-qa-grid">
            {[
              { icon:'➕', label:'Add Child',      action: () => navigate('/admin/children?action=add'), color:'#4f46e5' },
              { icon:'👤', label:'Add Assessor',   action: () => navigate('/admin/assessors?action=add'), color:'#8b5cf6' },
              { icon:'👦', label:'View Children',  action: () => navigate('/admin/children'),  color:'#10b981' },
              { icon:'📊', label:'View Reports',   action: () => navigate('/admin/reports'),   color:'#f59e0b' },
              { icon:'📋', label:'Assessors',      action: () => navigate('/admin/assessors'), color:'#06b6d4' },
              { icon:'📄', label:'Documentation',  action: () => navigate('/admin/docs'),      color:'#ec4899' },
            ].map(qa => (
              <button key={qa.label} className="db-qa-btn" onClick={qa.action}>
                <span className="db-qa-icon" style={{ background: qa.color + '18', color: qa.color }}>
                  {qa.icon}
                </span>
                <span className="db-qa-label">{qa.label}</span>
              </button>
            ))}
          </div>

          {/* System Health */}
          <div className="db-health-section">
            <div className="db-panel-title" style={{ marginBottom: 12 }}>System Health</div>
            <div className="db-health-list">
              <div className="db-health-item">
                <span className="db-health-dot" style={{ background: stats ? '#10b981' : '#f59e0b' }} />
                <span className="db-health-label">API Server</span>
                <span className="db-health-status" style={{ color: stats ? '#10b981' : '#f59e0b' }}>
                  {stats ? 'Online' : 'Checking…'}
                </span>
              </div>
              <div className="db-health-item">
                <span className="db-health-dot" style={{ background: stats ? '#10b981' : '#f59e0b' }} />
                <span className="db-health-label">Database</span>
                <span className="db-health-status" style={{ color: stats ? '#10b981' : '#f59e0b' }}>
                  {stats ? 'Connected' : 'Checking…'}
                </span>
              </div>
              <div className="db-health-item">
                <span className="db-health-dot" style={{ background: '#10b981' }} />
                <span className="db-health-label">Auth Service</span>
                <span className="db-health-status" style={{ color: '#10b981' }}>Active</span>
              </div>
              <div className="db-health-item">
                <span className="db-health-dot" style={{ background: '#10b981' }} />
                <span className="db-health-label">Last Sync</span>
                <span className="db-health-status" style={{ color: '#64748b' }}>
                  {refreshedAt
                    ? refreshedAt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom Row: Chart + Active Sessions ── */}
      <section className="db-bottom-grid">

        {/* Test Performance Chart */}
        <div className="db-panel db-chart-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">Test Performance Overview</span>
            <span className="db-panel-hint">Bar = total attempts · Shade = completion rate</span>
          </div>
          {loading
            ? <div className="db-skeleton-list">{[...Array(5)].map((_,i) => <div key={i} className="db-skeleton-bar"/>)}</div>
            : <BarChart data={stats?.gameStats} />
          }
        </div>

        {/* Session Breakdown */}
        <div className="db-panel db-breakdown-panel">
          <div className="db-panel-header">
            <span className="db-panel-title">Session Breakdown</span>
          </div>
          <div className="db-breakdown-list">
            {[
              { key:'completed',   label:'Completed',   icon:'✅', value: kpi.completed,  color:'#10b981' },
              { key:'quit',        label:'Quit',        icon:'🚪', value: kpi.quit,       color:'#ef4444' },
              { key:'paused',      label:'Paused',      icon:'⏸', value: kpi.paused,     color:'#f59e0b' },
              { key:'inProgress',  label:'In Progress', icon:'▶',  value: kpi.inProgress, color:'#3b82f6' },
              { key:'dropped',     label:'Dropped',     icon:'⬇', value: kpi.dropped,    color:'#6b7280' },
            ].map(item => {
              const total = kpi.totalSessions || 1;
              const pct   = Math.round(((item.value || 0) / total) * 100);
              return (
                <div key={item.key} className="db-breakdown-item">
                  <span className="db-breakdown-icon">{item.icon}</span>
                  <div className="db-breakdown-info">
                    <div className="db-breakdown-row">
                      <span className="db-breakdown-label">{item.label}</span>
                      <span className="db-breakdown-val">{fmt(item.value)}</span>
                    </div>
                    <div className="db-breakdown-bar-track">
                      <div
                        className="db-breakdown-bar-fill"
                        style={{ width: `${pct}%`, background: item.color }}
                      />
                    </div>
                  </div>
                  <span className="db-breakdown-pct" style={{ color: item.color }}>{pct}%</span>
                </div>
              );
            })}
          </div>

          <div className="db-active-badge">
            <span className="db-active-pulse" />
            <span className="db-active-text">
              <strong>{kpi.activeToday || 0}</strong> active sessions today
            </span>
          </div>
        </div>
      </section>

    </main>
  );
};

export default AdminDashboard;
