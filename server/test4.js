const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({ host: '127.0.0.1', port: 8889, user: 'root', password: 'root', database: 'sangian' });
  const gameFilter = ['rover_mela', 'chalo_mela_chale', 'Chalo Mela Chale', 'Rover Test', 'Rover Game'];
  const [rows] = await pool.query('SELECT gs.id AS session_id, gs.game_name, gs.saved_state FROM game_sessions gs WHERE gs.game_name IN (?) ORDER BY gs.start_time DESC LIMIT 5', [gameFilter]);
  console.log(JSON.stringify(rows, null, 2));
}
test();
