require('dotenv').config({ path: './.env' });
const { pool } = require('./src/config/db');

async function main() {
  try {
    const [rows] = await pool.query(
      `SELECT gs.id, gs.game_name, gs.start_time, gs.score
       FROM game_sessions gs
       WHERE gs.child_id = 'CH041' AND gs.game_name = 'literacy_reading_skill'
       ORDER BY gs.start_time ASC`
    );
    console.log("=== RAW game_sessions ===");
    console.table(rows);

    const [oldQuery] = await pool.query(
      `SELECT gs.id, gs.game_name, gs.start_time, gs.score, pdf.file_path AS pdf_url
       FROM game_sessions gs
       LEFT JOIN game_dashboard_pdfs pdf ON pdf.session_id = gs.id
       WHERE gs.child_id = 'CH041' AND gs.game_name = 'literacy_reading_skill'
       ORDER BY gs.start_time ASC`
    );
    console.log("=== OLD getGameHistory Query ===");
    console.table(oldQuery);
    
    const [newQuery] = await pool.query(
      `SELECT gs.id, gs.game_name, gs.start_time, gs.score,
       (SELECT file_path FROM game_dashboard_pdfs WHERE session_id = gs.id ORDER BY id DESC LIMIT 1) AS pdf_url 
       FROM game_sessions gs
       WHERE gs.child_id = 'CH041' AND gs.game_name = 'literacy_reading_skill'
       ORDER BY gs.start_time ASC`
    );
    console.log("=== NEW getGameHistory Query ===");
    console.table(newQuery);

  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}
main();
