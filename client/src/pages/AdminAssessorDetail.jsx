import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const fieldErrorStyle = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
};
const LOGOUT_STATUS_LABEL = {
    active: <span className="admin-tag good">Active</span>,
    normal: 'Logged out',
    force_logout: <span style={{ color: '#dc2626', fontWeight: 600 }}>Force-logged-out</span>,
    session_expired: <span style={{ color: '#b45309' }}>Session expired</span>,
};

const TABS = [
    ['profile', 'Profile'],
    ['password', 'Password'],
    ['login-history', 'Login History'],
    ['activity-log', 'Activity Log'],
    ['edit-history', 'Edit History'],
];

const AdminAssessorDetail = () => {
    const { id, tab } = useParams();
    const navigate = useNavigate();
    const [assessor, setAssessor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});
    const [errors, setErrors] = useState({});

    // Password tab
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [resetError, setResetError] = useState('');
    const [resetSuccess, setResetSuccess] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    // Login History tab
    const [sessions, setSessions] = useState([]);
    const [sessionsSummary, setSessionsSummary] = useState(null);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [forceLogoutBusyId, setForceLogoutBusyId] = useState(null);

    // Activity Log tab
    const [activityLogs, setActivityLogs] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);

    // Edit History tab
    const [editLogs, setEditLogs] = useState([]);
    const [editLogsLoading, setEditLogsLoading] = useState(false);

    const fetchAssessor = async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/assessors/${id}`);
            setAssessor(data);
            setForm(data);
        } catch (error) {
            if (error.response?.status === 404) setAssessor(null);
            setMsg({ type: 'err', text: error.response?.data?.message || 'Failed to load assessor.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAssessor(); }, [id]);

    const fetchSessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/assessors/${id}/login-history`, { params: { limit: 50 } });
            setSessions(data.sessions || []);
            setSessionsSummary(data.summary || null);
        } catch (error) {
            console.error('Failed to load login history', error);
        } finally {
            setSessionsLoading(false);
        }
    }, [id]);

    const fetchActivityLog = useCallback(async () => {
        setActivityLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/assessors/${id}/activity-log`, { params: { limit: 100 } });
            setActivityLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to load activity log', error);
        } finally {
            setActivityLoading(false);
        }
    }, [id]);

    const fetchEditLogs = useCallback(async () => {
        setEditLogsLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/assessors/${id}/edit-logs`);
            setEditLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to load edit history', error);
        } finally {
            setEditLogsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (tab === 'login-history') fetchSessions();
        if (tab === 'activity-log') fetchActivityLog();
        if (tab === 'edit-history') fetchEditLogs();
    }, [tab, fetchSessions, fetchActivityLog, fetchEditLogs]);

    const handleForceLogout = async (sessionId) => {
        if (!window.confirm('End this session immediately? Note: the assessor stays signed in until their token naturally expires (up to 12h) — this only closes the session record.')) return;
        setForceLogoutBusyId(sessionId);
        try {
            await axiosAdmin.post(`/admin/assessors/${id}/sessions/${sessionId}/force-logout`);
            await fetchSessions();
        } catch (error) {
            console.error('Force logout failed', error);
        } finally {
            setForceLogoutBusyId(null);
        }
    };

    const handleSaveEdit = async () => {
        const newErrors = {};
        if (!form.name?.trim()) newErrors.name = 'Assessor name is required.';
        if (!form.email?.trim()) {
            newErrors.email = 'Email ID is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = 'Please enter a valid email address.';
        }
        if (!form.mobile_number?.trim()) {
            newErrors.mobile_number = 'Mobile number is required.';
        } else {
            const mobileDigits = form.mobile_number.replace(/\D/g, '');
            const normalized = mobileDigits.length === 12 && mobileDigits.startsWith('91') ? mobileDigits.slice(2) : mobileDigits;
            if (!/^[6-9]\d{9}$/.test(normalized)) newErrors.mobile_number = 'Please enter a valid 10-digit mobile number.';
        }
        if (Object.keys(newErrors).length) {
            setErrors(newErrors);
            return;
        }

        setBusy(true);
        setErrors({});
        try {
            await axiosAdmin.put(`/admin/assessors/${id}`, form);
            setMsg({ type: 'ok', text: 'Assessor updated successfully.' });
            setEditing(false);
            await fetchAssessor();
            if (tab === 'edit-history') fetchEditLogs();
        } catch (error) {
            const serverMessage = error.response?.data?.message || '';
            if (/email/i.test(serverMessage)) setErrors({ email: serverMessage });
            else if (/mobile/i.test(serverMessage)) setErrors({ mobile_number: serverMessage });
            else setMsg({ type: 'err', text: serverMessage || 'Failed to update assessor.' });
        } finally {
            setBusy(false);
        }
    };

    const handleResetPassword = async () => {
        if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            setResetError('Password must be at least 8 characters and include a letter and a number.');
            setResetSuccess('');
            return;
        }
        setIsResetting(true);
        setResetError('');
        setResetSuccess('');
        try {
            await axiosAdmin.put(`/admin/assessors/${id}/reset-password`, { newPassword });
            setResetSuccess('Password reset successfully.');
            setNewPassword('');
        } catch (error) {
            setResetError(error.response?.data?.message || 'Failed to reset password.');
        } finally {
            setIsResetting(false);
        }
    };

    if (loading) return <main className="admin-content"><div className="admin-card w12">Loading…</div></main>;
    if (!assessor) return <main className="admin-content"><div className="admin-card w12">Assessor not found. <Link to="/admin/assessors">Back to list</Link></div></main>;
    if (!TABS.some(([key]) => key === tab)) return <Navigate to={`/admin/assessors/${id}/profile`} replace />;

    return (
        <main className="admin-content" aria-label="Assessor Detail">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                        <Link to="/admin/assessors" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>← Back to Assessors</Link>
                        <h3 style={{ fontSize: '20px', margin: '8px 0 4px 0' }}>{assessor.name}</h3>
                        <span className={`admin-tag ${assessor.status === 'active' ? 'good' : 'warn'}`} style={{ textTransform: 'capitalize' }}>
                            {assessor.status}
                        </span>
                    </div>
                    {tab === 'profile' && (
                        <button className="admin-btn" onClick={() => { setEditing(e => !e); setErrors({}); setForm(assessor); }}>
                            {editing ? 'Cancel Edit' : '✏️ Edit'}
                        </button>
                    )}
                </div>

                {msg.text && (
                    <div style={{
                        padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
                        background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                        color: msg.type === 'ok' ? '#16a34a' : '#dc2626',
                        border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                    }}>{msg.text}</div>
                )}

                <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
                    {TABS.map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => navigate(`/admin/assessors/${id}/${key}`)}
                            style={{
                                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 600,
                                color: tab === key ? 'var(--primary)' : '#6b7280',
                                borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
                                marginBottom: '-1px',
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'profile' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <table className="admin-table">
                            <tbody>
                                <tr>
                                    <td style={{ fontWeight: 600, width: '220px' }}>Assessor Name</td>
                                    <td>
                                        {editing ? (
                                            <>
                                                <input
                                                    value={form.name || ''}
                                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                                    style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${errors.name ? '#fca5a5' : '#e5e7eb'}` }}
                                                />
                                                {errors.name && <div style={fieldErrorStyle}>{errors.name}</div>}
                                            </>
                                        ) : (assessor.name || '—')}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Email ID</td>
                                    <td>
                                        {editing ? (
                                            <>
                                                <input
                                                    type="email"
                                                    value={form.email || ''}
                                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                                    style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${errors.email ? '#fca5a5' : '#e5e7eb'}` }}
                                                />
                                                {errors.email && <div style={fieldErrorStyle}>{errors.email}</div>}
                                            </>
                                        ) : (assessor.email || '—')}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Mobile Number</td>
                                    <td>
                                        {editing ? (
                                            <>
                                                <input
                                                    value={form.mobile_number || ''}
                                                    onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))}
                                                    style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${errors.mobile_number ? '#fca5a5' : '#e5e7eb'}` }}
                                                />
                                                {errors.mobile_number && <div style={fieldErrorStyle}>{errors.mobile_number}</div>}
                                            </>
                                        ) : (assessor.mobile_number || '—')}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Status</td>
                                    <td>
                                        {editing ? (
                                            <select
                                                value={form.status || 'active'}
                                                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}
                                            >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        ) : (
                                            assessor.status === 'active' ? <span className="admin-tag good">Active</span> : <span className="admin-tag warn">Inactive</span>
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Remarks</td>
                                    <td>
                                        {editing ? (
                                            <textarea
                                                value={form.remarks || ''}
                                                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                                                rows={3}
                                                maxLength={500}
                                                style={{ width: '100%', maxWidth: '480px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                            />
                                        ) : (assessor.remarks || '—')}
                                    </td>
                                </tr>
                                {assessor.org_name && (
                                    <tr>
                                        <td style={{ fontWeight: 600 }}>Organization</td>
                                        <td>{assessor.org_name}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Registered</td>
                                    <td>{fmtDateTime(assessor.created_at)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {editing && (
                            <div style={{ marginTop: '16px' }}>
                                <button className="admin-btn" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff' }} disabled={busy} onClick={handleSaveEdit}>
                                    {busy ? 'Saving…' : '💾 Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'password' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Reset Password</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                            Set a new login password for this assessor. No current password is required —
                            this is a Super Admin action, not a self-service change.
                        </p>

                        <div style={{ maxWidth: '360px' }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>New Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => { setNewPassword(e.target.value); setResetError(''); setResetSuccess(''); }}
                                    placeholder="Min 8 chars, letter + number"
                                    style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: `1px solid ${resetError ? '#fca5a5' : '#e5e7eb'}`, boxSizing: 'border-box' }}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(s => !s)}
                                    title={showNewPassword ? 'Hide password' : 'Show password'}
                                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '4px', lineHeight: 1 }}
                                >
                                    {showNewPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                            {resetError && <div style={fieldErrorStyle}>{resetError}</div>}
                            {resetSuccess && <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>{resetSuccess}</div>}

                            <button
                                className="admin-btn"
                                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff', marginTop: '14px' }}
                                disabled={!newPassword || isResetting}
                                onClick={handleResetPassword}
                            >
                                {isResetting ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'login-history' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        {sessionsSummary && (
                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '13px' }}>
                                <div><strong>{sessionsSummary.totalLogins}</strong> successful logins</div>
                                <div><strong>{sessionsSummary.totalFailed}</strong> failed attempts</div>
                                <div>Last login: <strong>{fmtDateTime(sessionsSummary.lastLogin)}</strong></div>
                                <div>Total time: <strong>{fmtDuration(sessionsSummary.totalWorkingSeconds)}</strong></div>
                            </div>
                        )}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Login Time</th><th>Logout Time</th><th>Duration</th><th>Status</th>
                                        <th>IP Address</th><th>Device</th><th>Browser / OS</th><th>Failure Reason</th><th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessionsLoading ? (
                                        <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>Loading…</td></tr>
                                    ) : sessions.length === 0 ? (
                                        <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>No login history yet.</td></tr>
                                    ) : (
                                        sessions.map(s => (
                                            <tr key={s.id}>
                                                <td>{fmtDateTime(s.login_time)}</td>
                                                <td>{fmtDateTime(s.logout_time)}</td>
                                                <td>{fmtDuration(s.session_duration)}</td>
                                                <td>
                                                    {s.login_status === 'failed'
                                                        ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Failed</span>
                                                        : (LOGOUT_STATUS_LABEL[s.logout_status] || s.logout_status || '—')}
                                                </td>
                                                <td>{s.ip_address || '—'}</td>
                                                <td>{s.device_type || '—'}</td>
                                                <td>{[s.browser, s.os].filter(Boolean).join(' / ') || '—'}</td>
                                                <td>{s.failure_reason || '—'}</td>
                                                <td>
                                                    {s.logout_status === 'active' && (
                                                        <button
                                                            className="admin-btn"
                                                            style={{ padding: '4px 10px', fontSize: '12px', background: '#fee2e2', color: '#991b1b' }}
                                                            disabled={forceLogoutBusyId === s.id}
                                                            onClick={() => handleForceLogout(s.id)}
                                                        >
                                                            {forceLogoutBusyId === s.id ? 'Ending…' : '🔒 Force Logout'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'activity-log' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Date/Time</th><th>Actor</th><th>Module</th><th>Action</th>
                                        <th>Description</th><th>Record</th><th>Status</th><th>IP Address</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activityLoading ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>Loading…</td></tr>
                                    ) : activityLogs.length === 0 ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No activity recorded yet.</td></tr>
                                    ) : (
                                        activityLogs.map(log => (
                                            <tr key={log.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(log.created_at)}</td>
                                                <td>{log.actor_name || '—'} <span style={{ color: '#9ca3af', fontSize: '11px' }}>({log.actor_type})</span></td>
                                                <td style={{ textTransform: 'capitalize' }}>{log.module}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{log.action_type.replace(/_/g, ' ')}</td>
                                                <td>{log.description || '—'}</td>
                                                <td>{log.record_name || log.record_id || '—'}</td>
                                                <td>
                                                    {log.status === 'success'
                                                        ? <span className="admin-tag good">Success</span>
                                                        : <span style={{ color: '#dc2626', fontWeight: 600 }}>Failed</span>}
                                                </td>
                                                <td>{log.ip_address || '—'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'edit-history' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Date/Time</th><th>Field</th><th>Previous Value</th><th>New Value</th><th>Updated By</th><th>IP Address</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editLogsLoading ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Loading…</td></tr>
                                    ) : editLogs.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No edits recorded yet.</td></tr>
                                    ) : (
                                        editLogs.map(log => (
                                            <tr key={log.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(log.created_at)}</td>
                                                <td>{log.field_name}</td>
                                                <td>{log.old_value || '—'}</td>
                                                <td>{log.new_value || '—'}</td>
                                                <td>{log.updated_by_name || '—'}</td>
                                                <td>{log.ip_address || '—'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
};

export default AdminAssessorDetail;
