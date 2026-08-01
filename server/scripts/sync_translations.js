const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join(__dirname, '..', 'translations');
const BASE_FILE = path.join(TRANSLATIONS_DIR, 'english.json');

// Deep merge function: adds missing keys from base to target
function syncObjects(base, target) {
    if (typeof base !== 'object' || base === null) {
        return target !== undefined ? target : base;
    }
    
    if (typeof target !== 'object' || target === null) {
        target = Array.isArray(base) ? [] : {};
    }

    for (const key of Object.keys(base)) {
        if (!target.hasOwnProperty(key)) {
            // Missing key: deep copy the base value
            target[key] = JSON.parse(JSON.stringify(base[key]));
        } else if (typeof base[key] === 'object' && base[key] !== null) {
            // Key exists and is object: recurse
            target[key] = syncObjects(base[key], target[key]);
        }
    }
    
    // Sort keys alphabetically to match the structure if possible, but JS object order
    // is insertion order, so we'll just reconstruct the object following the base order
    const orderedTarget = Array.isArray(target) ? [] : {};
    for (const key of Object.keys(base)) {
        orderedTarget[key] = target[key];
    }
    
    // Check if there are keys in target that are NOT in base (to preserve them, or we can drop them. Usually we keep them)
    for (const key of Object.keys(target)) {
        if (!orderedTarget.hasOwnProperty(key)) {
            orderedTarget[key] = target[key];
        }
    }

    return orderedTarget;
}

function run() {
    console.log('Reading base file: english.json');
    const baseData = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8'));
    
    const files = fs.readdirSync(TRANSLATIONS_DIR).filter(f => f.endsWith('.json') && f !== 'language-settings.json' && f !== 'english.json');
    
    for (const file of files) {
        const filePath = path.join(TRANSLATIONS_DIR, file);
        const targetData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log(`Syncing ${file}...`);
        const syncedData = syncObjects(baseData, targetData);
        
        fs.writeFileSync(filePath, JSON.stringify(syncedData, null, 2) + '\n');
        console.log(`  Saved synced ${file}`);
    }
    
    console.log('All files synchronized.');
}

run();
