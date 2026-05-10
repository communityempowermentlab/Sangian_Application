require('dotenv').config();
const { pool } = require('./src/config/db');

async function check() {
  try {
    const [rows] = await pool.query("SELECT game_name, saved_state FROM game_sessions WHERE game_name LIKE '%auditory%' OR game_name LIKE '%dhyan%' LIMIT 5;");
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('DB Check Error:', e);
    process.exit(1);
  }
}

check();
