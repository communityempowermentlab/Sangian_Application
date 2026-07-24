import { API_URL } from '../services/api';
import React, { useState } from 'react';
import axios from 'axios';
import ChildPhotoUpload from '../components/ChildPhotoUpload';
import { useLanguage } from '../contexts/LanguageContext';

const Register = () => {
    const { t } = useLanguage();
    const [photoFile, setPhotoFile] = useState(null);
    const [formData, setFormData] = useState({ child_id: '', name: '', dobDay: '', dobMonth: '', dobYear: '', gender: '', mobile: '' });
    const [errors, setErrors] = useState({});
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 7,  today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const minDate = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate()).toISOString().split('T')[0];

    const getDobString = () => {
        if (!formData.dobYear || !formData.dobMonth || !formData.dobDay) return '';
        return `${formData.dobYear}-${formData.dobMonth.padStart(2, '0')}-${formData.dobDay.padStart(2, '0')}`;
    };

    const calculateAge = (dobString) => {
        if (!dobString) return null;
        const dobDate = new Date(dobString);
        if (isNaN(dobDate.getTime())) return null;
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
        return age;
    };
    
    const currentAge = calculateAge(getDobString());

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.child_id.trim()) newErrors.child_id = t('register.errChildId') || 'Child ID is required';
        if (!formData.name.trim()) newErrors.name = t('register.errName');
        const dobStr = getDobString();
        if (!dobStr) {
            newErrors.dob = t('register.errDobRequired');
        } else {
            const dobDate = new Date(dobStr);
            if (isNaN(dobDate.getTime())) {
                newErrors.dob = 'Invalid date';
            } else if (dobStr < minDate || dobStr > maxDate) {
                newErrors.dob = t('register.errDobAge') || 'Child must be between 7 and 15 years old.';
            }
        }
        if (!formData.gender) newErrors.gender = t('register.errGender');
        if (!formData.mobile) {
            newErrors.mobile = t('register.errMobileRequired');
        } else if (!/^[0-9]{10}$/.test(formData.mobile)) {
            newErrors.mobile = t('register.errMobileInvalid');
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSubmitting(true);
        setStatusMsg({ type: '', text: '' });
        try {
            const data = new FormData();
            data.append('child_id', formData.child_id.trim());
            data.append('name',   formData.name.trim());
            data.append('dob',    getDobString());
            data.append('gender', formData.gender);
            data.append('mobile', formData.mobile);
            if (photoFile) data.append('photo', photoFile);
            const response = await axios.post(API_URL + '/children/register', data);
            const generatedId = response.data.childId;
            setStatusMsg({ type: 'success', text: t('register.successMsg').replace('{id}', generatedId) });
            setFormData({ child_id: '', name: '', dobDay: '', dobMonth: '', dobYear: '', gender: '', mobile: '' });
            setPhotoFile(null);
        } catch (err) {
            const msg = err.response?.data?.message || t('register.errGeneral');
            if (msg.toLowerCase().includes('already exists')) {
                setErrors({ ...errors, child_id: msg });
            } else {
                setStatusMsg({ type: 'error', text: msg });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="main-shell">
            <section className="register-shell">
                <div className="register-card">
                    <div className="register-left">
                        <div className="register-pill">{t('register.pill')}</div>
                        <h1 className="register-heading">
                            {t('register.heading')}<br />
                            <span>{t('register.headingSub')}</span>
                        </h1>
                        <p className="register-text">{t('register.description')}</p>
                        <ul className="register-bullets">
                            <li>{t('register.bullet1')}</li>
                            <li>{t('register.bullet2')}</li>
                            <li>{t('register.bullet3')}</li>
                        </ul>
                    </div>

                    <div className="register-right">
                        {statusMsg.text && (
                            <div className="form-success" style={{
                                display: 'block',
                                backgroundColor: statusMsg.type === 'error' ? '#fef2f2' : '#ecfdf3',
                                borderColor:     statusMsg.type === 'error' ? '#ef4444' : '#22c55e',
                                color:           statusMsg.type === 'error' ? '#991b1b' : '#166534',
                            }}>
                                {statusMsg.text}
                            </div>
                        )}

                        <form className="register-form" onSubmit={handleSubmit} noValidate encType="multipart/form-data">
                            <div className="form-group">
                                <ChildPhotoUpload onChange={setPhotoFile} label={t('register.photoLabel')} />
                            </div>

                            <div className="form-group">
                                <label htmlFor="child_id">{t('register.childIdLabel') || 'Child Unique ID'}<span className="required">*</span></label>
                                <input
                                    type="text" id="child_id" name="child_id"
                                    value={formData.child_id} onChange={handleChange}
                                    placeholder={t('register.childIdPlaceholder') || 'Enter unique ID'}
                                    className={errors.child_id ? 'input-error' : ''} required
                                />
                                <p className="field-error">{errors.child_id}</p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="name">{t('register.nameLabel')}<span className="required">*</span></label>
                                <input
                                    type="text" id="name" name="name"
                                    value={formData.name} onChange={handleChange}
                                    placeholder={t('register.namePlaceholder')}
                                    className={errors.name ? 'input-error' : ''} required
                                />
                                <p className="field-error">{errors.name}</p>
                            </div>

                            <div className="form-group">
                                <label>
                                    {t('register.dobLabel')}<span className="required">*</span>
                                    {currentAge !== null && currentAge >= 0 && (
                                        <span style={{ marginLeft: '8px', fontWeight: 'normal', color: '#4b5563', fontSize: '13px' }}>
                                            (Age: {currentAge} {currentAge === 1 ? 'year' : 'years'})
                                        </span>
                                    )}
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select name="dobDay" className={errors.dob ? 'input-error' : ''} style={{ flex: 1, padding: '10px' }} value={formData.dobDay} onChange={handleChange}>
                                        <option value="">Day</option>
                                        {[...Array(31)].map((_, i) => <option key={i+1} value={String(i+1)}>{i+1}</option>)}
                                    </select>
                                    <select name="dobMonth" className={errors.dob ? 'input-error' : ''} style={{ flex: 1, padding: '10px' }} value={formData.dobMonth} onChange={handleChange}>
                                        <option value="">Month</option>
                                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                                    </select>
                                    <select name="dobYear" className={errors.dob ? 'input-error' : ''} style={{ flex: 1, padding: '10px' }} value={formData.dobYear} onChange={handleChange}>
                                        <option value="">Year</option>
                                        {[...Array(9)].map((_, i) => {
                                            const y = today.getFullYear() - 15 + i;
                                            return <option key={y} value={String(y)}>{y}</option>;
                                        })}
                                    </select>
                                </div>
                                <p className="field-error">{errors.dob}</p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="gender">{t('register.genderLabel')}<span className="required">*</span></label>
                                <select
                                    id="gender" name="gender"
                                    value={formData.gender} onChange={handleChange}
                                    className={errors.gender ? 'input-error' : ''} required
                                >
                                    <option value="">{t('register.genderDefault')}</option>
                                    <option value="female">{t('register.genderFemale')}</option>
                                    <option value="male">{t('register.genderMale')}</option>
                                </select>
                                <p className="field-error">{errors.gender}</p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="mobile">{t('register.mobileLabel')}<span className="required">*</span></label>
                                <input
                                    type="tel" id="mobile" name="mobile"
                                    value={formData.mobile} onChange={handleChange}
                                    placeholder={t('register.mobilePlaceholder')}
                                    maxLength="10"
                                    className={errors.mobile ? 'input-error' : ''} required
                                />
                                <small className="field-hint">{t('register.mobileHint')}</small>
                                <p className="field-error">{errors.mobile}</p>
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn form-btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? t('register.submittingBtn') : t('register.submitBtn')}
                                </button>
                                <a href="/" className="form-link">{t('common.backToHub')}</a>
                            </div>

                            <p className="form-note">{t('common.consentNote')}</p>
                        </form>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Register;
