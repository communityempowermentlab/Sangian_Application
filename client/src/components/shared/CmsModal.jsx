import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

// Shows an existing CMS page (Terms & Conditions, Privacy Policy, ...) in a
// modal instead of navigating away — reuses the exact same
// GET /public/cms/:pageKey endpoint and bilingual-variant/fallback logic
// CmsPublicPage.jsx already uses for the full standalone pages, so the
// content shown here can never drift from what's on those pages. No new
// content, no new backend route.
const BILINGUAL_PAGES = ['terms', 'privacy'];

const CmsModal = ({ pageKey, label, onClose }) => {
    const { language } = useLanguage();
    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const isBilingual = BILINGUAL_PAGES.includes(pageKey);
    const fetchKey = isBilingual && language !== 'en' ? `${pageKey}_${language}` : pageKey;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);

        const load = (key) =>
            axios.get(`${API_URL}/public/cms/${key}`)
                .then(({ data }) => { if (!cancelled) setPage(data.page); })
                .catch(() => {
                    if (cancelled) return;
                    if (key !== pageKey) {
                        return axios.get(`${API_URL}/public/cms/${pageKey}`)
                            .then(({ data }) => { if (!cancelled) setPage(data.page); })
                            .catch(() => { if (!cancelled) setError(true); });
                    }
                    setError(true);
                });

        load(fetchKey).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [fetchKey, pageKey]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2000,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={page?.title || label}
                style={{
                    background: '#fff', borderRadius: '14px', maxWidth: '640px', width: '100%',
                    maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{page?.title || label}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        style={{ background: 'none', border: 'none', fontSize: '24px', lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: '4px' }}
                    >
                        &times;
                    </button>
                </div>
                <div style={{ padding: '20px 22px', overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}>
                    {loading ? (
                        <p style={{ color: '#6b7280', margin: 0 }}>Loading…</p>
                    ) : error || !page ? (
                        <p style={{ color: '#dc2626', margin: 0 }}>Failed to load this page. Please try again.</p>
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: page.content }} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default CmsModal;
