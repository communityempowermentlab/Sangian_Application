const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS game_dashboard_pdfs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                child_id VARCHAR(100) NOT NULL,
                session_id VARCHAR(100) NOT NULL,
                game_name VARCHAR(100) NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session (session_id)
            )
        `);
        console.log("Table game_dashboard_pdfs created successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await connection.end();
    }
}

migrate();
