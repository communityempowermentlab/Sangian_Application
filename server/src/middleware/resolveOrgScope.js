// Computes req.orgScope = { orgId, isSuperAdmin } from whichever identity
// requireAdminOrOrgAuth authenticated. Must run after requireAdminOrOrgAuth
// (reads req.admin / req.org that it sets). This is the single point every
// org-scoped controller (children, staff) reads to filter/stamp its
// queries — see adminChildController.js, staffController.js.
const resolveOrgScope = (req, res, next) => {
  if (req.admin?.role === 'admin') {
    req.orgScope = { orgId: null, isSuperAdmin: true };
    return next();
  }
  if (req.admin?.role === 'staff') {
    // Staff created before this feature existed (or by the Super Admin
    // directly) have org_id = NULL — treated as global/Super-Admin-managed,
    // same as today: such a staff account sees/manages only org_id-NULL
    // records, not "everything," so a staff account can never see another
    // organization's data just by having a module grant.
    req.orgScope = { orgId: req.admin.org_id ?? null, isSuperAdmin: false };
    return next();
  }
  if (req.org) {
    req.orgScope = { orgId: req.org.id, isSuperAdmin: false };
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized.' });
};

module.exports = resolveOrgScope;
