const mysql = require('mysql2/promise');
async function test() {
  const pool = mysql.createPool({ host: '127.0.0.1', port: 8889, user: 'root', password: 'root', database: 'sangian' });
  const gameFilter = ['rover_mela', 'chalo_mela_chale', 'Chalo Mela Chale', 'Rover Test', 'Rover Game'];
  const [rows] = await pool.query('SELECT gs.id AS session_id, gs.saved_state FROM game_sessions gs WHERE gs.game_name IN (?)', [gameFilter]);
  rows.forEach(r => {
      let state = r.saved_state;
      try {
          if (typeof state === 'string') state = JSON.parse(state);
          if (typeof state === 'string') state = JSON.parse(state);
      } catch(e) {}
      const scores = state?.allScores || [];
      if (!Array.isArray(scores)) {
          console.log(`Session ${r.session_id} has allScores of type ${typeof scores}:`, scores);
      }
  });
}
test();
