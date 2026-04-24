
const mysql = require('mysql2/promise');
require('dotenv').config();

async function update() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        await connection.execute("ALTER TABLE game_sessions MODIFY COLUMN status ENUM('in_progress', 'completed', 'quit', 'paused', 'dropped') NOT NULL DEFAULT 'in_progress'");
        console.log('Database schema updated successfully');
    } catch (err) {
        console.error('Update failed:', err.message);
    } finally {
        await connection.end();
    }
}

update();
