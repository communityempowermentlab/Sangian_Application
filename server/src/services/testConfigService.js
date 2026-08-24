const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'test-config.json');

// Canonical registry of all games — mirrors the GAMES list used by AdminDocs.jsx
// (game_documents / screenshot_library keys). Adding a new game here is the only
// step needed for it to show up in Test Configuration — no other code changes.
const GAMES_REGISTRY = [
    { key: 'atlantis_bagiya',        title: 'Bagiya',            category: 'Memory Test'   },
    { key: 'number_recall_lottery',  title: 'Lottery Ka Ticket', category: 'Memory Test'   },
    { key: 'number_recall_lottery_v2', title: 'Lottery Ka Ticket - Version 2', category: 'Memory Test'   },
    { key: 'working_memory_herpher', title: 'Her Pher - V0',     category: 'Memory Test'   },
    { key: 'working_memory_herpher_v2', title: 'Her Pher - V1',  category: 'Memory Test'   },
    { key: 'working_memory_herpher_v3', title: 'Her Pher',       category: 'Memory Test'   },
    { key: 'rover_mela',             title: 'Chalo Mela Chalen', category: 'Cognitive Test' },
    { key: 'triangle_rachna',        title: 'Rachna',            category: 'Cognitive Test' },
    { key: 'cognitive_flex_chor',    title: 'Chor Machaye Shor', category: 'Cognitive Test' },
    { key: 'auditory_dhyan',         title: 'Dhyan Kahan Hai',   category: 'Attention Test' },
    { key: 'numeracy_number_skill',  title: 'Ankganit - V0',     category: 'Academic Test'  },
    { key: 'literacy_reading_skill', title: 'Padh ke Batao - V0', category: 'Academic Test'  },
    { key: 'literacy_reading_skill_v2', title: 'Padh ke Batao', category: 'Academic Test' },
    { key: 'numeracy_number_skill_v2', title: 'Ankganit - V1', category: 'Academic Test' },
    { key: 'numeracy_number_skill_v3', title: 'Ankganit', category: 'Academic Test' },
];

const readConfig = () => {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
};

const writeConfig = (config) => {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
};

const getList = () => {
    const stored = readConfig();
    const list = GAMES_REGISTRY.map((game) => {
        let enabled = true;
        let display_order = 999;
        const val = stored[game.key];
        
        if (val !== undefined) {
            if (typeof val === 'boolean') {
                enabled = val;
            } else if (typeof val === 'object') {
                enabled = val.enabled !== undefined ? val.enabled : true;
                display_order = val.display_order !== undefined ? val.display_order : 999;
            }
        }
        
        return {
            ...game,
            enabled,
            display_order
        };
    });

    list.sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        const aIndex = GAMES_REGISTRY.findIndex(g => g.key === a.key);
        const bIndex = GAMES_REGISTRY.findIndex(g => g.key === b.key);
        return aIndex - bIndex;
    });

    return list;
};

const getEnabledMap = () => {
    const stored = readConfig();
    const map = {};
    for (const game of GAMES_REGISTRY) {
        let enabled = true;
        let display_order = 999;
        const val = stored[game.key];
        
        if (val !== undefined) {
            if (typeof val === 'boolean') {
                enabled = val;
            } else if (typeof val === 'object') {
                enabled = val.enabled !== undefined ? val.enabled : true;
                display_order = val.display_order !== undefined ? val.display_order : 999;
            }
        }
        map[game.key] = { enabled, display_order };
    }
    return map;
};

const setEnabled = (key, enabled) => {
    if (!GAMES_REGISTRY.some((g) => g.key === key)) {
        throw new Error(`Unknown game key: ${key}`);
    }
    const stored = readConfig();
    const val = stored[key];
    let display_order = 999;
    
    if (val !== undefined) {
        if (typeof val === 'object' && val.display_order !== undefined) {
            display_order = val.display_order;
        }
    }
    
    stored[key] = { enabled: Boolean(enabled), display_order };
    writeConfig(stored);
};

const setOrder = (orderedKeys) => {
    const stored = readConfig();
    orderedKeys.forEach((key, index) => {
        let enabled = true;
        if (stored[key] !== undefined) {
            if (typeof stored[key] === 'boolean') {
                enabled = stored[key];
            } else if (typeof stored[key] === 'object') {
                enabled = stored[key].enabled !== undefined ? stored[key].enabled : true;
            }
        }
        stored[key] = { enabled, display_order: index + 1 };
    });
    writeConfig(stored);
};

module.exports = { GAMES_REGISTRY, getList, getEnabledMap, setEnabled, setOrder };
