import { API_URL } from '../services/api';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';
import { getChildPhotoOrDefault } from '../services/photoUtils';
import { getLanguageIcon } from '../utils/languageIcons';
import { isAssessorSession, getAssessorInfo, assessorLogout } from '../utils/assessorSession';
import { isIndividualSession, getIndividualInfo, individualLogout } from '../utils/individualSession';

const Navbar = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const { t, changeLanguage, language, availableLanguages } = useLanguage();
    const [showLangModal, setShowLangModal] = useState(false);
    const [isLoggingOutAssessor, setIsLoggingOutAssessor] = useState(false);
    const [isLoggingOutIndividual, setIsLoggingOutIndividual] = useState(false);

    useEffect(() => {
        const userStr = localStorage.getItem('currentChild');
        if (userStr) {
            setCurrentUser(JSON.parse(userStr));
        }
    }, []);

    const endChildSession = async () => {
        try {
            const sessionId = localStorage.getItem('sessionId');
            if (sessionId) {
                await axios.post(`${API_URL}/sessions/end/${sessionId}`);
            }
        } catch (e) {
            console.error("Logout session error:", e);
        } finally {
            localStorage.removeItem('currentChild');
            localStorage.removeItem('sessionId');
            setCurrentUser(null);
        }
    };

    const handleLogout = async () => {
        await endChildSession();
        window.location.href = '/';
    };

    // An Assessor's own identity — shown alongside the currently-selected
    // child (if any) once the assessor has logged in at /login. Unlike
    // before, the child no longer replaces the assessor's own header
    // identity — the assessor stays visible for the whole session, and the
    // Child ID/Name is appended once a child is selected (see
    // AssessorSearchChild.jsx) and updates whenever a different child is
    // selected next.
    const assessorInfo = isAssessorSession() ? getAssessorInfo() : null;

    const handleAssessorLogout = async () => {
        setIsLoggingOutAssessor(true);
        // A selected child is only reachable through this assessor's
        // session — end it too so "logout ends protected access" holds for
        // both, not just the assessor's own pages.
        if (currentUser) await endChildSession();
        await assessorLogout();
        window.location.href = '/login';
    };

    // An Individual plays as their own linked child (see
    // individualAuthController.js) — currentUser will therefore always be
    // set for one too, but their own identity/name takes priority in the
    // header (below) rather than showing the generic child card, and their
    // logout must end both sessions for the same reason as the assessor's.
    const individualInfo = isIndividualSession() ? getIndividualInfo() : null;

    const handleIndividualLogout = async () => {
        setIsLoggingOutIndividual(true);
        if (currentUser) await endChildSession();
        await individualLogout();
        window.location.href = '/login';
    };

    return (
        <>
            <header className="top-nav">
                <div className="nav-left">
                    <a href="/" className="nav-left-link" style={{ textDecoration: 'none' }}>
                        <img src="/cel_admin_logo.png" alt="CEL Logo" style={{ height: '48px', objectFit: 'contain' }} />
                    </a>
                </div>

                <div className="nav-right">
                    <button onClick={() => setShowLangModal(true)} className="btn nav-btn-outline" style={{ border: 'none', background: '#f3f4f6', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{getLanguageIcon(language)}</span> {t('navbar.language')}
                    </button>
                    {assessorInfo ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '13px', color: '#374151' }}>
                                Assessor: <strong style={{ color: '#111827' }}>{assessorInfo.name || assessorInfo.email}</strong>
                            </span>
                            {currentUser && (
                                <span style={{ fontSize: '13px', color: '#374151', paddingLeft: '10px', borderLeft: '1px solid #e5e7eb' }}>
                                    Child ID: <strong style={{ color: '#111827' }}>{currentUser.child_id}</strong>{' '}
                                    | Child Name: <strong style={{ color: '#111827' }}>{currentUser.name}</strong>
                                </span>
                            )}
                            <a href="/assessor/dashboard" className="btn nav-btn-outline">👤 Account</a>
                            <button onClick={handleAssessorLogout} disabled={isLoggingOutAssessor} className="btn nav-btn-outline" style={{ color: '#ef4444', borderColor: '#fee2e2' }}>
                                {isLoggingOutAssessor ? 'Logging out…' : t('common.logout')}
                            </button>
                        </div>
                    ) : individualInfo ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '13px', color: '#374151' }}>
                                <strong style={{ color: '#111827' }}>{individualInfo.full_name || individualInfo.email}</strong>
                            </span>
                            <a href="/individual/reports" className="btn nav-btn-outline">👤 My Account</a>
                            <button onClick={handleIndividualLogout} disabled={isLoggingOutIndividual} className="btn nav-btn-outline" style={{ color: '#ef4444', borderColor: '#fee2e2' }}>
                                {isLoggingOutIndividual ? 'Logging out…' : t('common.logout')}
                            </button>
                        </div>
                    ) : currentUser ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img
                                src={getChildPhotoOrDefault(currentUser.photo)}
                                alt={currentUser.name}
                                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1', flexShrink: 0 }}
                                onError={(e) => { e.target.src = getChildPhotoOrDefault(null); }}
                            />
                            <div style={{ textAlign: 'right', lineHeight: '1.2' }}>
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111827', display: 'block' }}>{currentUser.name}</span>
                                <span style={{ fontSize: '11px', color: '#6b7280' }}>{t('navbar.id')}: {currentUser.child_id}</span>
                            </div>
                            <button onClick={handleLogout} className="btn nav-btn-outline" style={{ color: '#ef4444', borderColor: '#fee2e2' }}>{t('common.logout')}</button>
                        </div>
                    ) : (
                        <>
                            <a href="/login" className="btn nav-btn-outline">{t('common.login')}</a>
                            <a href="/signup/registration" className="btn nav-btn-primary">{t('common.register')}</a>
                        </>
                    )}
                </div>
            </header>

            {/* Language Selection Modal */}
            {showLangModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px', fontWeight: 800, color: '#111827' }}>{t('common.selectLanguage')}</h2>
                            <h3 style={{ fontSize: '1.05rem', color: '#6b7280', fontWeight: 500 }}>अपनी पसंदीदा भाषा चुनें</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', overflowY: 'auto', padding: '10px 4px', flex: 1 }}>
                            {availableLanguages.map((lang) => {
                                const isActive = language === lang.shortCode;
                                return (
                                    <button
                                        key={lang.shortCode}
                                        onClick={() => { changeLanguage(lang.shortCode); setShowLangModal(false); }}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '12px',
                                            padding: '12px 16px', 
                                            background: isActive ? '#eff6ff' : '#fff', 
                                            color: isActive ? '#1d4ed8' : '#374151', 
                                            border: `1.5px solid ${isActive ? '#3b82f6' : '#e5e7eb'}`, 
                                            borderRadius: '12px', 
                                            cursor: 'pointer', 
                                            fontWeight: isActive ? 700 : 500,
                                            boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
                                            transition: 'all 0.2s ease',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <span style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: isActive ? '#3b82f6' : '#f1f5f9',
                                            color: isActive ? '#fff' : '#64748b',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            flexShrink: 0
                                        }}>
                                            {getLanguageIcon(lang.shortCode)}
                                        </span>
                                        <span style={{ fontSize: '1rem' }}>{lang.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                            <button 
                                onClick={() => setShowLangModal(false)} 
                                style={{ padding: '10px 24px', color: '#4b5563', background: '#f3f4f6', border: 'none', borderRadius: '999px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
