import React, { useState, useEffect, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';

const TEST_ID = 'numeracy_number_skill_v3';

// Mirrors NumberSkillGameV3.jsx's own title-then-text fallback, so the
// placeholder shown here always matches what the player currently sees when
// no language override is configured. Recognition-category questions store
// the plain number in `title` (e.g. "51"); subtraction/division questions
// don't use `title` for display at all — their `text` ("51 - 35", "918 ÷ 7")
// already IS the on-screen content, so it's used as-is, not string-composed
// from separate operands (division's dividend/divisor aren't stored as
// separate columns — only embedded together in `text`).
const canonicalDisplay = (q) => {
  const title = (q.title || '').trim();
  return (title && !title.includes(',')) ? title : (q.text || '').replace(/Identify number\s*-?\s*/ig, '').trim();
};

export default function AnkganitV3ContentManager({ languages, showToast }) {
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [activeLang, setActiveLang] = useState('hi');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyFileId, setBusyFileId] = useState(null);

  // Two independent requests (question bank + saved translations) —
  // deliberately NOT Promise.all, which fails BOTH the moment either one
  // does, silently leaving categories empty and rendering nothing with no
  // visible error and no way to recover short of a full page reload. Each
  // is handled on its own here, and any failure is shown inline (with a
  // Retry) instead of only a toast that's easy to miss.
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [qResult, elResult] = await Promise.allSettled([
      axiosAdmin.get('/admin/ankganit-v3'),
      axiosAdmin.get(`/admin/elements?test_id=${TEST_ID}`),
    ]);

    if (qResult.status === 'fulfilled' && qResult.value.data.success) {
      setCategories(qResult.value.data.categories);
    } else {
      console.error('Failed to load Ankganit V3 question bank', qResult.reason);
    }

    // `content_q_<id>` — same content_* convention as Padh ke Batao V2's
    // element manager, so both are read by the shared useTestContent hook
    // (NumberSkillGameV3.jsx calls getContent('q_<id>'), which itself
    // prefixes "content_").
    if (elResult.status === 'fulfilled') {
      setFiles((elResult.value.data.elements || []).filter(e => /^content_q_\d+$/.test(e.asset_type || '')));
    } else {
      console.error('Failed to load Ankganit V3 saved translations', elResult.reason);
    }

    if (qResult.status === 'rejected' || elResult.status === 'rejected') {
      const message = qResult.status === 'rejected'
        ? (qResult.reason?.response?.data?.message || qResult.reason?.message || 'Failed to load the question bank')
        : (elResult.reason?.response?.data?.message || elResult.reason?.message || 'Failed to load saved translations');
      setLoadError(message);
      showToast('Failed to load Ankganit V3 language content', 'error');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const getFile = (qId, langCode) => files.find(f => f.asset_type === `content_q_${qId}` && f.language === langCode);
  const isConfigured = (f) => !!(f && f.is_active !== 0 && f.config?.display && f.config.display.trim());

  const openQuestion = (q) => {
    if (expandedId === q.id) { setExpandedId(null); return; }
    setExpandedId(q.id);
    const firstLang = languages[0]?.code || 'hi';
    setActiveLang(firstLang);
    setDraft(getFile(q.id, firstLang)?.config?.display || '');
  };

  const switchLang = (q, langCode) => {
    setActiveLang(langCode);
    setDraft(getFile(q.id, langCode)?.config?.display || '');
  };

  const save = async (q) => {
    setSaving(true);
    try {
      const res = await axiosAdmin.put('/admin/elements/config', {
        test_id: TEST_ID, asset_type: `content_q_${q.id}`, language: activeLang, config: { display: draft.trim() },
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

  const handleToggleStatus = async (q) => {
    const file = getFile(q.id, activeLang);
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

  const expandedQuestion = expandedId != null
    ? categories.flatMap(c => c.questions).find(q => q.id === expandedId)
    : null;
  const currentFile = expandedQuestion ? getFile(expandedQuestion.id, activeLang) : null;

  return (
    <div className="elements-section">
      <h3 style={{ margin: 0 }}>🌐 Language-Specific Content</h3>
      <p className="elements-desc">
        Configure exactly what's shown on screen for each question while a language is selected — the Hindi
        numeral or number-word for "51", the localized subtraction pair, the localized division expression, and
        so on. This only changes the displayed content; the correct answer used for scoring is never affected.
        Leave a language unconfigured (or disabled) and the default content shown below is used instead.
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
        <div style={{ display: 'grid', gap: '18px' }}>
              {categories.map(cat => (
                <div key={cat.id} className="admin-card">
                  <div className="admin-card-header"><h4 style={{ margin: 0 }}>{cat.name}</h4></div>
                  <div className="admin-card-body p-0" style={{ overflowX: 'auto' }}>
                    <table className="admin-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Default Content</th>
                          <th>Translations</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...cat.questions].sort((a, b) => a.display_order - b.display_order).map(q => {
                          const isOpen = expandedId === q.id;
                          const configuredCount = languages.filter(l => isConfigured(getFile(q.id, l.code))).length;
                          return (
                            <React.Fragment key={q.id}>
                              <tr style={isOpen ? { background: '#eff6ff' } : undefined}>
                                <td>{q.display_order}</td>
                                <td>{canonicalDisplay(q)}</td>
                                <td>{configuredCount} / {languages.length} configured</td>
                                <td>
                                  <button className="admin-btn admin-btn-secondary" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => openQuestion(q)}>
                                    {isOpen ? 'Close' : 'Manage'}
                                  </button>
                                </td>
                              </tr>
                              {isOpen && (
                                <tr>
                                  <td colSpan={4} style={{ background: '#f8fafc', padding: '16px' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                                      {languages.map(lang => {
                                        const ok = isConfigured(getFile(q.id, lang.code));
                                        return (
                                          <button
                                            key={lang.code}
                                            onClick={() => switchLang(q, lang.code)}
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

                                    <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                                      Content shown for this question when "{languages.find(l => l.code === activeLang)?.name || activeLang}" is selected
                                      (default: <strong>{canonicalDisplay(q)}</strong>)
                                    </label>
                                    <input
                                      type="text"
                                      value={draft}
                                      onChange={(e) => setDraft(e.target.value)}
                                      placeholder={canonicalDisplay(q)}
                                      style={{ width: '100%', fontSize: '15px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                                    />
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                      {currentFile
                                        ? `Last updated: ${new Date(currentFile.updated_at).toLocaleString('en-IN')}${currentFile.is_active === 0 ? ' — DISABLED' : ''}`
                                        : 'Not configured yet — the default content above is shown to the child instead'}
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                                      <button className="admin-btn admin-btn-primary" onClick={() => save(q)} disabled={saving}>
                                        {saving ? 'Saving...' : 'Save'}
                                      </button>
                                      {currentFile && (
                                        <button className="admin-btn admin-btn-secondary" onClick={() => handleToggleStatus(q)} disabled={busyFileId === currentFile.id}>
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
              ))}
        </div>
      )}
    </div>
  );
}
