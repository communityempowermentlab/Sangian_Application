import { Outlet } from 'react-router-dom';
import { isStaffSession, isOrgSession } from '../utils/staffPermissions';

/**
 * Stricter sibling of RequireStaffPermission — for the Staff Log History
 * pages (Login History + Activity History) and the Organizations/
 * Individuals oversight pages, which must stay off-limits to every staff
 * AND organization account, even one holding a hypothetical module grant.
 * That's why this checks role directly instead of a permission key.
 *
 * Same fail-closed / inline-message rationale as RequireStaffPermission:
 * this is UX polish only, the real boundary is requireAdminOnly server-side.
 */
const RequireAdminOnly = () => {
    if (isStaffSession() || isOrgSession()) {
        return (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
                <h2 style={{ margin: '0 0 8px', color: '#1e293b' }}>Administrator Access Only</h2>
                <p>This section is only visible to administrators.</p>
            </div>
        );
    }
    return <Outlet />;
};

export default RequireAdminOnly;
