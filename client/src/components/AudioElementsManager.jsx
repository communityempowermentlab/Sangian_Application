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

// Lottery Ticket V1/V2's per-item static (Hindi) clips — the exact filenames
// still hardcoded as the staticFallbackPath argument to getAudioUrl() at
// each call site in NumberRecallGame.jsx / NumberRecallGameV2.jsx. Shown
// here the same way SPLASH_STATIC_FALLBACKS is, purely so an Admin can see/
// preview what's already playing before uploading a per-language override —
// these are never written to the DB, matching the splash precedent.
const LOTTERY_ITEM_STATIC_FALLBACKS = {
    number_recall_lottery: {
        practice: '/assets/audios/lottery_ka_ticket/4_6.m4a',
        practice_teaching: '/assets/audios/lottery_ka_ticket/4_6_teaching_audio.m4a',
        teaching_1: '/assets/audios/lottery_ka_ticket/9_4.m4a',
        teaching_1_teaching: '/assets/audios/lottery_ka_ticket/9_4_teaching_audio.m4a',
        teaching_2: '/assets/audios/lottery_ka_ticket/2_8.m4a',
        1: '/assets/audios/lottery_ka_ticket/8_9.m4a',
        2: '/assets/audios/lottery_ka_ticket/4_9_5.m4a',
        3: '/assets/audios/lottery_ka_ticket/9_1_6.m4a',
        4: '/assets/audios/lottery_ka_ticket/10_5_3.m4a',
        5: '/assets/audios/lottery_ka_ticket/10_2_5_8.m4a',
        6: '/assets/audios/lottery_ka_ticket/5_2_10_3.m4a',
        7: '/assets/audios/lottery_ka_ticket/6_1_9_5.m4a',
        8: '/assets/audios/lottery_ka_ticket/2_3_6_10_5.m4a',
        9: '/assets/audios/lottery_ka_ticket/1_4_6_9_2.m4a',
        10: '/assets/audios/lottery_ka_ticket/3_10_1_5_8.m4a',
        11: '/assets/audios/lottery_ka_ticket/9_3_5_1_8_4.m4a',
        12: '/assets/audios/lottery_ka_ticket/10_2_4_9_1_6.m4a',
        13: '/assets/audios/lottery_ka_ticket/2_6_3_10_8_4.m4a',
        14: '/assets/audios/lottery_ka_ticket/5_3_6_9_8_4_10.m4a',
        15: '/assets/audios/lottery_ka_ticket/3_1_5_9_4_6_8.m4a',
        16: '/assets/audios/lottery_ka_ticket/1_10_2_6_8_5_3.m4a',
        17: '/assets/audios/lottery_ka_ticket/5_8_4_1_9_4_6_3.m4a',
        18: '/assets/audios/lottery_ka_ticket/1_8_5_3_9_4_6_2_10.m4a',
        19: '/assets/audios/lottery_ka_ticket/9_1_2_6_4_3_8_5_10.m4a',
        20: '/assets/audios/lottery_ka_ticket/10_5_1_9_8_2_4_6_3.m4a',
    },
    number_recall_lottery_v2: {
        practice: '/assets/audios/lottery_ka_ticket_V2/3_6.m4a',
        practice_teaching: '/assets/audios/lottery_ka_ticket_V2/3_6_teaching_audio.m4a',
        teaching_1: '/assets/audios/lottery_ka_ticket_V2/2_8.m4a',
        teaching_1_teaching: '/assets/audios/lottery_ka_ticket_V2/2_8_teaching_audio.m4a',
        teaching_2: '/assets/audios/lottery_ka_ticket_V2/5_10.m4a',
        1: '/assets/audios/lottery_ka_ticket_V2/1_4.m4a',
        2: '/assets/audios/lottery_ka_ticket_V2/3_5_9.m4a',
        3: '/assets/audios/lottery_ka_ticket_V2/4_10_2.m4a',
        4: '/assets/audios/lottery_ka_ticket_V2/8_1_9.m4a',
        5: '/assets/audios/lottery_ka_ticket_V2/3_6_9_1.m4a',
        6: '/assets/audios/lottery_ka_ticket_V2/8_4_1_6.m4a',
        7: '/assets/audios/lottery_ka_ticket_V2/2_10_4_8.m4a',
        8: '/assets/audios/lottery_ka_ticket_V2/9_1_4_8_2.m4a',
        9: '/assets/audios/lottery_ka_ticket_V2/5_10_3_8_6.m4a',
        10: '/assets/audios/lottery_ka_ticket_V2/2_9_4_6_10.m4a',
        11: '/assets/audios/lottery_ka_ticket_V2/2_6_10_4_9_5.m4a',
        12: '/assets/audios/lottery_ka_ticket_V2/8_3_5_1_10_4.m4a',
        13: '/assets/audios/lottery_ka_ticket_V2/9_1_5_8_6_2.m4a',
        14: '/assets/audios/lottery_ka_ticket_V2/1_2_10_6_4_9_8.m4a',
        15: '/assets/audios/lottery_ka_ticket_V2/10_2_6_4_8_5_9.m4a',
        16: '/assets/audios/lottery_ka_ticket_V2/4_9_5_2_10_8_6.m4a',
        17: '/assets/audios/lottery_ka_ticket_V2/2_10_6_3_8_1_5_9.m4a',
        18: '/assets/audios/lottery_ka_ticket_V2/3_9_2_6_1_10_4_8_5.m4a',
        19: '/assets/audios/lottery_ka_ticket_V2/5_2_8_10_3_1_6_9_4.m4a',
        20: '/assets/audios/lottery_ka_ticket_V2/8_4_1_6_3_9_2_10_5.m4a',
    },
};

// Slots beyond this count switch to the compact summary-table + expand-to-
// manage layout (Lottery Ticket's 26 elements) — below it, every game keeps
// today's flat fully-expanded layout unchanged (splash-only games: 1 slot).
const COMPACT_THRESHOLD = 3;

const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

// Admin control for the "Test/Game -> Audio Element -> Language -> Audio
// File" system: each test has a fixed set of audio slots (audio_elements,
// seeded per test — just "Splash Screen Audio" for most games, or a full
// 26-element set for Lottery Ticket V1/V2), each with an independently
// uploadable clip per language. The per-language files reuse the existing
// elements upload/delete/status endpoints unchanged — this component only
// adds asset_type = 'audio_' + element_key so they land alongside
// splash-screen images in the same test_elements table.
export default function AudioElementsManager({ gameKey, languages, showToast }) {
    const [collapsed, setCollapsed] = useState(false);
    const [slots, setSlots] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadingKey, setUploadingKey] = useState(null);
    const [busyFileId, setBusyFileId] = useState(null);
    const [expandedSlotId, setExpandedSlotId] = useState(null);
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
    useEffect(() => { setExpandedSlotId(null); }, [gameKey]);

    const resolveUrl = (path) => (path.startsWith('/assets') ? path : `${SERVER_BASE}${path}`);

    const getFile = (slot, langCode) =>
        files.find(f => f.asset_type === `audio_${slot.element_key}` && f.language === langCode);

    // Only splash and Lottery Ticket's item slots have a pre-existing static
    // default, and (matching useTestAudio's own resolution order) only ever
    // shown under Hindi — until an Admin uploads a real Hindi file for it,
    // at which point the uploaded one takes over.
    const getStaticFallback = (slot, langCode) => {
        if (langCode !== 'hi') return null;
        if (slot.element_key === 'splash') return SPLASH_STATIC_FALLBACKS[gameKey] || null;
        return LOTTERY_ITEM_STATIC_FALLBACKS[gameKey]?.[slot.element_key] || null;
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

    const handleDelete = async (file) => {
        if (!window.confirm('Delete this audio file? This cannot be undone.')) return;
        setBusyFileId(file.id);
        try {
            const res = await axiosAdmin.delete(`/admin/elements/${file.id}`);
            if (res.data.success) {
                showToast('Audio deleted');
                loadAll();
            }
        } catch (error) {
            console.error('Audio delete failed:', error);
            showToast('Failed to delete audio', 'error');
        } finally {
            setBusyFileId(null);
        }
    };

    const handleToggleStatus = async (file) => {
        setBusyFileId(file.id);
        try {
            const res = await axiosAdmin.put(`/admin/elements/${file.id}/status`);
            if (res.data.success) {
                showToast(res.data.is_active ? 'Audio enabled' : 'Audio disabled');
                loadAll();
            }
        } catch (error) {
            console.error('Audio status toggle failed:', error);
            showToast('Failed to update audio status', 'error');
        } finally {
            setBusyFileId(null);
        }
    };

    const orderedSlots = [...slots].sort((a, b) => a.display_order - b.display_order);
    const isCompact = orderedSlots.length > COMPACT_THRESHOLD;

    // The full Language / Audio File / Uploaded / Action table for one slot —
    // shared by both the flat layout (few slots) and the compact layout's
    // expanded "Manage" panel (many slots), so upload/preview/delete/toggle
    // behave identically either way.
    const renderLanguageTable = (slot) => (
        <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%' }}>
                <thead>
                    <tr>
                        <th style={{ width: '140px' }}>Language</th>
                        <th>Audio File</th>
                        <th style={{ width: '150px' }}>Uploaded</th>
                        <th style={{ width: '160px' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {languages.map(lang => {
                        const file = getFile(slot, lang.code);
                        const staticFallback = !file ? getStaticFallback(slot, lang.code) : null;
                        const key = `${slot.id}_${lang.code}`;
                        const isBusy = busyFileId === file?.id;
                        return (
                            <tr key={lang.code}>
                                <td>{lang.name} <span style={{ color: '#9ca3af', fontSize: '11px' }}>({lang.code})</span></td>
                                <td>
                                    {file ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <audio controls src={resolveUrl(file.file_path)} style={{ height: '32px', maxWidth: '220px', width: '100%' }} />
                                            {file.is_active === 0 && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>Disabled</span>}
                                        </div>
                                    ) : staticFallback ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <audio controls src={staticFallback} style={{ height: '32px', maxWidth: '220px', width: '100%' }} />
                                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Default</span>
                                        </div>
                                    ) : (
                                        <span style={{ color: '#9ca3af', fontSize: '13px' }}>Not Configured</span>
                                    )}
                                </td>
                                <td style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {file ? fmtDateTime(file.updated_at) : '—'}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                                            <>
                                                <button
                                                    className="admin-btn admin-btn-secondary"
                                                    style={{ fontSize: '12px', padding: '5px 10px' }}
                                                    onClick={() => handleToggleStatus(file)}
                                                    disabled={isBusy}
                                                    title={file.is_active === 0 ? 'Enable this audio' : 'Disable this audio'}
                                                >
                                                    {file.is_active === 0 ? 'Enable' : 'Disable'}
                                                </button>
                                                <button
                                                    className="admin-btn-icon"
                                                    style={{ color: '#dc2626' }}
                                                    onClick={() => handleDelete(file)}
                                                    disabled={isBusy}
                                                    title="Delete this audio"
                                                >
                                                    🗑
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

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
                    ) : !isCompact ? (
                        orderedSlots.map((slot) => (
                            <div key={slot.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', marginBottom: '16px', background: '#fafafa' }}>
                                <div style={{ marginBottom: '10px' }}>
                                    <strong style={{ fontSize: '15px' }}>{slot.label}</strong>{' '}
                                    <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>({slot.element_key})</span>
                                </div>
                                {renderLanguageTable(slot)}
                            </div>
                        ))
                    ) : (
                        <div>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px', color: '#4b5563', marginBottom: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px' }}>
                                <span><strong style={{ color: '#059669' }}>✓</strong> Uploaded by Admin</span>
                                <span><strong style={{ color: '#d97706' }}>●</strong> Default (built-in) audio only</span>
                                <span><strong style={{ color: '#dc2626' }}>✕</strong> Uploaded but disabled</span>
                                <span><strong style={{ color: '#d1d5db' }}>—</strong> Not configured</span>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: '200px', position: 'sticky', left: 0, background: '#f8fafc' }}>Element</th>
                                        {languages.map(lang => (
                                            <th key={lang.code} style={{ textAlign: 'center', minWidth: '40px', fontSize: '11px' }} title={lang.name}>
                                                {lang.code}
                                            </th>
                                        ))}
                                        <th style={{ width: '100px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderedSlots.map((slot) => {
                                        const isOpen = expandedSlotId === slot.id;
                                        return (
                                            <React.Fragment key={slot.id}>
                                                <tr style={isOpen ? { background: '#eff6ff' } : undefined}>
                                                    <td style={{ position: 'sticky', left: 0, background: isOpen ? '#eff6ff' : '#fff' }}>
                                                        <strong>{slot.label}</strong>
                                                    </td>
                                                    {languages.map(lang => {
                                                        const file = getFile(slot, lang.code);
                                                        const staticFallback = !file ? getStaticFallback(slot, lang.code) : null;
                                                        const mark = file ? (file.is_active === 0 ? '✕' : '✓') : staticFallback ? '●' : '—';
                                                        const color = file ? (file.is_active === 0 ? '#dc2626' : '#059669') : staticFallback ? '#d97706' : '#d1d5db';
                                                        const title = file
                                                            ? `${lang.name}: ${file.is_active === 0 ? 'disabled' : 'configured'}`
                                                            : staticFallback ? `${lang.name}: default (built-in) audio only — not yet uploaded by Admin` : `${lang.name}: not configured`;
                                                        return (
                                                            <td key={lang.code} style={{ textAlign: 'center', color, fontWeight: 700, fontSize: mark === '●' ? '10px' : '14px' }} title={title}>
                                                                {mark}
                                                            </td>
                                                        );
                                                    })}
                                                    <td>
                                                        <button
                                                            className="admin-btn admin-btn-secondary"
                                                            style={{ fontSize: '12px', padding: '5px 10px' }}
                                                            onClick={() => setExpandedSlotId(isOpen ? null : slot.id)}
                                                        >
                                                            {isOpen ? 'Close' : 'Manage'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr>
                                                        <td colSpan={languages.length + 2} style={{ background: '#f8fafc', padding: '16px' }}>
                                                            {renderLanguageTable(slot)}
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
                </>
            )}
        </div>
    );
}
