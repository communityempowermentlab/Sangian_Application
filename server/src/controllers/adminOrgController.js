const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const { logOrgActivity } = require('../utils/logOrgActivity');
const { isChannelVerified } = require('./otpController');
const { normalizeIndianMobile } = require('../utils/mobileNumber');
const { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } = require('../utils/passwordStrength');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors AdminOrganizationDetail.jsx's FIELD_ROWS labels, so
// organization_profile_edit_logs entries read the same way the form does.
const PROFILE_FIELD_LABELS = {
  org_name: 'Organization Name',
  org_type: 'Organization Type',
  address: 'Address',
  city: 'City',
  state: 'State',
  country: 'Country',
  contact_person_name: 'Contact Person',
  contact_person_designation: 'Designation',
  org_email: 'Email',
  org_mobile: 'Mobile',
};

const getIp = (req) => {
  let ip = req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '';
  if (ip === '::1') ip = '127.0.0.1';
  if (ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
  return ip;
};

// Super-Admin-only organization approval queue (see requireAdminOnly on the
// routes below) — organization approval is a hard role check, not a
// grantable staff module permission, same precedent as Log History.

// Modules an organization can be granted access to — mirrors
// ADMIN_MODULES (staffPermissions.js) for full checklist parity with
// Staff's Menu Permissions. Flat all-or-nothing model — checking a module
// grants full (view/add/edit/delete/...) access to it, same as
// staff.permissions; there is no per-action grant.
//
// IMPORTANT caveat: only dashboard/children/staff/settings are actually
// wired to org-scoped data and gated via requireAdminOrOrgAuth(moduleKey)
// on their routes. The rest (assessors, child-groups, reports, analysis,
// docs, meta, help-support, multilingual, elements) are GLOBAL,
// platform-wide admin tools with no per-organization data model — their
// routes are still plain adminAuth/requireModuleAccess (admin/staff only)
// and reject an 'organization' JWT outright. Checking one of those boxes
// for an org shows its nav item (canSeeModule only checks list
// membership) but every API call from that page will 403 — deliberately
// NOT wired to grant real access, since these are shared resources (e.g.
// meta = public Terms & Conditions/Privacy Policy/SMTP settings,
// multilingual = platform-wide translations) that a single organization
// must never be able to write to. 'organizations'/'individuals' are
// additionally hard-locked at both the nav (AdminLayout.jsx checks
// isOrgSession() directly, not this grant) and the API (requireAdminOnly)
// — an org can never see or manage other organizations/individuals no
// matter what's checked here.
const ORG_PERMISSION_MODULES = [
  'dashboard', 'organizations', 'individuals', 'children', 'assessors', 'child-groups', 'reports', 'analysis',
  'docs', 'meta', 'help-support', 'multilingual', 'elements', 'staff', 'settings',
];

// @desc  List organizations, optionally filtered by registration_status/status/search.
// @route GET /api/admin/organizations
const getAllOrganizations = async (req, res) => {
  try {
    const { registration_status, status, search } = req.query;
    const where = [];
    const params = [];

    if (registration_status) { where.push('registration_status = ?'); params.push(registration_status); }
    if (status) { where.push('status = ?'); params.push(status); }
    if (search) {
      where.push('(org_name LIKE ? OR org_email LIKE ? OR contact_person_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT o.id, o.org_name, o.org_type, o.org_email, o.org_mobile, o.city, o.state, o.country,
              o.contact_person_name, o.contact_person_designation, o.registration_status, o.status,
              o.approved_at, o.rejection_reason, o.created_at,
              (SELECT MAX(login_time) FROM org_login_sessions WHERE org_id = o.id AND status = 'success') AS last_login
       FROM organizations o ${whereStr} ORDER BY o.created_at DESC`,
      params
    );
    return res.json({ success: true, organizations: rows });
  } catch (err) {
    console.error('getAllOrganizations error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Single organization detail.
// @route GET /api/admin/organizations/:id
const getOrganizationById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, org_name, org_type, org_email, org_mobile, address, city, state, country,
              contact_person_name, contact_person_designation, email_verified, mobile_verified,
              registration_status, status, approved_by_admin_id, approved_at, rejection_reason,
              extra_attributes, permissions, created_at, updated_at
       FROM organizations WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Organization not found.' });
    return res.json({ success: true, organization: rows[0] });
  } catch (err) {
    console.error('getOrganizationById error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Approve a pending (or previously rejected) organization.
// @route POST /api/admin/organizations/:id/approve
const approveOrganization = async (req, res) => {
  try {
    // Default module set for a freshly-approved organization — available
    // immediately so it isn't 403'd on login before the Super Admin has
    // granted anything else. Dashboard/Children/Assessors/Staff/Reports/
    // Analysis are the modules with real org-scoped data behind them;
    // anything beyond this (Settings, or the platform-wide tools like
    // Meta/Multilingual) stays opt-in, granted later by the Super Admin
    // per the organization's needs. Only seeds when permissions is still
    // NULL — never overwrites an org that already has grants (e.g.
    // re-approving after a suspension).
    const DEFAULT_ORG_MODULES = ['dashboard', 'children', 'assessors', 'staff', 'reports', 'analysis'];
    const [existing] = await pool.query('SELECT permissions, org_name FROM organizations WHERE id = ?', [req.params.id]);
    if (existing.length && existing[0].permissions === null) {
      await pool.query('UPDATE organizations SET permissions = ? WHERE id = ?', [JSON.stringify(DEFAULT_ORG_MODULES), req.params.id]);
    }

    const [result] = await pool.query(
      `UPDATE organizations SET registration_status = 'approved', approved_by_admin_id = ?, approved_at = NOW(), rejection_reason = NULL WHERE id = ?`,
      [req.admin.id, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Organization not found.' });

    await logOrgActivity({
      orgId: req.params.id, orgName: existing[0]?.org_name, actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name || req.admin.email,
      module: 'organizations', actionType: 'approve', description: 'Organization approved by Super Admin', req,
    });

    return res.json({ success: true, message: 'Organization approved.' });
  } catch (err) {
    console.error('approveOrganization error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Reject a pending organization, with a reason.
// @route POST /api/admin/organizations/:id/reject
const rejectOrganization = async (req, res) => {
  try {
    const reason = (req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'A rejection reason is required.' });

    const [result] = await pool.query(
      `UPDATE organizations SET registration_status = 'rejected', rejection_reason = ? WHERE id = ?`,
      [reason, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Organization not found.' });
    return res.json({ success: true, message: 'Organization rejected.' });
  } catch (err) {
    console.error('rejectOrganization error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Suspend a previously-approved organization — blocks login without
//        discarding its approval history (registration_status becomes
//        'suspended', distinct from 'rejected').
// @route POST /api/admin/organizations/:id/suspend
const suspendOrganization = async (req, res) => {
  try {
    const [orgRows] = await pool.query('SELECT org_name FROM organizations WHERE id = ?', [req.params.id]);
    const [result] = await pool.query(
      `UPDATE organizations SET registration_status = 'suspended' WHERE id = ?`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Organization not found.' });

    await logOrgActivity({
      orgId: req.params.id, orgName: orgRows[0]?.org_name, actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name || req.admin.email,
      module: 'organizations', actionType: 'suspend', description: 'Organization suspended by Super Admin — access immediately revoked', req,
    });

    return res.json({ success: true, message: 'Organization suspended.' });
  } catch (err) {
    console.error('suspendOrganization error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Reactivate a suspended organization back to approved.
// @route POST /api/admin/organizations/:id/activate
const activateOrganization = async (req, res) => {
  try {
    const [orgRows] = await pool.query('SELECT org_name FROM organizations WHERE id = ?', [req.params.id]);
    const [result] = await pool.query(
      `UPDATE organizations SET registration_status = 'approved', status = 'active' WHERE id = ?`,
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Organization not found.' });

    await logOrgActivity({
      orgId: req.params.id, orgName: orgRows[0]?.org_name, actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name || req.admin.email,
      module: 'organizations', actionType: 'activate', description: 'Organization reactivated by Super Admin', req,
    });

    return res.json({ success: true, message: 'Organization activated.' });
  } catch (err) {
    console.error('activateOrganization error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Edit organization profile fields (Super Admin correction/support
//        use). org_email/org_mobile are deliberately EXCLUDED here — those
//        are identifiers (used for login and uniqueness), not plain profile
//        text, so changing them goes through updateOrganizationContact's
//        OTP-gated flow instead, same precedent as
//        adminIndividualController.js's updateIndividualContact.
// @route PUT /api/admin/organizations/:id
const updateOrganization = async (req, res) => {
  try {
    const fields = ['org_name', 'org_type', 'address', 'city', 'state', 'country', 'contact_person_name', 'contact_person_designation'];
    const updates = [];
    const params = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    });
    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update.' });

    const [beforeRows] = await pool.query(`SELECT ${fields.join(', ')} FROM organizations WHERE id = ?`, [req.params.id]);
    if (!beforeRows.length) return res.status(404).json({ success: false, message: 'Organization not found.' });
    const before = beforeRows[0];

    params.push(req.params.id);
    const [result] = await pool.query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Organization not found.' });

    const ip = getIp(req);
    const adminId = req.admin.id;
    const adminName = req.admin.name || req.admin.email;
    for (const f of fields) {
      if (req.body[f] === undefined) continue;
      const oldVal = before[f] || '';
      const newVal = req.body[f] || '';
      if (String(oldVal) === String(newVal)) continue;
      await pool.query(
        'INSERT INTO organization_profile_edit_logs (org_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.params.id, PROFILE_FIELD_LABELS[f] || f, oldVal, newVal, adminId, adminName, ip]
      );
    }

    return res.json({ success: true, message: 'Organization updated.' });
  } catch (err) {
    console.error('updateOrganization error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Change an organization's email and/or mobile number. Either field
//        actually being CHANGED (not just re-submitted with its current
//        value) must have already passed the OTP flow for the new value
//        (POST /api/otp/send-email-otp|send-phone-otp then /api/otp/verify
//        with purpose='org_email_change'|'org_mobile_change' —
//        see otpController.js, and OtpGate.jsx on the client), same
//        mechanism registration and updateIndividualContact already use.
//        This proves the new address/number is actually reachable before
//        it's assigned to an existing organization's login credentials.
//        Every changed field is recorded to organization_activity_logs
//        (module='organizations', actionType='edit') — visible on the
//        Activity Log tab, same audit trail as every other org action.
// @route PUT /api/admin/organizations/:id/contact
const updateOrganizationContact = async (req, res) => {
  try {
    const { id } = req.params;
    const newEmail = (req.body.org_email || '').trim().toLowerCase();
    const newMobile = normalizeIndianMobile(req.body.org_mobile);

    if (!newEmail || !EMAIL_RE.test(newEmail)) return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    if (!newMobile) return res.status(400).json({ success: false, message: 'A valid 10-digit Indian mobile number is required.' });

    const [rows] = await pool.query('SELECT id, org_name, org_email, org_mobile FROM organizations WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Organization not found.' });
    const current = rows[0];

    const emailChanged = newEmail !== current.org_email.toLowerCase();
    const mobileChanged = newMobile !== current.org_mobile;
    if (!emailChanged && !mobileChanged) return res.status(400).json({ success: false, message: 'No changes to save.' });

    // Uniqueness — re-checked here as the DB-level backstop (matches
    // registration's convention), on top of organizations.org_email's
    // UNIQUE column and the uq_org_mobile index, which would reject the
    // UPDATE anyway; this just produces a clean 409 instead of a raw
    // ER_DUP_ENTRY.
    if (emailChanged) {
      const [dup] = await pool.query('SELECT id FROM organizations WHERE org_email = ? AND id != ?', [newEmail, id]);
      if (dup.length) return res.status(409).json({ success: false, message: 'This email address is already registered to another organization.' });
      if (!(await isChannelVerified('email', newEmail, 'org_email_change'))) {
        return res.status(400).json({ success: false, message: 'Please verify the new email address with OTP before saving.' });
      }
    }
    if (mobileChanged) {
      const [dup] = await pool.query('SELECT id FROM organizations WHERE org_mobile = ? AND id != ?', [newMobile, id]);
      if (dup.length) return res.status(409).json({ success: false, message: 'This mobile number is already registered to another organization.' });
      if (!(await isChannelVerified('phone', newMobile, 'org_mobile_change'))) {
        return res.status(400).json({ success: false, message: 'Please verify the new mobile number with OTP before saving.' });
      }
    }

    const updates = [];
    const params = [];
    if (emailChanged) { updates.push('org_email = ?', 'email_verified = 1'); params.push(newEmail); }
    if (mobileChanged) { updates.push('org_mobile = ?', 'mobile_verified = 1'); params.push(newMobile); }
    params.push(id);
    await pool.query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params);

    const previousValue = {};
    const newValue = {};
    if (emailChanged) { previousValue.org_email = current.org_email; newValue.org_email = newEmail; }
    if (mobileChanged) { previousValue.org_mobile = current.org_mobile; newValue.org_mobile = newMobile; }

    await logOrgActivity({
      orgId: id, orgName: current.org_name, actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name || req.admin.email,
      module: 'organizations', actionType: 'edit', description: 'Organization contact details changed by Super Admin', req,
      previousValue, newValue,
    });

    // Also recorded as clean per-field rows for the Edit History tab (see
    // getOrgEditLogs) — organization_activity_logs above covers every
    // action type mixed together; this is the same dedicated per-field
    // trail AdminIndividualDetail.jsx's Edit History uses.
    const ip = getIp(req);
    const adminId = req.admin.id;
    const adminName = req.admin.name || req.admin.email;
    if (emailChanged) {
      await pool.query(
        'INSERT INTO organization_profile_edit_logs (org_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, PROFILE_FIELD_LABELS.org_email, current.org_email, newEmail, adminId, adminName, ip]
      );
    }
    if (mobileChanged) {
      await pool.query(
        'INSERT INTO organization_profile_edit_logs (org_id, field_name, old_value, new_value, updated_by_id, updated_by_name, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, PROFILE_FIELD_LABELS.org_mobile, current.org_mobile, newMobile, adminId, adminName, ip]
      );
    }

    return res.json({ success: true, message: 'Contact details updated successfully.' });
  } catch (err) {
    console.error('updateOrganizationContact error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email or mobile number is already registered to another organization.' });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Super-Admin-initiated password reset — sets a new password
//        directly (no current-password check), same precedent as
//        staffController.js's resetStaffPassword. Uses the stronger
//        public-facing password policy (isStrongPassword) rather than
//        Staff Management's looser one, since organizations are
//        customer-facing accounts that registered under that same policy.
//        Doesn't force other active sessions to log out — see
//        forceLogoutOrgSession on the Login History tab if that's also
//        needed.
// @route PUT /api/admin/organizations/:id/password
const resetOrganizationPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS_MESSAGE });
    }

    const [rows] = await pool.query('SELECT org_name FROM organizations WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Organization not found.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE organizations SET password_hash = ? WHERE id = ?', [passwordHash, req.params.id]);

    await logOrgActivity({
      orgId: req.params.id, orgName: rows[0].org_name, actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name || req.admin.email,
      module: 'organizations', actionType: 'password_reset', description: 'Password reset by Super Admin', req,
    });

    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('resetOrganizationPassword error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Set an organization's module permission grants — a flat list of
//        module keys, same all-or-nothing model as staff.permissions.
//        Body: { permissions: ["dashboard", "children", ...] }
// @route PUT /api/admin/organizations/:id/permissions
const updateOrganizationPermissions = async (req, res) => {
  try {
    const input = req.body.permissions;
    if (!Array.isArray(input)) {
      return res.status(400).json({ success: false, message: 'permissions must be an array.' });
    }

    // Whitelist-filter to known modules so an unrecognized key can never
    // silently grant access to something requireAdminOrOrgAuth doesn't
    // actually check for.
    const sanitized = [...new Set(input.filter(moduleKey => ORG_PERMISSION_MODULES.includes(moduleKey)))];

    const [existingRows] = await pool.query('SELECT org_name, permissions FROM organizations WHERE id = ?', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ success: false, message: 'Organization not found.' });
    const previousPermissions = Array.isArray(existingRows[0].permissions) ? existingRows[0].permissions : [];

    const [result] = await pool.query(
      'UPDATE organizations SET permissions = ? WHERE id = ?',
      [JSON.stringify(sanitized), req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Organization not found.' });

    await logOrgActivity({
      orgId: req.params.id, orgName: existingRows[0].org_name, actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name || req.admin.email,
      module: 'organizations', actionType: 'permissions_updated', description: 'Organization module permissions changed by Super Admin', req,
      previousValue: previousPermissions, newValue: sanitized,
    });

    return res.json({ success: true, message: 'Permissions updated.', permissions: sanitized });
  } catch (err) {
    console.error('updateOrganizationPermissions error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Immediately end one of an organization's active login sessions.
//        requireAdminOrOrgAuth.js cross-checks every org request's
//        X-Session-Id against an OPEN org_login_sessions row, so closing it
//        here takes effect on that session's very next API call — not just
//        a historical record (see the comment there).
// @route POST /api/admin/organizations/:id/sessions/:sessionId/force-logout
const forceLogoutOrgSession = async (req, res) => {
  try {
    const { id, sessionId } = req.params;

    const [orgRows] = await pool.query('SELECT org_name FROM organizations WHERE id = ?', [id]);
    if (!orgRows.length) return res.status(404).json({ success: false, message: 'Organization not found.' });

    const [result] = await pool.query(`
      UPDATE org_login_sessions
      SET logout_time = NOW(), session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW()), logout_type = 'forced'
      WHERE id = ? AND org_id = ? AND status = 'success' AND logout_time IS NULL
    `, [sessionId, id]);

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Active session not found or already ended.' });
    }

    await logOrgActivity({
      orgId: id, orgName: orgRows[0].org_name, actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name || req.admin.email,
      module: 'organizations', actionType: 'force_logout', description: `Force-logged-out session #${sessionId}`, req,
      recordType: 'org_login_sessions', recordId: sessionId,
    });

    return res.json({ success: true, message: 'Session ended.' });
  } catch (err) {
    console.error('forceLogoutOrgSession error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// "Session Expired" isn't stored — a session that never got an explicit
// logout call is only distinguishable from "still active" by whether the
// JWT it was issued with has expired, computed at read time against the
// same 12h lifetime loginAdmin signs with. Mirrors staffController.js's
// LOGOUT_STATUS_CASE, adapted to org_login_sessions.logout_type instead of
// staff_login_sessions.logout_status.
const LOGOUT_STATUS_CASE = `
    CASE
        WHEN ls.status = 'failed' THEN NULL
        WHEN ls.logout_type = 'forced' THEN 'force_logout'
        WHEN ls.logout_time IS NOT NULL THEN 'normal'
        WHEN ls.login_time < DATE_SUB(NOW(), INTERVAL 12 HOUR) THEN 'session_expired'
        ELSE 'active'
    END
`;

// @desc  Per-session login/logout audit trail for one organization —
//        direct port of staffController.js's getStaffLoginHistory, scoped
//        to org_login_sessions instead of staff_login_sessions.
// @route GET /api/admin/organizations/:id/login-history
const getOrgLoginHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      search = '', startDate = '', endDate = '',
      sortKey = 'login_time', sortDir = 'desc', page = 1, limit = 20,
    } = req.query;

    const [orgRows] = await pool.query('SELECT id, org_name, org_email FROM organizations WHERE id = ?', [id]);
    if (!orgRows.length) return res.status(404).json({ success: false, message: 'Organization not found.' });

    const clauses = ['ls.org_id = ?'];
    const params = [id];
    if (search.trim()) {
      clauses.push('(ls.ip_address LIKE ? OR ls.browser LIKE ? OR ls.os LIKE ? OR ls.device_type LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }
    if (startDate) { clauses.push('DATE(ls.login_time) >= ?'); params.push(startDate); }
    if (endDate) { clauses.push('DATE(ls.login_time) <= ?'); params.push(endDate); }
    const where = `WHERE ${clauses.join(' AND ')}`;

    const SORTABLE = new Set(['login_time', 'logout_time', 'session_duration', 'ip_address', 'browser', 'os', 'device_type']);
    const col = SORTABLE.has(sortKey) ? sortKey : 'login_time';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(5000, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * pageSize;

    const [rows] = await pool.query(`
      SELECT ls.id, ls.status AS login_status, ls.login_time, ls.logout_time, ls.session_duration,
             ls.ip_address, ls.browser, ls.os, ls.device_type, ls.failure_reason,
             ${LOGOUT_STATUS_CASE} AS logout_status
      FROM org_login_sessions ls
      ${where}
      ORDER BY ls.${col} ${dir}
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM org_login_sessions ls ${where}`, params);

    const [[summary]] = await pool.query(`
      SELECT
          SUM(ls.status = 'success') AS total_logins,
          SUM(ls.status = 'failed')  AS total_failed,
          MAX(CASE WHEN ls.status = 'success' THEN ls.login_time END) AS last_login,
          MAX(ls.logout_time) AS last_logout,
          SUM(COALESCE(ls.session_duration, 0)) AS total_working_seconds,
          AVG(ls.session_duration) AS avg_session_seconds
      FROM org_login_sessions ls
      ${where}
    `, params);

    return res.json({
      success: true,
      organization: orgRows[0],
      sessions: rows,
      total, page: pageNum, limit: pageSize,
      summary: {
        totalLogins: Number(summary.total_logins) || 0,
        totalFailed: Number(summary.total_failed) || 0,
        lastLogin: summary.last_login,
        lastLogout: summary.last_logout,
        totalWorkingSeconds: Number(summary.total_working_seconds) || 0,
        avgSessionSeconds: summary.avg_session_seconds != null ? Number(summary.avg_session_seconds) : null,
      },
    });
  } catch (err) {
    console.error('getOrgLoginHistory error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load login history.' });
  }
};

// @desc  Full activity audit trail for one organization — direct port of
//        staffController.js's getActivityLog, scoped to
//        organization_activity_logs instead of staff_activity_logs.
// @route GET /api/admin/organizations/:id/activity-log
const getOrgActivityLog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      module = '', actionType = '', sessionId = '', search = '',
      startDate = '', endDate = '', sortKey = 'created_at', sortDir = 'desc',
      page = 1, limit = 50,
    } = req.query;

    const clauses = ['org_id = ?'];
    const params = [id];
    if (module) { clauses.push('module = ?'); params.push(module); }
    if (actionType) { clauses.push('action_type = ?'); params.push(actionType); }
    if (sessionId) { clauses.push('session_id = ?'); params.push(sessionId); }
    if (startDate) { clauses.push('DATE(created_at) >= ?'); params.push(startDate); }
    if (endDate) { clauses.push('DATE(created_at) <= ?'); params.push(endDate); }
    if (search.trim()) {
      clauses.push('(actor_name LIKE ? OR description LIKE ? OR record_name LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    const where = `WHERE ${clauses.join(' AND ')}`;

    const SORTABLE = new Set(['created_at', 'module', 'action_type', 'actor_name']);
    const col = SORTABLE.has(sortKey) ? sortKey : 'created_at';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(5000, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * pageSize;

    const [rows] = await pool.query(
      `SELECT id, actor_type, actor_id, actor_name, module, action_type, description,
              record_type, record_id, record_name, previous_value, new_value, metadata,
              ip_address, browser, os, device_type, session_id, status, error_message, created_at
       FROM organization_activity_logs ${where}
       ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM organization_activity_logs ${where}`, params);

    return res.json({ success: true, logs: rows, total, page: pageNum, limit: pageSize });
  } catch (err) {
    console.error('getOrgActivityLog error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load activity log.' });
  }
};

// @desc  Full field-level edit history for one organization's profile —
//        direct port of adminIndividualController.js's getIndividualEditLogs.
// @route GET /api/admin/organizations/:id/edit-logs
const getOrgEditLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, field_name, old_value, new_value, updated_by_name, ip_address, action_type, created_at
       FROM organization_profile_edit_logs WHERE org_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    return res.json({ success: true, logs: rows });
  } catch (err) {
    console.error('getOrgEditLogs error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getAllOrganizations, getOrganizationById, approveOrganization,
  rejectOrganization, suspendOrganization, activateOrganization, updateOrganization, updateOrganizationContact,
  resetOrganizationPassword,
  updateOrganizationPermissions, forceLogoutOrgSession, getOrgLoginHistory, getOrgActivityLog, getOrgEditLogs,
  ORG_PERMISSION_MODULES,
};
