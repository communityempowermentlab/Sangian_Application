/**
 * axiosAssessor — pre-configured axios instance for assessor self-service
 * API calls (/api/assessor/*). Mirrors axiosAdmin.js's shape, but for the
 * public-facing Assessor session (separate localStorage keys — an assessor
 * is never an admin-panel session).
 */
import axios from 'axios';
import { API_URL } from './api';
import { endChildSession } from '../utils/endChildSession';

const axiosAssessor = axios.create({ baseURL: API_URL });

axiosAssessor.interceptors.request.use((config) => {
    const token = localStorage.getItem('assessorToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// Only 401 (missing/invalid/expired token) forces the session to clear —
// mirrors axiosAdmin.js's split between 401 (session torn down) and other
// error codes (left for the calling page to handle).
//
// A selected child (currentChild/sessionId) is only ever reachable through
// this assessor's own session (see AssessorSearchChild.jsx) — if the
// assessor's token has gone invalid for any reason (natural 12h expiry, a
// Super Admin force-logout, or the account being deactivated mid-session),
// that child must stop showing as "active" too, not just linger with no
// valid session actually behind it. Navbar.jsx's own explicit logout
// button already did this; this covers every OTHER way the session can end.
axiosAssessor.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await endChildSession();
            localStorage.removeItem('assessorToken');
            localStorage.removeItem('assessorSessionId');
            localStorage.removeItem('assessorInfo');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosAssessor;
