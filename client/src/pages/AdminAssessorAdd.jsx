import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const fieldErrorStyle = { fontSize: '12px', color: '#dc2626', marginTop: '4px' };

const AdminAssessorAdd = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile_number: '',
        password: '',
        remarks: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (errors[name] || errors.general) {
            setErrors(prev => ({ ...prev, [name]: undefined, general: undefined }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Assessor name is required.';
        if (!formData.email.trim()) {
            newErrors.email = 'Email ID is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address.';
        }
        if (!formData.mobile_number.trim()) {
            newErrors.mobile_number = 'Mobile number is required.';
        } else {
            const mobileDigits = formData.mobile_number.replace(/\D/g, '');
            const normalized = mobileDigits.length === 12 && mobileDigits.startsWith('91') ? mobileDigits.slice(2) : mobileDigits;
            if (!/^[6-9]\d{9}$/.test(normalized)) newErrors.mobile_number = 'Please enter a valid 10-digit mobile number.';
        }
        if (!formData.password) {
            newErrors.password = 'Password is required.';
        } else if (formData.password.length < 8 || !/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
            newErrors.password = 'Password must be at least 8 characters and include a letter and a number.';
        }

        if (Object.keys(newErrors).length) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosAdmin.post('/admin/assessors', formData);
            navigate('/admin/assessors');
        } catch (err) {
            console.error('Add assessor error:', err);
            const serverMessage = err.response?.data?.message || '';
            if (/email/i.test(serverMessage)) {
                setErrors({ email: serverMessage });
            } else if (/mobile/i.test(serverMessage)) {
                setErrors({ mobile_number: serverMessage });
            } else if (serverMessage) {
                setErrors({ general: serverMessage });
            } else if (err.message === "Network Error") {
                setErrors({ general: 'Network Error: Cannot connect to the server at http://localhost:5000. Please ensure the backend is running.' });
            } else {
                setErrors({ general: 'Failed to add assessor. Please check uniqueness of email or server logs.' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="admin-content">
            <div className="admin-card w6">
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>➕ Add New Assessor</h3>
                    <p style={{ margin: '0', color: 'var(--muted)', fontSize: '14px' }}>Register a new clinical assessor into the system.</p>
                </div>

                {errors.general && (
                    <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                        ⚠️ {errors.general}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Assessor Name <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Dr. John Doe"
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${errors.name ? '#fca5a5' : '#e5e7eb'}`, outline: 'none', boxSizing: 'border-box' }}
                            />
                            {errors.name && <div style={fieldErrorStyle}>{errors.name}</div>}
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Email ID <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="assessor@example.com"
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${errors.email ? '#fca5a5' : '#e5e7eb'}`, outline: 'none', boxSizing: 'border-box' }}
                            />
                            {errors.email ? <div style={fieldErrorStyle}>{errors.email}</div> : (
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Must be unique — used to log in.</div>
                            )}
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Mobile Number <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                type="text"
                                name="mobile_number"
                                value={formData.mobile_number}
                                onChange={handleChange}
                                placeholder="e.g. 9876543210"
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${errors.mobile_number ? '#fca5a5' : '#e5e7eb'}`, outline: 'none', boxSizing: 'border-box' }}
                            />
                            {errors.mobile_number ? <div style={fieldErrorStyle}>{errors.mobile_number}</div> : (
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Must be unique — 10-digit Indian mobile number.</div>
                            )}
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Password <span style={{ color: '#dc2626' }}>*</span></label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Min 8 chars, letter + number"
                                    autoComplete="new-password"
                                    style={{ width: '100%', padding: '12px', paddingRight: '44px', borderRadius: '10px', border: `1px solid ${errors.password ? '#fca5a5' : '#e5e7eb'}`, outline: 'none', boxSizing: 'border-box' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(s => !s)}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', lineHeight: 1 }}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                            {errors.password ? <div style={fieldErrorStyle}>{errors.password}</div> : (
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Used by the assessor to log in and search children.</div>
                            )}
                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Remarks</label>
                            <textarea
                                name="remarks"
                                value={formData.remarks}
                                onChange={handleChange}
                                placeholder="Optional notes about this assessor"
                                rows={3}
                                maxLength={500}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            style={{ padding: '12px 24px', borderRadius: '10px', background: 'var(--primary)', color: '#ffffff', fontWeight: 'bold', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                        >
                            {isSubmitting ? 'Adding...' : 'Add Assessor'}
                        </button>
                        <Link
                            to="/admin/assessors"
                            style={{ padding: '12px 24px', borderRadius: '10px', background: '#f3f4f6', color: '#374151', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center' }}
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
};

export default AdminAssessorAdd;
