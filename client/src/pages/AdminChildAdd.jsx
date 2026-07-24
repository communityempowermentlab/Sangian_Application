import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import ChildPhotoUpload from '../components/ChildPhotoUpload';

const AdminChildAdd = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ child_id: '', name: '', dobDay: '', dobMonth: '', dobYear: '', gender: '', mobile: '', father_name: '', mother_name: '', remarks: '', gram_sabha: '', hamlet: '' });
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
        if (!dobString) return null;
        const dobDate = new Date(dobString);
        if (isNaN(dobDate.getTime())) return null;
        
        let years = today.getFullYear() - dobDate.getFullYear();
        let months = today.getMonth() - dobDate.getMonth();
        let days = today.getDate() - dobDate.getDate();

        if (days < 0) {
            months--;
            const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += prevMonth.getDate();
        }
        
        if (months < 0) {
            years--;
            months += 12;
        }
        
        return { years, months, days };
    };

    const currentAge = calculateAge(getDobString());

    const validate = () => {
        const e = {};
        if (!formData.child_id.trim())                     e.child_id = 'Child ID is required.';
        if (!formData.name.trim())                         e.name     = 'Name is required.';
        if (!formData.father_name.trim())                  e.father_name = 'Father Name is required.';
        else if (formData.father_name.trim().length > 225) e.father_name = 'Father Name cannot exceed 225 characters.';
        if (!formData.mother_name.trim())                  e.mother_name = 'Mother Name is required.';
        else if (formData.mother_name.trim().length > 225) e.mother_name = 'Mother Name cannot exceed 225 characters.';

        const dobStr = getDobString();
        if (!dobStr) {
            e.dob = 'Date of birth is required.';
        } else {
            const dobDate = new Date(dobStr);
            if (isNaN(dobDate.getTime())) {
                e.dob = 'Invalid date';
            } else {
                const currentAgeObj = calculateAge(dobStr);
                if (currentAgeObj && (currentAgeObj.years < 7 || currentAgeObj.years > 15 || (currentAgeObj.years === 15 && (currentAgeObj.months > 0 || currentAgeObj.days > 0)))) {
                    e.dob = 'Child must be between 7 and 15 years old.';
                }
            }
        }
        if (!formData.gender)                               e.gender = 'Gender is required.';
        if (!/^[0-9]{10}$/.test(formData.mobile))          e.mobile = 'Enter a valid 10-digit mobile number.';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.id || e.target.name]: e.target.value });
        setErrors({ ...errors, [e.target.id || e.target.name]: null });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setIsSubmitting(true);
        setSuccessMsg('');

        try {
            const data = new FormData();
            data.append('child_id', formData.child_id.trim());
            data.append('name', formData.name.trim());
            data.append('dob', getDobString());
            data.append('gender', formData.gender);
            data.append('mobile', formData.mobile.trim());
            data.append('father_name', formData.father_name.trim());
            data.append('mother_name', formData.mother_name.trim());
            data.append('remarks', formData.remarks.trim());
            data.append('gram_sabha', formData.gram_sabha.trim());
            data.append('hamlet', formData.hamlet.trim());
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
                            {currentAge !== null && currentAge.years >= 0 && (
                                <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>
                                    {currentAge.years}y {currentAge.months}m {currentAge.days}d
                                </span>
                            )}
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
                                {[...Array(15)].map((_, i) => {
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

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="father_name" style={{ fontSize: '13px', fontWeight: 'bold' }}>Father Name *</label>
                        <input id="father_name" type="text" placeholder="Enter father name" style={fieldStyle('father_name')} value={formData.father_name} onChange={handleInputChange} maxLength={225} />
                        {errors.father_name && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.father_name}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="mother_name" style={{ fontSize: '13px', fontWeight: 'bold' }}>Mother Name *</label>
                        <input id="mother_name" type="text" placeholder="Enter mother name" style={fieldStyle('mother_name')} value={formData.mother_name} onChange={handleInputChange} maxLength={225} />
                        {errors.mother_name && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.mother_name}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="gram_sabha" style={{ fontSize: '13px', fontWeight: 'bold' }}>Gram Sabha</label>
                        <input id="gram_sabha" type="text" placeholder="Enter Gram Sabha" style={fieldStyle('gram_sabha')} value={formData.gram_sabha} onChange={handleInputChange} />
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="hamlet" style={{ fontSize: '13px', fontWeight: 'bold' }}>Hamlet Name</label>
                        <input id="hamlet" type="text" placeholder="Enter Hamlet Name" style={fieldStyle('hamlet')} value={formData.hamlet} onChange={handleInputChange} />
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="remarks" style={{ fontSize: '13px', fontWeight: 'bold' }}>Remarks</label>
                        <input id="remarks" type="text" placeholder="Enter remarks" style={fieldStyle('remarks')} value={formData.remarks} onChange={handleInputChange} />
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
