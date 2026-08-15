// Reads/clears the public-facing Individual session (localStorage keys set
// by UnifiedLogin.jsx/UnifiedRegister.jsx on successful
// /api/individual/login or /register). Distinct from the assessor session
// (assessorSession.js) and the admin panel's staff/org session
// (staffPermissions.js).
import axiosIndividual from '../services/axiosIndividual';

export const isIndividualSession = () => Boolean(localStorage.getItem('individualToken'));

export const getIndividualInfo = () => {
    try {
        return JSON.parse(localStorage.getItem('individualUser') || 'null');
    } catch {
        return null;
    }
};

// Best-effort server-side logout (closes the individual_login_sessions
// row) then always clears the local session, even if the API call fails.
// Also ends the linked child's own login_sessions row/game session state
// (currentChild/sessionId) — an Individual's gameplay session only exists
// because of this login, so logging out ends both, matching Navbar.jsx's
// existing assessor-logout behavior.
export const individualLogout = async () => {
    const sessionId = localStorage.getItem('individualSessionId');
    try {
        if (sessionId) await axiosIndividual.post(`/individual/logout/${sessionId}`);
    } catch {
        // ignore — clear the local session regardless
    } finally {
        localStorage.removeItem('individualToken');
        localStorage.removeItem('individualSessionId');
        localStorage.removeItem('individualUser');
    }
};
