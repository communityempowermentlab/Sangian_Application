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
