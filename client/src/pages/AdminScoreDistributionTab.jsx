import React, { useState, useEffect } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { ToggleSwitch } from './AdminTestConfigTab';

// Mirrors scoreBinSettingsService.buildWidthBuckets + analysisController's
// bucket labels, so the preview shows unsaved edits exactly as the Analysis
// dashboards will render them once saved.
const previewBins = (maxScore, binWidth, separateZero) => {
    const bins = separateZero ? ['0'] : [];
    for (let lo = separateZero ? 1 : 0; lo <= maxScore; lo += binWidth) {
        const hi = Math.min(lo + binWidth - 1, maxScore);
        bins.push(lo === hi ? `${lo}` : `${lo}-${hi}`);
        if (hi >= maxScore) break;
    }
    return bins;
};

const BinChips = ({ bins, muted }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {bins.map(b => (
            <span key={b} style={{
                padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                background: muted ? '#f3f4f6' : '#eef2ff', color: muted ? '#6b7280' : '#4338ca',
            }}>{b}</span>
        ))}
    </div>
);

const GameBinRow = ({ game, maxBins, onSaved }) => {
    const [width, setWidth] = useState(game.binWidth ?? '');
    const [separateZero, setSeparateZero] = useState(game.separateZero);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setWidth(game.binWidth ?? '');
        setSeparateZero(game.separateZero);
    }, [game.binWidth, game.separateZero]);

    const widthNum = Number(width);
    const hasWidth = width !== '' && width !== null;
    const widthValid = hasWidth && Number.isInteger(widthNum) && widthNum >= 1 && widthNum <= game.maxScore;
    const bins = widthValid ? previewBins(game.maxScore, widthNum, separateZero) : null;
    const tooMany = bins && bins.length > maxBins;

    const validationMsg = !hasWidth ? null
        : !widthValid ? `Enter a whole number from 1 to ${game.maxScore}.`
        : tooMany ? `${bins.length} bars — the limit is ${maxBins}. Use a larger width.`
        : null;

    const dirty = hasWidth
        ? (widthNum !== game.binWidth || separateZero !== game.separateZero)
        : game.binWidth !== null;

    const save = async (payload) => {
        setSaving(true);
        setError(null);
        try {
            const res = await axiosAdmin.put(`/admin/score-bin-settings/${game.key}`, payload);
            onSaved(res.data.game);
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const onSave = () => save(hasWidth ? { binWidth: widthNum, separateZero } : { binWidth: null });
    const onReset = () => save({ binWidth: null });

    return (
        <div style={{ padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem' }}>{game.title}</span>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>Max score {game.maxScore}</span>
                {game.binWidth === null
                    ? <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '1px 8px', borderRadius: '999px' }}>Default bins</span>
                    : <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4338ca', background: '#eef2ff', padding: '1px 8px', borderRadius: '999px' }}>Width {game.binWidth}</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>
                    Bin width
                    <input
                        type="number" min="1" max={game.maxScore} step="1"
                        value={width}
                        placeholder="Default"
                        onChange={e => setWidth(e.target.value)}
                        style={{ width: '80px', padding: '6px 8px', border: `1px solid ${validationMsg ? '#fca5a5' : '#d1d5db'}`, borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: hasWidth ? 1 : 0.5 }}>
                    <ToggleSwitch checked={separateZero} disabled={!hasWidth || saving} onClick={() => setSeparateZero(v => !v)} />
                    <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 600 }}>Show 0 as separate bar</span>
                </div>

                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || !dirty || !!validationMsg}
                    style={{
                        padding: '6px 16px', borderRadius: '6px', border: 'none', fontSize: '0.8rem', fontWeight: 700,
                        background: '#4f46e5', color: '#fff',
                        cursor: saving || !dirty || validationMsg ? 'not-allowed' : 'pointer',
                        opacity: saving || !dirty || validationMsg ? 0.5 : 1,
                    }}
                >
                    {saving ? 'Saving…' : 'Save'}
                </button>

                {game.binWidth !== null && (
                    <button
                        type="button"
                        onClick={onReset}
                        disabled={saving}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                    >
                        Reset to default
                    </button>
                )}

                {saved && <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>✓ Updated</span>}
            </div>

            {(validationMsg || error) && (
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>{validationMsg || error}</div>
            )}

            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px 10px', alignItems: 'center' }}>
                {bins && !tooMany && dirty && (
                    <>
                        <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>Preview</span>
                        <BinChips bins={bins} />
                    </>
                )}
                <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>{game.binWidth === null ? 'Current' : 'Saved'}</span>
                <BinChips bins={game.currentBins} muted={dirty} />
                {game.binWidth !== null && (
                    <>
                        <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>Default</span>
                        <BinChips bins={game.defaultBins} muted />
                    </>
                )}
            </div>
        </div>
    );
};

const AdminScoreDistributionTab = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [showOthers, setShowOthers] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await axiosAdmin.get('/admin/score-bin-settings');
                setData(res.data);
            } catch (error) {
                console.error('Failed to load score distribution settings:', error);
                setLoadError('Failed to load score distribution settings.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const onSaved = (game) => setData(d => ({ ...d, games: d.games.map(g => g.key === game.key ? game : g) }));

    if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    if (loadError || !data) return <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>{loadError}</div>;

    const inUse  = data.games.filter(g => g.enabled);
    const others = data.games.filter(g => !g.enabled);

    return (
        <div style={{ padding: '24px 28px', maxWidth: '820px' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '8px' }}>
                Set the bin width for each test's Score Distribution chart. A width of 5 means each bar covers
                5 score points (0–4, 5–9, 10–14, …); the last bar ends at the test's max score.
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '20px' }}>
                Applies to the test's own Analysis page and to Overall V2 → Test-wise Performance Analysis
                (including its detail popup). Leave a test empty to keep its default bins. Padh ke Batao and
                Ankganit use reading/number levels, so they aren't listed here.
            </div>

            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase' }}>
                Tests in use
            </div>
            {inUse.length === 0
                ? <div style={{ padding: '16px 0', fontSize: '0.8rem', color: '#9ca3af' }}>No configurable tests are currently enabled.</div>
                : inUse.map(g => <GameBinRow key={g.key} game={g} maxBins={data.maxBins} onSaved={onSaved} />)}

            {others.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                    <button
                        type="button"
                        onClick={() => setShowOthers(v => !v)}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase' }}
                    >
                        {showOthers ? '▾' : '▸'} Older versions / not in use ({others.length})
                    </button>
                    {showOthers && others.map(g => <GameBinRow key={g.key} game={g} maxBins={data.maxBins} onSaved={onSaved} />)}
                </div>
            )}
        </div>
    );
};

export default AdminScoreDistributionTab;
