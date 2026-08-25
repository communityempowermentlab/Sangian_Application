import axios from 'axios';
import { API_URL } from '../services/api';

// Best-effort close of the child's own in-progress game_sessions row, plus
// clearing the currentChild/sessionId localStorage pair every game page,
// RequireChildAuth, and the Navbar's child banner key off. Shared by
// Navbar.jsx's own logout buttons and by axiosAssessor.js/
// axiosIndividual.js's 401 interceptors — so a child's play session is torn
// down consistently whenever its owning assessor/individual session ends,
// whether by an explicit logout click or by the token simply going invalid
// (expiry, force-logout, account deactivation). Without this, a child kept
// showing as "active" (Navbar banner, orphaned game_sessions row) with no
// valid session actually backing it.
export const endChildSession = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
        try {
            await axios.post(`${API_URL}/sessions/end/${sessionId}`);
        } catch (e) {
            console.error('Failed to end child session:', e);
        }
    }
    localStorage.removeItem('currentChild');
    localStorage.removeItem('sessionId');
};
