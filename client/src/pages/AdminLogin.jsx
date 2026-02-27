import React, { useState } from 'react';
import axios from 'axios';
import ReCAPTCHA from 'react-google-recaptcha';
import './AdminLogin.css';

const AdminLogin = () => {
    const [formData, setFormData] = useState({ email: '', password: '', keepLoggedIn: false });
    const [errors, setErrors] = useState({ email: false, password: false, server: '' });
    const [captchaToken, setCaptchaToken] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const isValidEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));

        // Clear validation error on type
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: false }));
        }
    };

    const handleCaptchaSuccess = (token) => {
        setCaptchaToken(token);
        setErrors(prev => ({ ...prev, captcha: false }));
    };

    const handleCaptchaExpired = () => {
        setCaptchaToken(null);
    };

    const handleCaptchaError = () => {
        setCaptchaToken(null);
        setErrors(prev => ({ ...prev, captcha: true }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({ email: false, password: false, server: '', captcha: false });

        const isEmailValid = isValidEmail(formData.email);
        const isPasswordValid = formData.password.trim().length >= 6;

        if (!isEmailValid || !isPasswordValid) {
            setErrors(prev => ({
                ...prev,
                email: !isEmailValid,
                password: !isPasswordValid,
            }));
            return;
        }

        if (!captchaToken) {
            setErrors(prev => ({ ...prev, captcha: true }));
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post('http://localhost:5000/api/admin/login', {
                email: formData.email,
                password: formData.password,
                recaptchaToken: captchaToken // Validated serverside normally
            });

            // Save token to localStorage conditionally or always if keepLoggedIn (For now standard session)
            localStorage.setItem('adminToken', response.data.token);
            localStorage.setItem('adminSessionId', response.data.sessionId);
            localStorage.setItem('adminUser', JSON.stringify(response.data.admin));

            // Redirect to Admin Dashboard (Placeholder)
            window.location.href = '/admin/dashboard';

        } catch (error) {
            setErrors(prev => ({
                ...prev,
                server: error.response?.data?.message || 'Login failed. Please check your credentials.'
            }));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-dashboard-container">

                <a className="admin-top-left-logo" href="/" aria-label="Sangian Admin" style={{ display: 'flex', alignItems: 'center' }}>
                    <img src="/cel_admin_logo.png" alt="Sangian Admin" style={{ height: '44px', width: 'auto', display: 'block' }} />
                </a>

                <section className="admin-login-card" aria-label="Sangian Admin Login">
                    <div className="admin-login-head">
                        <div>
                            <h1>Sangian Admin Panel</h1>
                            <p>Please login to continue.</p>
                        </div>
                    </div>

                    <form className="admin-form" onSubmit={handleSubmit} noValidate>

                        <div className={`admin-field ${errors.email ? 'invalid' : ''}`}>
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="admin@sangian.com"
                                autoComplete="username"
                                value={formData.email}
                                onChange={handleChange}
                            />
                            <div className="admin-error">Please enter a valid email address.</div>
                        </div>

                        <div className={`admin-field ${errors.password ? 'invalid' : ''}`}>
                            <label htmlFor="password">Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    style={{ width: '100%', paddingRight: '40px' }} // Make room for icon
                                />
                                <span
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        fontSize: '16px'
                                    }}
                                    title={showPassword ? "Hide Password" : "Show Password"}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </span>
                            </div>
                            <div className="admin-error">Password is required (min 6 characters).</div>
                        </div>

                        <div className="admin-inline">
                            <label className="admin-checkbox" htmlFor="keepLoggedIn">
                                <input
                                    id="keepLoggedIn"
                                    name="keepLoggedIn"
                                    type="checkbox"
                                    checked={formData.keepLoggedIn}
                                    onChange={handleChange}
                                />
                                Keep me logged in
                            </label>
                        </div>

                        {/* Google reCAPTCHA v2 */}
                        <div className="admin-captcha-wrap">
                            <ReCAPTCHA
                                sitekey="6LdmUeEZAAAAABk5y8pRpyrBsABe92HP8m3yRTpF"
                                onChange={handleCaptchaSuccess}
                                onExpired={handleCaptchaExpired}
                                onErrored={handleCaptchaError}
                            />
                        </div>
                        {errors.captcha && (
                            <div className="admin-captcha-error show">Please verify reCAPTCHA.</div>
                        )}

                        {errors.server && (
                            <div className="admin-captcha-error show" style={{ textAlign: "center", marginTop: "10px" }}>
                                {errors.server}
                            </div>
                        )}

                        <button type="submit" className="admin-btn admin-btn-primary" disabled={!captchaToken || isSubmitting}>
                            {isSubmitting ? 'Authenticating...' : 'Admin Login'}
                        </button>

                    </form>
                </section>

                <div className="admin-copyright">
                    Copyright © 2026 - All rights reserved Community Empowerment Lab
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
