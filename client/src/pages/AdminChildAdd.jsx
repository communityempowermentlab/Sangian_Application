import { API_URL } from '../services/api';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminChildAdd = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        gender: '',
        mobile: ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Calculate allowed date range (8 to 10 years old)
    const today = new Date();
    const maxDateObj = new Date(today.getFullYear() - 8, today.getMonth(), today.getDate());
    const minDateObj = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());

    // Format to YYYY-MM-DD for input type="date"
    const maxDate = maxDateObj.toISOString().split('T')[0];
    const minDate = minDateObj.toISOString().split('T')[0];

    const validate = () => {
        let newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Name is required.';
        if (!formData.dob) {
            newErrors.dob = 'Date of birth is required.';
        } else if (formData.dob < minDate || formData.dob > maxDate) {
            newErrors.dob = 'Child must be between 8 and 10 years old.';
        }
        if (!formData.gender) newErrors.gender = 'Gender is required.';
        if (!formData.mobile.match(/^[0-9]{10}$/)) newErrors.mobile = 'Enter a valid 10-digit mobile number.';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
        setErrors({ ...errors, [e.target.id]: null }); // Clear error on change
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        setSuccessMsg('');

        try {
            const response = await axios.post(API_URL + '/admin/children', formData);
            setSuccessMsg(`Child registered successfully! Generated ID: ${response.data.child_id}`);
            setTimeout(() => {
                navigate('/admin/children');
            }, 1000);
        } catch (error) {
            console.error('Add child error:', error);
            alert(error.response?.data?.message || 'Failed to add child.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="admin-content" aria-label="Add New Child">
            <div className="admin-card w12">

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Add New Child</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>Enter child details. Unique ID will be generated after saving.</p>
                    </div>
                    <div>
                        <Link to="/admin/children" className="admin-btn admin-btn-ghost" style={{ padding: '8px 16px' }}>
                            ← Back to List
                        </Link>
                    </div>
                </div>

                {successMsg && (
                    <div style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bbf7d0', fontWeight: '500' }}>
                        ✅ {successMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="name" style={{ fontSize: '13px', fontWeight: 'bold' }}>Child's Full Name *</label>
                        <input
                            id="name"
                            type="text"
                            placeholder="Enter full name"
                            style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${errors.name ? '#ef4444' : 'var(--border)'}`, outline: 'none' }}
                            value={formData.name}
                            onChange={handleInputChange}
                        />
                        {errors.name && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.name}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="dob" style={{ fontSize: '13px', fontWeight: 'bold' }}>Date of Birth *</label>
                        <input
                            id="dob"
                            type="date"
                            min={minDate}
                            max={maxDate}
                            style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${errors.dob ? '#ef4444' : 'var(--border)'}`, outline: 'none' }}
                            value={formData.dob}
                            onChange={handleInputChange}
                        />
                        {errors.dob && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.dob}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="gender" style={{ fontSize: '13px', fontWeight: 'bold' }}>Gender *</label>
                        <select
                            id="gender"
                            style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${errors.gender ? '#ef4444' : 'var(--border)'}`, outline: 'none', background: '#fff' }}
                            value={formData.gender}
                            onChange={handleInputChange}
                        >
                            <option value="">Select</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                        {errors.gender && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.gender}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="mobile" style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile Number *</label>
                        <input
                            id="mobile"
                            type="tel"
                            placeholder="10-digit mobile number"
                            inputMode="numeric"
                            style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${errors.mobile ? '#ef4444' : 'var(--border)'}`, outline: 'none' }}
                            value={formData.mobile}
                            onChange={handleInputChange}
                        />
                        {errors.mobile && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.mobile}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 12', marginTop: '10px' }}>
                        <button className="admin-btn admin-btn-primary" type="submit" disabled={isSubmitting} style={{ width: 'auto', minWidth: '150px' }}>
                            {isSubmitting ? 'Saving...' : 'Save Child'}
                        </button>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                            Child Unique ID will be auto-generated after saving.
                        </div>
                    </div>

                </form>

            </div>
        </main>
    );
};

export default AdminChildAdd;
