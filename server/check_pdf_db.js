require('dotenv').config({ path: './.env' });
const { pool } = require('./src/config/db');

async function main() {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM game_dashboard_pdfs WHERE session_id = 346`
    );
    console.table(rows);
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}
main();
