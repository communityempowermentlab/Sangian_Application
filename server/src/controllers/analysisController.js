const { pool } = require('../config/db');

const GAME_META = {
  literacy_reading_skill:   { title: 'Padh ke Batao',      tag: 'Literacy',         color: '#059669', maxScore: 22 },
  numeracy_number_skill:    { title: 'Ankganit',            tag: 'Numeracy',         color: '#7c3aed', maxScore: 26 },
  number_recall_lottery:    { title: 'Lottery Ka Ticket',  tag: 'Auditory Span',    color: '#f59e0b', maxScore: 20 },
  atlantis_bagiya:          { title: 'Bagiya',              tag: 'Visual Memory',    color: '#6366f1', maxScore: 13 },
  working_memory_herpher:   { title: 'Her Pher',            tag: 'Dynamic Memory',   color: '#0891b2', maxScore: 8  },
  auditory_dhyan:           { title: 'Dhyan Kahan Hai',    tag: 'Listening Focus',  color: '#8b5cf6', maxScore: 4  },
  triangle_rachna:          { title: 'Rachna',              tag: 'Spatial Reasoning',color: '#ef4444', maxScore: 48 },
  rover_mela:               { title: 'Chalo Mela Chalen',  tag: 'Spatial Planning', color: '#10b981', maxScore: 18 },
  cognitive_flex_chor:      { title: 'Chor Machaye Shor',  tag: 'Rule Switching',   color: '#dc2626', maxScore: 11 },
};

// Age group label → [minAge, maxAge] inclusive
const AGE_MAP = { '3-5': [3, 5], '6-8': [6, 8], '9-11': [9, 11], '12+': [12, 99] };

function parseFilters(req) {
  const { startDate, endDate, gender, status, ageGroup, childId, gameKey } = req.query;

  // Date clauses (on gs.created_at)
  const dateClauses = [], dateParams = [];
  if (startDate) { dateClauses.push('gs.created_at >= ?');          dateParams.push(startDate); }
  if (endDate)   { dateClauses.push('gs.created_at <= ?');          dateParams.push(`${endDate} 23:59:59`); }

  // Multi-value arrays from comma-separated query params
  const genders   = gender   ? gender.split(',').filter(Boolean)   : [];
  const statuses  = status   ? status.split(',').filter(Boolean)   : [];
  const ageGroups = ageGroup ? ageGroup.split(',').filter(Boolean) : [];
  const gameKeys  = gameKey  ? gameKey.split(',').filter(Boolean)  : [];

  const genderClauses = [], genderParams = [];
  if (genders.length === 1)    { genderClauses.push('c.gender = ?');    genderParams.push(genders[0]); }
  else if (genders.length > 1) { genderClauses.push('c.gender IN (?)'); genderParams.push(genders); }

  const statusClauses = [], statusParams = [];
  if (statuses.length === 1)    { statusClauses.push('gs.status = ?');     statusParams.push(statuses[0]); }
  else if (statuses.length > 1) { statusClauses.push('gs.status IN (?)'); statusParams.push(statuses); }

  // Age groups build a single OR condition — no extra params (values embedded as integers)
  const ageClauses = [];
  if (ageGroups.length > 0) {
    const conditions = ageGroups
      .map(ag => AGE_MAP[ag])
      .filter(Boolean)
      .map(([lo, hi]) => `TIMESTAMPDIFF(YEAR, c.dob, CURDATE()) BETWEEN ${lo} AND ${hi}`);
    if (conditions.length) ageClauses.push(`(${conditions.join(' OR ')})`);
  }

  // Child search (child_id exact OR name LIKE)
  const childClauses = [], childParams = [];
  if (childId && childId.trim()) {
    childClauses.push('(gs.child_id = ? OR c.name LIKE ?)');
    childParams.push(childId.trim(), `%${childId.trim()}%`);
  }

  // Game key filter (used in overview to focus on specific games)
  const gameClauses = [], gameParams = [];
  if (gameKeys.length === 1)    { gameClauses.push('gs.game_name = ?');    gameParams.push(gameKeys[0]); }
  else if (gameKeys.length > 1) { gameClauses.push('gs.game_name IN (?)'); gameParams.push(gameKeys); }

  const allClauses     = [...dateClauses, ...genderClauses, ...statusClauses, ...ageClauses, ...childClauses, ...gameClauses];
  const allParams      = [...dateParams,  ...genderParams,  ...statusParams,                ...childParams,  ...gameParams];

  // For gender distribution: skip gender filter so all genders are visible
  const noGenderClauses = [...dateClauses, ...statusClauses, ...ageClauses, ...childClauses, ...gameClauses];
  const noGenderParams  = [...dateParams,  ...statusParams,                 ...childParams,  ...gameParams];

  const needsChildJoin = genders.length > 0 || ageGroups.length > 0 || !!childId?.trim();

  return { allClauses, allParams, noGenderClauses, noGenderParams, needsChildJoin };
}

function toWhere(clauses) {
  return clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
}

// Always LEFT JOIN — gender/age filters on c.* columns naturally exclude unmatched rows
const CHILD_JOIN = 'LEFT JOIN children c ON gs.child_id = c.child_id';

// ── GET /api/analysis/meta ──────────────────────────────────────────────────
exports.getMeta = async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT
        DATE_FORMAT(MIN(start_time), '%Y-%m-%d')  AS minDate,
        DATE_FORMAT(CURDATE(),       '%Y-%m-%d')  AS today,
        COUNT(*)                                   AS totalSessions
      FROM game_sessions
      WHERE start_time IS NOT NULL
    `);
    res.json(row || { minDate: null, today: new Date().toISOString().slice(0, 10), totalSessions: 0 });
  } catch (err) {
    console.error('Analysis meta error:', err);
    res.status(500).json({ error: 'Failed to load meta' });
  }
};

// ── GET /api/analysis/overview ────────────────────────────────────────────────
exports.getOverview = async (req, res) => {
  try {
    const { allClauses, allParams, noGenderClauses, noGenderParams } = parseFilters(req);
    const where        = toWhere(allClauses);
    const noGenderWhere = toWhere(noGenderClauses);

    // Platform KPIs
    const [[kpis]] = await pool.query(`
      SELECT
        COUNT(*)                                                       AS totalSessions,
        COUNT(DISTINCT gs.child_id)                                    AS uniqueChildren,
        CAST(SUM(gs.status = 'completed') AS UNSIGNED)                AS completedSessions,
        CAST(SUM(gs.status IN ('quit','dropped')) AS UNSIGNED)        AS droppedSessions,
        ROUND(AVG(gs.score), 1)                                        AS avgScore,
        ROUND(AVG(TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time)) / 60, 1) AS avgDurationMins,
        ROUND(SUM(gs.status = 'completed') / NULLIF(COUNT(*),0) * 100, 0) AS completionRate
      FROM game_sessions gs ${CHILD_JOIN} ${where}
    `, allParams);

    // Per-game breakdown
    const [byGame] = await pool.query(`
      SELECT
        gs.game_name                                                    AS gameKey,
        COUNT(*)                                                        AS sessions,
        COUNT(DISTINCT gs.child_id)                                     AS children,
        CAST(SUM(gs.status = 'completed') AS UNSIGNED)                 AS completed,
        CAST(SUM(gs.status IN ('quit','dropped')) AS UNSIGNED)         AS dropped,
        ROUND(AVG(gs.score), 1)                                         AS avgScore,
        ROUND(AVG(TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time)) / 60, 1) AS avgDurationMins
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      GROUP BY gs.game_name
      ORDER BY sessions DESC
    `, allParams);

    // Daily trend — scoped to filter range or last 30 days
    const trendClauses = [...allClauses, 'gs.start_time IS NOT NULL'];
    const trendParams  = [...allParams];
    if (!allClauses.some(c => c.includes('created_at'))) {
      trendClauses.unshift('gs.start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
    }
    const [dailyTrend] = await pool.query(`
      SELECT
        DATE_FORMAT(gs.start_time, '%Y-%m-%d')         AS date,
        COUNT(*)                                        AS sessions,
        CAST(SUM(gs.status = 'completed') AS UNSIGNED) AS completed
      FROM game_sessions gs ${CHILD_JOIN}
      WHERE ${trendClauses.join(' AND ')}
      GROUP BY DATE_FORMAT(gs.start_time, '%Y-%m-%d')
      ORDER BY date ASC
    `, trendParams);

    // Status distribution
    const [statusDist] = await pool.query(`
      SELECT gs.status, COUNT(*) AS count
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      GROUP BY gs.status
    `, allParams);

    // Gender distribution — no gender filter so all genders appear
    const [genderDist] = await pool.query(`
      SELECT COALESCE(c.gender, 'unknown') AS gender,
             COUNT(DISTINCT gs.child_id)   AS children
      FROM game_sessions gs ${CHILD_JOIN} ${noGenderWhere}
      GROUP BY c.gender
    `, noGenderParams);

    // Top 10 active children
    const [topChildren] = await pool.query(`
      SELECT gs.child_id, c.name,
             COUNT(*)                                  AS sessions,
             CAST(SUM(gs.status = 'completed') AS UNSIGNED) AS completed,
             ROUND(AVG(gs.score), 1)                   AS avgScore,
             DATE_FORMAT(MAX(gs.created_at), '%Y-%m-%d') AS lastPlayed
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      GROUP BY gs.child_id, c.name
      ORDER BY sessions DESC LIMIT 10
    `, allParams);

    const byGameEnriched = byGame.map(row => ({
      ...row,
      ...(GAME_META[row.gameKey] || {}),
      completionRate: row.sessions > 0 ? Math.round((row.completed / row.sessions) * 100) : 0,
    }));

    res.json({
      kpis: { ...kpis, completionRate: Number(kpis.completionRate) || 0 },
      byGame: byGameEnriched,
      dailyTrend,
      statusDist,
      genderDist,
      topChildren,
    });
  } catch (err) {
    console.error('Analysis overview error:', err);
    res.status(500).json({ error: 'Failed to load overview analytics' });
  }
};

// ── GET /api/analysis/game/:gameKey ──────────────────────────────────────────
exports.getGameAnalytics = async (req, res) => {
  try {
    const { gameKey } = req.params;
    const { allClauses, allParams } = parseFilters(req);
    const meta = GAME_META[gameKey] || { title: gameKey, maxScore: 100 };

    // Add game key filter on top of any existing filters
    const clauses = [...allClauses, 'gs.game_name = ?'];
    const params  = [...allParams, gameKey];
    const where   = toWhere(clauses);

    // KPIs
    const [[kpis]] = await pool.query(`
      SELECT
        COUNT(*)                                                             AS totalSessions,
        COUNT(DISTINCT gs.child_id)                                          AS uniqueChildren,
        CAST(SUM(gs.status = 'completed') AS UNSIGNED)                      AS completedSessions,
        CAST(SUM(gs.status IN ('quit','dropped')) AS UNSIGNED)              AS droppedSessions,
        ROUND(AVG(gs.score), 2)                                              AS avgScore,
        MAX(gs.score)                                                        AS maxScoreAchieved,
        ROUND(AVG(TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time)) / 60, 2) AS avgDurationMins,
        ROUND(SUM(gs.status='completed') / NULLIF(COUNT(*),0) * 100, 1)    AS completionRate
      FROM game_sessions gs ${CHILD_JOIN} ${where}
    `, params);

    // Score distribution — 5 equal buckets (completed sessions only)
    const bucketSize  = Math.ceil(meta.maxScore / 5);
    const bucketCases = Array.from({ length: 5 }, (_, i) => {
      const lo = i * bucketSize;
      const hi = Math.min((i + 1) * bucketSize - 1, meta.maxScore);
      return `CAST(SUM(gs.score BETWEEN ${lo} AND ${hi}) AS UNSIGNED) AS \`${lo}-${hi}\``;
    }).join(', ');

    const completedWhere = toWhere([...clauses, "gs.status = 'completed'"]);
    const [[scoreDist]]  = await pool.query(`
      SELECT ${bucketCases}
      FROM game_sessions gs ${CHILD_JOIN} ${completedWhere}
    `, params);

    // Quit reasons
    const qrWhere = toWhere([...clauses, "gs.quit_reason IS NOT NULL AND gs.quit_reason != ''"]);
    const [quitReasons] = await pool.query(`
      SELECT gs.quit_reason, COUNT(*) AS count
      FROM game_sessions gs ${CHILD_JOIN} ${qrWhere}
      GROUP BY gs.quit_reason ORDER BY count DESC
    `, params);

    // Gender breakdown
    const [genderBreakdown] = await pool.query(`
      SELECT COALESCE(c.gender, 'unknown')           AS gender,
             COUNT(*)                                AS sessions,
             ROUND(AVG(gs.score), 1)                AS avgScore,
             CAST(SUM(gs.status='completed') AS UNSIGNED) AS completed
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      GROUP BY c.gender
    `, params);

    // Daily trend
    const trendClauses = [...clauses, 'gs.start_time IS NOT NULL'];
    const trendParams  = [...params];
    if (!clauses.some(c => c.includes('created_at'))) {
      trendClauses.unshift('gs.start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
    }
    const [dailyTrend] = await pool.query(`
      SELECT DATE_FORMAT(gs.start_time, '%Y-%m-%d')         AS date,
             COUNT(*)                                        AS sessions,
             CAST(SUM(gs.status='completed') AS UNSIGNED)   AS completed,
             ROUND(AVG(gs.score), 1)                        AS avgScore
      FROM game_sessions gs ${CHILD_JOIN}
      WHERE ${trendClauses.join(' AND ')}
      GROUP BY DATE_FORMAT(gs.start_time, '%Y-%m-%d')
      ORDER BY date ASC
    `, trendParams);

    // Assessment distributions
    const [assessRows] = await pool.query(`
      SELECT ga.q1_enjoyment, ga.q2_feeling, ga.q3_tiredness,
             ga.q4_play_again, ga.q5_behaviors
      FROM game_assessments ga
      INNER JOIN game_sessions gs ON ga.session_id = gs.id
      ${CHILD_JOIN} ${where}
    `, params);

    const q1Dist = {}, q2Dist = {}, q3Dist = {}, q4Dist = {}, behaviorFreq = {};
    for (const a of assessRows) {
      if (a.q1_enjoyment)  q1Dist[a.q1_enjoyment]  = (q1Dist[a.q1_enjoyment]  || 0) + 1;
      if (a.q2_feeling)    q2Dist[a.q2_feeling]    = (q2Dist[a.q2_feeling]    || 0) + 1;
      if (a.q3_tiredness)  q3Dist[a.q3_tiredness]  = (q3Dist[a.q3_tiredness]  || 0) + 1;
      if (a.q4_play_again) q4Dist[a.q4_play_again] = (q4Dist[a.q4_play_again] || 0) + 1;
      if (a.q5_behaviors) {
        let b = a.q5_behaviors;
        if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = []; } }
        if (Array.isArray(b)) b.forEach(tag => { behaviorFreq[tag] = (behaviorFreq[tag] || 0) + 1; });
      }
    }

    // Attempt patterns — using gs.child_id to avoid ambiguity
    const [attemptData] = await pool.query(`
      SELECT gs.child_id, COUNT(*) AS attempts
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      GROUP BY gs.child_id
    `, params);
    const attemptBuckets = { '1': 0, '2': 0, '3-5': 0, '6-10': 0, '10+': 0 };
    for (const { attempts } of attemptData) {
      if      (attempts === 1) attemptBuckets['1']++;
      else if (attempts === 2) attemptBuckets['2']++;
      else if (attempts <= 5)  attemptBuckets['3-5']++;
      else if (attempts <= 10) attemptBuckets['6-10']++;
      else                     attemptBuckets['10+']++;
    }

    // Recent 20 sessions
    const [recentSessions] = await pool.query(`
      SELECT gs.id, gs.child_id, c.name AS childName,
             gs.score, gs.total_questions, gs.progress_level, gs.status, gs.quit_reason,
             DATE_FORMAT(gs.start_time, '%Y-%m-%d %H:%i') AS start_time,
             DATE_FORMAT(gs.end_time,   '%Y-%m-%d %H:%i') AS end_time,
             TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time) AS durationSec
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      ORDER BY gs.created_at DESC LIMIT 20
    `, params);

    res.json({
      meta,
      kpis: {
        ...kpis,
        completionRate:  Number(kpis.completionRate)  || 0,
        avgScorePct:     meta.maxScore > 0 ? Math.round((Number(kpis.avgScore) / meta.maxScore) * 100) : 0,
        avgScore:        Number(kpis.avgScore)        || 0,
        avgDurationMins: Number(kpis.avgDurationMins) || 0,
      },
      scoreDist,
      quitReasons,
      genderBreakdown,
      dailyTrend,
      assessmentDist: { q1: q1Dist, q2: q2Dist, q3: q3Dist, q4: q4Dist },
      behaviorFreq,
      attemptBuckets,
      recentSessions,
    });
  } catch (err) {
    console.error('Game analytics error:', err);
    res.status(500).json({ error: 'Failed to load game analytics' });
  }
};
