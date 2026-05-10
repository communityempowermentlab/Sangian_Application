const mysql = require('mysql2/promise');
require('dotenv').config({ path: './server/.env' });

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10
    });

    try {
        const [rows] = await pool.query(`
            SELECT id, saved_state 
            FROM game_sessions 
            WHERE game_name = 'auditory_dhyan' 
            ORDER BY start_time DESC 
            LIMIT 1
        `);

        if (rows.length > 0) {
            console.log('Session ID:', rows[0].id);
            let state = rows[0].saved_state;
            if (typeof state === 'string') state = JSON.parse(state);
            console.log('Saved State:', JSON.stringify(state, null, 2));
        } else {
            console.log('No sessions found for auditory_dhyan');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
