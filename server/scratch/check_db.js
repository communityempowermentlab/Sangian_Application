const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env' });

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 8889,
  user: 'root',
  password: 'root',
  database: 'sangian',
});

async function checkTable() {
    try {
        const [rows] = await pool.query('SHOW TABLES LIKE "assessors"');
        if (rows.length === 0) {
            console.log('TABLE MISSING: assessors');
        } else {
            console.log('TABLE EXISTS: assessors');
            const [desc] = await pool.query('DESCRIBE assessors');
            console.log(desc);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkTable();
