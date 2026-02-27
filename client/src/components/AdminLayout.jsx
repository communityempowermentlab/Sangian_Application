import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../pages/AdminDashboard.css';

const AdminLayout = () => {
    const [time, setTime] = useState(new Date().toLocaleTimeString());
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const activeGroup =
        location.pathname.includes('/admin/children') ? 'children' :
            'dashboard';

    const adminUserStr = localStorage.getItem('adminUser');
    const adminName = adminUserStr ? JSON.parse(adminUserStr).name : 'Admin';
    const appVersion = 'v1.0.0';

    // Live Clock
    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date().toLocaleTimeString([], { hour12: false }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
    };

    const handleLogoutConfirm = async () => {
        try {
            const sessionId = localStorage.getItem('adminSessionId');
            if (sessionId) {
                await axios.post(`http://localhost:5000/api/admin/logout/${sessionId}`);
            }
        } catch (e) {
            console.error("Logout admin session error:", e);
        } finally {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminSessionId');
            localStorage.removeItem('adminUser');
            navigate('/admin/login');
        }
    };

    return (
        <div className="admin-dashboard-wrapper">
            <div className="admin-app">

                {/* Topbar */}
                <header className="admin-topbar">
                    <div className="admin-brand">
                        <Link to="/admin/dashboard" className="admin-brand-link">
                            <img src="/cel_admin_logo.png" alt="Sangian Admin" className="admin-logo" />
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

                        <button className="admin-btn admin-btn-danger" onClick={handleLogoutClick}>
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
                        <Link
                            to="/admin/children"
                            className={`admin-menu-item ${location.pathname.startsWith('/admin/children') ? 'active' : ''}`}
                        >
                            👥 Children
                        </Link>
                        <a href="#" className="admin-menu-item">📈 Reports</a>
                        <a href="#" className="admin-menu-item">⚙️ Settings</a>
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

export default AdminLayout;
