// Canonical list of grantable menus — mirrors AdminLayout.jsx's nav exactly
// (keys match what requireModuleAccess checks server-side), used by the
// Add/Edit Staff permission checklist so it can never drift from what's
// actually gated.
export const ADMIN_MODULES = [
    { key: 'dashboard',     label: 'Dashboard' },
    { key: 'children',      label: 'Children' },
    { key: 'assessors',     label: 'Assessors' },
    { key: 'child-groups',  label: 'Child Groups' },
    { key: 'reports',       label: 'Reports' },
    { key: 'analysis',      label: 'Analysis' },
    { key: 'docs',          label: 'Docs' },
    { key: 'meta',          label: 'Meta' },
    { key: 'help-support',  label: 'Support' },
    { key: 'multilingual',  label: 'Multilingual' },
    { key: 'elements',      label: 'Elements' },
    { key: 'staff',         label: 'Staff' },
    { key: 'settings',      label: 'Settings' },
];

// Reads the current session's Staff Management module grants.
// Admin logins explicitly clear this key (see AdminLogin.jsx), so `null`
// means "unrestricted" (admin) and an array means "staff, filtered to
// exactly these module keys". This is a UX convenience only — the real
// enforcement boundary is server-side (requireModuleAccess middleware);
// hiding a link here can never expose data a denied API call wouldn't.
export const getStaffPermissions = () => {
    try {
        const raw = localStorage.getItem('staffPermissions');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const isStaffSession = () => getStaffPermissions() !== null;

export const canSeeModule = (moduleKey) => {
    const perms = getStaffPermissions();
    if (perms === null) return true; // admin — unrestricted
    return perms.includes(moduleKey);
};
