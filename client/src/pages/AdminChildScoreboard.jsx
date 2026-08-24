import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../services/api';

const GAME_LABELS = {
    'literacy_reading_skill': 'Padh ke batao - V0',
    'literacy_reading_skill_v2': 'Padh ke batao',
    'numeracy_number_skill': 'Ankganit - V0',
    'numeracy_number_skill_v2': 'Ankganit - V1',
    'numeracy_number_skill_v3': 'Ankganit',
    'number_recall_lottery': 'Lottery Ka Ticket',
    'number_recall_lottery_v2': 'Lottery Ka Ticket - Version 2',
    'atlantis_bagiya': 'Bagiya',
    'working_memory_herpher': 'Her Pher',
    'working_memory_herpher_v2': 'Her Pher V2',
    'working_memory_herpher_v3': 'Her Pher V3',
    'auditory_dhyan': 'Dhyan Kahan Hai',
    'triangle_rachna': 'Rachna',
    'rover_mela': 'Chalo Mela Chalen',
    'chalo_mela_chale': 'Chalo Mela Chalen',
    'cognitive_flex_chor': 'Chor Machaye Shor',
    'chor_machaye_shor': 'Chor Machaye Shor',
};

// ── "Why was this dropped?" explanations ───────────────────────────────────
// Every game has its own automatic stop-rule for a 'dropped' session — a
// built-in safeguard that ends the test early once continuing wouldn't give
// a valid result (e.g. the child is clearly struggling with the easiest
// items). A couple of games store the exact trigger in `quit_reason`, which
// we translate into plain language below; the rest don't record a reason
// string at all, so those fall back to a fixed explanation of that game's
// one and only drop rule (the source of truth is each game's own code, not
// the admin's internal docs, which are inconsistent on this point).
function parseQuitReason(gameName, quitReason) {
    if (!quitReason) return null;

    if (gameName === 'rover_mela' || gameName === 'chalo_mela_chale') {
        if (/Clinical Drop-Out Rule Triggered/i.test(quitReason)) {
            return 'The child scored fewer than 2 points on each of the first three questions. To avoid unnecessary frustration and protect the accuracy of the results, the test ends early once this pattern shows up — the remaining, harder questions would not have added meaningful information at that point.';
        }
    }

    if (gameName === 'literacy_reading_skill' || gameName === 'literacy_reading_skill_v2') {
        let m = quitReason.match(/^(Single Letter|Double Letter) Drop: (\d+)\/(\d+) correct \(minimum (\d+) required\)\.?$/i);
        if (m) {
            const [, category, got, total, min] = m;
            return `In the ${category} section, the child got only ${got} out of ${total} correct — at least ${min} correct answers are required to move on, so the test stopped here.`;
        }
        m = quitReason.match(/^Sentence Category Drop: (\d+)\/(\d+) correct/i);
        if (m) {
            const [, got, total] = m;
            return `In the Sentence section, the child got ${got} out of ${total} correct — at least 1 correct answer is required to continue, so the test stopped here.`;
        }
        if (/^Story Drop/i.test(quitReason)) {
            return 'The assessor scored the Story/Paragraph section as 0, which does not meet the minimum needed to continue the test.';
        }
    }

    return quitReason; // Unrecognized format — show the raw stored reason rather than hide it.
}

const STATIC_DROP_EXPLANATIONS = {
    atlantis_bagiya: "This test checks the child's running total score at 4 checkpoints spread through the game. If the score at a checkpoint doesn't clear the required minimum for that stage, the test ends there — continuing with harder questions afterward wouldn't give a valid result.",
    numeracy_number_skill: 'This test stops automatically the moment either rule is hit: 3 wrong answers in a row, or too few correct answers in a question category before moving on to the next one.',
    numeracy_number_skill_v2: 'This test stops automatically the moment either rule is hit: 3 wrong answers in a row, or too few correct answers in a question category before moving on to the next one.',
    numeracy_number_skill_v3: 'This test stops automatically the moment either rule is hit: 3 wrong answers in a row, or too few correct answers in a question category before moving on to the next one.',
    number_recall_lottery: "This test stops automatically as soon as the child gives 3 wrong answers in a row — the test's built-in signal that continuing wouldn't add useful information.",
    number_recall_lottery_v2: "This test stops automatically as soon as the child gives 3 wrong answers in a row — the test's built-in signal that continuing wouldn't add useful information.",
    chor_machaye_shor: "This isn't a scoring rule — it means an earlier, unfinished attempt at this test was replaced when the child (or assessor) chose to start fresh instead of resuming it. The old session is simply marked this way to keep the records clean.",
    cognitive_flex_chor: "This isn't a scoring rule — it means an earlier, unfinished attempt at this test was replaced when the child (or assessor) chose to start fresh instead of resuming it. The old session is simply marked this way to keep the records clean.",
};

function explainDrop(session) {
    const parsed = parseQuitReason(session.game_name, session.quit_reason);
    if (parsed) return parsed;
    if (STATIC_DROP_EXPLANATIONS[session.game_name]) return STATIC_DROP_EXPLANATIONS[session.game_name];
    return "This test ended early based on the assessment's built-in stop-rule for this game, rather than the child completing every question.";
}

// 'dropped' is always a system-triggered stop-rule (explained above). 'quit'
// and 'paused' share the same assessor-facing modal — a required free-text
// reason the assessor types before either action — stored in the same
// quit_reason column, so for those two statuses we just surface their own
// words rather than trying to explain a rule.
function explainReason(session) {
    if (session.status === 'dropped') return explainDrop(session);
    if (session.status === 'quit' || session.status === 'paused') {
        return session.quit_reason && session.quit_reason.trim() ? session.quit_reason.trim() : null;
    }
    return null;
}

const AdminChildScoreboard = () => {
    const { childId } = useParams();
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const [sortConfig, setSortConfig] = useState({ key: 'start_time', direction: 'descending' });

    useEffect(() => {
        if (!childId) return;
        const fetchHistory = async () => {
            try {
                const response = await axios.get(`${API_URL}/games/sessions/history/${childId}`);
                setHistory(response.data.history || []);
            } catch (error) {
                console.error('Failed to fetch game history:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [childId]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
        }
        return ' ↕';
    };

    const sortedHistory = React.useMemo(() => {
        let sortableItems = [...history];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle special cases
                if (sortConfig.key === 'start_time') {
                    aValue = new Date(aValue).getTime();
                    bValue = new Date(bValue).getTime();
                } else if (sortConfig.key === 'game_name') {
                    aValue = GAME_LABELS[aValue] || aValue;
                    bValue = GAME_LABELS[bValue] || bValue;
                } else if (sortConfig.key === 'score' || sortConfig.key === 'attempt_no') {
                    aValue = Number(aValue) || 0;
                    bValue = Number(bValue) || 0;
                }

                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [history, sortConfig]);

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    return (
        <main className="admin-content" aria-label="Game Performance Scoreboard">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>🏆 Game Performance Scoreboard</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>Individual record for Child ID: <strong>{childId}</strong></p>
                    </div>
                    <div className="admin-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <button 
                            onClick={() => navigate('/admin/children')} 
                            style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: '14px', transition: 'all 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                            onMouseOut={e => e.currentTarget.style.background = '#ffffff'}
                        >
                            <span>←</span> Back to Children List
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto', marginTop: '12px' }}>
                    <table className="admin-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f8fafc' }}>
                            <tr>
                                <th onClick={() => requestSort('game_name')} style={{ textAlign: 'left', padding: '14px', cursor: 'pointer' }}>Game Name{getSortIndicator('game_name')}</th>
                                <th onClick={() => requestSort('attempt_no')} style={{ textAlign: 'center', padding: '14px', cursor: 'pointer' }}>Attempt{getSortIndicator('attempt_no')}</th>
                                <th onClick={() => requestSort('score')} style={{ textAlign: 'center', padding: '14px', cursor: 'pointer' }}>Score{getSortIndicator('score')}</th>
                                <th onClick={() => requestSort('status')} style={{ textAlign: 'center', padding: '14px', cursor: 'pointer' }}>Status{getSortIndicator('status')}</th>
                                <th style={{ textAlign: 'left', padding: '14px' }}>Reason</th>
                                <th onClick={() => requestSort('start_time')} style={{ textAlign: 'left', padding: '14px', cursor: 'pointer' }}>Date & Time{getSortIndicator('start_time')}</th>
                                <th style={{ textAlign: 'center', padding: '14px' }}>Final Dashboard</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Loading history...</td></tr>
                            ) : sortedHistory.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>No game sessions found for this child.</td></tr>
                            ) : (
                                sortedHistory.map((session, index) => {
                                    const rowKey = `${session.id}-${session.attempt_no || index}`;
                                    const reason = explainReason(session);
                                    return (
                                    <tr key={rowKey} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '14px', fontWeight: '500', color: '#334155' }}>
                                            {GAME_LABELS[session.game_name] || session.game_name}
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            <span style={{
                                                background: '#f1f5f9', color: '#475569',
                                                padding: '2px 8px', borderRadius: '6px',
                                                fontSize: '0.75rem', fontWeight: 700
                                            }}>
                                                #{session.attempt_no || '1'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            <span style={{
                                                display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
                                                background: session.score > 0 ? '#f0fdf4' : '#f8fafc',
                                                color: session.score > 0 ? '#166534' : '#64748b',
                                                fontWeight: 'bold', fontSize: '0.9rem'
                                            }}>
                                                {session.score ?? '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            {session.status === 'completed' ? (
                                                <span className="admin-tag good">Completed</span>
                                            ) : session.status === 'quit' ? (
                                                <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Quit</span>
                                            ) : session.status === 'paused' ? (
                                                <span className="admin-tag" style={{ background: '#fef9c3', color: '#854d0e', borderColor: '#fef08a' }}>Paused</span>
                                            ) : session.status === 'dropped' ? (
                                                <span className="admin-tag" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Dropped</span>
                                            ) : session.status === 'rejected' ? (
                                                <span className="admin-tag" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }} title="Score submission was blocked because the child was no longer Active">Rejected</span>
                                            ) : (
                                                <span className="admin-tag" style={{ background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}>{session.status}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '14px', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, minWidth: '260px', maxWidth: '420px' }}>
                                            {reason || <span style={{ color: '#cbd5e1' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '14px', fontSize: '0.875rem', color: '#475569' }}>
                                            {formatDateTime(session.start_time)}
                                        </td>
                                        <td style={{ padding: '14px', textAlign: 'center' }}>
                                            {session.pdf_url ? (
                                                <a
                                                    href={`${API_URL.replace('/api', '')}${session.pdf_url}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        textDecoration: 'none', background: '#4f46e5', color: '#fff',
                                                        padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem',
                                                        fontWeight: 'bold', display: 'inline-block', transition: 'all 0.2s',
                                                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
                                                    }}
                                                    onMouseOver={e => e.currentTarget.style.background = '#4338ca'}
                                                    onMouseOut={e => e.currentTarget.style.background = '#4f46e5'}
                                                >
                                                    View Dashboard
                                                </a>
                                            ) : (
                                                <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>N/A</span>
                                            )}
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
};

export default AdminChildScoreboard;
