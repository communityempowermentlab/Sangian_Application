import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { AdminNotificationProvider, useAdminNotification } from '../contexts/AdminNotificationContext';
import '../pages/AdminDashboard.css';

const isTokenValid = () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
};

const getAdminUser = () => {
    try { return JSON.parse(localStorage.getItem('adminUser') || '{}'); }
    catch { return {}; }
};

const AdminLayoutInner = () => {
    const [time, setTime] = useState(new Date().toLocaleTimeString());
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [usersOpen, setUsersOpen] = useState(false);
    const [adminProfile, setAdminProfile] = useState(getAdminUser);
    const usersRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { newMessageCount, activeTicketCount } = useAdminNotification();

    const activeGroup =
        location.pathname.includes('/admin/children')      ? 'children'     :
        location.pathname.includes('/admin/assessors')     ? 'assessors'    :
        location.pathname.includes('/admin/analysis')      ? 'analysis'     :
        location.pathname.includes('/admin/meta')          ? 'meta'         :
        location.pathname.includes('/admin/reports')       ? 'reports'      :
        location.pathname.includes('/admin/docs')          ? 'docs'         :
        location.pathname.includes('/admin/help-support')  ? 'help-support' :
        location.pathname.includes('/admin/settings')      ? 'settings'     :
            'dashboard';

    const isUsersActive = activeGroup === 'children' || activeGroup === 'assessors';
    const appVersion = 'v1.0.0';

    // Sync profile from localStorage when updated by profile settings page
    useEffect(() => {
        const onProfileUpdated = () => setAdminProfile(getAdminUser());
        window.addEventListener('adminProfileUpdated', onProfileUpdated);
        return () => window.removeEventListener('adminProfileUpdated', onProfileUpdated);
    }, []);

    // Guard: verify token on every route change
    useEffect(() => {
        if (!isTokenValid()) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminSessionId');
            localStorage.removeItem('adminUser');
            navigate('/admin/login', { replace: true });
        }
    }, [location.pathname, navigate]);

    // Periodic background token expiry check
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isTokenValid()) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminSessionId');
                localStorage.removeItem('adminUser');
                navigate('/admin/login', { replace: true });
            }
        }, 60_000);
        return () => clearInterval(interval);
    }, [navigate]);

    // Live Clock
    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date().toLocaleTimeString([], { hour12: false }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Close Users dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (usersRef.current && !usersRef.current.contains(e.target)) {
                setUsersOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogoutConfirm = async () => {
        try {
            const sessionId = localStorage.getItem('adminSessionId');
            if (sessionId) await axiosAdmin.post(`/admin/logout/${sessionId}`);
        } catch (e) {
            console.error('Logout admin session error:', e);
        } finally {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminSessionId');
            localStorage.removeItem('adminUser');
            navigate('/admin/login');
        }
    };

    const logoSrc = adminProfile.logo_url || '/cel_admin_logo.png';
    const adminName = adminProfile.name || 'Admin';

    return (
        <div className="admin-dashboard-wrapper">
            <div className="admin-app">

                {/* Topbar */}
                <header className="admin-topbar">
                    <div className="admin-brand">
                        <Link to="/admin/dashboard" className="admin-brand-link">
                            <img src={logoSrc} alt="Sangian Admin" className="admin-logo" />
                        </Link>
                    </div>

                    <div className="admin-top-right">
                        <div className="admin-chip">
                            <div className="admin-dot"></div>
                            <span id="adminName">{adminName}</span>
                        </div>

                        <div className="admin-chip">
                            🕒 <span className="admin-clock">{time}</span>
                        </div>

                        <div className="admin-version">{appVersion}</div>

                        <button className="admin-btn admin-btn-danger" onClick={() => setShowLogoutModal(true)}>
                            🚪 Logout
                        </button>
                    </div>
                </header>

                {/* Menu Bar */}
                <nav className="admin-menu-bar">
                    <div className="admin-menus">
                        <Link
                            to="/admin/dashboard"
                            className={`admin-menu-item ${location.pathname === '/admin/dashboard' ? 'active' : ''}`}
                        >
                            📊 Dashboard
                        </Link>

                        {/* Users dropdown */}
                        <div className="admin-menu-dropdown" ref={usersRef}>
                            <button
                                className={`admin-menu-item admin-menu-item--btn ${isUsersActive ? 'active' : ''}`}
                                onClick={() => setUsersOpen(o => !o)}
                            >
                                👥 Users <span className="admin-dropdown-caret">{usersOpen ? '▴' : '▾'}</span>
                            </button>
                            {usersOpen && (
                                <div className="admin-dropdown-panel">
                                    <Link
                                        to="/admin/children"
                                        className={`admin-dropdown-item ${activeGroup === 'children' ? 'active' : ''}`}
                                        onClick={() => setUsersOpen(false)}
                                    >
                                        👶 Children
                                    </Link>
                                    <Link
                                        to="/admin/assessors"
                                        className={`admin-dropdown-item ${activeGroup === 'assessors' ? 'active' : ''}`}
                                        onClick={() => setUsersOpen(false)}
                                    >
                                        🧑‍🏫 Assessors
                                    </Link>
                                </div>
                            )}
                        </div>

                        <Link
                            to="/admin/reports"
                            className={`admin-menu-item ${activeGroup === 'reports' ? 'active' : ''}`}
                        >
                            📈 Reports
                        </Link>
                        <Link
                            to="/admin/analysis"
                            className={`admin-menu-item ${activeGroup === 'analysis' ? 'active' : ''}`}
                        >
                            🔬 Analysis
                        </Link>
                        <Link
                            to="/admin/docs"
                            className={`admin-menu-item ${activeGroup === 'docs' ? 'active' : ''}`}
                        >
                            📄 Docs
                        </Link>

                        {/* Meta tab — badge shows unread contact messages */}
                        <Link
                            to="/admin/meta"
                            className={`admin-menu-item admin-menu-item--badged ${activeGroup === 'meta' ? 'active' : ''}`}
                        >
                            🗂️ Meta
                            {newMessageCount > 0 && (
                                <span className="admin-nav-badge">{newMessageCount > 99 ? '99+' : newMessageCount}</span>
                            )}
                        </Link>

                        <Link
                            to="/admin/help-support"
                            className={`admin-menu-item admin-menu-item--badged ${activeGroup === 'help-support' ? 'active' : ''}`}
                        >
                            🎫 Support
                            {activeTicketCount > 0 && (
                                <span className="admin-nav-badge">{activeTicketCount > 99 ? '99+' : activeTicketCount}</span>
                            )}
                        </Link>

                        <Link
                            to="/admin/settings"
                            className={`admin-menu-item ${activeGroup === 'settings' ? 'active' : ''}`}
                        >
                            ⚙️ Settings
                        </Link>
                    </div>

                    <div className="admin-search">
                        <input type="text" placeholder="Search (UI)..." id="searchBox" />
                        <button className="admin-btn admin-btn-ghost">🔍</button>
                    </div>
                </nav>

                {/* Main Content Render */}
                <Outlet />

                {/* Footer */}
                <footer className="admin-footer">
                    <div>Copyright © 2026 - All rights reserved Community Empowerment Lab</div>
                    <div id="adminFooterVersion">Dashboard Version: {appVersion}</div>
                </footer>

            </div>

            {/* Logout Modal */}
            {showLogoutModal && (
                <div className="admin-modal-overlay" onClick={() => setShowLogoutModal(false)}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <div className="admin-modal-icon">🚪</div>
                            <div>
                                <div className="admin-modal-title">Confirm Logout</div>
                                <div className="admin-modal-subtitle">Are you sure you want to end your secure session?</div>
                            </div>
                        </div>
                        <div className="admin-modal-actions">
                            <button className="admin-btn admin-btn-ghost" onClick={() => setShowLogoutModal(false)}>
                                Cancel
                            </button>
                            <button className="admin-btn admin-btn-danger" onClick={handleLogoutConfirm}>
                                Yes, Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminLayout = () => (
    <AdminNotificationProvider>
        <AdminLayoutInner />
    </AdminNotificationProvider>
);

export default AdminLayout;
