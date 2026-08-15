import React, { useState, useEffect, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';

const TEST_ID = 'literacy_reading_skill_v2';

// The 8 fixed content elements Padh ke Batao V2 actually uses (see
// ReadingSkillGameV2.jsx's LETTERS_BANK/WORDS_BANK/PARAGRAPHS/STORY_TEXT/
// *_ASSESSMENT_QUESTIONS/*_ASSESSMENT_HINTS) — not admin-addable/removable,
// since they're structurally fixed by the game itself (unlike Lottery
// Ticket's per-item audio slots, which do vary in count).
const ELEMENTS = [
  { key: 'letters_bank', label: 'Letters Bank', shape: 'array', field: 'letters', count: 10, multiline: false },
  { key: 'words_bank', label: 'Words Bank', shape: 'array', field: 'words', count: 10, multiline: false },
  { key: 'paragraphs', label: 'Paragraphs (Std I)', shape: 'array', field: 'paragraphs', count: 2, multiline: true },
  { key: 'story', label: 'Story (Std II)', shape: 'text', field: 'text' },
  { key: 'paragraph_questions', label: 'Paragraph Assessment Questions', shape: 'array', field: 'questions', count: 3, multiline: true },
  { key: 'story_questions', label: 'Story Assessment Questions', shape: 'array', field: 'questions', count: 3, multiline: true },
  { key: 'paragraph_hints', label: 'Paragraph Assessment Hints', shape: 'hints', field: 'hints' },
  { key: 'story_hints', label: 'Story Assessment Hints', shape: 'hints', field: 'hints' },
];

const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// Blank starting config for an element that has no row yet for this
// language, sized to match the element's fixed shape so the edit form
// always has the right number of fields from the start.
const blankConfig = (el) => {
  if (el.shape === 'array') return { [el.field]: Array.from({ length: el.count }, () => '') };
  if (el.shape === 'text') return { [el.field]: '' };
  // hints: 3 question-groups x 2 choices, matching PARAGRAPH_ASSESSMENT_HINTS' shape
  return { hints: [0, 1, 2].map(() => [{ description: '', example: '', answer: 'No' }, { description: '', example: '', answer: 'Yes' }]) };
};

export default function ReadingV2ContentManager({ languages, showToast }) {
  const [collapsed, setCollapsed] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState(null);
  const [activeLang, setActiveLang] = useState('hi');
  const [draft, setDraft] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyFileId, setBusyFileId] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosAdmin.get(`/admin/elements?test_id=${TEST_ID}`);
      setFiles((res.data.elements || []).filter(e => e.asset_type?.startsWith('content_')));
    } catch (error) {
      console.error('Failed to load test content:', error);
      showToast('Failed to load test content', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const getFile = (elKey, langCode) =>
    files.find(f => f.asset_type === `content_${elKey}` && f.language === langCode);

  const openElement = (el) => {
    if (expandedKey === el.key) { setExpandedKey(null); return; }
    setExpandedKey(el.key);
    setShowPreview(false);
    const firstLang = languages[0]?.code || 'hi';
    setActiveLang(firstLang);
    const file = getFile(el.key, firstLang);
    setDraft(file?.config || blankConfig(el));
  };

  const switchLang = (el, langCode) => {
    setActiveLang(langCode);
    setShowPreview(false);
    const file = getFile(el.key, langCode);
    setDraft(file?.config || blankConfig(el));
  };

  const activeElement = ELEMENTS.find(e => e.key === expandedKey);

  const save = async () => {
    if (!activeElement) return;
    setSaving(true);
    try {
      const res = await axiosAdmin.put('/admin/elements/config', {
        test_id: TEST_ID, asset_type: `content_${activeElement.key}`, language: activeLang, config: draft,
      });
      if (res.data.success) {
        showToast('Content saved');
        loadAll();
      }
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save content', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    const file = getFile(activeElement.key, activeLang);
    if (!file) return;
    setBusyFileId(file.id);
    try {
      const res = await axiosAdmin.put(`/admin/elements/${file.id}/status`);
      if (res.data.success) {
        showToast(res.data.is_active ? 'Content enabled' : 'Content disabled');
        loadAll();
      }
    } catch (error) {
      console.error('Toggle failed:', error);
      showToast('Failed to update status', 'error');
    } finally {
      setBusyFileId(null);
    }
  };

  const handleDelete = async () => {
    const file = getFile(activeElement.key, activeLang);
    if (!file) return;
    if (!window.confirm('Delete this translation? This cannot be undone.')) return;
    setBusyFileId(file.id);
    try {
      const res = await axiosAdmin.delete(`/admin/elements/${file.id}`);
      if (res.data.success) {
        showToast('Content deleted');
        setDraft(blankConfig(activeElement));
        loadAll();
      }
    } catch (error) {
      console.error('Delete failed:', error);
      showToast('Failed to delete content', 'error');
    } finally {
      setBusyFileId(null);
    }
  };

  const updateArrayItem = (idx, value) => {
    setDraft(d => {
      const arr = [...(d[activeElement.field] || [])];
      arr[idx] = value;
      return { ...d, [activeElement.field]: arr };
    });
  };

  const updateHint = (groupIdx, choiceIdx, field, value) => {
    setDraft(d => {
      const hints = d.hints.map(g => g.map(c => ({ ...c })));
      hints[groupIdx][choiceIdx][field] = value;
      return { ...d, hints };
    });
  };

  const renderEditForm = () => {
    if (!activeElement || !draft) return null;

    if (activeElement.shape === 'text') {
      return (
        <textarea
          value={draft.text || ''}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          rows={8}
          style={{ width: '100%', fontSize: '14px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
        />
      );
    }

    if (activeElement.shape === 'array') {
      const arr = draft[activeElement.field] || [];
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          {arr.map((val, idx) => (
            activeElement.multiline ? (
              <div key={idx}>
                <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Item {idx + 1}</label>
                <textarea
                  value={val || ''}
                  onChange={(e) => updateArrayItem(idx, e.target.value)}
                  rows={2}
                  style={{ width: '100%', fontSize: '14px', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>
            ) : (
              <input
                key={idx}
                type="text"
                value={val || ''}
                onChange={(e) => updateArrayItem(idx, e.target.value)}
                placeholder={`Item ${idx + 1}`}
                style={{ fontSize: '14px', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            )
          ))}
        </div>
      );
    }

    // hints
    return (
      <div style={{ display: 'grid', gap: '16px' }}>
        {(draft.hints || []).map((group, gIdx) => (
          <div key={gIdx} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', marginBottom: '8px' }}>Hint Group {gIdx + 1}</div>
            {group.map((choice, cIdx) => (
              <div key={cIdx} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: cIdx === 0 ? '1px dashed #e5e7eb' : 'none' }}>
                <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Description (answer: <strong>{choice.answer}</strong> — fixed, not translated)
                </label>
                <textarea
                  value={choice.description || ''}
                  onChange={(e) => updateHint(gIdx, cIdx, 'description', e.target.value)}
                  rows={2}
                  style={{ width: '100%', fontSize: '13px', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db', marginBottom: '6px' }}
                />
                <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Example (leave blank if none)</label>
                <input
                  type="text"
                  value={choice.example || ''}
                  onChange={(e) => updateHint(gIdx, cIdx, 'example', e.target.value || null)}
                  style={{ width: '100%', fontSize: '13px', padding: '8px', borderRadius: '8px', border: '1px solid #d1d5db' }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderPreview = () => {
    if (!activeElement || !draft) return null;
    if (activeElement.shape === 'text') {
      return <div style={{ padding: '16px', background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '15px', lineHeight: 1.7, textAlign: 'justify' }}>{draft.text}</div>;
    }
    if (activeElement.shape === 'array' && !activeElement.multiline) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(draft[activeElement.field] || []).map((v, i) => (
            <span key={i} style={{ display: 'inline-block', padding: '8px 16px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', fontSize: '18px', fontWeight: 700, color: '#3730a3' }}>{v || '—'}</span>
          ))}
        </div>
      );
    }
    if (activeElement.shape === 'array' && activeElement.multiline) {
      return (
        <div style={{ display: 'grid', gap: '10px' }}>
          {(draft[activeElement.field] || []).map((v, i) => (
            <div key={i} style={{ padding: '12px', background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '14px' }}>{v || '—'}</div>
          ))}
        </div>
      );
    }
    // hints
    return (
      <div style={{ display: 'grid', gap: '10px' }}>
        {(draft.hints || []).map((group, gIdx) => (
          <div key={gIdx} className="rs-hint-panel" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px' }}>
            {group.map((choice, cIdx) => (
              <div key={cIdx} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '13px' }}>{choice.description || '—'}</div>
                {choice.example && <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#4b5563' }}>“{choice.example}”</div>}
                <div style={{ fontSize: '12px', fontWeight: 700, color: choice.answer === 'Yes' ? '#059669' : '#dc2626' }}>→ Select {choice.answer}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const currentFile = activeElement ? getFile(activeElement.key, activeLang) : null;

  return (
    <div className="elements-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
        <h3 style={{ margin: 0 }}>📖 Test Content {collapsed ? '▸' : '▾'}</h3>
      </div>
      {!collapsed && (
        <>
          <p className="elements-desc">
            Manage every piece of Padh ke Batao V2's actual test content — the letter and word banks, both paragraphs,
            the story, and the assessor's reading-style questions and hints — with an independent, editable version per
            language. Hindi is the original source; every other language starts from an AI-drafted translation for you
            to review and correct.
          </p>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '220px', position: 'sticky', left: 0, background: '#f8fafc' }}>Element</th>
                      {languages.map(lang => (
                        <th key={lang.code} style={{ textAlign: 'center', minWidth: '40px', fontSize: '11px' }} title={lang.name}>{lang.code}</th>
                      ))}
                      <th style={{ width: '100px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ELEMENTS.map(el => {
                      const isOpen = expandedKey === el.key;
                      return (
                        <React.Fragment key={el.key}>
                          <tr style={isOpen ? { background: '#eff6ff' } : undefined}>
                            <td style={{ position: 'sticky', left: 0, background: isOpen ? '#eff6ff' : '#fff' }}><strong>{el.label}</strong></td>
                            {languages.map(lang => {
                              const file = getFile(el.key, lang.code);
                              const ok = file && file.is_active !== 0;
                              return (
                                <td key={lang.code} style={{ textAlign: 'center' }} title={ok ? `${lang.name}: configured` : `${lang.name}: missing`}>
                                  {ok ? <span style={{ color: '#059669', fontWeight: 700 }}>✓</span> : <span style={{ color: '#d97706', fontSize: '11px' }}>⚠</span>}
                                </td>
                              );
                            })}
                            <td>
                              <button className="admin-btn admin-btn-secondary" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => openElement(el)}>
                                {isOpen ? 'Close' : 'Manage'}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={languages.length + 2} style={{ background: '#f8fafc', padding: '16px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                                  {languages.map(lang => {
                                    const file = getFile(el.key, lang.code);
                                    const ok = file && file.is_active !== 0;
                                    return (
                                      <button
                                        key={lang.code}
                                        onClick={() => switchLang(el, lang.code)}
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

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {currentFile ? `Last updated: ${fmtDateTime(currentFile.updated_at)}${currentFile.is_active === 0 ? ' — DISABLED' : ''}` : 'Not configured yet — showing a blank draft'}
                                  </div>
                                  <button className="admin-btn admin-btn-secondary" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => setShowPreview(p => !p)}>
                                    {showPreview ? 'Edit' : 'Preview'}
                                  </button>
                                </div>

                                {showPreview ? renderPreview() : renderEditForm()}

                                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                                  <button className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save'}
                                  </button>
                                  {currentFile && (
                                    <>
                                      <button className="admin-btn admin-btn-secondary" onClick={handleToggleStatus} disabled={busyFileId === currentFile.id}>
                                        {currentFile.is_active === 0 ? 'Enable' : 'Disable'}
                                      </button>
                                      <button className="admin-btn-icon" style={{ color: '#dc2626' }} onClick={handleDelete} disabled={busyFileId === currentFile.id} title="Delete this translation">
                                        🗑
                                      </button>
                                    </>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
