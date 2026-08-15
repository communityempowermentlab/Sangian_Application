// Single resolved JWT secret for the whole app. adminAuth.js/adminController.js
// keep their own inline fallback ('sangian-super-secret-key-123') untouched —
// they're not modified as part of this change — but every NEW auth surface
// (Organization, Individual, OTP-verification tokens) reads from here so a
// third divergent fallback string doesn't get introduced. All resolve to the
// same process.env.JWT_SECRET when it's set.
const JWT_SECRET = process.env.JWT_SECRET || 'sangian-super-secret-key-123';

module.exports = JWT_SECRET;
