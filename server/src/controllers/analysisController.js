const { pool } = require('../config/db');
const { normalizeGameName } = require('../utils/gameNameAliases');
const { isGameAssignedToOrg, getOrgAssignedTests } = require('../utils/assignedTestsGuard');

const GAME_META = {
  literacy_reading_skill:   { title: 'Padh ke Batao - V0', tag: 'Literacy',         color: '#059669', maxScore: 22 },
  literacy_reading_skill_v2: { title: 'Padh ke Batao',     tag: 'Literacy',         color: '#059669', maxScore: 4 },
  numeracy_number_skill:    { title: 'Ankganit - V0',       tag: 'Numeracy',         color: '#7c3aed', maxScore: 26 },
  number_recall_lottery:    { title: 'Lottery Ka Ticket',  tag: 'Auditory Span',    color: '#f59e0b', maxScore: 22 },
  number_recall_lottery_v2: { title: 'Lottery Ka Ticket - Version 2', tag: 'Auditory Span', color: '#f59e0b', maxScore: 22 },
  numeracy_number_skill_v2: { title: 'Ankganit - V1',       tag: 'Numeracy',       color: '#7c3aed', maxScore: 30 },
  numeracy_number_skill_v3: { title: 'Ankganit',            tag: 'Numeracy',       color: '#7c3aed', maxScore: 4 },
  atlantis_bagiya:          { title: 'Bagiya',              tag: 'Visual Memory',    color: '#6366f1', maxScore: 108 },
  working_memory_herpher:   { title: 'Her Pher - V0',       tag: 'Dynamic Memory',   color: '#0891b2', maxScore: 25 },
  working_memory_herpher_v2:   { title: 'Her Pher - V1',   tag: 'Dynamic Memory',   color: '#0891b2', maxScore: 16 },
  working_memory_herpher_v3:   { title: 'Her Pher',        tag: 'Dynamic Memory',   color: '#0891b2', maxScore: 25 },
  auditory_dhyan:           { title: 'Dhyan Kahan Hai',    tag: 'Listening Focus',  color: '#8b5cf6', maxScore: 33 },
  triangle_rachna:          { title: 'Rachna',              tag: 'Spatial Reasoning',color: '#ef4444', maxScore: 48 },
  rover_mela:               { title: 'Chalo Mela Chalen',  tag: 'Spatial Planning', color: '#10b981', maxScore: 44 },
  cognitive_flex_chor:      { title: 'Chor Machaye Shor',  tag: 'Rule Switching',   color: '#dc2626', maxScore: 57 },
};

// Score-distribution buckets for games whose scoring rubric doesn't map cleanly
// onto 5 equal-width buckets (e.g. Padh ke Batao's 0-22 reading levels). Games
// not listed here fall back to the generic 5-equal-bucket split below.
const CUSTOM_SCORE_BUCKETS = {
  literacy_reading_skill: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 10 },
    { lo: 11, hi: 18 },
    { lo: 19, hi: 20 },
    { lo: 21, hi: 21 },
    { lo: 22, hi: null }, // open-ended — catches any score at/above the max
  ],
  // ASER adaptive flow: score is an ordinal reading level, not a point count —
  // one discrete bucket per level (0=Beginner, 1=Letter, 2=Word, 3=Paragraph, 4=Story).
  literacy_reading_skill_v2: [
    { lo: 0, hi: 0,    label: 'Beginner',  description: 'Unable to identify letters consistently.' },
    { lo: 1, hi: 1,    label: 'Letters',   description: 'Can recognize and read individual letters.' },
    { lo: 2, hi: 2,    label: 'Words',     description: 'Can read simple words accurately.' },
    { lo: 3, hi: 3,    label: 'Paragraph', description: 'Can read a short paragraph with understanding.' },
    { lo: 4, hi: null, label: 'Story',     description: 'Can read a complete story fluently and accurately.' }, // open-ended — catches any score at/above the max
  ],
  numeracy_number_skill_v2: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 8 },
    { lo: 9,  hi: 18 },
    { lo: 19, hi: 26 },
    { lo: 27, hi: null }, // open-ended — catches any score at/above the max (30)
  ],
  // ASER adaptive flow: score is an ordinal outcome level, not a point count —
  // one discrete bucket per level (0=Beginner .. 4=Division).
  numeracy_number_skill_v3: [
    { lo: 0, hi: 0,    label: 'Beginner',                  description: 'Could not correctly identify at least 4 of 5 selected single-digit numbers.' },
    { lo: 1, hi: 1,    label: 'Number Recognition (1–9)',   description: 'Correctly identified 4 or 5 of the selected single-digit numbers.' },
    { lo: 2, hi: 2,    label: 'Number Recognition (10–99)', description: 'Correctly identified 4 or 5 of the selected two-digit numbers.' },
    { lo: 3, hi: 3,    label: 'Subtraction',                description: 'Solved both administered two-digit subtraction problems correctly.' },
    { lo: 4, hi: null, label: 'Division',                   description: 'Correctly solved the administered division problem (quotient and remainder).' }, // open-ended — catches any score at/above the max
  ],
  numeracy_number_skill: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 10 },
    { lo: 11, hi: 20 },
    { lo: 21, hi: 24 },
    { lo: 25, hi: null }, // open-ended — catches any score at/above the max (26)
  ],
  number_recall_lottery: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 6 },
    { lo: 7,  hi: 12 },
    { lo: 13, hi: 18 },
    { lo: 19, hi: null }, // open-ended — catches any score at/above the max (22)
  ],
  number_recall_lottery_v2: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 6 },
    { lo: 7,  hi: 12 },
    { lo: 13, hi: 18 },
    { lo: 19, hi: null }, // open-ended — catches any score at/above the max (22)
  ],
  working_memory_herpher: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 4 },
    { lo: 5,  hi: 13 },
    { lo: 14, hi: null }, // open-ended — catches any score at/above the max (25)
  ],
  working_memory_herpher_v2: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 4 },
    { lo: 5,  hi: 8 },
    { lo: 9,  hi: 12 },
    { lo: 13, hi: null }, // open-ended — catches any score at/above the max (16)
  ],
  working_memory_herpher_v3: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 4 },
    { lo: 5,  hi: 13 },
    { lo: 14, hi: null }, // open-ended — catches any score at/above the max (25)
  ],
  rover_mela: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 10 },
    { lo: 11, hi: 24 },
    { lo: 25, hi: 34 },
    { lo: 35, hi: null }, // open-ended — catches any score at/above the max (44)
  ],
  cognitive_flex_chor: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 17 },
    { lo: 18, hi: 28 },
    { lo: 29, hi: 42 },
    { lo: 43, hi: null }, // open-ended — catches any score at/above the max (57)
  ],
  atlantis_bagiya: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 22 },
    { lo: 23, hi: 40 },
    { lo: 41, hi: 58 },
    { lo: 59, hi: 84 },
    { lo: 85, hi: null }, // open-ended — catches any score at/above the max (108)
  ],
  triangle_rachna: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 12 },
    { lo: 13, hi: 24 },
    { lo: 25, hi: 36 },
    { lo: 37, hi: null }, // open-ended — catches any score at/above the max (48)
  ],
  auditory_dhyan: [
    { lo: 0,  hi: 0 },
    { lo: 1,  hi: 4 },
    { lo: 5,  hi: 9 },
    { lo: 10, hi: 18 },
    { lo: 19, hi: null }, // open-ended — catches any score at/above the max (33)
  ],
};

// Resolves a game's score-distribution buckets — its CUSTOM_SCORE_BUCKETS
// entry if one exists, else 5 equal-width buckets over its maxScore — and
// attaches the display label each bucket should use.
function buildBucketDefs(gameKey, maxScore) {
  const customBuckets = CUSTOM_SCORE_BUCKETS[gameKey];
  const bucketSize    = Math.ceil(maxScore / 5);
  const raw = customBuckets || Array.from({ length: 5 }, (_, i) => ({
    lo: i * bucketSize,
    hi: i === 4 ? null : (i + 1) * bucketSize - 1,
  }));
  return raw.map(({ lo, hi, label: customLabel, description }) => {
    const effectiveHi = hi === null ? maxScore : hi;
    const label = customLabel || (lo === effectiveHi ? `${lo}` : `${lo}-${effectiveHi}`);
    return { lo, hi, label, description: description || null };
  });
}

// Age bands — one per registration year (7–16), using the same "completed
// years" convention as TIMESTAMPDIFF(YEAR, dob, CURDATE()) (used for the
// displayed age elsewhere) — band "N" covers [dob + N years, dob + (N+1) years),
// i.e. from the child's Nth birthday through the day before their (N+1)th, so
// the filter buckets and the displayed age always agree. AGE_YEARS is the
// single source of truth AGE_MAP and AGE_BAND_CASE are both derived from, so
// they can't drift out of sync.
const AGE_YEARS = Array.from({ length: 10 }, (_, i) => 7 + i); // [7, 8, ..., 16]
const AGE_MAP = Object.fromEntries(AGE_YEARS.map(y => [`${y}`, [y, y]]));

// Games whose saved_state.allScores[] entries carry a per-question identifier
// this query can group by — either a real `category` tag (Her Pher: item1..
// item8 image-matching questions), a `qId`, or (rover_mela only) a plain
// `id` — COALESCE(category, qId, id) picks whichever field a given game
// actually uses, giving one row per question when there's no true category
// concept. Only Her Pher (V1-V3) also carries correctCount/expectedImages/
// missedImages/incorrectSelections — those columns come back NULL for the
// rest, and the frontend already renders NULL as '—'.
// Not in this set (verified against real saved_state, not just game source):
// literacy_reading_skill_v2 and numeracy_number_skill_v3 use an adaptive
// level/stage structure this flat-array query can't read — they get their
// own dedicated query branches below instead (see the
// `gameKey === 'numeracy_number_skill_v3'` / `'literacy_reading_skill_v2'`
// branches further down). cognitive_flex_chor (saved_state.itemResults,
// different fields entirely) and number_recall_lottery_v2 (different field
// names — question/duration_ms instead of qId/timeTaken) remain
// unimplemented.
const CATEGORY_BREAKDOWN_GAMES = new Set([
  'working_memory_herpher', 'working_memory_herpher_v2', 'working_memory_herpher_v3',
  'triangle_rachna',
  'literacy_reading_skill',
  'numeracy_number_skill', 'numeracy_number_skill_v2',
  'number_recall_lottery',
  'atlantis_bagiya',
  'auditory_dhyan',
  'rover_mela',
]);

// Same boundary logic as AGE_MAP, expressed as a SQL CASE so it can be used
// as a GROUP BY key — generated from AGE_YEARS so it can't drift out of sync.
const AGE_BAND_CASE = `CASE
  ${AGE_YEARS.map(y =>
    `WHEN DATE_ADD(c.dob, INTERVAL ${y} YEAR) <= CURDATE() AND CURDATE() < DATE_ADD(c.dob, INTERVAL ${y + 1} YEAR) THEN '${y}'`
  ).join('\n  ')}
  ELSE NULL END`;

// Score as a percentage of that game's own max score — lets Overall V2 compare
// tests with wildly different point scales (e.g. Bagiya /108 vs Ankganit /26)
// on one common 0-100 axis instead of averaging raw, non-comparable scores.
const SCORE_PCT_CASE = `CASE gs.game_name ${
  Object.entries(GAME_META).map(([key, meta]) => `WHEN '${key}' THEN gs.score / ${meta.maxScore} * 100`).join(' ')
} ELSE NULL END`;

function parseFilters(req) {
  const { startDate, endDate, gender, status, ageGroup, childId, gameKey, groupId, attempt } = req.query;

  // Org isolation — an Organization session only ever sees its own
  // children's game sessions; Super Admin/staff-with-org_id-NULL see
  // everything, unchanged from before this feature. Two variants since
  // this filter set gets reused against both game_sessions-aliased (gs)
  // and children-aliased (c) queries elsewhere in this file (getOverviewV2's
  // registered-children/demographic queries run directly against `children
  // c`, not `game_sessions gs`).
  const orgScope = req.orgScope || { isSuperAdmin: true, orgId: null };
  const orgClauses = [], orgParams = [];
  const orgClausesC = [], orgParamsC = [];
  if (!orgScope.isSuperAdmin) {
    orgClauses.push('gs.org_id <=> ?');  orgParams.push(orgScope.orgId);
    orgClausesC.push('c.org_id <=> ?');  orgParamsC.push(orgScope.orgId);
  }

  // Individual Users are a separate, self-contained reporting surface (their
  // own "My Account" / /individual/reports page) — their sessions and their
  // own child record must never appear in the admin Reports/Analysis
  // modules, for Super Admin or any Organization alike. Unconditional, not
  // tied to org scope or any filter param, unlike orgClauses above.
  const individualClauses = ['gs.individual_id IS NULL'];
  const individualClausesC = ['c.individual_id IS NULL'];

  // Date clauses (on gs.created_at)
  const dateClauses = [], dateParams = [];
  if (startDate) { dateClauses.push('gs.created_at >= ?');          dateParams.push(startDate); }
  if (endDate)   { dateClauses.push('gs.created_at <= ?');          dateParams.push(`${endDate} 23:59:59`); }

  // Multi-value arrays from comma-separated query params
  const genders   = gender   ? gender.split(',').filter(Boolean)   : [];
  const statuses  = status   ? status.split(',').filter(Boolean)   : [];
  const ageGroups = ageGroup ? ageGroup.split(',').filter(Boolean) : [];
  const gameKeys  = gameKey  ? gameKey.split(',').filter(Boolean)  : [];
  const groupIds  = groupId  ? groupId.split(',').filter(Boolean)  : [];
  const attempts  = attempt  ? attempt.split(',').filter(Boolean)  : [];

  // Attempt number = the Nth time this child played this specific test
  // (same meaning as the "Attempt" column elsewhere) — not stored, computed
  // per row via a correlated subquery. '6+' matches everything from 6 up.
  const attemptClauses = [], attemptParams = [];
  if (attempts.length > 0) {
    const ATTEMPT_EXPR = `(SELECT COUNT(*) FROM game_sessions g2
       WHERE g2.child_id = gs.child_id AND g2.game_name = gs.game_name AND g2.created_at <= gs.created_at)`;
    const exact   = attempts.filter(a => a !== '6+').map(Number).filter(n => Number.isInteger(n) && n > 0);
    const hasPlus = attempts.includes('6+');
    const orParts = [];
    if (exact.length === 1)    { orParts.push(`${ATTEMPT_EXPR} = ?`);    attemptParams.push(exact[0]); }
    else if (exact.length > 1) { orParts.push(`${ATTEMPT_EXPR} IN (?)`); attemptParams.push(exact); }
    if (hasPlus)                orParts.push(`${ATTEMPT_EXPR} >= 6`);
    if (orParts.length) attemptClauses.push(`(${orParts.join(' OR ')})`);
  }

  const genderClauses = [], genderParams = [];
  if (genders.length === 1)    { genderClauses.push('c.gender = ?');    genderParams.push(genders[0]); }
  else if (genders.length > 1) { genderClauses.push('c.gender IN (?)'); genderParams.push(genders); }

  const statusClauses = [], statusParams = [];
  if (statuses.length === 1)    { statusClauses.push('gs.status = ?');     statusParams.push(statuses[0]); }
  else if (statuses.length > 1) { statusClauses.push('gs.status IN (?)'); statusParams.push(statuses); }

  // Age groups build a single OR condition — no extra params (values embedded as integers).
  // Matches TIMESTAMPDIFF(YEAR, dob, CURDATE())'s standard "completed years" convention
  // (same one used for the displayed age elsewhere) — band N covers the child's Nth
  // birthday through the day before their (N+1)th, so the filter and the displayed
  // age always agree.
  const ageClauses = [];
  if (ageGroups.length > 0) {
    const conditions = ageGroups
      .map(ag => AGE_MAP[ag])
      .filter(Boolean)
      .map(([lo, hi]) => `(DATE_ADD(c.dob, INTERVAL ${lo} YEAR) <= CURDATE() AND CURDATE() < DATE_ADD(c.dob, INTERVAL ${hi + 1} YEAR))`);
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

  // Cohort restriction: Only include children who have played ALL selected games
  const cGameIntersectionClauses = [], cGameIntersectionParams = [];
  if (gameKeys.length > 0) {
    const clause = `(SELECT child_id FROM game_sessions WHERE game_name IN (?) GROUP BY child_id HAVING COUNT(DISTINCT game_name) = ?)`;
    childClauses.push(`gs.child_id IN ${clause}`);
    childParams.push(gameKeys, gameKeys.length);
    cGameIntersectionClauses.push(`c.child_id IN ${clause}`);
    cGameIntersectionParams.push(gameKeys, gameKeys.length);
  }

  // Group filter — a child can belong to multiple groups, so this is an EXISTS
  // subquery rather than a join (a plain join would multiply session rows for
  // children in more than one selected group).
  const groupClauses = [], groupParams = [];
  if (groupIds.length > 0) {
    groupClauses.push('EXISTS (SELECT 1 FROM child_group_members cgm WHERE cgm.children_id = c.id AND cgm.group_id IN (?))');
    groupParams.push(groupIds);
  }

  const allClauses     = [...orgClauses, ...individualClauses, ...dateClauses, ...genderClauses, ...statusClauses, ...ageClauses, ...childClauses, ...gameClauses, ...groupClauses, ...attemptClauses];
  const allParams      = [...orgParams,                        ...dateParams,  ...genderParams,  ...statusParams,                ...childParams,  ...gameParams,  ...groupParams,  ...attemptParams];

  // For gender distribution: skip gender filter so all genders are visible
  const noGenderClauses = [...orgClauses, ...individualClauses, ...dateClauses, ...statusClauses, ...ageClauses, ...childClauses, ...gameClauses, ...groupClauses, ...attemptClauses];
  const noGenderParams  = [...orgParams,                        ...dateParams,  ...statusParams,                 ...childParams,  ...gameParams,  ...groupParams,  ...attemptParams];

  // For age-group distribution: skip age filter so all bands are visible
  const noAgeClauses = [...orgClauses, ...individualClauses, ...dateClauses, ...genderClauses, ...statusClauses, ...childClauses, ...gameClauses, ...groupClauses, ...attemptClauses];
  const noAgeParams  = [...orgParams,                        ...dateParams,  ...genderParams,  ...statusParams,  ...childParams,  ...gameParams,  ...groupParams,  ...attemptParams];

  const needsChildJoin = genders.length > 0 || ageGroups.length > 0 || !!childId?.trim();

  return {
    allClauses, allParams, noGenderClauses, noGenderParams, noAgeClauses, noAgeParams, needsChildJoin,
    // Raw pieces — used by getOverviewV2 to compose custom clause sets (e.g. children-only
    // queries with no date scoping, or a shifted date range for period-over-period trend).
    orgClauses, orgParams, orgClausesC, orgParamsC, individualClauses, individualClausesC,
    dateClauses, dateParams, genderClauses, genderParams, statusClauses, statusParams, ageClauses, childClauses, childParams,
    gameClauses, gameParams, groupClauses, groupParams, attemptClauses, attemptParams,
    cGameIntersectionClauses, cGameIntersectionParams
  };
}

function toWhere(clauses) {
  return clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
}

// Always LEFT JOIN — gender/age filters on c.* columns naturally exclude unmatched rows
const CHILD_JOIN = 'LEFT JOIN children c ON gs.child_id = c.child_id';

// ── GET /api/analysis/meta ──────────────────────────────────────────────────
exports.getMeta = async (req, res) => {
  try {
    // Org isolation — doesn't go through parseFilters (no other filters
    // apply to this endpoint), so scoped directly here.
    const { orgScope } = req;
    const orgWhere  = orgScope.isSuperAdmin ? '' : 'AND org_id <=> ?';
    const orgParams = orgScope.isSuperAdmin ? [] : [orgScope.orgId];
    // Individual Users' sessions are excluded from Reports/Analysis
    // entirely — see parseFilters' individualClauses for the full rationale.
    const [[row]] = await pool.query(`
      SELECT
        DATE_FORMAT(MIN(start_time), '%Y-%m-%d')  AS minDate,
        DATE_FORMAT(CURDATE(),       '%Y-%m-%d')  AS today,
        COUNT(*)                                   AS totalSessions
      FROM game_sessions
      WHERE start_time IS NOT NULL AND individual_id IS NULL ${orgWhere}
    `, orgParams);
    res.json(row || { minDate: null, today: new Date().toISOString().slice(0, 10), totalSessions: 0 });
  } catch (err) {
    console.error('Analysis meta error:', err);
    res.status(500).json({ error: 'Failed to load meta' });
  }
};

// ── GET /api/analysis/overview ────────────────────────────────────────────────
exports.getOverview = async (req, res) => {
  try {
    // Organization-wise Test Assignment — if the caller explicitly asked to
    // filter to specific game(s) via ?gameKey=, reject outright when any of
    // them isn't assigned, rather than silently returning an empty/partial
    // breakdown. The unfiltered case (no ?gameKey=) is handled below by
    // post-filtering byGame instead, since there's no single "requested
    // game" to reject on.
    if (!req.orgScope.isSuperAdmin && req.query.gameKey) {
      const assignedTests = await getOrgAssignedTests(req.orgScope.orgId);
      if (assignedTests !== null) {
        const requested = req.query.gameKey.split(',').filter(Boolean);
        const disallowed = requested.some(k => !assignedTests.includes(normalizeGameName(k)));
        if (disallowed) {
          return res.status(403).json({ error: 'One or more requested tests are not assigned to your organization.' });
        }
      }
    }

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
        ROUND(AVG(COALESCE(CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time))) / 60, 1) AS avgDurationMins,
        ROUND(SUM(gs.status = 'completed') / NULLIF(COUNT(*),0) * 100, 0) AS completionRate,
        ROUND(SUM(COALESCE(gs.score, 0)) / NULLIF(COUNT(*),0), 1)     AS meanScoreAll,
        ROUND(SUM(COALESCE(CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time), 0)) / NULLIF(COUNT(*),0) / 60, 1) AS meanDurationAllMins,
        ROUND(STDDEV_POP(gs.score), 1)                                 AS sdScore
      FROM game_sessions gs ${CHILD_JOIN} ${where}
    `, allParams);

    // Median Score — MySQL has no built-in MEDIAN()/PERCENTILE_CONT, so rank
    // scores and average the middle one (or two, for an even count).
    const medianClauses = [...allClauses, 'gs.score IS NOT NULL'];
    const [[medianRow]] = await pool.query(`
      SELECT ROUND(AVG(score), 1) AS medianScore FROM (
        SELECT gs.score,
               ROW_NUMBER() OVER (ORDER BY gs.score) AS rn,
               COUNT(*) OVER ()                       AS cnt
        FROM game_sessions gs ${CHILD_JOIN} ${toWhere(medianClauses)}
      ) ranked
      WHERE rn IN (FLOOR((cnt + 1) / 2), CEIL((cnt + 1) / 2))
    `, allParams);
    kpis.medianScore = medianRow.medianScore != null ? Number(medianRow.medianScore) : null;

    // Per-game breakdown
    const [byGame] = await pool.query(`
      SELECT
        gs.game_name                                                    AS gameKey,
        COUNT(*)                                                        AS sessions,
        COUNT(DISTINCT gs.child_id)                                     AS children,
        CAST(SUM(gs.status = 'completed') AS UNSIGNED)                 AS completed,
        CAST(SUM(gs.status IN ('quit','dropped')) AS UNSIGNED)         AS dropped,
        ROUND(AVG(gs.score), 1)                                         AS avgScore,
        ROUND(AVG(COALESCE(CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time))) / 60, 1) AS avgDurationMins
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

    let byGameEnriched = byGame.map(row => ({
      ...row,
      ...(GAME_META[row.gameKey] || {}),
      completionRate: row.sessions > 0 ? Math.round((row.completed / row.sessions) * 100) : 0,
    }));

    if (!req.orgScope.isSuperAdmin) {
      const assignedTests = await getOrgAssignedTests(req.orgScope.orgId);
      if (assignedTests !== null) {
        byGameEnriched = byGameEnriched.filter(row => assignedTests.includes(normalizeGameName(row.gameKey)));
      }
    }

    res.json({
      kpis: {
        ...kpis,
        completionRate:      Number(kpis.completionRate)      || 0,
        meanScoreAll:        Number(kpis.meanScoreAll)         || 0,
        meanDurationAllMins: Number(kpis.meanDurationAllMins)  || 0,
        sdScore:             kpis.sdScore != null ? Number(kpis.sdScore) : null,
        medianScore:         kpis.medianScore != null ? Number(kpis.medianScore) : null,
      },
      byGame: byGameEnriched,
      dailyTrend,
      statusDist,
      genderDist
    });
  } catch (err) {
    console.error('Analysis overview error:', err);
    res.status(500).json({ error: 'Failed to load overview analytics' });
  }
};

// Cohort-level auto-generated insights over the question-wise performance
// breakdown — same {icon, text} shape and spirit as buildInsights() above,
// just scoped to one game's per-question rows instead of the whole platform.
function buildCategoryInsights(categoryBreakdown, { skipDropOff = false } = {}) {
  const insights = [];
  if (!categoryBreakdown || categoryBreakdown.length < 2) return insights;

  const byScore = [...categoryBreakdown].sort((a, b) => a.avgScore - b.avgScore);
  const hardest = byScore[0];
  const easiest = byScore[byScore.length - 1];
  if (hardest.avgScore !== easiest.avgScore) {
    insights.push({ icon: '🧗', text: `Question "${hardest.category}" is the hardest — average score ${hardest.avgScore}, may need review.` });
    insights.push({ icon: '✅', text: `Question "${easiest.category}" is the easiest — average score ${easiest.avgScore}.` });
  }

  const withAccuracy = categoryBreakdown.filter(r => r.accuracyPct != null);
  if (withAccuracy.length >= 2) {
    const lowestAccuracy = [...withAccuracy].sort((a, b) => a.accuracyPct - b.accuracyPct)[0];
    if (lowestAccuracy.accuracyPct < 50) {
      insights.push({ icon: '🎯', text: `Question "${lowestAccuracy.category}" has the lowest accuracy at ${lowestAccuracy.accuracyPct}% — fewer than half the expected matches are found on average.` });
    }
  }

  const withMissRate = categoryBreakdown.filter(r => r.missRatePct != null);
  if (withMissRate.length) {
    const highestMiss = [...withMissRate].sort((a, b) => b.missRatePct - a.missRatePct)[0];
    if (highestMiss.missRatePct >= 40) {
      insights.push({ icon: '⚠️', text: `Question "${highestMiss.category}" has a high miss rate (${highestMiss.missRatePct}%) — children are frequently missing expected items here.` });
    }
  }

  // Drop-off — only surfaces where attempts materially decrease across
  // questions (auto-stop mechanics like Her Pher/Rachna); flat-array games
  // where every question gets roughly the same attempt count stay quiet
  // here. skipDropOff covers numeracy_number_skill_v3: its subtraction/
  // division rows are keyed by questionId, and each session only ever
  // shows ONE question drawn from an 8-item catalog per slot, so low
  // per-question attempt counts there reflect catalog rotation, not
  // children quitting — "reached by N% fewer children" would be false.
  if (!skipDropOff) {
    const attemptCounts = categoryBreakdown.map(r => r.attempts);
    const maxAttempts = Math.max(...attemptCounts);
    const minAttempts = Math.min(...attemptCounts);
    if (maxAttempts > 0 && (maxAttempts - minAttempts) / maxAttempts >= 0.3) {
      const lowestReach = [...categoryBreakdown].sort((a, b) => a.attempts - b.attempts)[0];
      const dropPct = Math.round((1 - lowestReach.attempts / maxAttempts) * 100);
      insights.push({ icon: '🚪', text: `Question "${lowestReach.category}" is reached by ${dropPct}% fewer children than the most-reached question — some children are quitting or auto-stopping before this point.` });
    }
  }

  const scores = categoryBreakdown.map(r => r.avgScore);
  const scoreRange = Math.max(...scores) - Math.min(...scores);
  const meanScore = scores.reduce((s, v) => s + v, 0) / scores.length;
  if (meanScore > 0 && scoreRange / meanScore >= 0.5) {
    insights.push({ icon: '📊', text: `Scores vary widely across questions (${Math.min(...scores)}–${Math.max(...scores)}), suggesting some are materially harder than others.` });
  }

  return insights;
}

// ── GET /api/analysis/game/:gameKey ──────────────────────────────────────────
exports.getGameAnalytics = async (req, res) => {
  try {
    const { gameKey } = req.params;

    // Organization-wise Test Assignment — single-game route param, reject
    // outright if this org hasn't been assigned it.
    if (!req.orgScope.isSuperAdmin) {
      const { allowed } = await isGameAssignedToOrg(req.orgScope.orgId, normalizeGameName(gameKey));
      if (!allowed) return res.status(403).json({ error: 'This test is not assigned to your organization.' });
    }

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
        ROUND(AVG(COALESCE(CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time))) / 60, 2) AS avgDurationMins,
        ROUND(SUM(gs.status='completed') / NULLIF(COUNT(*),0) * 100, 1)    AS completionRate,
        ROUND(SUM(COALESCE(gs.score, 0)) / NULLIF(COUNT(*),0), 2)          AS meanScoreAll,
        ROUND(SUM(COALESCE(CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time), 0)) / NULLIF(COUNT(*),0) / 60, 2) AS meanDurationAllMins,
        ROUND(STDDEV_POP(gs.score), 2)                                      AS sdScore
      FROM game_sessions gs ${CHILD_JOIN} ${where}
    `, params);

    // Median Score — MySQL has no built-in MEDIAN()/PERCENTILE_CONT, so rank
    // scores and average the middle one (or two, for an even count).
    const medianClauses = [...clauses, 'gs.score IS NOT NULL'];
    const [[medianRow]] = await pool.query(`
      SELECT ROUND(AVG(score), 2) AS medianScore FROM (
        SELECT gs.score,
               ROW_NUMBER() OVER (ORDER BY gs.score) AS rn,
               COUNT(*) OVER ()                       AS cnt
        FROM game_sessions gs ${CHILD_JOIN} ${toWhere(medianClauses)}
      ) ranked
      WHERE rn IN (FLOOR((cnt + 1) / 2), CEIL((cnt + 1) / 2))
    `, params);
    kpis.medianScore = medianRow.medianScore != null ? Number(medianRow.medianScore) : null;

    // Score distribution — 5 equal buckets. Not restricted to completed
    // sessions: in games like Padh ke Batao, completion implies a near-perfect
    // score and the real ability spread lives in dropped/quit sessions'
    // partial scores. In-progress/paused sessions are excluded (their score is
    // still changing) unless the admin explicitly filters by status.
    const bucketDefs  = buildBucketDefs(gameKey, meta.maxScore);
    const bucketCases = bucketDefs.map(({ lo, hi, label }) => {
      // open-ended top bucket so scores at/above the configured max still count
      const cond = hi === null ? `gs.score >= ${lo}` : `gs.score BETWEEN ${lo} AND ${hi}`;
      return `CAST(SUM(${cond}) AS UNSIGNED) AS \`${label}\``;
    }).join(', ');

    const distClauses = [...clauses, 'gs.score IS NOT NULL'];
    if (!req.query.status) distClauses.push("gs.status IN ('completed','dropped','quit')");
    const [[scoreDistRaw]] = await pool.query(`
      SELECT ${bucketCases}
      FROM game_sessions gs ${CHILD_JOIN} ${toWhere(distClauses)}
    `, params);
    // Re-assert bucket order explicitly — plain-integer-looking keys (e.g. "0",
    // "21") get reordered ahead of range keys (e.g. "1-10") by JS object key
    // sort semantics, which would scramble the display order of custom buckets.
    const scoreDist = bucketDefs.map(({ label, description }) => [label, Number(scoreDistRaw[label]) || 0, description]);

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
      INNER JOIN game_sessions gs
        ON ga.session_id = gs.id
        -- Dedupe to the latest submission per session — a session can have more
        -- than one assessment row (e.g. a resumed session re-prompting the
        -- questionnaire), and a plain join would double-count those responses.
        AND ga.id = (SELECT MAX(ga2.id) FROM game_assessments ga2 WHERE ga2.session_id = ga.session_id)
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

    // Question-wise performance — one row per category (Her Pher) or per
    // question (everything else, via the qId fallback — see
    // CATEGORY_BREAKDOWN_GAMES above). Ranked easiest to hardest by avg
    // score; item0 (Her Pher's unscored sample question) is excluded.
    // rankAndTier() is shared by every source below so rank/difficulty stay
    // consistent regardless of which query produced the rows.
    const rankAndTier = (catRows) => {
      const n = catRows.length;
      const tierSize = Math.ceil(n / 3);
      return catRows.map((row, i) => ({
        ...row,
        attempts: Number(row.attempts),
        avgScore: Number(row.avgScore),
        avgCorrectCount: row.avgCorrectCount != null ? Number(row.avgCorrectCount) : null,
        avgTimeTakenSec: row.avgTimeTakenSec != null ? Number(row.avgTimeTakenSec) : null,
        accuracyPct: row.accuracyPct != null ? Number(row.accuracyPct) : null,
        missRatePct: row.missRatePct != null ? Number(row.missRatePct) : null,
        perfectRatePct: row.perfectRatePct != null ? Number(row.perfectRatePct) : null,
        avgMoves: row.avgMoves != null ? Number(row.avgMoves) : null,
        avgMistakes: row.avgMistakes != null ? Number(row.avgMistakes) : null,
        completionPct: row.completionPct != null ? Number(row.completionPct) : null,
        rank: i + 1,
        difficulty: i < tierSize ? 'Easy' : i >= n - tierSize ? 'Hard' : 'Moderate',
      }));
    };

    let categoryBreakdown = [];
    if (CATEGORY_BREAKDOWN_GAMES.has(gameKey)) {
      const catWhere = toWhere([...clauses, 'JSON_VALID(gs.saved_state)']);
      // COALESCE(category, qId, id) — rover_mela's allScores[] entries key
      // each question by `id` (e.g. "q1".."q18"), not `category`/`qId` like
      // every other game here; tq1..tq4 are its teaching/practice questions
      // (excluded the same way the game's own scoring code already excludes
      // them — see ChaloMelaChaleGame.jsx's `nonTQScores` filter), same
      // spirit as excluding Her Pher's unscored item0 below.
      const [catRows] = await pool.query(`
        SELECT
          COALESCE(jt.category, jt.qId, jt.id)                                    AS category,
          COUNT(*)                                                                AS attempts,
          ROUND(AVG(jt.score), 2)                                                 AS avgScore,
          ROUND(AVG(jt.correctCount), 2)                                          AS avgCorrectCount,
          ROUND(AVG(jt.timeTaken), 2)                                             AS avgTimeTakenSec,
          ROUND(SUM(jt.correctCount) / NULLIF(SUM(JSON_LENGTH(jt.expectedImages)), 0) * 100, 1) AS accuracyPct,
          ROUND(SUM(JSON_LENGTH(jt.missedImages)) / NULLIF(SUM(JSON_LENGTH(jt.expectedImages)), 0) * 100, 1) AS missRatePct,
          ROUND(SUM(JSON_LENGTH(jt.missedImages) = 0 AND JSON_LENGTH(jt.incorrectSelections) = 0) / COUNT(*) * 100, 1) AS perfectRatePct
        FROM game_sessions gs ${CHILD_JOIN},
        JSON_TABLE(gs.saved_state, '$.allScores[*]' COLUMNS (
          category NVARCHAR(50) PATH '$.category',
          qId NVARCHAR(50) PATH '$.qId',
          id NVARCHAR(50) PATH '$.id',
          score INT PATH '$.score',
          correctCount INT PATH '$.correctCount',
          timeTaken DECIMAL(10,2) PATH '$.timeTaken',
          expectedImages JSON PATH '$.expectedImages',
          missedImages JSON PATH '$.missedImages',
          incorrectSelections JSON PATH '$.incorrectSelections'
        )) AS jt
        ${catWhere} AND COALESCE(jt.category, jt.qId, jt.id) IS NOT NULL
          AND COALESCE(jt.category, jt.qId, jt.id) != 'item0'
          AND COALESCE(jt.category, jt.qId, jt.id) NOT LIKE 'tq%'
        GROUP BY COALESCE(jt.category, jt.qId, jt.id)
        ORDER BY AVG(jt.score) DESC
      `, params);
      categoryBreakdown = rankAndTier(catRows);
    } else if (gameKey === 'numeracy_number_skill_v3') {
      // Adaptive-level game — no flat allScores[] array. subtraction.q1/q2
      // and division carry a real, stable questionId (a fixed DB catalog
      // row — see ankganit_v3_questions), so those get a true per-question
      // rollup. Number Recognition's saved shape has no per-tile id (just
      // an array of {text,correct} marks), so it gets one stage-level row
      // each instead — same shape/columns as a "question", just courser
      // grain, honest to what the data actually supports.
      const gWhere = toWhere([...clauses, 'JSON_VALID(gs.saved_state)']);
      const [catRows] = await pool.query(`
        SELECT questionId AS category, COUNT(*) AS attempts, ROUND(AVG(correct), 2) AS avgScore,
               NULL AS avgCorrectCount, ROUND(AVG(timeTaken), 2) AS avgTimeTakenSec,
               NULL AS accuracyPct, NULL AS missRatePct, NULL AS perfectRatePct
        FROM (
          SELECT gs.id,
                 JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.subtraction.q1.questionId')) AS questionId,
                 JSON_EXTRACT(gs.saved_state, '$.subtraction.q1.finalCorrect') = true AS correct,
                 CAST(COALESCE(JSON_EXTRACT(gs.saved_state, '$.subtraction.q1.firstAttempt.timeTaken'), 0) AS DECIMAL(10,2)) +
                 CAST(COALESCE(JSON_EXTRACT(gs.saved_state, '$.subtraction.q1.retryAttempt.timeTaken'), 0) AS DECIMAL(10,2)) AS timeTaken
          FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_EXTRACT(gs.saved_state, '$.subtraction.q1.questionId') IS NOT NULL
          UNION ALL
          SELECT gs.id,
                 JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.subtraction.q2.questionId')),
                 JSON_EXTRACT(gs.saved_state, '$.subtraction.q2.finalCorrect') = true,
                 CAST(JSON_EXTRACT(gs.saved_state, '$.subtraction.q2.firstAttempt.timeTaken') AS DECIMAL(10,2))
          FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_EXTRACT(gs.saved_state, '$.subtraction.q2.questionId') IS NOT NULL
          UNION ALL
          SELECT gs.id,
                 JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.division.questionId')),
                 JSON_EXTRACT(gs.saved_state, '$.division.finalCorrect') = true,
                 CAST(JSON_EXTRACT(gs.saved_state, '$.division.firstAttempt.timeTaken') AS DECIMAL(10,2))
          FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_EXTRACT(gs.saved_state, '$.division.questionId') IS NOT NULL
        ) q
        GROUP BY questionId

        UNION ALL

        SELECT 'number_recognition_9', COUNT(*), ROUND(AVG(JSON_EXTRACT(gs.saved_state, '$.numberRecognition9.pass') = true), 2),
               NULL, ROUND(AVG(CAST(JSON_EXTRACT(gs.saved_state, '$.numberRecognition9.timeTaken') AS DECIMAL(10,2))), 2),
               NULL, NULL, NULL
        FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_EXTRACT(gs.saved_state, '$.numberRecognition9') IS NOT NULL

        UNION ALL

        SELECT 'number_recognition_99', COUNT(*), ROUND(AVG(JSON_EXTRACT(gs.saved_state, '$.numberRecognition99.pass') = true), 2),
               NULL, ROUND(AVG(CAST(JSON_EXTRACT(gs.saved_state, '$.numberRecognition99.timeTaken') AS DECIMAL(10,2))), 2),
               NULL, NULL, NULL
        FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_EXTRACT(gs.saved_state, '$.numberRecognition99') IS NOT NULL

        ORDER BY avgScore DESC
      `, [...params, ...params, ...params, ...params, ...params]);
      categoryBreakdown = rankAndTier(catRows);
    } else if (gameKey === 'literacy_reading_skill_v2') {
      // Same situation as numeracy V3 — no flat allScores[], and unlike
      // numeracy this game has NO stable per-item id anywhere (the
      // word/letter banks are plain text with no catalog id, and the
      // paragraph/story stages have only one or two fixed items). So every
      // row here is stage-level (pass rate + avg time for Letters, Words,
      // Words Retry, Paragraph, Paragraph Retry, Story), not per-word —
      // an honest match to what the saved data actually supports.
      const gWhere = toWhere([...clauses, 'JSON_VALID(gs.saved_state)']);
      const [catRows] = await pool.query(`
        SELECT 'letters' AS category, COUNT(*) AS attempts,
               ROUND(AVG((SELECT COUNT(*) FROM JSON_TABLE(gs.saved_state, '$.selectedLetters[*]' COLUMNS (correct JSON PATH '$.correct')) t WHERE t.correct = true) / NULLIF(JSON_LENGTH(gs.saved_state, '$.selectedLetters'), 0)), 2) AS avgScore,
               NULL AS avgCorrectCount, ROUND(AVG(CAST(JSON_EXTRACT(gs.saved_state, '$.lettersTimeTaken') AS DECIMAL(10,2))), 2) AS avgTimeTakenSec,
               NULL AS accuracyPct, NULL AS missRatePct, NULL AS perfectRatePct
        FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_LENGTH(gs.saved_state, '$.selectedLetters') > 0

        UNION ALL

        SELECT 'words', COUNT(*),
               ROUND(AVG((SELECT COUNT(*) FROM JSON_TABLE(gs.saved_state, '$.selectedWords[*]' COLUMNS (correct JSON PATH '$.correct')) t WHERE t.correct = true) / NULLIF(JSON_LENGTH(gs.saved_state, '$.selectedWords'), 0)), 2),
               NULL, ROUND(AVG(CAST(JSON_EXTRACT(gs.saved_state, '$.wordsTimeTaken') AS DECIMAL(10,2))), 2),
               NULL, NULL, NULL
        FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_LENGTH(gs.saved_state, '$.selectedWords') > 0

        UNION ALL

        SELECT 'words_retry', COUNT(*),
               ROUND(AVG((SELECT COUNT(*) FROM JSON_TABLE(gs.saved_state, '$.selectedWordsRetry[*]' COLUMNS (correct JSON PATH '$.correct')) t WHERE t.correct = true) / NULLIF(JSON_LENGTH(gs.saved_state, '$.selectedWordsRetry'), 0)), 2),
               NULL, ROUND(AVG(CAST(JSON_EXTRACT(gs.saved_state, '$.wordsRetryTimeTaken') AS DECIMAL(10,2))), 2),
               NULL, NULL, NULL
        FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_LENGTH(gs.saved_state, '$.selectedWordsRetry') > 0

        UNION ALL

        SELECT 'paragraph', COUNT(*),
               ROUND(AVG(JSON_EXTRACT(gs.saved_state, '$.paragraphResult.pass') = true), 2),
               NULL, ROUND(AVG(CAST(JSON_EXTRACT(gs.saved_state, '$.paragraphResult.timeTaken') AS DECIMAL(10,2))), 2),
               NULL, NULL, NULL
        FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_EXTRACT(gs.saved_state, '$.paragraphResult') IS NOT NULL

        UNION ALL

        SELECT 'paragraph_retry', COUNT(*),
               ROUND(AVG(JSON_EXTRACT(gs.saved_state, '$.paragraphRetryResult.pass') = true), 2),
               NULL, ROUND(AVG(CAST(JSON_EXTRACT(gs.saved_state, '$.paragraphRetryResult.timeTaken') AS DECIMAL(10,2))), 2),
               NULL, NULL, NULL
        FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_EXTRACT(gs.saved_state, '$.paragraphRetryResult') IS NOT NULL

        UNION ALL

        SELECT 'story', COUNT(*),
               ROUND(AVG(JSON_EXTRACT(gs.saved_state, '$.storyResult.pass') = true), 2),
               NULL, ROUND(AVG(CAST(JSON_EXTRACT(gs.saved_state, '$.storyResult.timeTaken') AS DECIMAL(10,2))), 2),
               NULL, NULL, NULL
        FROM game_sessions gs ${CHILD_JOIN} ${gWhere} AND JSON_EXTRACT(gs.saved_state, '$.storyResult') IS NOT NULL

        ORDER BY avgScore DESC
      `, [...params, ...params, ...params, ...params, ...params, ...params]);
      categoryBreakdown = rankAndTier(catRows);
    } else if (gameKey === 'cognitive_flex_chor') {
      // This game saves saved_state.itemResults[], not allScores[] — a
      // different top-level field with its own shape (itemId/itemName/
      // moves/mistakes/completed instead of qId/category/correctCount).
      // Item 1 is the only item with two trials (a rule-switch retest —
      // confirmed its trial 2 scores far lower than trial 1 on real data,
      // a genuinely different condition), so rows are grouped by
      // (itemId, trial), matching how numeracy V3 keeps its q1/q2 separate.
      const gWhere = toWhere([...clauses, 'JSON_VALID(gs.saved_state)']);
      const [catRows] = await pool.query(`
        SELECT CONCAT(jt.itemId, '_t', jt.trial) AS category,
               MAX(jt.itemName) AS catName,
               COUNT(*) AS attempts,
               ROUND(AVG(jt.score), 2) AS avgScore,
               NULL AS avgCorrectCount,
               ROUND(AVG(jt.timeTaken), 2) AS avgTimeTakenSec,
               NULL AS accuracyPct, NULL AS missRatePct, NULL AS perfectRatePct,
               ROUND(AVG(jt.moves), 2) AS avgMoves,
               ROUND(AVG(jt.mistakes), 2) AS avgMistakes,
               ROUND(SUM(jt.completed = true) / COUNT(*) * 100, 1) AS completionPct
        FROM game_sessions gs ${CHILD_JOIN},
        JSON_TABLE(gs.saved_state, '$.itemResults[*]' COLUMNS (
          itemId INT PATH '$.itemId',
          trial INT PATH '$.trial',
          itemName NVARCHAR(100) PATH '$.itemName',
          score INT PATH '$.score',
          moves INT PATH '$.moves',
          mistakes INT PATH '$.mistakes',
          completed JSON PATH '$.completed',
          timeTaken DECIMAL(10,2) PATH '$.timeTaken'
        )) AS jt
        ${gWhere} AND jt.itemId IS NOT NULL
        GROUP BY jt.itemId, jt.trial
        ORDER BY avgScore DESC
      `, params);
      categoryBreakdown = rankAndTier(catRows);
    } else if (gameKey === 'number_recall_lottery_v2') {
      // This gameKey's saved_state has TWO different historical shapes —
      // real data, not a hypothetical: older sessions used the same field
      // names as number_recall_lottery V1 (qId/timeTaken/userResponse/
      // correctAnswer), while the current NumberRecallGameV2.jsx code (the
      // only version that exists today) saves question/duration_ms/
      // user_response/expected_response instead. COALESCE merges both so
      // old and new sessions roll up into the same per-question rows
      // instead of the newer field names just silently returning nothing.
      // question is a string like "Q1" — SUBSTRING strips the "Q" so it
      // merges numerically with the older qId (a plain number).
      const catWhere = toWhere([...clauses, 'JSON_VALID(gs.saved_state)']);
      const [catRows] = await pool.query(`
        SELECT
          COALESCE(CAST(SUBSTRING(jt.question, 2) AS UNSIGNED), jt.qId)          AS category,
          COUNT(*)                                                              AS attempts,
          ROUND(AVG(jt.score), 2)                                               AS avgScore,
          NULL AS avgCorrectCount,
          ROUND(AVG(COALESCE(jt.duration_ms, jt.timeTaken)), 2)                 AS avgTimeTakenSec,
          NULL AS accuracyPct, NULL AS missRatePct, NULL AS perfectRatePct
        FROM game_sessions gs ${CHILD_JOIN},
        JSON_TABLE(gs.saved_state, '$.allScores[*]' COLUMNS (
          question NVARCHAR(20) PATH '$.question',
          qId INT PATH '$.qId',
          score INT PATH '$.score',
          duration_ms DECIMAL(10,2) PATH '$.duration_ms',
          timeTaken DECIMAL(10,2) PATH '$.timeTaken'
        )) AS jt
        ${catWhere} AND COALESCE(CAST(SUBSTRING(jt.question, 2) AS UNSIGNED), jt.qId) IS NOT NULL
        GROUP BY COALESCE(CAST(SUBSTRING(jt.question, 2) AS UNSIGNED), jt.qId)
        ORDER BY AVG(jt.score) DESC
      `, params);
      categoryBreakdown = rankAndTier(catRows);
    }

    const categoryInsights = buildCategoryInsights(categoryBreakdown, { skipDropOff: gameKey === 'numeracy_number_skill_v3' });

    // Age-wise Score Distribution — MySQL has no PERCENTILE_CONT, and unlike
    // medianScore above (one number for the whole game), this needs a
    // separate percentile per age bucket, so it's simplest and most
    // reliable to fetch raw (age, score) pairs once and compute stats in JS.
    const ageWhere = toWhere([...clauses, 'gs.score IS NOT NULL']);
    const [ageScoreRows] = await pool.query(`
      SELECT ${AGE_BAND_CASE} AS ageBand, gs.score AS score
      FROM game_sessions gs ${CHILD_JOIN} ${ageWhere}
    `, params);
    const ageGroups = {};
    for (const row of ageScoreRows) {
      if (!row.ageBand) continue;
      (ageGroups[row.ageBand] ||= []).push(Number(row.score));
    }
    // Linear interpolation (the standard method — same as numpy/Excel
    // PERCENTILE.INC default) between the two ranked values straddling the
    // target position.
    const percentile = (sorted, p) => {
      const n = sorted.length;
      const pos = (n - 1) * p;
      const lo = Math.floor(pos), hi = Math.ceil(pos);
      return lo === hi ? sorted[lo] : sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
    };
    const ageDistribution = Object.keys(ageGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .map(age => {
        const scores = ageGroups[age].sort((a, b) => a - b);
        const n = scores.length;
        const avgScore = scores.reduce((s, v) => s + v, 0) / n;
        return {
          age, n,
          avgScore: Math.round(avgScore * 100) / 100,
          median: Math.round(percentile(scores, 0.5) * 100) / 100,
          p25: Math.round(percentile(scores, 0.25) * 100) / 100,
          p75: Math.round(percentile(scores, 0.75) * 100) / 100,
          min: scores[0],
          max: scores[n - 1],
        };
      });

    // Recent 20 sessions
    const [recentSessions] = await pool.query(`
      SELECT gs.id, gs.child_id, c.name AS childName,
             gs.score, gs.total_questions, gs.progress_level, gs.status, gs.quit_reason,
             DATE_FORMAT(gs.start_time, '%Y-%m-%d %H:%i') AS start_time,
             DATE_FORMAT(gs.end_time,   '%Y-%m-%d %H:%i') AS end_time,
             COALESCE(CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time)) AS durationSec
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      ORDER BY gs.created_at DESC LIMIT 20
    `, params);

    res.json({
      meta,
      kpis: {
        ...kpis,
        completionRate:  Number(kpis.completionRate)  || 0,
        avgScorePct:         meta.maxScore > 0 ? Math.round((Number(kpis.avgScore) / meta.maxScore) * 100) : 0,
        avgScore:            Number(kpis.avgScore)            || 0,
        avgDurationMins:     Number(kpis.avgDurationMins)     || 0,
        meanScoreAll:        Number(kpis.meanScoreAll)        || 0,
        meanDurationAllMins: Number(kpis.meanDurationAllMins) || 0,
        sdScore:             kpis.sdScore != null ? Number(kpis.sdScore) : null,
        medianScore:         kpis.medianScore != null ? Number(kpis.medianScore) : null,
      },
      scoreDist,
      quitReasons,
      genderBreakdown,
      dailyTrend,
      assessmentDist: { q1: q1Dist, q2: q2Dist, q3: q3Dist, q4: q4Dist },
      behaviorFreq,
      attemptBuckets,
      categoryBreakdown,
      categoryInsights,
      ageDistribution,
      recentSessions,
    });
  } catch (err) {
    console.error('Game analytics error:', err);
    res.status(500).json({ error: 'Failed to load game analytics' });
  }
};
// ── GET /api/analysis/game/:gameKey/sessions — paginated session list ────────
exports.getGameSessions = async (req, res) => {
  try {
    const { gameKey } = req.params;

    // Organization-wise Test Assignment — single-game route param, reject
    // outright if this org hasn't been assigned it.
    if (!req.orgScope.isSuperAdmin) {
      const { allowed } = await isGameAssignedToOrg(req.orgScope.orgId, normalizeGameName(gameKey));
      if (!allowed) return res.status(403).json({ error: 'This test is not assigned to your organization.' });
    }

    const { allClauses, allParams } = parseFilters(req);
    const clauses = [...allClauses, 'gs.game_name = ?'];
    const params  = [...allParams, gameKey];
    const where   = toWhere(clauses);

    const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const SESSION_SORT_MAP = {
      child:    'gs.child_id',
      attempt:  'attemptNo',
      status:   'gs.status',
      score:    'gs.score',
      progress: 'gs.progress_level',
      duration: 'durationSec',
      time:     'gs.created_at',
    };
    const orderCol = SESSION_SORT_MAP[req.query.sortKey] || 'gs.created_at';
    const sortDir  = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const [sessions] = await pool.query(`
      SELECT gs.id, gs.child_id, c.name AS childName, c.gender,
             TIMESTAMPDIFF(YEAR, c.dob, CURDATE()) AS age,
             gs.score, gs.total_questions, gs.progress_level, gs.status, gs.quit_reason,
             DATE_FORMAT(gs.start_time, '%Y-%m-%d %H:%i') AS start_time,
             DATE_FORMAT(gs.end_time,   '%Y-%m-%d %H:%i') AS end_time,
             COALESCE(CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time)) AS durationSec,
             (SELECT COUNT(*) FROM game_sessions g2
              WHERE g2.child_id = gs.child_id AND g2.game_name = gs.game_name
                AND g2.created_at <= gs.created_at) AS attemptNo,
             (SELECT g3.score FROM game_sessions g3
              WHERE g3.child_id = gs.child_id AND g3.game_name = gs.game_name
                AND g3.created_at < gs.created_at
              ORDER BY g3.created_at DESC LIMIT 1) AS prevScore
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      ORDER BY ${orderCol} ${sortDir}, gs.created_at DESC LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({ sessions });
  } catch (err) {
    console.error('Game sessions error:', err);
    res.status(500).json({ error: 'Failed to load game sessions' });
  }
};

// ── GET /api/analysis/children-sessions — session-level detail (all tests) for
// a given set of child IDs. Backs the "session-wise" sheet in the Top Active
// Children Excel export — one row per session, across every test they played.
exports.getChildrenSessions = async (req, res) => {
  try {
    const ids = (req.query.childIds || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return res.json({ sessions: [] });

    const { allClauses, allParams } = parseFilters(req);
    const clauses = [...allClauses, 'gs.child_id IN (?)'];
    const params  = [...allParams, ids];
    const where   = toWhere(clauses);

    const [sessions] = await pool.query(`
      SELECT gs.child_id, c.name AS childName, c.gender,
             TIMESTAMPDIFF(YEAR, c.dob, CURDATE()) AS age,
             gs.game_name AS gameKey,
             gs.score, gs.total_questions, gs.progress_level, gs.status, gs.quit_reason,
             DATE_FORMAT(gs.start_time, '%Y-%m-%d %H:%i') AS start_time,
             DATE_FORMAT(gs.end_time,   '%Y-%m-%d %H:%i') AS end_time,
             COALESCE(CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time)) AS durationSec,
             (SELECT COUNT(*) FROM game_sessions g2
              WHERE g2.child_id = gs.child_id AND g2.game_name = gs.game_name
                AND g2.created_at <= gs.created_at) AS attemptNo
      FROM game_sessions gs ${CHILD_JOIN} ${where}
      ORDER BY gs.child_id ASC, gs.game_name ASC, gs.created_at ASC
    `, params);

    let enriched = sessions.map(s => ({ ...s, gameTitle: (GAME_META[s.gameKey] || {}).title || s.gameKey }));

    if (!req.orgScope.isSuperAdmin) {
      const assignedTests = await getOrgAssignedTests(req.orgScope.orgId);
      if (assignedTests !== null) {
        enriched = enriched.filter(s => assignedTests.includes(normalizeGameName(s.gameKey)));
      }
    }

    res.json({ sessions: enriched });
  } catch (err) {
    console.error('Children sessions error:', err);
    res.status(500).json({ error: 'Failed to load children sessions' });
  }
};

// ==========================================
// TOP ACTIVE CHILDREN — one row per (child, attempt number), where "attempt
// number" is per-GAME, not per-login: a session's attemptNo is which time
// this child played that specific game (1st, 2nd, ...), matching the
// per-game "Attempt" column on the individual child scoreboard page. All
// sessions sharing the same attemptNo — regardless of which game or which
// day they happened on — are grouped into one row. E.g. if a child played
// 9 different games for the first time on day 1, then on day 2 replayed 4
// of those plus tried a 10th game for the first time, that's "Attempt 1"
// (9 + 1 first-plays = 10 tests) and "Attempt 2" (4 replays).
// ==========================================
// getTopChildren's query bakes one score_<game> column per GAMES_REGISTRY
// key into a single row (not one row per game), so an unassigned game can't
// be "filtered out" the way byGame/sessions rows are elsewhere — the only
// option is to null out that specific column. Mirrors the SORT_MAP above.
const SCORE_COL_TO_GAME = {
  score_bagiya: 'atlantis_bagiya',
  score_lottery: 'number_recall_lottery',
  score_lottery_v2: 'number_recall_lottery_v2',
  score_mela: 'rover_mela',
  score_dhyan: 'auditory_dhyan',
  score_herpher: 'working_memory_herpher',
  score_herpher_v2: 'working_memory_herpher_v2',
  score_herpher_v3: 'working_memory_herpher_v3',
  score_ankganit: 'numeracy_number_skill',
  score_ankganit_v2: 'numeracy_number_skill_v2',
  score_ankganit_v3: 'numeracy_number_skill_v3',
  score_reading: 'literacy_reading_skill',
  score_reading_v2: 'literacy_reading_skill_v2',
  score_chor: 'cognitive_flex_chor',
  score_rachna: 'triangle_rachna',
};

// ==========================================
// REGISTERED PARTICIPANTS — every registered child (not just ones who've
// played a test), filtered by the demographic filters only (gender, age,
// group, org scope, name/ID search) — same filter set already used for
// getOverviewV2's `totalRegisteredChildren` KPI. Deliberately ignores
// startDate/endDate/status/attempt/gameKey — those describe session
// activity, not registration, so they don't apply here (see parseFilters'
// comment on childOnlyClauses for the same rationale).
// ==========================================
exports.getRegisteredParticipants = async (req, res) => {
  try {
    const f = parseFilters(req);

    const childSearchClauses = [], childSearchParams = [];
    if (req.query.childId && req.query.childId.trim()) {
      const cid = req.query.childId.trim();
      childSearchClauses.push('(c.child_id = ? OR c.name LIKE ?)');
      childSearchParams.push(cid, `%${cid}%`);
    }

    const childOnlyClauses = [...f.orgClausesC, ...f.individualClausesC, ...f.genderClauses, ...f.ageClauses, ...childSearchClauses, ...f.groupClauses];
    const childOnlyParams  = [...f.orgParamsC, ...f.genderParams, ...childSearchParams, ...f.groupParams];
    const where = toWhere(childOnlyClauses);

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM children c ${where}`, childOnlyParams);

    const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const sortKey = req.query.sortKey || 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';
    const SORT_MAP = {
      childId:       'c.child_id',
      name:          'c.name',
      age:           'age',
      gender:        'c.gender',
      createdAt:     'c.created_at',
      totalSessions: 'total_sessions',
      lastActivity:  'last_activity',
    };
    const orderByCol = SORT_MAP[sortKey] || 'c.created_at';

    const [rows] = await pool.query(`
      SELECT c.child_id, c.name, c.gender, c.status,
             TIMESTAMPDIFF(YEAR, c.dob, CURDATE())        AS age,
             DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i')  AS created_at,
             o.org_name,
             (SELECT GROUP_CONCAT(cg.name ORDER BY cg.name SEPARATOR ', ')
              FROM child_group_members cgm JOIN child_groups cg ON cg.id = cgm.group_id
              WHERE cgm.children_id = c.id)                AS group_names,
             COALESCE(agg.total_sessions, 0)               AS total_sessions,
             COALESCE(agg.completed_sessions, 0)           AS completed_sessions,
             DATE_FORMAT(agg.last_activity, '%Y-%m-%d %H:%i') AS last_activity
      FROM children c
      LEFT JOIN organizations o ON c.org_id = o.id
      LEFT JOIN (
        SELECT child_id,
               COUNT(*)                                     AS total_sessions,
               CAST(SUM(status = 'completed') AS UNSIGNED)  AS completed_sessions,
               MAX(created_at)                              AS last_activity
        FROM game_sessions
        GROUP BY child_id
      ) agg ON agg.child_id = c.child_id
      ${where}
      ORDER BY ${orderByCol} ${sortDir}
      LIMIT ? OFFSET ?
    `, [...childOnlyParams, limit, offset]);

    res.json({ participants: rows, total: Number(total) || 0 });
  } catch (err) {
    console.error('Registered participants error:', err);
    res.status(500).json({ error: 'Failed to load registered participants' });
  }
};

exports.getTopChildren = async (req, res) => {
  try {
    const { allClauses, allParams } = parseFilters(req);
    const where = toWhere(allClauses);

    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const sortKey = req.query.sortKey || 'attempt';
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC';

    const SORT_MAP = {
      childId:     'child_id',
      name:        'name',
      attempt:     'attemptNo',
      testCount:   'testCount',
      completed:   'completed',
      totalScore:  'totalScore',
      totalTime:   'totalTimeMins',
      lastPlayed:  'lastPlayed',
      bagiya:      'score_bagiya',
      lottery:     'score_lottery',
      lottery_v2:  'score_lottery_v2',
      mela:        'score_mela',
      dhyan:       'score_dhyan',
      herpher:     'score_herpher',
      herpher_v2:  'score_herpher_v2',
      herpher_v3:  'score_herpher_v3',
      ankganit:    'score_ankganit',
      ankganit_v2: 'score_ankganit_v2',
      reading:     'score_reading',
      chor:        'score_chor',
      rachna:      'score_rachna',
    };
    const orderByCol = SORT_MAP[sortKey] || 'attemptNo';

    const [topChildren] = await pool.query(`
      WITH game_attempts AS (
        SELECT gs.*, c.name AS childName,
               (SELECT COUNT(*) FROM game_sessions g2
                WHERE g2.child_id = gs.child_id AND g2.game_name = gs.game_name
                  AND g2.created_at <= gs.created_at) AS attemptNo
        FROM game_sessions gs ${CHILD_JOIN} ${where}
      )
      SELECT
        ga.child_id, MAX(ga.childName) AS name,
        ga.attemptNo,
        COUNT(*)                                                        AS testCount,
        CAST(SUM(ga.status = 'completed') AS UNSIGNED)                  AS completed,
        CAST(SUM(ga.score) AS UNSIGNED)                                 AS totalScore,
        ROUND(SUM(COALESCE(CASE WHEN JSON_VALID(ga.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(ga.saved_state, '$.timerSeconds')) ELSE NULL END, CASE WHEN JSON_VALID(ga.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(ga.saved_state, '$.screentime')) ELSE NULL END, TIMESTAMPDIFF(SECOND, ga.start_time, ga.end_time))) / 60, 1) AS totalTimeMins,
        ROUND(AVG(CASE WHEN ga.game_name = 'atlantis_bagiya' THEN ga.score END), 1) AS score_bagiya,
        ROUND(AVG(CASE WHEN ga.game_name = 'number_recall_lottery' THEN ga.score END), 1) AS score_lottery,
        ROUND(AVG(CASE WHEN ga.game_name = 'number_recall_lottery_v2' THEN ga.score END), 1) AS score_lottery_v2,
        ROUND(AVG(CASE WHEN ga.game_name = 'rover_mela' THEN ga.score END), 1) AS score_mela,
        ROUND(AVG(CASE WHEN ga.game_name = 'auditory_dhyan' THEN ga.score END), 1) AS score_dhyan,
        ROUND(AVG(CASE WHEN ga.game_name = 'working_memory_herpher' THEN ga.score END), 1) AS score_herpher,
        ROUND(AVG(CASE WHEN ga.game_name = 'working_memory_herpher_v2' THEN ga.score END), 1) AS score_herpher_v2,
        ROUND(AVG(CASE WHEN ga.game_name = 'working_memory_herpher_v3' THEN ga.score END), 1) AS score_herpher_v3,
        ROUND(AVG(CASE WHEN ga.game_name = 'numeracy_number_skill' THEN ga.score END), 1) AS score_ankganit,
        ROUND(AVG(CASE WHEN ga.game_name = 'numeracy_number_skill_v2' THEN ga.score END), 1) AS score_ankganit_v2,
        ROUND(AVG(CASE WHEN ga.game_name = 'numeracy_number_skill_v3' THEN ga.score END), 1) AS score_ankganit_v3,
        ROUND(AVG(CASE WHEN ga.game_name = 'literacy_reading_skill' THEN ga.score END), 1) AS score_reading,
        ROUND(AVG(CASE WHEN ga.game_name = 'literacy_reading_skill_v2' THEN ga.score END), 1) AS score_reading_v2,
        ROUND(AVG(CASE WHEN ga.game_name = 'cognitive_flex_chor' THEN ga.score END), 1) AS score_chor,
        ROUND(AVG(CASE WHEN ga.game_name = 'triangle_rachna' THEN ga.score END), 1) AS score_rachna,
        DATE_FORMAT(MAX(ga.created_at), '%Y-%m-%d %H:%i') AS lastPlayed
      FROM game_attempts ga
      GROUP BY ga.child_id, ga.attemptNo
      ORDER BY ${orderByCol} ${sortDir}
      LIMIT ? OFFSET ?
    `, [...allParams, limit, offset]);

    let maskedTopChildren = topChildren;
    if (!req.orgScope.isSuperAdmin) {
      const assignedTests = await getOrgAssignedTests(req.orgScope.orgId);
      if (assignedTests !== null) {
        maskedTopChildren = topChildren.map(row => {
          const masked = { ...row };
          for (const [col, gameKey] of Object.entries(SCORE_COL_TO_GAME)) {
            if (!assignedTests.includes(gameKey)) masked[col] = null;
          }
          return masked;
        });
      }
    }

    res.json({ topChildren: maskedTopChildren });
  } catch (err) {
    console.error('Analysis top-children error:', err);
    res.status(500).json({ error: 'Failed to fetch top children data' });
  }
};

// ==========================================
// OVERALL V2 — executive analytics dashboard. Builds on the same filter
// engine as the rest of /analysis, but scores every session as a % of that
// game's own max (SCORE_PCT_CASE) so tests with different point scales
// (Bagiya /108 vs Ankganit /26) can be compared, ranked, and averaged
// together on one 0-100 axis. All the age/gender/test breakdowns share one
// `sd` (session detail) CTE so ageBand/scorePct/attemptNo are computed once
// and reused consistently across every aggregation below.
// ==========================================

function pickExtreme(arr, key, mode) {
  if (!arr.length) return null;
  return arr.reduce((best, cur) => {
    const bv = best[key], cv = cur[key];
    if (bv == null) return cur;
    if (cv == null) return best;
    return mode === 'max' ? (cv > bv ? cur : best) : (cv < bv ? cur : best);
  });
}

// Rule-based "AI Summary" — deterministic observations computed from the
// aggregated numbers, no external LLM call (no API cost/latency/nondeterminism).
function buildInsights({ ageAnalysis, genderAnalysis, testAnalysis, highlights, trend }) {
  const insights = [];
  const GENDER_LABEL = { male: 'Boys', female: 'Girls', other: 'Other-gender children', prefer_not_to_say: 'Children who preferred not to say', unknown: 'Children with unspecified gender' };

  const bands = ageAnalysis.filter(a => a.avgScorePct != null && a.childrenAssessed > 0);
  if (bands.length === 2) {
    const [a, b] = bands;
    const [hi, lo] = a.avgScorePct >= b.avgScorePct ? [a, b] : [b, a];
    if (hi.avgScorePct !== lo.avgScorePct) {
      insights.push({ icon: '🎯', text: `Children aged ${hi.ageBand} perform better overall — ${hi.avgScorePct}% average score vs ${lo.avgScorePct}% for ${lo.ageBand}.` });
    }
  }

  const genders = genderAnalysis.filter(g => g.avgScorePct != null && ['male', 'female'].includes(g.gender) && g.children > 0);
  if (genders.length === 2) {
    const [a, b] = genders;
    const [hi, lo] = a.avgScorePct >= b.avgScorePct ? [a, b] : [b, a];
    if (hi.avgScorePct !== lo.avgScorePct) {
      insights.push({ icon: '⚖️', text: `${GENDER_LABEL[hi.gender]} score higher on average than ${GENDER_LABEL[lo.gender].toLowerCase()} — ${hi.avgScorePct}% vs ${lo.avgScorePct}%.` });
    }
  }

  for (const g of genderAnalysis) {
    if (['male', 'female'].includes(g.gender) && g.bestTest && g.children > 0) {
      insights.push({ icon: g.gender === 'male' ? '♂️' : '♀️', text: `${GENDER_LABEL[g.gender]} perform best on "${g.bestTest.title}".` });
    }
  }

  if (highlights.mostDifficult) insights.push({ icon: '🧗', text: `"${highlights.mostDifficult.title}" is the most difficult test — only ${highlights.mostDifficult.completionPct}% of attempts are completed.` });
  if (highlights.easiest && highlights.easiest.gameKey !== highlights.mostDifficult?.gameKey) insights.push({ icon: '✅', text: `"${highlights.easiest.title}" is the easiest to complete — ${highlights.easiest.completionPct}% completion rate.` });
  if (highlights.mostScored) insights.push({ icon: '🏆', text: `"${highlights.mostScored.title}" has the highest average score at ${highlights.mostScored.avgScorePct}% of max.` });
  if (highlights.leastScored && highlights.leastScored.gameKey !== highlights.mostScored?.gameKey) insights.push({ icon: '📉', text: `"${highlights.leastScored.title}" has the lowest average score at ${highlights.leastScored.avgScorePct}% of max — may need review.` });

  const byTime = [...testAnalysis].filter(t => t.avgDurationMins > 0).sort((a, b) => b.avgDurationMins - a.avgDurationMins);
  if (byTime[0]) insights.push({ icon: '⏱️', text: `"${byTime[0].title}" takes the longest on average — ${byTime[0].avgDurationMins} min per session.` });

  const byDropoff = [...testAnalysis].filter(t => t.totalAttempts >= 5).sort((a, b) => b.dropOffPct - a.dropOffPct);
  if (byDropoff[0] && byDropoff[0].dropOffPct >= 20) insights.push({ icon: '🚪', text: `"${byDropoff[0].title}" has the highest drop-off rate at ${byDropoff[0].dropOffPct}% — children are quitting or dropping before finishing.` });

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (highlights.mostFrequent) insights.push({ icon: '🔥', text: `"${highlights.mostFrequent.title}" is the most played test with ${plural(highlights.mostFrequent.totalAttempts, 'attempt')}.` });
  if (highlights.leastFrequent && highlights.leastFrequent.gameKey !== highlights.mostFrequent?.gameKey) insights.push({ icon: '💤', text: `"${highlights.leastFrequent.title}" is the least played test with only ${plural(highlights.leastFrequent.totalAttempts, 'attempt')}.` });

  if (trend && trend.prevAvgScorePct != null && trend.currAvgScorePct != null && trend.prevSessions > 0) {
    const delta = Math.round((trend.currAvgScorePct - trend.prevAvgScorePct) * 10) / 10;
    if (Math.abs(delta) >= 0.5) {
      insights.push({ icon: delta > 0 ? '📈' : '📉', text: `Average score ${delta > 0 ? 'improved' : 'declined'} by ${Math.abs(delta)} point${Math.abs(delta) === 1 ? '' : 's'} compared to the previous period (${trend.prevAvgScorePct}% → ${trend.currAvgScorePct}%).` });
    }
  }

  const lowCompletionTests = testAnalysis.filter(t => t.totalAttempts >= 5 && t.completionPct < 40);
  if (lowCompletionTests.length > 0) {
    insights.push({ icon: '⚠️', text: `${lowCompletionTests.length} test${lowCompletionTests.length > 1 ? 's' : ''} — ${lowCompletionTests.map(t => `"${t.title}"`).join(', ')} — ${lowCompletionTests.length > 1 ? 'have' : 'has'} a completion rate below 40% and may need attention.` });
  }

  return insights;
}

// ── GET /api/analysis/overview-v2 ────────────────────────────────────────────
exports.getOverviewV2 = async (req, res) => {
  try {
    const f = parseFilters(req);

    // Organization-wise Test Assignment — this whole endpoint's `sd` CTE
    // (session-detail) is reused as the base for every downstream
    // aggregation below (KPIs, age/gender/test breakdowns, insights), so
    // restricting it once here correctly scopes everything at once, rather
    // than post-filtering each differently-shaped result individually.
    // Registered-children/demographic queries further down use their own
    // clause sets (orgClausesC etc., against the `children` table directly,
    // no game_name column) and are deliberately untouched by this.
    if (!req.orgScope.isSuperAdmin) {
      const assignedTests = await getOrgAssignedTests(req.orgScope.orgId);
      if (assignedTests !== null) {
        if (assignedTests.length === 0) {
          f.allClauses = [...f.allClauses, '1 = 0'];
        } else {
          f.allClauses = [...f.allClauses, 'gs.game_name IN (?)'];
          f.allParams = [...f.allParams, assignedTests];
        }
      }
    }

    const where = toWhere(f.allClauses);

    const sdSQL = `
      WITH sd AS (
        SELECT gs.id, gs.child_id, gs.game_name, gs.score, gs.status, gs.created_at,
               c.gender, ${AGE_BAND_CASE} AS ageBand,
               ${SCORE_PCT_CASE} AS scorePct,
               COALESCE(
                 CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.timerSeconds')) ELSE NULL END,
                 CASE WHEN JSON_VALID(gs.saved_state) THEN JSON_UNQUOTE(JSON_EXTRACT(gs.saved_state, '$.screentime')) ELSE NULL END,
                 TIMESTAMPDIFF(SECOND, gs.start_time, gs.end_time)
               ) AS durationSec,
               (SELECT COUNT(*) FROM game_sessions g2
                WHERE g2.child_id = gs.child_id AND g2.game_name = gs.game_name
                  AND g2.created_at <= gs.created_at) AS attemptNo
        FROM game_sessions gs ${CHILD_JOIN} ${where}
      )
    `;

    // ── Session-level KPIs ───────────────────────────────────────────────────
    const [[sessionKpis]] = await pool.query(`
      ${sdSQL}
      SELECT
        COUNT(*)                                     AS totalTestsConducted,
        COUNT(DISTINCT child_id)                     AS uniqueChildren,
        CAST(SUM(status = 'completed') AS UNSIGNED)  AS totalAssessmentsCompleted,
        CAST(SUM(attemptNo >= 2) AS UNSIGNED)         AS totalRepeatAssessments,
        ROUND(AVG(scorePct), 1)                       AS avgOverallScorePct,
        ROUND(AVG(durationSec) / 60, 1)                AS avgCompletionTimeMins,
        ROUND(SUM(COALESCE(scorePct, 0)) / NULLIF(COUNT(*),0), 1)      AS meanScorePctAll,
        ROUND(SUM(COALESCE(durationSec, 0)) / NULLIF(COUNT(*),0) / 60, 1) AS meanDurationAllMins,
        ROUND(STDDEV_POP(scorePct), 1)                 AS sdScorePct
      FROM sd
    `, f.allParams);

    // Median Score % — MySQL has no built-in MEDIAN()/PERCENTILE_CONT, so
    // rank scores and average the middle one (or two, for an even count).
    const [[medianRow]] = await pool.query(`
      ${sdSQL}
      SELECT ROUND(AVG(scorePct), 1) AS medianScorePct FROM (
        SELECT scorePct,
               ROW_NUMBER() OVER (ORDER BY scorePct) AS rn,
               COUNT(*) OVER ()                       AS cnt
        FROM sd
        WHERE scorePct IS NOT NULL
      ) ranked
      WHERE rn IN (FLOOR((cnt + 1) / 2), CEIL((cnt + 1) / 2))
    `, f.allParams);
    sessionKpis.medianScorePct = medianRow.medianScorePct != null ? Number(medianRow.medianScorePct) : null;

    // ── Registered children + demographic distributions — these come from the
    // `children` table directly (not date-scoped by session activity, since
    // registration is a one-time event, not something that happens "in" a
    // date range of gameplay). Child-search here matches c.child_id directly
    // rather than reusing f.childClauses, which references gs.child_id (no
    // `gs` alias exists in a children-only query). ──────────────────────────
    const childSearchClauses = [], childSearchParams = [];
    if (req.query.childId && req.query.childId.trim()) {
      const cid = req.query.childId.trim();
      childSearchClauses.push('(c.child_id = ? OR c.name LIKE ?)');
      childSearchParams.push(cid, `%${cid}%`);
    }

    const childOnlyClauses = [...f.orgClausesC, ...f.individualClausesC, ...f.genderClauses, ...f.ageClauses, ...childSearchClauses, ...f.groupClauses, ...f.cGameIntersectionClauses];
    const childOnlyParams  = [...f.orgParamsC, ...f.genderParams, ...childSearchParams, ...f.groupParams, ...f.cGameIntersectionParams];
    const [regChildRows] = await pool.query(`
      SELECT c.child_id FROM children c ${toWhere(childOnlyClauses)}
    `, childOnlyParams);
    const totalRegisteredChildren = regChildRows.length;
    const registeredChildrenIds = regChildRows.map(r => r.child_id);

    const noGenderChildClauses = [...f.orgClausesC, ...f.individualClausesC, ...f.ageClauses, ...childSearchClauses, ...f.groupClauses, ...f.cGameIntersectionClauses];
    const noGenderChildParams  = [...f.orgParamsC, ...childSearchParams, ...f.groupParams, ...f.cGameIntersectionParams];
    const [genderDistRaw] = await pool.query(`
      SELECT COALESCE(c.gender, 'unknown') AS gender, COUNT(*) AS count
      FROM children c ${toWhere(noGenderChildClauses)}
      GROUP BY c.gender
    `, noGenderChildParams);

    const noAgeChildClauses = [...f.orgClausesC, ...f.individualClausesC, ...f.genderClauses, ...childSearchClauses, ...f.groupClauses, ...f.cGameIntersectionClauses];
    const noAgeChildParams  = [...f.orgParamsC, ...f.genderParams, ...childSearchParams, ...f.groupParams, ...f.cGameIntersectionParams];
    const [ageGroupDistRaw] = await pool.query(`
      SELECT ${AGE_BAND_CASE} AS ageBand, COUNT(*) AS count
      FROM children c ${toWhere(noAgeChildClauses)}
      GROUP BY ageBand
    `, noAgeChildParams);

    // ── Age-wise performance ─────────────────────────────────────────────────
    const [ageRows] = await pool.query(`
      ${sdSQL}
      SELECT ageBand,
        COUNT(DISTINCT child_id)                     AS childrenAssessed,
        COUNT(*)                                      AS totalSessions,
        CAST(SUM(status = 'completed') AS UNSIGNED)  AS completedAssessments,
        ROUND(AVG(scorePct), 1)                       AS avgScorePct,
        ROUND(AVG(durationSec) / 60, 1)                AS avgDurationMins,
        CAST(SUM(attemptNo >= 2) AS UNSIGNED)          AS repeatSessions
      FROM sd WHERE ageBand IS NOT NULL
      GROUP BY ageBand
    `, f.allParams);

    const [ageGameRows] = await pool.query(`
      ${sdSQL}
      SELECT ageBand, game_name AS gameKey, ROUND(AVG(scorePct), 1) AS avgScorePct, COUNT(*) AS sessions
      FROM sd WHERE ageBand IS NOT NULL
      GROUP BY ageBand, game_name
    `, f.allParams);

    // ── Gender-wise performance ──────────────────────────────────────────────
    const [genderRows] = await pool.query(`
      ${sdSQL}
      SELECT COALESCE(gender, 'unknown') AS gender,
        COUNT(DISTINCT child_id)                      AS children,
        COUNT(*)                                       AS totalSessions,
        CAST(SUM(status = 'completed') AS UNSIGNED)   AS completedAssessments,
        ROUND(AVG(scorePct), 1)                        AS avgScorePct,
        ROUND(AVG(durationSec) / 60, 1)                 AS avgDurationMins,
        ROUND(SUM(status = 'completed') / NULLIF(COUNT(*),0) * 100, 1) AS completionRate,
        CAST(SUM(attemptNo >= 2) AS UNSIGNED)           AS repeatSessions
      FROM sd GROUP BY gender
    `, f.allParams);

    const [genderGameRows] = await pool.query(`
      ${sdSQL}
      SELECT COALESCE(gender, 'unknown') AS gender, game_name AS gameKey, ROUND(AVG(scorePct), 1) AS avgScorePct, COUNT(*) AS sessions
      FROM sd GROUP BY gender, game_name
    `, f.allParams);

    // ── Test-wise performance ────────────────────────────────────────────────
    const [testRows] = await pool.query(`
      ${sdSQL}
      SELECT game_name AS gameKey,
        COUNT(*)                                             AS totalAttempts,
        ROUND(AVG(score), 2)                                  AS avgScoreRaw,
        MAX(score)                                             AS maxScoreAchieved,
        MIN(score)                                             AS minScoreAchieved,
        ROUND(AVG(scorePct), 1)                               AS avgScorePct,
        CAST(SUM(status = 'completed') AS UNSIGNED)           AS completed,
        CAST(SUM(status IN ('quit','dropped')) AS UNSIGNED)   AS droppedOff,
        ROUND(AVG(durationSec) / 60, 1)                        AS avgDurationMins,
        CAST(SUM(attemptNo = 1) AS UNSIGNED)                   AS firstAttempts,
        CAST(SUM(attemptNo >= 2) AS UNSIGNED)                  AS repeatAttempts
      FROM sd GROUP BY game_name
    `, f.allParams);

    const [scoreDistRows] = await pool.query(`
      ${sdSQL}
      SELECT game_name AS gameKey, FLOOR(LEAST(scorePct, 99.999) / 20) AS bucket, COUNT(*) AS count
      FROM sd WHERE scorePct IS NOT NULL
      GROUP BY game_name, bucket
    `, f.allParams);

    const [[{ avgDurationPerChildMins }]] = await pool.query(`
      ${sdSQL}
      SELECT ROUND(AVG(childMins), 1) AS avgDurationPerChildMins FROM (
        SELECT child_id, SUM(durationSec) / 60 AS childMins FROM sd GROUP BY child_id
      ) t
    `, f.allParams);

    // ── Trend vs previous period — same-length window immediately before the
    // selected date range, every other filter held constant. ────────────────
    let trend = null;
    if (req.query.startDate && req.query.endDate) {
      const days     = Math.max(1, Math.round((new Date(`${req.query.endDate}T00:00:00`) - new Date(`${req.query.startDate}T00:00:00`)) / 86400000) + 1);
      const prevEnd   = new Date(`${req.query.startDate}T00:00:00`); prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (days - 1));
      const iso = (d) => d.toISOString().slice(0, 10);
      const prevClauses = ['gs.created_at >= ?', 'gs.created_at <= ?', ...f.orgClauses, ...f.genderClauses, ...f.statusClauses, ...f.ageClauses, ...f.childClauses, ...f.gameClauses, ...f.groupClauses, ...f.attemptClauses];
      const prevParams  = [iso(prevStart), `${iso(prevEnd)} 23:59:59`, ...f.orgParams, ...f.genderParams, ...f.statusParams, ...f.childParams, ...f.gameParams, ...f.groupParams, ...f.attemptParams];
      const [[prevKpis]] = await pool.query(`
        SELECT COUNT(*) AS sessions,
               ROUND(AVG(${SCORE_PCT_CASE}), 1) AS avgScorePct
        FROM game_sessions gs ${CHILD_JOIN} ${toWhere(prevClauses)}
      `, prevParams);
      trend = {
        prevSessions:     Number(prevKpis.sessions) || 0,
        prevAvgScorePct:  prevKpis.avgScorePct != null ? Number(prevKpis.avgScorePct) : null,
        currSessions:     Number(sessionKpis.totalTestsConducted) || 0,
        currAvgScorePct:  sessionKpis.avgOverallScorePct != null ? Number(sessionKpis.avgOverallScorePct) : null,
      };
    }

    // ── Assemble test-wise analysis + highlights ─────────────────────────────
    const BUCKET_LABELS = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'];
    const distByGame = {};
    for (const row of scoreDistRows) {
      const arr = distByGame[row.gameKey] || (distByGame[row.gameKey] = [0, 0, 0, 0, 0]);
      const b = Math.min(4, Math.max(0, Number(row.bucket)));
      arr[b] = Number(row.count);
    }

    const testAnalysis = testRows.map(r => {
      const meta = GAME_META[r.gameKey] || { title: r.gameKey, maxScore: null };
      const totalAttempts = Number(r.totalAttempts) || 0;
      return {
        gameKey: r.gameKey,
        title: meta.title,
        tag: meta.tag,
        color: meta.color,
        maxScore: meta.maxScore,
        totalAttempts,
        avgScoreRaw: Number(r.avgScoreRaw) || 0,
        maxScoreAchieved: r.maxScoreAchieved != null ? Number(r.maxScoreAchieved) : null,
        minScoreAchieved: r.minScoreAchieved != null ? Number(r.minScoreAchieved) : null,
        avgScorePct: r.avgScorePct != null ? Number(r.avgScorePct) : null,
        completed: Number(r.completed) || 0,
        completionPct: totalAttempts > 0 ? Math.round((Number(r.completed) / totalAttempts) * 100) : 0,
        droppedOff: Number(r.droppedOff) || 0,
        dropOffPct: totalAttempts > 0 ? Math.round((Number(r.droppedOff) / totalAttempts) * 100) : 0,
        avgDurationMins: Number(r.avgDurationMins) || 0,
        firstAttempts: Number(r.firstAttempts) || 0,
        repeatAttempts: Number(r.repeatAttempts) || 0,
        scoreDist: (distByGame[r.gameKey] || [0, 0, 0, 0, 0]).map((count, i) => ({ label: BUCKET_LABELS[i], count })),
      };
    });

    // Games with CUSTOM_SCORE_BUCKETS get their raw-score buckets here too,
    // overriding the generic percentage buckets above — same buckets as that
    // game's own Analysis page, so both views agree.
    for (const gameKey of Object.keys(CUSTOM_SCORE_BUCKETS)) {
      const entry = testAnalysis.find(t => t.gameKey === gameKey);
      const meta  = GAME_META[gameKey];
      if (!entry || !meta) continue;

      const bucketDefs  = buildBucketDefs(gameKey, meta.maxScore);
      const bucketCases = bucketDefs.map(({ lo, hi, label }) =>
        `CAST(SUM(${hi === null ? `score >= ${lo}` : `score BETWEEN ${lo} AND ${hi}`}) AS UNSIGNED) AS \`${label}\``
      ).join(', ');

      const [[distRaw]] = await pool.query(`
        ${sdSQL}
        SELECT ${bucketCases} FROM sd WHERE game_name = ? AND score IS NOT NULL
      `, [...f.allParams, gameKey]);

      entry.scoreDist = bucketDefs.map(({ label }) => ({ label, count: Number(distRaw[label]) || 0 }));
    }

    const highlights = {
      mostScored:    pickExtreme(testAnalysis, 'avgScorePct', 'max'),
      leastScored:   pickExtreme(testAnalysis, 'avgScorePct', 'min'),
      mostDifficult: pickExtreme(testAnalysis, 'completionPct', 'min'),
      easiest:       pickExtreme(testAnalysis, 'completionPct', 'max'),
      mostFrequent:  pickExtreme(testAnalysis, 'totalAttempts', 'max'),
      leastFrequent: pickExtreme(testAnalysis, 'totalAttempts', 'min'),
      highestDrop:   pickExtreme(testAnalysis, 'dropOffPct', 'max'),
      longestTest:   pickExtreme(testAnalysis, 'avgDurationMins', 'max'),
      mostRepeated:  pickExtreme(testAnalysis, 'repeatAttempts', 'max'),
    };

    // ── Age-wise analysis, enriched with best/worst test per band ───────────
    const ageGameMap = {};
    for (const r of ageGameRows) (ageGameMap[r.ageBand] || (ageGameMap[r.ageBand] = [])).push({ gameKey: r.gameKey, avgScorePct: Number(r.avgScorePct) || 0 });

    const ageAnalysis = Object.keys(AGE_MAP).map(band => {
      const row   = ageRows.find(r => r.ageBand === band);
      const games = ageGameMap[band] || [];
      const best  = games.length ? games.reduce((a, b) => (b.avgScorePct > a.avgScorePct ? b : a)) : null;
      const worst = games.length ? games.reduce((a, b) => (b.avgScorePct < a.avgScorePct ? b : a)) : null;
      const totalSessions = Number(row?.totalSessions) || 0;
      return {
        ageBand: band,
        childrenAssessed: Number(row?.childrenAssessed) || 0,
        completedAssessments: Number(row?.completedAssessments) || 0,
        avgScorePct: row?.avgScorePct != null ? Number(row.avgScorePct) : null,
        avgDurationMins: row?.avgDurationMins != null ? Number(row.avgDurationMins) : null,
        overallPerformancePct: row?.avgScorePct != null ? Number(row.avgScorePct) : null,
        highestScoringTest: best  ? { gameKey: best.gameKey,  title: GAME_META[best.gameKey]?.title  || best.gameKey,  avgScorePct: best.avgScorePct }  : null,
        lowestScoringTest:  worst ? { gameKey: worst.gameKey, title: GAME_META[worst.gameKey]?.title || worst.gameKey, avgScorePct: worst.avgScorePct } : null,
        repeatAssessmentRate: totalSessions > 0 ? Math.round((Number(row.repeatSessions) / totalSessions) * 100) : 0,
      };
    });

    // ── Gender-wise analysis, enriched with best/worst test per gender ──────
    const genderGameMap = {};
    for (const r of genderGameRows) (genderGameMap[r.gender] || (genderGameMap[r.gender] = [])).push({ gameKey: r.gameKey, avgScorePct: Number(r.avgScorePct) || 0 });

    const genderAnalysis = genderRows.map(row => {
      const games = genderGameMap[row.gender] || [];
      const best  = games.length ? games.reduce((a, b) => (b.avgScorePct > a.avgScorePct ? b : a)) : null;
      const worst = games.length ? games.reduce((a, b) => (b.avgScorePct < a.avgScorePct ? b : a)) : null;
      const totalSessions = Number(row.totalSessions) || 0;
      return {
        gender: row.gender,
        children: Number(row.children) || 0,
        avgScorePct: row.avgScorePct != null ? Number(row.avgScorePct) : null,
        avgDurationMins: row.avgDurationMins != null ? Number(row.avgDurationMins) : null,
        completionRate: row.completionRate != null ? Number(row.completionRate) : 0,
        bestTest:   best  ? { gameKey: best.gameKey,  title: GAME_META[best.gameKey]?.title  || best.gameKey }  : null,
        lowestTest: worst ? { gameKey: worst.gameKey, title: GAME_META[worst.gameKey]?.title || worst.gameKey } : null,
        repeatAssessmentRate: totalSessions > 0 ? Math.round((Number(row.repeatSessions) / totalSessions) * 100) : 0,
      };
    });

    // ── Rankings ──────────────────────────────────────────────────────────
    const byScoreDesc      = [...testAnalysis].filter(t => t.avgScorePct != null).sort((a, b) => b.avgScorePct - a.avgScorePct);
    const byCompletionDesc = [...testAnalysis].sort((a, b) => b.completionPct - a.completionPct);
    const bySessionsDesc   = [...testAnalysis].sort((a, b) => b.totalAttempts - a.totalAttempts);
    const byTimeAsc         = [...testAnalysis].filter(t => t.avgDurationMins > 0).sort((a, b) => a.avgDurationMins - b.avgDurationMins);
    const rankings = {
      topByScore:      byScoreDesc.slice(0, 5),
      topByCompletion: byCompletionDesc.slice(0, 5),
      topBySessions:   bySessionsDesc.slice(0, 5),
    };

    const timeAnalytics = {
      avgCompletionTimeMins: sessionKpis.avgCompletionTimeMins != null ? Number(sessionKpis.avgCompletionTimeMins) : null,
      fastestTest: byTimeAsc[0] || null,
      longestTest: byTimeAsc[byTimeAsc.length - 1] || null,
      avgDurationPerChildMins: avgDurationPerChildMins != null ? Number(avgDurationPerChildMins) : null,
      byAgeGroup: ageAnalysis.map(a => ({ ageBand: a.ageBand, avgDurationMins: a.avgDurationMins })),
      byGender: genderAnalysis.map(g => ({ gender: g.gender, avgDurationMins: g.avgDurationMins })),
    };

    const insights = buildInsights({ ageAnalysis, genderAnalysis, testAnalysis, highlights, trend });

    res.json({
      kpis: {
        registeredChildrenIds,
        totalRegisteredChildren: Number(totalRegisteredChildren) || 0,
        totalAssessmentsCompleted: Number(sessionKpis.totalAssessmentsCompleted) || 0,
        totalRepeatAssessments: Number(sessionKpis.totalRepeatAssessments) || 0,
        totalTestsConducted: Number(sessionKpis.totalTestsConducted) || 0,
        uniqueChildren: Number(sessionKpis.uniqueChildren) || 0,
        avgOverallScorePct: sessionKpis.avgOverallScorePct != null ? Number(sessionKpis.avgOverallScorePct) : null,
        avgCompletionTimeMins: sessionKpis.avgCompletionTimeMins != null ? Number(sessionKpis.avgCompletionTimeMins) : null,
        meanScorePctAll: sessionKpis.meanScorePctAll != null ? Number(sessionKpis.meanScorePctAll) : null,
        meanDurationAllMins: sessionKpis.meanDurationAllMins != null ? Number(sessionKpis.meanDurationAllMins) : null,
        sdScorePct: sessionKpis.sdScorePct != null ? Number(sessionKpis.sdScorePct) : null,
        medianScorePct: sessionKpis.medianScorePct != null ? Number(sessionKpis.medianScorePct) : null,
        genderDist: genderDistRaw.map(r => ({ gender: r.gender, count: Number(r.count) })),
        ageGroupDist: ageGroupDistRaw.filter(r => r.ageBand).map(r => ({ ageBand: r.ageBand, count: Number(r.count) })),
      },
      ageAnalysis,
      genderAnalysis,
      testAnalysis,
      highlights,
      timeAnalytics,
      rankings,
      insights,
      trend,
    });
  } catch (err) {
    console.error('Analysis overview-v2 error:', err);
    res.status(500).json({ error: 'Failed to load Overall V2 analytics' });
  }
};
