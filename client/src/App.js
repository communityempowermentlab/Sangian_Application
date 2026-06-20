import React, { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useSEO } from './seo/useSEO';
import { SEO_DEFAULTS, ROUTE_SEO, SITE_URL } from './seo/seoConfig';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminChildrenList from './pages/AdminChildrenList';
import AdminChildAdd from './pages/AdminChildAdd';
import AdminChildEdit from './pages/AdminChildEdit';
import NumberSkillGame from './pages/NumberSkillGame';
import ReadingSkillGame from './pages/ReadingSkillGame';
import NumberRecallGame from './pages/NumberRecallGame';
import HerPherGame from './pages/HerPherGame';
import AuditoryAttentionGame from './pages/AuditoryAttentionGame';
import TriangleRachnaGame from './pages/TriangleRachnaGame';
import AtlantisBagiyaGame from './pages/AtlantisBagiyaGame';
import AdminReports from './pages/AdminReports';
import AdminDocs from './pages/AdminDocs';
import AdminSettings from './pages/AdminSettings';
import AdminMultilingual from './pages/AdminMultilingual';
import ChaloMelaChaleGame from './pages/ChaloMelaChaleGame';
import ChorMachayeShorGame from './pages/ChorMachayeShorGame';
import AdminAssessorsList from './pages/AdminAssessorsList';
import AdminAssessorAdd from './pages/AdminAssessorAdd';
import AdminAssessorEdit from './pages/AdminAssessorEdit';
import AdminScreenshots from './pages/AdminScreenshots';
import AdminAnalysis from './pages/AdminAnalysis';
import AdminMeta from './pages/AdminMeta';
import AdminHelpSupport from './pages/AdminHelpSupport';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ContactPage from './pages/ContactPage';
import HelpPage from './pages/HelpPage';
import RequireAdminAuth from './guards/RequireAdminAuth';
import RequireChildAuth from './guards/RequireChildAuth';
import RequireGameEnabled from './guards/RequireGameEnabled';

import { LanguageProvider } from './contexts/LanguageContext';
import { HeaderConfigProvider } from './contexts/HeaderConfigContext';
import { GoogleAnalyticsProvider } from './contexts/GoogleAnalyticsContext';
import { CrashAnalyticsProvider }  from './contexts/CrashAnalyticsContext';
import './index.css';

// ── Admin route title map (these are noindex — title only, no OG needed) ───────
const ADMIN_TITLES = {
    '/admin/dashboard':      'Dashboard | Admin Panel',
    '/admin/children':       'Children | Admin Panel',
    '/admin/children/add':   'Add Child | Admin Panel',
    '/admin/assessors':      'Assessors | Admin Panel',
    '/admin/assessors/add':  'Add Assessor | Admin Panel',
    '/admin/reports':        'Reports | Admin Panel',
    '/admin/docs':           'Documentation | Admin Panel',
    '/admin/analysis':       'Analysis | Admin Panel',
    '/admin/settings':       'Settings | Admin Panel',
    '/admin/multilingual':   'Multilingual | Admin Panel',
    '/admin/meta':           'Meta | Admin Panel',
    '/admin/help-support':   'Help & Support | Admin Panel',
};

// ── SEOManager — runs on every route change, applies full SEO config ──────────
const SEOManager = () => {
    const { pathname } = useLocation();

    const seo = useMemo(() => {
        const siteOrigin = SITE_URL || window.location.origin;
        const canonical  = `${siteOrigin}${pathname}`;

        // 1. Start from global defaults
        const base = { ...SEO_DEFAULTS };

        // 2. Admin routes: title only + strict noindex
        if (pathname.startsWith('/admin/') && pathname !== '/admin/login') {
            const adminTitle = ADMIN_TITLES[pathname]
                ?? (pathname.startsWith('/admin/children/edit/')
                    ? 'Edit Child | Admin Panel'
                    : 'Admin Panel');
            return {
                title:     adminTitle,
                robots:    'noindex,nofollow',
                canonical,
                og:        { ...base.og, title: adminTitle, url: canonical },
                twitter:   { ...base.twitter, title: adminTitle },
                jsonLd:    null,
            };
        }

        // 3. Game routes: title + noindex,follow
        if (pathname.startsWith('/games/')) {
            const routeOverride = ROUTE_SEO[pathname] ?? {};
            const title = routeOverride.title ?? base.title;
            return {
                title,
                robots:    'noindex,follow',
                canonical,
                og:        { ...base.og, ...(routeOverride.og ?? {}), title, url: canonical },
                twitter:   { ...base.twitter, ...(routeOverride.twitter ?? {}), title },
                jsonLd:    null,
            };
        }

        // 4. Public routes: full SEO merge
        const routeOverride = ROUTE_SEO[pathname] ?? {};
        return {
            ...base,
            ...routeOverride,
            canonical,
            og: {
                ...base.og,
                ...(routeOverride.og ?? {}),
                url: canonical,
            },
            twitter: {
                ...base.twitter,
                ...(routeOverride.twitter ?? {}),
            },
            jsonLd: 'jsonLd' in routeOverride ? routeOverride.jsonLd : base.jsonLd,
        };
    }, [pathname]);

    useSEO(seo);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

// Standard public layout with Navbar + Footer
const PublicLayout = () => (
    <>
        <Navbar />
        <Outlet />
        <Footer />
    </>
);

function App() {
    return (
        <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
        <GoogleAnalyticsProvider>
        <CrashAnalyticsProvider>
        <LanguageProvider>
        <HeaderConfigProvider>
            <Router>
                <SEOManager />
                <div className="App">
                    <Routes>

                        {/* ── Public Child Routes ─────────────────────── */}
                        <Route element={<PublicLayout />}>
                            <Route path="/" element={<Home />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/terms-conditions" element={<TermsPage />} />
                            <Route path="/privacy-policy" element={<PrivacyPage />} />
                            <Route path="/contact-us" element={<ContactPage />} />
                            <Route path="/help" element={<HelpPage />} />
                        </Route>

                        {/* ── Protected Game Routes (child must be logged in, test must be enabled) ── */}
                        <Route element={<RequireChildAuth />}>
                            <Route element={<RequireGameEnabled />}>
                                <Route path="/games/number_skill"      element={<NumberSkillGame />} />
                                <Route path="/games/reading_skill"     element={<ReadingSkillGame />} />
                                <Route path="/games/number_recall"     element={<NumberRecallGame />} />
                                <Route path="/games/her_pher"          element={<HerPherGame />} />
                                <Route path="/games/dhyan_kahan_hai"   element={<AuditoryAttentionGame />} />
                                <Route path="/games/rachna"            element={<TriangleRachnaGame />} />
                                <Route path="/games/bagiya"            element={<AtlantisBagiyaGame />} />
                                <Route path="/games/chalo_mela_chale"  element={<ChaloMelaChaleGame />} />
                                <Route path="/games/chor_machaye_shor" element={<ChorMachayeShorGame />} />
                            </Route>
                        </Route>

                        {/* ── Admin Login (public) ────────────────────── */}
                        <Route path="/admin/login" element={<AdminLogin />} />

                        {/* ── Protected Admin Routes (valid JWT required) ─ */}
                        <Route element={<RequireAdminAuth />}>
                            <Route path="/admin" element={<AdminLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />
                                <Route path="dashboard"              element={<AdminDashboard />} />
                                <Route path="children"               element={<AdminChildrenList />} />
                                <Route path="children/add"           element={<AdminChildAdd />} />
                                <Route path="children/edit/:id"      element={<AdminChildEdit />} />
                                <Route path="assessors"              element={<AdminAssessorsList />} />
                                <Route path="assessors/add"          element={<AdminAssessorAdd />} />
                                <Route path="assessors/edit/:id"     element={<AdminAssessorEdit />} />
                                <Route path="analysis"               element={<AdminAnalysis />} />
                                <Route path="reports"                element={<AdminReports />} />
                                <Route path="docs"                   element={<AdminDocs />} />
                                <Route path="screenshots"            element={<AdminScreenshots />} />
                                <Route path="meta"                   element={<AdminMeta />} />
                                <Route path="help-support"           element={<AdminHelpSupport />} />
                                <Route path="settings"               element={<AdminSettings />} />
                                <Route path="multilingual"           element={<AdminMultilingual />} />
                            </Route>
                        </Route>

                        {/* ── Catch-all: redirect unknown paths to home ─── */}
                        <Route path="*" element={<Navigate to="/" replace />} />

                    </Routes>
                </div>
            </Router>
        </HeaderConfigProvider>
        </LanguageProvider>
        </CrashAnalyticsProvider>
        </GoogleAnalyticsProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
