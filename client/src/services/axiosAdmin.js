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
    return config;
});

// ── Response: handle 401 / 403 ────────────────────────────────────────────────
axiosAdmin.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminSessionId');
            localStorage.removeItem('adminUser');
            // Use window.location so the redirect works outside React context too
            window.location.href = '/admin/login';
        }
        return Promise.reject(error);
    }
);

export default axiosAdmin;
