import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosAssessor from '../services/axiosAssessor';
import { getAssessorInfo } from '../utils/assessorSession';
import { GAME_CATALOG } from '../utils/reportExportUtils';

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Matches AdminReports.jsx's fmtSecs / IndividualReports.jsx's fmtDuration —
// same "Duration" figure (actual_game_time), same display format.
const fmtDuration = (v) => {
    if (v == null) return '—';
    const s = Math.round(Number(v));
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
};

// Same catalog AdminReports/report exports use — so the Assessor sees the
// same friendly game names (e.g. "Ankganit - V1") instead of the
// raw DB key (numeracy_number_skill_v2).
const GAME_TITLE_BY_KEY = Object.fromEntries(GAME_CATALOG.map(g => [g.key, g.title]));
const gameTitle = (key) => GAME_TITLE_BY_KEY[key] || key;

const STATUS_LABEL = {
    completed: <span style={{ color: '#16a34a', fontWeight: 600 }}>Completed</span>,
    in_progress: <span style={{ color: '#2563eb', fontWeight: 600 }}>In Progress</span>,
    paused: <span style={{ color: '#b45309', fontWeight: 600 }}>Paused</span>,
    quit: <span style={{ color: '#dc2626', fontWeight: 600 }}>Quit</span>,
    dropped: <span style={{ color: '#dc2626', fontWeight: 600 }}>Dropped</span>,
    rejected: <span style={{ color: '#dc2626', fontWeight: 600 }}>Rejected</span>,
};

const KpiCard = ({ label, value, accent }) => (
    <div style={{
        background: '#fff', borderRadius: '14px', padding: '20px', flex: '1 1 160px',
        boxShadow: '0 2px 10px rgba(15,23,42,0.06)', border: '1px solid #f1f5f9',
    }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '8px' }}>{label}</div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: accent || '#111827' }}>{value}</div>
    </div>
);

const AssessorDashboard = () => {
    const assessorInfo = getAssessorInfo();
    const [kpis, setKpis] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axiosAssessor.get('/assessor/dashboard');
                setKpis(data.kpis);
                setRecentActivity(data.recentActivity || []);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load dashboard.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <main className="main-shell" style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '22px', margin: '0 0 4px 0' }}>
                        Welcome, {assessorInfo?.name || 'Assessor'}{' '}
                        <Link to="/assessor/account" title="Edit account" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary, #4f46e5)', textDecoration: 'none' }}>
                            ✏️ Edit
                        </Link>
                    </h1>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Here's your assessment workload and progress at a glance.</p>
                </div>
                <Link to="/assessor/search-child" className="btn modal-btn-primary" style={{ padding: '10px 22px', borderRadius: '10px', textDecoration: 'none' }}>
                    🔍 Search Child / Start Assessment
                </Link>
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                    ⚠️ {error}
                </div>
            )}

            {loading ? (
                <p style={{ color: '#6b7280' }}>Loading dashboard…</p>
            ) : kpis && (
                <>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
                        <KpiCard label="Children Assigned" value={kpis.childrenAssigned} />
                        <KpiCard label="Completed Today" value={kpis.completedToday} accent="#16a34a" />
                        <KpiCard label="Pending" value={kpis.pending} accent="#b45309" />
                        <KpiCard label="Total Completed" value={kpis.totalCompleted} accent="#2563eb" />
                        <KpiCard label="Average Score" value={kpis.avgScore != null ? `${kpis.avgScore}%` : '—'} />
                        <KpiCard label="Average Time" value={kpis.avgTimeMinutes != null ? `${kpis.avgTimeMinutes} min` : '—'} />
                    </div>

                    <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.06)', border: '1px solid #f1f5f9' }}>
                        <h3 style={{ fontSize: '15px', margin: '0 0 14px 0' }}>Recent Activity</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                                        <th style={{ padding: '8px' }}>Child ID</th>
                                        <th style={{ padding: '8px' }}>Child</th>
                                        <th style={{ padding: '8px' }}>Game</th>
                                        <th style={{ padding: '8px' }}>Status</th>
                                        <th style={{ padding: '8px' }}>Score</th>
                                        <th style={{ padding: '8px' }}>Duration</th>
                                        <th style={{ padding: '8px' }}>Started</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentActivity.length === 0 ? (
                                        <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>No assessments yet — search for a child to get started.</td></tr>
                                    ) : (
                                        recentActivity.map(row => (
                                            <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '8px', color: '#6b7280' }}>{row.child_id}</td>
                                                <td style={{ padding: '8px', fontWeight: 600 }}>{row.child_name || '—'}</td>
                                                <td style={{ padding: '8px' }}>{gameTitle(row.game_name)}</td>
                                                <td style={{ padding: '8px' }}>{STATUS_LABEL[row.status] || row.status}</td>
                                                <td style={{ padding: '8px' }}>{row.score ?? '—'}</td>
                                                <td style={{ padding: '8px', color: '#6b7280' }}>{fmtDuration(row.actual_game_time)}</td>
                                                <td style={{ padding: '8px', color: '#6b7280' }}>{fmtDateTime(row.start_time)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </main>
    );
};

export default AssessorDashboard;
