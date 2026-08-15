import React, { useState, useEffect, useCallback, useRef } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';

// Admin control for the "Test/Game -> Audio Element -> Language -> Audio
// File" system: an ordered list of admin-defined audio slots per test
// (audio_elements), each with an independently uploadable clip per
// language. The per-language files reuse the existing elements upload/
// delete endpoints unchanged — this component only adds asset_type =
// 'audio_' + element_key so they land alongside splash-screen images in the
// same test_elements table, and separately manages the slot list itself via
// /admin/audio-elements.
export default function AudioElementsManager({ gameKey, languages, showToast }) {
    const [collapsed, setCollapsed] = useState(false);
    const [slots, setSlots] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [adding, setAdding] = useState(false);
    const [uploadingKey, setUploadingKey] = useState(null);
    const fileRefs = useRef({});

    const SERVER_BASE = API_URL.replace(/\/api$/, '');

    const loadAll = useCallback(async () => {
        if (!gameKey) return;
        setLoading(true);
        try {
            const [slotsRes, filesRes] = await Promise.all([
                axiosAdmin.get(`/admin/audio-elements?test_id=${gameKey}`),
                axiosAdmin.get(`/admin/elements?test_id=${gameKey}`),
            ]);
            setSlots(slotsRes.data.elements || []);
            setFiles((filesRes.data.elements || []).filter(e => e.asset_type?.startsWith('audio_')));
        } catch (error) {
            console.error('Failed to load audio elements:', error);
            showToast('Failed to load audio elements', 'error');
        } finally {
            setLoading(false);
        }
    }, [gameKey, showToast]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const getAudioUrl = (file) => {
        if (file.file_path.startsWith('/assets')) return file.file_path;
        return `${SERVER_BASE}${file.file_path}`;
    };

    const getFile = (slot, langCode) =>
        files.find(f => f.asset_type === `audio_${slot.element_key}` && f.language === langCode);

    const handleAddSlot = async () => {
        if (!newLabel.trim()) return;
        setAdding(true);
        try {
            const res = await axiosAdmin.post('/admin/audio-elements', { test_id: gameKey, label: newLabel.trim() });
            if (res.data.success) {
                showToast('Audio element added');
                setNewLabel('');
                loadAll();
            }
        } catch (error) {
            console.error('Add audio element failed:', error);
            showToast('Failed to add audio element', 'error');
        } finally {
            setAdding(false);
        }
    };

    const handleReorder = async (slot, direction) => {
        const ordered = [...slots].sort((a, b) => a.display_order - b.display_order);
        const idx = ordered.findIndex(s => s.id === slot.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= ordered.length) return;
        const other = ordered[swapIdx];
        try {
            await Promise.all([
                axiosAdmin.put(`/admin/audio-elements/${slot.id}`, { display_order: other.display_order }),
                axiosAdmin.put(`/admin/audio-elements/${other.id}`, { display_order: slot.display_order }),
            ]);
            loadAll();
        } catch (error) {
            console.error('Reorder failed:', error);
            showToast('Failed to reorder', 'error');
        }
    };

    const handleToggleSlotStatus = async (slot) => {
        try {
            const status = slot.status === 'active' ? 'inactive' : 'active';
            await axiosAdmin.put(`/admin/audio-elements/${slot.id}`, { status });
            showToast('Status updated');
            loadAll();
        } catch (error) {
            console.error('Toggle slot status failed:', error);
            showToast('Failed to update status', 'error');
        }
    };

    const handleDeleteSlot = async (slot) => {
        if (!window.confirm(`Delete "${slot.label}" and all its uploaded audio files across every language? This cannot be undone.`)) return;
        try {
            await axiosAdmin.delete(`/admin/audio-elements/${slot.id}`);
            showToast('Audio element deleted');
            loadAll();
        } catch (error) {
            console.error('Delete slot failed:', error);
            showToast('Failed to delete audio element', 'error');
        }
    };

    const handleFallbackChange = async (slot, fallback_language) => {
        try {
            await axiosAdmin.put(`/admin/audio-elements/${slot.id}`, { fallback_language: fallback_language || null });
            loadAll();
        } catch (error) {
            console.error('Fallback update failed:', error);
            showToast('Failed to update fallback language', 'error');
        }
    };

    const handleFileSelect = async (slot, langCode, file) => {
        if (!file) return;
        const key = `${slot.id}_${langCode}`;
        setUploadingKey(key);
        try {
            const existing = getFile(slot, langCode);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('test_id', gameKey);
            formData.append('asset_type', `audio_${slot.element_key}`);
            formData.append('language', langCode);
            if (existing) formData.append('replace_id', existing.id);

            const res = await axiosAdmin.post('/admin/elements/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                showToast(existing ? 'Audio replaced successfully' : 'Audio uploaded successfully');
                loadAll();
            }
        } catch (error) {
            console.error('Audio upload failed:', error);
            showToast('Failed to upload audio', 'error');
        } finally {
            setUploadingKey(null);
            if (fileRefs.current[key]) fileRefs.current[key].value = '';
        }
    };

    const handleDeleteFile = async (file) => {
        if (!window.confirm('Delete this audio file?')) return;
        try {
            await axiosAdmin.delete(`/admin/elements/${file.id}`);
            showToast('Audio file deleted');
            loadAll();
        } catch (error) {
            console.error('Delete audio file failed:', error);
            showToast('Failed to delete audio file', 'error');
        }
    };

    const orderedSlots = [...slots].sort((a, b) => a.display_order - b.display_order);

    return (
        <div className="elements-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
                <h3 style={{ margin: 0 }}>🔊 Audio Management {collapsed ? '▸' : '▾'}</h3>
            </div>
            {!collapsed && (
                <>
                    <p className="elements-desc">
                        Manage every audio clip for this test — splash screen audio and any other audio elements — with an
                        independent file per language. Games automatically load the clip matching the player's selected
                        language, falling back to the fallback language below (or the platform default) when a clip is
                        missing for the current one.
                    </p>

                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            {orderedSlots.map((slot, idx) => (
                                <div key={slot.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', marginBottom: '16px', background: '#fafafa' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <button className="admin-btn" style={{ padding: '2px 8px', fontSize: '11px' }} disabled={idx === 0} onClick={() => handleReorder(slot, 'up')}>▲</button>
                                                <button className="admin-btn" style={{ padding: '2px 8px', fontSize: '11px' }} disabled={idx === orderedSlots.length - 1} onClick={() => handleReorder(slot, 'down')}>▼</button>
                                            </div>
                                            <strong style={{ fontSize: '15px' }}>{slot.label}</strong>
                                            <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>({slot.element_key})</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <label style={{ fontSize: '12px', color: '#6b7280' }}>
                                                Fallback language:{' '}
                                                <select
                                                    value={slot.fallback_language || ''}
                                                    onChange={(e) => handleFallbackChange(slot, e.target.value)}
                                                    style={{ fontSize: '12px', padding: '2px 4px' }}
                                                >
                                                    <option value="">Platform default</option>
                                                    {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                                                </select>
                                            </label>
                                            <button
                                                className="admin-btn"
                                                onClick={() => handleToggleSlotStatus(slot)}
                                                style={{ background: slot.status === 'active' ? '#dcfce7' : '#fee2e2', color: slot.status === 'active' ? '#166534' : '#991b1b' }}
                                            >
                                                {slot.status === 'active' ? 'Active' : 'Inactive'}
                                            </button>
                                            <button className="admin-btn admin-btn-danger" onClick={() => handleDeleteSlot(slot)}>Delete</button>
                                        </div>
                                    </div>

                                    <div className="elements-grid">
                                        {languages.map(lang => {
                                            const file = getFile(slot, lang.code);
                                            const key = `${slot.id}_${lang.code}`;
                                            return (
                                                <div key={lang.code} className="element-card">
                                                    <div className="element-card-header">
                                                        <strong>{lang.name}</strong> ({lang.code})
                                                    </div>
                                                    <div className="element-preview">
                                                        {file ? (
                                                            <audio controls src={getAudioUrl(file)} style={{ width: '100%' }} />
                                                        ) : (
                                                            <div className="element-preview-empty">No Audio</div>
                                                        )}
                                                    </div>
                                                    <div className="element-actions">
                                                        <input
                                                            type="file"
                                                            accept="audio/*"
                                                            style={{ display: 'none' }}
                                                            ref={el => fileRefs.current[key] = el}
                                                            onChange={(e) => handleFileSelect(slot, lang.code, e.target.files[0])}
                                                        />
                                                        <button
                                                            className="admin-btn admin-btn-primary"
                                                            onClick={() => fileRefs.current[key]?.click()}
                                                            disabled={uploadingKey === key}
                                                        >
                                                            {uploadingKey === key ? 'Uploading...' : (file ? 'Replace' : 'Upload')}
                                                        </button>
                                                        {file && (
                                                            <button className="admin-btn admin-btn-danger" onClick={() => handleDeleteFile(file)}>
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                    {file && (
                                                        <div className="element-meta">
                                                            Last updated: {new Date(file.updated_at).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="New audio element name, e.g. Audio 1"
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', flex: 1, maxWidth: '300px' }}
                                />
                                <button className="admin-btn admin-btn-primary" onClick={handleAddSlot} disabled={adding || !newLabel.trim()}>
                                    {adding ? 'Adding...' : '+ Add Audio Element'}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
