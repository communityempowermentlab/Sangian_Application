import React, { useState, useEffect, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';

// ============================================================
// MelaElements.jsx — admin editor for Chalo Mela Chalen's 22
// questions (4 teaching + 18 scored), mounted from AdminElements.jsx
// when the selected test is rover_mela.
//
// Reads/writes test_elements rows keyed by (test_id='rover_mela',
// asset_type=<questionId>, language='all') via the same generic
// /admin/elements/config endpoint Rachna's per-question toggles use.
// 'all' (not a real language code) because a question's active status
// is a gameplay-structure concern, not translatable content — mirrors
// Bagiya's screen-active convention, not Rachna's per-language one.
//
// q1/q2/q3 feed rover_mela's hardcoded clinical drop-out rule (their
// scores are read directly in ChaloMelaChaleGame.jsx) — deactivating
// any of them would silently be scored as 0 there, so they're locked
// here (no toggle rendered) and rejected server-side too.
//
// The Preview grid below is a read-only, non-interactive mirror of
// the fixed matrices in ChaloMelaChaleGame.jsx, duplicated here rather
// than imported (that file exports nothing today, and there's no
// add/delete/edit-matrix capability anywhere in this feature, so
// there's no way for these to drift from the live game).
// ============================================================

const TEST_ID = 'rover_mela';
const LANGUAGE = 'all';
const PROTECTED_KEYS = new Set(['q1', 'q2', 'q3']);

const IMG_MAPPING = {
  '7-SP': '/assets/images/chalo_mela_chale/7-SP.png',
  '7-T1': '/assets/images/chalo_mela_chale/7-T1.png',
  '7-T2': '/assets/images/chalo_mela_chale/7-T2.png',
  '7-T3': '/assets/images/chalo_mela_chale/7-T3.png',
  '7-EP': '/assets/images/chalo_mela_chale/7-EP.png',
};

const MATRIX_MAP = {
  tq1: [
    ['7-T1', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-EP', '7-T1'],
    ['7-T1', '7-T2', '7-T2', '7-T1'],
    ['7-SP', '7-T1', '7-T1', '7-T1'],
  ],
  tq2: [
    ['7-SP', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-T2', '7-T1'],
    ['7-T1', '7-T2', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-EP'],
  ],
  tq3: [
    ['7-T1', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-T2', '7-EP'],
    ['7-T3', '7-T3', '7-T1', '7-T1'],
    ['7-SP', '7-T1', '7-T1', '7-T1'],
  ],
  tq4: [
    ['7-T1', '7-T1', '7-T1', '7-T1'],
    ['7-EP', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-T2', '7-T3'],
    ['7-T1', '7-T1', '7-T2', '7-SP'],
  ],
  q1: [
    ['7-T1', '7-T1', '7-T1', '7-EP'],
    ['7-T1', '7-T1', '7-T2', '7-T1'],
    ['7-T1', '7-T2', '7-T1', '7-T2'],
    ['7-T1', '7-T1', '7-T2', '7-SP'],
  ],
  q2: [
    ['7-T1', '7-T1', '7-T1', '7-T1'],
    ['7-SP', '7-T2', '7-T1', '7-T1'],
    ['7-T2', '7-T3', '7-T1', '7-T1'],
    ['7-EP', '7-T2', '7-T1', '7-T1'],
  ],
  q3: [
    ['7-SP', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T3', '7-T2', '7-T1'],
    ['7-T2', '7-T3', '7-T3', '7-T1'],
    ['7-T1', '7-EP', '7-T1', '7-T1'],
  ],
  q4: [
    ['7-T1', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-SP', '7-T2', '7-EP'],
    ['7-T1', '7-T1', '7-T3', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-T1'],
  ],
  q5: [
    ['7-T2', '7-T1', '7-EP', '7-T1'],
    ['7-T1', '7-T3', '7-T3', '7-T2'],
    ['7-T1', '7-T3', '7-T3', '7-T1'],
    ['7-T1', '7-SP', '7-T1', '7-T1'],
  ],
  q6: [
    ['7-T1', '7-T1', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-T2', '7-T1', '7-EP'],
    ['7-T2', '7-T3', '7-T2', '7-T1', '7-T1'],
    ['7-SP', '7-T2', '7-T1', '7-T1', '7-T1'],
    ['7-T2', '7-T3', '7-T1', '7-T1', '7-T1'],
  ],
  q7: [
    ['7-T1', '7-T1', '7-T1', '7-T2', '7-T2'],
    ['7-T1', '7-T1', '7-T1', '7-T3', '7-EP'],
    ['7-T1', '7-T3', '7-T1', '7-T2', '7-T1'],
    ['7-SP', '7-T1', '7-T1', '7-T2', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-T1', '7-T1'],
  ],
  q8: [
    ['7-SP', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T2', '7-T1', '7-T2'],
    ['7-T1', '7-T2', '7-T2', '7-T1'],
    ['7-T1', '7-T3', '7-EP', '7-T1'],
  ],
  q9: [
    ['7-T1', '7-T1', '7-T2', '7-T3', '7-SP'],
    ['7-T1', '7-T2', '7-T1', '7-T2', '7-T3'],
    ['7-T1', '7-T1', '7-T1', '7-T3', '7-T2'],
    ['7-T1', '7-T1', '7-T2', '7-T2', '7-T1'],
    ['7-T1', '7-T3', '7-EP', '7-T1', '7-T1'],
  ],
  q10: [
    ['7-T1', '7-T2', '7-T1', '7-SP'],
    ['7-EP', '7-T2', '7-T3', '7-T1'],
    ['7-T1', '7-T3', '7-T3', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-T1'],
  ],
  q11: [
    ['7-T1', '7-SP', '7-T3', '7-T2', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-T1', '7-T3', '7-T1'],
    ['7-T3', '7-T2', '7-T2', '7-T2', '7-T1', '7-T1'],
    ['7-T1', '7-T3', '7-T2', '7-T3', '7-T2', '7-T1'],
    ['7-T1', '7-T2', '7-T1', '7-EP', '7-T3', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-T1', '7-T1', '7-T1'],
  ],
  q12: [
    ['7-T1', '7-T1', '7-T1', '7-T1', '7-SP', '7-T1'],
    ['7-T1', '7-T1', '7-T2', '7-T3', '7-T2', '7-T2'],
    ['7-T1', '7-T2', '7-T3', '7-T2', '7-T1', '7-T3'],
    ['7-T3', '7-T1', '7-T2', '7-T3', '7-T2', '7-T3'],
    ['7-T1', '7-T1', '7-T3', '7-T3', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-EP', '7-T1', '7-T1'],
  ],
  q13: [
    ['7-T1', '7-T1', '7-T2', '7-SP'],
    ['7-T3', '7-T2', '7-T1', '7-T1'],
    ['7-EP', '7-T2', '7-T2', '7-T1'],
    ['7-T1', '7-T1', '7-T3', '7-T1'],
  ],
  q14: [
    ['7-T1', '7-T3', '7-T2', '7-T1', '7-T1'],
    ['7-T1', '7-T1', '7-T2', '7-T1', '7-T1'],
    ['7-EP', '7-T2', '7-T3', '7-T2', '7-SP'],
    ['7-T1', '7-T3', '7-T1', '7-T3', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-T1', '7-T1'],
  ],
  q15: [
    ['7-SP', '7-T1', '7-T1', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T2', '7-T3', '7-T1', '7-T3', '7-T3'],
    ['7-T1', '7-T3', '7-T1', '7-T3', '7-T2', '7-T1'],
    ['7-T1', '7-T3', '7-T3', '7-T2', '7-T1', '7-T1'],
    ['7-T3', '7-T2', '7-T1', '7-T3', '7-EP', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-T3', '7-T1', '7-T1'],
  ],
  q16: [
    ['7-T1', '7-T1', '7-T1', '7-T1', '7-T1', '7-T1'],
    ['7-T1', '7-T2', '7-T1', '7-T2', '7-T1', '7-T1'],
    ['7-T1', '7-T2', '7-T1', '7-T2', '7-EP', '7-T1'],
    ['7-T1', '7-T3', '7-T3', '7-T2', '7-T3', '7-T1'],
    ['7-T1', '7-T3', '7-T3', '7-T2', '7-T3', '7-T1'],
    ['7-SP', '7-T3', '7-T1', '7-T3', '7-T1', '7-T1'],
  ],
  q17: [
    ['7-T2', '7-T2', '7-T3', '7-T1', '7-T1', '7-T2'],
    ['7-T2', '7-T3', '7-EP', '7-T3', '7-T2', '7-T3'],
    ['7-T3', '7-T2', '7-T2', '7-T2', '7-T2', '7-T1'],
    ['7-T3', '7-T2', '7-SP', '7-T3', '7-T1', '7-T1'],
    ['7-T2', '7-T3', '7-T2', '7-T1', '7-T1', '7-T1'],
    ['7-T2', '7-T2', '7-T1', '7-T2', '7-T1', '7-T1'],
  ],
  q18: [
    ['7-T1', '7-T3', '7-T3', '7-T3', '7-T1', '7-T1'],
    ['7-T1', '7-T2', '7-T1', '7-T2', '7-T2', '7-T1'],
    ['7-EP', '7-T2', '7-T1', '7-T2', '7-SP', '7-T3'],
    ['7-T1', '7-T1', '7-T2', '7-T2', '7-T1', '7-T3'],
    ['7-T1', '7-T1', '7-T3', '7-T2', '7-T3', '7-T1'],
    ['7-T1', '7-T1', '7-T1', '7-T3', '7-T1', '7-T1'],
  ],
};

const LABELS = {
  tq1: 'Teaching Question 1', tq2: 'Teaching Question 2',
  tq3: 'Teaching Question 3', tq4: 'Teaching Question 4',
};
const questionLabel = (key) => LABELS[key] || `Question ${key.slice(1)}`;

const GROUPS = [
  { label: 'Teaching Questions', keys: ['tq1', 'tq2', 'tq3', 'tq4'] },
  { label: 'Scored Questions — Locked (feed the clinical drop-out rule)', keys: ['q1', 'q2', 'q3'] },
  { label: 'Scored Questions', keys: Array.from({ length: 15 }, (_, i) => `q${i + 4}`) },
];

const MelaElements = () => {
  const [elementsByKey, setElementsByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState(null);
  const [draftSubtitle, setDraftSubtitle] = useState('');
  const [draftChips, setDraftChips] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadElements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosAdmin.get('/admin/elements', { params: { test_id: TEST_ID } });
      const map = {};
      (res.data.elements || []).forEach(el => {
        if (MATRIX_MAP[el.asset_type]) map[el.asset_type] = el;
      });
      setElementsByKey(map);
    } catch (error) {
      console.error('Failed to load Mela questions:', error);
      showToast('Failed to load question settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadElements(); }, [loadElements]);

  const isActive = (key) => elementsByKey[key]?.config?.active !== false;

  const toggleActive = async (key) => {
    if (PROTECTED_KEYS.has(key)) return;
    const existingConfig = elementsByKey[key]?.config || {};
    const wasInactive = existingConfig.active === false;
    try {
      await axiosAdmin.put('/admin/elements/config', {
        test_id: TEST_ID, asset_type: key, language: LANGUAGE,
        config: { ...existingConfig, active: wasInactive },
      });
      showToast(wasInactive ? 'Question re-activated' : 'Question deactivated — will be skipped in the game');
      await loadElements();
    } catch (error) {
      console.error('Failed to toggle active state:', error);
      showToast(error?.response?.data?.message || 'Failed to update', 'error');
    }
  };

  const toggleExpand = (key) => {
    if (expandedKey === key) { setExpandedKey(null); return; }
    setExpandedKey(key);
    const config = elementsByKey[key]?.config || {};
    setDraftSubtitle(config.subtitle || '');
    setDraftChips((config.chips || []).join(', '));
  };

  const saveContent = async (key) => {
    setSaving(true);
    try {
      const existingConfig = elementsByKey[key]?.config || {};
      const chips = draftChips.split(',').map(c => c.trim()).filter(Boolean);
      await axiosAdmin.put('/admin/elements/config', {
        test_id: TEST_ID, asset_type: key, language: LANGUAGE,
        config: { ...existingConfig, subtitle: draftSubtitle, chips },
      });
      showToast('Question content saved');
      await loadElements();
    } catch (error) {
      console.error('Failed to save question content:', error);
      showToast(error?.response?.data?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-loading"><span className="spin">🔄</span> Loading question settings...</div>;

  return (
    <div className="elements-section">
      <h3>Question Management</h3>
      <p className="elements-desc">
        Activate or deactivate individual questions — deactivated ones are skipped
        during gameplay. The question set itself is fixed (no add/delete). Q1-Q3 are
        locked always-active because the clinical drop-out rule reads their scores.
        Score display stays fixed at /44 and progress at /18 regardless of what's active.
      </p>

      {GROUPS.map(group => (
        <div key={group.label} style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>{group.label}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {group.keys.map(key => {
              const active = isActive(key);
              const isProtected = PROTECTED_KEYS.has(key);
              const isExpanded = expandedKey === key;
              const config = elementsByKey[key]?.config;
              const isCustomized = !!config?.subtitle || (config?.chips && config.chips.length > 0);
              return (
                <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem', opacity: (active || isProtected) ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{ flex: 1, cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => toggleExpand(key)}
                    >
                      {questionLabel(key)} {isCustomized && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#6b7280' }}>(customized)</span>}
                    </span>
                    {/* Current state, always visible — independent of the action button's
                        text below, which describes what clicking it will DO (the opposite
                        of the current state), not what the state currently IS. Showing both
                        side by side removes the "does 'Activate' mean it's active?" ambiguity
                        that caused real accidental deactivations during testing. */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: (active || isProtected) ? '#15803d' : '#6b7280' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: (active || isProtected) ? '#22c55e' : '#9ca3af', display: 'inline-block' }} />
                      {(active || isProtected) ? 'Active — shows in game' : 'Inactive — skipped in game'}
                    </span>
                    {isProtected ? (
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }} title="Feeds the clinical drop-out rule — can't be deactivated">🔒 Required</span>
                    ) : (
                      <button
                        className="admin-btn"
                        style={{
                          padding: '0.25rem 0.75rem', fontSize: '0.8rem', width: 'auto', boxShadow: 'none',
                          background: active ? '#fee2e2' : '#ecfdf5',
                          border: `1px solid ${active ? '#fecaca' : '#a7f3d0'}`,
                          color: active ? '#991b1b' : '#065f46',
                        }}
                        onClick={() => toggleActive(key)}
                      >
                        {active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    <button
                      className="admin-btn"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={() => toggleExpand(key)}
                    >
                      {isExpanded ? 'Hide' : 'Preview / Edit'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Preview (read-only)</div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${MATRIX_MAP[key][0].length}, 32px)`,
                            gap: '2px',
                            background: '#f3f4f6',
                            padding: '4px',
                            borderRadius: '6px',
                            width: 'fit-content',
                          }}
                        >
                          {MATRIX_MAP[key].flat().map((type, idx) => (
                            <img key={idx} src={IMG_MAPPING[type]} alt={type} style={{ width: 32, height: 32, objectFit: 'contain' }} />
                          ))}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          Subtitle
                          <input
                            type="text"
                            value={draftSubtitle}
                            onChange={e => setDraftSubtitle(e.target.value)}
                            style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.35rem 0.5rem' }}
                          />
                        </label>
                        <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          Chips (comma-separated)
                          <input
                            type="text"
                            value={draftChips}
                            onChange={e => setDraftChips(e.target.value)}
                            style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.35rem 0.5rem' }}
                          />
                        </label>
                        <button
                          className="admin-btn admin-btn-primary"
                          style={{ alignSelf: 'flex-start', padding: '0.3rem 0.9rem' }}
                          disabled={saving}
                          onClick={() => saveContent(key)}
                        >
                          {saving ? 'Saving…' : 'Save Content'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {toast && <div className={`admin-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
};

export default MelaElements;
