import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
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
import ChaloMelaChaleGame from './pages/ChaloMelaChaleGame';
import ChorMachayeShorGame from './pages/ChorMachayeShorGame';
import RequireAdminAuth from './guards/RequireAdminAuth';
import RequireChildAuth from './guards/RequireChildAuth';

import { LanguageProvider } from './contexts/LanguageContext';
import './index.css';

const ROUTE_TITLES = {
    '/':                        'Home | Community Empowerment Lab',
    '/register':                'Register | Community Empowerment Lab',
    '/login':                   'Login | Community Empowerment Lab',
    '/games/number_skill':      'Numeracy Test | Game | Community Empowerment Lab',
    '/games/reading_skill':     'Literacy Test | Game | Community Empowerment Lab',
    '/games/number_recall':     'Number Recall | Game | Community Empowerment Lab',
    '/games/her_pher':          'Working Memory | Game | Community Empowerment Lab',
    '/games/dhyan_kahan_hai':   'Auditory Attention | Game | Community Empowerment Lab',
    '/games/rachna':            'Triangle | Game | Community Empowerment Lab',
    '/games/bagiya':            'Atlantis Game | Game | Community Empowerment Lab',
    '/games/chalo_mela_chale':  'Rover Game | Game | Community Empowerment Lab',
    '/games/chor_machaye_shor': 'Chor Machaye Shor | Game | Community Empowerment Lab',
    '/admin/login':             'Admin Login | Community Empowerment Lab',
    '/admin/dashboard':         'Dashboard | Admin Panel | Community Empowerment Lab',
    '/admin/children':          'Children | Admin Panel | Community Empowerment Lab',
    '/admin/children/add':      'Add Child | Admin Panel | Community Empowerment Lab',
    '/admin/reports':           'Reports | Admin Panel | Community Empowerment Lab',
    '/admin/docs':              'Documentation | Admin Panel | Community Empowerment Lab',
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
                                <Route path="reports"                element={<AdminReports />} />
                                <Route path="docs"                   element={<AdminDocs />} />
                            </Route>
                        </Route>

                        {/* ── Catch-all: redirect unknown paths to home ─── */}
                        <Route path="*" element={<Navigate to="/" replace />} />

                    </Routes>
                </div>
            </Router>
        </LanguageProvider>
    );
}

export default App;
