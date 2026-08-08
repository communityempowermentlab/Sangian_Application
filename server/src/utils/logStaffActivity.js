const { pool } = require('../config/db');
const requestIp = require('request-ip');
const { parseUserAgent, normalizeIp } = require('./parseUserAgent');

// Generalized activity logger for the Staff Management module — one INSERT
// into staff_activity_logs. Mirrors child_profile_edit_logs' actor-capture
// convention (denormalized name alongside the FK, server-captured IP) but
// generalized to module/action/description instead of field-diff specific,
// since staff actions aren't all "edited field X on record Y".
//
// Deliberately NOT wired into any existing controller (children, assessors,
// reports, etc.) in this pass — only the new staff module's own actions
// call this today. Exported so other modules can adopt it incrementally
// later without needing to touch this file.
//
// `req` is required (not just an ip string) so ip/browser/os/device/session
// are captured the same way at every call site instead of each one
// re-deriving them; session_id falls back to the X-Session-Id header
// axiosAdmin attaches from the logged-in-in adminSessionId, so call sites
// don't need to thread it through explicitly.
//
// `metadata` is a free-form object for whatever detail is specific to this
// action type (e.g. { previous, updated } for an edit, or
// { reportType, format, filters, dateRange } for a report download) —
// one flexible JSON column instead of a narrow column per feature.
async function logStaffActivity({ staffId, staffName, module, actionType, description, req, menuName = null, pageName = null, recordId = null, recordName = null, metadata = null, sessionId = null }) {
    try {
        const ip = req ? normalizeIp(requestIp.getClientIp(req)) || null : null;
        const { browser, os, deviceType } = req ? parseUserAgent(req.headers['user-agent']) : { browser: null, os: null, deviceType: null };
        const resolvedSessionId = sessionId ?? (req?.headers['x-session-id'] ? Number(req.headers['x-session-id']) || null : null);

        await pool.query(
            `INSERT INTO staff_activity_logs
             (staff_id, staff_name, module, action_type, description, menu_name, page_name, record_id, record_name, metadata, ip_address, browser, os, device_type, session_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [staffId ?? null, staffName || null, module, actionType, description || null,
             menuName, pageName, recordId != null ? String(recordId) : null, recordName,
             metadata != null ? JSON.stringify(metadata) : null,
             ip, browser, os, deviceType, resolvedSessionId]
        );
    } catch (err) {
        // Logging must never break the action it's describing.
        console.error('logStaffActivity error:', err.message);
    }
}

module.exports = { logStaffActivity };
