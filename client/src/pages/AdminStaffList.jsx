import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { isStaffSession, isOrgSession, canPerform } from '../utils/staffPermissions';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const AdminStaffList = () => {
    const [staff, setStaff]         = useState([]);
    const [total, setTotal]         = useState(0);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [status, setStatus]       = useState('');
    const [orgFilter, setOrgFilter] = useState('');
    const [orgOptions, setOrgOptions] = useState([]);
    const [sortKey, setSortKey]     = useState('created_at');
    const [sortDir, setSortDir]     = useState('desc');
    const [page, setPage]           = useState(1);
    const limit = 20;

    const isAdmin = !isStaffSession() && !isOrgSession();

    // /admin/organizations is itself Super-Admin-only server-side (same
    // endpoint AdminStaffAdd/Edit already use for their own Organization
    // picker) — fetched independently of the paginated staff list so the
    // filter's option set doesn't depend on what's on the current page.
    useEffect(() => {
        if (!isAdmin) return;
        axiosAdmin.get('/admin/organizations')
            .then(res => setOrgOptions(res.data.organizations || []))
            .catch(err => console.error('Failed to fetch organizations:', err));
    }, [isAdmin]);

    const fetchStaff = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get('/admin/staff', {
                params: { search, status, orgId: orgFilter, sortKey, sortDir, page, limit },
            });
            setStaff(data.staff || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error('Failed to fetch staff:', error);
        } finally {
            setLoading(false);
        }
    }, [search, status, orgFilter, sortKey, sortDir, page]);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const totalPages = Math.max(1, Math.ceil(total / limit));
    // Organization column — shown to Super Admin/staff sessions (who may
    // see records across multiple organizations), hidden for an
    // Organization login since every row is already scoped to their own
    // org (see requireAdminOrOrgAuth.js / resolveOrgScope.js).
    const isOrg = isOrgSession();

    return (
        <main className="admin-content" aria-label="Staff List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Staff Management (Total: {total})</h3>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>Create staff accounts and control which admin menus each one can access.</p>
                    </div>
                    {canPerform('staff', 'add') && (
                        <Link to="/admin/staff/add" style={{ padding: '11px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#ffffff', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', border: 'none', fontSize: '14px' }}>
                            <span style={{ fontSize: '16px' }}>➕</span> Add New Staff
                        </Link>
                    )}
                </div>

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
                            {isAdmin && orgOptions.length > 0 && (
                                <select value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setPage(1); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <option value="">All Organizations</option>
                                    {orgOptions.map(o => (
                                        <option key={o.id} value={o.id}>{o.org_name}</option>
                                    ))}
                                </select>
                            )}
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
                                        {!isOrg && <th>Organization</th>}
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
                                        <tr><td colSpan={isOrg ? 8 : 9} style={{ textAlign: 'center', padding: '20px' }}>Loading staff...</td></tr>
                                    ) : staff.length === 0 ? (
                                        <tr><td colSpan={isOrg ? 8 : 9} style={{ textAlign: 'center', padding: '20px' }}>No staff accounts found.</td></tr>
                                    ) : (
                                        staff.map((member, index) => (
                                            <tr key={member.id}>
                                                <td>{(page - 1) * limit + index + 1}</td>
                                                {!isOrg && <td>{member.org_name || '—'}</td>}
                                                <td style={{ fontWeight: 600 }}>{member.name}</td>
                                                <td>{member.email}</td>
                                                <td>{member.mobile}</td>
                                                <td>
                                                    {member.status === 'active'
                                                        ? <span className="admin-tag good">Active</span>
                                                        : <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>}
                                                </td>
                                                <td>{fmtDate(member.last_login)}</td>
                                                <td>{fmtDate(member.created_at)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                        {canPerform('staff', 'edit') && (
                                                            <Link to={`/admin/staff/edit/${member.id}`} style={{ textDecoration: 'none', fontSize: '13px', color: 'var(--primary)' }}>✏️ Edit</Link>
                                                        )}
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
        </main>
    );
};

export default AdminStaffList;
