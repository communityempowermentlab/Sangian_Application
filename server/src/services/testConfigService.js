const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'test-config.json');

// Canonical registry of all games — mirrors the GAMES list used by AdminDocs.jsx
// (game_documents / screenshot_library keys). Adding a new game here is the only
// step needed for it to show up in Test Configuration — no other code changes.
const GAMES_REGISTRY = [
    { key: 'atlantis_bagiya',        title: 'Bagiya',            category: 'Memory Test'   },
    { key: 'number_recall_lottery',  title: 'Lottery Ka Ticket', category: 'Memory Test'   },
    { key: 'working_memory_herpher', title: 'Her Pher',          category: 'Memory Test'   },
    { key: 'rover_mela',             title: 'Chalo Mela Chalen', category: 'Cognitive Test' },
    { key: 'triangle_rachna',        title: 'Rachna',            category: 'Cognitive Test' },
    { key: 'cognitive_flex_chor',    title: 'Chor Machaye Shor', category: 'Cognitive Test' },
    { key: 'auditory_dhyan',         title: 'Dhyan Kahan Hai',   category: 'Attention Test' },
    { key: 'numeracy_number_skill',  title: 'Ankganit',          category: 'Academic Test'  },
    { key: 'literacy_reading_skill', title: 'Padh ke Batao',     category: 'Academic Test'  },
];

const readConfig = () => {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
};

const writeConfig = (config) => {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
};

// Games not yet present in the config file default to enabled (true) — this is what
// makes newly-added games show up automatically without an admin having to opt them in.
const getList = () => {
    const stored = readConfig();
    return GAMES_REGISTRY.map((game) => ({
        ...game,
        enabled: stored[game.key] !== undefined ? Boolean(stored[game.key]) : true,
    }));
};

const getEnabledMap = () => {
    const stored = readConfig();
    const map = {};
    for (const game of GAMES_REGISTRY) {
        map[game.key] = stored[game.key] !== undefined ? Boolean(stored[game.key]) : true;
    }
    return map;
};

const setEnabled = (key, enabled) => {
    if (!GAMES_REGISTRY.some((g) => g.key === key)) {
        throw new Error(`Unknown game key: ${key}`);
    }
    const stored = readConfig();
    stored[key] = Boolean(enabled);
    writeConfig(stored);
};

module.exports = { GAMES_REGISTRY, getList, getEnabledMap, setEnabled };
