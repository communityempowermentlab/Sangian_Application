import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const AdminIndividualsList = () => {
    const [individuals, setIndividuals] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchIndividuals = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (searchTerm) params.search = searchTerm;
            const response = await axiosAdmin.get('/admin/individuals', { params });
            setIndividuals(response.data.individuals || []);
        } catch (error) {
            console.error('Failed to fetch individuals:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(fetchIndividuals, 250);
        return () => clearTimeout(t);
    }, [statusFilter, searchTerm]);

    return (
        <main className="admin-content" aria-label="Individuals List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Individual Accounts (Total: {individuals.length})</h3>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>Self-registered individual users — active immediately on registration, no approval needed.</p>
                    </div>
                </div>

                <div className="admin-grid" style={{ marginTop: '12px' }}>
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <div className="admin-search" style={{ maxWidth: '360px', flex: 1 }}>
                                <input
                                    type="search"
                                    placeholder="Search name, email, or mobile..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                <option value="">All statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Full Name</th>
                                        <th>Email</th>
                                        <th>Mobile</th>
                                        <th>Registered</th>
                                        <th>Last Login</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>Loading individuals...</td></tr>
                                    ) : individuals.length === 0 ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No individual accounts found.</td></tr>
                                    ) : (
                                        individuals.map((ind, index) => (
                                            <tr key={ind.id}>
                                                <td>{index + 1}</td>
                                                <td style={{ fontWeight: '600' }}>{ind.full_name}</td>
                                                <td>{ind.email}</td>
                                                <td>{ind.mobile}</td>
                                                <td>{fmtDateTime(ind.registration_date)}</td>
                                                <td>{fmtDateTime(ind.last_login)}</td>
                                                <td>
                                                    {ind.status === 'active'
                                                        ? <span className="admin-tag good">Active</span>
                                                        : <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>}
                                                </td>
                                                <td>
                                                    <Link to={`/admin/individuals/${ind.id}`} style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                                                        ✏️ View / Edit
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
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

export default AdminIndividualsList;
