import { API_URL } from '../services/api';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';
import { getChildPhotoOrDefault } from '../services/photoUtils';

const Navbar = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const { t, changeLanguage, language } = useLanguage();
    const [showLangModal, setShowLangModal] = useState(false);

    useEffect(() => {
        const userStr = localStorage.getItem('currentChild');
        if (userStr) {
            setCurrentUser(JSON.parse(userStr));
        }
    }, []);

    const handleLogout = async () => {
        try {
            const sessionId = localStorage.getItem('sessionId');
            if (sessionId) {
                // Silently execute session dump
                await axios.post(`${API_URL}/sessions/end/${sessionId}`);
            }
        } catch (e) {
            console.error("Logout session error:", e);
        } finally {
            localStorage.removeItem('currentChild');
            localStorage.removeItem('sessionId');
            setCurrentUser(null);
            window.location.href = '/';
        }
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
                    <button onClick={() => setShowLangModal(true)} className="btn nav-btn-outline" style={{ border: 'none', background: '#f3f4f6', color: '#374151' }}>
                        {t('navbar.language')}
                    </button>
                    {currentUser ? (
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
                            <a href="/register" className="btn nav-btn-primary">{t('common.register')}</a>
                        </>
                    )}
                </div>
            </header>

            {/* Language Selection Modal */}
            {showLangModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{t('common.selectLanguage')}</h2>
                        <h3 style={{ fontSize: '1.1rem', color: '#6b7280', marginBottom: '24px' }}>अपनी पसंदीदा भाषा चुनें</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button 
                                onClick={() => { changeLanguage('en'); setShowLangModal(false); }} 
                                style={{ padding: '12px', fontSize: '1.1rem', background: language === 'en' ? '#2563eb' : '#f3f4f6', color: language === 'en' ? 'white' : '#1f2937', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: language === 'en' ? 'bold' : 'normal' }}
                            >
                                English
                            </button>
                            <button 
                                onClick={() => { changeLanguage('hi'); setShowLangModal(false); }} 
                                style={{ padding: '12px', fontSize: '1.1rem', background: language === 'hi' ? '#2563eb' : '#f3f4f6', color: language === 'hi' ? 'white' : '#1f2937', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: language === 'hi' ? 'bold' : 'normal' }}
                            >
                                हिंदी
                            </button>
                        </div>
                        
                        <button onClick={() => setShowLangModal(false)} style={{ marginTop: '24px', padding: '8px 16px', color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
