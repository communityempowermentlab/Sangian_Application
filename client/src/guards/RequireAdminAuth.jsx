import { Navigate, Outlet, useLocation } from 'react-router-dom';

/**
 * Decodes the JWT payload and checks whether the token is still valid.
 * Does NOT verify the signature (that's the server's job) — just checks expiry
 * so the UI doesn't wait for a 401 on every page load.
 */
const isAdminTokenValid = () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // exp is Unix seconds; Date.now() is ms
        return payload.exp * 1000 > Date.now();
    } catch {
        return false;
    }
};

const clearAdminSession = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminSessionId');
    localStorage.removeItem('adminUser');
};

/**
 * Wraps all protected admin routes.
 * Redirects to /admin/login if no valid token is found.
 * Passes `state.from` so the login page can redirect back after auth.
 */
const RequireAdminAuth = () => {
    const location = useLocation();

    if (!isAdminTokenValid()) {
        clearAdminSession();
        return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default RequireAdminAuth;
