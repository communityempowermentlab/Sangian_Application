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
        status ENUM('active', 'inactive') DEFAULT 'active',
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

    // Create admins table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create game_sessions table for tracking numeracy/other game progress
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        child_id VARCHAR(20) NOT NULL,
        game_name VARCHAR(50) NOT NULL,
        start_time DATETIME,
        end_time DATETIME,
        score INT DEFAULT 0,
        total_questions INT DEFAULT 0,
        progress_level INT DEFAULT 1,
        status ENUM('in_progress', 'completed', 'quit', 'paused', 'dropped') DEFAULT 'in_progress',
        quit_reason VARCHAR(255),
        saved_state JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create game_assessments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_assessments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        child_id VARCHAR(20) NOT NULL,
        q1_enjoyment VARCHAR(50),
        q2_feeling VARCHAR(50),
        q3_tiredness VARCHAR(50),
        q4_play_again VARCHAR(50),
        q5_behaviors JSON,
        additional_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
      )
    `);

    // Create admin_login_sessions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_login_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT,
        status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
        login_time DATETIME,
        logout_time DATETIME,
        session_duration INT,
        ip_address VARCHAR(45),
        device_type VARCHAR(50),
        browser VARCHAR(50),
        os VARCHAR(50),
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
      )
    `);

    // Seed default admin
    const [adminRows] = await connection.query('SELECT id FROM admins WHERE email = ?', ['admin@sangian.com']);
    if (adminRows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('sangian123', 10);
      await connection.query('INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)', ['admin@sangian.com', hash, 'Sangian Admin']);
    }

    // Safely add child_id to an existing table if it was created previously
    try {
      await connection.query('ALTER TABLE children ADD COLUMN child_id VARCHAR(20) UNIQUE AFTER id');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (child_id):', e.message);
    }

    // Safely add status to an existing table if it was created previously
    try {
      await connection.query('ALTER TABLE children ADD COLUMN status ENUM(\'active\', \'inactive\') DEFAULT \'active\' AFTER mobile');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (children.status):', e.message);
    }

    // Safely add photo column to children table
    try {
      await connection.query("ALTER TABLE children ADD COLUMN photo VARCHAR(255) DEFAULT NULL AFTER mobile");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (children.photo):', e.message);
    }

    // Safely update game_sessions status enum to include 'dropped'
    try {
      await connection.query("ALTER TABLE game_sessions MODIFY COLUMN status ENUM('in_progress', 'completed', 'quit', 'paused', 'dropped') DEFAULT 'in_progress'");
    } catch (e) {
      console.warn('Migration warning (game_sessions.status):', e.message);
    }

    // Create game_documents table for wiki-style per-game documentation
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_key VARCHAR(80) NOT NULL,
        content LONGTEXT NOT NULL,
        updated_by VARCHAR(100) DEFAULT 'admin',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_game_key (game_key)
      )
    `);

    // Create game_document_versions table for version history
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_document_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_key VARCHAR(80) NOT NULL,
        content LONGTEXT NOT NULL,
        saved_by VARCHAR(100) DEFAULT 'admin',
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_game_key (game_key)
      )
    `);

    // Create assessors table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assessors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile_number VARCHAR(15) NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);

    // Safely add status to assessors table
    try {
      await connection.query("ALTER TABLE assessors ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active' AFTER mobile_number");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (assessors.status):', e.message);
    }

    connection.release();
    console.log('Database tables verified/created');
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, initDb };
