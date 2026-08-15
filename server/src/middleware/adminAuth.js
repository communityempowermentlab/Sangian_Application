const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'sangian-super-secret-key-123';

const adminAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // 'staff' is a second, restricted login identity (Staff Management
        // module) — accepted here so staff share the same auth pipeline as
        // admins, but staff get NO elevated access from this alone: every
        // existing route this guards was already admin-only, and per-module
        // access for staff is enforced separately by requireModuleAccess.
        //
        // Deliberately NOT widened to accept 'organization' — this function
        // also gates many misc routes (SMTP settings, tickets, contact
        // management, self-profile, ...) that only check adminAuth directly,
        // with no per-module gate at all. Widening it here would silently
        // open every one of those to org tokens too. An organization only
        // ever authenticates through requireAdminOrOrgAuth.js (its own
        // independent JWT verification + module×action check), used solely
        // on the specific routes deliberately upgraded for org access —
        // same "new sibling middleware, don't touch the shared one"
        // principle the whole multi-tenant build follows.
        if (decoded.role !== 'admin' && decoded.role !== 'staff') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
        }

        req.admin = decoded;
        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError'
            ? 'Unauthorized: Session expired. Please log in again.'
            : 'Unauthorized: Invalid token.';
        return res.status(401).json({ success: false, message });
    }
};

module.exports = adminAuth;
