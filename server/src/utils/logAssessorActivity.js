const { pool } = require('../config/db');
const requestIp = require('request-ip');
const { parseUserAgent, normalizeIp } = require('./parseUserAgent');

// Generalized activity logger for Assessor-related actions — one INSERT
// into assessor_activity_logs. Direct port of logOrgActivity.js's
// shape/capture logic, extended with actor_type/actor_id since an
// assessor's activity can be produced by the assessor account itself, or
// by an admin/org/staff account managing the assessor's record.
//
// `req` is required (not just an ip string) so ip/browser/os/device/session
// are captured the same way at every call site instead of each one
// re-deriving them; session_id falls back to the X-Session-Id header
// axiosAdmin attaches, so call sites don't need to thread it through
// explicitly.
async function logAssessorActivity({
    assessorId, assessorName, actorType = 'assessor', actorId = null, actorName = null,
    module, actionType, description, req,
    recordType = null, recordId = null, recordName = null,
    previousValue = null, newValue = null, metadata = null, sessionId = null,
    status = 'success', errorMessage = null,
}) {
    try {
        const ip = req ? normalizeIp(requestIp.getClientIp(req)) || null : null;
        const { browser, os, deviceType } = req ? parseUserAgent(req.headers['user-agent']) : { browser: null, os: null, deviceType: null };
        const resolvedSessionId = sessionId ?? (req?.headers['x-session-id'] ? Number(req.headers['x-session-id']) || null : null);

        await pool.query(
            `INSERT INTO assessor_activity_logs
             (assessor_id, assessor_name, actor_type, actor_id, actor_name, module, action_type, description,
              record_type, record_id, record_name, previous_value, new_value, metadata,
              ip_address, browser, os, device_type, session_id, status, error_message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [assessorId, assessorName || null, actorType, actorId, actorName,
             module, actionType, description || null,
             recordType, recordId != null ? String(recordId) : null, recordName,
             previousValue != null ? JSON.stringify(previousValue) : null,
             newValue != null ? JSON.stringify(newValue) : null,
             metadata != null ? JSON.stringify(metadata) : null,
             ip, browser, os, deviceType, resolvedSessionId, status, errorMessage || null]
        );
    } catch (err) {
        // Logging must never break the action it's describing.
        console.error('logAssessorActivity error:', err.message);
    }
}

module.exports = { logAssessorActivity };
