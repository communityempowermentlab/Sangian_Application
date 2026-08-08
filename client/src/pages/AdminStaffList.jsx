import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { isStaffSession } from '../utils/staffPermissions';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const AdminStaffList = () => {
    const [staff, setStaff]         = useState([]);
    const [total, setTotal]         = useState(0);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [status, setStatus]       = useState('');
    const [sortKey, setSortKey]     = useState('created_at');
    const [sortDir, setSortDir]     = useState('desc');
    const [page, setPage]           = useState(1);
    const [resetTarget, setResetTarget] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [actionMsg, setActionMsg] = useState(null);
    const limit = 20;

    const fetchStaff = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get('/admin/staff', {
                params: { search, status, sortKey, sortDir, page, limit },
            });
            setStaff(data.staff || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error('Failed to fetch staff:', error);
        } finally {
            setLoading(false);
        }
    }, [search, status, sortKey, sortDir, page]);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const handleDelete = async (member) => {
        if (!window.confirm(`Delete staff account "${member.name}"? This can't be undone.`)) return;
        try {
            await axiosAdmin.delete(`/admin/staff/${member.id}`);
            setActionMsg({ type: 'success', text: 'Staff account deleted.' });
            fetchStaff();
        } catch (error) {
            setActionMsg({ type: 'error', text: error.response?.data?.message || 'Failed to delete staff account.' });
        }
    };

    const submitReset = async () => {
        if (!newPassword) return;
        try {
            await axiosAdmin.put(`/admin/staff/${resetTarget.id}/reset-password`, { newPassword });
            setActionMsg({ type: 'success', text: `Password reset for ${resetTarget.name}.` });
            setResetTarget(null);
            setNewPassword('');
        } catch (error) {
            setActionMsg({ type: 'error', text: error.response?.data?.message || 'Failed to reset password.' });
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const isAdmin = !isStaffSession();

    return (
        <main className="admin-content" aria-label="Staff List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Staff Management (Total: {total})</h3>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>Create staff accounts and control which admin menus each one can access.</p>
                    </div>
                    <Link to="/admin/staff/add" style={{ padding: '11px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#ffffff', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', border: 'none', fontSize: '14px' }}>
                        <span style={{ fontSize: '16px' }}>➕</span> Add New Staff
                    </Link>
                </div>

                {actionMsg && (
                    <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: actionMsg.type === 'success' ? '#dcfce7' : '#fee2e2', color: actionMsg.type === 'success' ? '#166534' : '#991b1b' }}>
                        {actionMsg.text}
                    </div>
                )}

                <div className="admin-grid" style={{ marginTop: '12px' }}>
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                            <div className="admin-search" style={{ maxWidth: '360px', flex: 1 }}>
                                <input
                                    type="search"
                                    placeholder="Search name, email, or mobile..."
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                />
                            </div>
                            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>Staff Name {sortKey === 'name' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                                        <th onClick={() => toggleSort('email')} style={{ cursor: 'pointer' }}>Email Address {sortKey === 'email' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                                        <th>Mobile Number</th>
                                        <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>Status {sortKey === 'status' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                                        <th onClick={() => toggleSort('last_login')} style={{ cursor: 'pointer' }}>Last Login {sortKey === 'last_login' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                                        <th onClick={() => toggleSort('created_at')} style={{ cursor: 'pointer' }}>Created {sortKey === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>Loading staff...</td></tr>
                                    ) : staff.length === 0 ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No staff accounts found.</td></tr>
                                    ) : (
                                        staff.map((member, index) => (
                                            <tr key={member.id}>
                                                <td>{(page - 1) * limit + index + 1}</td>
                                                <td style={{ fontWeight: 600 }}>{member.name}</td>
                                                <td>{member.email}</td>
                                                <td>{member.mobile}</td>
                                                <td>
                                                    {member.status === 'active'
                                                        ? <span className="admin-tag good">Active</span>
                                                        : <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>}
                                                </td>
                                                <td>
                                                    {isAdmin ? (
                                                        <Link to={`/admin/staff/${member.id}/log-history`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                                            {fmtDate(member.last_login)}
                                                        </Link>
                                                    ) : fmtDate(member.last_login)}
                                                </td>
                                                <td>{fmtDate(member.created_at)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                        <Link to={`/admin/staff/edit/${member.id}`} style={{ textDecoration: 'none', fontSize: '13px', color: 'var(--primary)' }}>✏️ Edit</Link>
                                                        {isAdmin && (
                                                            <Link to={`/admin/staff/${member.id}/log-history`} style={{ textDecoration: 'none', fontSize: '13px', color: '#0369a1' }}>📜 Log History</Link>
                                                        )}
                                                        <button onClick={() => { setResetTarget(member); setNewPassword(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#7c3aed', padding: 0 }}>🔑 Reset Password</button>
                                                        <button onClick={() => handleDelete(member)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#dc2626', padding: 0 }}>🗑️ Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="admin-btn">← Prev</button>
                                <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--muted)' }}>Page {page} of {totalPages}</span>
                                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn">Next →</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {resetTarget && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setResetTarget(null)}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380 }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Reset Password — {resetTarget.name}</h3>
                        <input
                            type="text"
                            placeholder="New password (min 8 chars, letter + number)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16, boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={() => setResetTarget(null)} className="admin-btn">Cancel</button>
                            <button onClick={submitReset} className="admin-btn admin-btn-primary">Reset Password</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default AdminStaffList;
