/**
 * axiosIndividual — pre-configured axios instance for individual
 * self-service API calls (/api/individual/*). Mirrors axiosAssessor.js's
 * shape, for the public-facing Individual session (separate localStorage
 * keys — an individual is never an admin-panel or assessor session).
 */
import axios from 'axios';
import { API_URL } from './api';

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
axiosIndividual.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('individualToken');
            localStorage.removeItem('individualSessionId');
            localStorage.removeItem('individualUser');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosIndividual;
