const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwtSecret');

// Mirrors individualAuth.js's shape exactly, but for the Assessor role only
// — gates /children/lookup/:childId and /sessions/start/fail (the
// "search child" step at /login) behind an authenticated assessor session.
const assessorAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'assessor') {
      return res.status(403).json({ success: false, message: 'Forbidden: Assessor account required.' });
    }
    req.assessor = decoded;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Unauthorized: Session expired. Please log in again.'
      : 'Unauthorized: Invalid token.';
    return res.status(401).json({ success: false, message });
  }
};

module.exports = assessorAuth;
