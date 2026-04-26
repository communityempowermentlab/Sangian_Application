import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const AdminAssessorAdd = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile_number: ''
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Basic validation
        if (!formData.name.trim() || !formData.email.trim() || !formData.mobile_number.trim()) {
            setError('All fields are mandatory.');
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosAdmin.post('/admin/assessors', formData);
            navigate('/admin/assessors');
        } catch (err) {
            console.error('Add assessor error:', err);
            const serverMessage = err.response?.data?.message;
            if (serverMessage) {
                setError(serverMessage);
            } else if (err.message === "Network Error") {
                setError('Network Error: Cannot connect to the server at http://localhost:5000. Please ensure the backend is running.');
            } else {
                setError('Failed to add assessor. Please check uniqueness of email or server logs.');
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

                {error && (
                    <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', marginBottom: '20px', fontSize: '14px' }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Assessor Name <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Dr. John Doe"
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none' }}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Email ID <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="assessor@example.com"
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none' }}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Mobile Number <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                type="text"
                                name="mobile_number"
                                value={formData.mobile_number}
                                onChange={handleChange}
                                placeholder="e.g. 9876543210"
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none' }}
                                required
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
