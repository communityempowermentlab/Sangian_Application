// Run a game's post-feedback PDF capture+upload and wait for it to finish,
// so the caller can keep Home/Retest locked until the report is saved.
//
// Why: the capture used to be fired with setTimeout after submit while the
// buttons were already usable; assessors tapping Home within ~2s unmounted the
// results screen and the PDF was silently never created.
//
// - renderDelayMs: lets React commit the "submitted" view (answers as text)
//   before the screen is cloned.
// - timeoutMs: hard cap so the buttons can never stay locked if a capture or
//   upload hangs (slow network on field devices).
export const captureReportAfterRender = async (captureFn, { renderDelayMs = 600, timeoutMs = 25000 } = {}) => {
  await new Promise(r => setTimeout(r, renderDelayMs));
  await Promise.race([
    Promise.resolve().then(captureFn).catch(e => console.error('Report PDF capture failed:', e)),
    new Promise(r => setTimeout(r, timeoutMs)),
  ]);
};
