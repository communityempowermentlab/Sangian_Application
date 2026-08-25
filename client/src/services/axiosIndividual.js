/**
 * axiosIndividual — pre-configured axios instance for individual
 * self-service API calls (/api/individual/*). Mirrors axiosAssessor.js's
 * shape, for the public-facing Individual session (separate localStorage
 * keys — an individual is never an admin-panel or assessor session).
 */
import axios from 'axios';
import { API_URL } from './api';
import { endChildSession } from '../utils/endChildSession';

const axiosIndividual = axios.create({ baseURL: API_URL });

axiosIndividual.interceptors.request.use((config) => {
    const token = localStorage.getItem('individualToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// Only 401 (missing/invalid/expired token) forces the session to clear —
// mirrors axiosAssessor.js's split between 401 (session torn down) and
// other error codes (left for the calling page to handle).
//
// An Individual plays as their own linked child (UnifiedLogin.jsx's
// enterGameplay sets currentChild/sessionId right after login) — if the
// individual's own token goes invalid for any reason, that child must stop
// showing as "active" too, same reasoning as axiosAssessor.js.
axiosIndividual.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await endChildSession();
            localStorage.removeItem('individualToken');
            localStorage.removeItem('individualSessionId');
            localStorage.removeItem('individualUser');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosIndividual;
