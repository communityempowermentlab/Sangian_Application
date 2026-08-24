import React, { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, useParams, Navigate } from 'react-router-dom';
import { useSEO } from './seo/useSEO';
import { SEO_DEFAULTS, ROUTE_SEO, SITE_URL } from './seo/seoConfig';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Register from './pages/Register';
import UnifiedLogin from './pages/UnifiedLogin';
import AssessorSearchChild from './pages/AssessorSearchChild';
import AssessorDashboard from './pages/AssessorDashboard';
import AssessorAccount from './pages/AssessorAccount';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminChildrenList from './pages/AdminChildrenList';
import AdminChildAdd from './pages/AdminChildAdd';
import AdminChildEdit from './pages/AdminChildEdit';
import AdminChildScoreboard from './pages/AdminChildScoreboard';
import NumberSkillGame from './pages/NumberSkillGame';
import NumberSkillGameV2 from './pages/NumberSkillGameV2';
import NumberSkillGameV3 from './pages/NumberSkillGameV3';
import ReadingSkillGame from './pages/ReadingSkillGame';
import ReadingSkillGameV2 from './pages/ReadingSkillGameV2';
import NumberRecallGame from './pages/NumberRecallGame';
import NumberRecallGameV2 from './pages/NumberRecallGameV2';
import HerPherGame from './pages/HerPherGame';
import HerPherGameV2 from './pages/HerPherGameV2';
import HerPherGameV3 from './pages/HerPherGameV3';
import AuditoryAttentionGame from './pages/AuditoryAttentionGame';
import TriangleRachnaGame from './pages/TriangleRachnaGame';
import AtlantisBagiyaGame from './pages/AtlantisBagiyaGame';
import AdminReports from './pages/AdminReports';
import AdminDocs from './pages/AdminDocs';
import AdminSettings from './pages/AdminSettings';
import AdminOrgSettings from './pages/AdminOrgSettings';
import { isOrgSession } from './utils/staffPermissions';
import AdminElements from './pages/AdminElements';
import AdminMultilingual from './pages/AdminMultilingual';
import ChaloMelaChaleGame from './pages/ChaloMelaChaleGame';
import ChorMachayeShorGame from './pages/ChorMachayeShorGame';
import AdminAssessorsList from './pages/AdminAssessorsList';
import AdminAssessorAdd from './pages/AdminAssessorAdd';
import AdminAssessorDetail from './pages/AdminAssessorDetail';
import AdminChildGroupsList from './pages/AdminChildGroupsList';
import AdminChildGroupAdd from './pages/AdminChildGroupAdd';
import AdminChildGroupEdit from './pages/AdminChildGroupEdit';
import AdminScreenshots from './pages/AdminScreenshots';
import AdminAnalysis from './pages/AdminAnalysis';
import AdminMeta from './pages/AdminMeta';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ContactPage from './pages/ContactPage';
import HelpPage from './pages/HelpPage';
import RequireAdminAuth from './guards/RequireAdminAuth';
import RequireChildAuth from './guards/RequireChildAuth';
import RequireAssessorAuth from './guards/RequireAssessorAuth';
import RequireIndividualAuth from './guards/RequireIndividualAuth';
import RequireGameEnabled from './guards/RequireGameEnabled';
import RequireStaffPermission from './guards/RequireStaffPermission';
import RequireAdminOnly from './guards/RequireAdminOnly';
import AdminStaffList from './pages/AdminStaffList';
import AdminStaffAdd from './pages/AdminStaffAdd';
import AdminStaffEdit from './pages/AdminStaffEdit';
import AdminStaffProfile from './pages/AdminStaffProfile';
import AdminStaffActivityLog from './pages/AdminStaffActivityLog';
import AdminStaffAttendance from './pages/AdminStaffAttendance';
import AdminOrganizationsList from './pages/AdminOrganizationsList';
import AdminIndividualsList from './pages/AdminIndividualsList';
import AdminIndividualDetail from './pages/AdminIndividualDetail';
import AdminOrganizationDetail from './pages/AdminOrganizationDetail';
import UnifiedRegister from './pages/auth/UnifiedRegister';
import IndividualReports from './pages/IndividualReports';
import IndividualAccount from './pages/IndividualAccount';

import { LanguageProvider } from './contexts/LanguageContext';
import { HeaderConfigProvider } from './contexts/HeaderConfigContext';
import { ResponseMatchingProvider } from './contexts/ResponseMatchingContext';
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
    '/admin/child-groups':      'Child Groups | Admin Panel',
    '/admin/child-groups/add':  'Add Child Group | Admin Panel',
    '/admin/reports':        'Reports | Admin Panel',
    '/admin/docs':           'Documentation | Admin Panel',
    '/admin/analysis':       'Analysis | Admin Panel',
    '/admin/settings':       'Settings | Admin Panel',
    '/admin/multilingual':   'Multilingual | Admin Panel',
    '/admin/meta':           'Meta | Admin Panel',
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
                    : pathname.startsWith('/admin/meta/')
                        ? 'Meta | Admin Panel'
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

// Org Settings must stay strictly separate from the Super-Admin-only
// global AdminSettings.jsx (SMTP, tickets, contact info, etc.) — an
// organization session always gets its own scoped page here regardless of
// what's granted, never the global one (RequireStaffPermission's
// moduleKey="settings" on this route already keeps a session with no
// 'settings' grant out entirely; this only decides WHICH settings page a
// session that does have it lands on).
const SettingsRoute = () => (isOrgSession() ? <AdminOrgSettings /> : <AdminSettings />);

// Bare /admin/organizations/:id has no tab of its own — each tab
// (Profile/Permissions/Login History/Activity Log/Edit History) gets its
// own URL now (see AdminOrganizationDetail.jsx), so this just redirects to
// the default one.
const OrgDetailRedirect = () => {
    const { id } = useParams();
    return <Navigate to={`/admin/organizations/${id}/profile`} replace />;
};

// Bare /admin/assessors/:id has no tab of its own — each tab
// (Profile/Password/Login History/Activity Log/Edit History) gets its own
// URL now (see AdminAssessorDetail.jsx), so this just redirects to the
// default one.
const AssessorDetailRedirect = () => {
    const { id } = useParams();
    return <Navigate to={`/admin/assessors/${id}/profile`} replace />;
};

// Bare /admin/individuals/:id has no tab of its own — each tab
// (Profile/Password/Login History/Edit History) gets its own URL now (see
// AdminIndividualDetail.jsx), so this just redirects to the default one.
const IndividualDetailRedirect = () => {
    const { id } = useParams();
    return <Navigate to={`/admin/individuals/${id}/profile`} replace />;
};

// /individual/login pre-dates the unified /login page (see
// UnifiedLogin.jsx, which now handles Individual/Assessor/Organization all
// behind one role toggle) — kept as a redirect so any existing bookmarks
// or external links still land somewhere valid.
const IndividualLoginRedirect = () => <Navigate to="/login" replace />;

// Terms & Conditions, Privacy Policy, Help & Support, and Organization
// Types moved from the standalone Meta page into Settings (AdminSettings.jsx
// tabs terms/privacy/help_support/org_types) — these keep any bookmarked
// /admin/meta/* URLs working. Deliberately NOT nested under this route
// table's moduleKey="meta" RequireStaffPermission group (see below): a
// staff account granted "settings" but not "meta" should still land on the
// content via /admin/settings' own moduleKey="settings" check, rather than
// being blocked here before ever reaching it.
const META_TO_SETTINGS_TAB = { terms: 'terms', privacy: 'privacy', help: 'help_support', 'org-types': 'org_types' };
const MetaSettingsRedirect = ({ tabKey }) => <Navigate to={`/admin/settings?tab=${META_TO_SETTINGS_TAB[tabKey]}`} replace />;

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
        <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || 'dummy-client-id'}>
        <GoogleAnalyticsProvider>
        <CrashAnalyticsProvider>
        <LanguageProvider>
        <HeaderConfigProvider>
        <ResponseMatchingProvider>
            <Router>
                <SEOManager />
                <div className="App">
                    <Routes>

                        {/* ── Public Child Routes ─────────────────────── */}
                        <Route element={<PublicLayout />}>
                            <Route path="/" element={<Home />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/login" element={<UnifiedLogin />} />
                            <Route path="/signup" element={<UnifiedRegister />} />
                            <Route path="/signup/registration" element={<UnifiedRegister />} />
                            <Route path="/signup/organization" element={<UnifiedRegister />} />
                            <Route path="/individual/login" element={<IndividualLoginRedirect />} />
                            <Route path="/terms-conditions" element={<TermsPage />} />
                            <Route path="/privacy-policy" element={<PrivacyPage />} />
                            <Route path="/contact-us" element={<ContactPage />} />
                            <Route path="/help" element={<HelpPage />} />
                        </Route>

                        {/* ── Protected Assessor Routes (assessor must be logged in) ── */}
                        <Route element={<PublicLayout />}>
                            <Route element={<RequireAssessorAuth />}>
                                <Route path="/assessor/dashboard"     element={<AssessorDashboard />} />
                                <Route path="/assessor/search-child"  element={<AssessorSearchChild />} />
                                <Route path="/assessor/account"       element={<AssessorAccount />} />
                            </Route>
                        </Route>

                        {/* ── Protected Individual Routes (individual must be logged in) ── */}
                        <Route element={<PublicLayout />}>
                            <Route element={<RequireIndividualAuth />}>
                                <Route path="/individual/reports" element={<IndividualReports />} />
                                <Route path="/individual/account" element={<IndividualAccount />} />
                            </Route>
                        </Route>

                        {/* ── Protected Game Routes (child must be logged in, test must be enabled) ── */}
                        <Route element={<RequireChildAuth />}>
                            <Route element={<RequireGameEnabled />}>
                                <Route path="/games/number_skill"      element={<NumberSkillGame />} />
                                <Route path="/games/number_skill_v2"   element={<NumberSkillGameV2 />} />
                                <Route path="/games/number_skill_v3"   element={<NumberSkillGameV3 />} />
                                <Route path="/games/reading_skill"     element={<ReadingSkillGame />} />
                                <Route path="/games/reading_skill_v2"  element={<ReadingSkillGameV2 />} />
                                <Route path="/games/number_recall"     element={<NumberRecallGame />} />
                                <Route path="/games/number_recall_v2"  element={<NumberRecallGameV2 />} />
                                <Route path="/games/her_pher"          element={<HerPherGame />} />
                                <Route path="/games/her_pher_v2"       element={<HerPherGameV2 />} />
                                <Route path="/games/her_pher_v3"       element={<HerPherGameV3 />} />
                                <Route path="/games/dhyan_kahan_hai"   element={<AuditoryAttentionGame />} />
                                <Route path="/games/rachna"            element={<TriangleRachnaGame />} />
                                <Route path="/games/bagiya"            element={<AtlantisBagiyaGame />} />
                                <Route path="/games/chalo_mela_chale"  element={<ChaloMelaChaleGame />} />
                                <Route path="/games/chor_machaye_shor" element={<ChorMachayeShorGame />} />
                            </Route>
                        </Route>

                        {/* ── Admin Login (public) ────────────────────── */}
                        {/* Organizations authenticate here too now — no separate
                            /org/login portal (see adminController.js's unified
                            loginAdmin, which tries admins, then staff, then
                            organizations). */}
                        <Route path="/admin/login" element={<AdminLogin />} />

                        {/* ── Protected Admin Routes (valid JWT required) ─ */}
                        <Route element={<RequireAdminAuth />}>
                            <Route path="/admin" element={<AdminLayout />}>
                                <Route index element={<Navigate to="dashboard" replace />} />

                                {/* screenshots has no nav link (pre-existing — reachable only
                                    by direct URL) and profile is self-service; neither needs
                                    a module-permission gate. Everything else below is wrapped
                                    per-menu so a staff account without that grant sees a clean
                                    "Access Restricted" message instead of a broken page full
                                    of failed API calls (the real enforcement is server-side
                                    either way — this is UX polish, see RequireStaffPermission). */}
                                <Route path="screenshots"            element={<AdminScreenshots />} />
                                <Route path="staff/profile"          element={<AdminStaffProfile />} />

                                <Route element={<RequireStaffPermission moduleKey="dashboard" />}>
                                    <Route path="dashboard"              element={<AdminDashboard />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="children" />}>
                                    <Route path="children"               element={<AdminChildrenList />} />
                                    <Route path="children/add"           element={<AdminChildAdd />} />
                                    <Route path="children/edit/:id"      element={<AdminChildEdit />} />
                                    <Route path="children/scoreboard/:childId" element={<AdminChildScoreboard />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="assessors" />}>
                                    <Route path="assessors"              element={<AdminAssessorsList />} />
                                    <Route path="assessors/add"          element={<AdminAssessorAdd />} />
                                    <Route path="assessors/:id"          element={<AssessorDetailRedirect />} />
                                    <Route path="assessors/:id/:tab"     element={<AdminAssessorDetail />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="child-groups" />}>
                                    <Route path="child-groups"           element={<AdminChildGroupsList />} />
                                    <Route path="child-groups/add"       element={<AdminChildGroupAdd />} />
                                    <Route path="child-groups/edit/:id"  element={<AdminChildGroupEdit />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="analysis" />}>
                                    <Route path="analysis"               element={<AdminAnalysis />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="reports" />}>
                                    <Route path="reports"                element={<AdminReports />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="docs" />}>
                                    <Route path="docs"                   element={<AdminDocs />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="meta" blockStaff />}>
                                    <Route path="meta"                   element={<Navigate to="/admin/meta/contact" replace />} />
                                    <Route path="meta/:tabKey"           element={<AdminMeta />} />
                                </Route>
                                {/* Old bookmarks for the four tabs that moved into Settings — see
                                    MetaSettingsRedirect above for why these sit outside the
                                    moduleKey="meta" group. React Router ranks these literal
                                    segments above the moduleKey="meta" group's meta/:tabKey
                                    regardless of declaration order, so they take priority. */}
                                <Route path="meta/terms"             element={<MetaSettingsRedirect tabKey="terms" />} />
                                <Route path="meta/privacy"           element={<MetaSettingsRedirect tabKey="privacy" />} />
                                <Route path="meta/help"              element={<MetaSettingsRedirect tabKey="help" />} />
                                <Route path="meta/org-types"         element={<MetaSettingsRedirect tabKey="org-types" />} />
                                {/* Old bookmark — Support moved inside the Meta section as its
                                    own sidebar tab (AdminMeta.jsx), same pattern as the
                                    meta/terms-style redirects above. */}
                                <Route path="help-support"           element={<Navigate to="/admin/meta/support" replace />} />
                                <Route element={<RequireStaffPermission moduleKey="settings" blockStaff />}>
                                    <Route path="settings"               element={<SettingsRoute />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="elements" blockStaff />}>
                                    <Route path="elements"               element={<AdminElements />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="multilingual" blockStaff />}>
                                    <Route path="multilingual"           element={<AdminMultilingual />} />
                                </Route>
                                <Route element={<RequireStaffPermission moduleKey="staff" />}>
                                    <Route path="staff"                  element={<AdminStaffList />} />
                                    <Route path="staff/add"              element={<AdminStaffAdd />} />
                                    <Route path="staff/edit/:id"         element={<AdminStaffEdit />} />
                                    <Route path="staff/attendance"       element={<AdminStaffAttendance />} />
                                </Route>
                                {/* Staff Log History (Login History + Activity History) now lives as
                                    a tab on AdminStaffEdit — always administrator-only there too. */}
                                <Route element={<RequireAdminOnly />}>
                                    <Route path="staff/activity-log"      element={<AdminStaffActivityLog />} />
                                    {/* Organization approval queue — Super Admin only, not a
                                        grantable staff module (see requireAdminOnly server-side). */}
                                    <Route path="organizations"           element={<AdminOrganizationsList />} />
                                    <Route path="organizations/:id"       element={<OrgDetailRedirect />} />
                                    <Route path="organizations/:id/:tab"  element={<AdminOrganizationDetail />} />
                                    {/* Individual account oversight — same Super-Admin-only precedent
                                        as organizations (individuals aren't org-scoped either). */}
                                    <Route path="individuals"             element={<AdminIndividualsList />} />
                                    <Route path="individuals/:id"         element={<IndividualDetailRedirect />} />
                                    <Route path="individuals/:id/:tab"    element={<AdminIndividualDetail />} />
                                </Route>

                            </Route>
                        </Route>

                        {/* ── Catch-all: redirect unknown paths to home ─── */}
                        <Route path="*" element={<Navigate to="/" replace />} />

                    </Routes>
                </div>
            </Router>
        </ResponseMatchingProvider>
        </HeaderConfigProvider>
        </LanguageProvider>
        </CrashAnalyticsProvider>
        </GoogleAnalyticsProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
