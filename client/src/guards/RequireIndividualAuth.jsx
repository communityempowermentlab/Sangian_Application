import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isIndividualSession } from '../utils/individualSession';

/**
 * Protects Individual-only routes (My Reports, Account). Mirrors
 * RequireAssessorAuth.jsx's shape — an Individual authenticates at /login
 * (the unified login page — see UnifiedLogin.jsx), which stores
 * `individualToken` in localStorage. If it's missing, send them back
 * there. The real enforcement boundary is server-side (individualAuth
 * middleware on every /api/individual/* route) — this is UX only.
 */
const RequireIndividualAuth = () => {
    const location = useLocation();

    if (!isIndividualSession()) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default RequireIndividualAuth;
