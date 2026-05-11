const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({ host: '127.0.0.1', port: 8889, user: 'root', password: 'root', database: 'sangian' });
  const gameFilter = ['rover_mela', 'chalo_mela_chale', 'Chalo Mela Chale', 'Rover Test', 'Rover Game'];
  const [rows] = await pool.query('SELECT COUNT(*) as c FROM game_sessions WHERE game_name IN (?)', [gameFilter]);
  console.log('Count IN (?)', rows);
}
test();
