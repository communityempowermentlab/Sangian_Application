require('dotenv').config({ path: './server/.env' });
const { pool } = require('./server/src/config/db');
async function test() {
  const [rows] = await pool.query(`SELECT id, start_time, saved_state FROM game_sessions WHERE game_name = 'working_memory_herpher' ORDER BY id DESC LIMIT 1`);
  console.log(JSON.stringify(rows[0], null, 2));
  process.exit(0);
}
test();
