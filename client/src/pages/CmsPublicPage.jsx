import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './CmsPage.css';

// Pages that have Hindi variants stored as `${pageKey}_hi`
const BILINGUAL_PAGES = ['terms', 'privacy'];

const CmsPublicPage = ({ pageKey, breadcrumbLabel }) => {
    const { language, changeLanguage } = useLanguage();
    const isBilingual = BILINGUAL_PAGES.includes(pageKey);

    // Local display language — starts from global context, can be overridden per-page
    const [displayLang, setDisplayLang] = useState(language || 'en');
    const [page,    setPage]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(false);

    // Sync if global language changes
    useEffect(() => { setDisplayLang(language || 'en'); }, [language]);

    const fetchKey = isBilingual && displayLang === 'hi' ? `${pageKey}_hi` : pageKey;

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
                        // Fallback to English
                        return axios.get(`${API_URL}/public/cms/${pageKey}`)
                            .then(({ data }) => { if (!cancelled) setPage(data.page); })
                            .catch(() => { if (!cancelled) setError(true); });
                    }
                    setError(true);
                });

        load(fetchKey).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [fetchKey, pageKey]);

    const handleLangSwitch = (lang) => {
        setDisplayLang(lang);
        changeLanguage(lang);
    };

    // Apply SEO meta tags when page data arrives
    useEffect(() => {
        if (!page) return;

        const pageTitle = page.meta_title || `${page.title} | Community Empowerment Lab`;
        document.title = pageTitle;

        // meta description
        let descTag = document.querySelector('meta[name="description"]');
        if (!descTag) {
            descTag = document.createElement('meta');
            descTag.setAttribute('name', 'description');
            document.head.appendChild(descTag);
        }
        descTag.setAttribute('content', page.meta_description || '');

        // meta keywords
        let kwTag = document.querySelector('meta[name="keywords"]');
        if (!kwTag) {
            kwTag = document.createElement('meta');
            kwTag.setAttribute('name', 'keywords');
            document.head.appendChild(kwTag);
        }
        kwTag.setAttribute('content', page.meta_keywords || '');

        // Clean up on unmount
        return () => {
            document.title = 'Community Empowerment Lab';
            if (descTag) descTag.setAttribute('content', '');
            if (kwTag)   kwTag.setAttribute('content', '');
        };
    }, [page]);

    if (loading) return (
        <div className="cms-shell">
            <div className="cms-spinner-wrap"><div className="cms-spinner" /></div>
        </div>
    );

    if (error || !page) return (
        <div className="cms-shell">
            <div className="cms-error">
                <span>⚠️</span>
                <p>This page could not be loaded. Please try again later.</p>
            </div>
        </div>
    );

    return (
        <div className="cms-shell">
            <nav className="cms-hero-strip">
                <Link to="/">Home</Link>
                <span>›</span>
                <span>{breadcrumbLabel}</span>

                {isBilingual && (
                    <div className="cms-lang-toggle">
                        <button
                            className={`cms-lang-btn ${displayLang === 'en' ? 'active' : ''}`}
                            onClick={() => handleLangSwitch('en')}
                        >
                            🇬🇧 EN
                        </button>
                        <button
                            className={`cms-lang-btn ${displayLang === 'hi' ? 'active' : ''}`}
                            onClick={() => handleLangSwitch('hi')}
                        >
                            🇮🇳 HI
                        </button>
                    </div>
                )}
            </nav>
            <article className="cms-card">
                <h1 className="cms-page-title">{page.title}</h1>
                <hr className="cms-divider" />
                <div
                    className="cms-body"
                    dangerouslySetInnerHTML={{ __html: page.content }}
                />
            </article>
        </div>
    );
};

export default CmsPublicPage;
