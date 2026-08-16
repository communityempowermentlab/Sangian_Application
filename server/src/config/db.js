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

// Multi-tenant foundation (Organizations, Individuals, Supervisors,
// Volunteers, OTP-gated registration, assessment traceability) — grouped
// into one function, called once at the end of initDb(), so this entire
// feature's DDL is auditable as a single unit rather than interleaved with
// the rest of the schema. Follows the same idempotent conventions as the
// rest of this file: CREATE TABLE IF NOT EXISTS for new tables, guarded
// ALTER TABLE ADD COLUMN (ignoring ER_DUP_FIELDNAME) for columns added to
// tables that already exist live.
const initMultiTenantSchema = async (connection) => {
  // Organizations — self-registers, held in `registration_status='pending'`
  // until a Super Admin approves it (see adminOrgController). org_type is a
  // free VARCHAR (not an ENUM) and extra_attributes is a JSON escape hatch
  // so future org kinds (Schools, NGOs, Hospitals, ...) don't need schema
  // changes.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_name VARCHAR(255) NOT NULL,
      org_type VARCHAR(50) NOT NULL DEFAULT 'ngo',
      org_email VARCHAR(255) UNIQUE NOT NULL,
      org_mobile VARCHAR(20) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      address VARCHAR(500),
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100),
      contact_person_name VARCHAR(255),
      contact_person_designation VARCHAR(150),
      email_verified TINYINT DEFAULT 0,
      mobile_verified TINYINT DEFAULT 0,
      registration_status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending',
      status ENUM('active', 'inactive') DEFAULT 'active',
      approved_by_admin_id INT NULL,
      approved_at DATETIME NULL,
      rejection_reason VARCHAR(500) NULL,
      extra_attributes JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (approved_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
    )
  `);

  // Individual users — self-registers, no approval step, active immediately
  // once both OTP channels are verified.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS individual_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email_verified TINYINT DEFAULT 0,
      mobile_verified TINYINT DEFAULT 0,
      status ENUM('active', 'inactive') DEFAULT 'active',
      registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Mirrors admin_login_sessions/staff_login_sessions exactly (same
  // columns/semantics), scoped to organizations and individuals respectively.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS org_login_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT,
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
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL
    )
  `);

  // Generalized audit log for Organization-side actions — mirrors
  // staff_activity_logs' actor-capture convention (denormalized actor name
  // + server-captured IP), extended with actor_type/actor_id since an
  // organization's activity can be produced by the org account itself OR
  // by one of its org-bound staff (see requireAdminOrOrgAuth.js's "ceiling"
  // model) OR by a Super Admin acting on the org's behalf — the spec's
  // audit trail needs to distinguish which. Immutability is enforced by
  // omission: no UPDATE/DELETE route is ever built against this table.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS organization_activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      org_name VARCHAR(255),
      actor_type ENUM('organization', 'staff', 'admin') NOT NULL DEFAULT 'organization',
      actor_id INT NULL,
      actor_name VARCHAR(255),
      module VARCHAR(100) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      description TEXT,
      record_type VARCHAR(100),
      record_id VARCHAR(100),
      record_name VARCHAR(255),
      previous_value JSON,
      new_value JSON,
      metadata JSON,
      ip_address VARCHAR(45),
      browser VARCHAR(50),
      os VARCHAR(50),
      device_type VARCHAR(50),
      session_id INT,
      status ENUM('success', 'failure') NOT NULL DEFAULT 'success',
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      INDEX idx_org_created (org_id, created_at)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS individual_login_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      individual_id INT,
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
      FOREIGN KEY (individual_id) REFERENCES individual_users(id) ON DELETE SET NULL
    )
  `);

  // OTP verification for registration — deliberately separate from the
  // existing `email_verifications` table (server/src/controllers/
  // ticketController.js), which is single-purpose for support-ticket email
  // verification. `channel` covers both email and phone (phone OTP is
  // currently displayed on-screen rather than sent via SMS — no SMS
  // gateway is integrated yet; see server/src/services/smsService.js).
  await connection.query(`
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      channel ENUM('email', 'phone') NOT NULL,
      identifier VARCHAR(255) NOT NULL,
      purpose ENUM('individual_registration', 'org_registration', 'individual_email_change', 'individual_mobile_change', 'org_email_change', 'org_mobile_change') NOT NULL,
      otp VARCHAR(6) NOT NULL,
      expires_at DATETIME NOT NULL,
      verified TINYINT DEFAULT 0,
      attempts INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_channel_identifier_purpose (channel, identifier, purpose)
    )
  `);

  // Supervisors — the mid-hierarchy role between Staff and Volunteer
  // (Org -> Staff -> Supervisor -> Volunteer -> Child). Deliberately a new
  // table rather than an extension of the pre-existing `assessors` table:
  // `assessors` is a directory-only list (no password, no org scoping, no
  // FK to anything) backing an unrelated, already-live admin feature —
  // retrofitting login/org-scoping onto it would risk regressing that
  // feature. password_hash is nullable: Supervisor self-login isn't wired
  // up yet (org/admin manage these records on the Supervisor's behalf), but
  // the column exists so that can be added later without a schema change.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS supervisors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      designation VARCHAR(150) NULL,
      password_hash VARCHAR(255) NULL,
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_by_type ENUM('admin', 'org') DEFAULT 'org',
      created_by_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_supervisor_org_email (org_id, email),
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // Volunteers — bottom of the org hierarchy, optionally linked to the
  // Supervisor who manages them.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS volunteers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NOT NULL,
      supervisor_id INT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NULL,
      mobile VARCHAR(20) NOT NULL,
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_by_type ENUM('admin', 'org') DEFAULT 'org',
      created_by_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL
    )
  `);

  // Assessment sessions — the traceability "Assessment" entity linking an
  // Organization/Supervisor/Staff/Volunteer to a Child's game-play. NOT the
  // same thing as the pre-existing `game_assessments` table, which is the
  // post-game "how did you feel" questionnaire — kept deliberately
  // distinctly named to avoid confusing the two. child_id is a bare
  // VARCHAR (not an FK) to match the existing convention used by
  // game_sessions/login_sessions, since `children.child_id` (not `id`) is
  // the identifier used throughout the child-facing flow.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS assessment_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      org_id INT NULL,
      child_id VARCHAR(20) NOT NULL,
      conducted_by_role ENUM('staff', 'supervisor', 'volunteer', 'self') DEFAULT 'self',
      staff_id INT NULL,
      supervisor_id INT NULL,
      volunteer_id INT NULL,
      status ENUM('in_progress', 'completed', 'abandoned') DEFAULT 'in_progress',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME NULL,
      device_type VARCHAR(50),
      browser VARCHAR(50),
      os VARCHAR(50),
      ip_address VARCHAR(45),
      location VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
      FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE SET NULL,
      FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE SET NULL,
      INDEX idx_child (child_id)
    )
  `);

  // Org-scope children to their owning organization/supervisor/volunteer.
  // Nullable so every pre-existing child row (created before this feature
  // existed) stays exactly as visible/editable to the Super Admin as it is
  // today — org_id is only set going forward for org-created children.
  const alterColumn = async (table, ddl, label) => {
    try {
      await connection.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn(`Migration warning (${label}):`, e.message);
    }
  };

  // Sibling of alterColumn for adding a UNIQUE index to an existing column
  // (ADD COLUMN's DDL shape doesn't cover this). ER_DUP_KEYNAME means the
  // index already exists (idempotent re-run); any other error (e.g.
  // ER_DUP_ENTRY from pre-existing duplicate values) is logged, not thrown —
  // schema init must never crash server startup.
  const addUniqueIndex = async (table, indexName, column, label) => {
    try {
      await connection.query(`ALTER TABLE ${table} ADD UNIQUE KEY ${indexName} (${column})`);
    } catch (e) {
      if (e.code !== 'ER_DUP_KEYNAME') console.warn(`Migration warning (${label}):`, e.message);
    }
  };

  // Widens an existing ENUM column's allowed values — CREATE TABLE IF NOT
  // EXISTS above never applies to an already-existing table, so a
  // pre-existing otp_verifications table (created before the
  // individual_email_change/individual_mobile_change purposes existed)
  // needs this explicit MODIFY to accept them. Safe to re-run every
  // startup — MODIFYing an ENUM to the same definition is a no-op.
  const widenEnum = async (table, column, ddl, label) => {
    try {
      await connection.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} ${ddl}`);
    } catch (e) {
      console.warn(`Migration warning (${label}):`, e.message);
    }
  };
  await widenEnum(
    'otp_verifications', 'purpose',
    "ENUM('individual_registration', 'org_registration', 'individual_email_change', 'individual_mobile_change', 'org_email_change', 'org_mobile_change') NOT NULL",
    'otp_verifications.purpose'
  );

  await alterColumn('children', 'org_id INT NULL AFTER id', 'children.org_id');
  await alterColumn('children', 'supervisor_id INT NULL AFTER org_id', 'children.supervisor_id');
  await alterColumn('children', 'volunteer_id INT NULL AFTER supervisor_id', 'children.volunteer_id');

  // Org-scope assessors, same convention as children.org_id — NULL
  // preserves every pre-existing assessor row as Super-Admin-managed
  // (unchanged); only assessors created by/for an organization going
  // forward get this set. See adminAssessorController.js.
  await alterColumn('assessors', 'org_id INT NULL AFTER id', 'assessors.org_id');

  // Assessor self-login — password_hash is nullable so pre-existing
  // assessor rows (added before this feature) simply can't log in until
  // an admin sets a password via Add/Edit/Reset Password; remarks is a
  // free-text admin note field. See adminAssessorController.js /
  // assessorAuthController.js.
  await alterColumn('assessors', 'password_hash VARCHAR(255) NULL', 'assessors.password_hash');
  await alterColumn('assessors', 'remarks VARCHAR(500) NULL', 'assessors.remarks');

  // Close pre-existing schema drift: these columns are already read/written
  // throughout childController.js/adminChildController.js but were never
  // formally created here — they only exist on the live DB via undocumented
  // manual ALTERs. Adding them here (idempotently) makes the source of
  // truth match reality instead of perpetuating the drift.
  await alterColumn('children', 'father_name VARCHAR(225) NULL', 'children.father_name');
  await alterColumn('children', 'mother_name VARCHAR(225) NULL', 'children.mother_name');
  await alterColumn('children', 'remarks VARCHAR(500) NULL', 'children.remarks');
  await alterColumn('children', 'gram_sabha VARCHAR(255) NULL', 'children.gram_sabha');
  await alterColumn('children', 'hamlet VARCHAR(255) NULL', 'children.hamlet');

  // Org-scope staff. NULL preserves every existing staff row as
  // Super-Admin-managed (today's behavior, unchanged) — only staff created
  // by/for an organization going forward get this set.
  await alterColumn('staff', 'org_id INT NULL AFTER id', 'staff.org_id');

  // Org-scope child groups — same convention as children/assessors/staff's
  // org_id, routed the same way (requireAdminOrOrgAuth + resolveOrgScope):
  // Super Admin explicitly picks the organization; an org-bound staff
  // account or Organization login gets its own org_id stamped
  // automatically. See adminChildGroupController.js.
  await alterColumn('child_groups', 'org_id INT NULL AFTER id', 'child_groups.org_id');

  // Mobile-number uniqueness for Organizations and Individuals — org_email/
  // individual_users.email are already UNIQUE in their CREATE TABLE above;
  // mobile wasn't, so it's added here (matches staff.mobile, which already
  // has this). Both registration controllers also check for a duplicate
  // mobile explicitly before insert, so this constraint is the DB-level
  // backstop, not the only guard.
  await addUniqueIndex('organizations', 'uq_org_mobile', 'org_mobile', 'organizations.org_mobile');
  await addUniqueIndex('individual_users', 'uq_individual_mobile', 'mobile', 'individual_users.mobile');

  // Module permission grants for Organizations — a flat array of granted
  // module keys, e.g. ["dashboard","children"], same all-or-nothing model
  // as staff.permissions (checking a module grants full view/add/edit/
  // delete/... access to it). NULL/missing key means no access to that
  // module at all (fail-closed — see requireAdminOrOrgAuth.js).
  await alterColumn('organizations', 'permissions JSON NULL', 'organizations.permissions');

  // Login/logout audit detail for organizations — mirrors staff_login_
  // sessions.logout_status but as an enum specific to how the spec wants
  // logout events classified, plus a failure reason for failed attempts.
  await alterColumn('org_login_sessions', "failure_reason VARCHAR(255) NULL", 'org_login_sessions.failure_reason');
  await alterColumn('org_login_sessions', "logout_type ENUM('manual','expired','forced','system') NULL", 'org_login_sessions.logout_type');

  // Traceability + device-info columns on game_sessions. All nullable so
  // ordinary child self-play (no assessment_session_id) is entirely
  // unaffected — these only populate when a game is started from an
  // assessment-session deep link (see Phase F / gameController.js).
  await alterColumn('game_sessions', 'org_id INT NULL', 'game_sessions.org_id');
  await alterColumn('game_sessions', 'assessment_session_id INT NULL', 'game_sessions.assessment_session_id');
  await alterColumn('game_sessions', 'staff_id INT NULL', 'game_sessions.staff_id');
  await alterColumn('game_sessions', 'supervisor_id INT NULL', 'game_sessions.supervisor_id');
  await alterColumn('game_sessions', 'volunteer_id INT NULL', 'game_sessions.volunteer_id');
  await alterColumn('game_sessions', 'device_type VARCHAR(50) NULL', 'game_sessions.device_type');
  await alterColumn('game_sessions', 'browser VARCHAR(50) NULL', 'game_sessions.browser');
  await alterColumn('game_sessions', 'os VARCHAR(50) NULL', 'game_sessions.os');
  await alterColumn('game_sessions', 'ip_address VARCHAR(45) NULL', 'game_sessions.ip_address');
  await alterColumn('game_sessions', 'location VARCHAR(255) NULL', 'game_sessions.location');

  // Assessor traceability — mirrors staff_id/supervisor_id/volunteer_id
  // above but sourced from login_sessions.assessor_id (an Assessor never
  // goes through the assessment_sessions chain those columns come from;
  // see gameController.js's startGameSession for how this gets populated).
  // No FK (same convention as the columns above — assessors is created
  // later in this file).
  await alterColumn('login_sessions', 'assessor_id INT NULL', 'login_sessions.assessor_id');
  await alterColumn('game_sessions', 'assessor_id INT NULL', 'game_sessions.assessor_id');

  // Individual traceability — an Individual plays as their own linked
  // child profile (auto-provisioned at registration, one-to-one). Mirrors
  // the assessor_id columns above exactly: children.individual_id is the
  // forward link (individual -> their own child row); login_sessions/
  // game_sessions.individual_id let existing org-scoped reports/analysis
  // and the Individual's own "My Reports" page filter by it without a
  // join through children. No FK, same convention as everything else here.
  await alterColumn('children', 'individual_id INT NULL', 'children.individual_id');
  await alterColumn('login_sessions', 'individual_id INT NULL', 'login_sessions.individual_id');
  await alterColumn('game_sessions', 'individual_id INT NULL', 'game_sessions.individual_id');

  // Reporting-continuity only — lets the post-game questionnaire be
  // filtered/joined by organization without a join through game_sessions.
  await alterColumn('game_assessments', 'org_id INT NULL', 'game_assessments.org_id');
};

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

    // Staff Management module — a second, restricted login identity distinct
    // from `admins` (kept as a separate table, not a role column on `admins`,
    // so the existing admin table/queries stay completely untouched).
    await connection.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile VARCHAR(20) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        permissions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Mirrors admin_login_sessions exactly (same columns/semantics), scoped
    // to staff — reuses the same capture/duration-calc logic server-side.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS staff_login_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id INT,
        status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
        login_time DATETIME,
        logout_time DATETIME,
        session_duration INT,
        logout_status ENUM('normal', 'force_logout') NULL,
        ip_address VARCHAR(45),
        device_type VARCHAR(50),
        browser VARCHAR(50),
        os VARCHAR(50),
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
      )
    `);

    // Generalized audit log for staff actions — same actor-capture
    // convention as child_profile_edit_logs (denormalized actor name +
    // server-captured IP), generalized to module/action/description instead
    // of field-diff specific.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS staff_activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        staff_id INT,
        staff_name VARCHAR(255),
        module VARCHAR(100) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        description TEXT,
        menu_name VARCHAR(100),
        page_name VARCHAR(150),
        record_id VARCHAR(100),
        record_name VARCHAR(255),
        metadata JSON,
        ip_address VARCHAR(45),
        browser VARCHAR(50),
        os VARCHAR(50),
        device_type VARCHAR(50),
        session_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
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

    // 'rejected' — the terminal state for a session whose final score
    // submission was blocked because the child was no longer Active at
    // save time (see gameController.js's updateGameSession). Distinct from
    // 'quit'/'dropped' (the child/assessor abandoned it) — this is the
    // system refusing to persist a result, not an abandonment.
    try {
      await connection.query("ALTER TABLE game_sessions MODIFY COLUMN status ENUM('in_progress', 'completed', 'quit', 'paused', 'dropped', 'rejected') DEFAULT 'in_progress'");
    } catch (e) {
      console.warn('Migration warning (game_sessions.status rejected):', e.message);
    }

    // Captures the child's status at the moment this game session was
    // created — audit/traceability only (per the Assessor spec's
    // "Assessment Session Protection"). Must NEVER be used to authorize a
    // later action; the score-save check in updateGameSession always
    // re-reads live children.status instead of trusting this snapshot.
    try {
      await connection.query("ALTER TABLE game_sessions ADD COLUMN child_status_at_start VARCHAR(20) NULL AFTER status");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (game_sessions.child_status_at_start):', e.message);
    }

    // Widen children.status to support the full Active/Inactive/Suspended/
    // Deleted model (soft-delete — see adminChildController.js). Only
    // 'active' is ever eligible for a new or continuing assessment; the
    // other three all behave identically from the Assessor flow's
    // perspective (blocked), they just record *why* for the admin side.
    try {
      await connection.query("ALTER TABLE children MODIFY COLUMN status ENUM('active', 'inactive', 'suspended', 'deleted') DEFAULT 'active'");
    } catch (e) {
      console.warn('Migration warning (children.status widen):', e.message);
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
        email VARCHAR(255) NOT NULL,
        mobile_number VARCHAR(15) NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      )
    `);

    // Assessor email/mobile uniqueness is enforced per-organization at the
    // application level (adminAssessorController.js), not globally — the
    // same email can be reused by an assessor in a different organization.
    // A pre-existing DB from before this change still has the old global
    // `email VARCHAR(255) UNIQUE` index, which would reject that at the DB
    // layer regardless of the app-level check, so drop it here (the plain,
    // non-unique idx_email index stays, so email lookups are still
    // indexed). No-ops on a fresh install, where CREATE TABLE above never
    // created the unique index in the first place.
    try {
      await connection.query('ALTER TABLE assessors DROP INDEX email');
    } catch (e) {
      if (e.code !== 'ER_CANT_DROP_FIELD_OR_KEY') console.warn('Migration warning (assessors drop unique email index):', e.message);
    }

    // Safely add status to assessors table
    try {
      await connection.query("ALTER TABLE assessors ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active' AFTER mobile_number");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (assessors.status):', e.message);
    }

    // Assessor login sessions — mirrors individual_login_sessions/
    // org_login_sessions. Assessors log in via /login (the same page that
    // already handles the child-search step) to gate that step behind an
    // authenticated assessor identity; see assessorAuthController.js.
    // Must be created after the `assessors` table above (FK reference).
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assessor_login_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessor_id INT,
        status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
        login_time DATETIME,
        logout_time DATETIME,
        session_duration INT,
        ip_address VARCHAR(45),
        device_type VARCHAR(50),
        browser VARCHAR(50),
        os VARCHAR(50),
        location VARCHAR(255),
        failure_reason VARCHAR(255) NULL,
        logout_type ENUM('manual', 'expired', 'forced', 'system') NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessor_id) REFERENCES assessors(id) ON DELETE SET NULL
      )
    `);

    // Closes schema drift for a DB where assessor_login_sessions was
    // created before failure_reason/logout_type existed on it (CREATE
    // TABLE IF NOT EXISTS above never adds columns to an already-existing
    // table). No-ops on a fresh install, where the CREATE TABLE above
    // already includes both columns.
    try {
      await connection.query('ALTER TABLE assessor_login_sessions ADD COLUMN failure_reason VARCHAR(255) NULL');
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (assessor_login_sessions.failure_reason):', e.message);
    }
    try {
      await connection.query("ALTER TABLE assessor_login_sessions ADD COLUMN logout_type ENUM('manual','expired','forced','system') NULL");
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.warn('Migration warning (assessor_login_sessions.logout_type):', e.message);
    }

    // Generalized audit log for Assessor-related actions — direct port of
    // organization_activity_logs, scoped to assessor_id instead of org_id.
    // actor_type covers both the assessor's own self-service actions
    // (login/logout) and admin/org/staff-side management actions (create,
    // edit, password reset, force-logout) performed on the assessor's
    // record. Immutability is enforced by omission: no UPDATE/DELETE route
    // is ever built against this table.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assessor_activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessor_id INT NOT NULL,
        assessor_name VARCHAR(255),
        actor_type ENUM('assessor', 'admin', 'organization', 'staff') NOT NULL DEFAULT 'assessor',
        actor_id INT NULL,
        actor_name VARCHAR(255),
        module VARCHAR(100) NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        description TEXT,
        record_type VARCHAR(100),
        record_id VARCHAR(100),
        record_name VARCHAR(255),
        previous_value JSON,
        new_value JSON,
        metadata JSON,
        ip_address VARCHAR(45),
        browser VARCHAR(50),
        os VARCHAR(50),
        device_type VARCHAR(50),
        session_id INT,
        status ENUM('success', 'failure') NOT NULL DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessor_id) REFERENCES assessors(id) ON DELETE CASCADE,
        INDEX idx_assessor_created (assessor_id, created_at)
      )
    `);

    // Clean per-field edit diff trail for the Edit History tab — direct
    // port of organization_profile_edit_logs, scoped to assessor_id.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assessor_profile_edit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessor_id INT NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        updated_by_id INT,
        updated_by_name VARCHAR(255),
        ip_address VARCHAR(45),
        action_type VARCHAR(50) DEFAULT 'update',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessor_id) REFERENCES assessors(id) ON DELETE CASCADE
      )
    `);

    // Create child_groups table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS child_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description VARCHAR(500),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create child_group_members table — keyed on children.id (the stable numeric
    // PK), not the mutable string child_id, so renaming a child's ID never needs
    // to cascade into group membership the way it does for login_sessions /
    // game_sessions / game_assessments / game_dashboard_pdfs.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS child_group_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        children_id INT NOT NULL,
        group_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_child_group (children_id, group_id),
        FOREIGN KEY (children_id) REFERENCES children(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES child_groups(id) ON DELETE CASCADE
      )
    `);

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

    // ── Ankganit Version 3 (independent clone of V2 — own tables, own FK scope) ─

    await connection.query(`
      CREATE TABLE IF NOT EXISTS ankganit_v3_categories (
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
      CREATE TABLE IF NOT EXISTS ankganit_v3_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        text VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        correct_answer INT,
        remainder INT,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES ankganit_v3_categories(id) ON DELETE CASCADE
      )
    `);

    // Seed Ankganit V3 data if empty (same content as V2 — independent copy)
    const [catRowsV3] = await connection.query('SELECT COUNT(*) as count FROM ankganit_v3_categories');
    if (catRowsV3[0].count === 0) {
      await connection.query(`
        INSERT INTO ankganit_v3_categories (id, name, minimum_correct, evaluation_type, display_order) VALUES
        (1, 'Number Recognition (1–9)', 4, 'manual', 1),
        (2, 'Number Recognition (10–99)', 5, 'manual', 2),
        (3, 'Two-Digit Subtraction', 4, 'auto_subtraction', 3),
        (4, 'One-Digit Divisor (Three-Digit Dividend)', 2, 'auto_division', 4)
      `);

      const v3Questions = [
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
        'INSERT INTO ankganit_v3_questions (category_id, text, title, correct_answer, remainder, display_order) VALUES ?',
        [v3Questions]
      );
    }

    // One-time content migration: replace the old V2-mirroring placeholder V3
    // content with the real ASER-tree question bank. Subtraction keeps
    // 'auto_subtraction' (child types the answer on the numpad, auto-scored
    // against correct_answer) — this field is informational for the admin
    // panel only; the client's ASER stage engine renders by `stage` name,
    // not by reading category.evaluation_type. Guarded by a content
    // signature (the old first-subtraction-question text) rather than a
    // count, since the count-based seed guard above can't re-fire once the
    // tables are already seeded.
    const [oldSubQ] = await connection.query(
      "SELECT id FROM ankganit_v3_questions WHERE category_id = 3 AND text = '51 - 35' LIMIT 1"
    );
    if (oldSubQ.length > 0) {
      await connection.query('DELETE FROM ankganit_v3_questions WHERE category_id IN (1,2,3,4)');
      await connection.query("UPDATE ankganit_v3_categories SET evaluation_type = 'auto_subtraction', minimum_correct = 2 WHERE id = 3");
      await connection.query('UPDATE ankganit_v3_categories SET minimum_correct = 1 WHERE id = 4');
      // Spec: "4 or 5 correct" passes for both recognition categories — the
      // original seed had category 2's threshold at 5, which would wrongly
      // fail a 4/5 child.
      await connection.query('UPDATE ankganit_v3_categories SET minimum_correct = 4 WHERE id IN (1,2)');

      const v3QuestionsMigrated = [
        // Category 1: Number Recognition (1–9) — 8 values
        [1, 'Identify number 1', '1', 1, null, 1],
        [1, 'Identify number 4', '4', 4, null, 2],
        [1, 'Identify number 7', '7', 7, null, 3],
        [1, 'Identify number 3', '3', 3, null, 4],
        [1, 'Identify number 6', '6', 6, null, 5],
        [1, 'Identify number 9', '9', 9, null, 6],
        [1, 'Identify number 5', '5', 5, null, 7],
        [1, 'Identify number 2', '2', 2, null, 8],

        // Category 2: Number Recognition (10–99) — 10 values
        [2, 'Identify number 51', '51', 51, null, 1],
        [2, 'Identify number 83', '83', 83, null, 2],
        [2, 'Identify number 37', '37', 37, null, 3],
        [2, 'Identify number 65', '65', 65, null, 4],
        [2, 'Identify number 55', '55', 55, null, 5],
        [2, 'Identify number 26', '26', 26, null, 6],
        [2, 'Identify number 91', '91', 91, null, 7],
        [2, 'Identify number 43', '43', 43, null, 8],
        [2, 'Identify number 36', '36', 36, null, 9],
        [2, 'Identify number 27', '27', 27, null, 10],

        // Category 3: Two-Digit Subtraction — 8 questions as 4 fixed pairs.
        // display_order 1&2 = pair 1, 3&4 = pair 2, 5&6 = pair 3, 7&8 = pair 4.
        // The client always administers pair 1 by default.
        [3, '46 - 29', '46,29', 17, null, 1],
        [3, '63 - 39', '63,39', 24, null, 2],
        [3, '47 - 28', '47,28', 19, null, 3],
        [3, '45 - 17', '45,17', 28, null, 4],
        [3, '92 - 76', '92,76', 16, null, 5],
        [3, '84 - 57', '84,57', 27, null, 6],
        [3, '52 - 14', '52,14', 38, null, 7],
        [3, '66 - 48', '66,48', 18, null, 8],

        // Category 4: Division — 4 questions, client administers exactly 1
        // (default = display_order 1).
        [4, '879 ÷ 7', '879,7', 125, 4, 1],
        [4, '824 ÷ 6', '824,6', 137, 2, 2],
        [4, '985 ÷ 8', '985,8', 123, 1, 3],
        [4, '517 ÷ 4', '517,4', 129, 1, 4],
      ];

      await connection.query(
        'INSERT INTO ankganit_v3_questions (category_id, text, title, correct_answer, remainder, display_order) VALUES ?',
        [v3QuestionsMigrated]
      );
    }

    // Rename V3's category 2 label — "Number Recognition (11–99)" → "(10–99)".
    // Separate from the block above since that one's guard (old subtraction
    // text) no longer matches once already migrated; this needs its own
    // idempotent guard so it still fires on a DB that ran the migration
    // above before this rename existed.
    await connection.query(
      "UPDATE ankganit_v3_categories SET name = 'Number Recognition (10–99)' WHERE id = 2 AND name = 'Number Recognition (11–99)'"
    );

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

    // ── Notification Management (Admin Settings → Notifications) ───────────────
    // Every system-generated email as an admin-editable row: subject, heading,
    // body (with {{variable}} placeholders), sender override, and an on/off
    // status. emailService.js's sendFromTemplate() is the single place that
    // reads this table before sending anything — see that file for the render/
    // gating logic. The 6 ticket/contact rows below are "bridged" to the
    // existing help_email_settings/contact_email_settings boolean columns
    // (see utils/notificationBridge.js) so the older Ticket Notifications/
    // Contact Us Email settings tabs keep working and stay in sync with this
    // table instead of becoming a second, conflicting on/off switch.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        trigger_key          VARCHAR(100) UNIQUE NOT NULL,
        trigger_label        VARCHAR(255) NOT NULL,
        category             VARCHAR(100) NOT NULL,
        description          VARCHAR(500),
        status               ENUM('on','off') NOT NULL DEFAULT 'on',
        subject              VARCHAR(500) NOT NULL,
        heading              VARCHAR(255) NOT NULL,
        body_html            LONGTEXT NOT NULL,
        sender_name          VARCHAR(100) DEFAULT NULL,
        sender_email         VARCHAR(255) DEFAULT NULL,
        recipient_note       VARCHAR(255) DEFAULT NULL,
        available_variables  JSON NOT NULL,
        bridged_setting      VARCHAR(100) DEFAULT NULL,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bridged rows start from whatever the legacy tables are already set to,
    // so upgrading an existing install never silently flips an email on/off.
    const [[helpEmailRow]] = await connection.query('SELECT send_user_email, send_admin_email, send_on_admin_reply, send_on_user_reply FROM help_email_settings WHERE id = 1');
    const [[contactEmailRow]] = await connection.query('SELECT send_sender_email, send_admin_email FROM contact_email_settings WHERE id = 1');
    const onOff = (v) => (v ? 'on' : 'off');

    const TICKET_ADMIN_URL_HINT = '{{admin_panel_url}}';

    const notificationSeeds = [
      {
        trigger_key: 'otp_verification', trigger_label: 'Account Verification (OTP)', category: 'Account Verification',
        description: 'Sent when a user requests an email verification code (registration, email/mobile change, or the support-ticket portal).',
        status: 'on',
        subject: 'Your Verification Code – Sangian Support',
        heading: 'Verify Your Email',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">Use the code below to verify your email and access your account.</p>
        <div style="margin:24px 0;text-align:center">
          <div style="display:inline-block;background:#eef2ff;border:2px dashed #4f46e5;border-radius:14px;padding:20px 40px">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#4f46e5">{{otp}}</span>
          </div>
        </div>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">⏱️ This code is valid for <strong>10 minutes</strong>.<br>If you did not request this, please ignore this email.</p>`,
        available_variables: ['otp'], bridged_setting: null, recipient_note: null,
      },
      {
        trigger_key: 'individual_registration_welcome', trigger_label: 'Individual Registration Welcome', category: 'Individual',
        description: 'Sent to an Individual after their registration completes successfully.',
        status: 'on',
        subject: 'Welcome! Your Registration is Successful',
        heading: 'Welcome!',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">Dear <strong>{{full_name}}</strong>,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">Your registration has been completed successfully, and your account is now active. You can now log in using your registered email address (and mobile number, if provided) and start using the application.</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse">
          <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px 8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:140px">Registered Name</td>
              <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">{{full_name}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Email</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">{{email}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Mobile</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:14px;color:#1f2937">{{mobile}}</td></tr>
        </table>
        <h3 style="margin:24px 0 10px;color:#0f172a;font-size:16px;font-weight:800">What's Next?</h3>
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:14px;line-height:1.9">
          <li>Log in to your account.</li>
          <li>Complete your profile (if applicable).</li>
          <li>Start your assigned assessments/games.</li>
          <li>Follow the on-screen instructions while playing.</li>
        </ul>
        <h3 style="margin:24px 0 10px;color:#0f172a;font-size:16px;font-weight:800">Need Help?</h3>
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">If you experience any issues while logging in or playing the games, please contact our support team.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">Thank you for registering with us. We wish you the very best!</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin-top:20px">Regards,<br><strong>The Support Team</strong></p>
        <p style="color:#6b7280;font-size:12px;line-height:1.6;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb">If you did not create this account, please contact support immediately.</p>`,
        available_variables: ['full_name', 'email', 'mobile'], bridged_setting: null, recipient_note: null,
      },
      {
        trigger_key: 'org_registration_received', trigger_label: 'Organization Registration Received', category: 'Organization',
        description: 'Sent to an Organization after they submit registration, while it awaits Super Admin approval.',
        status: 'on',
        subject: 'Registration Received – Sangian',
        heading: 'Thank you for registering!',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">Hi,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">We've received your registration for <strong>{{org_name}}</strong> on the Sangian Assessment Platform. Your organization is now awaiting review by an administrator.</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">You'll be able to log in as soon as it's approved — no further action is needed from you right now.</p>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">If you did not submit this registration, please contact support.</p>`,
        available_variables: ['org_name'], bridged_setting: null, recipient_note: null,
      },
      {
        trigger_key: 'org_approved', trigger_label: 'Organization Approved', category: 'Organization',
        description: 'Sent to an Organization\'s registered email when a Super Admin approves their registration.',
        status: 'on',
        subject: 'Your Organization Has Been Approved – Sangian',
        heading: 'You\'re approved!',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">Hi,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">Good news — <strong>{{org_name}}</strong>'s registration on the Sangian Assessment Platform has been reviewed and approved.</p>
        <div style="margin:20px 0;padding:16px 20px;background:#f0fdf4;border-radius:10px;border-left:4px solid #16a34a">
          <p style="margin:0;color:#16a34a;font-size:15px;font-weight:700">✅ Your organization account is now active.</p>
        </div>
        <p style="color:#374151;font-size:15px;line-height:1.6">You can now log in and start setting up your assessors, staff, and child groups.</p>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">If you did not expect this, please contact support.</p>`,
        available_variables: ['org_name'], bridged_setting: null, recipient_note: null,
      },
      {
        trigger_key: 'org_rejected', trigger_label: 'Organization Rejected', category: 'Organization',
        description: 'Sent to an Organization\'s registered email when a Super Admin rejects their registration.',
        status: 'on',
        subject: 'Update on Your Organization Registration – Sangian',
        heading: 'Registration Not Approved',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">Hi,</p>
        <p style="color:#374151;font-size:15px;line-height:1.6">We've reviewed <strong>{{org_name}}</strong>'s registration on the Sangian Assessment Platform and were unable to approve it at this time.</p>
        <div style="margin:20px 0;padding:16px 20px;background:#fef2f2;border-radius:10px;border-left:4px solid #dc2626">
          <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Reason</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">{{rejection_reason}}</p>
        </div>
        <p style="color:#374151;font-size:15px;line-height:1.6">If you believe this was a mistake or would like to provide more information, please contact our support team.</p>`,
        available_variables: ['org_name', 'rejection_reason'], bridged_setting: null, recipient_note: null,
      },
      {
        trigger_key: 'ticket_created_user', trigger_label: 'Support Ticket Created (User Copy)', category: 'Support Ticket',
        description: 'Sent to the ticket submitter confirming their support ticket was created.',
        status: onOff(helpEmailRow?.send_user_email ?? 1),
        subject: 'Ticket {{ticket_id}} Created – Sangian Support',
        heading: 'Your ticket has been submitted!',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">Thank you for reaching out. We have received your support request and will get back to you within <strong>1–2 business days</strong>.</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse">
          <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px 8px 0 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:120px">Ticket ID</td>
              <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-top:none;font-size:15px;font-weight:800;color:#4f46e5">{{ticket_id}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Subject</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">{{subject}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Status</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#16a34a;font-weight:700">{{status}}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">To check your ticket status or add a reply, visit the Help &amp; Support page and use your email to access your tickets.</p>`,
        available_variables: ['ticket_id', 'subject', 'status'], bridged_setting: 'help_email_settings.send_user_email', recipient_note: null,
      },
      {
        trigger_key: 'ticket_created_admin', trigger_label: 'Support Ticket Created (Admin Copy)', category: 'Support Ticket',
        description: 'Sent to the admin inbox when a new support ticket is submitted.',
        status: onOff(helpEmailRow?.send_admin_email ?? 1),
        subject: 'New Support Ticket {{ticket_id}} – {{subject}}',
        heading: 'New ticket from {{from_email}}',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">A new support ticket has been submitted.</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse">
          <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:120px">Ticket ID</td>
              <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;font-size:15px;font-weight:800;color:#4f46e5">{{ticket_id}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">From</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">{{from_email}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Subject</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">{{subject}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;vertical-align:top">Message</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#374151;line-height:1.6">{{message}}</td></tr>
        </table>
        <a href="${TICKET_ADMIN_URL_HINT}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">View in Admin Panel</a>`,
        available_variables: ['ticket_id', 'subject', 'from_email', 'message', 'admin_panel_url'], bridged_setting: 'help_email_settings.send_admin_email',
        recipient_note: 'Sent to the admin address configured in Settings → Ticket Notifications.',
      },
      {
        trigger_key: 'ticket_admin_reply', trigger_label: 'Support Ticket – Admin Replied', category: 'Support Ticket',
        description: 'Sent to the ticket submitter when an admin replies to their ticket.',
        status: onOff(helpEmailRow?.send_on_admin_reply ?? 1),
        subject: 'New Reply on Ticket {{ticket_id}} – Sangian Support',
        heading: 'The support team has replied to your ticket',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">You have a new reply on ticket <strong>{{ticket_id}}</strong>.</p>
        <blockquote style="margin:16px 0;padding:14px 18px;background:#f8fafc;border-left:4px solid #4f46e5;border-radius:0 10px 10px 0">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">{{reply_preview}}</p>
        </blockquote>
        <p style="color:#6b7280;font-size:13px">Log in to the Help &amp; Support page to view the full reply and respond.</p>`,
        available_variables: ['ticket_id', 'reply_preview'], bridged_setting: 'help_email_settings.send_on_admin_reply', recipient_note: null,
      },
      {
        trigger_key: 'ticket_user_reply', trigger_label: 'Support Ticket – User Replied', category: 'Support Ticket',
        description: 'Sent to the admin inbox when a user replies to their own ticket.',
        status: onOff(helpEmailRow?.send_on_user_reply ?? 1),
        subject: 'User Reply on Ticket {{ticket_id}}',
        heading: 'New reply from {{from_email}}',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">The user has replied to ticket <strong>{{ticket_id}}</strong>.</p>
        <blockquote style="margin:16px 0;padding:14px 18px;background:#f8fafc;border-left:4px solid #ec4899;border-radius:0 10px 10px 0">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">{{reply_preview}}</p>
        </blockquote>
        <a href="${TICKET_ADMIN_URL_HINT}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">Reply in Admin Panel</a>`,
        available_variables: ['ticket_id', 'from_email', 'reply_preview', 'admin_panel_url'], bridged_setting: 'help_email_settings.send_on_user_reply',
        recipient_note: 'Sent to the admin address configured in Settings → Ticket Notifications.',
      },
      {
        trigger_key: 'ticket_status_changed', trigger_label: 'Support Ticket – Status Changed', category: 'Support Ticket',
        description: "Sent to the ticket submitter when a Super Admin changes their ticket's status.",
        status: onOff(helpEmailRow?.send_user_email ?? 1),
        subject: 'Ticket {{ticket_id}} Status Updated – {{status_label}}',
        heading: 'Your ticket status has been updated',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">The status of your support ticket <strong>{{ticket_id}}</strong> has been updated.</p>
        <div style="margin:20px 0;padding:14px 20px;background:#eef2ff;border-radius:10px;display:inline-block">
          <span style="font-size:16px;font-weight:800;color:#4f46e5">New Status: {{status_label}}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">Visit the Help &amp; Support page to view your ticket details.</p>`,
        available_variables: ['ticket_id', 'status_label'], bridged_setting: 'help_email_settings.send_user_email', recipient_note: null,
      },
      {
        trigger_key: 'contact_thank_you_en', trigger_label: 'Contact Form – Thank You (English)', category: 'Contact Form',
        description: 'Sent to the sender after submitting the Contact Us form (English).',
        status: onOff(contactEmailRow?.send_sender_email ?? 1),
        subject: 'Thank You for Reaching Out – Sangian Support',
        heading: 'Thank You, {{name}}!',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">We have successfully received your message and our team will review it shortly.</p>
        <div style="margin:20px 0;padding:16px 20px;background:#eef2ff;border-radius:10px;border-left:4px solid #4f46e5">
          <p style="margin:0;color:#4f46e5;font-size:15px;font-weight:700">✅ Your message has been received successfully.</p>
        </div>
        <p style="color:#374151;font-size:14px;line-height:1.6">We typically respond within <strong>1–2 business days</strong> at the email address you provided.</p>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">In the meantime, feel free to explore our assessment platform or check our Help &amp; Support section for quick answers.</p>`,
        available_variables: ['name'], bridged_setting: 'contact_email_settings.send_sender_email', recipient_note: null,
      },
      {
        trigger_key: 'contact_thank_you_hi', trigger_label: 'Contact Form – Thank You (Hindi)', category: 'Contact Form',
        description: 'Sent to the sender after submitting the Contact Us form (Hindi).',
        status: onOff(contactEmailRow?.send_sender_email ?? 1),
        subject: 'आपसे संपर्क करने के लिए धन्यवाद – संगियान सपोर्ट',
        heading: 'धन्यवाद, {{name}}!',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">आपका संदेश कम्युनिटी एम्पावरमेंट लैब टीम को सफलतापूर्वक प्राप्त हो गया है।</p>
        <div style="margin:20px 0;padding:16px 20px;background:#eef2ff;border-radius:10px;border-left:4px solid #4f46e5">
          <p style="margin:0;color:#4f46e5;font-size:15px;font-weight:700">✅ आपका संदेश सफलतापूर्वक भेज दिया गया है।</p>
        </div>
        <p style="color:#374151;font-size:14px;line-height:1.6">हम आमतौर पर <strong>1–2 कार्य दिवसों</strong> के भीतर आपके ईमेल पते पर उत्तर देते हैं।</p>
        <p style="color:#6b7280;font-size:13px;line-height:1.6">इस दौरान, त्वरित उत्तरों के लिए हमारा सहायता और समर्थन अनुभाग देखें।</p>`,
        available_variables: ['name'], bridged_setting: 'contact_email_settings.send_sender_email', recipient_note: null,
      },
      {
        trigger_key: 'contact_admin_notification', trigger_label: 'Contact Form – Admin Notification', category: 'Contact Form',
        description: 'Sent to the admin inbox when the Contact Us form is submitted.',
        status: onOff(contactEmailRow?.send_admin_email ?? 1),
        subject: 'New Contact Form – {{subject}}',
        heading: 'New message from {{name}}',
        body_html: `<p style="color:#374151;font-size:15px;line-height:1.6">A new contact form submission has been received.</p>
        <table style="width:100%;margin:20px 0;border-collapse:collapse">
          <tr><td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;width:100px">Name</td>
              <td style="padding:10px 14px;background:#f8fafc;border:1px solid #e5e7eb;font-size:14px;color:#1f2937;font-weight:700">{{name}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Email</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">{{email}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Phone</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">{{phone}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af">Subject</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#1f2937">{{subject}}</td></tr>
          <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;vertical-align:top">Message</td>
              <td style="padding:10px 14px;border:1px solid #e5e7eb;border-top:none;font-size:14px;color:#374151;line-height:1.6">{{message}}</td></tr>
        </table>
        <a href="${TICKET_ADMIN_URL_HINT}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">View in Admin Panel</a>`,
        available_variables: ['name', 'email', 'phone', 'subject', 'message', 'admin_panel_url'], bridged_setting: 'contact_email_settings.send_admin_email',
        recipient_note: 'Sent to the admin address configured in Settings → Contact Us Email.',
      },
    ];

    for (const t of notificationSeeds) {
      await connection.query(
        `INSERT IGNORE INTO notification_templates
         (trigger_key, trigger_label, category, description, status, subject, heading, body_html, available_variables, bridged_setting, recipient_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.trigger_key, t.trigger_label, t.category, t.description, t.status, t.subject, t.heading, t.body_html, JSON.stringify(t.available_variables), t.bridged_setting, t.recipient_note]
      );
    }

    // Create test_elements table for managing static assets (splash screens, etc.)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS test_elements (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        test_id     VARCHAR(100) NOT NULL,
        asset_type  VARCHAR(50)  NOT NULL,
        language    VARCHAR(10)  NOT NULL,
        file_name   VARCHAR(255) NOT NULL DEFAULT '',
        file_path   VARCHAR(500) NULL,
        config      JSON         NULL,
        is_active   TINYINT(1)   DEFAULT 1,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_test_asset_lang_file (test_id, asset_type, language, file_name)
      )
    `);

    // Ensure we run the migration for existing tables safely.
    // This must actually succeed on every startup: the seed step below uses
    // INSERT IGNORE, which only no-ops on a duplicate if this unique key
    // exists. If ADD UNIQUE KEY silently fails (e.g. duplicate rows already
    // violate it) every restart re-inserts a fresh batch of default rows
    // forever — that caused the Her Pher V2 item-duplication incident of
    // 2026-07-27. So this dedupes first and logs instead of swallowing.
    try {
      await connection.query('ALTER TABLE test_elements DROP INDEX uq_test_asset_lang');
    } catch (e) {}

    try {
      await connection.query('ALTER TABLE test_elements ADD UNIQUE KEY uq_test_asset_lang_file (test_id, asset_type, language, file_name)');
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        // Duplicate rows are blocking the unique key — keep the oldest row
        // per (test_id, asset_type, language, file_name) group and drop the rest.
        await connection.query(`
          DELETE t1 FROM test_elements t1
          INNER JOIN test_elements t2
            ON t1.test_id = t2.test_id
           AND t1.asset_type = t2.asset_type
           AND t1.language = t2.language
           AND t1.file_name = t2.file_name
           AND t1.id > t2.id
        `);
        try {
          await connection.query('ALTER TABLE test_elements ADD UNIQUE KEY uq_test_asset_lang_file (test_id, asset_type, language, file_name)');
        } catch (e2) {
          console.error('Failed to add uq_test_asset_lang_file unique key after dedupe:', e2.message);
        }
      } else if (e.code !== 'ER_DUP_KEYNAME') {
        console.error('Failed to add uq_test_asset_lang_file unique key:', e.message);
      }
    }

    try {
      await connection.query('ALTER TABLE test_elements ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER file_path');
    } catch (e) {}

    // Structured JSON config per element (e.g. Rachna's per-question shape
    // composition) — additive to the file-upload columns, not a replacement.
    // file_path relaxes to nullable so a config-only row (no image ever
    // uploaded for that question) can exist. file_name stays NOT NULL — it's
    // part of the unique key, and MySQL treats every NULL as distinct there,
    // which would silently defeat the ON DUPLICATE KEY UPDATE upsert for
    // config-only rows (verified this against a live table before deciding
    // against nullable file_name); config-only rows use '' instead.
    try {
      await connection.query('ALTER TABLE test_elements ADD COLUMN config JSON NULL AFTER file_path');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') console.error('Failed to add test_elements.config:', e.message); }
    try {
      await connection.query("ALTER TABLE test_elements MODIFY file_name VARCHAR(255) NOT NULL DEFAULT ''");
    } catch (e) { console.error('Failed to default test_elements.file_name:', e.message); }
    try {
      await connection.query('ALTER TABLE test_elements MODIFY file_path VARCHAR(500) NULL');
    } catch (e) { console.error('Failed to relax test_elements.file_path nullability:', e.message); }

    // Staff Login History — distinguishes an admin-initiated forced end of a
    // still-active session from a normal explicit logout. Left NULL for a
    // normal logout (the existing UPDATE in logoutAdmin never sets this
    // column); "Session Expired" (token outlived without any logout call)
    // is derived at query time from login_time/JWT-expiry rather than
    // stored, since it depends on the current time, not a fixed event.
    try {
      await connection.query("ALTER TABLE staff_login_sessions ADD COLUMN logout_status ENUM('normal','force_logout') NULL AFTER session_duration");
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') console.error('Failed to add staff_login_sessions.logout_status:', e.message); }

    // Staff Activity History — widened from a plain description string so
    // the admin-only Log History page can filter/display which menu/page an
    // action happened on, which record it touched, what device made the
    // request, and which login session it belongs to (correlates back to
    // staff_login_sessions without a hard FK, since a session can be quite
    // old by the time its activities are reviewed).
    const activityLogCols = [
      ["ALTER TABLE staff_activity_logs ADD COLUMN menu_name VARCHAR(100) NULL AFTER description",  'staff_activity_logs.menu_name'],
      ["ALTER TABLE staff_activity_logs ADD COLUMN page_name VARCHAR(150) NULL AFTER menu_name",     'staff_activity_logs.page_name'],
      ["ALTER TABLE staff_activity_logs ADD COLUMN record_id VARCHAR(100) NULL AFTER page_name",     'staff_activity_logs.record_id'],
      ["ALTER TABLE staff_activity_logs ADD COLUMN record_name VARCHAR(255) NULL AFTER record_id",   'staff_activity_logs.record_name'],
      // Flexible payload for per-action-type detail (before/after values on
      // an edit, filters/date-range/format on a report download) — one JSON
      // column instead of a growing set of narrow nullable columns that
      // would only ever apply to some action types.
      ["ALTER TABLE staff_activity_logs ADD COLUMN metadata JSON NULL AFTER record_name",            'staff_activity_logs.metadata'],
      ["ALTER TABLE staff_activity_logs ADD COLUMN browser VARCHAR(50) NULL AFTER ip_address",       'staff_activity_logs.browser'],
      ["ALTER TABLE staff_activity_logs ADD COLUMN os VARCHAR(50) NULL AFTER browser",               'staff_activity_logs.os'],
      ["ALTER TABLE staff_activity_logs ADD COLUMN device_type VARCHAR(50) NULL AFTER os",           'staff_activity_logs.device_type'],
      ["ALTER TABLE staff_activity_logs ADD COLUMN session_id INT NULL AFTER device_type",           'staff_activity_logs.session_id'],
    ];
    for (const [sql, label] of activityLogCols) {
      try { await connection.query(sql); }
      catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') console.warn(`Migration warning (${label}):`, e.message); }
    }

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
      'number_recall_lottery_v2': { path: '/assets/images/lottery_ka_ticket_V2/lottery_ka_ticket.jpg', name: 'lottery_ka_ticket.jpg' },
      'rover_mela': { path: '/assets/images/chalo_mela_chale/chalo_mela_chale.jpg', name: 'chalo_mela_chale.jpg' },
      'auditory_dhyan': { path: '/assets/images/dhyan_kahan_hai/dhyan_kahan_hai.jpg', name: 'dhyan_kahan_hai.jpg' },
      'working_memory_herpher': { path: '/assets/images/her_pher/her_pher.jpg', name: 'her_pher.jpg' },
      'working_memory_herpher_v2': { path: '/assets/images/her_pher_v2/her_pher_v2.jpg', name: 'her_pher_v2.jpg' },
      'working_memory_herpher_v3': { path: '/assets/images/her_pher_v3/her_pher_v3.jpg', name: 'her_pher_v3.jpg' },
      'numeracy_number_skill': { path: '/assets/images/number_skill/number_skill.jpg', name: 'number_skill.jpg' },
      'numeracy_number_skill_v2': { path: '/assets/images/number_skill_v2/number_skill.jpg', name: 'number_skill.jpg' },
      'numeracy_number_skill_v3': { path: '/assets/images/number_skill_v3/number_skill.jpg', name: 'number_skill.jpg' },
      'literacy_reading_skill': { path: '/assets/images/reading_skill/reading_skill.jpg', name: 'reading_skill.jpg' },
      'literacy_reading_skill_v2': { path: '/assets/images/reading_skill_v2/reading_skill_v2.jpg', name: 'reading_skill_v2.jpg' },
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
    // Each Her Pher category is capped at exactly 10 active images (see
    // HerPherElements.jsx's CATEGORIES min/max). Seeding must match that cap —
    // INSERT IGNORE below only skips a row if its (test_id, asset_type,
    // language, file_name) key still exists, so seeding more than 10 here
    // would silently resurrect deleted "extra" images on every server restart.
    // Tools -> item0 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item0/${i}.png`, name: `${i}.png`, type: 'item0' });
    // Birds -> item1 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item1/${i}.png`, name: `${i}.png`, type: 'item1' });
    // Vegetables -> item2 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item2/${i}.png`, name: `${i}.png`, type: 'item2' });
    // Sports -> item3 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item3/${i}.png`, name: `${i}.png`, type: 'item3' });
    // Flowers -> item4 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item4/${i}.png`, name: `${i}.png`, type: 'item4' });
    // Insects -> item5 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item5/${i}.png`, name: `${i}.png`, type: 'item5' });
    // Household -> item6 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item6/${i}.png`, name: `${i}.png`, type: 'item6' });
    // Animals -> item7 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item7/${i}.png`, name: `${i}.png`, type: 'item7' });
    // Transport -> item8 (10)
    for(let i=1; i<=10; i++) hpSeeds.push({ lang: 'all', path: `/assets/images/her_pher/items/item8/${i}.png`, name: `${i}.png`, type: 'item8' });

    allSeeds.push({
      test_id: 'working_memory_herpher_v2',
      seeds: hpSeeds
    });

    const hpV3Seeds = [];
    // Her Pher V3 uses a fixed item-wise image count per category (unlike V1/V2's
    // uniform 10) — see HerPherElements.jsx's HERPHER_V3_CATEGORIES for the caps
    // that must stay in sync with these counts. Seeded from its own
    // her_pher_v3/items asset folder (see hpSeeds above for the cap rule).
    const hpV3CategoryCounts = { item0: 6, item1: 7, item2: 8, item3: 9, item4: 10, item5: 11, item6: 12, item7: 13, item8: 14 };
    for (const [type, count] of Object.entries(hpV3CategoryCounts)) {
      for (let i = 1; i <= count; i++) {
        hpV3Seeds.push({ lang: 'all', path: `/assets/images/her_pher_v3/items/${type}/${i}.png`, name: `${i}.png`, type });
      }
    }

    allSeeds.push({
      test_id: 'working_memory_herpher_v3',
      seeds: hpV3Seeds
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

    // ── Multilingual Audio Management (Elements → Audio) ────────────────────
    // Admin-defined, ordered "audio slots" per test (e.g. "Splash Screen
    // Audio", "Audio 1", "Audio 2"...). The actual per-language files are
    // NOT stored here — they're ordinary test_elements rows with
    // asset_type = 'audio_' + element_key, reusing that table's existing
    // (test_id, asset_type, language, file_name) unique key and upload/
    // delete/toggle plumbing (elementsController.js) unchanged. This table
    // only tracks the slot's identity/order/fallback/status — see
    // audioElementController.js.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audio_elements (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        test_id           VARCHAR(100) NOT NULL,
        element_key       VARCHAR(100) NOT NULL,
        label             VARCHAR(255) NOT NULL,
        display_order     INT DEFAULT 0,
        fallback_language VARCHAR(10) DEFAULT NULL,
        status            ENUM('active', 'inactive') DEFAULT 'active',
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_test_element (test_id, element_key)
      )
    `);

    // Seed one 'splash' slot per game in the canonical registry — this is
    // the well-known key the splash-screen <audio> tags look up by
    // convention (see client/src/hooks/useTestAudio.js). Admins can add
    // further slots freely from the panel; those aren't seeded here.
    const { GAMES_REGISTRY } = require('../services/testConfigService');
    for (const game of GAMES_REGISTRY) {
      await connection.query(
        `INSERT IGNORE INTO audio_elements (test_id, element_key, label, display_order) VALUES (?, 'splash', 'Splash Screen Audio', 0)`,
        [game.key]
      );
    }

    // Lottery Ticket V1/V2 (number_recall_lottery[_v2]) each play ~26 distinct
    // clips, not just splash — Practice, 2 Teaching questions (each with its
    // own "wrong answer" teaching-audio), and 20 scored questions. Every one
    // gets its own slot here so it's independently manageable per language
    // from the Audio Management panel, same mechanism as splash above. The
    // pre-existing single-stream (Hindi) filenames stay bundled as static
    // fallbacks passed to getAudioUrl() at each game's call sites — nothing
    // is migrated into a DB row here, so day-one behavior is unchanged until
    // an Admin uploads a real per-language file for a slot.
    const lotteryElementSeeds = [
      { key: 'practice', label: 'Practice', order: 1 },
      { key: 'practice_teaching', label: 'Practice (Teaching Audio)', order: 2 },
      { key: 'teaching_1', label: 'Teaching 1', order: 3 },
      { key: 'teaching_1_teaching', label: 'Teaching 1 (Teaching Audio)', order: 4 },
      { key: 'teaching_2', label: 'Teaching 2', order: 5 },
      ...Array.from({ length: 20 }, (_, i) => ({ key: String(i + 1), label: `Question ${i + 1}`, order: 6 + i })),
    ];
    for (const test_id of ['number_recall_lottery', 'number_recall_lottery_v2']) {
      for (const seed of lotteryElementSeeds) {
        await connection.query(
          `INSERT IGNORE INTO audio_elements (test_id, element_key, label, display_order) VALUES (?, ?, ?, ?)`,
          [test_id, seed.key, seed.label, seed.order]
        );
      }
    }

    // Atlantis Bagiya (atlantis_bagiya) — each of its 17 catalogued creatures
    // has a "name" prompt (12 of them; the other 5 are unnamed fillers with
    // no name audio) and a "where is it?" prompt (12 own + the 5 unnamed
    // ones sharing one "khahai_no_name" clip, matching the actual content
    // today — see ITEMS in client/src/pages/AtlantisBagiyaGame.jsx), plus 2
    // shared correct/retry feedback sounds. 'splash' is already seeded
    // above via GAMES_REGISTRY.
    const bagiyaNamedStems = [
      'bird_ba', 'bird_deem', 'bird_jul', 'bird_hoop',
      'insect_ghesa', 'insect_mogju', 'insect_baigul', 'insect_thooli',
      'flower_shibagu', 'flower_mulpaki', 'flower_dhulkoma', 'flower_pegeto',
    ];
    const bagiyaLabel = (stem) => stem.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    const bagiyaElementSeeds = [];
    let bagiyaOrder = 1;
    for (const stem of bagiyaNamedStems) {
      bagiyaElementSeeds.push({ key: `name_${stem}`, label: `${bagiyaLabel(stem)} — Name`, order: bagiyaOrder++ });
      bagiyaElementSeeds.push({ key: `khahai_${stem}`, label: `${bagiyaLabel(stem)} — Where Is It?`, order: bagiyaOrder++ });
    }
    bagiyaElementSeeds.push({ key: 'khahai_no_name', label: 'Unnamed Items — Where Is It? (shared)', order: bagiyaOrder++ });
    bagiyaElementSeeds.push({ key: 'feedback_correct', label: 'Feedback: Correct', order: bagiyaOrder++ });
    bagiyaElementSeeds.push({ key: 'feedback_correct_final', label: 'Feedback: Correct (Final Question)', order: bagiyaOrder++ });
    bagiyaElementSeeds.push({ key: 'feedback_retry', label: 'Feedback: Try Again', order: bagiyaOrder++ });
    for (const seed of bagiyaElementSeeds) {
      await connection.query(
        `INSERT IGNORE INTO audio_elements (test_id, element_key, label, display_order) VALUES (?, ?, ?, ?)`,
        ['atlantis_bagiya', seed.key, seed.label, seed.order]
      );
    }

    // Chalo Mela Chalen (rover_mela) — the two demo/teaching paths (A and B)
    // each narrate an intro clip plus one clip per path segment, followed by
    // a shared final instruction, then 6 in-game SFX. 'splash' is already
    // seeded above via GAMES_REGISTRY. See ChaloMelaChaleGame.jsx's
    // playAudio/playSoundEffect call sites for the matching static fallback
    // filenames (unchanged, still bundled under AUDIO_DIR).
    const melaElementSeeds = [
      { key: 'sample_a', label: 'Demo Path A — Intro', order: 1 },
      { key: 'sa_path1', label: 'Demo Path A — Path 1', order: 2 },
      { key: 'sa_path2', label: 'Demo Path A — Path 2', order: 3 },
      { key: 'sa_path3', label: 'Demo Path A — Path 3', order: 4 },
      { key: 'sample_b', label: 'Demo Path B — Intro', order: 5 },
      { key: 'sb_path1', label: 'Demo Path B — Path 1', order: 6 },
      { key: 'sb_path2', label: 'Demo Path B — Path 2', order: 7 },
      { key: 'last_instruction', label: 'Final Instruction (Pre-Game)', order: 8 },
      { key: 'start_trial', label: 'SFX: Trial Start', order: 9 },
      { key: 'timer_warning', label: 'SFX: Timer Warning (6s Left)', order: 10 },
      { key: 'wrong_move', label: 'SFX: Wrong Move (Weed)', order: 11 },
      { key: 'move', label: 'SFX: Move', order: 12 },
      { key: 'success', label: 'SFX: Success', order: 13 },
      { key: 'failure', label: 'SFX: Failure', order: 14 },
    ];
    for (const seed of melaElementSeeds) {
      await connection.query(
        `INSERT IGNORE INTO audio_elements (test_id, element_key, label, display_order) VALUES (?, ?, ?, ?)`,
        ['rover_mela', seed.key, seed.label, seed.order]
      );
    }

    // Chor Machaye Shor (cognitive_flex_chor) — 3 in-game SFX, played on every
    // correct/incorrect touch and on completing an item. 'splash' is already
    // seeded above via GAMES_REGISTRY.
    const chorElementSeeds = [
      { key: 'cm_appalause', label: 'Feedback: Correct Touch', order: 1 },
      { key: 'cm_neglect', label: 'Feedback: Incorrect Touch', order: 2 },
      { key: 'cm_thief_caught', label: 'Feedback: Item Complete (Thief Caught)', order: 3 },
    ];
    for (const seed of chorElementSeeds) {
      await connection.query(
        `INSERT IGNORE INTO audio_elements (test_id, element_key, label, display_order) VALUES (?, ?, ?, ?)`,
        ['cognitive_flex_chor', seed.key, seed.label, seed.order]
      );
    }

    // Create child_profile_edit_logs table for tracking admin edits to child profiles
    await connection.query(`
      CREATE TABLE IF NOT EXISTS child_profile_edit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        children_id INT NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        updated_by_id INT,
        updated_by_name VARCHAR(255),
        ip_address VARCHAR(45),
        action_type VARCHAR(50) DEFAULT 'update',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (children_id) REFERENCES children(id) ON DELETE CASCADE
      )
    `);

    // Managed picklist for organizations.org_type (free-text column, not an
    // FK — this table only constrains what the two dropdowns that WRITE
    // that column offer: the public registration form
    // (UnifiedRegister.jsx, via /api/public/org-types) and the Super
    // Admin's org edit page (AdminOrganizationDetail.jsx, via
    // /api/admin/org-types). Managed from Admin > Meta > Organization
    // Types (orgTypeController.js) — same "Meta" home as CMS pages/FAQ/
    // contact info.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS org_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        value VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(150) NOT NULL,
        sort_order INT DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    const [orgTypeRows] = await connection.query('SELECT COUNT(*) AS total FROM org_types');
    if (orgTypeRows[0].total === 0) {
      // Seeds the same 5 options UnifiedRegister.jsx previously hardcoded,
      // so switching it over to fetch from this table is a no-op for
      // existing users on first deploy.
      await connection.query(
        `INSERT INTO org_types (value, label, sort_order) VALUES
         ('ngo', 'NGO', 1), ('school', 'School', 2), ('hospital', 'Hospital', 3),
         ('government', 'Government Department', 4), ('other', 'Other', 5)`
      );
    }

    await initMultiTenantSchema(connection);

    // Mirrors child_profile_edit_logs exactly, scoped to Individual account
    // edits (currently just email/mobile changes — see
    // adminIndividualController.js's updateIndividualContact) made by a
    // Super Admin via the Individuals oversight panel. Created after
    // initMultiTenantSchema() since it references individual_users(id),
    // which that function creates.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS individual_profile_edit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        individual_id INT NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        updated_by_id INT,
        updated_by_name VARCHAR(255),
        ip_address VARCHAR(45),
        action_type VARCHAR(50) DEFAULT 'update',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (individual_id) REFERENCES individual_users(id) ON DELETE CASCADE
      )
    `);

    // Mirrors individual_profile_edit_logs exactly, scoped to Organization
    // profile edits (org_name/org_type/address/city/state/country/
    // contact_person_name/contact_person_designation via updateOrganization,
    // and org_email/org_mobile via updateOrganizationContact — see
    // adminOrgController.js) made by a Super Admin via the Organizations
    // oversight panel. Deliberately separate from organization_activity_logs
    // (which covers every action type — login, permission changes, child/
    // staff CRUD, etc.) so the Edit History tab can show a clean per-field
    // diff list the same way AdminIndividualDetail.jsx's does, instead of
    // that mixed general-purpose trail. Created after initMultiTenantSchema()
    // since it references organizations(id), which that function creates.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS organization_profile_edit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        org_id INT NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        updated_by_id INT,
        updated_by_name VARCHAR(255),
        ip_address VARCHAR(45),
        action_type VARCHAR(50) DEFAULT 'update',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
      )
    `);

    connection.release();
    console.log('Database tables verified/created');
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, initDb };
