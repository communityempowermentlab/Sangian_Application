import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosAssessor from '../services/axiosAssessor';
import ChildPhotoUpload from '../components/ChildPhotoUpload';
import { getAssessorInfo } from '../utils/assessorSession';

// Mirrors AdminChildAdd.jsx's fields, labels, and validation rules exactly
// (per the reintegration spec: same child fields Admin uses). The only
// differences are contextual: no organization picker — the assessor's own
// organization and identity are shown read-only and are the only values
// the backend ever uses (assessorController.js's addChild derives both
// server-side from the authenticated session, never from this form) — and
// the page shell matches the other assessor-facing pages
// (AssessorDashboard.jsx / AssessorSearchChild.jsx) rather than the admin
// panel's admin-content/admin-card chrome.
const fieldStyle = (hasError) => ({
    padding: '10px 12px', borderRadius: '8px',
    border: `1px solid ${hasError ? '#ef4444' : '#d1d5db'}`,
    outline: 'none', width: '100%', boxSizing: 'border-box',
});

const AssessorAddChild = () => {
    const assessorInfo = getAssessorInfo();

    const [orgInfo, setOrgInfo] = useState(null);       // { org_id, org_name } from /assessor/me
    const [orgLoading, setOrgLoading] = useState(true);
    const [orgError, setOrgError] = useState('');

    const [formData, setFormData] = useState({ child_id: '', name: '', dobDay: '', dobMonth: '', dobYear: '', gender: '', mobile: '', father_name: '', mother_name: '', remarks: '', gram_sabha: '', hamlet: '' });
    const [photoFile, setPhotoFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [groupOptions, setGroupOptions] = useState([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axiosAssessor.get('/assessor/me');
                setOrgInfo({ org_id: data.assessor?.org_id || null, org_name: data.assessor?.org_name || null });
            } catch (err) {
                setOrgError(err.response?.data?.message || 'Failed to load your account details.');
            } finally {
                setOrgLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        axiosAssessor.get('/assessor/child-groups')
            .then(res => setGroupOptions(res.data || []))
            .catch(err => console.error('Failed to fetch child groups:', err));
    }, []);

    const toggleGroup = (groupId) => {
        setSelectedGroupIds(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const today = new Date();

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
                if (currentAgeObj && (currentAgeObj.years < 7 || currentAgeObj.years > 16 || (currentAgeObj.years === 16 && (currentAgeObj.months > 0 || currentAgeObj.days > 0)))) {
                    e.dob = 'Child must be between 7 and 16 years old.';
                }
            }
        }
        if (!formData.gender)                      e.gender = 'Gender is required.';
        if (!/^[0-9]{10}$/.test(formData.mobile))  e.mobile = 'Enter a valid 10-digit mobile number.';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.id || e.target.name]: e.target.value });
        setErrors({ ...errors, [e.target.id || e.target.name]: null });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return; // guard against double-submit
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
            data.append('group_ids', JSON.stringify(selectedGroupIds));
            if (photoFile) data.append('photo', photoFile);

            const response = await axiosAssessor.post('/assessor/children', data);
            setSuccessMsg(`Child registered successfully! ID: ${response.data.child_id}`);
            setFormData({ child_id: '', name: '', dobDay: '', dobMonth: '', dobYear: '', gender: '', mobile: '', father_name: '', mother_name: '', remarks: '', gram_sabha: '', hamlet: '' });
            setPhotoFile(null);
            setSelectedGroupIds([]);
        } catch (error) {
            console.error('Add child error (assessor):', error);
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

    if (orgLoading) {
        return (
            <main className="main-shell" style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
                <p>Loading...</p>
            </main>
        );
    }

    if (orgError) {
        return (
            <main className="main-shell" style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ padding: '16px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    ⚠️ {orgError}
                </div>
            </main>
        );
    }

    if (!orgInfo?.org_id) {
        return (
            <main className="main-shell" style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ background: '#fff', borderRadius: '14px', padding: '32px', boxShadow: '0 2px 10px rgba(15,23,42,0.06)', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                    <h2 style={{ margin: '0 0 12px' }}>⚠️ No Organization Assigned</h2>
                    <p style={{ color: '#6b7280' }}>You are not currently assigned to an organization. Please contact your administrator.</p>
                    <Link to="/assessor/dashboard" className="btn modal-btn-primary" style={{ display: 'inline-block', marginTop: '16px', padding: '10px 22px', borderRadius: '10px', textDecoration: 'none' }}>
                        ← Back to Dashboard
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="main-shell" style={{ padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', boxShadow: '0 2px 10px rgba(15,23,42,0.06)', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1 style={{ fontSize: '20px', margin: '0 0 4px 0' }}>➕ Add New Child</h1>
                        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>Enter child details below.</p>
                    </div>
                    <Link to="/assessor/dashboard" className="form-link">← Back to Dashboard</Link>
                </div>

                {successMsg && (
                    <div style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bbf7d0', fontWeight: '500' }}>
                        ✅ {successMsg}{' '}
                        <Link to="/assessor/search-child" style={{ color: '#166534', textDecoration: 'underline' }}>Search this child →</Link>
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate encType="multipart/form-data"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>

                    <div style={{ gridColumn: 'span 12' }}>
                        <ChildPhotoUpload onChange={setPhotoFile} />
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="child_id" style={{ fontSize: '13px', fontWeight: 'bold' }}>Child Unique ID *</label>
                        <input id="child_id" type="text" placeholder="Enter unique ID (e.g., CH001)" style={fieldStyle(!!errors.child_id)} value={formData.child_id} onChange={handleInputChange} />
                        {errors.child_id && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.child_id}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="name" style={{ fontSize: '13px', fontWeight: 'bold' }}>Child's Full Name *</label>
                        <input id="name" type="text" placeholder="Enter full name" style={fieldStyle(!!errors.name)} value={formData.name} onChange={handleInputChange} />
                        {errors.name && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.name}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Organization</label>
                        <input type="text" readOnly disabled value={orgInfo.org_name || '—'} style={{ ...fieldStyle(false), background: '#f9fafb', color: '#6b7280' }} />
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Created By</label>
                        <input type="text" readOnly disabled value={assessorInfo?.name || 'Current Assessor'} style={{ ...fieldStyle(false), background: '#f9fafb', color: '#6b7280' }} />
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
                            <select id="dobDay" style={{ ...fieldStyle(!!errors.dob), padding: '6px 10px', flex: 1, background: '#fff' }} value={formData.dobDay} onChange={handleInputChange}>
                                <option value="">Day</option>
                                {[...Array(31)].map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                            </select>
                            <select id="dobMonth" style={{ ...fieldStyle(!!errors.dob), padding: '6px 10px', flex: 1, background: '#fff' }} value={formData.dobMonth} onChange={handleInputChange}>
                                <option value="">Month</option>
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                            </select>
                            <select id="dobYear" style={{ ...fieldStyle(!!errors.dob), padding: '6px 10px', flex: 1, background: '#fff' }} value={formData.dobYear} onChange={handleInputChange}>
                                <option value="">Year</option>
                                {[...Array(16)].map((_, i) => {
                                    const y = today.getFullYear() - 16 + i;
                                    return <option key={y} value={String(y)}>{y}</option>;
                                })}
                            </select>
                        </div>
                        {errors.dob && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.dob}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="gender" style={{ fontSize: '13px', fontWeight: 'bold' }}>Gender *</label>
                        <select id="gender" style={{ ...fieldStyle(!!errors.gender), background: '#fff' }} value={formData.gender} onChange={handleInputChange}>
                            <option value="">Select</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                        {errors.gender && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.gender}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="mobile" style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile Number *</label>
                        <input id="mobile" type="tel" placeholder="10-digit mobile number" inputMode="numeric" style={fieldStyle(!!errors.mobile)} value={formData.mobile} onChange={handleInputChange} />
                        {errors.mobile && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.mobile}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="father_name" style={{ fontSize: '13px', fontWeight: 'bold' }}>Father Name *</label>
                        <input id="father_name" type="text" placeholder="Enter father name" style={fieldStyle(!!errors.father_name)} value={formData.father_name} onChange={handleInputChange} maxLength={225} />
                        {errors.father_name && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.father_name}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="mother_name" style={{ fontSize: '13px', fontWeight: 'bold' }}>Mother Name *</label>
                        <input id="mother_name" type="text" placeholder="Enter mother name" style={fieldStyle(!!errors.mother_name)} value={formData.mother_name} onChange={handleInputChange} maxLength={225} />
                        {errors.mother_name && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.mother_name}</div>}
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="gram_sabha" style={{ fontSize: '13px', fontWeight: 'bold' }}>Gram Sabha</label>
                        <input id="gram_sabha" type="text" placeholder="Enter Gram Sabha" style={fieldStyle(false)} value={formData.gram_sabha} onChange={handleInputChange} />
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="hamlet" style={{ fontSize: '13px', fontWeight: 'bold' }}>Hamlet Name</label>
                        <input id="hamlet" type="text" placeholder="Enter Hamlet Name" style={fieldStyle(false)} value={formData.hamlet} onChange={handleInputChange} />
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="remarks" style={{ fontSize: '13px', fontWeight: 'bold' }}>Remarks</label>
                        <input id="remarks" type="text" placeholder="Enter remarks" style={fieldStyle(false)} value={formData.remarks} onChange={handleInputChange} />
                    </div>

                    <div style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Groups</label>
                        {groupOptions.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>No active groups for your organization yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
                                {groupOptions.map(g => (
                                    <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={selectedGroupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                                        {g.name}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ gridColumn: 'span 12', marginTop: '10px' }}>
                        <button className="btn modal-btn-primary" type="submit" disabled={isSubmitting} style={{ padding: '10px 24px', borderRadius: '10px', minWidth: '150px' }}>
                            {isSubmitting ? 'Saving...' : 'Save Child'}
                        </button>
                    </div>

                </form>
            </div>
        </main>
    );
};

export default AssessorAddChild;
