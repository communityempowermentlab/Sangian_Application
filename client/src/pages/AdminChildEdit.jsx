import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminChildEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        gender: '',
        mobile: '',
        status: 'active'
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [successMsg, setSuccessMsg] = useState('');

    // Calculate allowed date range (8 to 10 years old)
    const today = new Date();
    const maxDateObj = new Date(today.getFullYear() - 8, today.getMonth(), today.getDate());
    const minDateObj = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    const maxDate = maxDateObj.toISOString().split('T')[0];
    const minDate = minDateObj.toISOString().split('T')[0];

    useEffect(() => {
        fetchChildDetails();
    }, [id]);

    const fetchChildDetails = async () => {
        try {
            const response = await axios.get(`http://localhost:5000/api/admin/children/${id}`);
            const data = response.data;
            setFormData({
                name: data.name || '',
                dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
                gender: data.gender || '',
                mobile: data.mobile || '',
                status: data.status || 'active'
            });
        } catch (error) {
            console.error('Failed to fetch child details:', error);
            alert('Error fetching child details. They may not exist.');
            navigate('/admin/children');
        } finally {
            setIsLoading(false);
        }
    };

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
        setErrors({ ...errors, [e.target.id]: null });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        setSuccessMsg('');

        try {
            await axios.put(`http://localhost:5000/api/admin/children/${id}`, formData);
            setSuccessMsg('Child profile updated successfully!');
            navigate('/admin/children');
        } catch (error) {
            console.error('Edit child error:', error);
            alert(error.response?.data?.message || 'Failed to update child profile.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <main className="admin-content"><div style={{ padding: '20px' }}>Loading profile...</div></main>;
    }

    return (
        <main className="admin-content" aria-label="Edit Child Profile">
            <div className="admin-card w12">

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Edit Child Profile - {id}</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>Modify details or activate/deactivate the user's access.</p>
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

                    {/* Account Status Toggle (Moved from Listing Table) */}
                    <div style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                        <label htmlFor="status" style={{ fontSize: '13px', fontWeight: 'bold' }}>Account Status</label>
                        <select
                            id="status"
                            style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', background: '#fff', width: '200px' }}
                            value={formData.status}
                            onChange={handleInputChange}
                        >
                            <option value="active">Active (Can Login)</option>
                            <option value="inactive">Inactive (Blocked)</option>
                        </select>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            If set to Inactive, this child will immediately lose access to the frontend game portal.
                        </div>
                    </div>

                    <div style={{ gridColumn: 'span 12', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        <button className="admin-btn admin-btn-primary" type="submit" disabled={isSubmitting} style={{ width: 'auto', minWidth: '150px' }}>
                            {isSubmitting ? 'Saving...' : 'Update Profile'}
                        </button>
                    </div>

                </form>

            </div>
        </main>
    );
};

export default AdminChildEdit;
