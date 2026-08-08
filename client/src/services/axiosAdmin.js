/**
 * axiosAdmin — pre-configured axios instance for all admin API calls.
 *
 * Automatically:
 *  - Attaches the admin JWT as Authorization: Bearer <token> on every request
 *  - Intercepts 401 responses and redirects to /admin/login (session expiry handling)
 */
import axios from 'axios';
import { API_URL } from './api';

const axiosAdmin = axios.create({ baseURL: API_URL });

// ── Request: attach admin token ───────────────────────────────────────────────
axiosAdmin.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Lets the backend correlate an activity-log entry back to the login
    // session that produced it (see logStaffActivity's session_id capture),
    // without every controller having to thread it through explicitly.
    const sessionId = localStorage.getItem('adminSessionId');
    if (sessionId) {
        config.headers['X-Session-Id'] = sessionId;
    }
    return config;
});

// ── Response: handle 401 ──────────────────────────────────────────────────────
// Only 401 (session missing/invalid/expired) forces a logout — 403 means the
// token is still valid but this specific action/module isn't permitted
// (Staff Management's requireModuleAccess is the main source of these), so
// the calling page should handle it itself (e.g. show an inline message)
// rather than the whole session being torn down. Before the Staff module
// existed, adminAuth only ever returned 403 for a forged/bogus role, which
// doesn't happen in normal use — so this split doesn't change any existing
// admin-facing behavior, it only stops a legitimately-restricted staff
// action from looking like an expired session.
axiosAdmin.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminSessionId');
            localStorage.removeItem('adminUser');
            localStorage.removeItem('staffPermissions');
            // Use window.location so the redirect works outside React context too
            window.location.href = '/admin/login';
        }
        return Promise.reject(error);
    }
);

export default axiosAdmin;
