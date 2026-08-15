const { pool } = require('../config/db');

// Managed picklist backing organizations.org_type (see db.js's org_types
// table) — a simple ordered, activatable list, same "Meta" home as CMS
// pages/FAQ/contact info (AdminMeta.jsx). Feeds two dropdowns: the public
// registration form (UnifiedRegister.jsx, via getPublicOrgTypes) and the
// Super Admin's org edit page (AdminOrganizationDetail.jsx, via
// getAllOrgTypes for the full list including inactive ones, so a
// previously-used-but-now-retired type still displays correctly on an
// existing organization's record).

// @desc  Full list (including inactive) — Admin > Meta > Organization Types.
// @route GET /api/admin/org-types
const getAllOrgTypes = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM org_types ORDER BY sort_order ASC, label ASC');
    return res.json({ success: true, orgTypes: rows });
  } catch (err) {
    console.error('getAllOrgTypes error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Active-only list — consumed by the public registration form.
// @route GET /api/public/org-types
// @access Public
const getPublicOrgTypes = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT value, label FROM org_types WHERE status = 'active' ORDER BY sort_order ASC, label ASC"
    );
    return res.json({ success: true, orgTypes: rows });
  } catch (err) {
    console.error('getPublicOrgTypes error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Add a new organization type.
// @route POST /api/admin/org-types
const addOrgType = async (req, res) => {
  try {
    const value = (req.body.value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const label = (req.body.label || '').trim();
    if (!value || !label) return res.status(400).json({ success: false, message: 'Label is required.' });

    const [dup] = await pool.query('SELECT id FROM org_types WHERE value = ?', [value]);
    if (dup.length) return res.status(409).json({ success: false, message: 'An organization type with this name already exists.' });

    const [[{ maxOrder }]] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM org_types');
    const [result] = await pool.query(
      'INSERT INTO org_types (value, label, sort_order, status) VALUES (?, ?, ?, ?)',
      [value, label, maxOrder + 1, 'active']
    );
    return res.status(201).json({ success: true, message: 'Organization type added.', id: result.insertId });
  } catch (err) {
    console.error('addOrgType error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'An organization type with this name already exists.' });
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// @desc  Edit an organization type's label/status/order. `value` is
//        immutable once created — it's what's actually stored on existing
//        organizations.org_type rows, so changing it would silently
//        detach them from this list entry.
// @route PUT /api/admin/org-types/:id
const updateOrgType = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const params = [];
    if (req.body.label !== undefined) {
      const label = req.body.label.trim();
      if (!label) return res.status(400).json({ success: false, message: 'Label cannot be empty.' });
      updates.push('label = ?'); params.push(label);
    }
    if (req.body.status !== undefined) {
      if (!['active', 'inactive'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
      updates.push('status = ?'); params.push(req.body.status);
    }
    if (req.body.sort_order !== undefined) {
      updates.push('sort_order = ?'); params.push(Number(req.body.sort_order) || 0);
    }
    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update.' });

    params.push(id);
    const [result] = await pool.query(`UPDATE org_types SET ${updates.join(', ')} WHERE id = ?`, params);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Organization type not found.' });
    return res.json({ success: true, message: 'Organization type updated.' });
  } catch (err) {
    console.error('updateOrgType error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getAllOrgTypes, getPublicOrgTypes, addOrgType, updateOrgType };
