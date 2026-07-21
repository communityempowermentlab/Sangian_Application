const mysql = require('mysql2/promise');

const poolConfig = {
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sangian',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else {
  poolConfig.host = process.env.DB_HOST || '127.0.0.1';
  poolConfig.port = parseInt(process.env.DB_PORT) || 3306;
}

const pool = mysql.createPool(poolConfig);

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

    // ── Ankganit Version 2 ─────────────────────────────────────────────────────
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ankganit_v2_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        minimum_correct INT DEFAULT 0,
        evaluation_type ENUM('manual', 'auto_subtraction', 'auto_division') NOT NULL DEFAULT 'manual',
        display_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ankganit_v2_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        text VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        correct_answer INT,
        remainder INT,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES ankganit_v2_categories(id) ON DELETE CASCADE
      )
    `);

    // Seed Ankganit V2 data if empty
    const [catRows] = await connection.query('SELECT COUNT(*) as count FROM ankganit_v2_categories');
    if (catRows[0].count === 0) {
      // Insert Categories
      await connection.query(`
        INSERT INTO ankganit_v2_categories (id, name, minimum_correct, evaluation_type, display_order) VALUES
        (1, 'Number Recognition (1–9)', 4, 'manual', 1),
        (2, 'Number Recognition (11–99)', 5, 'manual', 2),
        (3, 'Two-Digit Subtraction', 4, 'auto_subtraction', 3),
        (4, 'One-Digit Divisor (Three-Digit Dividend)', 2, 'auto_division', 4)
      `);
      
      // Seed questions based on user's requirements
      const v2Questions = [
        // Category 1: 8 questions
        [1, 'Identify number 3', '3', 3, null, 1],
        [1, 'Identify number 7', '7', 7, null, 2],
        [1, 'Identify number 1', '1', 1, null, 3],
        [1, 'Identify number 4', '4', 4, null, 4],
        [1, 'Identify number 8', '8', 8, null, 5],
        [1, 'Identify number 9', '9', 9, null, 6],
        [1, 'Identify number 5', '5', 5, null, 7],
        [1, 'Identify number 2', '2', 2, null, 8],
        
        // Category 2: 10 questions
        [2, 'Identify number 65', '65', 65, null, 1],
        [2, 'Identify number 38', '38', 38, null, 2],
        [2, 'Identify number 92', '92', 92, null, 3],
        [2, 'Identify number 23', '23', 23, null, 4],
        [2, 'Identify number 47', '47', 47, null, 5],
        [2, 'Identify number 72', '72', 72, null, 6],
        [2, 'Identify number 56', '56', 56, null, 7],
        [2, 'Identify number 87', '87', 87, null, 8],
        [2, 'Identify number 29', '29', 29, null, 9],
        [2, 'Identify number 11', '11', 11, null, 10],

        // Category 3: 8 questions
        [3, '51 - 35', '51,35', 16, null, 1],
        [3, '67 - 48', '67,48', 19, null, 2],
        [3, '84 - 49', '84,49', 35, null, 3],
        [3, '73 - 36', '73,36', 37, null, 4],
        [3, '56 - 37', '56,37', 19, null, 5],
        [3, '31 - 13', '31,13', 18, null, 6],
        [3, '45 - 18', '45,18', 27, null, 7],
        [3, '43 - 24', '43,24', 19, null, 8],

        // Category 4: 4 questions
        [4, '918 ÷ 7', '918,7', 131, 1, 1],
        [4, '769 ÷ 6', '769,6', 128, 1, 2],
        [4, '987 ÷ 8', '987,8', 123, 3, 3],
        [4, '513 ÷ 4', '513,4', 128, 1, 4]
      ];
      
      await connection.query(
        'INSERT INTO ankganit_v2_questions (category_id, text, title, correct_answer, remainder, display_order) VALUES ?',
        [v2Questions]
      );
    }

    // ── Automated Testing ──────────────────────────────────────────────────────
    
    // ── Number Recall V2 (Lottery Ka Ticket - V2) ──────────────────────────────
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS number_recall_v2_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        qid VARCHAR(50) NOT NULL,
        correct_sequence VARCHAR(255) NOT NULL,
        max_select INT NOT NULL,
        audio_file VARCHAR(255),
        display_order INT DEFAULT 0,
        is_teaching BOOLEAN DEFAULT FALSE,
        teaching_audio VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Seed Number Recall V2 data if empty
    const [nrV2Rows] = await connection.query('SELECT COUNT(*) as count FROM number_recall_v2_questions');
    if (nrV2Rows[0].count === 0) {
      const nrV2Data = [
        ['Practice', '3,6', 2, null, 1, true, null],
        ['Teaching 1', '2,8', 2, null, 2, true, null],
        ['Teaching 2', '5,10', 2, null, 3, true, null],
        ['1', '1,4', 2, null, 4, false, null],
        ['2', '2,6,8', 3, null, 5, false, null],
        ['3', '4,10,2', 3, null, 6, false, null],
        ['4', '8,1,9', 3, null, 7, false, null],
        ['5', '3,6,9,1', 4, null, 8, false, null],
        ['6', '8,4,1,6', 4, null, 9, false, null],
        ['7', '2,10,4,8', 4, null, 10, false, null],
        ['8', '9,1,4,8,2', 5, null, 11, false, null],
        ['9', '5,10,3,8,6', 5, null, 12, false, null],
        ['10', '2,9,4,6,10', 5, null, 13, false, null],
        ['11', '2,6,10,4,9,5', 6, null, 14, false, null],
        ['12', '8,3,5,1,10,4', 6, null, 15, false, null],
        ['13', '9,1,5,8,6,2', 6, null, 16, false, null],
        ['14', '1,2,10,6,4,9,8', 7, null, 17, false, null],
        ['15', '10,2,6,4,8,5,9', 7, null, 18, false, null],
        ['16', '4,9,5,2,10,8,6', 7, null, 19, false, null],
        ['17', '2,10,6,3,8,1,5,9', 8, null, 20, false, null],
        ['18', '3,9,2,6,1,10,4,8,5', 9, null, 21, false, null],
        ['19', '5,2,8,10,3,1,6,9,4', 9, null, 22, false, null],
        ['20', '8,4,1,6,3,9,2,10,5', 9, null, 23, false, null]
      ];
      
      await connection.query(
        'INSERT INTO number_recall_v2_questions (qid, correct_sequence, max_select, audio_file, display_order, is_teaching, teaching_audio) VALUES ?',
        [nrV2Data]
      );
    }
    await connection.query(`
      CREATE TABLE IF NOT EXISTS test_runs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        run_id       VARCHAR(64)  UNIQUE NOT NULL,
        suite        VARCHAR(100) NOT NULL DEFAULT 'all',
        triggered_by VARCHAR(100) DEFAULT 'manual',
        status       ENUM('pending','running','completed','failed') DEFAULT 'pending',
        total        INT DEFAULT 0,
        passed       INT DEFAULT 0,
        failed       INT DEFAULT 0,
        warnings     INT DEFAULT 0,
        skipped      INT DEFAULT 0,
        duration_ms  INT DEFAULT 0,
        started_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        INDEX idx_status (status),
        INDEX idx_started_at (started_at)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS test_results (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        run_id         VARCHAR(64)  NOT NULL,
        suite          VARCHAR(100) NOT NULL,
        test_name      VARCHAR(500) NOT NULL,
        category       VARCHAR(100),
        status         ENUM('passed','failed','warning','skipped','error') DEFAULT 'passed',
        severity       ENUM('critical','high','medium','low','info') DEFAULT 'info',
        message        TEXT,
        details        LONGTEXT,
        duration_ms    INT DEFAULT 0,
        dev_status     ENUM('open','in_progress','completed','blocked') DEFAULT 'open',
        dev_note       TEXT,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_run_id  (run_id),
        INDEX idx_suite   (suite),
        INDEX idx_status  (status),
        INDEX idx_dev_status (dev_status)
      )
    `);

    // Create crash_logs table for custom web error tracking
    await connection.query(`
      CREATE TABLE IF NOT EXISTS crash_logs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        fingerprint VARCHAR(16)   NOT NULL,
        message     TEXT          NOT NULL,
        stack       TEXT,
        error_type  VARCHAR(100)  DEFAULT 'Error',
        source_type VARCHAR(50)   DEFAULT 'window_error',
        severity    ENUM('fatal','error','warning','info') DEFAULT 'error',
        page_url    VARCHAR(1000),
        page_title  VARCHAR(500),
        browser     VARCHAR(150),
        os          VARCHAR(150),
        device_type VARCHAR(50),
        app_version VARCHAR(50),
        status      ENUM('open','resolved','ignored') DEFAULT 'open',
        session_id  VARCHAR(100),
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fingerprint (fingerprint),
        INDEX idx_status      (status),
        INDEX idx_severity    (severity),
        INDEX idx_created_at  (created_at)
      )
    `);

    // Screenshot Library table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS screenshot_library (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        game_key      VARCHAR(100)  NOT NULL,
        language      VARCHAR(5)    NOT NULL DEFAULT 'en',
        screen_type   VARCHAR(50)   NOT NULL DEFAULT 'gameplay',
        title         VARCHAR(255)  NOT NULL,
        description   TEXT,
        image_path    VARCHAR(500)  NOT NULL,
        sort_order    INT           DEFAULT 0,
        publish_status VARCHAR(20)  DEFAULT 'draft',
        created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_game_lang (game_key, language),
        INDEX idx_publish_status (publish_status)
      )
    `);

    // Game manual publish tracking table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_manual_publish_status (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        game_key         VARCHAR(100) NOT NULL,
        language         VARCHAR(5)   NOT NULL,
        published_at     TIMESTAMP    NULL,
        screenshot_count INT          DEFAULT 0,
        needs_republish  TINYINT(1)   DEFAULT 0,
        created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_game_lang (game_key, language)
      )
    `);

    // CMS pages table for dynamic legal/info content
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cms_pages (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        page_key         VARCHAR(100) UNIQUE NOT NULL,
        title            VARCHAR(255) NOT NULL,
        content          LONGTEXT,
        meta_title       VARCHAR(255) DEFAULT NULL,
        meta_description TEXT DEFAULT NULL,
        meta_keywords    TEXT DEFAULT NULL,
        slug             VARCHAR(150) DEFAULT NULL,
        status           TINYINT DEFAULT 1,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Safe migration: admin logo URL
    try { await connection.query("ALTER TABLE admins ADD COLUMN logo_url VARCHAR(255) DEFAULT NULL"); }
    catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (admins.logo_url):', e.message); }

    // Safe migrations for existing cms_pages installs
    const cmsMigrations = [
      ["ALTER TABLE cms_pages ADD COLUMN meta_title VARCHAR(255) DEFAULT NULL",     'cms_pages.meta_title'],
      ["ALTER TABLE cms_pages ADD COLUMN meta_description TEXT DEFAULT NULL",       'cms_pages.meta_description'],
      ["ALTER TABLE cms_pages ADD COLUMN meta_keywords TEXT DEFAULT NULL",          'cms_pages.meta_keywords'],
      ["ALTER TABLE cms_pages ADD COLUMN slug VARCHAR(150) DEFAULT NULL",           'cms_pages.slug'],
      ["ALTER TABLE cms_pages ADD COLUMN contact_email VARCHAR(255) DEFAULT NULL",  'cms_pages.contact_email'],
      ["ALTER TABLE cms_pages ADD COLUMN contact_phone VARCHAR(100) DEFAULT NULL",  'cms_pages.contact_phone'],
      ["ALTER TABLE cms_pages ADD COLUMN contact_address TEXT DEFAULT NULL",        'cms_pages.contact_address'],
      ["ALTER TABLE cms_pages ADD COLUMN contact_map_link TEXT DEFAULT NULL",       'cms_pages.contact_map_link'],
      ["ALTER TABLE cms_pages ADD COLUMN content_hi LONGTEXT DEFAULT NULL",        'cms_pages.content_hi'],
    ];
    for (const [sql, label] of cmsMigrations) {
      try { await connection.query(sql); }
      catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') console.warn(`Migration warning (${label}):`, e.message); }
    }

    // Full domain-specific Terms & Conditions content
    const TERMS_CONTENT = `<h2>Terms &amp; Conditions</h2>
<p><strong>Last updated:</strong> June 2026 &nbsp;|&nbsp; <strong>Platform:</strong> Sangian Cognitive Assessment System</p>
<h3>1. Introduction &amp; Acceptance</h3>
<p>By accessing or using the Sangian Cognitive Assessment System ("Platform"), operated by the Community Empowerment Lab ("CEL"), you agree to be bound by these Terms and Conditions. This Platform is intended exclusively for authorised users — trained assessors, programme administrators, and institutional staff — involved in the Sangian cognitive assessment programme. Unauthorised access is strictly prohibited.</p>
<h3>2. User Responsibilities</h3>
<p>All users of this Platform are expected to:</p>
<ul>
  <li>Use the system solely for its intended purpose — conducting and managing cognitive assessments for enrolled children.</li>
  <li>Maintain the confidentiality of login credentials and never share account access with unauthorised individuals.</li>
  <li>Ensure that all data entered into the system is accurate, complete, and reflects genuine assessment observations.</li>
  <li>Report any system errors, discrepancies, or security concerns to the platform administrator immediately.</li>
  <li>Comply with institutional consent and data protection protocols before registering any child participant.</li>
</ul>
<h3>3. Assessment Integrity Policy</h3>
<p>The validity of the Sangian assessment framework depends on the integrity of the data collected. The following are strictly prohibited:</p>
<ul>
  <li>Falsifying, manipulating, or coaching child responses during assessments.</li>
  <li>Entering fabricated or estimated scores in place of actual observed performance.</li>
  <li>Interfering with the scoring algorithms or game session data through unauthorised technical means.</li>
  <li>Sharing assessment tasks, instructions, or stimuli with non-authorised parties in a way that could bias future assessments.</li>
</ul>
<p>Violations may result in immediate account suspension and reporting to the relevant institutional authority.</p>
<h3>4. Assessment Participation Guidelines</h3>
<p>Assessments must be administered in accordance with the Sangian standard protocol:</p>
<ul>
  <li>Each session must be conducted in a quiet, distraction-free environment with an assessor present at all times.</li>
  <li>Child participants must have consent obtained from a parent or legal guardian prior to enrolment.</li>
  <li>Assessors must be trained and certified under the Sangian programme before conducting evaluations independently.</li>
  <li>No child should interact with the system without direct assessor supervision.</li>
</ul>
<h3>5. Content Ownership &amp; Intellectual Property</h3>
<p>All game content, scoring algorithms, assessment rubrics, visual assets, and documentation on this Platform are the intellectual property of the Community Empowerment Lab and its collaborators. Reproduction, redistribution, or commercial use without written permission is prohibited. Research publications based on data collected through this system must credit the CEL Sangian Assessment Programme.</p>
<h3>6. System Usage Rights</h3>
<p>CEL grants authorised users a limited, non-transferable licence to access and use the Platform for its intended assessment purposes. This licence does not permit reverse-engineering, bulk data scraping, or integration of unauthorised third-party tools.</p>
<h3>7. Platform Limitations &amp; Disclaimers</h3>
<p>The Sangian Platform is a research and evaluation tool. Assessment scores and analytics are indicative and must be interpreted by qualified professionals within the full context of each child's background and circumstances. CEL is not liable for data loss caused by connectivity failures, hardware issues, or force majeure events.</p>
<h3>8. Modifications to Terms</h3>
<p>CEL reserves the right to update these Terms and Conditions at any time. Continued use of the Platform following notification of changes constitutes acceptance of the revised terms.</p>
<h3>9. Governing Authority</h3>
<p>These Terms are governed in accordance with the operational policies of the Community Empowerment Lab. For queries or concerns, contact the Programme Administrator through official institutional channels.</p>`;

    // Full domain-specific Privacy Policy content
    const PRIVACY_CONTENT = `<h2>Privacy Policy</h2>
<p><strong>Last updated:</strong> June 2026 &nbsp;|&nbsp; <strong>Platform:</strong> Sangian Cognitive Assessment System</p>
<h3>1. Our Commitment to Privacy</h3>
<p>The Community Empowerment Lab ("CEL") is committed to protecting the privacy of all individuals associated with the Sangian Cognitive Assessment Programme. This Privacy Policy explains how we collect, use, store, and safeguard personal and assessment-related data. We adhere to the principles of data minimisation, purpose limitation, and ethical handling of sensitive information.</p>
<h3>2. Data We Collect</h3>
<p>The Platform collects the following categories of data:</p>
<ul>
  <li><strong>Child Profiles:</strong> Name, date of birth, gender, child ID, and profile photograph (optional). No national identity numbers or financial information are collected.</li>
  <li><strong>Assessment Data:</strong> Game session records, performance scores, response logs, time-on-task metrics, and post-session assessor observations.</li>
  <li><strong>Assessor Profiles:</strong> Name, email address, and mobile number for programme coordination purposes.</li>
  <li><strong>Session Logs:</strong> Login timestamps, device type, browser, and IP address for security and audit purposes.</li>
  <li><strong>System Diagnostics:</strong> Error logs and crash reports used to improve platform stability (no personal data embedded).</li>
</ul>
<h3>3. How We Use This Data</h3>
<p>Data collected is used exclusively for: conducting and recording standardised cognitive assessments; generating individual and aggregate performance reports; monitoring system usage to maintain security; and improving the Platform's functionality and assessment validity. Data is never used for advertising, commercial profiling, or shared with external third parties beyond programme operations.</p>
<h3>4. Role-Based Data Access</h3>
<ul>
  <li><strong>Administrators:</strong> Full access to all child records, assessor profiles, session logs, and system reports.</li>
  <li><strong>Assessors:</strong> Access limited to child profiles and session data relevant to their assigned activities.</li>
  <li><strong>Children (participant accounts):</strong> Access limited to their own profile, game dashboard, and session history.</li>
</ul>
<p>No user can access data beyond the permissions assigned to their role.</p>
<h3>5. Data Storage &amp; Security</h3>
<p>All data is stored in a secured relational database on the programme's designated server infrastructure. Security measures include: encrypted HTTPS for all data in transit; password hashing using bcrypt; JWT-based session authentication with automatic expiry; server-side input validation and SQL injection prevention; regular database backups and access logging.</p>
<h3>6. Data Sharing Policy</h3>
<p>CEL does not sell, rent, or disclose personal data to external organisations. Aggregated, de-identified data may be shared in academic research publications or programme evaluation reports, provided no individual participant can be identified. Any data sharing with partner institutions requires a formal data-sharing agreement compliant with applicable data protection standards.</p>
<h3>7. Data Retention</h3>
<p>Assessment data and child profiles are retained for the programme duration and a minimum archival period of three years post-completion. Inactive assessor accounts are deactivated after six months of inactivity. Users may request data deletion by contacting the programme administrator, subject to programme obligations and statutory retention requirements.</p>
<h3>8. User Rights</h3>
<p>Individuals whose data is held on this Platform have the right to: request access to their personal data; request correction of inaccurate information; request deletion of their data subject to legal obligations; and raise concerns through official institutional channels.</p>
<h3>9. Cookies &amp; Tracking</h3>
<p>This Platform uses minimal browser storage (localStorage) exclusively for maintaining secure session tokens. No third-party tracking cookies are deployed. Optional integration with Google Analytics may collect anonymised usage statistics not linked to individual user identities.</p>
<h3>10. Contact &amp; Governance</h3>
<p>For any privacy-related enquiries, data access requests, or concerns, please contact the Sangian Programme Administrator through your institution's designated communication channel. CEL is committed to responding to all data privacy requests within a reasonable timeframe.</p>`;

    // ── Hindi translations ────────────────────────────────────────────────────
    const TERMS_CONTENT_HI = `<h2>नियम और शर्तें</h2>
<p><strong>अंतिम अपडेट:</strong> जून 2026 &nbsp;|&nbsp; <strong>प्लेटफ़ॉर्म:</strong> संज्ञान संज्ञानात्मक मूल्यांकन प्रणाली</p>
<h3>1. परिचय और स्वीकृति</h3>
<p>संज्ञान संज्ञानात्मक मूल्यांकन प्रणाली ("प्लेटफ़ॉर्म") का उपयोग करके, जो कम्युनिटी एम्पावरमेंट लैब ("CEL") द्वारा संचालित है, आप इन नियमों और शर्तों से बंधे होने के लिए सहमत होते हैं। यह प्लेटफ़ॉर्म केवल अधिकृत उपयोगकर्ताओं के लिए है — प्रशिक्षित मूल्यांककों, कार्यक्रम प्रशासकों और संस्थागत कर्मचारियों के लिए। अनधिकृत पहुँच सख्ती से प्रतिबंधित है।</p>
<h3>2. उपयोगकर्ता की जिम्मेदारियाँ</h3>
<p>प्लेटफ़ॉर्म के सभी उपयोगकर्ताओं से अपेक्षा की जाती है कि वे:</p>
<ul>
  <li>सिस्टम का उपयोग केवल उसके निर्धारित उद्देश्य के लिए करें — नामांकित बच्चों के संज्ञानात्मक मूल्यांकन के लिए।</li>
  <li>लॉगिन क्रेडेंशियल की गोपनीयता बनाए रखें और खाता पहुँच कभी साझा न करें।</li>
  <li>सिस्टम में दर्ज सभी डेटा सटीक, पूर्ण और वास्तविक मूल्यांकन पर आधारित हो।</li>
  <li>किसी भी त्रुटि, विसंगति या सुरक्षा चिंता की तुरंत रिपोर्ट करें।</li>
  <li>किसी भी बच्चे को पंजीकृत करने से पहले संस्थागत सहमति और डेटा सुरक्षा प्रोटोकॉल का पालन करें।</li>
</ul>
<h3>3. मूल्यांकन अखंडता नीति</h3>
<p>निम्नलिखित सख्त रूप से प्रतिबंधित हैं:</p>
<ul>
  <li>मूल्यांकन के दौरान बच्चों की प्रतिक्रियाओं को झूठा बनाना, हेरफेर करना या कोचिंग देना।</li>
  <li>वास्तविक अवलोकन के बजाय काल्पनिक या अनुमानित स्कोर दर्ज करना।</li>
  <li>अनधिकृत तकनीकी माध्यमों से स्कोरिंग एल्गोरिदम या सत्र डेटा में हस्तक्षेप करना।</li>
  <li>मूल्यांकन कार्यों या निर्देशों को ऐसे तरीके से साझा करना जो भविष्य के मूल्यांकन को पक्षपातपूर्ण बना सके।</li>
</ul>
<p>उल्लंघन के परिणामस्वरूप खाता तत्काल निलंबित किया जा सकता है।</p>
<h3>4. मूल्यांकन भागीदारी दिशानिर्देश</h3>
<ul>
  <li>प्रत्येक सत्र एक शांत, विकर्षण-मुक्त वातावरण में आयोजित किया जाना चाहिए।</li>
  <li>नामांकन से पहले माता-पिता या कानूनी अभिभावक की सहमति आवश्यक है।</li>
  <li>मूल्यांककों को स्वतंत्र रूप से मूल्यांकन करने से पहले प्रशिक्षित और प्रमाणित होना चाहिए।</li>
  <li>कोई भी बच्चा सीधे मूल्यांकक की निगरानी के बिना सिस्टम के साथ इंटरैक्ट नहीं करना चाहिए।</li>
</ul>
<h3>5. सामग्री स्वामित्व और बौद्धिक संपदा</h3>
<p>इस प्लेटफ़ॉर्म पर सभी गेम सामग्री, स्कोरिंग एल्गोरिदम, मूल्यांकन रूब्रिक्स, दृश्य संपत्ति और दस्तावेज़ीकरण CEL और उसके सहयोगियों की बौद्धिक संपदा हैं। लिखित अनुमति के बिना पुनरुत्पादन, पुनर्वितरण या व्यावसायिक उपयोग प्रतिबंधित है।</p>
<h3>6. सिस्टम उपयोग अधिकार</h3>
<p>CEL अधिकृत उपयोगकर्ताओं को प्लेटफ़ॉर्म तक सीमित, गैर-हस्तांतरणीय पहुँच प्रदान करता है। यह लाइसेंस रिवर्स-इंजीनियरिंग, बल्क डेटा स्क्रैपिंग, या अनधिकृत तृतीय-पक्ष उपकरणों के एकीकरण की अनुमति नहीं देता।</p>
<h3>7. प्लेटफ़ॉर्म सीमाएँ और अस्वीकरण</h3>
<p>संज्ञान प्लेटफ़ॉर्म एक शोध और मूल्यांकन उपकरण है। मूल्यांकन स्कोर और विश्लेषण सांकेतिक हैं और योग्य पेशेवरों द्वारा प्रत्येक बच्चे की पृष्ठभूमि के संदर्भ में व्याख्यायित किए जाने चाहिए।</p>
<h3>8. नियमों में संशोधन</h3>
<p>CEL इन नियमों और शर्तों को किसी भी समय अपडेट करने का अधिकार सुरक्षित रखता है। परिवर्तनों की अधिसूचना के बाद प्लेटफ़ॉर्म का उपयोग जारी रखना संशोधित शर्तों की स्वीकृति माना जाएगा।</p>
<h3>9. शासी प्राधिकरण</h3>
<p>ये नियम CEL की परिचालन नीतियों के अनुसार शासित होते हैं। प्रश्नों या चिंताओं के लिए, आधिकारिक संस्थागत चैनलों के माध्यम से कार्यक्रम प्रशासक से संपर्क करें।</p>`;

    const PRIVACY_CONTENT_HI = `<h2>गोपनीयता नीति</h2>
<p><strong>अंतिम अपडेट:</strong> जून 2026 &nbsp;|&nbsp; <strong>प्लेटफ़ॉर्म:</strong> संज्ञान संज्ञानात्मक मूल्यांकन प्रणाली</p>
<h3>1. गोपनीयता के प्रति हमारी प्रतिबद्धता</h3>
<p>कम्युनिटी एम्पावरमेंट लैब ("CEL") संज्ञान संज्ञानात्मक मूल्यांकन कार्यक्रम से जुड़े सभी व्यक्तियों की गोपनीयता की रक्षा के लिए प्रतिबद्ध है। यह नीति बताती है कि हम व्यक्तिगत और मूल्यांकन-संबंधी डेटा को कैसे एकत्र, उपयोग, संग्रहीत और सुरक्षित करते हैं।</p>
<h3>2. हम जो डेटा एकत्र करते हैं</h3>
<ul>
  <li><strong>बच्चे की प्रोफ़ाइल:</strong> नाम, जन्म तिथि, लिंग, बच्चे की आईडी, और प्रोफ़ाइल फ़ोटोग्राफ (वैकल्पिक)। कोई राष्ट्रीय पहचान संख्या या वित्तीय जानकारी एकत्र नहीं की जाती।</li>
  <li><strong>मूल्यांकन डेटा:</strong> गेम सत्र रिकॉर्ड, प्रदर्शन स्कोर, प्रतिक्रिया लॉग, और मूल्यांकक के अवलोकन।</li>
  <li><strong>मूल्यांकक प्रोफ़ाइल:</strong> नाम, ईमेल पता, और मोबाइल नंबर।</li>
  <li><strong>सत्र लॉग:</strong> लॉगिन टाइमस्टैम्प, डिवाइस प्रकार, ब्राउज़र, और आईपी पता।</li>
  <li><strong>सिस्टम डायग्नोस्टिक्स:</strong> प्लेटफ़ॉर्म स्थिरता में सुधार के लिए त्रुटि लॉग (कोई व्यक्तिगत डेटा नहीं)।</li>
</ul>
<h3>3. हम इस डेटा का उपयोग कैसे करते हैं</h3>
<p>एकत्र किया गया डेटा केवल इन उद्देश्यों के लिए उपयोग किया जाता है: मानकीकृत संज्ञानात्मक मूल्यांकन आयोजित करना और रिकॉर्ड करना; व्यक्तिगत और समग्र प्रदर्शन रिपोर्ट तैयार करना; सुरक्षा बनाए रखना; और प्लेटफ़ॉर्म की कार्यक्षमता में सुधार करना। डेटा का उपयोग विज्ञापन, व्यावसायिक प्रोफाइलिंग, या बाहरी तृतीय पक्षों के साथ साझाकरण के लिए कभी नहीं किया जाता।</p>
<h3>4. भूमिका-आधारित डेटा पहुँच</h3>
<ul>
  <li><strong>प्रशासक:</strong> सभी बच्चों के रिकॉर्ड, मूल्यांकक प्रोफ़ाइल, सत्र लॉग और सिस्टम रिपोर्ट तक पूर्ण पहुँच।</li>
  <li><strong>मूल्यांकक:</strong> उनकी निर्धारित गतिविधियों से संबंधित बच्चों के प्रोफ़ाइल और सत्र डेटा तक सीमित पहुँच।</li>
  <li><strong>बच्चे (प्रतिभागी खाते):</strong> केवल अपनी प्रोफ़ाइल, गेम डैशबोर्ड, और सत्र इतिहास तक पहुँच।</li>
</ul>
<h3>5. डेटा संग्रहण और सुरक्षा</h3>
<p>सभी डेटा कार्यक्रम के निर्दिष्ट सर्वर इंफ्रास्ट्रक्चर पर सुरक्षित रिलेशनल डेटाबेस में संग्रहीत है। सुरक्षा उपायों में शामिल हैं: ट्रांजिट में सभी डेटा के लिए HTTPS एन्क्रिप्शन; bcrypt का उपयोग करके पासवर्ड हैशिंग; स्वचालित एक्सपायरी के साथ JWT-आधारित सत्र प्रमाणीकरण; और SQL इंजेक्शन रोकथाम।</p>
<h3>6. डेटा साझाकरण नीति</h3>
<p>CEL व्यक्तिगत डेटा को बाहरी संगठनों को नहीं बेचता, किराए पर नहीं देता या प्रकट नहीं करता। समग्र, गैर-पहचान योग्य डेटा शैक्षणिक शोध प्रकाशनों या कार्यक्रम मूल्यांकन रिपोर्ट में साझा किया जा सकता है।</p>
<h3>7. डेटा प्रतिधारण</h3>
<p>मूल्यांकन डेटा और बच्चे की प्रोफ़ाइल कार्यक्रम की अवधि और पूरा होने के बाद न्यूनतम तीन वर्षों की संग्रह अवधि के लिए रखी जाती है। निष्क्रिय मूल्यांकक खाते छह महीने की निष्क्रियता के बाद निष्क्रिय कर दिए जाते हैं।</p>
<h3>8. उपयोगकर्ता अधिकार</h3>
<p>इस प्लेटफ़ॉर्म पर डेटा रखने वाले व्यक्तियों को अधिकार है: अपने व्यक्तिगत डेटा तक पहुँच का अनुरोध; गलत जानकारी में सुधार का अनुरोध; कानूनी दायित्वों के अधीन डेटा हटाने का अनुरोध; और आधिकारिक संस्थागत चैनलों के माध्यम से चिंता उठाने का।</p>
<h3>9. कुकीज़ और ट्रैकिंग</h3>
<p>यह प्लेटफ़ॉर्म केवल सुरक्षित सत्र टोकन बनाए रखने के लिए न्यूनतम ब्राउज़र संग्रहण (localStorage) का उपयोग करता है। कोई तृतीय-पक्ष ट्रैकिंग कुकीज़ तैनात नहीं की जाती हैं।</p>
<h3>10. संपर्क और प्रशासन</h3>
<p>किसी भी गोपनीयता-संबंधी प्रश्नों, डेटा पहुँच अनुरोधों, या चिंताओं के लिए, कृपया अपनी संस्था के निर्धारित संचार चैनल के माध्यम से संज्ञान कार्यक्रम प्रशासक से संपर्क करें।</p>`;

    // Seed default CMS pages (insert if not exists, update content if still placeholder)
    const PLACEHOLDER_FRAGMENT = 'under construction';
    const [cmsRows] = await connection.query(
      "SELECT page_key, content FROM cms_pages WHERE page_key IN ('terms','privacy','terms_hi','privacy_hi')"
    );
    const cmsMap = Object.fromEntries(cmsRows.map(r => [r.page_key, r.content]));

    if (!cmsMap['terms']) {
      await connection.query(
        'INSERT INTO cms_pages (page_key, title, content, meta_title, meta_description, slug, status) VALUES (?, ?, ?, ?, ?, ?, 1)',
        ['terms', 'Terms & Conditions', TERMS_CONTENT,
          'Terms & Conditions | Sangian Assessment Programme',
          'Read the Terms and Conditions governing the use of the Sangian Cognitive Assessment Platform.',
          'terms-conditions']
      );
    } else if ((cmsMap['terms'] ?? '').includes(PLACEHOLDER_FRAGMENT)) {
      await connection.query(
        "UPDATE cms_pages SET content = ?, meta_title = ?, meta_description = ?, slug = ? WHERE page_key = 'terms'",
        [TERMS_CONTENT,
          'Terms & Conditions | Sangian Assessment Programme',
          'Read the Terms and Conditions governing the use of the Sangian Cognitive Assessment Platform.',
          'terms-conditions']
      );
    }

    if (!cmsMap['privacy']) {
      await connection.query(
        'INSERT INTO cms_pages (page_key, title, content, meta_title, meta_description, slug, status) VALUES (?, ?, ?, ?, ?, ?, 1)',
        ['privacy', 'Privacy Policy', PRIVACY_CONTENT,
          'Privacy Policy | Sangian Assessment Programme',
          'Learn how the Sangian Cognitive Assessment Platform collects, uses, and protects your data.',
          'privacy-policy']
      );
    } else if ((cmsMap['privacy'] ?? '').includes(PLACEHOLDER_FRAGMENT)) {
      await connection.query(
        "UPDATE cms_pages SET content = ?, meta_title = ?, meta_description = ?, slug = ? WHERE page_key = 'privacy'",
        [PRIVACY_CONTENT,
          'Privacy Policy | Sangian Assessment Programme',
          'Learn how the Sangian Cognitive Assessment Platform collects, uses, and protects your data.',
          'privacy-policy']
      );
    }

    // Hindi variants — insert once, never overwrite (admin edits them via CMS)
    if (!cmsMap['terms_hi']) {
      await connection.query(
        'INSERT INTO cms_pages (page_key, title, content, slug, status) VALUES (?, ?, ?, ?, 1)',
        ['terms_hi', 'नियम और शर्तें', TERMS_CONTENT_HI, 'terms-conditions']
      );
    }
    if (!cmsMap['privacy_hi']) {
      await connection.query(
        'INSERT INTO cms_pages (page_key, title, content, slug, status) VALUES (?, ?, ?, ?, 1)',
        ['privacy_hi', 'गोपनीयता नीति', PRIVACY_CONTENT_HI, 'privacy-policy']
      );
    }

    // Contact messages table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        email      VARCHAR(255) NOT NULL,
        phone      VARCHAR(50)  DEFAULT NULL,
        subject    VARCHAR(500) NOT NULL,
        message    TEXT NOT NULL,
        status     ENUM('new','in_progress','resolved') DEFAULT 'new',
        ip_address VARCHAR(45) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_status    (status),
        INDEX idx_created   (created_at)
      )
    `);

    // Contact email settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contact_email_settings (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        send_sender_email TINYINT(1) NOT NULL DEFAULT 1,
        send_admin_email  TINYINT(1) NOT NULL DEFAULT 1,
        admin_email       VARCHAR(255) DEFAULT NULL,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    // Seed singleton settings row (id=1) — INSERT IGNORE means server restarts never duplicate it
    await connection.query(
      'INSERT IGNORE INTO contact_email_settings (id, send_sender_email, send_admin_email, admin_email) VALUES (1, 1, 1, ?)',
      [process.env.ADMIN_EMAIL || null]
    );

    // Seed contact CMS page
    const [cmsContactRows] = await connection.query(
      "SELECT page_key, content_hi FROM cms_pages WHERE page_key = 'contact'"
    );
    if (!cmsContactRows.length) {
      await connection.query(
        `INSERT INTO cms_pages (page_key, title, content, content_hi, contact_email, contact_phone, contact_address,
         contact_map_link, meta_title, meta_description, slug, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        ['contact', 'Contact Us',
         '<p>We\'re here to help and would love to hear from you. Whether you have a question, feedback, or need support, feel free to reach out through the form below or any of our contact channels.</p>',
         '<p>हम आपकी सहायता के लिए हमेशा तैयार हैं और आपसे सुनकर हमें खुशी होगी। चाहे आपका कोई प्रश्न हो, सुझाव हो या सहायता की आवश्यकता हो, नीचे दिए गए फॉर्म या किसी भी संपर्क माध्यम से हमसे बेझिझक संपर्क करें।</p>',
         'support@sangian.celworld.org',
         '+91 522 000 0000',
         'F-09, 9th floor, F-Block, Tower-B, Shalimar Grand, 10, Jopling Road, Lucknow - 226001',
         '',
         'Contact Us | Sangian Assessment Programme',
         'Get in touch with the Sangian Assessment Programme team.',
         'contact-us']
      );
    } else if (cmsContactRows[0] && !cmsContactRows[0].content_hi) {
      // Backfill Hindi content for existing installs
      await connection.query(
        "UPDATE cms_pages SET content_hi = ? WHERE page_key = 'contact'",
        ['<p>हम आपकी सहायता के लिए हमेशा तैयार हैं और आपसे सुनकर हमें खुशी होगी। चाहे आपका कोई प्रश्न हो, सुझाव हो या सहायता की आवश्यकता हो, नीचे दिए गए फॉर्म या किसी भी संपर्क माध्यम से हमसे बेझिझक संपर्क करें।</p>']
      );
    }

    // Seed Help & Support FAQ page
    const [cmsHelpRows] = await connection.query(
      "SELECT page_key FROM cms_pages WHERE page_key = 'help'"
    );
    if (!cmsHelpRows.length) {
      const defaultFaqs = JSON.stringify([
        { id: '1', q: 'How long does it take to get a response?',  a: 'Our team typically responds within 1–2 business days. Complex issues may take slightly longer.' },
        { id: '2', q: 'What types of issues can I raise?',          a: 'Technical bugs, login problems, game session issues, data concerns, or any platform-related questions.' },
        { id: '3', q: 'Can I attach screenshots?',                  a: 'Yes — you can attach up to 3 images (JPG, PNG, or WEBP, max 5 MB each) when creating a ticket or replying.' },
        { id: '4', q: 'How do I track my ticket?',                  a: 'Use "My Tickets" with your verified email to see the full conversation thread and current status.' },
      ]);
      await connection.query(
        'INSERT INTO cms_pages (page_key, title, content, slug, status) VALUES (?, ?, ?, ?, 1)',
        ['help', 'Help & Support FAQ', defaultFaqs, 'help']
      );
    }

    // ── Help & Support Ticket System ──────────────────────────────────────────

    // Email OTP verification table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        email      VARCHAR(255) NOT NULL,
        otp        VARCHAR(6)   NOT NULL,
        expires_at DATETIME     NOT NULL,
        verified   TINYINT      DEFAULT 0,
        attempts   INT          DEFAULT 0,
        created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_otp (email)
      )
    `);

    // Support tickets table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id VARCHAR(20)  UNIQUE NOT NULL,
        email     VARCHAR(255) NOT NULL,
        title     VARCHAR(255) NOT NULL,
        description TEXT        NOT NULL,
        status    ENUM('open','in_progress','waiting_for_user','resolved','closed') DEFAULT 'open',
        created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email     (email),
        INDEX idx_status    (status),
        INDEX idx_ticket_id (ticket_id),
        INDEX idx_created   (created_at)
      )
    `);

    // Ticket messages (conversation thread) table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id   VARCHAR(20) NOT NULL,
        sender_type ENUM('user','admin') NOT NULL,
        message     TEXT        NOT NULL,
        attachments JSON,
        created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ticket_id (ticket_id),
        INDEX idx_created   (created_at)
      )
    `);

    // ── Help & Support bilingual content table ────────────────────────────────

    await connection.query(`
      CREATE TABLE IF NOT EXISTS help_support_content (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        section_key VARCHAR(50)  NOT NULL,
        language    VARCHAR(5)   NOT NULL,
        title       VARCHAR(255) NOT NULL,
        content     LONGTEXT,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_section_lang (section_key, language),
        INDEX idx_section (section_key),
        INDEX idx_lang (language)
      )
    `);

    // Seed bilingual content for all 3 sections
    const hscRows = await connection.query('SELECT section_key, language FROM help_support_content');
    const hscExisting = new Set(hscRows[0].map(r => `${r.section_key}:${r.language}`));

    const CT_EN_HTML = `<p>If you are facing any issue related to the Sangian assessment system, you can raise a support ticket. Our support team will help you resolve your issue as quickly as possible.</p><h3>Key Instructions</h3><ul><li>Email verification is required before creating a ticket</li><li>A verification code will be sent to your email</li><li>After verification, you can submit your issue</li><li>Provide a clear title and detailed description</li><li>You may attach up to 3 relevant images for better understanding</li></ul><h3>Guidelines</h3><ul><li>Use a valid email address only</li><li>Avoid duplicate tickets for the same issue</li><li>Attach screenshots if available</li><li>Response time may vary based on issue priority</li></ul>`;
    const CT_HI_HTML = `<p>अगर आपको Sangian assessment system में कोई समस्या आ रही है, तो आप यहाँ से अपना सपोर्ट टिकट बना सकते हैं। हमारी टीम आपकी समस्या को जल्दी हल करने की कोशिश करेगी।</p><h3>मुख्य निर्देश</h3><ul><li>टिकट बनाने से पहले ईमेल वेरिफिकेशन जरूरी है</li><li>आपके ईमेल पर एक OTP भेजा जाएगा</li><li>वेरिफाई करने के बाद ही टिकट बन सकता है</li><li>समस्या का टाइटल और पूरा विवरण लिखें</li><li>आप अधिकतम 3 तस्वीरें जोड़ सकते हैं</li></ul><h3>नियम</h3><ul><li>केवल सही ईमेल का उपयोग करें</li><li>एक ही समस्या के लिए बार-बार टिकट न बनाएं</li><li>स्क्रीनशॉट जोड़ना मददगार होगा</li><li>जवाब देने में समय लग सकता है</li></ul>`;
    const MT_EN_HTML = `<p>Track all your submitted support requests in one place. You can view ticket status, responses, and communicate with our support team directly.</p><h3>Features</h3><ul><li>View all your tickets using your registered email</li><li>Track ticket status: Open, In Progress, Waiting, Resolved, Closed</li><li>View full conversation history</li><li>Reply directly to ongoing tickets</li><li>Upload additional evidence if needed (max 3 images per reply)</li></ul><h3>Guidelines</h3><ul><li>Keep your email consistent for tracking tickets</li><li>Check status regularly for updates</li><li>Use reply feature for follow-up communication</li><li>Do not create duplicate tickets for same issue</li></ul>`;
    const MT_HI_HTML = `<p>यहाँ आप अपने सभी बनाए हुए सपोर्ट टिकट देख सकते हैं। आप टिकट की स्थिति और जवाब देख सकते हैं और हमारी टीम से बात कर सकते हैं।</p><h3>सुविधाएँ</h3><ul><li>अपने ईमेल से सभी टिकट देखें</li><li>टिकट की स्थिति देखें: नया, प्रगति में, इंतजार में, हल हो गया, बंद</li><li>पूरी बातचीत देखें</li><li>सीधे जवाब दें</li><li>जरूरत पड़ने पर 3 तस्वीरें जोड़ें</li></ul><h3>नियम</h3><ul><li>हमेशा एक ही ईमेल का उपयोग करें</li><li>समय-समय पर अपडेट देखें</li><li>रिप्लाई के जरिए बात करें</li><li>एक ही समस्या के लिए नया टिकट न बनाएं</li></ul>`;

    const FAQ_EN = JSON.stringify([
      { id:'1', q:'Why do I need email verification?',            a:'Email verification ensures that only genuine users can create tickets and helps us track communication securely.' },
      { id:'2', q:'How long does it take to get a response?',     a:'Response time depends on the issue type. Usually, critical issues are handled within 24–48 hours.' },
      { id:'3', q:'Can I edit my ticket after submission?',       a:'No, but you can reply to the ticket to provide additional information.' },
      { id:'4', q:'What file types are allowed in attachments?',  a:'You can upload JPG, PNG, and WEBP images only (max 3 per message).' },
      { id:'5', q:'Can I create multiple tickets for the same issue?', a:'No, please update the existing ticket instead of creating duplicates.' },
      { id:'6', q:'How will I know my ticket is updated?',        a:'You will receive an email notification whenever there is a reply or status change.' },
      { id:'7', q:'What if I lose my ticket ID?',                 a:'You can retrieve your tickets using your registered email address.' },
      { id:'8', q:'Who handles my tickets?',                      a:'All tickets are handled by the Sangian support and assessment operations team.' },
      { id:'9', q:'Can I reopen a closed ticket?',                a:'No, but you can create a new ticket referencing the old issue.' },
      { id:'10',q:'Is my data safe?',                             a:'Yes, all data is securely stored and only used for support and system improvement.' },
    ]);

    const FAQ_HI = JSON.stringify([
      { id:'1', q:'ईमेल वेरिफिकेशन क्यों जरूरी है?',        a:'यह सुनिश्चित करता है कि केवल सही उपयोगकर्ता ही टिकट बना सके और सुरक्षा बनी रहे।' },
      { id:'2', q:'जवाब आने में कितना समय लगता है?',         a:'आमतौर पर 24–48 घंटे में जवाब मिल जाता है, समस्या पर निर्भर करता है।' },
      { id:'3', q:'क्या मैं टिकट एडिट कर सकता हूँ?',         a:'नहीं, लेकिन आप रिप्लाई करके जानकारी जोड़ सकते हैं।' },
      { id:'4', q:'कौन-कौन सी फाइल अपलोड कर सकते हैं?',      a:'आप JPG, PNG, WEBP इमेज अपलोड कर सकते हैं (अधिकतम 3)।' },
      { id:'5', q:'क्या एक ही समस्या के लिए कई टिकट बना सकते हैं?', a:'नहीं, एक ही टिकट को अपडेट करना चाहिए।' },
      { id:'6', q:'मुझे अपडेट कैसे मिलेगा?',                  a:'जब भी जवाब या स्टेटस बदलेगा, आपको ईमेल मिलेगा।' },
      { id:'7', q:'अगर टिकट ID खो जाए तो?',                   a:'आप ईमेल से अपने सभी टिकट देख सकते हैं।' },
      { id:'8', q:'मेरा टिकट कौन देखता है?',                   a:'Sangian सपोर्ट टीम आपके टिकट को देखती है।' },
      { id:'9', q:'क्या बंद टिकट फिर से खोल सकते हैं?',       a:'नहीं, लेकिन नया टिकट बना सकते हैं।' },
      { id:'10',q:'क्या मेरा डेटा सुरक्षित है?',               a:'हाँ, आपका डेटा सुरक्षित रखा जाता है और केवल सपोर्ट के लिए उपयोग होता है।' },
    ]);

    const hscSeed = [
      ['create_ticket', 'en', 'Create a New Support Ticket',  CT_EN_HTML],
      ['create_ticket', 'hi', 'नया सपोर्ट टिकट बनाएं',       CT_HI_HTML],
      ['my_tickets',    'en', 'My Tickets',                    MT_EN_HTML],
      ['my_tickets',    'hi', 'मेरे टिकट',                    MT_HI_HTML],
      ['faq',           'en', 'Frequently Asked Questions',    FAQ_EN],
      ['faq',           'hi', 'अक्सर पूछे जाने वाले प्रश्न', FAQ_HI],
    ];

    for (const [section_key, language, title, content] of hscSeed) {
      if (!hscExisting.has(`${section_key}:${language}`)) {
        await connection.query(
          'INSERT INTO help_support_content (section_key, language, title, content) VALUES (?, ?, ?, ?)',
          [section_key, language, title, content]
        );
      }
    }

    // Safe migration: add is_read to ticket_messages (1=read by recipient, 0=unread)
    try {
      await connection.query("ALTER TABLE ticket_messages ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 1");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (ticket_messages.is_read):', e.message);
    }

    // ── SMTP settings singleton table ──────────────────────────────────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS smtp_settings (
        id           INT          PRIMARY KEY DEFAULT 1,
        host         VARCHAR(255) DEFAULT NULL,
        port         INT          DEFAULT 587,
        username     VARCHAR(255) DEFAULT NULL,
        password     TEXT         DEFAULT NULL,
        encryption   ENUM('none','tls','ssl') DEFAULT 'tls',
        from_email   VARCHAR(255) DEFAULT NULL,
        from_name    VARCHAR(100) DEFAULT 'Sangian Support',
        updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await connection.query(`INSERT IGNORE INTO smtp_settings (id) VALUES (1)`);

    // ── Help & Support email notification settings singleton table ─────────────
    await connection.query(`
      CREATE TABLE IF NOT EXISTS help_email_settings (
        id                   INT        PRIMARY KEY DEFAULT 1,
        send_user_email      TINYINT(1) DEFAULT 1,
        send_admin_email     TINYINT(1) DEFAULT 1,
        send_on_admin_reply  TINYINT(1) DEFAULT 1,
        send_on_user_reply   TINYINT(1) DEFAULT 1,
        admin_email          VARCHAR(255) DEFAULT NULL,
        updated_at           TIMESTAMP  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await connection.query(
      `INSERT IGNORE INTO help_email_settings (id, send_user_email, send_admin_email, send_on_admin_reply, send_on_user_reply, admin_email)
       VALUES (1, 1, 1, 1, 1, ?)`,
      [process.env.ADMIN_EMAIL || null]
    );

    // Create test_elements table for managing static assets (splash screens, etc.)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS test_elements (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        test_id     VARCHAR(100) NOT NULL,
        asset_type  VARCHAR(50)  NOT NULL,
        language    VARCHAR(10)  NOT NULL,
        file_name   VARCHAR(255) NOT NULL,
        file_path   VARCHAR(500) NOT NULL,
        is_active   TINYINT(1)   DEFAULT 1,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_test_asset_lang_file (test_id, asset_type, language, file_name)
      )
    `);

    // Ensure we run the migration for existing tables safely
    try {
      await connection.query('ALTER TABLE test_elements DROP INDEX uq_test_asset_lang');
      await connection.query('ALTER TABLE test_elements ADD UNIQUE KEY uq_test_asset_lang_file (test_id, asset_type, language, file_name)');
    } catch (e) {}
    
    try {
      await connection.query('ALTER TABLE test_elements ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER file_path');
    } catch (e) {}

    // Seed existing splash screens for all games to preserve backward compatibility
    const allSeeds = [
      {
        test_id: 'atlantis_bagiya',
        seeds: [
          { lang: 'en', path: '/assets/images/bagiya/bagiya_english.png', name: 'bagiya_english.png' },
          { lang: 'hi', path: '/assets/images/bagiya/bagiya_hindi.jpg', name: 'bagiya_hindi.jpg' },
          { lang: 'mr', path: '/assets/images/bagiya/bagiya_marathi.png', name: 'bagiya_marathi.png' },
          { lang: 'te', path: '/assets/images/bagiya/bagiya_telugu.png', name: 'bagiya_telugu.png' },
          { lang: 'kn', path: '/assets/images/bagiya/bagiya_kannada.png', name: 'bagiya_kannada.png' },
        ]
      }
    ];

    const genericDefaults = {
      'number_recall_lottery': { path: '/assets/images/lottery_ka_ticket/lottery_ka_ticket.jpg', name: 'lottery_ka_ticket.jpg' },
      'number_recall_lottery_v2': { path: '/assets/images/lottery_ka_ticket/lottery_ka_ticket.jpg', name: 'lottery_ka_ticket.jpg' },
      'rover_mela': { path: '/assets/images/chalo_mela_chale/chalo_mela_chale.jpg', name: 'chalo_mela_chale.jpg' },
      'auditory_dhyan': { path: '/assets/images/dhyan_kahan_hai/dhyan_kahan_hai.jpg', name: 'dhyan_kahan_hai.jpg' },
      'working_memory_herpher': { path: '/assets/images/her_pher/her_pher.jpg', name: 'her_pher.jpg' },
      'numeracy_number_skill': { path: '/assets/images/number_skill/number_skill.jpg', name: 'number_skill.jpg' },
      'literacy_reading_skill': { path: '/assets/images/reading_skill/reading_skill.jpg', name: 'reading_skill.jpg' },
      'cognitive_flex_chor': { path: '/assets/images/chor_machaye_shor/chor_machaye_shor.jpg', name: 'chor_machaye_shor.jpg' },
      'triangle_rachna': { path: '/assets/images/rachna/rachna.jpg', name: 'rachna.jpg' }
    };

    const languages = ['en', 'hi', 'mr', 'te', 'kn'];

    for (const [test_id, asset] of Object.entries(genericDefaults)) {
      const testSeeds = languages.map(lang => ({
        lang,
        path: asset.path,
        name: asset.name
      }));
      allSeeds.push({ test_id, seeds: testSeeds });
    }

    const hpSeeds = [];
    // Tools -> item0 (14)
    for(let i=1; i<=14; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item0/${i}.png`, name: `${i}.png`, type: 'item0' });
    // Birds -> item1 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item1/${i}.png`, name: `${i}.png`, type: 'item1' });
    // Vegetables -> item2 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item2/${i}.png`, name: `${i}.png`, type: 'item2' });
    // Sports -> item3 (14)
    for(let i=1; i<=14; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item3/${i}.png`, name: `${i}.png`, type: 'item3' });
    // Flowers -> item4 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item4/${i}.png`, name: `${i}.png`, type: 'item4' });
    // Insects -> item5 (11)
    for(let i=1; i<=11; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item5/${i}.png`, name: `${i}.png`, type: 'item5' });
    // Household -> item6 (14)
    for(let i=1; i<=14; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item6/${i}.png`, name: `${i}.png`, type: 'item6' });
    // Animals -> item7 (14)
    for(let i=1; i<=14; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item7/${i}.png`, name: `${i}.png`, type: 'item7' });
    // Transport -> item8 (14)
    for(let i=1; i<=14; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item8/${i}.png`, name: `${i}.png`, type: 'item8' });

    allSeeds.push({
      test_id: 'working_memory_herpher',
      seeds: hpSeeds
    });

    for (const test of allSeeds) {
      for (const seed of test.seeds) {
        const type = seed.type || 'splash_screen';
        await connection.query(
          'INSERT IGNORE INTO test_elements (test_id, asset_type, language, file_name, file_path) VALUES (?, ?, ?, ?, ?)',
          [test.test_id, type, seed.lang, seed.name, seed.path]
        );
      }
    }

    connection.release();
    console.log('Database tables verified/created');
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, initDb };
