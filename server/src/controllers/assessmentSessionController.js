const { pool } = require('../config/db');
const requestIp = require('request-ip');
const { parseUserAgent, normalizeIp } = require('../utils/parseUserAgent');

// assessment_sessions is the traceability "Assessment" entity linking an
// Organization/Supervisor/Staff/Volunteer to a child's game-play — distinct
// from game_assessments (the post-game "how did you feel" questionnaire).
// Reachable by the same identities as children (requireAdminOrOrgAuth
// ('children') + resolveOrgScope on the routes — see assessmentSessionRoutes
// mounted in gameRoutes.js), since starting an assessment session is a
// children-adjacent action.

// @desc  Start an assessment session for a child — the entry point for the
//        Child Selected -> Supervisor/Staff/Volunteer Selected -> Assessment
//        Started flow. org_id is always resolved from the CHILD's own
//        record server-side, never trusted from the client.
// @route POST /api/games/assessment-sessions
exports.startAssessmentSession = async (req, res) => {
  try {
    const { orgScope } = req;
    const { child_id, conducted_by_role, staff_id, supervisor_id, volunteer_id } = req.body;

    if (!child_id) return res.status(400).json({ success: false, message: 'child_id is required.' });
    const role = ['staff', 'supervisor', 'volunteer', 'self'].includes(conducted_by_role) ? conducted_by_role : 'self';

    const scopeWhere = ['child_id = ?'];
    const scopeParams = [child_id];
    if (!orgScope.isSuperAdmin) { scopeWhere.push('org_id = ?'); scopeParams.push(orgScope.orgId); }
    const [childRows] = await pool.query(`SELECT org_id FROM children WHERE ${scopeWhere.join(' AND ')}`, scopeParams);
    if (!childRows.length) return res.status(404).json({ success: false, message: 'Child not found.' });
    const childOrgId = childRows[0].org_id;

    // Validate the conducting role's id (if given) actually belongs to the
    // same organization as the child.
    if (role === 'staff' && staff_id) {
      const [rows] = await pool.query('SELECT id FROM staff WHERE id = ? AND (org_id <=> ?)', [staff_id, childOrgId]);
      if (!rows.length) return res.status(400).json({ success: false, message: 'The selected staff member does not belong to this child\'s organization.' });
    }
    if (role === 'supervisor' && supervisor_id) {
      const [rows] = await pool.query('SELECT id FROM supervisors WHERE id = ? AND org_id <=> ?', [supervisor_id, childOrgId]);
      if (!rows.length) return res.status(400).json({ success: false, message: 'The selected supervisor does not belong to this child\'s organization.' });
    }
    if (role === 'volunteer' && volunteer_id) {
      const [rows] = await pool.query('SELECT id FROM volunteers WHERE id = ? AND org_id <=> ?', [volunteer_id, childOrgId]);
      if (!rows.length) return res.status(400).json({ success: false, message: 'The selected volunteer does not belong to this child\'s organization.' });
    }

    const userAgent = req.headers['user-agent'];
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const ip = normalizeIp(requestIp.getClientIp(req)) || 'Unknown';

    const [result] = await pool.query(
      `INSERT INTO assessment_sessions
        (org_id, child_id, conducted_by_role, staff_id, supervisor_id, volunteer_id, status, device_type, browser, os, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?)`,
      [childOrgId, child_id, role, staff_id || null, supervisor_id || null, volunteer_id || null, deviceType, browser, os, ip]
    );

    res.status(201).json({ success: true, assessmentSessionId: result.insertId });
  } catch (error) {
    console.error('startAssessmentSession error:', error);
    res.status(500).json({ success: false, message: 'Server error starting assessment session.' });
  }
};

// @desc  Mark an assessment session ended (completed/abandoned).
// @route PUT /api/games/assessment-sessions/:id/end
// @access Public (child-facing — reached at the end of the child's play
//         session, which has no auth of its own, matching every other
//         child game-session endpoint on this router).
exports.endAssessmentSession = async (req, res) => {
  try {
    const status = ['completed', 'abandoned'].includes(req.body.status) ? req.body.status : 'completed';
    const [result] = await pool.query(
      `UPDATE assessment_sessions SET status = ?, ended_at = NOW() WHERE id = ? AND status = 'in_progress'`,
      [status, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Assessment session not found or already ended.' });
    res.json({ success: true });
  } catch (error) {
    console.error('endAssessmentSession error:', error);
    res.status(500).json({ success: false, message: 'Server error ending assessment session.' });
  }
};

// @route GET /api/games/assessment-sessions/:id
exports.getAssessmentSessionById = async (req, res) => {
  try {
    const { orgScope } = req;
    const where = ['a.id = ?'];
    const params = [req.params.id];
    if (!orgScope.isSuperAdmin) { where.push('a.org_id <=> ?'); params.push(orgScope.orgId); }

    const [rows] = await pool.query(
      `SELECT a.*, c.name AS child_name FROM assessment_sessions a JOIN children c ON c.child_id = a.child_id WHERE ${where.join(' AND ')}`,
      params
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Assessment session not found.' });
    res.json({ success: true, assessmentSession: rows[0] });
  } catch (error) {
    console.error('getAssessmentSessionById error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching assessment session.' });
  }
};
