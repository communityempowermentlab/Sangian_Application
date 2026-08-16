const { pool } = require('../config/db');
const { normalizeGameName } = require('./gameNameAliases');

// Organization-wise Test Assignment — the shared enforcement primitive used
// by gameController.js (gameplay start, reports) and analysisController.js
// (analytics). Deliberately fail-OPEN: orgId === null/undefined (Super
// Admin, an org-unbound staff account, or an Individual — none of these are
// organizations) and an org whose `assigned_tests` column is NULL (never
// explicitly curated by a Super Admin) are both always unrestricted. Only a
// saved, non-null JSON array turns this into a real allow-list — see the
// `assigned_tests JSON NULL` migration comment in config/db.js for the full
// rationale (this default was chosen specifically so shipping this feature
// doesn't lock any existing organization out of tests it already had).

// Returns null (unrestricted) or string[] (explicit allow-list, possibly
// empty) of GAMES_REGISTRY keys assigned to this organization.
async function getOrgAssignedTests(orgId) {
    if (!orgId) return null;
    const [rows] = await pool.query('SELECT assigned_tests FROM organizations WHERE id = ?', [orgId]);
    const raw = rows[0]?.assigned_tests;
    return Array.isArray(raw) ? raw : null;
}

// Single-game gate — for starting a session, or any endpoint keyed to one
// specific game. gameKey is normalized before comparison so a legacy
// alt-spelling (e.g. "Bagiya") is correctly recognized against an
// assignment saved under its canonical key (e.g. "atlantis_bagiya").
async function isGameAssignedToOrg(orgId, gameKey) {
    const assignedTests = await getOrgAssignedTests(orgId);
    if (assignedTests === null) return { allowed: true, assignedTests: null };
    return { allowed: assignedTests.includes(normalizeGameName(gameKey)), assignedTests };
}

module.exports = { getOrgAssignedTests, isGameAssignedToOrg };
