// Reads/clears the public-facing Assessor session (localStorage keys set by
// Login.jsx on successful /api/assessor/login). Distinct from the admin
// panel's staff/org session (staffPermissions.js) — an assessor never has
// an admin-panel session.
import axiosAssessor from '../services/axiosAssessor';

export const isAssessorSession = () => Boolean(localStorage.getItem('assessorToken'));

export const getAssessorInfo = () => {
    try {
        return JSON.parse(localStorage.getItem('assessorInfo') || 'null');
    } catch {
        return null;
    }
};

// Best-effort server-side logout (closes the assessor_login_sessions row)
// then always clears the local session, even if the API call fails.
export const assessorLogout = async () => {
    const sessionId = localStorage.getItem('assessorSessionId');
    try {
        if (sessionId) await axiosAssessor.post(`/assessor/logout/${sessionId}`);
    } catch {
        // ignore — clear the local session regardless
    } finally {
        localStorage.removeItem('assessorToken');
        localStorage.removeItem('assessorSessionId');
        localStorage.removeItem('assessorInfo');
    }
};
