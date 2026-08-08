import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { isStaffSession } from '../utils/staffPermissions';

const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' };

const AdminStaffProfile = () => {
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({ name: '', mobile: '' });
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);
    const [pwMsg, setPwMsg] = useState(null);
    const [saving, setSaving] = useState(false);
    const [changingPw, setChangingPw] = useState(false);

    useEffect(() => {
        if (!isStaffSession()) { setLoading(false); return; }
        (async () => {
            try {
                const { data } = await axiosAdmin.get('/admin/staff/me/profile');
                setProfile(data.profile);
                setForm({ name: data.profile.name, mobile: data.profile.mobile });
            } catch (err) {
                setMsg({ type: 'error', text: 'Failed to load profile.' });
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const saveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMsg(null);
        try {
            await axiosAdmin.put('/admin/staff/me/profile', form);
            setMsg({ type: 'success', text: 'Profile updated successfully.' });
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile.' });
        } finally {
            setSaving(false);
        }
    };

    const changePassword = async (e) => {
        e.preventDefault();
        setPwMsg(null);
        if (pwForm.newPassword !== pwForm.confirmPassword) {
            setPwMsg({ type: 'error', text: 'New password and confirm password do not match.' });
            return;
        }
        setChangingPw(true);
        try {
            await axiosAdmin.put('/admin/staff/me/change-password', {
                currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword,
            });
            setPwMsg({ type: 'success', text: 'Password changed successfully.' });
            setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setPwMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
        } finally {
            setChangingPw(false);
        }
    };

    if (!isStaffSession()) {
        return (
            <main className="admin-content">
                <div className="admin-card w6">
                    <p>This page is for staff accounts. Admin accounts manage their profile from <Link to="/admin/settings">Settings</Link>.</p>
                </div>
            </main>
        );
    }

    if (loading) return <main className="admin-content"><div className="admin-card w6">Loading...</div></main>;

    return (
        <main className="admin-content">
            <div className="admin-card w6" style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: '18px', margin: '0 0 16px 0' }}>👤 My Profile</h3>
                {msg && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: msg.type === 'success' ? '#dcfce7' : '#fee2e2', color: msg.type === 'success' ? '#166534' : '#991b1b' }}>
                        {msg.text}
                    </div>
                )}
                <form onSubmit={saveProfile}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Name</label>
                        <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} required />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Email Address</label>
                        <input type="email" value={profile.email} disabled style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8' }} />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={labelStyle}>Mobile Number</label>
                        <input type="text" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} style={inputStyle} required />
                    </div>
                    <button type="submit" disabled={saving} style={{ padding: '10px 22px', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </form>
            </div>

            <div className="admin-card w6">
                <h3 style={{ fontSize: '18px', margin: '0 0 16px 0' }}>🔒 Change Password</h3>
                {pwMsg && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: pwMsg.type === 'success' ? '#dcfce7' : '#fee2e2', color: pwMsg.type === 'success' ? '#166534' : '#991b1b' }}>
                        {pwMsg.text}
                    </div>
                )}
                <form onSubmit={changePassword}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Current Password</label>
                        <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} style={inputStyle} required />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>New Password</label>
                        <input type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} placeholder="Min 8 chars, letter + number" style={inputStyle} required />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label style={labelStyle}>Confirm New Password</label>
                        <input type="password" value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} style={inputStyle} required />
                    </div>
                    <button type="submit" disabled={changingPw} style={{ padding: '10px 22px', borderRadius: 10, background: '#7c3aed', color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer', opacity: changingPw ? 0.7 : 1 }}>
                        {changingPw ? 'Changing...' : 'Change Password'}
                    </button>
                </form>
            </div>
        </main>
    );
};

export default AdminStaffProfile;
