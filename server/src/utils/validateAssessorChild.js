const { pool } = require('../config/db');

const NOT_ACTIVE_MESSAGE = 'This child is no longer active or available for assessment. Please select another child.';
const WRONG_ORG_MESSAGE = 'This child is not associated with your organization.';

// Shared eligibility check for the Assessor flow — Child Selection and
// Re-Validation Before Starting the Game both call this (see
// childController.js's lookupChild and sessionController.js's
// startSession). The final, most important checkpoint (score submission
// in gameController.js's updateGameSession) does its own inline re-check
// against live children.status rather than reusing this — that check must
// never trust anything cached, including this function's result from
// earlier in the flow.
//
// `assessorId` is optional — when provided, also enforces that an
// org-bound assessor can only work with children in their own
// organization. A NULL-org assessor (Super-Admin-managed/platform-wide) is
// unrestricted, matching the null-safe org-scoping convention used
// throughout this codebase (adminChildController.js's scopeClause, etc.).
async function checkChildEligibility(childId, assessorId = null) {
    const [childRows] = await pool.query(
        'SELECT child_id, name, status, org_id FROM children WHERE child_id = ?',
        [childId]
    );
    if (!childRows.length) {
        return { ok: false, code: 404, message: 'Child ID not found.' };
    }
    const child = childRows[0];

    if (child.status !== 'active') {
        return { ok: false, code: 403, message: NOT_ACTIVE_MESSAGE, child };
    }

    if (assessorId) {
        const [assessorRows] = await pool.query('SELECT org_id FROM assessors WHERE id = ?', [assessorId]);
        const assessorOrgId = assessorRows[0]?.org_id ?? null;
        if (assessorOrgId && assessorOrgId !== child.org_id) {
            return { ok: false, code: 403, message: WRONG_ORG_MESSAGE, child };
        }
    }

    return { ok: true, child };
}

module.exports = { checkChildEligibility, NOT_ACTIVE_MESSAGE, WRONG_ORG_MESSAGE };
