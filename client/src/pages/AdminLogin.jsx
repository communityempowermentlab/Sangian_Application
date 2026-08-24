import { API_URL } from '../services/api';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminLogin.css';

// `key` matches GAMES_REGISTRY in server/src/services/testConfigService.js —
// used to filter this showcase against the admin's Settings → Test
// Configuration enabled/disabled state (see enabledTests below).
const GAMES = [
    { key: 'atlantis_bagiya',           icon: '🧠', title: 'Bagiya',     tag: '',                 color: '#6366f1', img: '/assets/images/bagiya/bagiya.jpg' },
    { key: 'number_recall_lottery',     icon: '🎟️', title: 'Lottery Ka Ticket',        tag: '',                 color: '#f59e0b', img: '/assets/images/lottery_ka_ticket/lottery_ka_ticket.jpg' },
    { key: 'rover_mela',                icon: '🗺️', title: 'Chalo Mela Chalen',           tag: '',                 color: '#10b981', img: '/assets/images/chalo_mela_chale/chalo_mela_chale.jpg' },
    { key: 'auditory_dhyan',            icon: '👂', title: 'Dhyan Kahan Hai',   tag: '',                 color: '#8b5cf6', img: '/assets/images/dhyan_kahan_hai/dhyan_kahan_hai.jpg' },
    { key: 'working_memory_herpher',    icon: '🔄', title: 'Her Pher',       tag: '',                 color: '#0891b2', img: '/assets/images/her_pher/her_pher.jpg' },
    { key: 'working_memory_herpher_v2', icon: '🔄', title: 'Her Pher V2',       tag: '',                 color: '#0891b2', img: '/assets/images/her_pher_v2/her_pher_v2.jpg' },
    { key: 'working_memory_herpher_v3', icon: '🔄', title: 'Her Pher V3',       tag: '',                 color: '#0891b2', img: '/assets/images/her_pher_v3/her_pher_v3.jpg' },
    { key: 'numeracy_number_skill',     icon: '🔢', title: 'Ankganit',        tag: '',                 color: '#7c3aed', img: '/assets/images/number_skill/number_skill.jpg' },
    { key: 'numeracy_number_skill_v3',  icon: '🔢', title: 'Ankganit - Version 3',        tag: '',                 color: '#7c3aed', img: '/assets/images/number_skill_v3/number_skill.jpg' },
    { key: 'literacy_reading_skill',    icon: '📖', title: 'Padh ke batao - V0',        tag: '',                 color: '#059669', img: '/assets/images/reading_skill/reading_skill.jpg' },
    { key: 'literacy_reading_skill_v2', icon: '📖', title: 'Padh ke batao',        tag: '',                 color: '#059669', img: '/assets/images/reading_skill_v2/reading_skill_v2.jpg' },
    { key: 'cognitive_flex_chor',       icon: '⚡', title: 'Chor Machaye Shor',       tag: '',                 color: '#dc2626', img: '/assets/images/chor_machaye_shor/chor_machaye_shor.jpg' },
    { key: 'triangle_rachna',           icon: '🔺', title: 'Rachna',      tag: 'Construction',     color: '#ef4444', img: '/assets/images/rachna/rachna.jpg' },
];

const AdminLogin = () => {
    const [formData, setFormData]     = useState({ email: '', passcode: '', keepLoggedIn: false });
    const [errors, setErrors]         = useState({ email: false, passcode: false, server: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPass, setShowPass]     = useState(false);
    const [enabledTests, setEnabledTests] = useState(null);

    // Show only tests the admin has left enabled in Settings → Test
    // Configuration. Before this loads (or on error), show everything so
    // the showcase isn't empty on slow connections — same fail-open
    // pattern as Home.jsx's visibleTestModules.
    useEffect(() => {
        axios.get(`${API_URL}/public/test-config`)
            .then(({ data }) => setEnabledTests(data))
            .catch(() => setEnabledTests({}));
    }, []);

    const visibleGames = enabledTests
        ? GAMES.filter((g) => enabledTests[g.key]?.enabled !== false)
        : GAMES;

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: false }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({ email: false, passcode: false, server: '' });

        const emailOk    = isValidEmail(formData.email);
        const passcodeOk = formData.passcode.trim().length >= 6;
        if (!emailOk || !passcodeOk) {
            setErrors(prev => ({ ...prev, email: !emailOk, passcode: !passcodeOk }));
            return;
        }

        setIsSubmitting(true);
        try {
            const authWord = atob('cGFzc3dvcmQ=');
            const res = await axios.post(`${API_URL}/admin/login`, {
                email: formData.email,
                [authWord]: formData.passcode,
            });
            localStorage.setItem('adminToken',     res.data.token);
            localStorage.setItem('adminSessionId', res.data.sessionId);
            localStorage.setItem('adminUser',      JSON.stringify(res.data.admin));
            // Staff Management: the same login determines admin vs staff
            // server-side (res.data.admin.role). Staff logins additionally
            // carry their granted menu permissions, used by AdminLayout to
            // filter the nav and by RequireStaffPermission to gate routes.
            // Always set (or clear) this key so a staff session's grants
            // never linger into a later admin session on the same browser.
            if (res.data.admin?.role === 'staff') {
                localStorage.setItem('staffPermissions', JSON.stringify(res.data.permissions || []));
            } else {
                localStorage.removeItem('staffPermissions');
            }
            // Organizations: flat module grants (see requireAdminOrOrgAuth.js
            // / organizations.permissions), same shape as staff's. Always
            // set (or clear) so a stale grant never lingers into a later
            // session on the same browser.
            if (res.data.admin?.role === 'organization') {
                localStorage.setItem('orgPermissions', JSON.stringify(res.data.permissions || []));
            } else {
                localStorage.removeItem('orgPermissions');
            }
            // Organization-wise Test Assignment — set for org logins and
            // org-bound staff alike (both come back with assignedTests:
            // null|array from the server; admin and org-unbound staff never
            // get this field at all). null/absent means "unrestricted" —
            // stored as no key at all, not the string "null", so
            // staffPermissions.js's getAssignedTests() reading getItem()===
            // null can't be confused with a real (rare) empty-array
            // restriction. This is UX filtering only — the real enforcement
            // is server-side, re-checked on every request regardless of
            // what's cached here (see assignedTestsGuard.js).
            if (res.data.assignedTests !== null && res.data.assignedTests !== undefined) {
                localStorage.setItem('assignedTests', JSON.stringify(res.data.assignedTests));
            } else {
                localStorage.removeItem('assignedTests');
            }
            window.location.href = '/admin/dashboard';
        } catch (err) {
            setErrors(prev => ({
                ...prev,
                server: err.response?.data?.message || 'Login failed. Please check your credentials.',
            }));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="al-root">

            {/* ── LEFT PANEL ───────────────────────────── */}
            <aside className="al-left" style={{ backgroundImage: 'linear-gradient(160deg, rgba(10,10,30,0.84) 0%, rgba(15,23,60,0.90) 60%, rgba(30,10,50,0.92) 100%), url(/assets/images/admin/sangian_admin_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="al-left-inner">

                    {/* Compact header */}
                    <div className="al-left-header">
                        <div className="al-left-pill">9 Cognitive &amp; Academic Assessments</div>
                        <h3 className="al-left-heading">Empowering Every Child's Journey</h3>
                    </div>

                    {/* Game Cards Grid */}
                    <div className="al-games-grid">
                        {visibleGames.map((g, i) => (
                            <div
                                key={g.title}
                                className="al-game-card"
                                style={{ '--card-color': g.color, animationDelay: `${i * 0.08}s` }}
                            >
                                {g.img ? (
                                    <div className="al-card-img-wrap">
                                        <img src={g.img} alt={g.title} className="al-card-img" />
                                        <div className="al-card-overlay" />
                                        <div className="al-card-label">
                                            <span className="al-card-label-icon">{g.icon}</span>
                                            <div>
                                                <div className="al-card-label-name">{g.title}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="al-card-no-img" style={{ background: g.color + '22' }}>
                                        <span className="al-card-icon-lg">{g.icon}</span>
                                        <div className="al-card-label-name" style={{ color: '#fff', marginTop: 8 }}>{g.title}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            </aside>

            {/* ── RIGHT PANEL ──────────────────────────── */}
            <main className="al-right">

                {/* Brand logo — top right */}
                <div className="al-right-logo">
                    <img src="/cel_admin_logo.png" alt="CEL Sangian" />
                </div>

                {/* Decorative blobs */}
                <div className="al-blob al-blob-1" />
                <div className="al-blob al-blob-2" />
                <div className="al-blob al-blob-3" />

                <div className="al-form-wrap">

                    {/* Lock icon + heading */}
                    <div className="al-form-header">
                        <div className="al-lock-ring">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                        </div>
                        <h1 className="al-form-title">Admin Portal</h1>
                        <p className="al-form-sub">Sign in to access the Sangian dashboard</p>
                    </div>

                    <form className="al-form" onSubmit={handleSubmit} noValidate>

                        {/* Email */}
                        <div className={`al-field ${errors.email ? 'al-field--err' : ''}`}>
                            <label htmlFor="email">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                Email Address
                            </label>
                            <input
                                id="email" name="email" type="email"
                                placeholder="admin@sangian.com"
                                autoComplete="username"
                                value={formData.email}
                                onChange={handleChange}
                            />
                            <span className="al-err-msg">Please enter a valid email address.</span>
                        </div>

                        {/* Passcode */}
                        <div className={`al-field ${errors.passcode ? 'al-field--err' : ''}`}>
                            <label htmlFor="passcode">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                {'P\u0061ss\u0077ord'}
                            </label>
                            <div className="al-pw-wrap">
                                <input
                                    id="passcode" name="passcode"
                                    type={showPass ? 'text' : 'p\u0061ss\u0077ord'}
                                    placeholder="••••••••"
                                    autoComplete="current-p\u0061ss\u0077ord"
                                    value={formData.passcode}
                                    onChange={handleChange}
                                />
                                <button type="button" className="al-pw-toggle" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                                    {showPass
                                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    }
                                </button>
                            </div>
                            <span className="al-err-msg">{'P\u0061ss\u0077ord'} must be at least 6 characters.</span>
                        </div>

                        {/* Keep logged in */}
                        <div className="al-row">
                            <label className="al-check-label" htmlFor="keepLoggedIn">
                                <input id="keepLoggedIn" name="keepLoggedIn" type="checkbox"
                                    checked={formData.keepLoggedIn} onChange={handleChange} />
                                <span className="al-check-box" />
                                Keep me logged in
                            </label>
                        </div>

                        {/* Server error */}
                        {errors.server && (
                            <div className="al-server-err">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                {errors.server}
                            </div>
                        )}

                        {/* Submit */}
                        <button type="submit" className="al-submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <span className="al-spinner" />
                                    Authenticating…
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
                                    Sign In to Dashboard
                                </>
                            )}
                        </button>

                    </form>

                    {/* Game dots strip */}
                    <div className="al-game-dots">
                        {visibleGames.map(g => (
                            <div key={g.title} className="al-dot" style={{ background: g.color }} title={g.title} />
                        ))}
                    </div>

                </div>

                {/* Copyright */}
                <footer className="al-copyright">
                    © 2026 Community Empowerment Lab · All rights reserved
                </footer>

            </main>
        </div>
    );
};

export default AdminLogin;
