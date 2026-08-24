import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';

const GAME_LABELS = {
    'literacy_reading_skill': 'Padh ke batao - V0',
    'literacy_reading_skill_v2': 'Padh ke batao',
    'numeracy_number_skill': 'Ankganit - V0',
    'numeracy_number_skill_v3': 'Ankganit - Version 3',
    'number_recall_lottery': 'Lottery Ka Ticket',
    'number_recall_lottery_v2': 'Lottery Ka Ticket - Version 2',
    'atlantis_bagiya': 'Bagiya',
    'working_memory_herpher': 'Her Pher',
    'auditory_dhyan': 'Dhyan Kahan Hai',
    'triangle_rachna': 'Rachna',
    'rover_mela': 'Chalo Mela Chalen',
    'chalo_mela_chale': 'Chalo Mela Chalen',
    'cognitive_flex_chor': 'Chor Machaye Shor',
    'chor_machaye_shor': 'Chor Machaye Shor',
};

const ChildGameHistoryModal = ({ childId, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 1001,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
        }}>
            <div className="admin-card" style={{
                width: '95%', maxWidth: '1000px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', backgroundColor: '#fff',
                padding: '28px', borderRadius: '16px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>🏆 Game Performance Scoreboard</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#64748b' }}>Individual record for Child ID: <strong>{childId}</strong></p>
                    </div>
                    <button onClick={onClose} className="admin-btn admin-btn-ghost" style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>Close</button>
                </div>
                
                <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                    <table className="admin-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '14px' }}>Game Name</th>
                                <th style={{ textAlign: 'center', padding: '14px' }}>Attempt</th>
                                <th style={{ textAlign: 'center', padding: '14px' }}>Score</th>
                                <th style={{ textAlign: 'center', padding: '14px' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '14px' }}>Date & Time</th>
                                <th style={{ textAlign: 'center', padding: '14px' }}>Final Dashboard</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Loading history...</td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>No game sessions found for this child.</td></tr>
                            ) : (
                                history.map((session) => (
                                    <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
                                            ) : (
                                                <span className="admin-tag" style={{ background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}>{session.status}</span>
                                            )}
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ChildGameHistoryModal;
