import { API_URL } from '../services/api';
import React, { useState } from 'react';
import axios from 'axios';
import ChildPhotoUpload from '../components/ChildPhotoUpload';
import { useLanguage } from '../contexts/LanguageContext';

const Register = () => {
    const { t } = useLanguage();
    const [photoFile, setPhotoFile] = useState(null);
    const [formData, setFormData] = useState({ name: '', dob: '', gender: '', mobile: '' });
    const [errors, setErrors] = useState({});
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const today = new Date();
    const maxDate = new Date(today.getFullYear() - 8,  today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const minDate = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()).toISOString().split('T')[0];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = t('register.errName');
        if (!formData.dob) {
            newErrors.dob = t('register.errDobRequired');
        } else {
            const dobDate = new Date(formData.dob);
            let age = today.getFullYear() - dobDate.getFullYear();
            const m = today.getMonth() - dobDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
            if (age < 8 || age >= 11) newErrors.dob = t('register.errDobAge');
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
            data.append('name',   formData.name.trim());
            data.append('dob',    formData.dob);
            data.append('gender', formData.gender);
            data.append('mobile', formData.mobile);
            if (photoFile) data.append('photo', photoFile);
            const response = await axios.post(API_URL + '/children/register', data);
            const generatedId = response.data.childId;
            setStatusMsg({ type: 'success', text: t('register.successMsg').replace('{id}', generatedId) });
            setFormData({ name: '', dob: '', gender: '', mobile: '' });
            setPhotoFile(null);
        } catch (err) {
            const msg = err.response?.data?.message || t('register.errGeneral');
            setStatusMsg({ type: 'error', text: msg });
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
                                <label htmlFor="dob">{t('register.dobLabel')}<span className="required">*</span></label>
                                <input
                                    type="date" id="dob" name="dob"
                                    value={formData.dob} onChange={handleChange}
                                    min={minDate} max={maxDate}
                                    className={errors.dob ? 'input-error' : ''} required
                                />
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
                                    <option value="other">{t('register.genderOther')}</option>
                                    <option value="prefer_not_to_say">{t('register.genderPrefer')}</option>
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
