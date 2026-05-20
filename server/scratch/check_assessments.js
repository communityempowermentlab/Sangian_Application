require('dotenv').config();
const { pool } = require('../src/config/db');

async function check() {
    try {
        console.log('Querying recent game sessions...');
        const [sessions] = await pool.query('SELECT * FROM game_sessions ORDER BY id DESC LIMIT 5');
        console.log('Recent sessions:', JSON.stringify(sessions, null, 2));

        console.log('Querying recent game assessments...');
        const [assessments] = await pool.query('SELECT * FROM game_assessments ORDER BY id DESC LIMIT 5');
        console.log('Recent assessments:', JSON.stringify(assessments, null, 2));

        console.log('Testing a dry run insertion to game_assessments...');
        // Let's find a valid session id if any exists
        if (sessions.length > 0) {
            const sess = sessions[0];
            console.log(`Using session ID: ${sess.id}, child ID: ${sess.child_id}`);
            try {
                const [result] = await pool.query(
                    `INSERT INTO game_assessments 
                     (session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again, q5_behaviors, additional_notes) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        sess.id,
                        sess.child_id,
                        'Yes, a lot',
                        'Not much',
                        'Not much',
                        'Not much',
                        JSON.stringify([]),
                        'Dry run test'
                    ]
                );
                console.log('Dry run insertion succeeded! Inserted ID:', result.insertId);
            } catch (err) {
                console.error('Dry run insertion failed:', err);
            }
        } else {
            console.log('No game sessions found to test insertion.');
        }

    } catch (error) {
        console.error('Database connection / check failed:', error);
    } finally {
        process.exit(0);
    }
}

check();
