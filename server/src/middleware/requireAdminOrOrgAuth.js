const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const JWT_SECRET = require('../config/jwtSecret');

// Combined auth+authorization gate for resources reachable by BOTH the
// existing Super Admin/Staff Management pipeline AND Organizations
// (children, staff). Exactly one of req.admin /
// req.org is set on success — resolveOrgScope (which must run after this)
// reads whichever was set to compute the scoping filter.
//
// This intentionally reimplements (rather than calls) requireModuleAccess's
// staff-permission check: requireModuleAccess's adminAuth call would reject
// an 'organization' JWT outright (403) before this middleware ever got a
// chance to try the org path, so the two auth types can't simply be
// composed — the module-permission check for staff has to live here too,
// otherwise a staff account without the given module grant would slip
// through since this function's job is auth, not "staff OR org, no checks."
//
// moduleKey is optional — omit it for routes that any authenticated
// admin/staff/org identity should reach regardless of granted modules (e.g.
// logout: ending your own session isn't a "menu" a staff/org account can be
// denied), mirroring the same self-service exemption staffRoutes.js's
// /me/profile routes already have under plain adminAuth.
//
// Organization permission shape: organizations.permissions is a flat array
// of granted module keys, e.g. ["dashboard","children"] — see db.js.
// Checking a module grants full (view/add/edit/delete/...) access to it,
// same flat all-or-nothing model staff.permissions already uses; there is
// no per-action grant. An org-bound staff member (staff.org_id set) is
// additionally capped at what their OWN organization is granted:
// organizations.permissions is the ceiling, staff.permissions is the
// actual grant within it — a staff account can never see a module its
// organization itself doesn't have, even if staff.permissions alone would
// say yes. Staff with org_id NULL (global/Super-Admin-managed, today's
// pre-existing behavior) has no such ceiling.
function requireAdminOrOrgAuth(moduleKey) {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
    }
    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const message = err.name === 'TokenExpiredError'
        ? 'Unauthorized: Session expired. Please log in again.'
        : 'Unauthorized: Invalid token.';
      return res.status(401).json({ success: false, message });
    }

    if (decoded.role === 'admin') {
      req.admin = decoded;
      return next();
    }

    if (decoded.role === 'staff') {
      try {
        const [rows] = await pool.query('SELECT permissions, status, org_id FROM staff WHERE id = ?', [decoded.id]);
        if (!rows.length || rows[0].status !== 'active') {
          return res.status(403).json({ success: false, message: 'Forbidden: account inactive.' });
        }
        if (moduleKey) {
          const perms = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
          if (!perms.includes(moduleKey)) {
            return res.status(403).json({ success: false, message: `Forbidden: no access to '${moduleKey}'.` });
          }
          // Org-bound staff is additionally capped at their organization's
          // own granted modules — see the module-level comment above.
          if (rows[0].org_id) {
            const [orgRows] = await pool.query('SELECT permissions FROM organizations WHERE id = ?', [rows[0].org_id]);
            const orgPerms = Array.isArray(orgRows[0]?.permissions) ? orgRows[0].permissions : [];
            if (!orgPerms.includes(moduleKey)) {
              return res.status(403).json({ success: false, message: `Forbidden: your organization does not have access to '${moduleKey}'.` });
            }
          }
        }
        req.admin = { ...decoded, org_id: rows[0].org_id };
        return next();
      } catch (err) {
        console.error('requireAdminOrOrgAuth (staff) error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error checking permissions.' });
      }
    }

    if (decoded.role === 'organization') {
      try {
        const [orgRows] = await pool.query('SELECT permissions, status, registration_status FROM organizations WHERE id = ?', [decoded.id]);
        if (!orgRows.length || orgRows[0].status !== 'active' || orgRows[0].registration_status !== 'approved') {
          return res.status(403).json({ success: false, message: 'Your organization account is currently inactive. Please contact the administrator.' });
        }

        // JWTs are stateless (12h expiry) — re-checking org status above
        // covers deactivation, but a Super-Admin force-logout of one
        // specific session (see adminOrgController.js's forceLogoutOrgSession)
        // only closes that session's org_login_sessions row; it doesn't by
        // itself invalidate the still-valid token. axiosAdmin sends the
        // logged-in session's id as X-Session-Id on every request (see
        // axiosAdmin.js), so cross-checking it against an OPEN session row
        // here makes force-logout (and, incidentally, natural logout) take
        // effect on this session's very next API call — the practical
        // standard for revoking a stateless token without a separate
        // blocklist.
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) {
          return res.status(401).json({ success: false, message: 'Unauthorized: No session ID provided.' });
        }
        const [sessionRows] = await pool.query(
          "SELECT id FROM org_login_sessions WHERE id = ? AND org_id = ? AND status = 'success' AND logout_time IS NULL",
          [sessionId, decoded.id]
        );
        if (!sessionRows.length) {
          return res.status(401).json({ success: false, message: 'Unauthorized: Session expired. Please log in again.' });
        }
        if (moduleKey) {
          const perms = Array.isArray(orgRows[0].permissions) ? orgRows[0].permissions : [];
          if (!perms.includes(moduleKey)) {
            return res.status(403).json({ success: false, message: `Forbidden: no access to '${moduleKey}'.` });
          }
        }
        // req.org is what resolveOrgScope.js keys its org-scope branch on;
        // req.admin is ALSO set (redundantly) so generic role/id checks that
        // don't care which of the three identity types authenticated (e.g.
        // logoutAdmin) work without a third special case — resolveOrgScope's
        // admin/staff branches key on specific role string equality
        // ('admin'/'staff'), so 'organization' here never matches those and
        // still correctly falls through to its own req.org branch.
        req.org = decoded;
        req.admin = decoded;
        return next();
      } catch (err) {
        console.error('requireAdminOrOrgAuth (organization) error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error checking permissions.' });
      }
    }

    return res.status(403).json({ success: false, message: 'Forbidden.' });
  };
}

module.exports = requireAdminOrOrgAuth;
