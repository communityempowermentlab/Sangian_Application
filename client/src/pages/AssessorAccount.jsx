import React, { useState, useEffect } from 'react';
import axiosAssessor from '../services/axiosAssessor';

const fieldErrorStyle = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };

const AssessorAccount = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [pwErrors, setPwErrors] = useState({});
    const [pwSuccess, setPwSuccess] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axiosAssessor.get('/assessor/me');
                setProfile(data.assessor);
            } catch (err) {
                setLoadError(err.response?.data?.message || 'Failed to load profile.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        const errors = {};
        if (!currentPassword) errors.currentPassword = 'Current password is required.';
        if (!newPassword) {
            errors.newPassword = 'New password is required.';
        } else if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            errors.newPassword = 'Password must be at least 8 characters and include a letter and a number.';
        }
        if (Object.keys(errors).length) {
            setPwErrors(errors);
            setPwSuccess('');
            return;
        }

        setIsSaving(true);
        setPwErrors({});
        setPwSuccess('');
        try {
            await axiosAssessor.put('/assessor/change-password', { currentPassword, newPassword });
            setPwSuccess('Password changed successfully.');
            setCurrentPassword('');
            setNewPassword('');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to change password.';
            if (/current password/i.test(message)) setPwErrors({ currentPassword: message });
            else setPwErrors({ general: message });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <main className="main-shell" style={{ padding: '32px 24px' }}><p>Loading…</p></main>;

    return (
        <main className="main-shell" style={{ padding: '32px 24px', maxWidth: '700px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '22px', margin: '0 0 20px 0' }}>My Account</h1>

            {loadError && (
                <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                    ⚠️ {loadError}
                </div>
            )}

            {profile && (
                <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 10px rgba(15,23,42,0.06)', border: '1px solid #f1f5f9', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '15px', margin: '0 0 16px 0' }}>Profile</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 600, width: '160px', color: '#374151' }}>Name</td>
                                <td style={{ padding: '8px 0' }}>{profile.name}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Email Address</td>
                                <td style={{ padding: '8px 0' }}>
                                    {profile.email} <span style={{ fontSize: '11px', color: '#9ca3af' }}>(read-only)</span>
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Mobile Number</td>
                                <td style={{ padding: '8px 0' }}>
                                    {profile.mobile_number} <span style={{ fontSize: '11px', color: '#9ca3af' }}>(read-only)</span>
                                </td>
                            </tr>
                            {profile.org_name && (
                                <tr>
                                    <td style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Organization</td>
                                    <td style={{ padding: '8px 0' }}>{profile.org_name}</td>
                                </tr>
                            )}
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Status</td>
                                <td style={{ padding: '8px 0', textTransform: 'capitalize' }}>{profile.status}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p style={{ margin: '14px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>
                        Your email and mobile number can't be changed here — contact your administrator if either needs updating.
                    </p>
                </div>
            )}

            <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 10px rgba(15,23,42,0.06)', border: '1px solid #f1f5f9' }}>
                <h3 style={{ fontSize: '15px', margin: '0 0 16px 0' }}>Change Password</h3>

                {pwErrors.general && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        {pwErrors.general}
                    </div>
                )}
                {pwSuccess && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                        {pwSuccess}
                    </div>
                )}

                <form onSubmit={handleChangePassword} noValidate>
                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>Current Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => { setCurrentPassword(e.target.value); setPwErrors({}); setPwSuccess(''); }}
                                autoComplete="current-password"
                                style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: `1px solid ${pwErrors.currentPassword ? '#fca5a5' : '#e5e7eb'}`, boxSizing: 'border-box' }}
                            />
                            <button type="button" onClick={() => setShowCurrent(s => !s)} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '4px' }}>
                                {showCurrent ? '🙈' : '👁️'}
                            </button>
                        </div>
                        {pwErrors.currentPassword && <div style={fieldErrorStyle}>{pwErrors.currentPassword}</div>}
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => { setNewPassword(e.target.value); setPwErrors({}); setPwSuccess(''); }}
                                placeholder="Min 8 chars, letter + number"
                                autoComplete="new-password"
                                style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: `1px solid ${pwErrors.newPassword ? '#fca5a5' : '#e5e7eb'}`, boxSizing: 'border-box' }}
                            />
                            <button type="button" onClick={() => setShowNew(s => !s)} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '4px' }}>
                                {showNew ? '🙈' : '👁️'}
                            </button>
                        </div>
                        {pwErrors.newPassword && <div style={fieldErrorStyle}>{pwErrors.newPassword}</div>}
                    </div>

                    <button type="submit" className="btn modal-btn-primary" disabled={isSaving} style={{ padding: '10px 24px', borderRadius: '10px' }}>
                        {isSaving ? 'Saving…' : 'Change Password'}
                    </button>
                </form>
            </div>
        </main>
    );
};

export default AssessorAccount;
