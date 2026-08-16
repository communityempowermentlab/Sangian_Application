// Canonical, code-level (never Admin-editable) fixed image-count rule for
// Her Pher V3's 9 item categories — matches exactly how many images each
// corresponding question pulls in client/src/pages/HerPherGameV3.jsx's
// REQUIRED_COUNTS, and the same numbers shown in client/src/pages/
// AdminElements.jsx's HERPHER_V3_CATEGORIES. Used by elementsController.js
// to enforce the rule server-side (never rely on the client alone) for this
// test only — every other test_id skips this entirely.
const HERPHER_V3_TEST_ID = 'working_memory_herpher_v3';

const HERPHER_V3_IMAGE_COUNTS = {
  item0: 6,
  item1: 7,
  item2: 8,
  item3: 9,
  item4: 10,
  item5: 11,
  item6: 12,
  item7: 13,
  item8: 14,
};

module.exports = { HERPHER_V3_TEST_ID, HERPHER_V3_IMAGE_COUNTS };
