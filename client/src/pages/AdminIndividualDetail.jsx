import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import axios from 'axios';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';
import OtpGate from '../components/shared/OtpGate';
import PasswordStrengthChecklist, { isStrongPassword } from '../components/shared/PasswordStrengthChecklist';

// Same game-history endpoint AdminChildScoreboard.jsx already uses (keyed
// purely by child_id, no org filtering) — reused here rather than adding a
// new backend endpoint, per the "minimum required changes" ask. Label map
// duplicated locally since that file exports nothing today.
const GAME_LABELS = {
    'literacy_reading_skill': 'Padh ke batao',
    'literacy_reading_skill_v2': 'Padh ke batao - Version 2',
    'numeracy_number_skill': 'Ankganit',
    'numeracy_number_skill_v2': 'Ankganit V2',
    'numeracy_number_skill_v3': 'Ankganit V3',
    'number_recall_lottery': 'Lottery Ka Ticket',
    'number_recall_lottery_v2': 'Lottery Ka Ticket - Version 2',
    'atlantis_bagiya': 'Bagiya',
    'working_memory_herpher': 'Her Pher',
    'working_memory_herpher_v2': 'Her Pher V2',
    'working_memory_herpher_v3': 'Her Pher V3',
    'auditory_dhyan': 'Dhyan Kahan Hai',
    'triangle_rachna': 'Rachna',
    'rover_mela': 'Chalo Mela Chalen',
    'chalo_mela_chale': 'Chalo Mela Chalen',
    'cognitive_flex_chor': 'Chor Machaye Shor',
    'chor_machaye_shor': 'Chor Machaye Shor',
};

// Duplicated from AdminAnalysis.jsx's GAME_MAX_SCORES (that file exports
// nothing today) — keep in sync if a game's max score ever changes there.
const GAME_MAX_SCORES = {
    atlantis_bagiya: 108, number_recall_lottery: 22, number_recall_lottery_v2: 22,
    rover_mela: 44, chalo_mela_chale: 44, auditory_dhyan: 33,
    working_memory_herpher: 25, working_memory_herpher_v2: 16, working_memory_herpher_v3: 25,
    numeracy_number_skill: 26, numeracy_number_skill_v2: 30,
    literacy_reading_skill: 22, literacy_reading_skill_v2: 4, numeracy_number_skill_v3: 4,
    cognitive_flex_chor: 57, chor_machaye_shor: 57, triangle_rachna: 48,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const MOBILE_RE = /^[6-9]\d{9}$/;
// Edit form only offers Male/Female — GENDER_LABEL below still covers the
// other two values so a pre-existing record set to one of them (from
// before this restriction, or set directly via the API) still displays
// correctly in read-only mode.
const GENDER_OPTIONS = [
    ['male', 'Male'],
    ['female', 'Female'],
];
const DOB_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOB_CURRENT_YEAR = new Date().getFullYear();

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
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
const fmtDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
};
const GENDER_LABEL = { female: 'Female', male: 'Male', other: 'Other', prefer_not_to_say: 'Prefer not to say' };

const TABS = [
    ['profile', 'Profile'],
    ['reports', 'Reports'],
    ['password', 'Password'],
    ['login-history', 'Login History'],
    ['edit-history', 'Edit History'],
];

// Editing email/mobile for an existing Individual account requires proof
// the NEW value is actually reachable, not just typed into a form — reuses
// the exact OtpGate/otp_verifications mechanism registration already uses
// (purpose='individual_email_change'|'individual_mobile_change', see
// otpController.js), so a Super Admin can't accidentally lock someone out
// by mistyping a replacement address/number. Date of Birth/Gender/Status
// share the same single edit form and Save action — DOB/Gender live on the
// linked child profile (see individualAuthController.js) and need no OTP;
// Status is the account's own active/inactive flag (previously a
// standalone header button, now folded in here so there's one place to
// manage the whole account). Every applied change is recorded in
// individual_profile_edit_logs (Edit History tab) — immutable, no
// edit/delete UI for it, matching this codebase's other audit trails.
const AdminIndividualDetail = () => {
    const { id, tab } = useParams();
    const navigate = useNavigate();
    const [individual, setIndividual] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [editing, setEditing] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [emailInput, setEmailInput] = useState('');
    const [mobileInput, setMobileInput] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);
    const [mobileVerified, setMobileVerified] = useState(false);
    const [dobDay, setDobDay] = useState('');
    const [dobMonth, setDobMonth] = useState('');
    const [dobYear, setDobYear] = useState('');
    const [genderInput, setGenderInput] = useState('');
    const [statusInput, setStatusInput] = useState('active');
    const [saving, setSaving] = useState(false);

    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // Login History tab state
    const [sessions, setSessions] = useState([]);
    const [sessionsSummary, setSessionsSummary] = useState(null);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    // Reports tab state
    const [gameHistory, setGameHistory] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(false);

    // Password (Super-Admin-initiated reset — no current-password check)
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

    const fetchIndividual = async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/individuals/${id}`);
            setIndividual(data.individual);
            setNameInput(data.individual.full_name);
            setEmailInput(data.individual.email);
            setMobileInput(data.individual.mobile);
            const parts = dobParts(data.individual.dob);
            setDobDay(parts.day); setDobMonth(parts.month); setDobYear(parts.year);
            setGenderInput(data.individual.gender || '');
            setStatusInput(data.individual.status || 'active');
        } catch (error) {
            // 404 means the record genuinely doesn't exist (deleted, bad
            // ID, etc.) — clear any previously-loaded data so the page
            // falls into the clean "not found" branch below instead of
            // showing stale details/buttons alongside the error banner.
            if (error.response?.status === 404) setIndividual(null);
            setMsg({ type: 'err', text: error.response?.data?.message || 'Failed to load account.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = useCallback(async () => {
        setLogsLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/individuals/${id}/edit-logs`);
            setLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to load edit history', error);
        } finally {
            setLogsLoading(false);
        }
    }, [id]);

    const fetchSessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/individuals/${id}/login-history`);
            setSessions(data.sessions || []);
            setSessionsSummary(data.summary || null);
        } catch (error) {
            console.error('Failed to load login history', error);
        } finally {
            setSessionsLoading(false);
        }
    }, [id]);

    // Reuses GET /games/sessions/history/:childId — the same org-agnostic
    // endpoint AdminChildScoreboard.jsx already calls for any child — no new
    // backend endpoint needed. childId comes from the individual's linked
    // child profile (see getIndividualById), not from :id (the individual's
    // own id) or the individual's login/session records.
    const fetchReports = useCallback(async (childId) => {
        if (!childId) { setGameHistory([]); return; }
        setReportsLoading(true);
        try {
            const { data } = await axios.get(`${API_URL}/games/sessions/history/${childId}`);
            setGameHistory(data.history || []);
        } catch (error) {
            console.error('Failed to load game reports', error);
        } finally {
            setReportsLoading(false);
        }
    }, []);

    useEffect(() => { fetchIndividual(); }, [id]);
    useEffect(() => {
        if (tab === 'login-history') fetchSessions();
        if (tab === 'edit-history') fetchLogs();
        if (tab === 'reports' && individual) fetchReports(individual.child_id);
    }, [tab, fetchSessions, fetchLogs, fetchReports, individual]);

    const startEditing = () => {
        setNameInput(individual.full_name);
        setEmailInput(individual.email);
        setMobileInput(individual.mobile);
        setEmailVerified(false);
        setMobileVerified(false);
        const parts = dobParts(individual.dob);
        setDobDay(parts.day); setDobMonth(parts.month); setDobYear(parts.year);
        setGenderInput(individual.gender || '');
        setStatusInput(individual.status || 'active');
        setEditing(true);
        setMsg({ type: '', text: '' });
    };

    const nameChanged = nameInput.trim() !== individual?.full_name;
    const emailChanged = emailInput.trim().toLowerCase() !== individual?.email.toLowerCase();
    const mobileChanged = mobileInput.trim() !== individual?.mobile;
    const nameOk = nameInput.trim().length > 0;
    const emailOk = EMAIL_RE.test(emailInput.trim());
    const mobileOk = MOBILE_RE.test(mobileInput.trim());

    const dobString = (dobDay && dobMonth && dobYear) ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}` : '';
    const dobOk = !!dobString && !isNaN(new Date(dobString).getTime());
    const dobChanged = (() => {
        const current = dobParts(individual?.dob);
        return dobDay !== current.day || dobMonth !== current.month || dobYear !== current.year;
    })();
    const genderOk = !!genderInput;
    const genderChanged = genderInput !== (individual?.gender || '');
    const statusChanged = statusInput !== individual?.status;

    // Save is blocked until every field that actually changed has cleared
    // its own OTP gate — name/dob/gender/status have none (not
    // identifiers), so they only need to be individually valid.
    const canSave = (!emailChanged || emailVerified) && (!mobileChanged || mobileVerified)
        && (nameChanged || emailChanged || mobileChanged || dobChanged || genderChanged || statusChanged)
        && nameOk && emailOk && mobileOk && dobOk && genderOk;

    const handleSave = async () => {
        setSaving(true);
        setMsg({ type: '', text: '' });
        try {
            const calls = [];
            if (nameChanged || emailChanged || mobileChanged) {
                calls.push(axiosAdmin.put(`/admin/individuals/${id}/contact`, {
                    full_name: nameInput.trim(),
                    email: emailInput.trim(),
                    mobile: mobileInput.trim(),
                }));
            }
            if (dobChanged || genderChanged) {
                calls.push(axiosAdmin.put(`/admin/individuals/${id}/profile`, { dob: dobString, gender: genderInput }));
            }
            if (statusChanged) {
                calls.push(axiosAdmin.put(`/admin/individuals/${id}/status`, { status: statusInput }));
            }
            await Promise.all(calls);
            setMsg({ type: 'ok', text: 'Account details updated successfully.' });
            setEditing(false);
            await fetchIndividual();
            if (tab === 'edit-history') await fetchLogs();
        } catch (error) {
            if (error.response?.status === 404) { setEditing(false); fetchIndividual(); }
            setMsg({ type: 'err', text: error.response?.data?.message || 'Failed to update account details.' });
        } finally {
            setSaving(false);
        }
    };

    const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
    const canSavePassword = isStrongPassword(newPassword) && passwordsMatch;

    const reportsSummary = useMemo(() => {
        const completed = gameHistory.filter(h => h.status === 'completed');
        return {
            totalAttempts: gameHistory.length,
            distinctGamesCount: new Set(gameHistory.map(h => h.game_name)).size,
            completedCount: completed.length,
        };
    }, [gameHistory]);

    const handleResetPassword = async () => {
        setPasswordSaving(true);
        setPasswordMsg({ type: '', text: '' });
        try {
            await axiosAdmin.put(`/admin/individuals/${id}/password`, { newPassword });
            setPasswordMsg({ type: 'ok', text: 'Password reset successfully.' });
            setNewPassword('');
            setConfirmPassword('');
            if (tab === 'edit-history') await fetchLogs();
        } catch (error) {
            setPasswordMsg({ type: 'err', text: error.response?.data?.message || 'Failed to reset password.' });
        } finally {
            setPasswordSaving(false);
        }
    };

    if (loading) return <main className="admin-content"><div className="admin-card w12">Loading…</div></main>;
    if (!individual) return <main className="admin-content"><div className="admin-card w12">Account not found. <Link to="/admin/individuals">Back to list</Link></div></main>;
    if (!TABS.some(([key]) => key === tab)) return <Navigate to={`/admin/individuals/${id}/profile`} replace />;

    return (
        <main className="admin-content" aria-label="Individual Account Detail">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                        <Link to="/admin/individuals" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>← Back to Individuals</Link>
                        <h3 style={{ fontSize: '20px', margin: '8px 0 4px 0' }}>{individual.full_name}</h3>
                        {individual.status === 'active'
                            ? <span className="admin-tag good">Active</span>
                            : <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>}
                    </div>
                    {tab === 'profile' && !editing && (
                        <button className="admin-btn" onClick={startEditing}>✏️ Edit Details</button>
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
                            onClick={() => navigate(`/admin/individuals/${id}/${key}`)}
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
                                    <td style={{ fontWeight: 600, width: '220px' }}>Full Name</td>
                                    <td>
                                        {editing ? (
                                            <div>
                                                <input
                                                    type="text"
                                                    value={nameInput}
                                                    onChange={e => setNameInput(e.target.value)}
                                                    style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                                                />
                                                {!nameOk && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>Full name cannot be empty.</div>}
                                            </div>
                                        ) : individual.full_name}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600, width: '220px' }}>Email</td>
                                    <td>
                                        {editing ? (
                                            <div>
                                                <input
                                                    type="email"
                                                    value={emailInput}
                                                    onChange={e => { setEmailInput(e.target.value); setEmailVerified(false); }}
                                                    style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                                                />
                                                {!emailOk && emailInput && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>Enter a valid email address.</div>}
                                                {emailChanged && emailOk && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <OtpGate
                                                            channel="email"
                                                            identifier={emailInput.trim().toLowerCase()}
                                                            purpose="individual_email_change"
                                                            isValid={emailOk}
                                                            verified={emailVerified}
                                                            onVerified={() => setEmailVerified(true)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>{individual.email} {individual.email_verified ? <span style={{ color: '#16a34a', fontSize: '12px' }}>✓ verified</span> : <span style={{ color: '#b45309', fontSize: '12px' }}>unverified</span>}</>
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Mobile</td>
                                    <td>
                                        {editing ? (
                                            <div>
                                                <input
                                                    type="tel"
                                                    value={mobileInput}
                                                    onChange={e => { setMobileInput(e.target.value.replace(/\D/g, '').slice(0, 10)); setMobileVerified(false); }}
                                                    style={{ width: '100%', maxWidth: '360px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                                                />
                                                {!mobileOk && mobileInput && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>Enter a valid 10-digit Indian mobile number.</div>}
                                                {mobileChanged && mobileOk && (
                                                    <div style={{ marginTop: '8px' }}>
                                                        <OtpGate
                                                            channel="phone"
                                                            identifier={mobileInput.trim()}
                                                            purpose="individual_mobile_change"
                                                            isValid={mobileOk}
                                                            verified={mobileVerified}
                                                            onVerified={() => setMobileVerified(true)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>{individual.mobile} {individual.mobile_verified ? <span style={{ color: '#16a34a', fontSize: '12px' }}>✓ verified</span> : <span style={{ color: '#b45309', fontSize: '12px' }}>unverified</span>}</>
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Date of Birth</td>
                                    <td>
                                        {editing ? (
                                            <div>
                                                <div style={{ display: 'flex', gap: '8px', maxWidth: '360px' }}>
                                                    <select value={dobDay} onChange={e => setDobDay(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}>
                                                        <option value="">Day</option>
                                                        {[...Array(31)].map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                                                    </select>
                                                    <select value={dobMonth} onChange={e => setDobMonth(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}>
                                                        <option value="">Month</option>
                                                        {DOB_MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                                                    </select>
                                                    <select value={dobYear} onChange={e => setDobYear(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}>
                                                        <option value="">Year</option>
                                                        {[...Array(100)].map((_, i) => {
                                                            const y = DOB_CURRENT_YEAR - i;
                                                            return <option key={y} value={String(y)}>{y}</option>;
                                                        })}
                                                    </select>
                                                </div>
                                                {!dobOk && (dobDay || dobMonth || dobYear) && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>Select a complete date of birth.</div>}
                                            </div>
                                        ) : fmtDate(individual.dob)}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Gender</td>
                                    <td>
                                        {editing ? (
                                            <select
                                                value={genderInput}
                                                onChange={e => setGenderInput(e.target.value)}
                                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}
                                            >
                                                <option value="">Select…</option>
                                                {GENDER_OPTIONS.map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        ) : (GENDER_LABEL[individual.gender] || individual.gender || '—')}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Status</td>
                                    <td>
                                        {editing ? (
                                            <select
                                                value={statusInput}
                                                onChange={e => setStatusInput(e.target.value)}
                                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff' }}
                                            >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        ) : (
                                            individual.status === 'active'
                                                ? <span className="admin-tag good">Active</span>
                                                : <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Registered</td>
                                    <td>{fmtDateTime(individual.registration_date)}</td>
                                </tr>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>Last Updated</td>
                                    <td>{fmtDateTime(individual.updated_at)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {editing && (
                            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                                <button className="admin-btn" onClick={() => setEditing(false)}>Cancel</button>
                                <button
                                    className="admin-btn"
                                    style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#fff' }}
                                    disabled={!canSave || saving}
                                    onClick={handleSave}
                                >
                                    {saving ? 'Saving…' : '💾 Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'reports' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        {!individual.child_id ? (
                            <p style={{ color: '#6b7280', fontSize: '13px' }}>No linked game profile found for this account yet.</p>
                        ) : reportsLoading ? (
                            <p style={{ color: '#6b7280', fontSize: '13px' }}>Loading…</p>
                        ) : gameHistory.length === 0 ? (
                            <p style={{ color: '#6b7280', fontSize: '13px' }}>This individual hasn't played any games yet.</p>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                    {[
                                        ['Games Played', reportsSummary.distinctGamesCount],
                                        ['Total Attempts', reportsSummary.totalAttempts],
                                        ['Tests Completed', reportsSummary.completedCount],
                                    ].map(([label, value]) => (
                                        <div key={label} style={{ flex: '1 1 160px', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff' }}>
                                            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginBottom: '4px' }}>{label}</div>
                                            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>{value}</div>
                                        </div>
                                    ))}
                                </div>

                                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>All Attempts ({reportsSummary.totalAttempts})</h4>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Game / Test</th><th>Date &amp; Time</th><th>Attempt #</th>
                                                <th>Score</th><th>Max Score</th><th>Duration</th><th>Status</th><th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gameHistory.map(session => (
                                                <tr key={session.id}>
                                                    <td style={{ fontWeight: 600 }}>{GAME_LABELS[session.game_name] || session.game_name}</td>
                                                    <td>{fmtDateTime(session.start_time)}</td>
                                                    <td style={{ textAlign: 'center' }}>#{session.attempt_no || 1}</td>
                                                    <td style={{ textAlign: 'center' }}>{session.score ?? '—'}</td>
                                                    <td style={{ textAlign: 'center' }}>{GAME_MAX_SCORES[session.game_name] ?? '—'}</td>
                                                    <td>{fmtDuration(session.actual_game_time)}</td>
                                                    <td>
                                                        {session.status === 'completed'
                                                            ? <span className="admin-tag good">Completed</span>
                                                            : session.status === 'quit' || session.status === 'dropped' || session.status === 'rejected'
                                                            ? <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>{session.status}</span>
                                                            : session.status === 'paused'
                                                            ? <span className="admin-tag warn" style={{ background: '#fef9c3', color: '#854d0e', borderColor: '#fef08a' }}>Paused</span>
                                                            : <span className="admin-tag" style={{ background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}>{session.status}</span>}
                                                    </td>
                                                    <td>
                                                        {session.pdf_url ? (
                                                            <a
                                                                href={`${API_URL.replace('/api', '')}${session.pdf_url}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                style={{ fontSize: '12px', fontWeight: 700, color: '#4f46e5', textDecoration: 'none' }}
                                                            >
                                                                View Details
                                                            </a>
                                                        ) : (
                                                            <span style={{ color: '#cbd5e1', fontSize: '12px' }}>N/A</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {tab === 'password' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Reset Password</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                            Set a new login password for this account. No current password is required —
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

                {tab === 'login-history' && (
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
                        {sessionsSummary && (
                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '13px' }}>
                                <div><strong>{sessionsSummary.totalLogins}</strong> successful logins</div>
                                <div><strong>{sessionsSummary.totalFailed}</strong> failed attempts</div>
                                <div>Last login: <strong>{fmtDateTime(sessionsSummary.lastLogin)}</strong></div>
                            </div>
                        )}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Login Time</th><th>Logout Time</th><th>Duration</th><th>Status</th>
                                        <th>IP Address</th><th>Device</th><th>Browser / OS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessionsLoading ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>Loading…</td></tr>
                                    ) : sessions.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>No login history yet.</td></tr>
                                    ) : (
                                        sessions.map(s => (
                                            <tr key={s.id}>
                                                <td>{fmtDateTime(s.login_time)}</td>
                                                <td>{fmtDateTime(s.logout_time)}</td>
                                                <td>{fmtDuration(s.session_duration)}</td>
                                                <td>
                                                    {s.status === 'failed'
                                                        ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Failed</span>
                                                        : s.logout_time ? 'Logged out' : <span className="admin-tag good">Active</span>}
                                                </td>
                                                <td>{s.ip_address || '—'}</td>
                                                <td>{s.device_type || '—'}</td>
                                                <td>{[s.browser, s.os].filter(Boolean).join(' / ') || '—'}</td>
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
                                    {logsLoading ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Loading…</td></tr>
                                    ) : logs.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No edits recorded yet.</td></tr>
                                    ) : (
                                        logs.map(log => (
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

export default AdminIndividualDetail;
