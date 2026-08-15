import React, { useState, useEffect } from 'react';
import axiosAdmin from '../services/axiosAdmin';

// Org-facing Settings — profile view/edit only, strictly separate from the
// Super-Admin-only global AdminSettings.jsx (SMTP, tickets, contact info,
// etc.). Backed by GET/PUT /api/org/me (orgAuthController.js), gated by the
// 'settings' module grant — an org only reaches this page if the Super
// Admin explicitly turned Settings on for it (see App.js's route guard,
// which blocks the global settings route for role==='organization'
// regardless of any grant).
const READONLY_FIELDS = [
    ['org_name', 'Organization Name'],
    ['org_type', 'Organization Type'],
    ['org_email', 'Email'],
    ['org_mobile', 'Mobile'],
];
const EDITABLE_FIELDS = [
    ['address', 'Address'],
    ['city', 'City'],
    ['state', 'State'],
    ['country', 'Country'],
    ['contact_person_name', 'Contact Person'],
    ['contact_person_designation', 'Designation'],
];

const AdminOrgSettings = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get('/org/me');
            setProfile(data.profile);
            setForm(data.profile);
        } catch (error) {
            setMsg({ type: 'err', text: error.response?.data?.message || 'Failed to load organization profile.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProfile(); }, []);

    const handleSave = async () => {
        setBusy(true);
        setMsg({ type: '', text: '' });
        try {
            const updates = {};
            EDITABLE_FIELDS.forEach(([key]) => { updates[key] = form[key] || ''; });
            await axiosAdmin.put('/org/me', updates);
            setMsg({ type: 'ok', text: 'Profile updated.' });
            setEditing(false);
            await fetchProfile();
        } catch (error) {
            setMsg({ type: 'err', text: error.response?.data?.message || 'Failed to update profile.' });
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <main className="admin-content"><div className="admin-card w12">Loading…</div></main>;
    if (!profile) return <main className="admin-content"><div className="admin-card w12">Unable to load your organization's settings.</div></main>;

    return (
        <main className="admin-content" aria-label="Organization Settings">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Organization Settings</h3>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>Your organization's profile — visible only to your organization, separate from platform-wide settings.</p>
                    </div>
                    <button className="admin-btn" onClick={() => setEditing(e => !e)}>{editing ? 'Cancel Edit' : '✏️ Edit'}</button>
                </div>

                {msg.text && (
                    <div style={{
                        padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
                        background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                        color: msg.type === 'ok' ? '#16a34a' : '#dc2626',
                        border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                    }}>{msg.text}</div>
                )}

                <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                    <table className="admin-table">
                        <tbody>
                            {READONLY_FIELDS.map(([key, label]) => (
                                <tr key={key}>
                                    <td style={{ fontWeight: 600, width: '220px' }}>{label}</td>
                                    <td>{profile[key] || '—'}</td>
                                </tr>
                            ))}
                            {EDITABLE_FIELDS.map(([key, label]) => (
                                <tr key={key}>
                                    <td style={{ fontWeight: 600, width: '220px' }}>{label}</td>
                                    <td>
                                        {editing ? (
                                            <input
                                                value={form[key] || ''}
                                                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                                            />
                                        ) : (profile[key] || '—')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {editing && (
                        <div style={{ marginTop: '16px' }}>
                            <button className="admin-btn" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff' }} disabled={busy} onClick={handleSave}>
                                💾 Save Changes
                            </button>
                        </div>
                    )}
                </div>

                <p style={{ marginTop: '16px', fontSize: '12px', color: '#9ca3af' }}>
                    To change your registered email, mobile number, or organization status, contact the platform administrator.
                </p>
            </div>
        </main>
    );
};

export default AdminOrgSettings;
