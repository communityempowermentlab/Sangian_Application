import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';

const ChildSessionHistoryModal = ({ childId, onClose }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!childId) return;
        const fetchSessions = async () => {
            try {
                const response = await axios.get(`${API_URL}/admin/children/${childId}/sessions`);
                setSessions(response.data);
            } catch (error) {
                console.error('Failed to fetch sessions:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [childId]);

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    };

    const formatDuration = (seconds) => {
        if (seconds === null || seconds === undefined) return '-';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="admin-card" style={{
                width: '90%', maxWidth: '800px', maxHeight: '85vh',
                display: 'flex', flexDirection: 'column', backgroundColor: '#fff',
                padding: '24px', borderRadius: '12px', overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Login History: {childId}</h3>
                    <button onClick={onClose} className="admin-btn admin-btn-ghost" style={{ padding: '6px 12px', border: '1px solid var(--border)' }}>Close</button>
                </div>
                
                <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <table className="admin-table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Login Time</th>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Logout Time</th>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Duration</th>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Device Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>Loading sessions...</td></tr>
                            ) : sessions.length === 0 ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>No login sessions found for this child.</td></tr>
                            ) : (
                                sessions.map((session) => (
                                    <tr key={session.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '12px' }}>{formatDateTime(session.login_time)}</td>
                                        <td style={{ padding: '12px' }}>{formatDateTime(session.logout_time)}</td>
                                        <td style={{ padding: '12px' }}>{formatDuration(session.session_duration)}</td>
                                        <td style={{ padding: '12px' }}>
                                            {session.status === 'success' ? (
                                                <span className="admin-tag good">Success</span>
                                            ) : (
                                                <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Failed</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', color: 'var(--muted)' }}>
                                            {session.browser} on {session.os}<br/>
                                            <small>{session.ip_address} ({session.location || 'Unknown'})</small>
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

export default ChildSessionHistoryModal;
