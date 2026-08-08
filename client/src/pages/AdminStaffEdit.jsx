import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { ADMIN_MODULES } from '../utils/staffPermissions';

const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' };

const AdminStaffEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ name: '', email: '', mobile: '', status: 'active' });
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axiosAdmin.get(`/admin/staff/${id}`);
                const s = data.staff;
                setFormData({ name: s.name, email: s.email, mobile: s.mobile, status: s.status });
                setPermissions(Array.isArray(s.permissions) ? s.permissions : []);
            } catch (err) {
                setError('Failed to load staff account.');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError('');
    };

    const togglePermission = (key) => {
        setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { name, email, mobile, status } = formData;
        if (!name.trim() || !email.trim() || !mobile.trim()) {
            setError('All fields are mandatory.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosAdmin.put(`/admin/staff/${id}`, { name, email, mobile, status, permissions });
            navigate('/admin/staff');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update staff account.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <main className="admin-content"><div className="admin-card w9">Loading...</div></main>;

    return (
        <main className="admin-content">
            <div className="admin-card w9">
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>✏️ Edit Staff</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Update account details and menu permissions.</p>
                </div>

                {error && (
                    <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        <div className="form-group">
                            <label style={labelStyle}>Staff Name <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} style={inputStyle} required />
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Email Address <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} style={inputStyle} required />
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Mobile Number <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="text" name="mobile" value={formData.mobile} onChange={handleChange} style={inputStyle} required />
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} style={inputStyle}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Menu Permissions</label>
                        <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '13px' }}>Only the checked menus will be visible to this staff member. Takes effect immediately.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                            {ADMIN_MODULES.map(m => (
                                <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={permissions.includes(m.key)} onChange={() => togglePermission(m.key)} />
                                    {m.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button type="submit" disabled={isSubmitting} style={{ padding: '12px 24px', borderRadius: '10px', background: 'var(--primary)', color: '#ffffff', fontWeight: 'bold', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link to="/admin/staff" style={{ padding: '12px 24px', borderRadius: '10px', background: '#f3f4f6', color: '#374151', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' }}>
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
};

export default AdminStaffEdit;
