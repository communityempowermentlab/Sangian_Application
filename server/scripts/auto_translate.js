const fs = require('fs');
const path = require('path');
const translate = require('google-translate-api-x');

const TRANSLATIONS_DIR = path.join(__dirname, '..', 'translations');
const BASE_FILE = path.join(TRANSLATIONS_DIR, 'english.json');

const LANG_MAP = {
    'assamese.json': 'as',
    'bengali.json': 'bn',
    'dogri.json': 'doi',
    'gujarati.json': 'gu',
    'hindi.json': 'hi',
    'kannada.json': 'kn',
    'konkani.json': 'gom',
    'maithili.json': 'mai',
    'malayalam.json': 'ml',
    'manipuri.json': 'mni-Mtei',
    'marathi.json': 'mr',
    'nepali.json': 'ne',
    'odia.json': 'or',
    'punjabi.json': 'pa',
    'sanskrit.json': 'sa',
    'santali.json': 'sat',
    'sindhi.json': 'sd',
    'tamil.json': 'ta',
    'telugu.json': 'te',
    'urdu.json': 'ur'
};

const flatten = (obj, prefix = '', out = {}) => {
    for (const [key, value] of Object.entries(obj)) {
        const p = prefix ? prefix + '.' + key : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, p, out);
        } else {
            out[p] = value;
        }
    }
    return out;
};

const setValueAtPath = (obj, dotPath, value) => {
    const keys = dotPath.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
        cur = cur[key];
    }
    cur[keys[keys.length - 1]] = value;
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
    console.log('Reading base English file...');
    const engData = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8'));
    const engFlat = flatten(engData);

    for (const [filename, langCode] of Object.entries(LANG_MAP)) {
        const filePath = path.join(TRANSLATIONS_DIR, filename);
        if (!fs.existsSync(filePath)) continue;

        console.log(`\nProcessing ${filename} -> ${langCode}`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const flat = flatten(data);
        
        let batchKeys = [];
        let batchTexts = [];
        let translatedCount = 0;
        let errorCount = 0;

        // Group into batches of 30 to avoid payload size limits and rate limits
        const BATCH_SIZE = 30;

        for (const [key, val] of Object.entries(flat)) {
            const engVal = engFlat[key];
            if (typeof val === 'string' && val === engVal && /[a-zA-Z]/.test(val)) {
                batchKeys.push(key);
                batchTexts.push(val);
            }
        }
        
        if (batchKeys.length === 0) {
            console.log(`  Already fully translated. Skipping.`);
            continue;
        }

        console.log(`  Found ${batchKeys.length} strings to translate...`);
        
        for (let i = 0; i < batchKeys.length; i += BATCH_SIZE) {
            const currentKeys = batchKeys.slice(i, i + BATCH_SIZE);
            const currentTexts = batchTexts.slice(i, i + BATCH_SIZE);
            
            try {
                const res = await translate(currentTexts, { to: langCode });
                
                // If it's a single string it returns an object, if array it returns an array
                const results = Array.isArray(res) ? res : [res];
                
                for (let j = 0; j < currentKeys.length; j++) {
                    setValueAtPath(data, currentKeys[j], results[j].text);
                    translatedCount++;
                }
                
                console.log(`    Batch translated ${translatedCount} / ${batchKeys.length}...`);
                await delay(2000); // 2 second delay between batches
            } catch (e) {
                console.error(`    Error translating batch for ${langCode}:`, e.message);
                errorCount += currentKeys.length;
                await delay(5000);
            }
        }
        
        console.log(`Finished ${filename}. Translated: ${translatedCount}. Errors: ${errorCount}.`);
        if (translatedCount > 0) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
            console.log(`Saved ${filename}`);
        }
    }
    
    console.log('\nAll automated translations complete!');
}

run().catch(console.error);
