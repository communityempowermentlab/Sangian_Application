import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { ADMIN_MODULES } from '../utils/staffPermissions';

const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' };

const AdminStaffAdd = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '', email: '', mobile: '', password: '', status: 'active',
    });
    const [permissions, setPermissions] = useState([]);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError('');
    };

    const togglePermission = (key) => {
        setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { name, email, mobile, password } = formData;
        if (!name.trim() || !email.trim() || !mobile.trim() || !password) {
            setError('All fields are mandatory.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address.');
            return;
        }
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Password must be at least 8 characters and include a letter and a number.');
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosAdmin.post('/admin/staff', { ...formData, permissions });
            navigate('/admin/staff');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create staff account.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="admin-content">
            <div className="admin-card w9">
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>➕ Add New Staff</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Create a staff account and choose which admin menus it can access.</p>
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
                            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Jane Doe" style={inputStyle} required />
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Email Address <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="staff@example.com" style={inputStyle} required />
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Mobile Number <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="text" name="mobile" value={formData.mobile} onChange={handleChange} placeholder="e.g. 9876543210" style={inputStyle} required />
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Password <span style={{ color: '#dc2626' }}>*</span></label>
                            <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Min 8 chars, letter + number" style={inputStyle} required />
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Menu Permissions</label>
                        <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '13px' }}>Only the checked menus will be visible to this staff member.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
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
                            {isSubmitting ? 'Creating...' : 'Create Staff Account'}
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

export default AdminStaffAdd;
