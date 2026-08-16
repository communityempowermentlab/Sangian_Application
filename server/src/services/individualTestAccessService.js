const fs = require('fs');
const path = require('path');
const { GAMES_REGISTRY } = require('./testConfigService');

// Global Individual User Test Settings — a separate, independent access-
// control layer from Organization-wise Test Assignment (assignedTestsGuard.js).
// This one is NOT per-organization/per-user: a single ON/OFF switch per test,
// applied to every Individual User platform-wide. Same file-based JSON
// convention as testConfigService.js (Admin edits take effect without a
// deployment).
const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'individual-test-access.json');

const readConfig = () => {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
};

const writeConfig = (config) => {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
};

// Absent key => allowed. This is the load-bearing default: every test an
// Individual User could already play stays playable the instant this
// feature ships — Admin must explicitly switch a test OFF to restrict it,
// mirroring testConfigService's own enabled-by-default convention (and the
// "unrestricted until curated" default chosen for Organization-wise Test
// Assignment) so no existing Individual User loses access on deploy.
const isAllowed = (key) => {
    const stored = readConfig();
    return stored[key] !== undefined ? Boolean(stored[key]) : true;
};

const getAllowedMap = () => {
    const stored = readConfig();
    const map = {};
    for (const game of GAMES_REGISTRY) {
        map[game.key] = stored[game.key] !== undefined ? Boolean(stored[game.key]) : true;
    }
    return map;
};

const setAllowed = (key, allowed) => {
    if (!GAMES_REGISTRY.some((g) => g.key === key)) {
        throw new Error(`Unknown game key: ${key}`);
    }
    const stored = readConfig();
    stored[key] = Boolean(allowed);
    writeConfig(stored);
};

module.exports = { isAllowed, getAllowedMap, setAllowed };
