import React, { useState, useEffect, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';

// The numpad's actual tile set (NumberRecallGame.jsx / NumberRecallGameV2.jsx's
// identical NUMPAD_KEYS) — note 7 is intentionally absent from the game
// itself, so it's not offered here.
const TILE_VALUES = [1, 2, 3, 4, 5, 6, 8, 9, 10];

// Shared by both Lottery Ka Ticket versions — V1 (number_recall_lottery) and
// V2 (number_recall_lottery_v2) use the exact same numpad tile set and
// content_q_<value> convention, so `testId` is the only thing that differs
// between them; see AdminElements.jsx's two call sites.
export default function NumberRecallContentManager({ testId, languages, showToast }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [expandedValue, setExpandedValue] = useState(null);
  const [activeLang, setActiveLang] = useState('hi');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyFileId, setBusyFileId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await axiosAdmin.get(`/admin/elements?test_id=${testId}`);
      setFiles((res.data.elements || []).filter(e => /^content_q_\d+$/.test(e.asset_type || '')));
    } catch (error) {
      console.error('Failed to load Number Recall language content', error);
      setLoadError(error.response?.data?.message || error.message || 'Failed to load saved translations');
      showToast('Failed to load Number Recall language content', 'error');
    } finally {
      setLoading(false);
    }
  }, [testId, showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const getFile = (value, langCode) => files.find(f => f.asset_type === `content_q_${value}` && f.language === langCode);
  const isConfigured = (f) => !!(f && f.is_active !== 0 && f.config?.display && f.config.display.trim());

  const openTile = (value) => {
    if (expandedValue === value) { setExpandedValue(null); return; }
    setExpandedValue(value);
    const firstLang = languages[0]?.code || 'hi';
    setActiveLang(firstLang);
    setDraft(getFile(value, firstLang)?.config?.display || '');
  };

  const switchLang = (value, langCode) => {
    setActiveLang(langCode);
    setDraft(getFile(value, langCode)?.config?.display || '');
  };

  const save = async (value) => {
    setSaving(true);
    try {
      const res = await axiosAdmin.put('/admin/elements/config', {
        test_id: testId, asset_type: `content_q_${value}`, language: activeLang, config: { display: draft.trim() },
      });
      if (res.data.success) {
        showToast('Content saved');
        await loadAll();
      }
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save content', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (value) => {
    const file = getFile(value, activeLang);
    if (!file) return;
    setBusyFileId(file.id);
    try {
      const res = await axiosAdmin.put(`/admin/elements/${file.id}/status`);
      if (res.data.success) {
        showToast(res.data.is_active ? 'Content enabled' : 'Content disabled');
        await loadAll();
      }
    } catch (error) {
      console.error('Toggle failed:', error);
      showToast('Failed to update status', 'error');
    } finally {
      setBusyFileId(null);
    }
  };

  const currentFile = expandedValue != null ? getFile(expandedValue, activeLang) : null;

  return (
    <div className="elements-section">
      <h3 style={{ margin: 0 }}>🌐 Language-Specific Content</h3>
      <p className="elements-desc">
        Configure what's shown on each numpad tile, and on the child's own tapped-sequence readout,
        while a language is selected — e.g. the Hindi or Urdu numeral for "8". This only changes the
        displayed digit; the value used for scoring (and the results screen) is never affected. Leave
        a language unconfigured (or disabled) and the plain digit shown below is used instead.
      </p>
      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', marginBottom: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px' }}>
          <span style={{ flex: 1 }}>⚠ {loadError}</span>
          <button className="admin-btn admin-btn-secondary" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={loadAll} disabled={loading}>
            Retry
          </button>
        </div>
      )}
      {loading ? <p>Loading...</p> : (
        <div className="admin-card">
          <div className="admin-card-body p-0" style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Tile</th>
                  <th>Default Content</th>
                  <th>Translations</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {TILE_VALUES.map(value => {
                  const isOpen = expandedValue === value;
                  const configuredCount = languages.filter(l => isConfigured(getFile(value, l.code))).length;
                  return (
                    <React.Fragment key={value}>
                      <tr style={isOpen ? { background: '#eff6ff' } : undefined}>
                        <td>{value}</td>
                        <td>{value}</td>
                        <td>{configuredCount} / {languages.length} configured</td>
                        <td>
                          <button className="admin-btn admin-btn-secondary" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => openTile(value)}>
                            {isOpen ? 'Close' : 'Manage'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={4} style={{ background: '#f8fafc', padding: '16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                              {languages.map(lang => {
                                const ok = isConfigured(getFile(value, lang.code));
                                return (
                                  <button
                                    key={lang.code}
                                    onClick={() => switchLang(value, lang.code)}
                                    style={{
                                      padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                                      border: activeLang === lang.code ? '2px solid #4f46e5' : '1px solid #d1d5db',
                                      background: activeLang === lang.code ? '#eef2ff' : '#fff',
                                      color: ok ? '#111827' : '#9ca3af', fontWeight: activeLang === lang.code ? 700 : 500,
                                    }}
                                  >
                                    {lang.name} {ok ? '✓' : '⚠'}
                                  </button>
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div style={{ flex: '1 1 260px', minWidth: '200px' }}>
                                <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                                  Digit shown on this tile when "{languages.find(l => l.code === activeLang)?.name || activeLang}" is selected
                                  (default: <strong>{value}</strong>)
                                </label>
                                <input
                                  type="text"
                                  value={draft}
                                  onChange={(e) => setDraft(e.target.value)}
                                  placeholder={String(value)}
                                  style={{ width: '100%', fontSize: '15px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Preview (as shown on the Numpad)</label>
                                {/* Mirrors NumberRecallGame.css's .nr-key tile styling, so this is an
                                    accurate preview of the actual numpad button, not just a text sample. */}
                                <div style={{
                                  width: '76px', height: '64px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#fff', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900,
                                  background: 'linear-gradient(135deg, #4f9cf9, #2563eb)', border: '2px solid rgba(255,255,255,0.5)',
                                  boxShadow: '0 6px 16px rgba(37,99,235,0.22), 0 2px 4px rgba(0,0,0,0.06)',
                                }}>
                                  {draft.trim() || value}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                              {currentFile
                                ? `Last updated: ${new Date(currentFile.updated_at).toLocaleString('en-IN')}${currentFile.is_active === 0 ? ' — DISABLED' : ''}`
                                : 'Not configured yet — the plain digit above is shown to the child instead'}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                              <button className="admin-btn admin-btn-primary" onClick={() => save(value)} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              {currentFile && (
                                <button className="admin-btn admin-btn-secondary" onClick={() => handleToggleStatus(value)} disabled={busyFileId === currentFile.id}>
                                  {currentFile.is_active === 0 ? 'Enable' : 'Disable'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
