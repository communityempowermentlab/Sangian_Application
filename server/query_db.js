const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 8889,
    user: 'root',
    password: 'root',
    database: 'sangian'
  });
  
  const [rows] = await pool.query("SELECT saved_state FROM game_sessions WHERE game_name='triangle_rachna' ORDER BY id DESC LIMIT 1");
  console.log(JSON.stringify(rows[0], null, 2));
  process.exit(0);
}
run();
