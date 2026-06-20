import React, { useState, useEffect, useCallback, useRef } from 'react';
import axiosAdmin from '../services/axiosAdmin';

const SECTION_LABELS = {
    common: 'Application',
    navbar: 'Navbar',
    footer: 'Footer',
    breadcrumb: 'Breadcrumb',
    home: 'Dashboard',
    login: 'Login',
    register: 'Registration',
    modal: 'Modal',
    help: 'Help & Support',
};

const Cell = ({ row, langCode, onSave }) => {
    const [value, setValue] = useState(row.values[langCode] ?? '');
    const [status, setStatus] = useState(''); // '', 'saving', 'saved'
    const savedTimer = useRef(null);

    useEffect(() => {
        setValue(row.values[langCode] ?? '');
    }, [row.values, langCode]);

    const commit = async () => {
        if (value === (row.values[langCode] ?? '')) return;
        setStatus('saving');
        try {
            await onSave(langCode, row.key, value);
            setStatus('saved');
            clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setStatus(''), 1500);
        } catch {
            setStatus('error');
        }
    };

    return (
        <td style={{ padding: '6px 8px', verticalAlign: 'top', minWidth: '220px' }}>
            <div style={{ position: 'relative' }}>
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    rows={2}
                    style={{
                        width: '100%', resize: 'vertical', padding: '6px 8px', borderRadius: '6px',
                        border: '1px solid #e5e7eb', fontSize: '0.82rem', fontFamily: 'inherit',
                        color: '#1f2937', boxSizing: 'border-box',
                    }}
                />
                {status === 'saving' && <span style={{ position: 'absolute', top: 2, right: 6, fontSize: '0.65rem', color: '#9ca3af' }}>Saving…</span>}
                {status === 'saved'  && <span style={{ position: 'absolute', top: 2, right: 6, fontSize: '0.65rem', color: '#16a34a', fontWeight: 700 }}>✓ Saved</span>}
                {status === 'error'  && <span style={{ position: 'absolute', top: 2, right: 6, fontSize: '0.65rem', color: '#dc2626', fontWeight: 700 }}>✕ Failed</span>}
            </div>
        </td>
    );
};

const AdminMultilingual = () => {
    const [sections, setSections] = useState([]);
    const [sectionLabels, setSectionLabels] = useState({});
    const [languages, setLanguages] = useState([]);
    const [rows, setRows] = useState([]);
    const [activeSection, setActiveSection] = useState('');
    const [search, setSearch] = useState('');
    const [languageFilter, setLanguageFilter] = useState('all'); // 'all' or a language code
    const [loading, setLoading] = useState(true);

    const sectionLabel = (key) => SECTION_LABELS[key] || sectionLabels[key] || (key.charAt(0).toUpperCase() + key.slice(1));

    const load = useCallback(async (section, searchTerm) => {
        setLoading(true);
        try {
            const params = {};
            if (section) params.section = section;
            if (searchTerm) params.search = searchTerm;
            const res = await axiosAdmin.get('/admin/translations', { params });
            setRows(res.data.rows);
            setSections(res.data.sections);
            setSectionLabels(res.data.sectionLabels || {});
            setLanguages(res.data.languages);
        } catch (error) {
            console.error('Failed to load translations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(activeSection, search); }, [activeSection, search, load]);

    const handleSave = async (langCode, key, value) => {
        await axiosAdmin.put('/admin/translations/cell', { language: langCode, key, value });
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, values: { ...r.values, [langCode]: value } } : r)));
    };

    const visibleLanguages = languageFilter === 'all' ? languages : languages.filter((l) => l.code === languageFilter);

    return (
        <main className="admin-content" aria-label="Multilingual Content Management">
            <div className="admin-card w12" style={{ display: 'flex', gap: '16px', minHeight: '70vh' }}>

                {/* Section sidebar */}
                <div style={{ width: '200px', minWidth: '200px', borderRight: '1px solid #e5e7eb', paddingRight: '12px' }}>
                    <h3 style={{ fontSize: '15px', margin: '0 0 12px 0' }}>🌐 Sections</h3>
                    <button
                        onClick={() => setActiveSection('')}
                        style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: '4px',
                            borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: activeSection === '' ? '#eef2ff' : 'transparent',
                            color: activeSection === '' ? '#4f46e5' : '#374151',
                            fontWeight: activeSection === '' ? 700 : 500, fontSize: '0.85rem',
                        }}
                    >
                        All Sections
                    </button>
                    {sections.map((s) => (
                        <button
                            key={s}
                            onClick={() => setActiveSection(s)}
                            style={{
                                display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: '4px',
                                borderRadius: '6px', border: 'none', cursor: 'pointer',
                                background: activeSection === s ? '#eef2ff' : 'transparent',
                                color: activeSection === s ? '#4f46e5' : '#374151',
                                fontWeight: activeSection === s ? 700 : 500, fontSize: '0.85rem',
                            }}
                        >
                            {sectionLabel(s)}
                        </button>
                    ))}
                </div>

                {/* Grid */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '18px', margin: 0 }}>Multilingual Content {activeSection && `· ${sectionLabel(activeSection)}`}</h3>
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{rows.length} keys</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                            <input
                                type="search"
                                placeholder="Search Key / Text..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.82rem', minWidth: '220px' }}
                            />
                            <select
                                value={languageFilter}
                                onChange={(e) => setLanguageFilter(e.target.value)}
                                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.82rem' }}
                            >
                                <option value="all">All Languages</option>
                                {languages.map((l) => (
                                    <option key={l.code} value={l.code}>{l.label} Only</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280', minWidth: '200px' }}>Key</th>
                                    {visibleLanguages.map((l) => (
                                        <th key={l.code} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280' }}>
                                            {l.label}{!l.enabled && <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#d97706' }}>(disabled)</span>}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={visibleLanguages.length + 1} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading…</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={visibleLanguages.length + 1} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No matching content.</td></tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr key={row.key} style={{ borderTop: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.76rem', color: '#374151', verticalAlign: 'top' }}>{row.key}</td>
                                            {visibleLanguages.map((l) => (
                                                <Cell key={l.code} row={row} langCode={l.code} onSave={handleSave} />
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default AdminMultilingual;
