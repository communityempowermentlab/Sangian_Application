import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import OtpGate from '../components/shared/OtpGate';
import PasswordStrengthChecklist, { isStrongPassword } from '../components/shared/PasswordStrengthChecklist';

// org_email/org_mobile are deliberately NOT in this list — they're
// identifiers (login credentials + uniqueness), edited through the
// separate OTP-gated Contact Details section below instead of this plain
// inline-edit table (see updateOrganizationContact in
// adminOrgController.js and the matching precedent in
// AdminIndividualDetail.jsx). org_type is also excluded — it's a managed
// dropdown (see the dedicated row below) fed by /admin/org-types, not free
// text (see Admin > Meta > Organization Types / orgTypeController.js).
const FIELD_ROWS = [
    ['org_name', 'Organization Name'],
    ['address', 'Address'],
    ['city', 'City'],
    ['state', 'State'],
    ['country', 'Country'],
    ['contact_person_name', 'Contact Person'],
    ['contact_person_designation', 'Designation'],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const MOBILE_RE = /^[6-9]\d{9}$/;

// Mirrors ORG_PERMISSION_MODULES in adminOrgController.js — keep in sync,
// or the checklist will offer toggles the server silently drops
// (whitelist-filtered on save). Checking a module grants full access to
// it — same flat all-or-nothing model as Staff's Menu Permissions
// (ADMIN_MODULES in staffPermissions.js), same labels too.
//
// Only dashboard/children/staff/settings are actually functional for an
// org session (org-scoped data, gated via requireAdminOrOrgAuth on their
// routes) — the rest are global platform-wide admin tools with no
// per-org data model, shown here for checklist parity with Staff but not
// wired to grant real access (see the comment on ORG_PERMISSION_MODULES
// in adminOrgController.js for why). 'organizations'/'individuals' are
// additionally hard-locked at both the nav (AdminLayout.jsx checks
// isOrgSession() directly, not this grant) and the API (requireAdminOnly)
// — an org can never see or manage other organizations/individuals no
// matter what's checked here.
const PERMISSION_MODULES = [
    ['dashboard',     'Dashboard'],
    ['organizations', 'Organizations'],
    ['children',      'Children'],
    ['assessors',     'Assessors'],
    ['child-groups',  'Child Groups'],
    ['staff',         'Staff'],
    ['individuals',   'Individuals'],
    ['reports',       'Reports'],
    ['analysis',      'Analysis'],
    ['docs',          'Docs'],
    ['meta',          'Meta'],
    ['help-support',  'Support'],
    ['multilingual',  'Multilingual'],
    ['elements',      'Elements'],
    ['settings',      'Settings'],
];

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
    ['permissions', 'Permissions'],
    ['assigned-tests', 'Assigned Tests'],
    ['login-history', 'Login History'],
    ['activity-log', 'Activity Log'],
    ['edit-history', 'Edit History'],
];

const AdminOrganizationDetail = () => {
    const { id, tab } = useParams();
    const navigate = useNavigate();
    const [org, setOrg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({});
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectBox, setShowRejectBox] = useState(false);
    const [perms, setPerms] = useState([]);
    const [permsBusy, setPermsBusy] = useState(false);
    const [permsMsg, setPermsMsg] = useState({ type: '', text: '' });

    // Assigned Tests tab — null (server truth) means unrestricted; an array
    // (even []) means a real, saved allow-list. draftMode/draftKeys are the
    // in-progress edit, separate from assignedTests (the last-saved value),
    // so switching into "restrict" mode or unchecking boxes doesn't change
    // anything until Save is actually clicked.
    const [assignedTests, setAssignedTests] = useState(null);
    const [testCatalog, setTestCatalog] = useState([]);
    const [atLoading, setAtLoading] = useState(false);
    const [atBusy, setAtBusy] = useState(false);
    const [atMsg, setAtMsg] = useState({ type: '', text: '' });
    const [draftMode, setDraftMode] = useState('unrestricted'); // 'unrestricted' | 'restricted'
    const [draftKeys, setDraftKeys] = useState([]);

    // Contact Details (org_email/org_mobile) — separate OTP-gated flow
    const [contactEditing, setContactEditing] = useState(false);
    const [orgEmailInput, setOrgEmailInput] = useState('');
    const [orgMobileInput, setOrgMobileInput] = useState('');
    const [orgEmailVerified, setOrgEmailVerified] = useState(false);
    const [orgMobileVerified, setOrgMobileVerified] = useState(false);
    const [contactSaving, setContactSaving] = useState(false);
    const [contactMsg, setContactMsg] = useState({ type: '', text: '' });

    // Password (Super-Admin-initiated reset — no current-password check)
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Organization Type dropdown options — managed at Admin > Meta >
    // Organization Types (orgTypeController.js). Fetched via the admin
    // endpoint (not /api/public/org-types) so an inactive-but-currently-
    // assigned type still appears as a valid option on this org's own record.
    const [orgTypes, setOrgTypes] = useState([]);
    useEffect(() => {
        axiosAdmin.get('/admin/org-types').then(({ data }) => setOrgTypes(data.orgTypes || [])).catch(() => {});
    }, []);

    // Login History tab state
    const [sessions, setSessions] = useState([]);
    const [sessionsSummary, setSessionsSummary] = useState(null);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [forceLogoutBusyId, setForceLogoutBusyId] = useState(null);

    // Activity Log tab state
    const [activityLogs, setActivityLogs] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);

    // Edit History tab state — clean per-field diff list, mirrors
    // AdminIndividualDetail.jsx's Edit History exactly.
    const [editLogs, setEditLogs] = useState([]);
    const [editLogsLoading, setEditLogsLoading] = useState(false);

    const fetchOrg = async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/organizations/${id}`);
            setOrg(data.organization);
            setForm(data.organization);
            setPerms(Array.isArray(data.organization.permissions) ? data.organization.permissions : []);
            const savedAssignedTests = Array.isArray(data.organization.assigned_tests) ? data.organization.assigned_tests : null;
            setAssignedTests(savedAssignedTests);
            setDraftMode(savedAssignedTests === null ? 'unrestricted' : 'restricted');
            setDraftKeys(savedAssignedTests || []);
        } catch (error) {
            // 404 means the record genuinely doesn't exist — clear any
            // previously-loaded data so the page falls into the clean
            // "not found" branch instead of showing stale details/buttons
            // alongside the error banner.
            if (error.response?.status === 404) setOrg(null);
            setMsg({ type: 'err', text: error.response?.data?.message || 'Failed to load organization.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrg(); }, [id]);

    const fetchSessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/organizations/${id}/login-history`, { params: { limit: 50 } });
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
            const { data } = await axiosAdmin.get(`/admin/organizations/${id}/activity-log`, { params: { limit: 100 } });
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
            const { data } = await axiosAdmin.get(`/admin/organizations/${id}/edit-logs`);
            setEditLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to load edit history', error);
        } finally {
            setEditLogsLoading(false);
        }
    }, [id]);

    const fetchTestCatalog = useCallback(async () => {
        setAtLoading(true);
        try {
            const { data } = await axiosAdmin.get('/admin/test-config');
            // Only active tests can be assigned, per spec — an inactive
            // (globally-disabled) test can't be played by anyone regardless
            // of org assignment, so offering it here would be misleading.
            setTestCatalog((data.tests || []).filter(t => t.enabled));
        } catch (error) {
            console.error('Failed to load test catalog', error);
        } finally {
            setAtLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'login-history') fetchSessions();
        if (tab === 'activity-log') fetchActivityLog();
        if (tab === 'edit-history') fetchEditLogs();
        if (tab === 'assigned-tests') fetchTestCatalog();
    }, [tab, fetchSessions, fetchActivityLog, fetchEditLogs, fetchTestCatalog]);

    const handleForceLogout = async (sessionId) => {
        if (!window.confirm('End this session immediately? The organization will be signed out on its next request.')) return;
        setForceLogoutBusyId(sessionId);
        try {
            await axiosAdmin.post(`/admin/organizations/${id}/sessions/${sessionId}/force-logout`);
            await fetchSessions();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to end session.');
        } finally {
            setForceLogoutBusyId(null);
        }
    };

    const runAction = async (action, extra) => {
        setBusy(true);
        setMsg({ type: '', text: '' });
        try {
            const { data } = await axiosAdmin.post(`/admin/organizations/${id}/${action}`, extra || {});
            setMsg({ type: 'ok', text: data.message });
            await fetchOrg();
            setShowRejectBox(false);
            setRejectReason('');
        } catch (error) {
            setMsg({ type: 'err', text: error.response?.data?.message || 'Action failed.' });
        } finally {
            setBusy(false);
        }
    };

    const handleSaveEdit = async () => {
        setBusy(true);
        setMsg({ type: '', text: '' });
        try {
            await axiosAdmin.put(`/admin/organizations/${id}`, form);
            setMsg({ type: 'ok', text: 'Organization updated.' });
            setEditing(false);
            await fetchOrg();
            if (tab === 'edit-history') fetchEditLogs();
        } catch (error) {
            setMsg({ type: 'err', text: error.response?.data?.message || 'Update failed.' });
        } finally {
            setBusy(false);
        }
    };

    const startContactEditing = () => {
        setOrgEmailInput(org.org_email);
        setOrgMobileInput(org.org_mobile);
        setOrgEmailVerified(false);
        setOrgMobileVerified(false);
        setContactEditing(true);
        setContactMsg({ type: '', text: '' });
    };

    const orgEmailChanged = orgEmailInput.trim().toLowerCase() !== org?.org_email?.toLowerCase();
    const orgMobileChanged = orgMobileInput.trim() !== org?.org_mobile;
    const orgEmailOk = EMAIL_RE.test(orgEmailInput.trim());
    const orgMobileOk = MOBILE_RE.test(orgMobileInput.trim());
    const canSaveContact = (!orgEmailChanged || orgEmailVerified) && (!orgMobileChanged || orgMobileVerified)
        && (orgEmailChanged || orgMobileChanged) && orgEmailOk && orgMobileOk;

    const handleSaveContact = async () => {
        setContactSaving(true);
        setContactMsg({ type: '', text: '' });
        try {
            await axiosAdmin.put(`/admin/organizations/${id}/contact`, {
                org_email: orgEmailInput.trim(),
                org_mobile: orgMobileInput.trim(),
            });
            setContactMsg({ type: 'ok', text: 'Contact details updated successfully.' });
            setContactEditing(false);
            await fetchOrg();
            if (tab === 'edit-history') fetchEditLogs();
        } catch (error) {
            if (error.response?.status === 404) { setContactEditing(false); fetchOrg(); }
            setContactMsg({ type: 'err', text: error.response?.data?.message || 'Failed to update contact details.' });
        } finally {
            setContactSaving(false);
        }
    };

    const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
    const canSavePassword = isStrongPassword(newPassword) && passwordsMatch;

    const handleResetPassword = async () => {
        setPasswordSaving(true);
        setPasswordMsg({ type: '', text: '' });
        try {
            await axiosAdmin.put(`/admin/organizations/${id}/password`, { newPassword });
            setPasswordMsg({ type: 'ok', text: 'Password reset successfully.' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setPasswordMsg({ type: 'err', text: error.response?.data?.message || 'Failed to reset password.' });
        } finally {
            setPasswordSaving(false);
        }
    };

    const togglePerm = (moduleKey) => {
        setPerms(prev => prev.includes(moduleKey) ? prev.filter(k => k !== moduleKey) : [...prev, moduleKey]);
    };

    const handleSavePermissions = async () => {
        setPermsBusy(true);
        setPermsMsg({ type: '', text: '' });
        try {
            const { data } = await axiosAdmin.put(`/admin/organizations/${id}/permissions`, { permissions: perms });
            setPerms(data.permissions || []);
            setPermsMsg({ type: 'ok', text: 'Permissions updated.' });
        } catch (error) {
            setPermsMsg({ type: 'err', text: error.response?.data?.message || 'Failed to update permissions.' });
        } finally {
            setPermsBusy(false);
        }
    };

    const toggleDraftKey = (key) => {
        setDraftKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    // Transitioning FROM unrestricted starts the draft with every currently-
    // active test already checked — the admin is narrowing down from what's
    // available today, not building a list from scratch.
    const startRestricting = () => {
        setDraftMode('restricted');
        setDraftKeys(testCatalog.map(t => t.key));
        setAtMsg({ type: '', text: '' });
    };

    const saveAssignedTests = async (keys) => {
        setAtBusy(true);
        setAtMsg({ type: '', text: '' });
        try {
            const { data } = await axiosAdmin.put(`/admin/organizations/${id}/assigned-tests`, { assignedTests: keys });
            setAssignedTests(data.assignedTests);
            setDraftMode(data.assignedTests === null ? 'unrestricted' : 'restricted');
            setDraftKeys(data.assignedTests || []);
            setAtMsg({ type: 'ok', text: data.message || 'Assigned tests updated.' });
        } catch (error) {
            setAtMsg({ type: 'err', text: error.response?.data?.message || 'Failed to update assigned tests.' });
        } finally {
            setAtBusy(false);
        }
    };

    const handleSaveAssignedTests = () => {
        if (draftKeys.length === 0) {
            const confirmed = window.confirm(
                'No tests are checked — saving now will block this organization from every test until tests are assigned again. Continue?'
            );
            if (!confirmed) return;
        }
        saveAssignedTests(draftKeys);
    };

    const handleRemoveRestriction = () => {
        if (!window.confirm('Remove all test restrictions for this organization? It will regain access to every active test.')) return;
        saveAssignedTests(null);
    };

    if (loading) return <main className="admin-content"><div className="admin-card w12">Loading…</div></main>;
    if (!org) return <main className="admin-content"><div className="admin-card w12">Organization not found. <Link to="/admin/organizations">Back to list</Link></div></main>;
    // Unknown/stale tab in the URL (bad bookmark, typo, a tab that's since
    // been removed) — redirect to Profile rather than rendering a blank panel.
    if (!TABS.some(([key]) => key === tab)) return <Navigate to={`/admin/organizations/${id}/profile`} replace />;

    return (
        <main className="admin-content" aria-label="Organization Detail">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                        <Link to="/admin/organizations" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>← Back to Organizations</Link>
                        <h3 style={{ fontSize: '20px', margin: '8px 0 4px 0' }}>{org.org_name}</h3>
                        <span className={`admin-tag ${org.registration_status === 'approved' ? 'good' : 'warn'}`} style={{ textTransform: 'capitalize' }}>
                            {org.registration_status}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {org.registration_status === 'pending' && (
                            <>
                                <button className="admin-btn" style={{ background: '#16a34a', color: '#fff' }} disabled={busy} onClick={() => runAction('approve')}>✅ Approve</button>
                                <button className="admin-btn" style={{ background: '#dc2626', color: '#fff' }} disabled={busy} onClick={() => setShowRejectBox(s => !s)}>✕ Reject</button>
                            </>
                        )}
                        {org.registration_status === 'approved' && (
                            <button className="admin-btn" style={{ background: '#dc2626', color: '#fff' }} disabled={busy} onClick={() => runAction('suspend')}>⏸ Suspend</button>
                        )}
                        {org.registration_status === 'suspended' && (
                            <button className="admin-btn" style={{ background: '#16a34a', color: '#fff' }} disabled={busy} onClick={() => runAction('activate')}>▶ Reactivate</button>
                        )}
                        {org.registration_status === 'rejected' && (
                            <button className="admin-btn" style={{ background: '#16a34a', color: '#fff' }} disabled={busy} onClick={() => runAction('approve')}>✅ Approve Anyway</button>
                        )}
                        {tab === 'profile' && (
                            <button className="admin-btn" onClick={() => setEditing(e => !e)}>{editing ? 'Cancel Edit' : '✏️ Edit'}</button>
                        )}
                    </div>
                </div>

                {showRejectBox && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                        />
                        <button className="admin-btn" style={{ background: '#dc2626', color: '#fff' }} disabled={busy || !rejectReason.trim()} onClick={() => runAction('reject', { reason: rejectReason.trim() })}>
                            Confirm Reject
                        </button>
                    </div>
                )}

                {msg.text && (
                    <div style={{
                        padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
                        background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                        color: msg.type === 'ok' ? '#16a34a' : '#dc2626',
                        border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                    }}>{msg.text}</div>
                )}

                {org.rejection_reason && (
                    <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                        <strong>Rejection reason:</strong> {org.rejection_reason}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb', marginBottom: '16px' }}>
                    {TABS.map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => navigate(`/admin/organizations/${id}/${key}`)}
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
                    <div className="admin-grid">
                        <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                            <table className="admin-table">
                                <tbody>
                                    <tr>
                                        <td style={{ fontWeight: 600, width: '220px' }}>Organization Type</td>
                                        <td>
                                            {editing ? (
                                                <select
                                                    value={form.org_type || ''}
                                                    onChange={e => setForm(f => ({ ...f, org_type: e.target.value }))}
                                                    style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                                                >
                                                    {/* Keeps the org's current value selectable even if it's since
                                                        been deactivated or isn't in the list at all (legacy data). */}
                                                    {org.org_type && !orgTypes.some(t => t.value === org.org_type) && (
                                                        <option value={org.org_type}>{org.org_type}</option>
                                                    )}
                                                    {orgTypes.map(t => (
                                                        <option key={t.value} value={t.value}>
                                                            {t.label}{t.status === 'inactive' ? ' (inactive)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                orgTypes.find(t => t.value === org.org_type)?.label || org.org_type || '—'
                                            )}
                                        </td>
                                    </tr>
                                    {FIELD_ROWS.map(([key, label]) => (
                                        <tr key={key}>
                                            <td style={{ fontWeight: 600, width: '220px' }}>{label}</td>
                                            <td>
                                                {editing ? (
                                                    <input
                                                        value={form[key] || ''}
                                                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                                                    />
                                                ) : (org[key] || '—')}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td style={{ fontWeight: 600 }}>Registered</td>
                                        <td>{fmtDateTime(org.created_at)}</td>
                                    </tr>
                                    {org.approved_at && (
                                        <tr>
                                            <td style={{ fontWeight: 600 }}>Approved</td>
                                            <td>{fmtDateTime(org.approved_at)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {editing && (
                                <div style={{ marginTop: '16px' }}>
                                    <button className="admin-btn" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff' }} disabled={busy} onClick={handleSaveEdit}>
                                        💾 Save Changes
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)', marginTop: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <h4 style={{ margin: 0, fontSize: '15px' }}>Contact Details</h4>
                                {!contactEditing && (
                                    <button className="admin-btn" onClick={startContactEditing}>✏️ Edit Contact Details</button>
                                )}
                            </div>
                            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                                Login credentials — changing either requires OTP verification of the new value.
                            </p>

                            {contactMsg.text && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
                                    background: contactMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                                    color: contactMsg.type === 'ok' ? '#16a34a' : '#dc2626',
                                    border: `1px solid ${contactMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                                }}>{contactMsg.text}</div>
                            )}

                            <table className="admin-table">
                                <tbody>
                                    <tr>
                                        <td style={{ fontWeight: 600, width: '220px' }}>Email</td>
                                        <td>
                                            {contactEditing ? (
                                                <div>
                                                    <input
                                                        type="email"
                                                        value={orgEmailInput}
                                                        onChange={e => { setOrgEmailInput(e.target.value); setOrgEmailVerified(false); }}
                                                        style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                                                    />
                                                    {!orgEmailOk && orgEmailInput && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>Enter a valid email address.</div>}
                                                    {orgEmailChanged && orgEmailOk && (
                                                        <div style={{ marginTop: '8px' }}>
                                                            <OtpGate
                                                                channel="email"
                                                                identifier={orgEmailInput.trim().toLowerCase()}
                                                                purpose="org_email_change"
                                                                isValid={orgEmailOk}
                                                                verified={orgEmailVerified}
                                                                onVerified={() => setOrgEmailVerified(true)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>{org.org_email} {org.email_verified ? <span style={{ color: '#16a34a', fontSize: '12px' }}>✓ verified</span> : <span style={{ color: '#b45309', fontSize: '12px' }}>unverified</span>}</>
                                            )}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ fontWeight: 600 }}>Mobile</td>
                                        <td>
                                            {contactEditing ? (
                                                <div>
                                                    <input
                                                        type="tel"
                                                        value={orgMobileInput}
                                                        onChange={e => { setOrgMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10)); setOrgMobileVerified(false); }}
                                                        style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                                                    />
                                                    {!orgMobileOk && orgMobileInput && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>Enter a valid 10-digit Indian mobile number.</div>}
                                                    {orgMobileChanged && orgMobileOk && (
                                                        <div style={{ marginTop: '8px' }}>
                                                            <OtpGate
                                                                channel="phone"
                                                                identifier={orgMobileInput.trim()}
                                                                purpose="org_mobile_change"
                                                                isValid={orgMobileOk}
                                                                verified={orgMobileVerified}
                                                                onVerified={() => setOrgMobileVerified(true)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>{org.org_mobile} {org.mobile_verified ? <span style={{ color: '#16a34a', fontSize: '12px' }}>✓ verified</span> : <span style={{ color: '#b45309', fontSize: '12px' }}>unverified</span>}</>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {contactEditing && (
                                <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                                    <button className="admin-btn" onClick={() => setContactEditing(false)}>Cancel</button>
                                    <button
                                        className="admin-btn"
                                        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff' }}
                                        disabled={!canSaveContact || contactSaving}
                                        onClick={handleSaveContact}
                                    >
                                        {contactSaving ? 'Saving…' : '💾 Save Changes'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'password' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Reset Password</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                            Set a new login password for this organization. No current password is required —
                            this is a Super Admin action, not a self-service change.
                        </p>

                        {passwordMsg.text && (
                            <div style={{
                                padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
                                background: passwordMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                                color: passwordMsg.type === 'ok' ? '#16a34a' : '#dc2626',
                                border: `1px solid ${passwordMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                            }}>{passwordMsg.text}</div>
                        )}

                        <div style={{ maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        style={{ width: '100%', padding: '8px 40px 8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}
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
                                <PasswordStrengthChecklist password={newPassword} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '13px' }}>Confirm New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        style={{ width: '100%', padding: '8px 40px 8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', boxSizing: 'border-box' }}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(s => !s)}
                                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                                        style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '4px', lineHeight: 1 }}
                                    >
                                        {showConfirmPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                                {confirmPassword && !passwordsMatch && (
                                    <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>Passwords do not match.</div>
                                )}
                            </div>
                            <div>
                                <button
                                    className="admin-btn"
                                    style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff' }}
                                    disabled={!canSavePassword || passwordSaving}
                                    onClick={handleResetPassword}
                                >
                                    {passwordSaving ? 'Saving…' : '🔒 Reset Password'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'permissions' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Menu Permissions</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                            Only the checked menus will be visible to this organization. Enforced server-side —
                            unchecking a module blocks the API, not just the menu. Takes effect immediately.
                        </p>

                        {permsMsg.text && (
                            <div style={{
                                padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
                                background: permsMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                                color: permsMsg.type === 'ok' ? '#16a34a' : '#dc2626',
                                border: `1px solid ${permsMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                            }}>{permsMsg.text}</div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                            {PERMISSION_MODULES.map(([moduleKey, label]) => (
                                <label key={moduleKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={perms.includes(moduleKey)} onChange={() => togglePerm(moduleKey)} />
                                    {label}
                                </label>
                            ))}
                        </div>

                        <div style={{ marginTop: '16px' }}>
                            <button className="admin-btn" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff' }} disabled={permsBusy} onClick={handleSavePermissions}>
                                💾 Save Permissions
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'assigned-tests' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Assigned Tests</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                            Restrict which tests this organization's children and assessors can access, and what its
                            own Reports/Analysis show. Enforced server-side — not just hidden in the menu. Only
                            currently active tests can be assigned.
                        </p>

                        {atMsg.text && (
                            <div style={{
                                padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '13px', fontWeight: 600,
                                background: atMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                                color: atMsg.type === 'ok' ? '#16a34a' : '#dc2626',
                                border: `1px solid ${atMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
                            }}>{atMsg.text}</div>
                        )}

                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                            marginBottom: '16px', fontSize: '13.5px', fontWeight: 600,
                            background: assignedTests === null ? '#f0fdf4' : '#fffbeb',
                            color: assignedTests === null ? '#16a34a' : '#b45309',
                            border: `1px solid ${assignedTests === null ? '#bbf7d0' : '#fde68a'}`,
                        }}>
                            {assignedTests === null
                                ? '🔓 Unrestricted — all active tests are available to this organization.'
                                : `🔒 Restricted to ${assignedTests.length} test${assignedTests.length === 1 ? '' : 's'}.`}
                        </div>

                        {atLoading ? (
                            <p style={{ fontSize: '13px', color: '#6b7280' }}>Loading test catalog…</p>
                        ) : draftMode === 'unrestricted' ? (
                            <button className="admin-btn" style={{ background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)', color: '#fff' }} onClick={startRestricting}>
                                🔒 Restrict This Organization
                            </button>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                                    {testCatalog.map(({ key, title }) => (
                                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={draftKeys.includes(key)} onChange={() => toggleDraftKey(key)} />
                                            {title}
                                        </label>
                                    ))}
                                </div>

                                <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button className="admin-btn" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff' }} disabled={atBusy} onClick={handleSaveAssignedTests}>
                                        💾 Save Assigned Tests ({draftKeys.length} checked)
                                    </button>
                                    {assignedTests !== null && (
                                        <button className="admin-btn" disabled={atBusy} onClick={handleRemoveRestriction}>
                                            🔓 Remove Restriction
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
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

export default AdminOrganizationDetail;
