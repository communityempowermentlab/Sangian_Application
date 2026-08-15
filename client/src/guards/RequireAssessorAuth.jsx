import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAssessorSession } from '../utils/assessorSession';

/**
 * Protects the assessor-only routes (Dashboard, Search Child, Account).
 * Mirrors RequireChildAuth.jsx's shape — an assessor authenticates at
 * /login (see assessorAuthController.js), which stores `assessorToken` in
 * localStorage. If it's missing, send them back to /login. The real
 * enforcement boundary is server-side (assessorAuth middleware on every
 * /api/assessor/* route) — this is UX only.
 */
const RequireAssessorAuth = () => {
    const location = useLocation();

    if (!isAssessorSession()) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default RequireAssessorAuth;
