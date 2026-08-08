import React, { useState, useEffect, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import ActivityDetailsModal from '../components/ActivityDetailsModal';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const ACTION_COLORS = {
    login: { bg: '#dcfce7', color: '#166534' },
    logout: { bg: '#f1f5f9', color: '#475569' },
    create: { bg: '#dbeafe', color: '#1e40af' },
    edit: { bg: '#fef9c3', color: '#854d0e' },
    delete: { bg: '#fee2e2', color: '#991b1b' },
    password_change: { bg: '#ede9fe', color: '#6d28d9' },
    profile_update: { bg: '#e0f2fe', color: '#0369a1' },
    force_logout: { bg: '#fef3c7', color: '#92400e' },
    page_view: { bg: '#f1f5f9', color: '#334155' },
    export: { bg: '#ecfeff', color: '#0e7490' },
};

const AdminStaffActivityLog = () => {
    const [detailsLog, setDetailsLog] = useState(null);
    const [logs, setLogs]     = useState([]);
    const [total, setTotal]   = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [module, setModule] = useState('');
    const [actionType, setActionType] = useState('');
    const [page, setPage]     = useState(1);
    const limit = 50;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get('/admin/staff/activity-log', {
                params: { search, module, actionType, page, limit },
            });
            setLogs(data.logs || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error('Failed to fetch activity log:', error);
        } finally {
            setLoading(false);
        }
    }, [search, module, actionType, page]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <main className="admin-content" aria-label="Staff Activity Log">
            <div className="admin-card w12">
                <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Staff Activity Log (Total: {total})</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>Chronological record of staff logins, logouts, and account actions.</p>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div className="admin-search" style={{ maxWidth: '320px', flex: 1 }}>
                        <input type="search" placeholder="Search staff name or description..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                    </div>
                    <select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <option value="">All Modules</option>
                        <option value="auth">Auth</option>
                        <option value="staff">Staff</option>
                        <option value="profile">Profile</option>
                    </select>
                    <select value={actionType} onChange={(e) => { setActionType(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <option value="">All Actions</option>
                        <option value="login">Login</option>
                        <option value="logout">Logout</option>
                        <option value="create">Create</option>
                        <option value="edit">Edit</option>
                        <option value="delete">Delete</option>
                        <option value="password_change">Password Change</option>
                        <option value="profile_update">Profile Update</option>
                        <option value="force_logout">Force Logout</option>
                        <option value="page_view">Page View</option>
                        <option value="export">Report Download</option>
                    </select>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Date &amp; Time</th>
                                <th>Staff Name</th>
                                <th>Module</th>
                                <th>Action</th>
                                <th>Description</th>
                                <th>Record Name</th>
                                <th>IP Address</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No activity recorded yet.</td></tr>
                            ) : (
                                logs.map(log => {
                                    const c = ACTION_COLORS[log.action_type] || { bg: '#f1f5f9', color: '#475569' };
                                    return (
                                        <tr key={log.id}>
                                            <td>{fmtDate(log.created_at)}</td>
                                            <td style={{ fontWeight: 600 }}>{log.staff_name || '—'}</td>
                                            <td style={{ textTransform: 'capitalize' }}>{log.module}</td>
                                            <td>
                                                <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>
                                                    {log.action_type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>{log.description || '—'}</td>
                                            <td>{log.record_name || '—'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{log.ip_address || '—'}</td>
                                            <td>
                                                {log.metadata && (
                                                    <button onClick={() => setDetailsLog(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: 'var(--primary)', padding: 0, fontWeight: 600 }}>
                                                        🔍 View
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {detailsLog && <ActivityDetailsModal log={detailsLog} onClose={() => setDetailsLog(null)} />}

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="admin-btn">← Prev</button>
                        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--muted)' }}>Page {page} of {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn">Next →</button>
                    </div>
                )}
            </div>
        </main>
    );
};

export default AdminStaffActivityLog;
