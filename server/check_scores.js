require('dotenv').config({ path: './.env' });
const { pool } = require('./src/config/db');

async function main() {
  try {
    const [rows] = await pool.query(
      'SELECT session_id, COUNT(*) as count FROM game_dashboard_pdfs GROUP BY session_id HAVING count > 1'
    );
    console.log("Duplicate PDFs:", rows);
    
    // Check how getGameHistory behaves for those
    if (rows.length > 0) {
       const [dupSessions] = await pool.query(
          'SELECT gs.id, gs.game_name, gs.score, pdf.file_path FROM game_sessions gs LEFT JOIN game_dashboard_pdfs pdf ON pdf.session_id = gs.id WHERE gs.id = ?',
          [rows[0].session_id]
       );
       console.log("Dup session join result:", dupSessions);
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

main();
