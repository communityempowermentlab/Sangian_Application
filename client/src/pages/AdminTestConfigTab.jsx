import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';

const CATEGORY_COLORS = {
    'Memory Test':     { bg: '#eef2ff', text: '#4338ca' },
    'Cognitive Test':  { bg: '#ecfdf5', text: '#047857' },
    'Attention Test':  { bg: '#fef3c7', text: '#92400e' },
    'Academic Test':   { bg: '#fae8ff', text: '#a21caf' },
};

const ToggleSwitch = ({ checked, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        style={{
            width: '40px', height: '22px', borderRadius: '999px', border: 'none', cursor: 'pointer',
            background: checked ? '#4f46e5' : '#d1d5db', position: 'relative', transition: 'background 0.15s',
            opacity: disabled ? 0.6 : 1,
        }}
    >
        <span style={{
            position: 'absolute', top: '2px', left: checked ? '20px' : '2px',
            width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
            transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }} />
    </button>
);

// ── Sub-section: Test Visibility (enable/disable individual games) ──────────────
const TestVisibilityPanel = () => {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState(null);
    const [savedKey, setSavedKey] = useState(null);
    const [orderSaved, setOrderSaved] = useState(false);

    const dragItem = React.useRef(null);
    const dragOverItem = React.useRef(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axiosAdmin.get('/admin/test-config');
            setTests(res.data.tests);
        } catch (error) {
            console.error('Failed to load test configuration:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggle = async (key, currentEnabled) => {
        setSavingKey(key);
        const next = !currentEnabled;
        try {
            await axiosAdmin.put(`/admin/test-config/${key}`, { enabled: next });
            setTests((prev) => prev.map((t) => (t.key === key ? { ...t, enabled: next } : t)));
            setSavedKey(key);
            setTimeout(() => setSavedKey(null), 1800);
        } catch (error) {
            console.error('Failed to update test configuration:', error);
        } finally {
            setSavingKey(null);
        }
    };

    const handleSort = async () => {
        const _tests = [...tests];
        const draggedItemContent = _tests.splice(dragItem.current, 1)[0];
        _tests.splice(dragOverItem.current, 0, draggedItemContent);
        
        dragItem.current = null;
        dragOverItem.current = null;
        
        setTests(_tests);
        
        try {
            const orderedKeys = _tests.map(t => t.key);
            await axiosAdmin.put('/admin/test-config/order', { orderedKeys });
            setOrderSaved(true);
            setTimeout(() => setOrderSaved(false), 2000);
        } catch (error) {
            console.error('Failed to update order:', error);
        }
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    }

    return (
        <div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '10px', maxWidth: '640px' }}>
                Enable or disable any test/game on the front-end without a deployment. Disabled tests are hidden
                from the dashboard and game list, and direct links to them redirect users back to the home page.
                Newly added games appear here automatically, enabled by default.
            </div>
            
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px', maxWidth: '640px' }}>
                <strong>Tip:</strong> You can drag and drop the rows to reorder how tests are displayed on the front-end.
            </div>
            
            {orderSaved && (
                <div style={{ marginBottom: '15px', color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>
                    ✓ Test display sequence updated successfully.
                </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                    <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '10px 12px', width: '40px' }}></th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Test Name</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Category</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700 }}>Enable / Disable</th>
                    </tr>
                </thead>
                <tbody>
                    {tests.map((test, index) => {
                        const cat = CATEGORY_COLORS[test.category] || { bg: '#f1f5f9', text: '#475569' };
                        return (
                            <tr 
                                key={test.key} 
                                style={{ borderTop: '1px solid #f3f4f6', cursor: 'grab', background: '#fff' }}
                                draggable
                                onDragStart={(e) => {
                                    dragItem.current = index;
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragEnter={(e) => {
                                    dragOverItem.current = index;
                                }}
                                onDragEnd={handleSort}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                <td style={{ padding: '10px 12px', color: '#9ca3af', cursor: 'grab', textAlign: 'center' }}>
                                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>≡</span>
                                </td>
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{test.title}</td>
                                <td style={{ padding: '10px 12px' }}>
                                    <span style={{ background: cat.bg, color: cat.text, padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                                        {test.category}
                                    </span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    <span style={{
                                        padding: '3px 12px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700,
                                        background: test.enabled ? '#f0fdf4' : '#fef2f2',
                                        color: test.enabled ? '#16a34a' : '#dc2626',
                                    }}>
                                        {test.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        <ToggleSwitch checked={test.enabled} disabled={savingKey === test.key} onClick={() => toggle(test.key, test.enabled)} />
                                        {savedKey === test.key && <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>✓ Updated</span>}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ── Sub-section: Global Header Configuration (Child ID / Timer / Score) ─────────
const HEADER_FIELDS = [
    { key: 'showLogo',     label: 'Logo',             example: 'CEL, ICMR logos' },
    { key: 'showGameIcon', label: 'Game Icon',        example: 'Game icon (e.g. Bagiya icon)' },
    { key: 'showGameName', label: 'Game Name',        example: 'Bagiya' },
    { key: 'showChildId',  label: 'Display Child ID', example: 'Child ID: CH-1025' },
    { key: 'showTimer',    label: 'Display Timer',    example: 'Time: 02:35' },
    { key: 'showScore',    label: 'Display Score',    example: 'Score: 15' },
];

const GlobalHeaderConfigPanel = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState(null);
    const [savedKey, setSavedKey] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axiosAdmin.get('/admin/header-config');
            setConfig(res.data);
        } catch (error) {
            console.error('Failed to load header configuration:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggle = async (key) => {
        const next = !config[key];
        setSavingKey(key);
        try {
            const res = await axiosAdmin.put('/admin/header-config', { [key]: next });
            setConfig(res.data.config);
            setSavedKey(key);
            setTimeout(() => setSavedKey(null), 1800);
        } catch (error) {
            console.error('Failed to update header configuration:', error);
        } finally {
            setSavingKey(null);
        }
    };

    if (loading || !config) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    }

    return (
        <div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px', maxWidth: '640px' }}>
                These settings are applied automatically to the header of every test — current and future — instead
                of configuring each one individually.
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', maxWidth: '560px' }}>
                <thead>
                    <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Configuration</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Example</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700 }}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {HEADER_FIELDS.map((field) => (
                        <tr key={field.key} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{field.label}</td>
                            <td style={{ padding: '10px 12px', color: '#6b7280', fontFamily: 'monospace', fontSize: '0.8rem' }}>{field.example}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <ToggleSwitch checked={config[field.key]} disabled={savingKey === field.key} onClick={() => toggle(field.key)} />
                                    {savedKey === field.key && <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>✓ Configuration Updated</span>}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── Sub-section: Response Completion Requirement (navigation-only — never affects scoring) ──
const RESPONSE_MATCHING_OPTIONS = [
    {
        value: 'exact',
        label: 'Complete Response Required (Default)',
        desc: 'The question button only becomes active once the response length matches the question length. Current behaviour.',
    },
    {
        value: 'partial',
        label: 'Partial Response Allowed',
        desc: 'The question button becomes active as soon as at least one response item is entered, so the user can move on without completing every item. This only controls when the user may proceed — correctness is always judged by a full exact match, regardless of this setting.',
    },
];

const ResponseMatchingPanel = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axiosAdmin.get('/admin/response-matching-config');
            setConfig(res.data);
        } catch (error) {
            console.error('Failed to load response matching configuration:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const selectMode = async (mode) => {
        if (config?.responseMatchingMode === mode) return;
        setSaving(true);
        try {
            const res = await axiosAdmin.put('/admin/response-matching-config', { responseMatchingMode: mode });
            setConfig(res.data.config);
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
        } catch (error) {
            console.error('Failed to update response matching configuration:', error);
        } finally {
            setSaving(false);
        }
    };

    const toggleDisplayUserInputString = async () => {
        setSaving(true);
        try {
            const res = await axiosAdmin.put('/admin/response-matching-config', { displayUserInputString: !config.displayUserInputString });
            setConfig(res.data.config);
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
        } catch (error) {
            console.error('Failed to update display user input string configuration:', error);
        } finally {
            setSaving(false);
        }
    };

    const toggleHerPherPractice = async () => {
        setSaving(true);
        try {
            const res = await axiosAdmin.put('/admin/response-matching-config', { displayHerPherPractice: !config.displayHerPherPractice });
            setConfig(res.data.config);
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
        } catch (error) {
            console.error('Failed to update Her Pher practice configuration:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading || !config) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    }

    return (
        <div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px', maxWidth: '640px' }}>
                Controls only when the question button becomes active to proceed, across memory-based tests
                (e.g. Lottery Ka Ticket). It never changes how a response is scored — correctness always
                requires a full exact match (same items, same order, same count). This is a global,
                framework-level setting — any current or future game built against it follows the same rule
                without code changes.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '640px' }}>
                {RESPONSE_MATCHING_OPTIONS.map((opt) => {
                    const active = config.responseMatchingMode === opt.value;
                    return (
                        <label
                            key={opt.value}
                            style={{
                                display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 16px',
                                border: `1.5px solid ${active ? '#4f46e5' : '#e5e7eb'}`,
                                background: active ? '#eef2ff' : '#fff',
                                borderRadius: '10px', cursor: saving ? 'not-allowed' : 'pointer',
                            }}
                        >
                            <input
                                type="radio"
                                name="responseMatchingMode"
                                checked={active}
                                disabled={saving}
                                onChange={() => selectMode(opt.value)}
                                style={{ marginTop: '3px' }}
                            />
                            <div>
                                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem' }}>{opt.label}</div>
                                <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '2px' }}>{opt.desc}</div>
                            </div>
                        </label>
                    );
                })}
            </div>
            
            <div style={{ marginTop: '30px', fontSize: '0.85rem', color: '#6b7280', maxWidth: '640px' }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem', marginBottom: '8px' }}>
                    Display User Input String
                </div>
                Controls whether the sequence of numbers entered by the user is visibly displayed on the screen during the assessment.
            </div>

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ToggleSwitch 
                    checked={!!config.displayUserInputString} 
                    disabled={saving} 
                    onClick={toggleDisplayUserInputString} 
                />
                <span 
                    onClick={saving ? undefined : toggleDisplayUserInputString}
                    style={{ fontSize: '0.88rem', fontWeight: 600, color: config.displayUserInputString ? '#111827' : '#6b7280', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none' }}
                >
                    {config.displayUserInputString ? 'Yes, display entered numbers' : 'No, hide entered numbers'}
                </span>
            </div>

            <div style={{ marginTop: '30px', fontSize: '0.85rem', color: '#6b7280', maxWidth: '640px' }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem', marginBottom: '8px' }}>
                    Display Practice Questions
                </div>
                Controls whether practice questions are displayed for the Her Pher game before the actual assessment starts.
            </div>

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ToggleSwitch 
                    checked={!!config.displayHerPherPractice} 
                    disabled={saving} 
                    onClick={toggleHerPherPractice} 
                />
                <span 
                    onClick={saving ? undefined : toggleHerPherPractice}
                    style={{ fontSize: '0.88rem', fontWeight: 600, color: config.displayHerPherPractice ? '#111827' : '#6b7280', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none' }}
                >
                    {config.displayHerPherPractice ? 'ON - Practice questions are displayed' : 'OFF - Practice questions are skipped'}
                </span>
            </div>

            {saved && <div style={{ marginTop: '16px', fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>✓ Configuration Updated</div>}
        </div>
    );
};

// ── Sub-section: Analysis Dashboard (feature toggles for /admin/analysis) ───────
const AnalysisSettingsPanel = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedKey, setSavedKey] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axiosAdmin.get('/admin/analysis-settings');
            setConfig(res.data);
        } catch (error) {
            console.error('Failed to load analysis settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggleExcelExport = async () => {
        setSaving(true);
        try {
            const res = await axiosAdmin.put('/admin/analysis-settings', { topChildrenExcelExport: !config.topChildrenExcelExport });
            setConfig(res.data.config);
            setSavedKey('excel');
            setTimeout(() => setSavedKey(null), 1800);
        } catch (error) {
            console.error('Failed to update analysis settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const toggleKpiInfoIcon = async () => {
        setSaving(true);
        try {
            const res = await axiosAdmin.put('/admin/analysis-settings', { showKpiInfoIcon: !config.showKpiInfoIcon });
            setConfig(res.data.config);
            setSavedKey('kpi');
            setTimeout(() => setSavedKey(null), 1800);
        } catch (error) {
            console.error('Failed to update analysis settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const toggleGameCsvExport = async () => {
        setSaving(true);
        try {
            const res = await axiosAdmin.put('/admin/analysis-settings', { gameCsvExport: !config.gameCsvExport });
            setConfig(res.data.config);
            setSavedKey('csv');
            setTimeout(() => setSavedKey(null), 1800);
        } catch (error) {
            console.error('Failed to update analysis settings:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading || !config) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    }

    return (
        <div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px', maxWidth: '640px' }}>
                Feature toggles for the Analysis dashboard (<code>/admin/analysis</code>).
            </div>

            <div style={{ maxWidth: '640px' }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem', marginBottom: '4px' }}>
                    Excel Download — Top Active Children
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '12px' }}>
                    When ON, the "Export Excel" button appears above the Top Active Children table on the Analysis
                    dashboard, letting admins download it (plus a session-wise breakdown) as an .xlsx file.
                    When OFF, the button is hidden entirely.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ToggleSwitch checked={!!config.topChildrenExcelExport} disabled={saving} onClick={toggleExcelExport} />
                    <span
                        onClick={saving ? undefined : toggleExcelExport}
                        style={{ fontSize: '0.88rem', fontWeight: 600, color: config.topChildrenExcelExport ? '#111827' : '#6b7280', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none' }}
                    >
                        {config.topChildrenExcelExport ? 'ON — Export Excel button is visible' : 'OFF — Export Excel button is hidden'}
                    </span>
                    {savedKey === 'excel' && <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>✓ Updated</span>}
                </div>
            </div>

            <div style={{ maxWidth: '640px', marginTop: '30px' }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem', marginBottom: '4px' }}>
                    Show KPI Information Icon
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '12px' }}>
                    When ON, a settings/information (⚙️) icon appears next to every important KPI, metric, and calculated value on the Analysis dashboard. Clicking it shows a detailed explanation of how that value is calculated.
                    When OFF, these icons are hidden.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ToggleSwitch checked={!!config.showKpiInfoIcon} disabled={saving} onClick={toggleKpiInfoIcon} />
                    <span
                        onClick={saving ? undefined : toggleKpiInfoIcon}
                        style={{ fontSize: '0.88rem', fontWeight: 600, color: config.showKpiInfoIcon ? '#111827' : '#6b7280', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none' }}
                    >
                        {config.showKpiInfoIcon ? 'ON — Info icons are visible' : 'OFF — Info icons are hidden'}
                    </span>
                    {savedKey === 'kpi' && <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>✓ Updated</span>}
                </div>
            </div>

            <div style={{ maxWidth: '640px', marginTop: '30px' }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem', marginBottom: '4px' }}>
                    CSV Download — Test Sessions
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '12px' }}>
                    When ON, the "Export CSV" button appears above the Recent Sessions table on every individual
                    test's Analysis page, letting admins download its session data as a .csv file.
                    When OFF, the button is hidden on every test.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ToggleSwitch checked={!!config.gameCsvExport} disabled={saving} onClick={toggleGameCsvExport} />
                    <span
                        onClick={saving ? undefined : toggleGameCsvExport}
                        style={{ fontSize: '0.88rem', fontWeight: 600, color: config.gameCsvExport ? '#111827' : '#6b7280', cursor: saving ? 'not-allowed' : 'pointer', userSelect: 'none' }}
                    >
                        {config.gameCsvExport ? 'ON — Export CSV button is visible' : 'OFF — Export CSV button is hidden'}
                    </span>
                    {savedKey === 'csv' && <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>✓ Updated</span>}
                </div>
            </div>
        </div>
    );
};

// ── Sub-section: Test Groups (named presets of tests, used as quick Test-filter
// shortcuts on the Analysis dashboard — e.g. "Group 1" = 5 tests, "Group 2" = 9) ──
const emptyForm = { name: '', gameKeys: [] };

const TestGroupsPanel = () => {
    const [tests, setTests]   = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null); // null = not editing, 'new' = creating
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const [testsRes, groupsRes] = await Promise.all([
                axiosAdmin.get('/admin/test-config'),
                axiosAdmin.get('/admin/test-groups'),
            ]);
            setTests(testsRes.data.tests || []);
            setGroups(groupsRes.data.groups || []);
        } catch (error) {
            console.error('Failed to load test groups:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const startCreate = () => { setEditingId('new'); setForm(emptyForm); setError(null); };
    const startEdit = (group) => { setEditingId(group.id); setForm({ name: group.name, gameKeys: [...group.gameKeys] }); setError(null); };
    const cancelEdit = () => { setEditingId(null); setForm(emptyForm); setError(null); };

    const toggleKey = (key) => {
        setForm((f) => ({
            ...f,
            gameKeys: f.gameKeys.includes(key) ? f.gameKeys.filter((k) => k !== key) : [...f.gameKeys, key],
        }));
    };

    const save = async () => {
        if (!form.name.trim()) { setError('Group name is required.'); return; }
        if (form.gameKeys.length === 0) { setError('Select at least one test.'); return; }
        setSaving(true);
        setError(null);
        try {
            if (editingId === 'new') {
                const res = await axiosAdmin.post('/admin/test-groups', form);
                setGroups((prev) => [...prev, res.data.group]);
            } else {
                const res = await axiosAdmin.put(`/admin/test-groups/${editingId}`, form);
                setGroups((prev) => prev.map((g) => (g.id === editingId ? res.data.group : g)));
            }
            cancelEdit();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save test group.');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id) => {
        if (!window.confirm('Delete this test group? This only removes the preset — it does not affect any test data.')) return;
        setDeletingId(id);
        try {
            await axiosAdmin.delete(`/admin/test-groups/${id}`);
            setGroups((prev) => prev.filter((g) => g.id !== id));
        } catch (err) {
            console.error('Failed to delete test group:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const titleFor = (key) => tests.find((t) => t.key === key)?.title || key;

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    }

    return (
        <div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px', maxWidth: '640px' }}>
                Named presets of tests — e.g. "Group 1" for a 5-test rollout, "Group 2" for the full 9-test set.
                They appear as one-click shortcuts on the Test filter of the Analysis dashboard (<code>/admin/analysis</code>),
                so admins don't have to re-select the same tests every time.
            </div>

            {editingId === null && (
                <button
                    onClick={startCreate}
                    style={{
                        marginBottom: '18px', padding: '9px 16px', borderRadius: '8px', border: 'none',
                        background: '#4f46e5', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                    }}
                >
                    + Add Test Group
                </button>
            )}

            {editingId !== null && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '18px', marginBottom: '20px', maxWidth: '640px', background: '#f9fafb' }}>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.88rem', marginBottom: '10px' }}>
                        {editingId === 'new' ? 'New Test Group' : 'Edit Test Group'}
                    </div>
                    <input
                        type="text"
                        placeholder="Group name (e.g. Group 1)"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem', marginBottom: '14px', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 700, marginBottom: '8px' }}>
                        TESTS IN THIS GROUP ({form.gameKeys.length} selected)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px', marginBottom: '14px' }}>
                        {tests.map((t) => (
                            <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.83rem', color: '#111827', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px' }}>
                                <input type="checkbox" checked={form.gameKeys.includes(t.key)} onChange={() => toggleKey(t.key)} />
                                {t.title}
                            </label>
                        ))}
                    </div>
                    {error && <div style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, marginBottom: '10px' }}>{error}</div>}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={save}
                            disabled={saving}
                            style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '0.83rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                        >
                            {saving ? 'Saving…' : 'Save Group'}
                        </button>
                        <button
                            onClick={cancelEdit}
                            disabled={saving}
                            style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {groups.length === 0 && editingId === null && (
                <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No test groups yet — add one to create quick filter presets.</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '760px' }}>
                {groups.map((g) => (
                    <div key={g.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
                                {g.name} <span style={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.78rem' }}>({g.gameKeys.length} tests)</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => startEdit(g)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                                <button
                                    onClick={() => remove(g.id)}
                                    disabled={deletingId === g.id}
                                    style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    {deletingId === g.id ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {g.gameKeys.map((key) => (
                                <span key={key} style={{ background: '#eef2ff', color: '#4338ca', padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                                    {titleFor(key)}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Sub-section: Individual User Test Settings (global ON/OFF per test,
// applied to every Individual User platform-wide) — a separate, independent
// access-control layer from Organization-wise Test Assignment
// (AdminOrganizationDetail.jsx's Assigned Tests tab, per-organization).
// Enforced server-side in gameController.js's startGameSession regardless
// of this toggle's state; this UI only edits the setting. ───────────────
const IndividualUserTestAccessPanel = () => {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState(null);
    const [savedKey, setSavedKey] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await axiosAdmin.get('/admin/individual-test-access');
            setTests(res.data.tests || []);
        } catch (error) {
            console.error('Failed to load Individual User test access:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggle = async (key, currentAccess) => {
        setSavingKey(key);
        const next = !currentAccess;
        try {
            await axiosAdmin.put(`/admin/individual-test-access/${key}`, { allowed: next });
            setTests((prev) => prev.map((t) => (t.key === key ? { ...t, individualAccess: next } : t)));
            setSavedKey(key);
            setTimeout(() => setSavedKey(null), 1800);
        } catch (error) {
            console.error('Failed to update Individual User test access:', error);
        } finally {
            setSavingKey(null);
        }
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    }

    return (
        <div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px', maxWidth: '640px' }}>
                Controls which active tests are available to <strong>Individual Users</strong> platform-wide — completely
                separate from Organization-wise Test Assignment. Turning a test OFF here blocks every Individual User
                from starting it (both here on the front-end and at the API level); the test card still shows, but
                starting it displays a message instead of the game.
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', maxWidth: '760px' }}>
                <thead>
                    <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Test</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Category</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700 }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700 }}>Individual User Access</th>
                    </tr>
                </thead>
                <tbody>
                    {tests.map((test) => {
                        const cat = CATEGORY_COLORS[test.category] || { bg: '#f1f5f9', text: '#475569' };
                        return (
                            <tr key={test.key} style={{ borderTop: '1px solid #f3f4f6', background: '#fff' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{test.title}</td>
                                <td style={{ padding: '10px 12px' }}>
                                    <span style={{ background: cat.bg, color: cat.text, padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                                        {test.category}
                                    </span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    <span style={{ padding: '3px 12px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: '#f0fdf4', color: '#16a34a' }}>
                                        Active
                                    </span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                        <ToggleSwitch checked={test.individualAccess} disabled={savingKey === test.key} onClick={() => toggle(test.key, test.individualAccess)} />
                                        {savedKey === test.key && <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>✓ Updated</span>}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {tests.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No active tests.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

// ── Main: Test Configuration (Test Visibility + Global Header Configuration) ────
const TEST_CONFIG_SUBSECTIONS = [
    { key: 'visibility', label: 'Test Visibility',             icon: '🎮' },
    { key: 'header',     label: 'Global Header Configuration', icon: '🧾' },
    { key: 'matching',   label: 'Response Completion Requirement', icon: '🎯' },
    { key: 'analysis',   label: 'Analysis Dashboard',          icon: '📊' },
    { key: 'groups',     label: 'Test Groups',                 icon: '🗂️' },
    { key: 'individual', label: 'Individual User Test Settings', icon: '🧑' },
];

const SUBSECTION_PANELS = {
    visibility: TestVisibilityPanel,
    header:     GlobalHeaderConfigPanel,
    matching:   ResponseMatchingPanel,
    analysis:   AnalysisSettingsPanel,
    groups:     TestGroupsPanel,
    individual: IndividualUserTestAccessPanel,
};

const AdminTestConfigTab = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const active = searchParams.get('sub') || 'visibility';
    const ActivePanel = SUBSECTION_PANELS[active] || SUBSECTION_PANELS.visibility;

    const setActive = (key) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('sub', key);
            return next;
        });
    };

    return (
        <div style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
                {TEST_CONFIG_SUBSECTIONS.map((s) => (
                    <button
                        key={s.key}
                        onClick={() => setActive(s.key)}
                        style={{
                            padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: 700,
                            color: active === s.key ? '#4f46e5' : '#6b7280',
                            borderBottom: active === s.key ? '2px solid #4f46e5' : '2px solid transparent',
                        }}
                    >
                        {s.icon} {s.label}
                    </button>
                ))}
            </div>

            <ActivePanel />
        </div>
    );
};

export default AdminTestConfigTab;
