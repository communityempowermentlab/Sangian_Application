import React, { useState, useEffect, useRef, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';

// One entry per Bagiya response screen — count drives how many placeholders
// render when the real item set is randomised (screens 4-13); for the fixed
// screens (1-3) we also know the exact names, shown instead of "Item N" so
// the preview reads closer to the real game.
const SNAP_STEP = 2; // % — used only when "Snap to grid" is on

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const placeholderLabel = (fixedScreenNames, screenNum, index) => fixedScreenNames[screenNum]?.[index] ?? `Item ${index + 1}`;

const AdminElementPositionManager = ({
    gameKey,
    screenNums,
    screenCounts,
    fixedScreenNames = {},
    aspectW = 1180,
    aspectH = 650,
}) => {
    const [selectedScreen, setSelectedScreen] = useState(1);
    const [positions, setPositions] = useState([]); // current editable layout for selectedScreen
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [snapToGrid, setSnapToGrid] = useState(false);
    const [showGuides, setShowGuides] = useState(true);
    const [previewMode, setPreviewMode] = useState(false);

    // Undo/redo: a stack of full-layout snapshots for the CURRENT screen only —
    // switching screens resets it, since undo history spanning screens would be
    // confusing (and the snapshots are per-screen-shaped anyway).
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const canvasRef = useRef(null);
    const dragRef = useRef(null); // { index, startClientX, startClientY, startLeftPct, startTopPct }

    const refreshUndoRedoFlags = () => {
        setCanUndo(historyIndexRef.current > 0);
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    };

    const pushHistory = (snapshot) => {
        const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
        trimmed.push(snapshot);
        historyRef.current = trimmed;
        historyIndexRef.current = trimmed.length - 1;
        refreshUndoRedoFlags();
    };

    const loadScreen = useCallback(async (screenNum) => {
        setLoading(true);
        try {
            const res = await axiosAdmin.get(`/admin/element-positions/${gameKey}`);
            const layout = res.data[String(screenNum)] || [];
            setPositions(layout);
            historyRef.current = [layout];
            historyIndexRef.current = 0;
            refreshUndoRedoFlags();
        } catch (error) {
            console.error('Failed to load element positions:', error);
            setPositions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadScreen(selectedScreen); }, [selectedScreen, loadScreen]);

    const onPointerDownItem = (e, index) => {
        if (previewMode) return;
        e.preventDefault();
        const item = positions[index];
        dragRef.current = {
            index,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startLeftPct: item.leftPct,
            startTopPct: item.topPct,
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
        const drag = dragRef.current;
        const canvas = canvasRef.current;
        if (!drag || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
        const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;

        setPositions((prev) => {
            const next = [...prev];
            const item = { ...next[drag.index] };
            item.leftPct = clamp(drag.startLeftPct + dxPct, 0, 100 - item.sizePct);
            item.topPct = clamp(drag.startTopPct + dyPct, 0, 100 - item.sizePct);
            next[drag.index] = item;
            return next;
        });
    };

    const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        if (!dragRef.current) return;
        dragRef.current = null;

        setPositions((prev) => {
            let next = prev;
            if (snapToGrid) {
                next = prev.map((p) => ({
                    ...p,
                    leftPct: clamp(Math.round(p.leftPct / SNAP_STEP) * SNAP_STEP, 0, 100 - p.sizePct),
                    topPct: clamp(Math.round(p.topPct / SNAP_STEP) * SNAP_STEP, 0, 100 - p.sizePct),
                }));
            }
            pushHistory(next);
            return next;
        });
    };

    const undo = () => {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current -= 1;
        setPositions(historyRef.current[historyIndexRef.current]);
        refreshUndoRedoFlags();
    };

    const redo = () => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current += 1;
        setPositions(historyRef.current[historyIndexRef.current]);
        refreshUndoRedoFlags();
    };

    const save = async () => {
        setSaving(true);
        try {
            await axiosAdmin.put(`/admin/element-positions/${gameKey}/${selectedScreen}`, { positions });
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
        } catch (error) {
            console.error('Failed to save element positions:', error);
        } finally {
            setSaving(false);
        }
    };

    const resetToDefault = async () => {
        setSaving(true);
        try {
            const res = await axiosAdmin.post(`/admin/element-positions/${gameKey}/${selectedScreen}/reset`);
            setPositions(res.data.positions);
            pushHistory(res.data.positions);
        } catch (error) {
            console.error('Failed to reset element positions:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '24px' }}>
            {/* ── Screen list ─────────────────────────────────────────── */}
            <div style={{ width: '180px', flexShrink: 0 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase' }}>
                    Response Screens
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {screenNums.map((num) => (
                        <button
                            key={num}
                            onClick={() => setSelectedScreen(num)}
                            style={{
                                textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: 'none',
                                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                background: selectedScreen === num ? '#eef2ff' : 'transparent',
                                color: selectedScreen === num ? '#4338ca' : '#374151',
                            }}
                        >
                            Response {num}
                            <span style={{ marginLeft: '6px', color: '#9ca3af', fontWeight: 500 }}>({screenCounts[num]})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Editor ──────────────────────────────────────────────── */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                        Response {selectedScreen} — element layout
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.78rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
                            Guides
                        </label>
                        <label style={{ fontSize: '0.78rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
                            Snap to grid
                        </label>
                        <button onClick={() => setPreviewMode((p) => !p)} style={btnStyle(previewMode)}>
                            {previewMode ? '✓ Preview Mode' : 'Preview Mode'}
                        </button>
                        <button onClick={undo} disabled={!canUndo} style={btnStyle(false, !canUndo)}>↶ Undo</button>
                        <button onClick={redo} disabled={!canRedo} style={btnStyle(false, !canRedo)}>↷ Redo</button>
                        <button onClick={resetToDefault} disabled={saving} style={btnStyle(false, saving)}>Reset to Default</button>
                        <button onClick={save} disabled={saving} style={btnStyle(true, saving)}>{saving ? 'Saving…' : 'Save'}</button>
                        {saved && <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>✓ Saved</span>}
                    </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '14px', maxWidth: '780px' }}>
                    Drag any placeholder to reposition it. Positions are saved as percentages of the response-grid
                    area, so they hold up across slightly different device sizes. Screens 4-13 show generic
                    placeholders ("Item N") since their actual contents are drawn randomly each session — only the
                    slot positions are fixed, not which item lands in which slot.
                </div>

                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
                ) : (
                    <div
                        ref={canvasRef}
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '900px',
                            aspectRatio: `${aspectW} / ${aspectH}`,
                            background: '#fff',
                            border: '1.5px solid #e5e7eb',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                        }}
                    >
                        {showGuides && !previewMode && (
                            <>
                                <div style={guideLineStyle('33.33%', 'v')} />
                                <div style={guideLineStyle('66.66%', 'v')} />
                                <div style={guideLineStyle('33.33%', 'h')} />
                                <div style={guideLineStyle('66.66%', 'h')} />
                            </>
                        )}

                        {positions.map((p, i) => (
                            <div
                                key={i}
                                onPointerDown={(e) => onPointerDownItem(e, i)}
                                style={{
                                    position: 'absolute',
                                    left: `${p.leftPct}%`,
                                    top: `${p.topPct}%`,
                                    width: `${p.sizePct}%`,
                                    height: `${p.sizePct * (aspectW / aspectH)}%`,
                                    background: previewMode ? '#eef2ff' : '#e0e7ff',
                                    border: previewMode ? '1px solid #c7d2fe' : '1.5px dashed #6366f1',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: '#4338ca',
                                    cursor: previewMode ? 'default' : 'grab',
                                    userSelect: 'none',
                                    touchAction: 'none',
                                }}
                            >
                                {placeholderLabel(fixedScreenNames, selectedScreen, i)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const btnStyle = (primary, disabled) => ({
    padding: '8px 14px',
    borderRadius: '8px',
    border: primary ? 'none' : '1px solid #d1d5db',
    background: disabled ? '#f3f4f6' : primary ? '#4f46e5' : '#fff',
    color: disabled ? '#9ca3af' : primary ? '#fff' : '#374151',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
});

const guideLineStyle = (pos, axis) => axis === 'v'
    ? { position: 'absolute', left: pos, top: 0, bottom: 0, width: '1px', background: 'rgba(99,102,241,0.25)' }
    : { position: 'absolute', top: pos, left: 0, right: 0, height: '1px', background: 'rgba(99,102,241,0.25)' };

export default AdminElementPositionManager;
