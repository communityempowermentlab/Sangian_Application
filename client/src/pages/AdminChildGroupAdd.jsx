import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { isOrgSession, isStaffSession } from '../utils/staffPermissions';

// Only a true Super Admin session picks an organization explicitly — an
// Organization login (or an org-bound Staff account) always gets the new
// group bound to its own org automatically, server-side (see
// adminChildGroupController.js's addGroup).
const isAdminSession = !isOrgSession() && !isStaffSession();

const AdminChildGroupAdd = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        org_id: '',
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orgOptions, setOrgOptions] = useState([]);

    useEffect(() => {
        if (!isAdminSession) return;
        axiosAdmin.get('/admin/organizations')
            .then(res => setOrgOptions(res.data.organizations || []))
            .catch(err => console.error('Failed to fetch organizations:', err));
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Group name is required.');
            return;
        }
        if (isAdminSession && !formData.org_id) {
            setError('Please select an organization.');
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosAdmin.post('/admin/child-groups', formData);
            navigate('/admin/child-groups');
        } catch (err) {
            console.error('Add child group error:', err);
            const serverMessage = err.response?.data?.message;
            if (serverMessage) {
                setError(serverMessage);
            } else if (err.message === "Network Error") {
                setError('Network Error: Cannot connect to the server. Please ensure the backend is running.');
            } else {
                setError('Failed to add child group. Please check uniqueness of name or server logs.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="admin-content">
            <div className="admin-card w6">
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>➕ Add New Child Group</h3>
                    <p style={{ margin: '0', color: 'var(--muted)', fontSize: '14px' }}>Create a new group to organize children into (e.g. Main Group, Testing Group).</p>
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
                                placeholder="e.g. Main Group"
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
                                placeholder="Optional description of this group's purpose"
                                rows={3}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                            />
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
                            {isSubmitting ? 'Adding...' : 'Add Group'}
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

export default AdminChildGroupAdd;
