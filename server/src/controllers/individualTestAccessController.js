const testConfigService = require('../services/testConfigService');
const individualTestAccessService = require('../services/individualTestAccessService');

// Admin: Settings → Test Configuration → Individual User Test Settings.
// Lists only currently-ACTIVE tests (per spec) alongside this global
// allow/deny flag — a test hidden platform-wide via Test Visibility doesn't
// need a separate Individual-User row.
const getList = (req, res) => {
    const activeTests = testConfigService.getList().filter((t) => t.enabled);
    const allowedMap = individualTestAccessService.getAllowedMap();
    const tests = activeTests.map((t) => ({
        key: t.key,
        title: t.title,
        category: t.category,
        enabled: t.enabled,
        individualAccess: allowedMap[t.key],
    }));
    res.json({ tests });
};

const updateAccess = (req, res) => {
    const { key } = req.params;
    const { allowed } = req.body;
    if (typeof allowed !== 'boolean') {
        return res.status(400).json({ success: false, message: 'allowed must be a boolean.' });
    }
    try {
        individualTestAccessService.setAllowed(key, allowed);
        res.json({ success: true, key, allowed });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Public — consumed by Home.jsx for an Individual User's own session (an
// Individual plays as their own linked child profile; see
// gameController.js's startGameSession for the matching server-side gate).
const getPublicAllowedMap = (req, res) => {
    res.json(individualTestAccessService.getAllowedMap());
};

module.exports = { getList, updateAccess, getPublicAllowedMap };
