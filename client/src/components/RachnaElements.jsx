// ============================================================
// RachnaElements.jsx — admin editor for Rachna's per-question
// shape composition + target image, mounted from AdminElements.jsx
// when the selected test is triangle_rachna.
//
// Reads/writes test_elements rows keyed by (test_id='triangle_rachna',
// asset_type=<questionKey>, language='en') via the Elements API —
// image upload reuses the existing generic upload endpoint, shapes
// are saved through the new /admin/elements/config endpoint. The
// live game only ever reads this data as an *override* layered on
// top of its own hardcoded defaults (see rachnaQuestions.js), so an
// untouched question here behaves exactly as it always has.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';
import { ShapeEl } from './RachnaShapeEl';
import {
  QUESTIONS, SAMPLE_QS, TEACHING_QS, ORIGINAL_QS,
  getTargetImageName, getQuestionTitle,
} from '../data/rachnaQuestions';
import './RachnaElements.css';

const TEST_ID = 'triangle_rachna';
const LANGUAGE = 'en'; // shape geometry/images aren't language-specific
const IMAGE_PATH = '/assets/images/rachna';
const SERVER_BASE = API_URL.replace(/\/api$/, '');

const SHAPE_OPTIONS = ['circle', 'square', 'diamond', 'triangle-up', 'triangle-down', 'right-triangle'];
const SIZE_OPTIONS = ['large', 'small'];
const ORIENTATION_OPTIONS = ['BL', 'BR', 'UL', 'UR'];

const GROUPS = [
  { label: 'Sample Questions', keys: SAMPLE_QS },
  { label: 'Teaching Questions', keys: TEACHING_QS },
  { label: 'Scored Questions', keys: ORIGINAL_QS },
];

function emptySource() {
  return { shape: 'circle', color: '#e74c3c', size: 'large', orientation: 'BL', scale: '', name: '' };
}

const RachnaElements = () => {
  const [elementsByKey, setElementsByKey] = useState({}); // asset_type -> row
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState(null);
  const [draftSources, setDraftSources] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadElements = async () => {
    setLoading(true);
    try {
      const res = await axiosAdmin.get('/admin/elements', { params: { test_id: TEST_ID } });
      const map = {};
      (res.data.elements || []).forEach(el => {
        if (el.asset_type !== 'splash_screen') map[el.asset_type] = el;
      });
      setElementsByKey(map);
    } catch (error) {
      console.error('Failed to load Rachna elements:', error);
      showToast('Failed to load question overrides', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadElements(); }, []);

  const getImageUrl = (key) => {
    const el = elementsByKey[key];
    if (el?.file_path) return `${SERVER_BASE}${el.file_path}`;
    return `${IMAGE_PATH}/${getTargetImageName(key)}.png`;
  };

  const getSources = (key) => elementsByKey[key]?.config?.sources || QUESTIONS[key].sources;

  const toggleExpand = (key) => {
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    // Seed the draft editor from the current effective sources (override, or default)
    setDraftSources(getSources(key).map(s => ({
      shape: s.shape, color: s.color, size: s.size,
      orientation: s.orientation || 'BL', scale: s.scale ?? '', name: s.name || '',
    })));
  };

  const updateDraftSource = (idx, field, value) => {
    setDraftSources(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addDraftSource = () => setDraftSources(prev => [...prev, emptySource()]);
  const removeDraftSource = (idx) => setDraftSources(prev => prev.filter((_, i) => i !== idx));

  const saveShapes = async (key) => {
    if (draftSources.length === 0) {
      showToast('A question needs at least one shape', 'error');
      return;
    }
    setSaving(true);
    try {
      const sources = draftSources.map((s, i) => ({
        id: `${key}-src-${i}`,
        name: s.name || `${s.color} ${s.shape}`,
        shape: s.shape,
        color: s.color,
        size: s.size,
        ...(s.shape === 'right-triangle' ? { orientation: s.orientation } : {}),
        ...(s.scale !== '' && s.scale != null ? { scale: Number(s.scale) } : {}),
      }));
      await axiosAdmin.put('/admin/elements/config', {
        test_id: TEST_ID, asset_type: key, language: LANGUAGE, config: { sources },
      });
      showToast('Shapes saved');
      await loadElements();
    } catch (error) {
      console.error('Failed to save shapes:', error);
      showToast('Failed to save shapes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (key, file) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('test_id', TEST_ID);
    formData.append('asset_type', key);
    formData.append('language', LANGUAGE);
    formData.append('file', file);
    try {
      await axiosAdmin.post('/admin/elements/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('Image uploaded');
      await loadElements();
    } catch (error) {
      console.error('Failed to upload image:', error);
      showToast('Failed to upload image', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const resetQuestion = async (key) => {
    const el = elementsByKey[key];
    if (!el) return;
    if (!window.confirm(`Reset "${getQuestionTitle(key)}" (${key}) to its default image and shapes? This can't be undone.`)) return;
    try {
      await axiosAdmin.delete(`/admin/elements/${el.id}`);
      showToast('Reset to default');
      if (expandedKey === key) setExpandedKey(null);
      await loadElements();
    } catch (error) {
      console.error('Failed to reset question:', error);
      showToast('Failed to reset', 'error');
    }
  };

  if (loading) return <div className="admin-loading"><span className="spin">🔄</span> Loading question overrides...</div>;

  return (
    <div className="rachna-elements">
      <h3>Question Content</h3>
      <p className="elements-desc">
        Override a question's target image and/or the shapes children drag into the
        workspace. Anything not customized here keeps using the built-in default —
        question order, timing, and scoring are unaffected either way.
      </p>

      {GROUPS.map(group => (
        <div key={group.label} className="rachna-el-group">
          <h4>{group.label}</h4>
          <div className="rachna-el-list">
            {group.keys.map(key => {
              const isCustom = !!elementsByKey[key];
              const isExpanded = expandedKey === key;
              return (
                <div key={key} className={`rachna-el-row ${isExpanded ? 'expanded' : ''}`}>
                  <div className="rachna-el-row-header" onClick={() => toggleExpand(key)}>
                    <img src={getImageUrl(key)} alt={key} className="rachna-el-thumb" onError={e => { e.target.style.visibility = 'hidden'; }} />
                    <div className="rachna-el-row-title">
                      <strong>{getQuestionTitle(key)}</strong>
                      <span className="rachna-el-key">{key}</span>
                    </div>
                    {isCustom && <span className="rachna-el-badge">Customized</span>}
                    <span className="rachna-el-chevron">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="rachna-el-row-body">
                      <div className="rachna-el-image-section">
                        <div className="rachna-el-image-preview">
                          <img src={getImageUrl(key)} alt={`${key} target`} onError={e => { e.target.style.display = 'none'; }} />
                        </div>
                        <input type="file" accept="image/*" ref={fileRef} style={{ display: 'none' }}
                          onChange={(e) => handleImageUpload(key, e.target.files[0])} />
                        <button className="admin-btn admin-btn-primary" disabled={uploading}
                          onClick={() => fileRef.current?.click()}>
                          {uploading ? 'Uploading…' : 'Replace Target Image'}
                        </button>
                      </div>

                      <div className="rachna-el-shapes-section">
                        <div className="rachna-el-shapes-preview">
                          {draftSources.map((s, i) => (
                            <div key={i} className="rachna-el-shape-thumb" title={s.name}>
                              <ShapeEl shape={s.shape} color={s.color} size={s.size} orientation={s.orientation} workspace={false} />
                            </div>
                          ))}
                        </div>

                        <table className="rachna-el-source-table">
                          <thead>
                            <tr>
                              <th>Shape</th><th>Color</th><th>Size</th><th>Orientation</th><th>Scale</th><th>Label</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {draftSources.map((s, i) => (
                              <tr key={i}>
                                <td>
                                  <select value={s.shape} onChange={e => updateDraftSource(i, 'shape', e.target.value)}>
                                    {SHAPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </td>
                                <td><input type="color" value={s.color} onChange={e => updateDraftSource(i, 'color', e.target.value)} /></td>
                                <td>
                                  <select value={s.size} onChange={e => updateDraftSource(i, 'size', e.target.value)}>
                                    {SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                </td>
                                <td>
                                  {s.shape === 'right-triangle' ? (
                                    <select value={s.orientation} onChange={e => updateDraftSource(i, 'orientation', e.target.value)}>
                                      {ORIENTATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  ) : <span className="rachna-el-na">—</span>}
                                </td>
                                <td>
                                  <input type="number" step="0.01" min="0.1" max="3" placeholder="1"
                                    value={s.scale} onChange={e => updateDraftSource(i, 'scale', e.target.value)}
                                    style={{ width: 56 }} />
                                </td>
                                <td>
                                  <input type="text" placeholder="optional label" value={s.name}
                                    onChange={e => updateDraftSource(i, 'name', e.target.value)} style={{ width: 110 }} />
                                </td>
                                <td>
                                  <button className="rachna-el-remove-btn" onClick={() => removeDraftSource(i)} title="Remove shape">✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="rachna-el-shapes-actions">
                          <button className="admin-btn" onClick={addDraftSource}>+ Add Shape</button>
                          <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => saveShapes(key)}>
                            {saving ? 'Saving…' : 'Save Shapes'}
                          </button>
                        </div>
                      </div>

                      {isCustom && (
                        <button className="rachna-el-reset-btn" onClick={() => resetQuestion(key)}>
                          ↺ Reset this question to default
                        </button>
                      )}
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

export default RachnaElements;
