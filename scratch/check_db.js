const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    const [rows] = await pool.query("SELECT saved_state FROM game_sessions WHERE game_name = 'rover_mela' ORDER BY id DESC LIMIT 5");
    rows.forEach((r, i) => {
        console.log(`Row ${i}:`, r.saved_state);
    });
    process.exit();
}
check();
