import { Navigate, Outlet, useLocation } from 'react-router-dom';

/**
 * Protects all child game routes.
 * Children authenticate by selecting their ID + PIN on /login,
 * which stores `currentChild` and `sessionId` in localStorage.
 * If either is missing the child is sent back to /login.
 */
const RequireChildAuth = () => {
    const location = useLocation();

    const child     = localStorage.getItem('currentChild');
    const sessionId = localStorage.getItem('sessionId');

    if (!child || !sessionId) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Basic sanity-check: make sure stored value is valid JSON
    try {
        JSON.parse(child);
    } catch {
        localStorage.removeItem('currentChild');
        localStorage.removeItem('sessionId');
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default RequireChildAuth;
