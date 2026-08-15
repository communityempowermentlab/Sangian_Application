const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwtSecret');

// Mirrors adminAuth.js's shape exactly, but for the Individual role only —
// kept as its own middleware (rather than folded into adminAuth.js) so that
// existing admin/staff-only routes are structurally guaranteed to keep
// rejecting Individual tokens: nothing changes about adminAuth.js at all.
const individualAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'individual') {
      return res.status(403).json({ success: false, message: 'Forbidden: Individual account required.' });
    }
    req.individual = decoded;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Unauthorized: Session expired. Please log in again.'
      : 'Unauthorized: Invalid token.';
    return res.status(401).json({ success: false, message });
  }
};

module.exports = individualAuth;
