import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { AdminNotificationProvider, useAdminNotification } from '../contexts/AdminNotificationContext';
import { getAdminLogoUrl } from '../services/photoUtils';
import { canSeeModule, isStaffSession, isOrgSession } from '../utils/staffPermissions';

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

// Friendly page names for the "menu accessed / page visited" activity trail
// (see the log-page-view effect below) — ordered specific-to-general, same
// convention as the activeGroup resolver just below it.
const PAGE_LABELS = [
    [/^\/admin\/dashboard/, 'Dashboard'],
    [/^\/admin\/children\/add/, 'Add Child'],
    [/^\/admin\/children\/edit/, 'Edit Child'],
    [/^\/admin\/children\/scoreboard/, 'Child Scoreboard'],
    [/^\/admin\/children/, 'Children List'],
    [/^\/admin\/assessors\/add/, 'Add Assessor'],
    [/^\/admin\/assessors\/edit/, 'Edit Assessor'],
    [/^\/admin\/assessors/, 'Assessors List'],
    [/^\/admin\/child-groups\/add/, 'Add Child Group'],
    [/^\/admin\/child-groups\/edit/, 'Edit Child Group'],
    [/^\/admin\/child-groups/, 'Child Groups List'],
    [/^\/admin\/analysis/, 'Analysis'],
    [/^\/admin\/reports/, 'Reports'],
    [/^\/admin\/docs/, 'Docs'],
    [/^\/admin\/meta/, 'Meta'],
    [/^\/admin\/multilingual/, 'Multilingual'],
    [/^\/admin\/elements/, 'Elements'],
    [/^\/admin\/staff\/add/, 'Add Staff'],
    [/^\/admin\/staff\/edit/, 'Edit Staff'],
    [/^\/admin\/staff\/attendance/, 'Staff Attendance'],
    [/^\/admin\/staff\/profile/, 'My Profile'],
    [/^\/admin\/staff/, 'Staff List'],
    [/^\/admin\/settings/, 'Settings'],
];
const getPageLabel = (pathname) => (PAGE_LABELS.find(([re]) => re.test(pathname)) || [null, pathname])[1];

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
        location.pathname.includes('/admin/child-groups')  ? 'child-groups' :
        location.pathname.includes('/admin/analysis')      ? 'analysis'     :
        location.pathname.includes('/admin/meta')          ? 'meta'         :
        location.pathname.includes('/admin/reports')       ? 'reports'      :
        location.pathname.includes('/admin/docs')          ? 'docs'         :
        location.pathname.includes('/admin/multilingual')  ? 'multilingual' :
        location.pathname.includes('/admin/elements')      ? 'elements'     :
        location.pathname.includes('/admin/staff')          ? 'staff'        :
        location.pathname.includes('/admin/organizations')  ? 'organizations' :
        location.pathname.includes('/admin/individuals')    ? 'individuals'  :
        location.pathname.includes('/admin/ankganit-v2-config') ? 'ankganit-v2-config' :
        location.pathname.includes('/admin/settings')      ? 'settings'     :
            'dashboard';

    const isUsersActive = activeGroup === 'children' || activeGroup === 'assessors' || activeGroup === 'child-groups' || activeGroup === 'staff' || activeGroup === 'organizations';
    const appVersion = 'v1.0.0';

    // Sync profile from localStorage when updated by profile settings page
    useEffect(() => {
        const onProfileUpdated = () => setAdminProfile(getAdminUser());
        window.addEventListener('adminProfileUpdated', onProfileUpdated);
        return () => window.removeEventListener('adminProfileUpdated', onProfileUpdated);
    }, []);

    // "Menu accessed / page visited" activity trail — staff sessions only
    // (an admin's own navigation isn't what this audit trail is for). One
    // fire-and-forget call per route change; errors are swallowed since a
    // tracking call must never block or break navigation.
    useEffect(() => {
        if (!isStaffSession()) return;
        axiosAdmin.post('/admin/staff/log-page-view', {
            module: activeGroup,
            menuName: activeGroup.charAt(0).toUpperCase() + activeGroup.slice(1),
            pageName: getPageLabel(location.pathname),
        }).catch(() => {});
    }, [location.pathname, activeGroup]);

    // Guard: verify token on every route change
    useEffect(() => {
        if (!isTokenValid()) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminSessionId');
            localStorage.removeItem('adminUser');
            localStorage.removeItem('staffPermissions');
            localStorage.removeItem('orgPermissions');
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
                localStorage.removeItem('staffPermissions');
                localStorage.removeItem('orgPermissions');
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
            localStorage.removeItem('staffPermissions');
            localStorage.removeItem('orgPermissions');
            navigate('/admin/login');
        }
    };

    const logoSrc = getAdminLogoUrl(adminProfile.logo_url);
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
                        {canSeeModule('dashboard') && (
                            <Link
                                to="/admin/dashboard"
                                className={`admin-menu-item ${location.pathname === '/admin/dashboard' ? 'active' : ''}`}
                            >
                                📊 Dashboard
                            </Link>
                        )}

                        {/* Organization dropdown — merged single module: Organizations
                            (Super Admin only, hard requireAdminOnly role check, never a
                            canSeeModule permission a staff/org account can be granted)
                            plus every user-management menu (children/assessors/
                            child-groups/staff), each filtered individually for a
                            partial staff/org grant. */}
                        {((!isStaffSession() && !isOrgSession()) || canSeeModule('children') || canSeeModule('assessors') || canSeeModule('child-groups') || canSeeModule('staff')) && (
                        <div className="admin-menu-dropdown" ref={usersRef}>
                            <button
                                className={`admin-menu-item admin-menu-item--btn ${isUsersActive ? 'active' : ''}`}
                                onClick={() => setUsersOpen(o => !o)}
                            >
                                🏢 Organization <span className="admin-dropdown-caret">{usersOpen ? '▴' : '▾'}</span>
                            </button>
                            {usersOpen && (
                                <div className="admin-dropdown-panel">
                                    {!isStaffSession() && !isOrgSession() && (
                                        <Link
                                            to="/admin/organizations"
                                            className={`admin-dropdown-item ${activeGroup === 'organizations' ? 'active' : ''}`}
                                            onClick={() => setUsersOpen(false)}
                                        >
                                            🏢 Organizations
                                        </Link>
                                    )}
                                    {canSeeModule('children') && (
                                        <Link
                                            to="/admin/children"
                                            className={`admin-dropdown-item ${activeGroup === 'children' ? 'active' : ''}`}
                                            onClick={() => setUsersOpen(false)}
                                        >
                                            👶 Children
                                        </Link>
                                    )}
                                    {canSeeModule('assessors') && (
                                        <Link
                                            to="/admin/assessors"
                                            className={`admin-dropdown-item ${activeGroup === 'assessors' ? 'active' : ''}`}
                                            onClick={() => setUsersOpen(false)}
                                        >
                                            🧑‍🏫 Assessors
                                        </Link>
                                    )}
                                    {canSeeModule('child-groups') && (
                                        <Link
                                            to="/admin/child-groups"
                                            className={`admin-dropdown-item ${activeGroup === 'child-groups' ? 'active' : ''}`}
                                            onClick={() => setUsersOpen(false)}
                                        >
                                            🗂️ Child Groups
                                        </Link>
                                    )}
                                    {canSeeModule('staff') && (
                                        <Link
                                            to="/admin/staff"
                                            className={`admin-dropdown-item ${activeGroup === 'staff' ? 'active' : ''}`}
                                            onClick={() => setUsersOpen(false)}
                                        >
                                            🧑‍💼 Staff
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                        )}

                        {/* Individual account oversight — same Super-Admin-only precedent. */}
                        {!isStaffSession() && !isOrgSession() && (
                            <Link
                                to="/admin/individuals"
                                className={`admin-menu-item ${activeGroup === 'individuals' ? 'active' : ''}`}
                            >
                                🧑 Individuals
                            </Link>
                        )}

                        {canSeeModule('reports') && (
                            <Link
                                to="/admin/reports"
                                className={`admin-menu-item ${activeGroup === 'reports' ? 'active' : ''}`}
                            >
                                📈 Reports
                            </Link>
                        )}
                        {canSeeModule('analysis') && (
                            <Link
                                to="/admin/analysis"
                                className={`admin-menu-item ${activeGroup === 'analysis' ? 'active' : ''}`}
                            >
                                🔬 Analysis
                            </Link>
                        )}
                        {canSeeModule('docs') && (
                            <Link
                                to="/admin/docs"
                                className={`admin-menu-item ${activeGroup === 'docs' ? 'active' : ''}`}
                            >
                                📄 Docs
                            </Link>
                        )}

                        {/* Support tab (Meta section) — badge sums the sidebar's own
                            badges: unread contact messages + active tickets.
                            Super-Admin-only: hard-blocked for staff regardless of any
                            stale 'meta' grant (see ADMIN_MODULES in staffPermissions.js). */}
                        {!isStaffSession() && canSeeModule('meta') && (
                            <Link
                                to="/admin/meta"
                                className={`admin-menu-item admin-menu-item--badged ${activeGroup === 'meta' ? 'active' : ''}`}
                            >
                                🗂️ Support
                                {(newMessageCount + activeTicketCount) > 0 && (
                                    <span className="admin-nav-badge">
                                        {(newMessageCount + activeTicketCount) > 99 ? '99+' : newMessageCount + activeTicketCount}
                                    </span>
                                )}
                            </Link>
                        )}

                        {!isStaffSession() && canSeeModule('multilingual') && (
                            <Link
                                to="/admin/multilingual"
                                className={`admin-menu-item ${activeGroup === 'multilingual' ? 'active' : ''}`}
                            >
                                🌐 Multilingual
                            </Link>
                        )}

                        {!isStaffSession() && canSeeModule('elements') && (
                            <Link
                                to="/admin/elements"
                                className={`admin-menu-item ${activeGroup === 'elements' ? 'active' : ''}`}
                            >
                                🧩 Elements
                            </Link>
                        )}

                        {!isStaffSession() && canSeeModule('settings') && (
                            <Link
                                to="/admin/settings"
                                className={`admin-menu-item ${activeGroup === 'settings' ? 'active' : ''}`}
                            >
                                ⚙️ Settings
                            </Link>
                        )}
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
