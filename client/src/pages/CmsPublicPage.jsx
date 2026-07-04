import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../seo/useSEO';
import { SITE_URL } from '../seo/seoConfig';
import './CmsPage.css';

// Pages that have per-language variants stored as `${pageKey}_${langCode}`
const BILINGUAL_PAGES = ['terms', 'privacy'];

const CmsPublicPage = ({ pageKey, breadcrumbLabel }) => {
    const { language, t } = useLanguage();
    const { pathname }    = useLocation();
    const isBilingual     = BILINGUAL_PAGES.includes(pageKey);

    const [page,    setPage]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(false);

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

    // Build the full SEO config from CMS API data.
    // useSEO fires whenever `page` changes and overrides the route-level defaults
    // that SEOManager already set for this path.
    const siteOrigin = SITE_URL || window.location.origin;
    const canonical  = `${siteOrigin}${pathname}`;
    const ogImage    = `${siteOrigin}/cel_admin_logo.png`;

    const cmsTitle       = page ? (page.meta_title || `${page.title} | Community Empowerment Lab`) : null;
    const cmsDescription = page?.meta_description || '';
    const cmsKeywords    = page?.meta_keywords    || '';

    const cmsBreadcrumbJsonLd = page ? {
        '@context': 'https://schema.org',
        '@type':    'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home',              item: siteOrigin },
            { '@type': 'ListItem', position: 2, name: page.title || breadcrumbLabel, item: canonical },
        ],
    } : null;

    useSEO(page ? {
        title:       cmsTitle,
        description: cmsDescription,
        keywords:    cmsKeywords,
        robots:      'index,follow',
        canonical,
        og: {
            type:        'article',
            title:       cmsTitle,
            description: cmsDescription,
            image:       ogImage,
            url:         canonical,
            siteName:    'Community Empowerment Lab',
        },
        twitter: {
            card:        'summary_large_image',
            title:       cmsTitle,
            description: cmsDescription,
            image:       ogImage,
        },
        jsonLd: cmsBreadcrumbJsonLd,
    } : null);

    if (loading) return (
        <div className="cms-shell">
            <div className="cms-spinner-wrap"><div className="cms-spinner" /></div>
        </div>
    );

    if (error || !page) return (
        <div className="cms-shell">
            <div className="cms-error">
                <span>⚠️</span>
                <p>{t('common.pageLoadError')}</p>
            </div>
        </div>
    );

    return (
        <div className="cms-shell">
            <nav className="cms-hero-strip">
                <Link to="/">{t('breadcrumb.home')}</Link>
                <span>›</span>
                <span>{t(`breadcrumb.${pageKey}`) || breadcrumbLabel}</span>
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
