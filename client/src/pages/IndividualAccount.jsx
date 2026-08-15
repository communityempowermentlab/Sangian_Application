import React, { useState, useEffect } from 'react';
import axiosIndividual from '../services/axiosIndividual';
import PasswordStrengthChecklist, { isStrongPassword } from '../components/shared/PasswordStrengthChecklist';

const fieldErrorStyle = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };
const GENDER_OPTIONS = [
    ['male', 'Male'],
    ['female', 'Female'],
];
const DOB_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOB_CURRENT_YEAR = new Date().getFullYear();

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
// The server returns dob as a UTC-serialized timestamp for a value that's
// actually a local-midnight DATE — .toISOString() would shift it back a
// day near the server's UTC offset. Local getters avoid that (matches the
// same fix in adminIndividualController.js's toDateOnlyString).
const dobParts = (iso) => {
    if (!iso) return { day: '', month: '', year: '' };
    const d = new Date(iso);
    return { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
};
const GENDER_LABEL = { female: 'Female', male: 'Male', other: 'Other', prefer_not_to_say: 'Prefer not to say' };

const IndividualAccount = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [editing, setEditing] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [dobDay, setDobDay] = useState('');
    const [dobMonth, setDobMonth] = useState('');
    const [dobYear, setDobYear] = useState('');
    const [genderInput, setGenderInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState({ type: '', text: '' });

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [pwErrors, setPwErrors] = useState({});
    const [pwSuccess, setPwSuccess] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data } = await axiosIndividual.get('/individual/me');
            setProfile(data.profile);
        } catch (err) {
            setLoadError(err.response?.data?.message || 'Failed to load profile.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProfile(); }, []);

    const startEditing = () => {
        setNameInput(profile.full_name);
        const parts = dobParts(profile.dob);
        setDobDay(parts.day); setDobMonth(parts.month); setDobYear(parts.year);
        setGenderInput(GENDER_OPTIONS.some(([v]) => v === profile.gender) ? profile.gender : '');
        setEditing(true);
        setSaveMsg({ type: '', text: '' });
    };

    const nameOk = nameInput.trim().length > 0;
    const dobString = (dobDay && dobMonth && dobYear) ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}` : '';
    const dobOk = !!dobString && !isNaN(new Date(dobString).getTime());
    const genderOk = !!genderInput;
    const canSave = nameOk && dobOk && genderOk;

    const handleSaveProfile = async () => {
        setSaving(true);
        setSaveMsg({ type: '', text: '' });
        try {
            await axiosIndividual.put('/individual/profile', { full_name: nameInput.trim(), dob: dobString, gender: genderInput });
            setSaveMsg({ type: 'ok', text: 'Profile updated successfully.' });
            setEditing(false);
            await fetchProfile();
        } catch (err) {
            setSaveMsg({ type: 'err', text: err.response?.data?.message || 'Failed to update profile.' });
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        const errors = {};
        if (!currentPassword) errors.currentPassword = 'Current password is required.';
        if (!newPassword) errors.newPassword = 'New password is required.';
        else if (!isStrongPassword(newPassword)) errors.newPassword = 'Password does not meet the requirements below.';
        if (Object.keys(errors).length) {
            setPwErrors(errors);
            setPwSuccess('');
            return;
        }

        setIsSaving(true);
        setPwErrors({});
        setPwSuccess('');
        try {
            await axiosIndividual.put('/individual/change-password', { currentPassword, newPassword });
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h3 style={{ margin: 0, fontSize: '15px' }}>Profile</h3>
                        {!editing && (
                            <button className="btn nav-btn-outline" onClick={startEditing}>✏️ Edit</button>
                        )}
                    </div>
                    <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#9ca3af' }}>
                        Your email and mobile number can't be changed here.
                    </p>

                    {saveMsg.text && (
                        <div style={{
                            padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
                            background: saveMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                            color: saveMsg.type === 'ok' ? '#16a34a' : '#dc2626',
                            border: `1px solid ${saveMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                        }}>{saveMsg.text}</div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 600, width: '160px', color: '#374151', verticalAlign: 'top' }}>Full Name</td>
                                <td style={{ padding: '8px 0' }}>
                                    {editing ? (
                                        <div>
                                            <input
                                                type="text"
                                                value={nameInput}
                                                onChange={e => setNameInput(e.target.value)}
                                                style={{ width: '100%', maxWidth: '320px', padding: '8px 10px', borderRadius: '6px', border: `1px solid ${!nameOk ? '#fca5a5' : '#e5e7eb'}`, boxSizing: 'border-box' }}
                                            />
                                            {!nameOk && <div style={fieldErrorStyle}>Full name cannot be empty.</div>}
                                        </div>
                                    ) : profile.full_name}
                                </td>
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
                                    {profile.mobile} <span style={{ fontSize: '11px', color: '#9ca3af' }}>(read-only)</span>
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 600, color: '#374151', verticalAlign: 'top' }}>Date of Birth</td>
                                <td style={{ padding: '8px 0' }}>
                                    {editing ? (
                                        <div>
                                            <div style={{ display: 'flex', gap: '8px', maxWidth: '320px' }}>
                                                <select value={dobDay} onChange={e => setDobDay(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}>
                                                    <option value="">Day</option>
                                                    {[...Array(31)].map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                                                </select>
                                                <select value={dobMonth} onChange={e => setDobMonth(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}>
                                                    <option value="">Month</option>
                                                    {DOB_MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                                                </select>
                                                <select value={dobYear} onChange={e => setDobYear(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}>
                                                    <option value="">Year</option>
                                                    {[...Array(100)].map((_, i) => {
                                                        const y = DOB_CURRENT_YEAR - i;
                                                        return <option key={y} value={String(y)}>{y}</option>;
                                                    })}
                                                </select>
                                            </div>
                                            {!dobOk && (dobDay || dobMonth || dobYear) && <div style={fieldErrorStyle}>Select a complete date of birth.</div>}
                                        </div>
                                    ) : fmtDate(profile.dob)}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 0', fontWeight: 600, color: '#374151' }}>Gender</td>
                                <td style={{ padding: '8px 0' }}>
                                    {editing ? (
                                        <select
                                            value={genderInput}
                                            onChange={e => setGenderInput(e.target.value)}
                                            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}
                                        >
                                            <option value="">Select…</option>
                                            {GENDER_OPTIONS.map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    ) : (GENDER_LABEL[profile.gender] || profile.gender || '—')}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {editing && (
                        <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                            <button className="admin-btn" onClick={() => setEditing(false)}>Cancel</button>
                            <button
                                className="btn modal-btn-primary"
                                style={{ padding: '10px 20px', borderRadius: '8px' }}
                                disabled={!canSave || saving}
                                onClick={handleSaveProfile}
                            >
                                {saving ? 'Saving…' : '💾 Save Changes'}
                            </button>
                        </div>
                    )}
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
                                autoComplete="new-password"
                                style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: `1px solid ${pwErrors.newPassword ? '#fca5a5' : '#e5e7eb'}`, boxSizing: 'border-box' }}
                            />
                            <button type="button" onClick={() => setShowNew(s => !s)} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '4px' }}>
                                {showNew ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <PasswordStrengthChecklist password={newPassword} />
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

export default IndividualAccount;
