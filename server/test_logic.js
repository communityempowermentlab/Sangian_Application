
const rows = [{ id: 1 }, { id: 2 }];
const enriched = rows.map(r => ({ ...r, question_scores: { q1: 1 } }));

const allUniqueKeysRows = Array.from(new Set(rows.flatMap(r => Object.keys(r.question_scores || {}))));
const allUniqueKeysEnriched = Array.from(new Set(enriched.flatMap(r => Object.keys(r.question_scores || {}))));

console.log('Using rows:', allUniqueKeysRows);
console.log('Using enriched:', allUniqueKeysEnriched);
