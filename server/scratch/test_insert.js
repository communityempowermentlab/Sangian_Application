const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '127.0.0.1',
  port: 8889,
  user: 'root',
  password: 'root',
  database: 'sangian',
});

async function testInsert() {
    try {
        const name = 'Test Assessor';
        const email = 'test@example.com';
        const mobile = '1234567890';
        
        console.log('Checking existing email...');
        const [existing] = await pool.query('SELECT id FROM assessors WHERE email = ?', [email]);
        console.log('Existing:', existing);
        
        console.log('Attempting insert...');
        const [result] = await pool.query(
            'INSERT INTO assessors (name, email, mobile_number) VALUES (?, ?, ?)',
            [name, email, mobile]
        );
        console.log('Insert Result:', result);
        
        console.log('Cleaning up...');
        await pool.query('DELETE FROM assessors WHERE email = ?', [email]);
        console.log('Cleanup done.');
        
    } catch (e) {
        console.error('DATABASE ERROR:', e);
    } finally {
        process.exit();
    }
}

testInsert();
