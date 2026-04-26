import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const AdminAssessorEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile_number: '',
        status: 'active'
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchAssessor();
    }, [id]);

    const fetchAssessor = async () => {
        try {
            const response = await axiosAdmin.get(`/admin/assessors/${id}`);
            setFormData({
                name: response.data.name,
                email: response.data.email,
                mobile_number: response.data.mobile_number,
                status: response.data.status || 'active'
            });
        } catch (err) {
            setError('Failed to fetch assessor details.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim() || !formData.email.trim() || !formData.mobile_number.trim() || !formData.status) {
            setError('All fields are mandatory.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsSubmitting(true);
        try {
            await axiosAdmin.put(`/admin/assessors/${id}`, formData);
            navigate('/admin/assessors');
        } catch (err) {
            console.error('Update assessor error:', err);
            const serverMessage = err.response?.data?.message;
            if (serverMessage) {
                setError(serverMessage);
            } else {
                setError('Failed to update assessor. Check if email ID is already taken or server logs.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="admin-content"><p>Loading details...</p></div>;

    return (
        <main className="admin-content">
            <div className="admin-card w6">
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>✏️ Edit Assessor</h3>
                    <p style={{ margin: '0', color: 'var(--muted)', fontSize: '14px' }}>Update the details for this clinical assessor.</p>
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
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none' }}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>Status <span style={{ color: '#dc2626' }}>*</span></label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', outline: 'none', background: '#ffffff' }}
                                required
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            style={{ padding: '12px 24px', borderRadius: '10px', background: 'var(--primary)', color: '#ffffff', fontWeight: 'bold', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
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

export default AdminAssessorEdit;
