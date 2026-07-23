const fs = require('fs');
const path = require('path');
const { translate } = require('bing-translate-api');

const TRANSLATIONS_DIR = path.join(__dirname, '../server/translations');

// The language codes we need to translate to, mapping to Google Translate codes if different.
// Note: Google Translate API might not support all perfectly, but supports almost all scheduled languages.
const targetLanguages = {
  hindi: 'hi',
  assamese: 'as',
  bengali: 'bn',
  bodo: 'brx',
  dogri: 'doi',
  gujarati: 'gu',
  kannada: 'kn',
  kashmiri: 'ks',
  konkani: 'kok', // Google Translate uses 'gom' for Goan Konkani
  maithili: 'mai',
  malayalam: 'ml',
  manipuri: 'mni', // Meiteilon (Manipuri)
  marathi: 'mr',
  nepali: 'ne',
  odia: 'or',
  punjabi: 'pa',
  sanskrit: 'sa',
  santali: 'sat', // Might not be fully supported, API will fallback/error
  sindhi: 'sd',
  tamil: 'ta',
  telugu: 'te',
  urdu: 'ur'
};

const englishFile = path.join(TRANSLATIONS_DIR, 'english.json');
const englishData = JSON.parse(fs.readFileSync(englishFile, 'utf8'));

// Flatten JSON to easily iterate
const flatten = (obj, prefix = '', out = {}) => {
  for (const [key, value] of Object.entries(obj)) {
    const path_ = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path_, out);
    } else {
      out[path_] = value;
    }
  }
  return out;
};

const unflatten = (obj) => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const keys = key.split('.');
    let cur = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]]) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }
  return result;
};

const englishFlat = flatten(englishData);

// Split keys into batches of 20
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
  for (const [langName, langCode] of Object.entries(targetLanguages)) {
      console.log(`Starting translation for ${langName}...`);
      const targetFile = path.join(TRANSLATIONS_DIR, `${langName}.json`);
      
      let targetData = {};
      if (fs.existsSync(targetFile)) {
        try { targetData = JSON.parse(fs.readFileSync(targetFile, 'utf8')); } catch (e) {}
      }
      let targetFlat = flatten(targetData);

      const keysToTranslate = [];
      for (const [key, enValue] of Object.entries(englishFlat)) {
        if (!targetFlat[key] || targetFlat[key] === enValue) {
            if (typeof enValue === 'string' && enValue.trim().length > 0) {
                keysToTranslate.push(key);
            }
        }
      }

      if (keysToTranslate.length === 0) {
        console.log(`[${langName}] Already fully translated. Skipping.`);
        continue;
      }

      console.log(`[${langName}] Translating ${keysToTranslate.length} keys...`);

      const batches = chunkArray(keysToTranslate, 20); 
      
      for (let i = 0; i < batches.length; i++) {
        const batchKeys = batches[i];
        
        console.log(`[${langName}] Batch ${i+1}/${batches.length}...`);
        
        for (const key of batchKeys) {
          try {
            // Translate each individually since Bing rate limits are usually less strict but batching breaks more often
            const res = await translate(englishFlat[key], null, langCode);
            targetFlat[key] = res.translation;
            await delay(200); 
          } catch (err) {
            if (err.message && err.message.includes('not supported')) {
               console.log(`[${langName}] Language not supported by Bing API. Skipping language completely.`);
               i = batches.length; // break outer
               break;
            }
            console.error(`[${langName}] Failed key ${key}: ${err.message || 'Unknown error'}`);
            await delay(1000);
          }
        }
        
        fs.writeFileSync(targetFile, JSON.stringify(unflatten(targetFlat), null, 2));
      }
      
      console.log(`[${langName}] Completed translation.`);
  }

  console.log('All translations finished!');
}

run().catch(console.error);
