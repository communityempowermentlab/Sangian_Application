// ─── Offline dashboard-PDF regeneration (build-flag gated) ───────────────────
//
// Used ONLY by scripts/pdf-regen to rebuild dashboard PDFs for past sessions
// whose post-feedback PDF was never uploaded (the assessor left the results
// screen before the delayed capture ran).
//
// Active only in a build made with REACT_APP_PDF_REGEN=true. In every
// normal/production build the variable is undefined, so REGEN_ENABLED is
// false at runtime: the /__regen routes are never registered,
// getRegenPayload() always returns null, and none of the regen branches in
// the game pages can run. (Second gate: even in a regen build, nothing happens
// unless the regen script injects window.__SANGIAN_REGEN__.)
//
// Flow in a regen build: the headless-browser script injects
// window.__SANGIAN_REGEN__ = { child, session, assessment } before the page
// loads; the game page restores its results screen from that data (instead of
// talking to the server), then the script calls
// window.__SANGIAN_REGEN_CAPTURE__(), and the page hands the finished PDF back
// via window.__SANGIAN_REGEN_RESULT__ instead of uploading it.

export const REGEN_ENABLED = process.env.REACT_APP_PDF_REGEN === 'true';

export const getRegenPayload = () =>
  (REGEN_ENABLED && typeof window !== 'undefined' && window.__SANGIAN_REGEN__) || null;

// Map a game_assessments row to the shared SessionAssessmentForm state shape.
export const regenAssessmentState = (row) => {
  if (!row) return { q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' };
  let behaviors = row.q5_behaviors;
  if (typeof behaviors === 'string') {
    try { behaviors = JSON.parse(behaviors); } catch { behaviors = []; }
  }
  return {
    q1: row.q1_enjoyment || '',
    q2: row.q2_feeling || '',
    q3: row.q3_tiredness || '',
    q4: row.q4_play_again || '',
    behaviors: Array.isArray(behaviors) ? behaviors : [],
    notes: row.additional_notes || '',
  };
};

// Hand the generated PDF back to the regen script instead of uploading it.
export const deliverRegenPdf = async (blob, fileName) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  window.__SANGIAN_REGEN_RESULT__ = { fileName, base64: btoa(binary) };
};
