import React, { useState, useEffect } from 'react';
import axiosAdmin from '../services/axiosAdmin';

// ============================================================
// BagiyaElements.jsx — admin control for Atlantis Bagiya's test
// length, mounted from AdminElements.jsx when the selected test
// is atlantis_bagiya.
//
// Bagiya's 13 main screens form a cumulative recall chain (a later
// screen quizzes items whose names were only ever introduced by a
// specific earlier screen) and carry score-based early-exit
// checkpoints keyed to specific screen numbers — so unlike Rachna's
// independently-toggleable questions, screens here can only be
// turned off from the END, shortening the test, never individually.
// Screens 12 and 13 are one indivisible unit (13 is "12, continued"
// — same intro, no separate question phase — see
// AtlantisBagiyaGame.jsx), so there are 12 controllable units, not 13.
//
// Reads/writes test_elements rows keyed by (test_id='atlantis_bagiya',
// asset_type='screen_N', language='all') via the same generic
// /admin/elements/config endpoint Rachna's per-question toggles use;
// the server enforces the contiguous-prefix, shorten-from-the-end
// rule independently of this UI (see elementsController.js).
// ============================================================

const TEST_ID = 'atlantis_bagiya';
const LANGUAGE = 'all';
const UNIT_COUNT = 12;

const unitLabel = (n) => n === 12 ? 'Screens 12-13 (Bonus Round)' : `Screen ${n}`;

const BagiyaElements = () => {
  const [screenConfig, setScreenConfig] = useState({}); // { [n]: config }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await axiosAdmin.get('/admin/elements', { params: { test_id: TEST_ID } });
      const map = {};
      (res.data.elements || []).forEach(el => {
        if (el.asset_type?.startsWith('screen_')) {
          const n = parseInt(el.asset_type.slice('screen_'.length), 10);
          map[n] = el.config;
        }
      });
      setScreenConfig(map);
    } catch (error) {
      console.error('Failed to load Bagiya screen config:', error);
      showToast('Failed to load test length settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); }, []);

  const isActive = (n) => screenConfig[n]?.active !== false;

  // Active units are always a contiguous prefix {1..K} — enforced server-side —
  // so the current test length is just the highest active unit.
  const currentLength = (() => {
    let n = 1;
    for (let i = 1; i <= UNIT_COUNT; i++) {
      if (isActive(i)) n = i; else break;
    }
    return n;
  })();

  // null = "no pending change yet", so the <select> just tracks currentLength
  // until the admin actually picks a different value.
  const [draftLength, setDraftLength] = useState(null);
  const selectedLength = draftLength ?? currentLength;

  const setUnitActive = (n, active) => axiosAdmin.put('/admin/elements/config', {
    test_id: TEST_ID, asset_type: `screen_${n}`, language: LANGUAGE,
    config: { ...(screenConfig[n] || {}), active },
  });

  const applyLength = async () => {
    if (selectedLength === currentLength) return;
    setSaving(true);
    try {
      if (selectedLength < currentLength) {
        // Shorten from the end: deactivate the tail units, highest first.
        for (let n = currentLength; n > selectedLength; n--) {
          await setUnitActive(n, false);
        }
      } else {
        // Re-extend from the end: activate in order, lowest missing first.
        for (let n = currentLength + 1; n <= selectedLength; n++) {
          await setUnitActive(n, true);
        }
      }
      showToast('Test length updated');
      setDraftLength(null);
      await loadConfig();
    } catch (error) {
      console.error('Failed to update test length:', error);
      showToast(error?.response?.data?.message || 'Failed to update test length', 'error');
      setDraftLength(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-loading"><span className="spin">🔄</span> Loading test length settings...</div>;

  return (
    <div className="elements-section">
      <h3>Test Length</h3>
      <p className="elements-desc">
        Control how many of Bagiya's 13 screens children play through. Because later
        screens quiz items only introduced by specific earlier ones, the test can only
        be shortened or extended from the end — Screen 1 always stays on, and the
        currently active screens are always an unbroken run from Screen 1 onward.
        Max score display stays fixed at /108 regardless of test length.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {Array.from({ length: UNIT_COUNT }, (_, i) => i + 1).map(n => {
          const active = n <= currentLength;
          const locked = n === 1;
          return (
            <div
              key={n}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.5rem 0.75rem', borderRadius: '6px',
                background: active ? '#ecfdf5' : '#f9fafb',
                border: `1px solid ${active ? '#10b981' : '#e5e7eb'}`,
                opacity: active ? 1 : 0.6,
              }}
            >
              <span style={{ fontWeight: 700, color: active ? '#10b981' : '#9ca3af', width: '1.5rem', textAlign: 'center' }}>
                {active ? '✓' : '—'}
              </span>
              <span style={{ flex: 1 }}>{unitLabel(n)}</span>
              {locked && <span style={{ fontSize: '0.75rem', color: '#6b7280' }} title="Screen 1 can never be turned off">🔒 Always on</span>}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <label htmlFor="bagiya-test-length" style={{ fontWeight: 600 }}>Set test length:</label>
        <select
          id="bagiya-test-length"
          value={selectedLength}
          onChange={(e) => setDraftLength(Number(e.target.value))}
          disabled={saving}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
        >
          {Array.from({ length: UNIT_COUNT }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>{n} {n === 1 ? 'unit' : 'units'} — {unitLabel(n)}</option>
          ))}
        </select>
        <button
          className="admin-btn admin-btn-primary"
          onClick={applyLength}
          disabled={saving || selectedLength === currentLength}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
          Currently: {currentLength} {currentLength === 1 ? 'unit' : 'units'} active ({unitLabel(currentLength)})
        </span>
      </div>

      {toast && <div className={`admin-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
};

export default BagiyaElements;
