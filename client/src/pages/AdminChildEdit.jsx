import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import ChildPhotoUpload from '../components/ChildPhotoUpload';

const AdminChildEdit = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({ new_child_id: '', name: '', dobDay: '', dobMonth: '', dobYear: '', gender: '', mobile: '', status: 'active' });
    const [currentPhoto, setCurrentPhoto] = useState(null);  // filename from DB
    const [photoFile, setPhotoFile]       = useState(null);  // new File selected
    const [errors, setErrors]     = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading]       = useState(true);
    const [successMsg, setSuccessMsg]     = useState('');

    const [activeTab, setActiveTab]       = useState('profile');
    const [logs, setLogs]                 = useState([]);
    const [logSearch, setLogSearch]       = useState('');

    const today   = new Date();
    const maxDate = new Date(today.getFullYear() - 7,  today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const minDate = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate()).toISOString().split('T')[0];

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

    useEffect(() => { 
        fetchChildDetails(); 
        fetchLogs();
    }, [id]);

    const fetchLogs = async () => {
        try {
            const response = await axiosAdmin.get(`/admin/children/${id}/logs`);
            setLogs(response.data);
        } catch (e) {
            console.error('Error fetching logs', e);
        }
    };

    const fetchChildDetails = async () => {
        try {
            const response = await axiosAdmin.get(`/admin/children/${id}`);
            const data = response.data;
            let dobDay = '', dobMonth = '', dobYear = '';
            if (data.dob) {
                const parts = new Date(data.dob).toISOString().split('T')[0].split('-');
                dobYear = parts[0];
                dobMonth = String(parseInt(parts[1], 10)); // remove leading zeros if any
                dobDay = String(parseInt(parts[2], 10));
            }
            setFormData({
                new_child_id: data.child_id || id,
                name:   data.name   || '',
                dobDay, dobMonth, dobYear,
                gender: data.gender || '',
                mobile: data.mobile || '',
                status: data.status || 'active',
            });
            setCurrentPhoto(data.photo || null);
        } catch (error) {
            console.error('Failed to fetch child details:', error);
            alert('Error fetching child details.');
            navigate('/admin/children');
        } finally {
            setIsLoading(false);
        }
    };

    const validate = () => {
        const e = {};
        if (!formData.new_child_id?.trim())                e.new_child_id = 'Child ID is required.';
        if (!formData.name.trim())                         e.name   = 'Name is required.';
        const dobStr = getDobString();
        if (!dobStr)                                        e.dob    = 'Date of birth is required.';
        else if (isNaN(new Date(dobStr).getTime()))         e.dob    = 'Invalid date.';
        else if (dobStr < minDate || dobStr > maxDate)
                                                            e.dob    = 'Child must be between 7 and 15 years old.';
        if (!formData.gender)                              e.gender = 'Gender is required.';
        if (!/^[0-9]{10}$/.test(formData.mobile))         e.mobile = 'Enter a valid 10-digit mobile number.';
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
            const data = new FormData();
            data.append('new_child_id', formData.new_child_id.trim());
            data.append('name',   formData.name.trim());
            data.append('dob',    getDobString());
            data.append('gender', formData.gender);
            data.append('mobile', formData.mobile);
            data.append('status', formData.status);
            if (photoFile) data.append('photo', photoFile);

            const res = await axiosAdmin.put(`/admin/children/${id}`, data);
            setSuccessMsg('Child profile updated successfully!');
            fetchLogs(); // refresh logs silently

            setTimeout(() => setSuccessMsg(''), 4000);

            if (res.data.new_child_id && res.data.new_child_id !== id) {
                // If ID was changed, navigate to the new edit URL so the page doesn't break
                navigate(`/admin/children/edit/${res.data.new_child_id}`);
            }
        } catch (error) {
            console.error('Edit child error:', error);
            const msg = error.response?.data?.message;
            if (msg && msg.toLowerCase().includes('already exists')) {
                setErrors({ ...errors, new_child_id: msg });
            } else {
                alert(msg || 'Failed to update child profile.');
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

    if (isLoading) {
        return <main className="admin-content"><div style={{ padding: '20px' }}>Loading profile...</div></main>;
    }

    return (
        <main className="admin-content" aria-label="Edit Child Profile">
            <div className="admin-card w12">

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Edit Child Profile — {id}</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>Modify details, change the Child ID, or activate/deactivate the child's access.</p>
                    </div>
                    <Link to="/admin/children" className="admin-btn admin-btn-ghost" style={{ padding: '8px 16px' }}>← Back to List</Link>
                </div>

                <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
                    <button type="button" onClick={() => setActiveTab('profile')} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'profile' ? 'bold' : 'normal', color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text)' }}>
                        Profile Details
                    </button>
                    <button type="button" onClick={() => setActiveTab('logs')} style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: activeTab === 'logs' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'logs' ? 'bold' : 'normal', color: activeTab === 'logs' ? 'var(--primary)' : 'var(--text)' }}>
                        Edit Logs
                    </button>
                </div>

                {successMsg && activeTab === 'profile' && (
                    <div style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bbf7d0', fontWeight: '500' }}>
                        ✅ {successMsg}
                    </div>
                )}

                {activeTab === 'profile' && (
                <form onSubmit={handleSubmit} noValidate encType="multipart/form-data"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>

                    {/* Photo upload — full width, shows existing photo */}
                    <div style={{ gridColumn: 'span 12' }}>
                        <ChildPhotoUpload currentPhoto={currentPhoto} onChange={setPhotoFile} label="Child Photo" />
                    </div>

                    <div style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="new_child_id" style={{ fontSize: '13px', fontWeight: 'bold' }}>Child Unique ID *</label>
                        <input id="new_child_id" type="text" placeholder="e.g., CH001" style={fieldStyle('new_child_id')} value={formData.new_child_id} onChange={handleInputChange} />
                        {errors.new_child_id && <div style={{ fontSize: '12px', color: '#ef4444' }}>{errors.new_child_id}</div>}
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

                    <div style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                        <label htmlFor="status" style={{ fontSize: '13px', fontWeight: 'bold' }}>Account Status</label>
                        <select id="status" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', background: '#fff', width: '220px' }} value={formData.status} onChange={handleInputChange}>
                            <option value="active">Active (Can Login)</option>
                            <option value="inactive">Inactive (Blocked)</option>
                        </select>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>If Inactive, the child immediately loses access to the game portal.</div>
                    </div>

                    <div style={{ gridColumn: 'span 12', marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                        <button className="admin-btn admin-btn-primary" type="submit" disabled={isSubmitting} style={{ width: 'auto', minWidth: '150px' }}>
                            {isSubmitting ? 'Saving...' : 'Update Profile'}
                        </button>
                    </div>

                </form>
                )}

                {activeTab === 'logs' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h4 style={{ margin: 0, alignSelf: 'center' }}>Audit Trail</h4>
                            <input 
                                type="text" 
                                placeholder="Search by Field Name or User..." 
                                value={logSearch} 
                                onChange={e => setLogSearch(e.target.value)} 
                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', minWidth: '250px' }} 
                            />
                        </div>
                        <div className="table-responsive" style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                <thead style={{ background: '#f8fafc' }}>
                                    <tr>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>Date & Time</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>Updated By</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>Field Name</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>Previous Value</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>New Value</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>IP Address</th>
                                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.filter(l => 
                                        (l.field_name || '').toLowerCase().includes(logSearch.toLowerCase()) || 
                                        (l.updated_by_name || '').toLowerCase().includes(logSearch.toLowerCase()) ||
                                        (l.old_value || '').toLowerCase().includes(logSearch.toLowerCase()) ||
                                        (l.new_value || '').toLowerCase().includes(logSearch.toLowerCase())
                                    ).map(log => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '12px 16px' }}>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                                            <td style={{ padding: '12px 16px' }}>{log.updated_by_name}</td>
                                            <td style={{ padding: '12px 16px', fontWeight: '500' }}>{log.field_name}</td>
                                            <td style={{ padding: '12px 16px', color: '#dc2626' }}>{log.old_value || '—'}</td>
                                            <td style={{ padding: '12px 16px', color: '#16a34a' }}>{log.new_value || '—'}</td>
                                            <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{log.ip_address}</td>
                                            <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{log.action_type}</span></td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>No logs found for this child profile.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
};

export default AdminChildEdit;
