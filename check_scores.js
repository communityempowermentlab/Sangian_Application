require('dotenv').config({ path: './server/.env' });
const { pool } = require('./server/src/config/db');

async function main() {
  try {
    const [rows] = await pool.query(
      'SELECT game_name, attempt_no, score, saved_state FROM game_sessions WHERE child_id = ? ORDER BY start_time ASC',
      ['CH050']
    );

    const gameCounts = {};
    rows.forEach(row => {
        const gName = row.game_name;
        gameCounts[gName] = (gameCounts[gName] || 0) + 1;
        row.attempt_no = gameCounts[gName];
    });

    for (const row of rows) {
      console.log(`\n=============================`);
      console.log(`Game: ${row.game_name} (Attempt #${row.attempt_no})`);
      console.log(`Stored Score: ${row.score}`);
      try {
        const state = typeof row.saved_state === 'string' ? JSON.parse(row.saved_state) : row.saved_state;
        if (state) {
          // Attempt to calculate actual score based on common fields:
          console.log(`Saved State Score: ${state.score}`);
          if (state.questions) {
             const qs = state.questions;
             let totalPoints = 0;
             qs.forEach(q => {
                 if (q.points) totalPoints += q.points;
                 if (q.isCorrect === true || q.isCorrect === 'true') totalPoints += 1;
             });
             console.log(`Calculated Questions Score (sum of points): ${totalPoints}`);
             console.log(`Questions length: ${qs.length}`);
          } else {
             console.log(`Saved State keys:`, Object.keys(state));
             if (state.totalScore) console.log(`Saved State totalScore: ${state.totalScore}`);
          }
          console.log(`Saved State:`, JSON.stringify(state).substring(0, 300) + '...');
        } else {
          console.log('No saved_state');
        }
      } catch (e) {
        console.error('Error parsing saved_state', e);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
