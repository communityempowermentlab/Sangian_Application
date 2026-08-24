import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { ADMIN_MODULES, isOrgSession, isStaffSession } from '../utils/staffPermissions';

const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' };

// Only a true Super Admin session may reassign a staff account's
// organization — an Organization login (or an org-bound Staff account)
// always keeps the account bound to its own org, server-side (see
// staffController.js's updateStaff).
const isAdminSession = !isOrgSession() && !isStaffSession();

const AdminStaffEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [formData, setFormData] = useState({ name: '', email: '', mobile: '', status: 'active', org_id: '' });
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orgOptions, setOrgOptions] = useState([]);
    const [newPassword, setNewPassword] = useState('');
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');
    const [pwSubmitting, setPwSubmitting] = useState(false);

    useEffect(() => {
        if (!isAdminSession) return;
        axiosAdmin.get('/admin/organizations')
            .then(res => setOrgOptions(res.data.organizations || []))
            .catch(err => console.error('Failed to fetch organizations:', err));
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axiosAdmin.get(`/admin/staff/${id}`);
                const s = data.staff;
                setFormData({ name: s.name, email: s.email, mobile: s.mobile, status: s.status, org_id: s.org_id || '' });
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
        if (isAdminSession && !formData.org_id) {
            setError('Please select an organization.');
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosAdmin.put(`/admin/staff/${id}`, { name, email, mobile, status, permissions, org_id: formData.org_id });
            navigate('/admin/staff');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update staff account.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitReset = async (e) => {
        e.preventDefault();
        setPwError('');
        setPwSuccess('');
        if (!newPassword) return;
        setPwSubmitting(true);
        try {
            await axiosAdmin.put(`/admin/staff/${id}/reset-password`, { newPassword });
            setPwSuccess('Password reset successfully.');
            setNewPassword('');
        } catch (err) {
            setPwError(err.response?.data?.message || 'Failed to reset password.');
        } finally {
            setPwSubmitting(false);
        }
    };

    if (loading) return <main className="admin-content"><div className="admin-card w9">Loading...</div></main>;

    return (
        <main className="admin-content">
            <div className="admin-card w9">
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>✏️ Edit Staff</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Update account details, menu permissions, and password.</p>
                </div>

                <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        style={{
                            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                            fontSize: '14px', fontWeight: 600,
                            color: activeTab === 'profile' ? 'var(--primary)' : '#6b7280',
                            borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent',
                            marginBottom: '-1px',
                        }}
                    >
                        Edit Profile
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('password')}
                        style={{
                            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                            fontSize: '14px', fontWeight: 600,
                            color: activeTab === 'password' ? 'var(--primary)' : '#6b7280',
                            borderBottom: activeTab === 'password' ? '2px solid var(--primary)' : '2px solid transparent',
                            marginBottom: '-1px',
                        }}
                    >
                        Reset Password
                    </button>
                </div>

                {activeTab === 'profile' && (
                <>
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
                        {isAdminSession && (
                            <div className="form-group">
                                <label style={labelStyle}>Organization <span style={{ color: '#dc2626' }}>*</span></label>
                                <select name="org_id" value={formData.org_id} onChange={handleChange} style={{ ...inputStyle, background: '#fff' }}>
                                    <option value="">Select organization</option>
                                    {orgOptions.map(o => <option key={o.id} value={o.id}>{o.org_name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Menu Permissions</label>
                        <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '13px' }}>Only the checked menus will be visible to this staff member. Takes effect immediately.</p>
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
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link to="/admin/staff" style={{ padding: '12px 24px', borderRadius: '10px', background: '#f3f4f6', color: '#374151', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' }}>
                            Cancel
                        </Link>
                    </div>
                </form>
                </>
                )}

                {activeTab === 'password' && (
                    <div style={{ maxWidth: '420px' }}>
                        <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '14px' }}>
                            Set a new password for this staff account. They'll use it the next time they log in.
                        </p>

                        {pwError && (
                            <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                                ⚠️ {pwError}
                            </div>
                        )}
                        {pwSuccess && (
                            <div style={{ padding: '12px 16px', background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                                ✅ {pwSuccess}
                            </div>
                        )}

                        <form onSubmit={submitReset}>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={labelStyle}>New Password <span style={{ color: '#dc2626' }}>*</span></label>
                                <input
                                    type="text"
                                    placeholder="Min 8 chars, letter + number"
                                    value={newPassword}
                                    onChange={(e) => { setNewPassword(e.target.value); if (pwError) setPwError(''); }}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={pwSubmitting || !newPassword} style={{ padding: '12px 24px', borderRadius: '10px', background: 'var(--primary)', color: '#ffffff', fontWeight: 'bold', border: 'none', cursor: (pwSubmitting || !newPassword) ? 'not-allowed' : 'pointer', opacity: (pwSubmitting || !newPassword) ? 0.7 : 1 }}>
                                {pwSubmitting ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </main>
    );
};

export default AdminStaffEdit;
