import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { isOrgSession, isStaffSession } from '../utils/staffPermissions';

// Only a true Super Admin session may reassign a group's organization — an
// Organization login (or an org-bound Staff account) always keeps the
// group bound to its own org, server-side (see
// adminChildGroupController.js's updateGroup).
const isAdminSession = !isOrgSession() && !isStaffSession();

const AdminChildGroupEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'active',
        org_id: '',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orgOptions, setOrgOptions] = useState([]);

    useEffect(() => {
        fetchGroup();
    }, [id]);

    useEffect(() => {
        if (!isAdminSession) return;
        axiosAdmin.get('/admin/organizations')
            .then(res => setOrgOptions(res.data.organizations || []))
            .catch(err => console.error('Failed to fetch organizations:', err));
    }, []);

    const fetchGroup = async () => {
        try {
            const response = await axiosAdmin.get(`/admin/child-groups/${id}`);
            setFormData({
                name: response.data.name,
                description: response.data.description || '',
                status: response.data.status || 'active',
                org_id: response.data.org_id || '',
            });
        } catch (err) {
            setError('Failed to fetch child group details.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.status) {
            setError('Group name and status are mandatory.');
            return;
        }
        if (isAdminSession && !formData.org_id) {
            setError('Please select an organization.');
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosAdmin.put(`/admin/child-groups/${id}`, formData);
            navigate('/admin/child-groups');
        } catch (err) {
            console.error('Update child group error:', err);
            const serverMessage = err.response?.data?.message;
            if (serverMessage) {
                setError(serverMessage);
            } else {
                setError('Failed to update child group. Check if name is already taken or server logs.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="admin-content"><p>Loading details...</p></div>;

    return (
        <main className="admin-content">
            <div className="admin-card w6">
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>✏️ Edit Child Group</h3>
                    <p style={{ margin: '0', color: 'var(--muted)', fontSize: '14px' }}>Update the details for this child group, or toggle its status.</p>
                </div>

                {error && (
                    <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '24px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Group Name <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none' }}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Status <span style={{ color: '#dc2626' }}>*</span></label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', background: '#ffffff' }}
                                required
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '12px' }}>Inactive groups stay visible on children already assigned to them, but won't appear as an option when assigning groups to a child going forward.</p>
                        </div>

                        {isAdminSession && (
                            <div className="form-group">
                                <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Organization <span style={{ color: '#dc2626' }}>*</span></label>
                                <select
                                    name="org_id"
                                    value={formData.org_id}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', background: '#fff' }}
                                >
                                    <option value="">Select organization</option>
                                    {orgOptions.map(o => <option key={o.id} value={o.id}>{o.org_name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            style={{ padding: '12px 24px', borderRadius: '10px', background: 'var(--primary)', color: '#ffffff', fontWeight: 'bold', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link
                            to="/admin/child-groups"
                            style={{ padding: '12px 24px', borderRadius: '10px', background: '#f3f4f6', color: '#374151', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' }}
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
};

export default AdminChildGroupEdit;
