import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
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

import { LanguageProvider } from './contexts/LanguageContext';
import { GoogleAnalyticsProvider } from './contexts/GoogleAnalyticsContext';
import { CrashAnalyticsProvider }  from './contexts/CrashAnalyticsContext';
import './index.css';

const ROUTE_TITLES = {
    '/':                        'Home | Community Empowerment Lab',
    '/register':                'Register | Community Empowerment Lab',
    '/login':                   'Login | Community Empowerment Lab',
    '/games/number_skill':      'Ankganit | Game | Community Empowerment Lab',
    '/games/reading_skill':     'Padh ke batao | Game | Community Empowerment Lab',
    '/games/number_recall':     'Lottery Ka Ticket | Game | Community Empowerment Lab',
    '/games/her_pher':          'Her Pher | Game | Community Empowerment Lab',
    '/games/dhyan_kahan_hai':   'Dhyan Kahan Hai | Game | Community Empowerment Lab',
    '/games/rachna':            'Rachna | Game | Community Empowerment Lab',
    '/games/bagiya':            'Bagiya | Game | Community Empowerment Lab',
    '/games/chalo_mela_chale':  'Chalo Mela Chalen | Game | Community Empowerment Lab',
    '/games/chor_machaye_shor': 'Chor Machaye Shor | Game | Community Empowerment Lab',
    '/terms-conditions':         'Terms & Conditions | Community Empowerment Lab',
    '/privacy-policy':           'Privacy Policy | Community Empowerment Lab',
    '/admin/login':             'Admin Login | Community Empowerment Lab',
    '/admin/dashboard':         'Dashboard | Admin Panel | Community Empowerment Lab',
    '/admin/children':          'Children | Admin Panel | Community Empowerment Lab',
    '/admin/children/add':      'Add Child | Admin Panel | Community Empowerment Lab',
    '/admin/assessors':         'Assessors | Admin Panel | Community Empowerment Lab',
    '/admin/assessors/add':     'Add Assessor | Admin Panel | Community Empowerment Lab',
    '/admin/reports':           'Reports | Admin Panel | Community Empowerment Lab',
    '/admin/docs':              'Documentation | Admin Panel | Community Empowerment Lab',
    '/admin/analysis':          'Analysis | Admin Panel | Community Empowerment Lab',
    '/admin/settings':          'Settings | Admin Panel | Community Empowerment Lab',
    '/admin/meta':              'Meta | Admin Panel | Community Empowerment Lab',
    '/contact-us':              'Contact Us | Community Empowerment Lab',
    '/help':                    'Help & Support | Community Empowerment Lab',
    '/admin/help-support':      'Help & Support | Admin Panel | Community Empowerment Lab',
};

const PageTitle = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        const title = ROUTE_TITLES[pathname]
            ?? (pathname.startsWith('/admin/children/edit/')
                ? 'Edit Child | Admin Panel | Community Empowerment Lab'
                : 'Community Empowerment Lab');
        document.title = title;
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
            <Router>
                <PageTitle />
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

                        {/* ── Protected Game Routes (child must be logged in) ── */}
                        <Route element={<RequireChildAuth />}>
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
                            </Route>
                        </Route>

                        {/* ── Catch-all: redirect unknown paths to home ─── */}
                        <Route path="*" element={<Navigate to="/" replace />} />

                    </Routes>
                </div>
            </Router>
        </LanguageProvider>
        </CrashAnalyticsProvider>
        </GoogleAnalyticsProvider>
        </GoogleOAuthProvider>
    );
}

export default App;
