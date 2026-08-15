import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_TAG = {
    pending:   { label: 'Pending Approval', style: { background: '#fef9c3', color: '#854d0e', borderColor: '#fde68a' } },
    approved:  { label: 'Approved',         style: {} }, // uses default "good" tag
    rejected:  { label: 'Rejected',         style: { background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' } },
    suspended: { label: 'Suspended',        style: { background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' } },
};

const AdminOrganizationsList = () => {
    const [organizations, setOrganizations] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchOrganizations = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.registration_status = statusFilter;
            if (searchTerm) params.search = searchTerm;
            const response = await axiosAdmin.get('/admin/organizations', { params });
            setOrganizations(response.data.organizations || []);
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(fetchOrganizations, 250);
        return () => clearTimeout(t);
    }, [statusFilter, searchTerm]);

    const pendingCount = organizations.filter(o => o.registration_status === 'pending').length;

    return (
        <main className="admin-content" aria-label="Organizations List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Organizations (Total: {organizations.length})</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>
                            {pendingCount > 0 ? `${pendingCount} organization(s) awaiting approval.` : 'Approve, reject, suspend, or reactivate registered organizations.'}
                        </p>
                    </div>
                </div>

                <div className="admin-grid" style={{ marginTop: '12px' }}>
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <div className="admin-search" style={{ maxWidth: '360px', flex: 1 }}>
                                <input
                                    type="search"
                                    placeholder="Search organization, email, or contact person..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                <option value="">All statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Organization</th>
                                        <th>Type</th>
                                        <th>Email</th>
                                        <th>Contact Person</th>
                                        <th>City</th>
                                        <th>Registered</th>
                                        <th>Last Login</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>Loading organizations...</td></tr>
                                    ) : organizations.length === 0 ? (
                                        <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>No organizations found.</td></tr>
                                    ) : (
                                        organizations.map((org, index) => {
                                            const tag = STATUS_TAG[org.registration_status] || STATUS_TAG.pending;
                                            return (
                                                <tr key={org.id}>
                                                    <td>{index + 1}</td>
                                                    <td style={{ fontWeight: '600' }}>{org.org_name}</td>
                                                    <td style={{ textTransform: 'capitalize' }}>{org.org_type}</td>
                                                    <td>{org.org_email}</td>
                                                    <td>{org.contact_person_name}</td>
                                                    <td>{org.city || '—'}</td>
                                                    <td>{fmtDateTime(org.created_at)}</td>
                                                    <td>{fmtDateTime(org.last_login)}</td>
                                                    <td>
                                                        {org.registration_status === 'approved'
                                                            ? <span className="admin-tag good">Approved</span>
                                                            : <span className="admin-tag warn" style={tag.style}>{tag.label}</span>}
                                                    </td>
                                                    <td>
                                                        <Link to={`/admin/organizations/${org.id}/profile`} style={{ textDecoration: 'none', fontSize: '13px', color: 'var(--primary)' }}>🔍 View / Manage</Link>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default AdminOrganizationsList;
