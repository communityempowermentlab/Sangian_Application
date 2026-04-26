import { API_URL } from '../services/api';
import React, { useState } from 'react';
import axios from 'axios';
import './AdminLogin.css';

const GAMES = [
    { icon: '🧠', title: 'Atlantis Bagiya',     tag: 'Visual Memory',    color: '#6366f1', img: '/assets/images/bagiya/bagiya.jpg' },
    { icon: '🎟️', title: 'Number Recall',        tag: 'Auditory Span',    color: '#f59e0b', img: '/assets/images/lottery_ka_ticket/lottery_ka_ticket.jpg' },
    { icon: '🗺️', title: 'Rover Game',           tag: 'Spatial Planning', color: '#10b981', img: '/assets/images/chalo_mela_chale/chalo_mela_chale.jpg' },
    { icon: '🔺', title: 'Triangle Rachna',      tag: 'Construction',     color: '#ef4444', img: '/assets/images/rachna/rachna.jpg' },
    { icon: '👂', title: 'Auditory Attention',   tag: 'Listening Focus',  color: '#8b5cf6', img: '/assets/images/dhyan_kahan_hai/dhyan_kahan_hai.jpg' },
    { icon: '🔄', title: 'Working Memory',       tag: 'Dynamic Memory',   color: '#0891b2', img: '/assets/images/her_pher/her_pher.jpg' },
    { icon: '⚡', title: 'Cognitive Flex',       tag: 'Rule Switching',   color: '#dc2626', img: '/assets/images/chor_machaye_shor/chor_machaye_shor.jpg' },
    { icon: '🔢', title: 'Numeracy Test',        tag: 'Maths Skills',     color: '#7c3aed', img: '/assets/images/number_skill.jpg' },
    { icon: '📖', title: 'Literacy Test',        tag: 'Language Skills',  color: '#059669', img: '/assets/images/reading_skill/reading_skill.jpg' },
];

const AdminLogin = () => {
    const [formData, setFormData]     = useState({ email: '', password: '', keepLoggedIn: false });
    const [errors, setErrors]         = useState({ email: false, password: false, server: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: false }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({ email: false, password: false, server: '' });

        const emailOk    = isValidEmail(formData.email);
        const passwordOk = formData.password.trim().length >= 6;
        if (!emailOk || !passwordOk) {
            setErrors(prev => ({ ...prev, email: !emailOk, password: !passwordOk }));
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await axios.post(`${API_URL}/admin/login`, {
                email: formData.email,
                password: formData.password,
            });
            localStorage.setItem('adminToken',     res.data.token);
            localStorage.setItem('adminSessionId', res.data.sessionId);
            localStorage.setItem('adminUser',      JSON.stringify(res.data.admin));
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
                        {GAMES.map((g, i) => (
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
                                                <div className="al-card-label-tag" style={{ color: g.color }}>{g.tag}</div>
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

                        {/* Password */}
                        <div className={`al-field ${errors.password ? 'al-field--err' : ''}`}>
                            <label htmlFor="password">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                Password
                            </label>
                            <div className="al-pw-wrap">
                                <input
                                    id="password" name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                                <button type="button" className="al-pw-toggle" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                                    {showPassword
                                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    }
                                </button>
                            </div>
                            <span className="al-err-msg">Password must be at least 6 characters.</span>
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
                        {GAMES.map(g => (
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
