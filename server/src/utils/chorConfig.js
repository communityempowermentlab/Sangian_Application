// Chor Machaye Shor (cognitive_flex_chor) report/analysis constants.
//
// Items 5, 8 and 9 are deactivated in Elements (since 2026-08-18), so the test
// that is actually played has 8 items:
//   max score       = item 1 (trial 1: 5 + trial 2: 2) + 7 items x 5 = 42
//   total questions = item 1 counts twice (two trials) + 7 items     = 9
// The game itself saves total_questions = 11 on every session (its fixed
// TOTAL_QUESTIONS constant), so reports override that with this value instead
// of changing the game. Update both numbers if items are re-enabled.
const CHOR_MAX_SCORE = 42;
const CHOR_TOTAL_QUESTIONS = 9;
const CHOR_GAME_NAMES = ['cognitive_flex_chor', 'chor_machaye_shor'];

const isChorGame = (gameName) => CHOR_GAME_NAMES.includes(gameName);

// SQL replacement for `gs.total_questions` in session queries.
const TOTAL_QUESTIONS_SQL = `CASE WHEN gs.game_name IN (${CHOR_GAME_NAMES.map(n => `'${n}'`).join(', ')})
  THEN ${CHOR_TOTAL_QUESTIONS} ELSE gs.total_questions END AS total_questions`;

// Items no longer played. Sessions recorded before they were deactivated
// (live: 30 sessions, last on 2026-08-18) contain results for them and could
// score up to 57, so they are not comparable with the current 42-point test.
const CHOR_RETIRED_ITEM_IDS = [5, 8, 9];

// Analysis-only WHERE clause (on `gs`) that leaves out those legacy Chor
// sessions. Reports/CSV still show them as historical records. COALESCE keeps
// sessions with no/invalid saved_state (JSON_CONTAINS -> NULL) included.
const EXCLUDE_LEGACY_CHOR_SQL = `NOT (gs.game_name IN (${CHOR_GAME_NAMES.map(n => `'${n}'`).join(', ')}) AND COALESCE(
  JSON_VALID(gs.saved_state) AND (${CHOR_RETIRED_ITEM_IDS.map(id =>
    `JSON_CONTAINS(JSON_EXTRACT(gs.saved_state, '$.itemResults[*].itemId'), '${id}')`).join(' OR ')}), FALSE))`;

// Report display numbering: original item id -> number the child sees in the
// game ("Question N", which skips inactive items). Retired items have none.
const CHOR_DISPLAY_NUMBER = { 1: 1, 2: 2, 3: 3, 4: 4, 6: 5, 7: 6, 10: 7, 11: 8 };

module.exports = {
  CHOR_MAX_SCORE, CHOR_TOTAL_QUESTIONS, CHOR_GAME_NAMES, CHOR_RETIRED_ITEM_IDS, CHOR_DISPLAY_NUMBER,
  isChorGame, TOTAL_QUESTIONS_SQL, EXCLUDE_LEGACY_CHOR_SQL,
};
