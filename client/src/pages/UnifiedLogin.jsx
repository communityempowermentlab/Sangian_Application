import { API_URL } from '../services/api';
import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import axiosIndividual from '../services/axiosIndividual';
import { useLanguage } from '../contexts/LanguageContext';
import { isAssessorSession } from '../utils/assessorSession';
import { isIndividualSession } from '../utils/individualSession';

const LOGIN_TYPES = [
    ['individual', '🧑 Individual'],
    ['assessor', '🎓 Assessor'],
];

const GENDER_OPTIONS = [
    ['male', 'Male'],
    ['female', 'Female'],
];
const DOB_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOB_CURRENT_YEAR = new Date().getFullYear();

// Bridges a successful individual login into the exact same
// currentChild/sessionId localStorage shape the assessor/child-search
// flow already uses — every game page, RequireChildAuth, resume/restart,
// and PDF generation then work completely unmodified.
const enterGameplay = (child, gameSessionId) => {
    localStorage.setItem('currentChild', JSON.stringify(child));
    localStorage.setItem('sessionId', gameSessionId);
    window.location.href = '/';
};

// Single entry point for the two roles that log in to actually play games
// — one toggle, same visual pattern as the registration page's Individual/
// Organization switch. Organization deliberately has no tab here:
// organizations are managed through the Admin Panel (see AdminLogin.jsx,
// shared with Staff/Super Admin), not this page — a different kind of
// account entirely, not a "play games" login.
const UnifiedLogin = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [loginType, setLoginType] = useState('individual');

    // ── Individual ──────────────────────────────────────────────────────
    const [indIdentifier, setIndIdentifier] = useState('');
    const [indPassword, setIndPassword] = useState('');
    const [showIndPassword, setShowIndPassword] = useState(false);
    const [indError, setIndError] = useState('');
    const [indSubmitting, setIndSubmitting] = useState(false);

    const [needsProfile, setNeedsProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({ dobDay: '', dobMonth: '', dobYear: '', gender: '' });
    const [profileErrors, setProfileErrors] = useState({});
    const [profileMsg, setProfileMsg] = useState('');
    const [isCompletingProfile, setIsCompletingProfile] = useState(false);

    // ── Assessor ─────────────────────────────────────────────────────────
    const [assessorEmail, setAssessorEmail] = useState('');
    const [assessorPassword, setAssessorPassword] = useState('');
    const [showAssessorPassword, setShowAssessorPassword] = useState(false);
    const [assessorError, setAssessorError] = useState('');
    const [assessorSubmitting, setAssessorSubmitting] = useState(false);

    // An individual can be logged in (valid individualToken) with
    // `currentChild` missing — every one of the ~15 game pages treats a
    // missing session as a plain child logout and clears it on quit,
    // without knowing about the individual/assessor overlay on top. Rather
    // than landing back on this page as a confusing dead end (still
    // "logged in" per the header, but with My Reports/gameplay broken),
    // silently re-establish the game session and continue straight through.
    const [repairFailed, setRepairFailed] = useState(false);
    const needsRepair = isIndividualSession() && !localStorage.getItem('currentChild') && !repairFailed;

    useEffect(() => {
        if (!needsRepair) return;
        axiosIndividual.post('/individual/ensure-session')
            .then(({ data }) => enterGameplay(data.child, data.gameSessionId))
            .catch(() => {
                // The account's own login is no longer valid either (or has
                // no linked profile at all) — clear it so the form below
                // renders instead of looping back into this same repair
                // attempt on every render.
                localStorage.removeItem('individualToken');
                localStorage.removeItem('individualSessionId');
                localStorage.removeItem('individualUser');
                setRepairFailed(true);
                setIndError('Your session could not be restored. Please log in again.');
            });
    }, [needsRepair]);

    // Already logged in as one of these roles — no need to log in again.
    if (isAssessorSession()) return <Navigate to="/assessor/dashboard" replace />;
    if (isIndividualSession() && localStorage.getItem('currentChild')) return <Navigate to="/" replace />;
    if (needsRepair) {
        return (
            <main className="main-shell" style={{ padding: '80px 24px', textAlign: 'center', color: '#6b7280' }}>
                <p>Restoring your session…</p>
            </main>
        );
    }

    const handleIndividualLogin = async (e) => {
        e.preventDefault();
        if (!indIdentifier.trim() || !indPassword) {
            setIndError('Please enter your email/mobile and password.');
            return;
        }
        setIndSubmitting(true);
        setIndError('');
        try {
            const { data } = await axios.post(`${API_URL}/individual/login`, { identifier: indIdentifier.trim(), password: indPassword });
            localStorage.setItem('individualToken', data.token);
            localStorage.setItem('individualSessionId', data.sessionId);
            localStorage.setItem('individualUser', JSON.stringify(data.user));

            if (data.needsProfileCompletion) {
                setNeedsProfile(true);
            } else {
                enterGameplay(data.child, data.gameSessionId);
            }
        } catch (err) {
            setIndError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setIndSubmitting(false);
        }
    };

    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        const errors = {};
        const { dobDay, dobMonth, dobYear, gender } = profileForm;
        const dobString = (dobDay && dobMonth && dobYear) ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}` : '';
        if (!dobString || isNaN(new Date(dobString).getTime())) errors.dob = 'Please select your complete date of birth.';
        if (!gender) errors.gender = 'Please select a gender.';
        if (Object.keys(errors).length) {
            setProfileErrors(errors);
            return;
        }
        setIsCompletingProfile(true);
        setProfileErrors({});
        setProfileMsg('');
        try {
            const { data } = await axiosIndividual.post('/individual/complete-profile', { dob: dobString, gender });
            enterGameplay(data.child, data.gameSessionId);
        } catch (err) {
            setProfileMsg(err.response?.data?.message || 'Failed to save. Please try again.');
        } finally {
            setIsCompletingProfile(false);
        }
    };

    const handleAssessorLogin = async (e) => {
        e.preventDefault();
        if (!assessorEmail.trim() || !assessorPassword) {
            setAssessorError('Please enter your email and password.');
            return;
        }
        setAssessorSubmitting(true);
        setAssessorError('');
        try {
            const { data } = await axios.post(`${API_URL}/assessor/login`, { email: assessorEmail.trim(), password: assessorPassword });
            localStorage.setItem('assessorToken', data.token);
            localStorage.setItem('assessorSessionId', data.sessionId);
            localStorage.setItem('assessorInfo', JSON.stringify(data.assessor));
            navigate('/assessor/dashboard', { replace: true });
        } catch (err) {
            setAssessorError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setAssessorSubmitting(false);
        }
    };

    // ── Adaptive left-panel copy per role ───────────────────────────────
    const leftPanel = {
        individual: {
            pill: 'Individual Account',
            heading: <>Play & Track<br /><span>Your Own Progress</span></>,
            description: "Log in to play every assessment game as yourself and keep a full record of your results.",
            bullets: [
                'Play every game on the platform',
                'See your complete history and past scores',
                "Download PDF reports of your results",
            ],
        },
        assessor: {
            pill: t('login.pill'),
            heading: <>{t('login.heading')}<br /><span>{t('login.headingSub')}</span></>,
            description: t('login.description'),
            bullets: [t('login.bullet1'), t('login.bullet2'), t('login.bullet3')],
        },
    }[loginType];

    return (
        <main className="main-shell">
            <section className="login-shell">
                <div className="login-card">
                    <div className="login-left">
                        <div className="login-pill">{leftPanel.pill}</div>
                        <h1 className="login-heading">{leftPanel.heading}</h1>
                        <p className="login-text">{leftPanel.description}</p>
                        <ul className="login-bullets">
                            {leftPanel.bullets.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                    </div>

                    <div className="login-right">
                        {/* Role toggle — same segmented-control pattern as the registration page's Individual/Organization switch */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>Log in as</label>
                            <div style={{ display: 'flex', gap: '8px', padding: '4px', background: '#f3f4f6', borderRadius: '12px' }}>
                                {LOGIN_TYPES.map(([value, label]) => (
                                    <button
                                        type="button"
                                        key={value}
                                        onClick={() => setLoginType(value)}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                            fontWeight: 700, fontSize: '13.5px', fontFamily: 'inherit',
                                            background: loginType === value ? '#fff' : 'transparent',
                                            color: loginType === value ? '#4f46e5' : '#6b7280',
                                            boxShadow: loginType === value ? '0 2px 8px rgba(15,23,42,0.12)' : 'none',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loginType === 'individual' && (
                            needsProfile ? (
                                <form className="login-form" onSubmit={handleCompleteProfile} noValidate>
                                    <h2 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>One More Step</h2>
                                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                                        We need your date of birth and gender before you can start playing.
                                    </p>

                                    <div className="form-group">
                                        <label>Date of Birth<span className="required">*</span></label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <select value={profileForm.dobDay} onChange={e => setProfileForm(f => ({ ...f, dobDay: e.target.value }))} style={{ flex: 1 }}>
                                                <option value="">Day</option>
                                                {[...Array(31)].map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                                            </select>
                                            <select value={profileForm.dobMonth} onChange={e => setProfileForm(f => ({ ...f, dobMonth: e.target.value }))} style={{ flex: 1 }}>
                                                <option value="">Month</option>
                                                {DOB_MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                                            </select>
                                            <select value={profileForm.dobYear} onChange={e => setProfileForm(f => ({ ...f, dobYear: e.target.value }))} style={{ flex: 1 }}>
                                                <option value="">Year</option>
                                                {[...Array(100)].map((_, i) => {
                                                    const y = DOB_CURRENT_YEAR - i;
                                                    return <option key={y} value={String(y)}>{y}</option>;
                                                })}
                                            </select>
                                        </div>
                                        {profileErrors.dob && <p className="field-error">{profileErrors.dob}</p>}
                                    </div>

                                    <div className="form-group" style={{ marginTop: '12px' }}>
                                        <label>Gender<span className="required">*</span></label>
                                        <select value={profileForm.gender} onChange={e => setProfileForm(f => ({ ...f, gender: e.target.value }))}>
                                            <option value="">Select…</option>
                                            {GENDER_OPTIONS.map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                        {profileErrors.gender && <p className="field-error">{profileErrors.gender}</p>}
                                    </div>

                                    {profileMsg && <div className="auth-server-msg auth-server-msg--err" style={{ marginTop: '10px' }}>{profileMsg}</div>}

                                    <button type="submit" className="btn modal-btn-primary" disabled={isCompletingProfile} style={{ padding: '10px 24px', borderRadius: '10px', marginTop: '18px' }}>
                                        {isCompletingProfile ? 'Saving…' : 'Continue'}
                                    </button>
                                </form>
                            ) : (
                                <form className="login-form" onSubmit={handleIndividualLogin} noValidate>
                                    <h2 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Individual Login</h2>
                                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                                        Sign in with your email or mobile number to start playing.
                                    </p>

                                    <div className="form-group">
                                        <label htmlFor="indIdentifier">Email or Mobile Number<span className="required">*</span></label>
                                        <input
                                            type="text"
                                            id="indIdentifier"
                                            value={indIdentifier}
                                            onChange={(e) => setIndIdentifier(e.target.value)}
                                            placeholder="jane@example.com"
                                            className={indError ? 'input-error' : ''}
                                            autoComplete="username"
                                        />
                                    </div>

                                    <div className="form-group" style={{ marginTop: '12px' }}>
                                        <label htmlFor="indPassword">Password<span className="required">*</span></label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showIndPassword ? 'text' : 'password'}
                                                id="indPassword"
                                                value={indPassword}
                                                onChange={(e) => setIndPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className={indError ? 'input-error' : ''}
                                                autoComplete="current-password"
                                                style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowIndPassword(s => !s)}
                                                title={showIndPassword ? 'Hide password' : 'Show password'}
                                                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '4px', lineHeight: 1 }}
                                            >
                                                {showIndPassword ? '🙈' : '👁️'}
                                            </button>
                                        </div>
                                    </div>

                                    {indError && <p className="field-error" style={{ marginTop: '10px' }}>{indError}</p>}

                                    <button type="submit" className="btn modal-btn-primary" disabled={indSubmitting} style={{ padding: '10px 24px', borderRadius: '10px', marginTop: '18px' }}>
                                        {indSubmitting ? 'Logging in...' : 'Login'}
                                    </button>

                                    <div className="auth-footer-link" style={{ marginTop: '14px' }}>
                                        Don't have an account? <a href="/signup/registration">Register</a>
                                    </div>

                                    <p className="form-note" style={{ marginTop: '16px' }}>{t('common.consentNote')}</p>
                                </form>
                            )
                        )}

                        {loginType === 'assessor' && (
                            <form className="login-form" onSubmit={handleAssessorLogin} noValidate>
                                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px' }}>Assessor Login</h2>
                                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280' }}>
                                    Log in with your assessor email and password to search a child and start an assessment.
                                </p>

                                <div className="form-group">
                                    <label htmlFor="assessorEmail">Email ID<span className="required">*</span></label>
                                    <input
                                        type="email"
                                        id="assessorEmail"
                                        value={assessorEmail}
                                        onChange={(e) => setAssessorEmail(e.target.value)}
                                        placeholder="assessor@example.com"
                                        className={assessorError ? 'input-error' : ''}
                                        autoComplete="username"
                                    />
                                </div>

                                <div className="form-group" style={{ marginTop: '12px' }}>
                                    <label htmlFor="assessorPassword">Password<span className="required">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showAssessorPassword ? 'text' : 'password'}
                                            id="assessorPassword"
                                            value={assessorPassword}
                                            onChange={(e) => setAssessorPassword(e.target.value)}
                                            placeholder="Enter your password"
                                            className={assessorError ? 'input-error' : ''}
                                            autoComplete="current-password"
                                            style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowAssessorPassword(s => !s)}
                                            title={showAssessorPassword ? 'Hide password' : 'Show password'}
                                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', padding: '4px', lineHeight: 1 }}
                                        >
                                            {showAssessorPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                </div>

                                {assessorError && <p className="field-error" style={{ marginTop: '10px' }}>{assessorError}</p>}

                                <button type="submit" className="btn modal-btn-primary" disabled={assessorSubmitting} style={{ padding: '10px 24px', borderRadius: '10px', marginTop: '18px' }}>
                                    {assessorSubmitting ? 'Logging in...' : 'Login'}
                                </button>

                                <p className="form-note" style={{ marginTop: '16px' }}>{t('common.consentNote')}</p>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
};

export default UnifiedLogin;
