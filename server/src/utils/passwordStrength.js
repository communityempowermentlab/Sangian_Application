// Strong-password policy for public-facing registration (Individual/
// Organization) — stricter than Staff Management's isPasswordStrong()
// (staffController.js: 8+ chars, letter+number only), since this form is
// reachable by anyone on the internet, not just admin-created internal
// accounts. Requires 8+ chars, upper, lower, digit, and a special char.
const PASSWORD_MIN_LEN = 8;

const CRITERIA = [
  { key: 'length', label: `At least ${PASSWORD_MIN_LEN} characters`, test: (pw) => pw.length >= PASSWORD_MIN_LEN },
  { key: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'digit', label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { key: 'special', label: 'One special character (e.g. ! @ # $ %)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function isStrongPassword(pw) {
  return typeof pw === 'string' && CRITERIA.every(c => c.test(pw));
}

const PASSWORD_REQUIREMENTS_MESSAGE =
  `Password must be at least ${PASSWORD_MIN_LEN} characters and include an uppercase letter, a lowercase letter, a number, and a special character.`;

module.exports = { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE, PASSWORD_MIN_LEN, CRITERIA };
