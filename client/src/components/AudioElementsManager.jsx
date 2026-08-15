import React, { useState, useEffect, useCallback, useRef } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';

// Every game's pre-existing static splash clip — the same paths hardcoded
// as the fallback argument to getAudioUrl() in each game page (see
// client/src/hooks/useTestAudio.js). Historically single-language (Hindi),
// bundled into the client build rather than admin-managed. Shown here under
// the Hindi row so an Admin sees what's already playing today before they
// upload anything, instead of every language looking equally empty.
const SPLASH_STATIC_FALLBACKS = {
    numeracy_number_skill: '/assets/audios/number_skill/splash.wav',
    numeracy_number_skill_v2: '/assets/audios/number_skill_v2/splash.wav',
    numeracy_number_skill_v3: '/assets/audios/number_skill_v3/splash.wav',
    literacy_reading_skill: '/assets/audios/reading_skill/splash.wav',
    literacy_reading_skill_v2: '/assets/audios/reading_skill_v2/splash.wav',
    working_memory_herpher: '/assets/audios/her_pher/splash.wav',
    working_memory_herpher_v2: '/assets/audios/her_pher_v2/splash.wav',
    working_memory_herpher_v3: '/assets/audios/her_pher_v3/splash.wav',
    atlantis_bagiya: '/assets/audios/bagiya/splash.wav',
    rover_mela: '/assets/audios/chalo_mela_chale/splash.wav',
    number_recall_lottery: '/assets/audios/lottery_ka_ticket/splash1.m4a',
    number_recall_lottery_v2: '/assets/audios/lottery_ka_ticket_V2/splash1.m4a',
    triangle_rachna: '/assets/audios/rachna/splash.wav',
};

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

    const resolveUrl = (path) => (path.startsWith('/assets') ? path : `${SERVER_BASE}${path}`);

    const getFile = (slot, langCode) =>
        files.find(f => f.asset_type === `audio_${slot.element_key}` && f.language === langCode);

    // Only the 'splash' slot has a pre-existing static default, and it's
    // only ever shown under Hindi (see SPLASH_STATIC_FALLBACKS comment) —
    // and only until an Admin uploads a real Hindi file for it, at which
    // point the uploaded one takes over, matching useTestAudio's own
    // resolution order.
    const getStaticFallback = (slot, langCode) =>
        (slot.element_key === 'splash' && langCode === 'hi') ? SPLASH_STATIC_FALLBACKS[gameKey] : null;

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
                        language, falling back to the platform default language when a clip is missing for the current one.
                    </p>

                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        <>
                            {orderedSlots.map((slot, idx) => (
                                <div key={slot.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', marginBottom: '16px', background: '#fafafa' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <button className="admin-btn" style={{ padding: '2px 8px', fontSize: '11px' }} disabled={idx === 0} onClick={() => handleReorder(slot, 'up')}>▲</button>
                                            <button className="admin-btn" style={{ padding: '2px 8px', fontSize: '11px' }} disabled={idx === orderedSlots.length - 1} onClick={() => handleReorder(slot, 'down')}>▼</button>
                                        </div>
                                        <strong style={{ fontSize: '15px' }}>{slot.label}</strong>
                                        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>({slot.element_key})</span>
                                    </div>

                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="admin-table" style={{ width: '100%' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '140px' }}>Language</th>
                                                    <th>Audio File</th>
                                                    <th style={{ width: '160px' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {languages.map(lang => {
                                                    const file = getFile(slot, lang.code);
                                                    const staticFallback = !file ? getStaticFallback(slot, lang.code) : null;
                                                    const key = `${slot.id}_${lang.code}`;
                                                    return (
                                                        <tr key={lang.code}>
                                                            <td>{lang.name} <span style={{ color: '#9ca3af', fontSize: '11px' }}>({lang.code})</span></td>
                                                            <td>
                                                                {file ? (
                                                                    <audio controls src={resolveUrl(file.file_path)} style={{ height: '32px', maxWidth: '260px', width: '100%' }} />
                                                                ) : staticFallback ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <audio controls src={staticFallback} style={{ height: '32px', maxWidth: '220px', width: '100%' }} />
                                                                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>Default</span>
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ color: '#9ca3af', fontSize: '13px' }}>No Audio</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <input
                                                                        type="file"
                                                                        accept="audio/*"
                                                                        style={{ display: 'none' }}
                                                                        ref={el => fileRefs.current[key] = el}
                                                                        onChange={(e) => handleFileSelect(slot, lang.code, e.target.files[0])}
                                                                    />
                                                                    <button
                                                                        className="admin-btn admin-btn-primary"
                                                                        style={{ fontSize: '12px', padding: '5px 10px' }}
                                                                        onClick={() => fileRefs.current[key]?.click()}
                                                                        disabled={uploadingKey === key}
                                                                    >
                                                                        {uploadingKey === key ? 'Uploading...' : (file ? 'Replace' : 'Upload')}
                                                                    </button>
                                                                    {file && (
                                                                        <button className="admin-btn admin-btn-danger" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => handleDeleteFile(file)}>
                                                                            Delete
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
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
