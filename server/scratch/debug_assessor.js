const { pool } = require('../src/config/db');

async function check() {
    try {
        const [rows] = await pool.query('SELECT * FROM assessors');
        console.log('Assessors in DB:', rows);
        
        const testEmail = 'test@gmail.com';
        const [existing] = await pool.query('SELECT id FROM assessors WHERE email = ?', [testEmail]);
        console.log(`Query for ${testEmail}:`, existing);
        console.log('Length:', existing.length);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
