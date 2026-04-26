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

        if (decoded.role !== 'admin') {
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
