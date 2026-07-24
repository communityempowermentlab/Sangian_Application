import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import ChildPhotoUpload from '../components/ChildPhotoUpload';

const AdminChildAdd = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ child_id: '', name: '', dobDay: '', dobMonth: '', dobYear: '', gender: '', mobile: '' });
    const [photoFile, setPhotoFile]   = useState(null);
    const [errors, setErrors]         = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const today      = new Date();
    const maxDate    = new Date(today.getFullYear() - 7,  today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const minDate    = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate()).toISOString().split('T')[0];

    const getDobString = () => {
        if (!formData.dobYear || !formData.dobMonth || !formData.dobDay) return '';
        return `${formData.dobYear}-${formData.dobMonth.padStart(2, '0')}-${formData.dobDay.padStart(2, '0')}`;
    };

    const calculateAge = (dobString) => {
        if (!dobString) return '';
        const dobDate = new Date(dobString);
        if (isNaN(dobDate.getTime())) return ''; // invalid date like Feb 30
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
            age--;
        }
        return `${age} years old`;
    };

    const validate = () => {
        const e = {};
        if (!formData.child_id.trim())                      e.child_id = 'Child ID is required.';
        if (!formData.name.trim())                          e.name   = 'Name is required.';
        const dobStr = getDobString();
        if (!dobStr)                                        e.dob    = 'Date of birth is required.';
        else if (isNaN(new Date(dobStr).getTime()))         e.dob    = 'Invalid date.';
        else if (dobStr < minDate || dobStr > maxDate)
                                                            e.dob    = 'Child must be between 7 and 15 years old.';
        if (!formData.gender)                               e.gender = 'Gender is required.';
        if (!/^[0-9]{10}$/.test(formData.mobile))          e.mobile = 'Enter a valid 10-digit mobile number.';
        setErrors(e);
        return Object.keys(e).length === 0;
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
            // Use FormData to support optional photo upload
            const data = new FormData();
            data.append('child_id', formData.child_id.trim());
            data.append('name',   formData.name.trim());
            data.append('dob',    getDobString());
            data.append('gender', formData.gender);
            data.append('mobile', formData.mobile);
            if (photoFile) data.append('photo', photoFile);

            const response = await axiosAdmin.post('/admin/children', data);
            setSuccessMsg(`Child registered successfully! ID: ${response.data.child_id}`);
            setTimeout(() => navigate('/admin/children'), 1200);
        } catch (error) {
            console.error('Add child error:', error);
            const msg = error.response?.data?.message;
            if (msg && msg.toLowerCase().includes('already exists')) {
                setErrors({ ...errors, child_id: msg });
            } else {
                alert(msg || 'Failed to add child.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const fieldStyle = (key) => ({
        padding: '10px 12px', borderRadius: '8px',
        border: `1px solid ${errors[key] ? '#ef4444' : 'var(--border)'}`,
        outline: 'none', width: '100%',
    });

    return (
        <main className="admin-content" aria-label="Add New Child">
            <div className="admin-card w12">

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Add New Child</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>Enter child details below.</p>
                    </div>
                    <Link to="/admin/children" className="admin-btn admin-btn-ghost" style={{ padding: '8px 16px' }}>← Back to List</Link>
                </div>

                {successMsg && (
                    <div style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bbf7d0', fontWeight: '500' }}>
                        ✅ {successMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate encType="multipart/form-data"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>

                    {/* Photo upload — full width, top */}
                    <div style={{ gridColumn: 'span 12' }}>
                        <ChildPhotoUpload onChange={setPhotoFile} />
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="child_id" style={{ fontSize: '13px', fontWeight: 'bold' }}>Child Unique ID *</label>
                        <input id="child_id" type="text" placeholder="Enter unique ID (e.g., CH001)" style={fieldStyle('child_id')} value={formData.child_id} onChange={handleInputChange} />
                        {errors.child_id && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.child_id}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="name" style={{ fontSize: '13px', fontWeight: 'bold' }}>Child's Full Name *</label>
                        <input id="name" type="text" placeholder="Enter full name" style={fieldStyle('name')} value={formData.name} onChange={handleInputChange} />
                        {errors.name && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.name}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Date of Birth *</span>
                            {getDobString() && <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>{calculateAge(getDobString())}</span>}
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <select id="dobDay" style={{ ...fieldStyle('dob'), padding: '6px 10px', flex: 1, background: '#fff' }} value={formData.dobDay} onChange={handleInputChange}>
                                <option value="">Day</option>
                                {[...Array(31)].map((_, i) => <option key={i+1} value={String(i+1)}>{i+1}</option>)}
                            </select>
                            <select id="dobMonth" style={{ ...fieldStyle('dob'), padding: '6px 10px', flex: 1, background: '#fff' }} value={formData.dobMonth} onChange={handleInputChange}>
                                <option value="">Month</option>
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                            </select>
                            <select id="dobYear" style={{ ...fieldStyle('dob'), padding: '6px 10px', flex: 1, background: '#fff' }} value={formData.dobYear} onChange={handleInputChange}>
                                <option value="">Year</option>
                                {[...Array(9)].map((_, i) => {
                                    const y = today.getFullYear() - 15 + i;
                                    return <option key={y} value={String(y)}>{y}</option>;
                                })}
                            </select>
                        </div>
                        {errors.dob && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.dob}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="gender" style={{ fontSize: '13px', fontWeight: 'bold' }}>Gender *</label>
                        <select id="gender" style={{ ...fieldStyle('gender'), background: '#fff' }} value={formData.gender} onChange={handleInputChange}>
                            <option value="">Select</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                        {errors.gender && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.gender}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="mobile" style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile Number *</label>
                        <input id="mobile" type="tel" placeholder="10-digit mobile number" inputMode="numeric" style={fieldStyle('mobile')} value={formData.mobile} onChange={handleInputChange} />
                        {errors.mobile && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.mobile}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 12', marginTop: '10px' }}>
                        <button className="admin-btn admin-btn-primary" type="submit" disabled={isSubmitting} style={{ width: 'auto', minWidth: '150px' }}>
                            {isSubmitting ? 'Saving...' : 'Save Child'}
                        </button>
                    </div>

                </form>
            </div>
        </main>
    );
};

export default AdminChildAdd;
