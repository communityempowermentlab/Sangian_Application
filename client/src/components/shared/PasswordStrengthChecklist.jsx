import React from 'react';

// Mirrors server/src/utils/passwordStrength.js's CRITERIA exactly — keep
// these two in sync if the policy ever changes.
export const PASSWORD_CRITERIA = [
    { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
    { key: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
    { key: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
    { key: 'digit', label: 'One number', test: (pw) => /[0-9]/.test(pw) },
    { key: 'special', label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const isStrongPassword = (pw) => PASSWORD_CRITERIA.every(c => c.test(pw || ''));

// Live checklist shown under a password field — only rendered once the
// field is non-empty, so it doesn't clutter an untouched form.
const PasswordStrengthChecklist = ({ password }) => {
    if (!password) return null;
    return (
        <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {PASSWORD_CRITERIA.map(c => {
                const pass = c.test(password);
                return (
                    <li key={c.key} style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: pass ? '#16a34a' : '#9ca3af' }}>
                        <span>{pass ? '✓' : '○'}</span> {c.label}
                    </li>
                );
            })}
        </ul>
    );
};

export default PasswordStrengthChecklist;
