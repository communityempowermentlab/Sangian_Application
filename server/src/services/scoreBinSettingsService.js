const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'score-bin-settings.json');

// Games whose Score Distribution bins an admin can set from Settings → Score
// Distribution. Padh ke Batao and Ankganit (every version) are deliberately
// left out — their scores are ordinal levels / rubric bands, not point counts.
const CONFIGURABLE_GAMES = [
    'number_recall_lottery',
    'number_recall_lottery_v2',
    'working_memory_herpher',
    'working_memory_herpher_v2',
    'working_memory_herpher_v3',
    'rover_mela',
    'cognitive_flex_chor',
    'atlantis_bagiya',
    'triangle_rachna',
    'auditory_dhyan',
];

// Upper limit on bars per game, so a tiny width on a high-max game (e.g. width
// 1 on Bagiya's 108) can't produce a chart too dense to read.
const MAX_BINS = 20;

const readConfig = () => {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
};

const writeConfig = (config) => {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
};

// Returns { binWidth, separateZero } for a game, or null when the admin hasn't
// set one — callers then fall back to the game's built-in default buckets.
const getGameSetting = (gameKey) => {
    if (!CONFIGURABLE_GAMES.includes(gameKey)) return null;
    const entry = readConfig()[gameKey];
    if (!entry || !Number.isInteger(entry.binWidth) || entry.binWidth < 1) return null;
    return { binWidth: entry.binWidth, separateZero: !!entry.separateZero };
};

// Equal-width bins of `binWidth` points over 0..maxScore, optionally with 0 as
// its own bar. The top bin is open-ended (hi: null) so scores at/above the max
// still count, matching the convention of the built-in buckets.
const buildWidthBuckets = (maxScore, binWidth, separateZero) => {
    const buckets = separateZero ? [{ lo: 0, hi: 0 }] : [];
    for (let lo = separateZero ? 1 : 0; lo <= maxScore; lo += binWidth) {
        const hi = lo + binWidth - 1;
        if (hi >= maxScore) { buckets.push({ lo, hi: null }); break; }
        buckets.push({ lo, hi });
    }
    return buckets;
};

const setGameSetting = (gameKey, { binWidth, separateZero }) => {
    const config = readConfig();
    config[gameKey] = { binWidth, separateZero: !!separateZero };
    writeConfig(config);
};

const resetGameSetting = (gameKey) => {
    const config = readConfig();
    delete config[gameKey];
    writeConfig(config);
};

module.exports = {
    CONFIGURABLE_GAMES,
    MAX_BINS,
    getGameSetting,
    buildWidthBuckets,
    setGameSetting,
    resetGameSetting,
};
