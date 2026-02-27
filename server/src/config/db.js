const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sangian',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database tables
const initDb = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL Database pool connected successfully');

    // Create children table if it doesn't exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS children (
        id INT AUTO_INCREMENT PRIMARY KEY,
        child_id VARCHAR(20) UNIQUE,
        name VARCHAR(255) NOT NULL,
        dob DATE NOT NULL,
        gender ENUM('female', 'male', 'other', 'prefer_not_to_say') NOT NULL,
        mobile VARCHAR(15) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create login_sessions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS login_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        child_id VARCHAR(20),
        status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
        login_time DATETIME,
        logout_time DATETIME,
        session_duration INT,
        ip_address VARCHAR(45),
        device_type VARCHAR(50),
        browser VARCHAR(50),
        os VARCHAR(50),
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Safely add child_id to an existing table if it was created previously
    try {
      await connection.query('ALTER TABLE children ADD COLUMN child_id VARCHAR(20) UNIQUE AFTER id');
    } catch (e) {
      // Ignore error if column already exists
    }

    connection.release();
    console.log('Database tables verified/created');
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, initDb };
