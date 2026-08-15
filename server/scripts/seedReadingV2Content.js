// One-time seeding tool for Padh ke Batao V2's multilingual test content.
// Not part of the running app — run manually once per environment:
//
//   node scripts/seedReadingV2Content.js                # local (http://localhost:5020)
//   BASE_URL=https://sangianapi.celworld.org node scripts/seedReadingV2Content.js   # production
//
// Reuses the existing, already-audited /admin/elements/config endpoint
// (elementsController.updateElementConfig) for every write — this script
// contains no direct DB access and no new persistence logic of its own.

require('dotenv').config();
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../src/config/jwtSecret');
const CONTENT = require('./readingV2Content');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5020';
const TEST_ID = 'literacy_reading_skill_v2';

const CONTENT_KEYS = [
  ['letters_bank', (c) => ({ letters: c.letters })],
  ['words_bank', (c) => ({ words: c.words })],
  ['paragraphs', (c) => ({ paragraphs: c.paragraphs })],
  ['story', (c) => ({ text: c.story })],
  ['paragraph_questions', (c) => ({ questions: c.paragraph_questions })],
  ['story_questions', (c) => ({ questions: c.story_questions })],
  ['paragraph_hints', (c) => ({ hints: c.paragraph_hints })],
  ['story_hints', (c) => ({ hints: c.story_hints })],
];

async function main() {
  const token = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  const languages = Object.keys(CONTENT);
  let ok = 0, fail = 0;

  for (const lang of languages) {
    const langContent = CONTENT[lang];
    for (const [key, shape] of CONTENT_KEYS) {
      const assetType = `content_${key}`;
      const config = shape(langContent);
      try {
        const res = await fetch(`${BASE_URL}/api/admin/elements/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ test_id: TEST_ID, asset_type: assetType, language: lang, config }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'unknown error');
        ok++;
      } catch (e) {
        fail++;
        console.error(`FAILED ${lang}/${assetType}:`, e.message);
      }
    }
  }

  console.log(`\nSeeded ${ok} (test_id, asset_type, language) rows, ${fail} failures, across ${languages.length} languages (${languages.join(', ')}).`);
  console.log('Deliberately not seeded (left "Missing" for Admin/native-speaker input): brx (Bodo), mni (Manipuri), sat (Santali).');
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
