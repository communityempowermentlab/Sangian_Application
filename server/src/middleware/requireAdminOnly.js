const adminAuth = require('./adminAuth');

// Stricter than requireModuleAccess — rejects role==='staff' outright, even
// with the 'staff' module grant. Used for the Log History pages (Login
// History + Activity History): staff must never see their own or anyone
// else's activity trail, so this isn't a grantable permission like the
// other menus, it's a hard role check.
function requireAdminOnly(req, res, next) {
    adminAuth(req, res, () => {
        if (req.admin.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: administrator access required.' });
        }
        next();
    });
}

module.exports = requireAdminOnly;
