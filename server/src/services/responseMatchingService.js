const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'response-matching-config.json');

// 'exact'   — response length must equal the question/stimulus length.
// 'partial' — any non-empty response is accepted; scoring evaluates only the entered items.
const DEFAULTS = { responseMatchingMode: 'exact', displayUserInputString: true, displayHerPherPractice: true };
const VALID_MODES = ['exact', 'partial'];

const getConfig = () => {
    if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULTS };
    const stored = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return { ...DEFAULTS, ...stored };
};

const saveConfig = (config) => {
    const merged = { ...DEFAULTS, ...config };
    if (!VALID_MODES.includes(merged.responseMatchingMode)) {
        merged.responseMatchingMode = DEFAULTS.responseMatchingMode;
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + '\n');
    return merged;
};

module.exports = { getConfig, saveConfig, VALID_MODES };
