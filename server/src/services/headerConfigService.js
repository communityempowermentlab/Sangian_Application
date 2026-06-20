const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'header-config.json');

const DEFAULTS = { showChildId: true, showTimer: true, showScore: true };

const getConfig = () => {
    if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULTS };
    const stored = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return { ...DEFAULTS, ...stored };
};

const saveConfig = (config) => {
    const merged = { ...DEFAULTS, ...config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + '\n');
    return merged;
};

module.exports = { getConfig, saveConfig };
