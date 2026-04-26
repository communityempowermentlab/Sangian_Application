import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const AdminAssessorsList = () => {
    const [assessors, setAssessors] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAssessors();
    }, []);

    const fetchAssessors = async () => {
        try {
            const response = await axiosAdmin.get('/admin/assessors');
            setAssessors(response.data);
        } catch (error) {
            console.error('Failed to fetch assessors:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAssessors = assessors.filter(assessor =>
        assessor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assessor.mobile_number?.includes(searchTerm)
    );

    return (
        <main className="admin-content" aria-label="Assessors List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Manage Assessors (Total: {assessors.length})</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>Standalone module for managing clinical assessors.</p>
                    </div>
                    <div className="admin-actions">
                        <Link to="/admin/assessors/add" style={{ padding: '11px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#ffffff', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', border: 'none', fontSize: '14px', transition: 'all 0.2s' }}>
                            <span style={{ fontSize: '16px' }}>➕</span> Add New Assessor
                        </Link>
                    </div>
                </div>

                <div className="admin-grid" style={{ marginTop: '12px' }}>
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <div className="admin-search" style={{ marginBottom: '16px', maxWidth: '400px' }}>
                            <input
                                type="search"
                                placeholder="Search name, email, or mobile..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Assessor Name</th>
                                        <th>Email ID</th>
                                        <th>Mobile Number</th>
                                        <th>Registered Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>Loading assessors...</td></tr>
                                    ) : filteredAssessors.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No assessors found.</td></tr>
                                    ) : (
                                        filteredAssessors.map((assessor, index) => (
                                            <tr key={assessor.id}>
                                                <td>{index + 1}</td>
                                                <td style={{ fontWeight: '600' }}>{assessor.name}</td>
                                                <td>{assessor.email}</td>
                                                <td>{assessor.mobile_number}</td>
                                                <td>{new Date(assessor.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td>
                                                    {assessor.status === 'active' ? (
                                                        <span className="admin-tag good">Active</span>
                                                    ) : (
                                                        <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '16px' }}>
                                                        <Link to={`/admin/assessors/edit/${assessor.id}`} style={{ textDecoration: 'none', fontSize: '13px', color: 'var(--primary)' }}>✏️ Edit / Toggle Status</Link>
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

export default AdminAssessorsList;
