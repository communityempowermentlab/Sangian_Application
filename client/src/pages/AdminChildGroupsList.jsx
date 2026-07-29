import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const AdminChildGroupsList = () => {
    const [groups, setGroups] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await axiosAdmin.get('/admin/child-groups');
            setGroups(response.data);
        } catch (error) {
            console.error('Failed to fetch child groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredGroups = groups.filter(group =>
        group.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <main className="admin-content" aria-label="Child Groups List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Manage Child Groups (Total: {groups.length})</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>Organize children into groups such as Main Group, Testing Group, or other custom categories.</p>
                    </div>
                    <div className="admin-actions">
                        <Link to="/admin/child-groups/add" style={{ padding: '11px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#ffffff', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', border: 'none', fontSize: '14px', transition: 'all 0.2s' }}>
                            <span style={{ fontSize: '16px' }}>➕</span> Add New Group
                        </Link>
                    </div>
                </div>

                <div className="admin-grid" style={{ marginTop: '12px' }}>
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <div className="admin-search" style={{ marginBottom: '16px', maxWidth: '400px' }}>
                            <input
                                type="search"
                                placeholder="Search name or description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Group Name</th>
                                        <th>Description</th>
                                        <th>Children</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Loading child groups...</td></tr>
                                    ) : filteredGroups.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No child groups found.</td></tr>
                                    ) : (
                                        filteredGroups.map((group, index) => (
                                            <tr key={group.id}>
                                                <td>{index + 1}</td>
                                                <td style={{ fontWeight: '600' }}>{group.name}</td>
                                                <td>{group.description || '—'}</td>
                                                <td>{group.member_count ?? 0}</td>
                                                <td>
                                                    {group.status === 'active' ? (
                                                        <span className="admin-tag good">Active</span>
                                                    ) : (
                                                        <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '16px' }}>
                                                        <Link to={`/admin/child-groups/edit/${group.id}`} style={{ textDecoration: 'none', fontSize: '13px', color: 'var(--primary)' }}>✏️ Edit / Toggle Status</Link>
                                                    </div>
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

export default AdminChildGroupsList;
