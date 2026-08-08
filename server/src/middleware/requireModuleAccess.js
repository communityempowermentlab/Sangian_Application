const { pool } = require('../config/db');
const adminAuth = require('./adminAuth');

// Server-side enforcement for the Staff Management module's per-menu
// permissions. Composes with adminAuth (rather than duplicating its JWT
// logic) — admins always pass through untouched (this is the crux of "don't
// disturb existing admin functionality"); only role==='staff' requests are
// checked against that staff account's granted module keys.
//
// Permissions are looked up fresh from the `staff` table on every request
// (not baked into the JWT) so that an admin revoking a permission — or
// deactivating the account — takes effect immediately, not just after the
// staff member's 12h token expires and they log in again.
function requireModuleAccess(moduleKey) {
    return (req, res, next) => {
        adminAuth(req, res, async () => {
            // Reaching this callback means adminAuth already succeeded and
            // set req.admin — if it had failed, it already sent a response
            // and never called next(), so this callback would never run.
            if (req.admin.role === 'admin') return next();

            try {
                const [rows] = await pool.query('SELECT permissions, status FROM staff WHERE id = ?', [req.admin.id]);
                if (!rows.length || rows[0].status !== 'active') {
                    return res.status(403).json({ success: false, message: 'Forbidden: account inactive.' });
                }
                const perms = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
                if (!perms.includes(moduleKey)) {
                    return res.status(403).json({ success: false, message: `Forbidden: no access to '${moduleKey}'.` });
                }
                next();
            } catch (err) {
                console.error('requireModuleAccess error:', err.message);
                res.status(500).json({ success: false, message: 'Server error checking permissions.' });
            }
        });
    };
}

// Variant for routers that bundle multiple menus under one mount (e.g.
// adminRoutes.js covers children/assessors/child-groups/dashboard/staff
// alongside cross-cutting endpoints like profile/logout that aren't tied to
// a specific menu). Resolves the module key per-request from req.path
// (relative to the router); unmapped paths pass through ungated — they
// still require adminAuth via their own route-level middleware, just
// aren't menu-permission-gated.
function requireModuleAccessByPath(prefixMap) {
    return (req, res, next) => {
        const match = prefixMap.find(([prefix]) => req.path.startsWith(prefix));
        if (!match) return next();
        return requireModuleAccess(match[1])(req, res, next);
    };
}

module.exports = requireModuleAccess;
module.exports.requireModuleAccessByPath = requireModuleAccessByPath;
