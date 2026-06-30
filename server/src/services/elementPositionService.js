const fs = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, '..', '..', 'config', 'element-positions.json');
const DEFAULTS_FILE = path.join(__dirname, '..', '..', 'config', 'element-positions.defaults.json');

const readJsonFile = (file) => {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const writeStore = (store) => {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2) + '\n');
};

// All screens' layouts for one game, falling back to the frozen defaults for
// any screen the runtime store doesn't have (e.g. first run, or a screen that
// was never customized).
const getLayouts = (gameKey) => {
    const store = readJsonFile(STORE_FILE)[gameKey] || {};
    const defaults = readJsonFile(DEFAULTS_FILE)[gameKey] || {};
    return { ...defaults, ...store };
};

const getLayout = (gameKey, screenNum) => {
    const layouts = getLayouts(gameKey);
    return layouts[String(screenNum)] || [];
};

const saveLayout = (gameKey, screenNum, positions) => {
    const store = readJsonFile(STORE_FILE);
    store[gameKey] = { ...(store[gameKey] || {}), [String(screenNum)]: positions };
    writeStore(store);
    return positions;
};

// Drops the runtime override for this screen so getLayouts() falls back to
// the frozen defaults again, rather than writing the defaults back in (which
// would make them indistinguishable from a deliberate save).
const resetLayout = (gameKey, screenNum) => {
    const store = readJsonFile(STORE_FILE);
    if (store[gameKey]) delete store[gameKey][String(screenNum)];
    writeStore(store);
    const defaults = readJsonFile(DEFAULTS_FILE)[gameKey] || {};
    return defaults[String(screenNum)] || [];
};

module.exports = { getLayouts, getLayout, saveLayout, resetLayout };
