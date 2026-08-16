import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import axiosIndividual from '../services/axiosIndividual';
import { GAME_CATALOG } from '../utils/reportExportUtils';

const GAME_TITLE_BY_KEY = Object.fromEntries(GAME_CATALOG.map(g => [g.key, g.title]));
const gameTitle = (key) => GAME_TITLE_BY_KEY[key] || key;

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Matches AdminReports.jsx's fmtSecs — same "Duration" figure, same format.
const fmtDuration = (v) => {
    if (v == null) return '—';
    const s = Math.round(Number(v));
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
};

const STATUS_LABEL = {
    completed: <span style={{ color: '#16a34a', fontWeight: 600 }}>Completed</span>,
    in_progress: <span style={{ color: '#2563eb', fontWeight: 600 }}>In Progress</span>,
    paused: <span style={{ color: '#b45309', fontWeight: 600 }}>Paused</span>,
    quit: <span style={{ color: '#dc2626', fontWeight: 600 }}>Quit</span>,
    dropped: <span style={{ color: '#dc2626', fontWeight: 600 }}>Dropped</span>,
    rejected: <span style={{ color: '#dc2626', fontWeight: 600 }}>Rejected</span>,
};

// Reuses the same public /games/sessions/history/:childId endpoint the
// admin scoreboard already calls (gameController.js's getGameHistory) —
// no new backend endpoint needed for the history itself. The child_id is
// looked up via the authenticated /individual/me call rather than trusted
// from `currentChild` in localStorage — that value is only meant to drive
// the game engine and can go stale independently of the individual's own
// login (e.g. quitting a game clears it, since every game page treats a
// missing session as a plain child logout), so relying on it here would
// wrongly report "no session" even while the account is genuinely logged in.
const IndividualReports = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        axiosIndividual.get('/individual/me')
            .then(({ data }) => {
                if (!data.profile.child_id) {
                    setError('No linked profile found for this account.');
                    return;
                }
                return axios.get(`${API_URL}/games/sessions/history/${data.profile.child_id}`)
                    .then(({ data: historyData }) => setHistory(historyData.history || []));
            })
            .catch(() => setError('Failed to load your assessment history.'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="main-shell" style={{ padding: '32px 24px', maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '22px', margin: 0 }}>My Account</h1>
                <Link to="/individual/account" className="btn nav-btn-outline" style={{ textDecoration: 'none' }}>✏️ Edit</Link>
            </div>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px' }}>Your assessment history and downloadable PDF reports.</p>

            {error && (
                <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                    ⚠️ {error}
                </div>
            )}

            {loading ? (
                <p style={{ color: '#6b7280' }}>Loading…</p>
            ) : (
                <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 10px rgba(15,23,42,0.06)', border: '1px solid #f1f5f9' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                                    <th style={{ padding: '8px' }}>Game</th>
                                    <th style={{ padding: '8px' }}>Attempt</th>
                                    <th style={{ padding: '8px' }}>Status</th>
                                    <th style={{ padding: '8px' }}>Score</th>
                                    <th style={{ padding: '8px' }}>Duration</th>
                                    <th style={{ padding: '8px' }}>Date</th>
                                    <th style={{ padding: '8px' }}>Report</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>No assessments yet — play a game from the home page to get started.</td></tr>
                                ) : (
                                    history.map(row => (
                                        <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '8px', fontWeight: 600 }}>{gameTitle(row.game_name)}</td>
                                            <td style={{ padding: '8px' }}>#{row.attempt_no}</td>
                                            <td style={{ padding: '8px' }}>{STATUS_LABEL[row.status] || row.status}</td>
                                            <td style={{ padding: '8px' }}>{row.status === 'completed' ? (row.score ?? '—') : '—'}</td>
                                            <td style={{ padding: '8px', color: '#6b7280' }}>{fmtDuration(row.actual_game_time)}</td>
                                            <td style={{ padding: '8px', color: '#6b7280' }}>{fmtDateTime(row.start_time)}</td>
                                            <td style={{ padding: '8px' }}>
                                                {row.pdf_url ? (
                                                    <a
                                                        href={`${API_URL.replace('/api', '')}${row.pdf_url}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{ textDecoration: 'none', background: '#4f46e5', color: '#fff', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
                                                    >
                                                        📄 Download
                                                    </a>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </main>
    );
};

export default IndividualReports;
