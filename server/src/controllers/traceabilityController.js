const { pool } = require('../config/db');

// Minimal read surface for the Organization -> Supervisor/Staff/Volunteer ->
// Child -> Assessment -> Game Result traceability chain — the concrete
// verification/demo endpoint for Phase F. A fuller Reports UI on top of
// this data is a reasonable follow-on, not required here.
//
// @route GET /api/admin/reports/assessment-trail?org_id=&child_id=
exports.getAssessmentTrail = async (req, res) => {
  try {
    const { orgScope } = req;
    const where = [];
    const params = [];

    if (!orgScope.isSuperAdmin) {
      where.push('a.org_id <=> ?');
      params.push(orgScope.orgId);
    } else if (req.query.org_id) {
      where.push('a.org_id = ?');
      params.push(req.query.org_id);
    }
    if (req.query.child_id) {
      where.push('a.child_id = ?');
      params.push(req.query.child_id);
    }
    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [sessions] = await pool.query(
      `SELECT a.id AS assessment_session_id, a.org_id, a.child_id, a.conducted_by_role,
              a.staff_id, a.supervisor_id, a.volunteer_id, a.status AS assessment_status,
              a.started_at, a.ended_at, a.device_type, a.browser, a.os, a.ip_address,
              org.org_name, c.name AS child_name,
              st.name AS staff_name, sup.name AS supervisor_name, vol.name AS volunteer_name
       FROM assessment_sessions a
       LEFT JOIN organizations org ON org.id = a.org_id
       LEFT JOIN children c ON c.child_id = a.child_id
       LEFT JOIN staff st ON st.id = a.staff_id
       LEFT JOIN supervisors sup ON sup.id = a.supervisor_id
       LEFT JOIN volunteers vol ON vol.id = a.volunteer_id
       ${whereStr}
       ORDER BY a.started_at DESC
       LIMIT 100`,
      params
    );

    if (!sessions.length) return res.json({ success: true, trail: [] });

    const sessionIds = sessions.map(s => s.assessment_session_id);
    const placeholders = sessionIds.map(() => '?').join(',');
    const [gameSessions] = await pool.query(
      `SELECT gs.id, gs.assessment_session_id, gs.game_name, gs.status, gs.score, gs.start_time, gs.end_time,
              gs.device_type, gs.browser, gs.os, gs.ip_address,
              (SELECT ga.id FROM game_assessments ga WHERE ga.session_id = gs.id LIMIT 1) AS questionnaire_id
       FROM game_sessions gs
       WHERE gs.assessment_session_id IN (${placeholders})`,
      sessionIds
    );

    const trail = sessions.map(s => ({
      ...s,
      game_results: gameSessions.filter(g => g.assessment_session_id === s.assessment_session_id),
    }));

    res.json({ success: true, trail });
  } catch (error) {
    console.error('getAssessmentTrail error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching assessment trail.' });
  }
};
