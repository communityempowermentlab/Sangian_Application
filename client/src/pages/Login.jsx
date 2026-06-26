import { API_URL } from '../services/api';
import { getChildPhotoOrDefault } from '../services/photoUtils';
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();
    const [childId, setChildId] = useState('');
    const [childData, setChildData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const from = location.state?.from?.pathname || '/';

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!childId.trim()) {
            setErrorMsg(t('login.errRequired'));
            return;
        }

        setIsSearching(true);
        setErrorMsg('');
        setChildData(null);

        try {
            const response = await axios.get(`${API_URL}/children/lookup/${childId.trim()}`);
            setChildData(response.data);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                setErrorMsg(t('login.errNotFound'));
                axios.post(API_URL + '/sessions/fail', { attemptedChildId: childId.trim() }).catch(() => {});
            } else {
                const diag = `[${err.code || 'NO_CODE'}] ${err.message || 'unknown'} URL=${API_URL}`;
                setErrorMsg(`${t('login.errServer')} - ${diag}`);
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleGoToAssessment = async () => {
        if (childData) {
            try {
                const response = await axios.post(API_URL + '/sessions/start', { childId: childData.child_id });
                const sessionId = response.data.sessionId;
                localStorage.setItem('currentChild', JSON.stringify(childData));
                localStorage.setItem('sessionId', sessionId);
                window.location.href = from;
            } catch {
                setErrorMsg(t('login.errSession'));
            }
        }
    };

    return (
        <main className="main-shell">
            <section className="login-shell">
                <div className="login-card">
                    <div className="login-left">
                        <div className="login-pill">{t('login.pill')}</div>
                        <h1 className="login-heading">
                            {t('login.heading')}<br />
                            <span>{t('login.headingSub')}</span>
                        </h1>
                        <p className="login-text">{t('login.description')}</p>
                        <ul className="login-bullets">
                            <li>{t('login.bullet1')}</li>
                            <li>{t('login.bullet2')}</li>
                            <li>{t('login.bullet3')}</li>
                        </ul>
                    </div>

                    <div className="login-right">
                        <form className="login-form" onSubmit={handleSearch}>
                            <div className="form-group">
                                <label htmlFor="childId">{t('login.fieldLabel')}<span className="required">*</span></label>
                                <div className="child-id-row">
                                    <input
                                        type="text"
                                        id="childId"
                                        value={childId}
                                        onChange={(e) => setChildId(e.target.value)}
                                        placeholder={t('login.placeholder')}
                                        className={errorMsg ? 'input-error' : ''}
                                    />
                                    <button type="submit" className="btn modal-btn-primary" disabled={isSearching} style={{ padding: '8px 20px', borderRadius: '10px' }}>
                                        {isSearching ? t('login.searchingBtn') : t('login.searchBtn')}
                                    </button>
                                </div>
                                {errorMsg && <p className="field-error">{errorMsg}</p>}
                            </div>
                        </form>

                        <div className="child-details-card">
                            <div className="child-details-header">
                                <h2>{t('login.cardTitle')}</h2>
                                <span className="child-details-status">
                                    {childData ? t('login.detailsFound') : t('login.noChild')}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginTop: '15px' }}>
                                <div style={{ flexShrink: 0 }}>
                                    <div style={{ width: '90px', height: '90px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img
                                            src={getChildPhotoOrDefault(childData?.photo)}
                                            alt={childData?.name || ''}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => { e.target.src = getChildPhotoOrDefault(null); }}
                                        />
                                    </div>
                                </div>

                                <div className="child-details-grid" style={{ flexGrow: 1, marginTop: 0 }}>
                                    <div className="form-group compact">
                                        <label>{t('login.labelName')}</label>
                                        <input type="text" readOnly disabled value={childData?.name || ''} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} />
                                    </div>
                                    <div className="form-group compact">
                                        <label>{t('login.labelGender')}</label>
                                        <input type="text" readOnly disabled value={childData?.gender ? childData.gender.charAt(0).toUpperCase() + childData.gender.slice(1) : ''} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} />
                                    </div>
                                    <div className="form-group compact">
                                        <label>{t('login.labelDob')}</label>
                                        <input type="text" readOnly disabled value={childData?.dob ? new Date(childData.dob).toLocaleDateString('en-GB') : ''} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} />
                                    </div>
                                    <div className="form-group compact">
                                        <label>{t('login.labelMobile')}</label>
                                        <input type="text" readOnly disabled value={childData?.mobile || ''} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="login-actions">
                            <button
                                type="button"
                                className="btn form-btn-primary"
                                disabled={!childData}
                                onClick={handleGoToAssessment}
                                style={{ padding: '10px 20px' }}
                            >
                                {t('login.goToAssessment')}
                            </button>
                            <a href="/" className="form-link">{t('common.backToHub')}</a>
                        </div>

                        <p className="form-note" style={{ marginTop: '16px' }}>
                            {t('common.consentNote')}
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Login;
