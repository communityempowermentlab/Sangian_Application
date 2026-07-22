const mysql = require('mysql2/promise');
require('dotenv').config({path: './.env'});
async function run() {
  const pool = mysql.createPool({
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sangian',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306
  });
  const [rows] = await pool.query("SELECT id, text, title FROM ankganit_v2_questions WHERE title LIKE '%,%'");
  console.log(rows);
  process.exit(0);
}
run();
