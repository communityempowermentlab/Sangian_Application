const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({ host: '127.0.0.1', port: 8889, user: 'root', password: 'root', database: 'sangian' });
  const [rows] = await pool.query("SELECT * FROM game_sessions WHERE game_name IN ('rover_mela', 'chalo_mela_chale', 'Chalo Mela Chale') LIMIT 1");
  console.log(JSON.stringify(rows, null, 2));
}
test();
