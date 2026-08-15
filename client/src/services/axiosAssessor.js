/**
 * axiosAssessor — pre-configured axios instance for assessor self-service
 * API calls (/api/assessor/*). Mirrors axiosAdmin.js's shape, but for the
 * public-facing Assessor session (separate localStorage keys — an assessor
 * is never an admin-panel session).
 */
import axios from 'axios';
import { API_URL } from './api';

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
axiosAssessor.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('assessorToken');
            localStorage.removeItem('assessorSessionId');
            localStorage.removeItem('assessorInfo');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosAssessor;
