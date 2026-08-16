import React, { useState, useEffect, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';

// ============================================================
// ChorElements.jsx — admin editor for Chor Machaye Shor's 11 items,
// mounted from AdminElements.jsx when the selected test is
// cognitive_flex_chor (the Elements panel's test_id for this game —
// see testConfigService.js's GAMES_REGISTRY; distinct from GAME_NAME
// = 'chor_machaye_shor', which ChorMachayeShorGame.jsx uses only for
// game-session tracking).
//
// Reads/writes test_elements rows keyed by (test_id='cognitive_flex_chor',
// asset_type='item1'..'item11', language='all') via the same generic
// /admin/elements/config endpoint Rachna/Mela's per-question toggles use.
// 'all' (not a real language code) because an item's active status is a
// gameplay-structure concern, not translatable content — mirrors Bagiya/
// Mela's structural-flag convention, not Rachna's per-language one.
//
// No Preview: every item's house layout (roof/window/door config) is
// re-randomized per attempt by ChorMachayeShorGame.jsx's applyItemNDynamic
// functions — there's no static "canonical" layout that wouldn't
// misrepresent what the child actually sees, so this only exposes name +
// active/inactive, no reordering, no add/delete.
//
// At least one item must always stay active — enforced here (the sole
// remaining active item's toggle is locked) and server-side too, in
// updateElementConfig (elementsController.js).
// ============================================================

const TEST_ID = 'cognitive_flex_chor';
const LANGUAGE = 'all';

// Mirrors GAME_DATA.items[i].name in ChorMachayeShorGame.jsx (that file
// exports nothing today) — keep in sync if item names ever change there.
const ITEMS = [
  { key: 'item1',  label: 'Item 1: Red Roof' },
  { key: 'item2',  label: 'Item 2: One Window' },
  { key: 'item3',  label: 'Item 3: Two Windows' },
  { key: 'item4',  label: 'Item 4: No Windows' },
  { key: 'item5',  label: 'Item 5: Clockwise' },
  { key: 'item6',  label: 'Item 6: Blue Roof or 4 Windows' },
  { key: 'item7',  label: 'Item 7: 3 Windows or Split' },
  { key: 'item8',  label: 'Item 8: Slanted or Anticlockwise' },
  { key: 'item9',  label: 'Item 9: Red or Clockwise or Small' },
  { key: 'item10', label: 'Item 10: Yellow or Crosses or Right-Slant' },
  { key: 'item11', label: 'Item 11: Blue or Opposite or Orange' },
];

const ChorElements = () => {
  const [elementsByKey, setElementsByKey] = useState({});
  const [loading, setLoading] = useState(true);
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
        if (ITEMS.some(it => it.key === el.asset_type)) map[el.asset_type] = el;
      });
      setElementsByKey(map);
    } catch (error) {
      console.error('Failed to load Chor items:', error);
      showToast('Failed to load item settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadElements(); }, [loadElements]);

  const isActive = (key) => elementsByKey[key]?.config?.active !== false;
  const activeCount = ITEMS.filter(it => isActive(it.key)).length;

  const toggleActive = async (key) => {
    const active = isActive(key);
    if (active && activeCount <= 1) return; // last remaining active item — locked
    try {
      await axiosAdmin.put('/admin/elements/config', {
        test_id: TEST_ID, asset_type: key, language: LANGUAGE,
        config: { ...(elementsByKey[key]?.config || {}), active: !active },
      });
      showToast(active ? 'Item deactivated — will be skipped in the game' : 'Item re-activated');
      await loadElements();
    } catch (error) {
      console.error('Failed to toggle active state:', error);
      showToast(error?.response?.data?.message || 'Failed to update', 'error');
    }
  };

  if (loading) return <div className="admin-loading"><span className="spin">🔄</span> Loading item settings...</div>;

  return (
    <div className="elements-section">
      <h3>Item Management</h3>
      <p className="elements-desc">
        Activate or deactivate individual items — deactivated ones are skipped during
        gameplay. The item set itself is fixed (no add/delete/reorder). At least one
        item must always remain active. Score display stays fixed at /57 and question
        count at /11 regardless of what's active.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {ITEMS.map(({ key, label }) => {
          const active = isActive(key);
          const isSoleActive = active && activeCount <= 1;
          return (
            <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: active ? 1 : 0.6 }}>
              <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
              {isSoleActive ? (
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }} title="At least one item must remain active">🔒 Required</span>
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
            </div>
          );
        })}
      </div>
      {toast && <div className={`admin-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
};

export default ChorElements;
