import { Outlet } from 'react-router-dom';
import { canSeeModule } from '../utils/staffPermissions';

/**
 * Wraps an individual protected admin route with a menu-permission check.
 * Nested inside RequireAdminAuth (so a valid session already exists here).
 *
 * Unlike RequireGameEnabled's deliberate fail-open (a low-stakes feature
 * flag), this fails CLOSED — any uncertainty denies access. That's safe
 * because it's UX polish, not the real enforcement boundary: the matching
 * API calls behind this page are independently gated server-side by
 * requireModuleAccess, so a denied render here can never expose data —
 * worst case the page would render an empty/errored state from 403s.
 *
 * Renders an inline message rather than <Navigate>-ing to another gated
 * route (e.g. dashboard) — a staff account that also lacks THAT module's
 * grant would otherwise bounce into a redirect loop. This deliberately
 * doesn't wrap itself in any layout/permission dependency.
 *
 * canSeeModule() returns true unconditionally for an admin session
 * (staffPermissions is absent), so this is a no-op for the existing admin
 * role — it only ever restricts a staff session.
 */
const RequireStaffPermission = ({ moduleKey }) => {
    if (!canSeeModule(moduleKey)) {
        return (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
                <h2 style={{ margin: '0 0 8px', color: '#1e293b' }}>Access Restricted</h2>
                <p>You don't have permission to view this section. Contact your administrator if you believe this is a mistake.</p>
            </div>
        );
    }
    return <Outlet />;
};

export default RequireStaffPermission;
