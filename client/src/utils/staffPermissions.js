// Canonical list of grantable menus — mirrors AdminLayout.jsx's nav exactly
// (keys match what requireModuleAccess checks server-side), used by the
// Add/Edit Staff permission checklist so it can never drift from what's
// actually gated.
//
// 'organizations'/'individuals' are checklist-only for parity with the
// Organization Permissions page (AdminOrganizationDetail.jsx) — both are
// hard-locked to Super Admin at the nav (AdminLayout.jsx checks
// isStaffSession() directly, not this grant) and the API (requireAdminOnly),
// so granting them to a staff account has no functional effect.
// Meta, Support, Multilingual, Elements, and Settings are deliberately
// excluded — those menus are Super-Admin-only and can never be granted to
// a staff account (server-side whitelist in staffController.js's
// normalizePermissions enforces the same restriction, so this isn't just
// a UI hide).
export const ADMIN_MODULES = [
    { key: 'dashboard',     label: 'Dashboard' },
    { key: 'organizations', label: 'Organizations' },
    { key: 'children',      label: 'Children' },
    { key: 'assessors',     label: 'Assessors' },
    { key: 'child-groups',  label: 'Child Groups' },
    { key: 'staff',         label: 'Staff' },
    { key: 'individuals',   label: 'Individuals' },
    { key: 'reports',       label: 'Reports' },
    { key: 'analysis',      label: 'Analysis' },
    { key: 'docs',          label: 'Docs' },
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

// Reads the current session's Organization module grants — a flat array of
// module keys, same shape as staff.permissions, set on login by
// AdminLogin.jsx from organizations.permissions (see
// requireAdminOrOrgAuth.js). `null` means "not an org session". Checking a
// module grants full (view/add/edit/delete/...) access to it — there is no
// per-action grant.
export const getOrgPermissions = () => {
    try {
        const raw = localStorage.getItem('orgPermissions');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const isOrgSession = () => getOrgPermissions() !== null;

// Organization-wise Test Assignment — set on login (AdminLogin.jsx) for
// both org sessions and org-bound staff sessions alike. `null` means
// unrestricted (Super Admin, org-unbound staff, or an org that's never
// been curated) — every game shows, exactly as before this feature. A
// non-null array is a real allow-list. UX filtering only, same caveat as
// canSeeModule above — the actual enforcement is server-side and
// re-checked fresh on every request regardless of this cached value.
export const getAssignedTests = () => {
    try {
        const raw = localStorage.getItem('assignedTests');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

// Nav/UX gating only — same caveat as canSeeModule: the real boundary is
// the server-side requireAdminOrOrgAuth(moduleKey) check.
export const canSeeModule = (moduleKey) => {
    const staffPerms = getStaffPermissions();
    if (staffPerms !== null) return staffPerms.includes(moduleKey);

    const orgPerms = getOrgPermissions();
    if (orgPerms !== null) return orgPerms.includes(moduleKey);

    return true; // admin — unrestricted
};

// Action-level UI gating (e.g. hide/disable an Add or Delete button the
// caller wasn't granted). Every role's permission model is flat/all-or-
// nothing — once a session can see a module it can perform every action
// within it — so this is equivalent to canSeeModule; kept as a separate,
// differently-named export so call sites that are specifically checking an
// action stay self-documenting.
export const canPerform = (moduleKey, _action) => canSeeModule(moduleKey);
