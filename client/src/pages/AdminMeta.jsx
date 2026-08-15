import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { useAdminNotification } from '../contexts/AdminNotificationContext';
import './AdminMeta.css';

const SIDEBAR_ITEMS = [
    {
        group: 'Analytics',
        items: [
            { key: 'analysis', icon: '📊', label: 'Analysis', type: 'placeholder' },
        ],
    },
    {
        group: 'Documents',
        items: [
            { key: 'terms',   icon: '📄', label: 'Terms & Conditions', type: 'cms'     },
            { key: 'privacy', icon: '🔒', label: 'Privacy Policy',      type: 'cms'     },
            { key: 'contact', icon: '📬', label: 'Contact Us',          type: 'contact' },
            { key: 'help',    icon: '🎫', label: 'Help & Support',      type: 'faq'     },
        ],
    },
    {
        group: 'Organizations',
        items: [
            { key: 'org-types', icon: '🏷️', label: 'Organization Types', type: 'org-types' },
        ],
    },
];

const TOOLBAR = [
    { cmd: 'bold',                label: 'B',  title: 'Bold',           style: { fontWeight: 'bold' } },
    { cmd: 'italic',              label: 'I',  title: 'Italic',         style: { fontStyle: 'italic' } },
    { cmd: 'underline',           label: 'U',  title: 'Underline',      style: { textDecoration: 'underline' } },
    { sep: true },
    { cmd: 'formatBlock', val: 'h2', label: 'H2', title: 'Heading 2' },
    { cmd: 'formatBlock', val: 'h3', label: 'H3', title: 'Heading 3' },
    { cmd: 'formatBlock', val: 'p',  label: '¶',  title: 'Paragraph'  },
    { sep: true },
    { cmd: 'insertUnorderedList', label: '≡',  title: 'Bullet list' },
    { cmd: 'insertOrderedList',   label: '№',  title: 'Numbered list' },
    { sep: true },
    { cmd: 'removeFormat',        label: '✕',  title: 'Clear formatting' },
];

const BILINGUAL_CMS_PAGES = ['terms', 'privacy'];
const CMS_LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'Hindi',   flag: '🇮🇳' },
    { code: 'mr', label: 'Marathi', flag: '🇮🇳' },
    { code: 'te', label: 'Telugu',  flag: '🇮🇳' },
    { code: 'kn', label: 'Kannada', flag: '🇮🇳' },
];

const CmsEditor = ({ pageKey }) => {
    const editorRef      = useRef(null);
    const pendingContent = useRef('');

    const isBilingual = BILINGUAL_CMS_PAGES.includes(pageKey);
    const [editorLang, setEditorLang] = useState('en'); // 'en' | 'hi' | 'mr' | 'te' | 'kn'

    // The actual key being edited — e.g. 'terms' or 'terms_mr'
    const activeKey = isBilingual && editorLang !== 'en' ? `${pageKey}_${editorLang}` : pageKey;

    const [title,           setTitle]           = useState('');
    const [status,          setStatus]          = useState(1);
    const [metaTitle,       setMetaTitle]       = useState('');
    const [metaDescription, setMetaDescription] = useState('');
    const [metaKeywords,    setMetaKeywords]    = useState('');
    const [slug,            setSlug]            = useState('');
    const [metaOpen,        setMetaOpen]        = useState(false);
    const [loading,         setLoading]         = useState(true);
    const [saving,          setSaving]          = useState(false);
    const [toast,           setToast]           = useState(null);

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    // Fetch page data — store HTML in a ref so it survives the loading→render transition
    useEffect(() => {
        setLoading(true);
        pendingContent.current = '';
        axiosAdmin.get(`/cms/${activeKey}`)
            .then(({ data }) => {
                const p = data.page;
                setTitle(p.title ?? '');
                // Only load SEO fields for EN (they're language-independent)
                if (editorLang === 'en') {
                    setStatus(p.status ?? 1);
                    setMetaTitle(p.meta_title ?? '');
                    setMetaDescription(p.meta_description ?? '');
                    setMetaKeywords(p.meta_keywords ?? '');
                    setSlug(p.slug ?? '');
                }
                pendingContent.current = p.content ?? '';
            })
            .catch(() => { pendingContent.current = ''; })
            .finally(() => setLoading(false));
    }, [activeKey]);

    // Apply HTML to the contentEditable div after it mounts (loading spinner is gone)
    useEffect(() => {
        if (!loading && editorRef.current) {
            editorRef.current.innerHTML = pendingContent.current;
        }
    }, [loading]);

    const execCmd = useCallback((cmd, val = null) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, val);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                page_key: activeKey,
                title,
                content:  editorRef.current?.innerHTML ?? '',
            };
            // SEO fields only apply to the English (canonical) version
            if (editorLang === 'en') {
                payload.meta_title       = metaTitle;
                payload.meta_description = metaDescription;
                payload.meta_keywords    = metaKeywords;
                payload.slug             = slug;
                payload.status           = status;
            }
            await axiosAdmin.post('/cms/update', payload);
            showToast('success', 'Page saved successfully!');
        } catch {
            showToast('error', 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="meta-editor-loading">
                <div className="meta-spinner" />
                <span>Loading content…</span>
            </div>
        );
    }

    return (
        <div className="meta-editor-wrap">
            {toast && (
                <div className={`meta-toast meta-toast--${toast.type}`}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            {/* Bilingual language toggle */}
            {isBilingual && (
                <div className="meta-lang-bar">
                    <span className="meta-lang-label">Language:</span>
                    <div className="meta-lang-toggle">
                        {CMS_LANGUAGES.map(l => (
                            <button
                                key={l.code}
                                className={`meta-lang-btn ${editorLang === l.code ? 'active' : ''}`}
                                onClick={() => setEditorLang(l.code)}
                            >
                                {l.flag} {l.label}
                            </button>
                        ))}
                    </div>
                    {editorLang !== 'en' && (
                        <span className="meta-lang-note">Only Title &amp; Content are saved for this language. SEO fields are language-independent.</span>
                    )}
                </div>
            )}

            {/* Page header: title + status */}
            <div className="meta-editor-header">
                <div className="meta-editor-title-row">
                    <div className="meta-field-group">
                        <label className="meta-field-label">Page Title</label>
                        <input
                            className="meta-title-input"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Enter page title"
                        />
                    </div>
                    {editorLang === 'en' && (
                    <div className="meta-field-group meta-field-group--narrow">
                        <label className="meta-field-label">Status</label>
                        <select
                            className="meta-status-select"
                            value={status}
                            onChange={e => setStatus(Number(e.target.value))}
                        >
                            <option value={1}>Active</option>
                            <option value={0}>Inactive</option>
                        </select>
                    </div>
                    )}
                </div>
            </div>

            {/* Rich text toolbar */}
            <div className="meta-editor-toolbar">
                {TOOLBAR.map((item, i) =>
                    item.sep
                        ? <div key={i} className="meta-toolbar-sep" />
                        : (
                            <button
                                key={item.cmd + (item.val ?? '')}
                                title={item.title}
                                className="meta-toolbar-btn"
                                style={item.style}
                                onMouseDown={e => { e.preventDefault(); execCmd(item.cmd, item.val ?? null); }}
                            >
                                {item.label}
                            </button>
                        )
                )}
            </div>

            {/* Content editor */}
            <div
                ref={editorRef}
                className="meta-editor-body"
                contentEditable
                suppressContentEditableWarning
                spellCheck
            />

            {/* ── Meta / SEO section (English only) ───────────────────── */}
            {editorLang === 'en' && <div className="meta-seo-section">
                <button
                    className="meta-seo-toggle"
                    onClick={() => setMetaOpen(o => !o)}
                    type="button"
                >
                    <span className="meta-seo-toggle-icon">{metaOpen ? '▾' : '▸'}</span>
                    🔍 SEO &amp; Meta Information
                    <span className="meta-seo-toggle-hint">
                        {metaOpen ? 'Click to collapse' : 'Click to expand'}
                    </span>
                </button>

                {metaOpen && (
                    <div className="meta-seo-fields">
                        <div className="meta-seo-row">
                            <div className="meta-field-group">
                                <label className="meta-field-label">
                                    Meta Title
                                    <span className="meta-field-hint"> — shown as browser tab title</span>
                                </label>
                                <input
                                    className="meta-title-input"
                                    value={metaTitle}
                                    onChange={e => setMetaTitle(e.target.value)}
                                    placeholder="e.g. Terms & Conditions | Sangian Assessment Programme"
                                    maxLength={160}
                                />
                                <span className="meta-char-count">{metaTitle.length}/160</span>
                            </div>
                        </div>

                        <div className="meta-seo-row">
                            <div className="meta-field-group">
                                <label className="meta-field-label">
                                    Meta Description
                                    <span className="meta-field-hint"> — shown in search engine results</span>
                                </label>
                                <textarea
                                    className="meta-textarea"
                                    value={metaDescription}
                                    onChange={e => setMetaDescription(e.target.value)}
                                    placeholder="Brief summary of this page (recommended: 120–160 characters)"
                                    rows={3}
                                    maxLength={320}
                                />
                                <span className="meta-char-count">{metaDescription.length}/320</span>
                            </div>
                        </div>

                        <div className="meta-seo-row meta-seo-row--split">
                            <div className="meta-field-group">
                                <label className="meta-field-label">
                                    Meta Keywords
                                    <span className="meta-field-hint"> — comma-separated (optional)</span>
                                </label>
                                <input
                                    className="meta-title-input"
                                    value={metaKeywords}
                                    onChange={e => setMetaKeywords(e.target.value)}
                                    placeholder="assessment, sangian, cognitive, terms"
                                />
                            </div>
                            <div className="meta-field-group meta-field-group--narrow">
                                <label className="meta-field-label">
                                    Slug
                                    <span className="meta-field-hint"> — URL identifier</span>
                                </label>
                                <input
                                    className="meta-title-input meta-title-input--slug"
                                    value={slug}
                                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                                    placeholder="terms-conditions"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>}

            {/* Save footer */}
            <div className="meta-editor-footer">
                <span className="meta-editor-hint">
                    💡 Changes are saved to the database and reflect on the public page immediately.
                </span>
                <button
                    className="meta-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? '⏳ Saving…' : '💾 Save Changes'}
                </button>
            </div>
        </div>
    );
};

// ── Contact Admin ─────────────────────────────────────────────────────────────

const STATUS_LABELS = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved' };
const STATUS_COLORS = {
    new:         { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    in_progress: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    resolved:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
};

const ContactAdmin = ({ newMessageCount = 0, onStatusChange }) => {
    const [tab, setTab] = useState('messages'); // 'messages' | 'info'

    // ── Contact Info state ──────────────────────────────────────────────────
    const infoEditorRef   = useRef(null);
    const infoEditorHiRef = useRef(null);
    const infoContent     = useRef('');
    const infoContentHi   = useRef('');
    const [infoLoading,  setInfoLoading]  = useState(true);
    const [infoSaving,   setInfoSaving]   = useState(false);
    const [infoToast,    setInfoToast]    = useState(null);
    const [infoFields,   setInfoFields]   = useState({
        title: '', contact_email: '', contact_phone: '', contact_address: '', contact_map_link: '', status: 1,
    });

    const showInfoToast = (type, msg) => { setInfoToast({ type, msg }); setTimeout(() => setInfoToast(null), 3500); };

    useEffect(() => {
        if (tab !== 'info') return;
        setInfoLoading(true);
        axiosAdmin.get('/admin/contact-info')
            .then(({ data }) => {
                const p = data.info;
                setInfoFields({
                    title:             p.title            ?? 'Contact Us',
                    contact_email:     p.contact_email    ?? '',
                    contact_phone:     p.contact_phone    ?? '',
                    contact_address:   p.contact_address  ?? '',
                    contact_map_link:  p.contact_map_link ?? '',
                    status:            p.status           ?? 1,
                });
                infoContent.current   = p.content    ?? '';
                infoContentHi.current = p.content_hi ?? '';
            })
            .catch(() => {})
            .finally(() => setInfoLoading(false));
    }, [tab]);

    useEffect(() => {
        if (!infoLoading) {
            if (infoEditorRef.current)   infoEditorRef.current.innerHTML   = infoContent.current;
            if (infoEditorHiRef.current) infoEditorHiRef.current.innerHTML = infoContentHi.current;
        }
    }, [infoLoading]);

    const execInfoCmd   = useCallback((cmd, val = null) => { infoEditorRef.current?.focus();   document.execCommand(cmd, false, val); }, []);
    const execInfoCmdHi = useCallback((cmd, val = null) => { infoEditorHiRef.current?.focus(); document.execCommand(cmd, false, val); }, []);

    const saveContactInfo = async () => {
        setInfoSaving(true);
        try {
            await axiosAdmin.post('/admin/contact-info', {
                ...infoFields,
                content:    infoEditorRef.current?.innerHTML   ?? '',
                content_hi: infoEditorHiRef.current?.innerHTML ?? '',
            });
            showInfoToast('success', 'Contact info saved!');
        } catch { showInfoToast('error', 'Failed to save.'); }
        finally { setInfoSaving(false); }
    };

    // ── Messages state ──────────────────────────────────────────────────────
    const [msgs,        setMsgs]        = useState([]);
    const [msgsLoading, setMsgsLoading] = useState(false);
    const [msgsFilter,  setMsgsFilter]  = useState('');
    const [selected,    setSelected]    = useState(null);
    const [deleting,    setDeleting]    = useState(null);

    const loadMessages = useCallback((filter = msgsFilter) => {
        setMsgsLoading(true);
        const qs = filter ? `?status=${filter}` : '';
        axiosAdmin.get(`/admin/contact-messages${qs}`)
            .then(({ data }) => setMsgs(data.messages || []))
            .catch(() => {})
            .finally(() => setMsgsLoading(false));
    }, [msgsFilter]);

    useEffect(() => { if (tab === 'messages') loadMessages(); }, [tab]); // eslint-disable-line

    const changeStatus = async (id, status) => {
        await axiosAdmin.post('/admin/contact-messages/update-status', { id, status });
        setMsgs(m => m.map(x => x.id === id ? { ...x, status } : x));
        if (selected?.id === id) setSelected(s => ({ ...s, status }));
        onStatusChange?.();
    };

    return (
        <div className="contact-admin-wrap">
            {/* Tab bar */}
            <div className="contact-admin-tabs">
                <button
                    className={`contact-admin-tab ${tab === 'messages' ? 'active' : ''}`}
                    onClick={() => setTab('messages')}
                >📩 Message Inbox</button>
                <button
                    className={`contact-admin-tab ${tab === 'info' ? 'active' : ''}`}
                    onClick={() => setTab('info')}
                >⚙️ Contact Info</button>
            </div>

            {/* ── Info tab ────────────────────────────────────────────── */}
            {tab === 'info' && (
                infoLoading ? (
                    <div className="meta-editor-loading"><div className="meta-spinner" /><span>Loading…</span></div>
                ) : (
                    <div className="meta-editor-wrap">
                        {infoToast && (
                            <div className={`meta-toast meta-toast--${infoToast.type}`}>
                                {infoToast.type === 'success' ? '✅' : '❌'} {infoToast.msg}
                            </div>
                        )}

                        {/* Contact details */}
                        <div className="meta-editor-header">
                            <div className="contact-info-grid">
                                <div className="meta-field-group">
                                    <label className="meta-field-label">Page Title</label>
                                    <input className="meta-title-input" value={infoFields.title}
                                        onChange={e => setInfoFields(f => ({ ...f, title: e.target.value }))}
                                        placeholder="Contact Us" />
                                </div>
                                <div className="meta-field-group meta-field-group--narrow">
                                    <label className="meta-field-label">Status</label>
                                    <select className="meta-status-select" value={infoFields.status}
                                        onChange={e => setInfoFields(f => ({ ...f, status: Number(e.target.value) }))}>
                                        <option value={1}>Active</option>
                                        <option value={0}>Inactive</option>
                                    </select>
                                </div>
                                <div className="meta-field-group">
                                    <label className="meta-field-label">📧 Support Email</label>
                                    <input className="meta-title-input" type="email" value={infoFields.contact_email}
                                        onChange={e => setInfoFields(f => ({ ...f, contact_email: e.target.value }))}
                                        placeholder="support@example.com" />
                                </div>
                                <div className="meta-field-group">
                                    <label className="meta-field-label">📞 Phone Number</label>
                                    <input className="meta-title-input" value={infoFields.contact_phone}
                                        onChange={e => setInfoFields(f => ({ ...f, contact_phone: e.target.value }))}
                                        placeholder="+91 000 000 0000" />
                                </div>
                                <div className="meta-field-group contact-info-full">
                                    <label className="meta-field-label">📍 Office Address</label>
                                    <input className="meta-title-input" value={infoFields.contact_address}
                                        onChange={e => setInfoFields(f => ({ ...f, contact_address: e.target.value }))}
                                        placeholder="F-09, 9th floor, F-Block, Tower-B, Shalimar Grand, 10, Jopling Road, Lucknow - 226001" />
                                </div>
                                <div className="meta-field-group contact-info-full">
                                    <label className="meta-field-label">🗺️ Google Maps Embed URL
                                        <span className="meta-field-hint"> — paste only the src value from the Google Maps embed iframe (not the full &lt;iframe&gt; tag)</span>
                                    </label>
                                    <textarea
                                        className="meta-title-input"
                                        rows={3}
                                        style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                                        value={infoFields.contact_map_link}
                                        onChange={e => {
                                            let val = e.target.value.trim();
                                            // Auto-extract src if admin pastes full <iframe> tag
                                            const srcMatch = val.match(/src="([^"]+)"/);
                                            if (srcMatch) val = srcMatch[1];
                                            setInfoFields(f => ({ ...f, contact_map_link: val }));
                                        }}
                                        placeholder="https://www.google.com/maps/embed?pb=... (or paste the full <iframe> tag — src will be extracted automatically)"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Page description editor — English */}
                        <div className="meta-seo-section">
                            <div className="meta-seo-toggle" style={{ cursor: 'default' }}>
                                🇬🇧 Page Description (English) <span className="meta-seo-toggle-hint">Shown when language is set to English</span>
                            </div>
                            <div className="meta-seo-fields" style={{ padding: '10px 12px 12px' }}>
                                <div className="meta-editor-toolbar">
                                    {TOOLBAR.map((item, i) =>
                                        item.sep ? <div key={i} className="meta-toolbar-sep" /> : (
                                            <button key={item.cmd + (item.val ?? '')} title={item.title}
                                                className="meta-toolbar-btn" style={item.style}
                                                onMouseDown={e => { e.preventDefault(); execInfoCmd(item.cmd, item.val ?? null); }}>
                                                {item.label}
                                            </button>
                                        )
                                    )}
                                </div>
                                <div ref={infoEditorRef} className="meta-editor-body" style={{ minHeight: '120px' }}
                                    contentEditable suppressContentEditableWarning spellCheck />
                            </div>
                        </div>

                        {/* Page description editor — Hindi */}
                        <div className="meta-seo-section">
                            <div className="meta-seo-toggle" style={{ cursor: 'default' }}>
                                🇮🇳 Page Description (Hindi) <span className="meta-seo-toggle-hint">Shown when language is set to Hindi</span>
                            </div>
                            <div className="meta-seo-fields" style={{ padding: '10px 12px 12px' }}>
                                <div className="meta-editor-toolbar">
                                    {TOOLBAR.map((item, i) =>
                                        item.sep ? <div key={i} className="meta-toolbar-sep" /> : (
                                            <button key={item.cmd + (item.val ?? '')} title={item.title}
                                                className="meta-toolbar-btn" style={item.style}
                                                onMouseDown={e => { e.preventDefault(); execInfoCmdHi(item.cmd, item.val ?? null); }}>
                                                {item.label}
                                            </button>
                                        )
                                    )}
                                </div>
                                <div ref={infoEditorHiRef} className="meta-editor-body" style={{ minHeight: '120px' }}
                                    contentEditable suppressContentEditableWarning spellCheck />
                            </div>
                        </div>

                        <div className="meta-editor-footer">
                            <span className="meta-editor-hint">💡 Changes reflect on the public Contact Us page immediately.</span>
                            <button className="meta-save-btn" onClick={saveContactInfo} disabled={infoSaving}>
                                {infoSaving ? '⏳ Saving…' : '💾 Save Changes'}
                            </button>
                        </div>
                    </div>
                )
            )}

            {/* ── Messages tab ────────────────────────────────────────── */}
            {tab === 'messages' && (
                <div className="contact-msgs-wrap">
                    {/* Filter bar */}
                    <div className="contact-msgs-toolbar">
                        <div className="contact-msgs-filters">
                            {['', 'new', 'in_progress', 'resolved'].map(s => (
                                <button key={s}
                                    className={`contact-filter-btn ${msgsFilter === s ? 'active' : ''}`}
                                    onClick={() => { setMsgsFilter(s); loadMessages(s); }}>
                                    {s === '' ? 'All' : STATUS_LABELS[s]}
                                </button>
                            ))}
                        </div>
                        <button className="meta-save-btn" style={{ padding: '7px 16px', fontSize: '12px' }}
                            onClick={() => loadMessages(msgsFilter)} disabled={msgsLoading}>
                            🔄 Refresh
                        </button>
                    </div>

                    {msgsLoading ? (
                        <div className="meta-editor-loading"><div className="meta-spinner" /><span>Loading messages…</span></div>
                    ) : msgs.length === 0 ? (
                        <div className="meta-placeholder-panel" style={{ minHeight: '200px' }}>
                            <div className="meta-placeholder-icon">📭</div>
                            <h3>No messages yet</h3>
                            <p>Submitted contact forms will appear here.</p>
                        </div>
                    ) : (
                        <div className="contact-msgs-layout">
                            {/* Message list */}
                            <div className="contact-msgs-list">
                                {msgs.map(m => {
                                    const sc = STATUS_COLORS[m.status] || STATUS_COLORS.new;
                                    return (
                                        <div key={m.id}
                                            className={`contact-msg-row ${selected?.id === m.id ? 'selected' : ''}`}
                                            onClick={() => setSelected(m)}>
                                            <div className="contact-msg-row-top">
                                                <span className="contact-msg-name">{m.name}</span>
                                                <span className="contact-msg-badge"
                                                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                                                    {STATUS_LABELS[m.status]}
                                                </span>
                                            </div>
                                            <div className="contact-msg-subject">{m.subject}</div>
                                            <div className="contact-msg-meta">
                                                {m.email} · {new Date(m.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Message detail */}
                            {selected ? (
                                <div className="contact-msg-detail">
                                    <div className="contact-msg-detail-header">
                                        <div>
                                            <div className="contact-msg-detail-name">{selected.name}</div>
                                            <div className="contact-msg-detail-meta">
                                                {selected.email}{selected.phone ? ` · ${selected.phone}` : ''}
                                                {' · '}{new Date(selected.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <button className="contact-msg-close" onClick={() => setSelected(null)}>✕</button>
                                    </div>
                                    <div className="contact-msg-detail-subject">{selected.subject}</div>
                                    <div className="contact-msg-detail-body">{selected.message}</div>
                                    <div className="contact-msg-detail-actions">
                                        <div className="contact-status-btns">
                                            {Object.entries(STATUS_LABELS).map(([val, label]) => {
                                                const sc = STATUS_COLORS[val];
                                                return (
                                                    <button key={val}
                                                        className={`contact-status-btn ${selected.status === val ? 'current' : ''}`}
                                                        style={selected.status === val
                                                            ? { background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }
                                                            : {}}
                                                        onClick={() => changeStatus(selected.id, val)}>
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="contact-msg-empty-detail">
                                    <span>👈</span>
                                    <p>Select a message to view details</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── FAQ Editor ────────────────────────────────────────────────────────────────
const FAQ_LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'Hindi',   flag: '🇮🇳' },
    { code: 'mr', label: 'Marathi', flag: '🇮🇳' },
    { code: 'te', label: 'Telugu',  flag: '🇮🇳' },
    { code: 'kn', label: 'Kannada', flag: '🇮🇳' },
];

const HelpFaqAdmin = () => {
    const [lang,    setLang]    = useState('en');
    const [title,   setTitle]   = useState('');
    const [faqs,    setFaqs]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);
    const [toast,   setToast]   = useState(null);
    const [editing, setEditing] = useState(null);
    const [form,    setForm]    = useState({ q: '', a: '' });

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(() => {
        setLoading(true);
        setEditing(null);
        axiosAdmin.get(`/admin/help-content/faq/${lang}`)
            .then(({ data }) => {
                setTitle(data.content.title || '');
                try {
                    const parsed = typeof data.content.content === 'string'
                        ? JSON.parse(data.content.content)
                        : data.content.content;
                    setFaqs(Array.isArray(parsed) ? parsed : []);
                } catch { setFaqs([]); }
            })
            .catch(() => { setFaqs([]); })
            .finally(() => setLoading(false));
    }, [lang]);

    useEffect(() => { load(); }, [load]);

    const persist = async (updatedFaqs, updatedTitle) => {
        setSaving(true);
        try {
            await axiosAdmin.post('/admin/help-content', {
                section_key: 'faq',
                language:    lang,
                title:       updatedTitle ?? title,
                content:     JSON.stringify(updatedFaqs),
            });
            setFaqs(updatedFaqs);
            if (updatedTitle !== undefined) setTitle(updatedTitle);
            showToast('FAQ saved.');
        } catch {
            showToast('Failed to save.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const openNew   = () => { setEditing('new'); setForm({ q: '', a: '' }); };
    const openEdit  = (f) => { setEditing(f.id);  setForm({ q: f.q, a: f.a }); };
    const closeForm = () => { setEditing(null); setForm({ q: '', a: '' }); };

    const handleSaveItem = async () => {
        if (!form.q.trim() || !form.a.trim()) {
            showToast('Both question and answer are required.', 'error'); return;
        }
        const updated = editing === 'new'
            ? [...faqs, { id: String(Date.now()), q: form.q.trim(), a: form.a.trim() }]
            : faqs.map(f => f.id === editing ? { ...f, q: form.q.trim(), a: form.a.trim() } : f);
        await persist(updated);
        closeForm();
    };

    const handleDelete = (id) => persist(faqs.filter(f => f.id !== id));

    const move = (idx, dir) => {
        const arr  = [...faqs];
        const swap = idx + dir;
        if (swap < 0 || swap >= arr.length) return;
        [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
        persist(arr);
    };

    if (loading) return (
        <div className="meta-faq-loading"><div className="meta-editor-spinner" /></div>
    );

    return (
        <div className="meta-faq-shell">
            {toast && <div className={`meta-toast meta-toast--${toast.type}`}>{toast.msg}</div>}

            {/* Language toggle */}
            <div className="meta-lang-bar" style={{ marginBottom: 16 }}>
                <span className="meta-lang-label">Language:</span>
                <div className="meta-lang-toggle">
                    {FAQ_LANGUAGES.map(l => (
                        <button key={l.code} className={`meta-lang-btn ${lang === l.code ? 'active' : ''}`} onClick={() => setLang(l.code)}>{l.flag} {l.label}</button>
                    ))}
                </div>
            </div>

            {/* Section title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <label className="meta-faq-label" style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                    Section Title
                </label>
                <input
                    className="meta-title-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={() => persist(faqs, title)}
                    placeholder={lang === 'hi' ? 'अनुभाग शीर्षक…' : 'Section title…'}
                    style={{ flex: 1 }}
                />
            </div>

            <div className="meta-faq-topbar">
                <p className="meta-faq-hint">
                    These FAQs appear on the public <strong>/help</strong> page ({lang === 'hi' ? 'Hindi' : 'English'}). Changes save immediately.
                </p>
                <button className="meta-faq-add-btn" onClick={openNew} disabled={saving}>+ Add FAQ</button>
            </div>

            {editing !== null && (
                <div className="meta-faq-form-card">
                    <h4 className="meta-faq-form-title">{editing === 'new' ? 'Add New FAQ' : 'Edit FAQ'}</h4>
                    <label className="meta-faq-label">Question</label>
                    <input className="meta-faq-input"
                        placeholder={lang === 'hi' ? 'प्रश्न लिखें…' : 'e.g. How long does it take to get a response?'}
                        value={form.q}
                        onChange={e => setForm(f => ({ ...f, q: e.target.value }))} />
                    <label className="meta-faq-label" style={{ marginTop: 12 }}>Answer</label>
                    <textarea className="meta-faq-textarea"
                        placeholder={lang === 'hi' ? 'उत्तर लिखें…' : 'Write a clear, concise answer…'}
                        rows={4} value={form.a}
                        onChange={e => setForm(f => ({ ...f, a: e.target.value }))} />
                    <div className="meta-faq-form-actions">
                        <button className="meta-faq-save-btn" onClick={handleSaveItem} disabled={saving}>
                            {saving ? 'Saving…' : '💾 Save'}
                        </button>
                        <button className="meta-faq-cancel-btn" onClick={closeForm}>Cancel</button>
                    </div>
                </div>
            )}

            {faqs.length === 0 && editing === null ? (
                <div className="meta-faq-empty">
                    <div style={{ fontSize: 36 }}>❓</div>
                    <p>No FAQs yet. Click <strong>+ Add FAQ</strong> to get started.</p>
                </div>
            ) : (
                <div className="meta-faq-list">
                    {faqs.map((f, idx) => (
                        <div key={f.id} className={`meta-faq-item ${editing === f.id ? 'meta-faq-item--editing' : ''}`}>
                            <div className="meta-faq-item-order">
                                <button className="meta-faq-order-btn" onClick={() => move(idx, -1)} disabled={idx === 0 || saving} title="Move up">▲</button>
                                <span className="meta-faq-num">{idx + 1}</span>
                                <button className="meta-faq-order-btn" onClick={() => move(idx, 1)} disabled={idx === faqs.length - 1 || saving} title="Move down">▼</button>
                            </div>
                            <div className="meta-faq-item-body">
                                <div className="meta-faq-q">{f.q}</div>
                                <div className="meta-faq-a">{f.a}</div>
                            </div>
                            <div className="meta-faq-item-actions">
                                <button className="meta-faq-edit-btn"   onClick={() => openEdit(f)}    disabled={saving}>✏️ Edit</button>
                                <button className="meta-faq-delete-btn" onClick={() => handleDelete(f.id)} disabled={saving}>🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Organization Types (picklist backing organizations.org_type) ──────────
// Feeds both the public registration form's dropdown (UnifiedRegister.jsx,
// via /api/public/org-types) and the Super Admin's org edit page
// (AdminOrganizationDetail.jsx, via /api/admin/org-types). Reuses the
// meta-faq-* list/form styling since the shape (an orderable list of
// simple items with add/edit/delete) is the same as the FAQ editor above.
const OrgTypesAdmin = () => {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [editing, setEditing] = useState(null); // 'new' | id | null
    const [labelInput, setLabelInput] = useState('');
    const [error, setError] = useState('');

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(() => {
        setLoading(true);
        axiosAdmin.get('/admin/org-types')
            .then(({ data }) => setTypes(data.orgTypes || []))
            .catch(() => showToast('Failed to load organization types.', 'error'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const openNew  = () => { setEditing('new'); setLabelInput(''); setError(''); };
    const openEdit = (t) => { setEditing(t.id); setLabelInput(t.label); setError(''); };
    const closeForm = () => { setEditing(null); setLabelInput(''); setError(''); };

    const handleSaveItem = async () => {
        if (!labelInput.trim()) { setError('Label is required.'); return; }
        setSaving(true);
        setError('');
        try {
            if (editing === 'new') {
                await axiosAdmin.post('/admin/org-types', { value: labelInput.trim(), label: labelInput.trim() });
            } else {
                await axiosAdmin.put(`/admin/org-types/${editing}`, { label: labelInput.trim() });
            }
            closeForm();
            await load();
            showToast('Organization type saved.');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (t) => {
        try {
            await axiosAdmin.put(`/admin/org-types/${t.id}`, { status: t.status === 'active' ? 'inactive' : 'active' });
            await load();
        } catch {
            showToast('Failed to update status.', 'error');
        }
    };

    const move = async (idx, dir) => {
        const swap = idx + dir;
        if (swap < 0 || swap >= types.length) return;
        const arr = [...types];
        [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
        setTypes(arr);
        try {
            await Promise.all([
                axiosAdmin.put(`/admin/org-types/${arr[idx].id}`, { sort_order: idx }),
                axiosAdmin.put(`/admin/org-types/${arr[swap].id}`, { sort_order: swap }),
            ]);
        } catch {
            showToast('Failed to reorder.', 'error');
            load();
        }
    };

    if (loading) return <div className="meta-faq-loading"><div className="meta-editor-spinner" /></div>;

    return (
        <div className="meta-faq-shell">
            {toast && <div className={`meta-toast meta-toast--${toast.type}`}>{toast.msg}</div>}

            <div className="meta-faq-topbar">
                <p className="meta-faq-hint">
                    Options offered on the Organization registration form and the Super Admin's org edit page.
                    Deactivating hides a type from new selections without breaking organizations already using it.
                </p>
                <button className="meta-faq-add-btn" onClick={openNew} disabled={saving}>+ Add Type</button>
            </div>

            {editing !== null && (
                <div className="meta-faq-form-card">
                    <h4 className="meta-faq-form-title">{editing === 'new' ? 'Add Organization Type' : 'Edit Organization Type'}</h4>
                    <label className="meta-faq-label">Label</label>
                    <input
                        className="meta-faq-input"
                        placeholder="e.g. Community Health Center"
                        value={labelInput}
                        onChange={e => setLabelInput(e.target.value)}
                    />
                    {error && <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>{error}</div>}
                    <div className="meta-faq-form-actions">
                        <button className="meta-faq-save-btn" onClick={handleSaveItem} disabled={saving}>
                            {saving ? 'Saving…' : '💾 Save'}
                        </button>
                        <button className="meta-faq-cancel-btn" onClick={closeForm}>Cancel</button>
                    </div>
                </div>
            )}

            {types.length === 0 && editing === null ? (
                <div className="meta-faq-empty">
                    <div style={{ fontSize: 36 }}>🏷️</div>
                    <p>No organization types yet. Click <strong>+ Add Type</strong> to get started.</p>
                </div>
            ) : (
                <div className="meta-faq-list">
                    {types.map((t, idx) => (
                        <div key={t.id} className={`meta-faq-item ${editing === t.id ? 'meta-faq-item--editing' : ''}`}>
                            <div className="meta-faq-item-order">
                                <button className="meta-faq-order-btn" onClick={() => move(idx, -1)} disabled={idx === 0 || saving} title="Move up">▲</button>
                                <span className="meta-faq-num">{idx + 1}</span>
                                <button className="meta-faq-order-btn" onClick={() => move(idx, 1)} disabled={idx === types.length - 1 || saving} title="Move down">▼</button>
                            </div>
                            <div className="meta-faq-item-body">
                                <div className="meta-faq-q">
                                    {t.label}{' '}
                                    {t.status === 'active'
                                        ? <span className="admin-tag good" style={{ fontSize: '10px' }}>Active</span>
                                        : <span className="admin-tag warn" style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>}
                                </div>
                                <div className="meta-faq-a" style={{ fontFamily: 'monospace', fontSize: '11px' }}>value: {t.value}</div>
                            </div>
                            <div className="meta-faq-item-actions" style={{ flexDirection: 'row', flexWrap: 'nowrap' }}>
                                <button className="meta-faq-edit-btn" onClick={() => openEdit(t)} disabled={saving}>✏️ Edit</button>
                                <button className="meta-faq-edit-btn" onClick={() => toggleActive(t)} disabled={saving}>
                                    {t.status === 'active' ? '⏸ Deactivate' : '▶ Activate'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const PlaceholderPanel = ({ item }) => (
    <div className="meta-placeholder-panel">
        <div className="meta-placeholder-icon">{item.icon}</div>
        <h3>{item.label}</h3>
        <p>This section is reserved for future development.</p>
    </div>
);


const AdminMeta = () => {
    const { tabKey } = useParams();
    const navigate = useNavigate();
    const { newMessageCount, refreshCount } = useAdminNotification();

    const flatItems = SIDEBAR_ITEMS.flatMap(g => g.items);
    const activeItem = flatItems.find(i => i.key === tabKey);

    // Unknown/stale tabKey (bad bookmark, typo'd URL, a tab that's since
    // been removed) — redirect to the first tab rather than rendering a
    // blank/broken panel.
    if (!activeItem) return <Navigate to={`/admin/meta/${flatItems[0].key}`} replace />;

    return (
        <div className="admin-content meta-layout">
            <aside className="meta-sidebar">
                {SIDEBAR_ITEMS.map(group => (
                    <div key={group.group} className="meta-sidebar-group">
                        <div className="meta-sidebar-group-label">{group.group}</div>
                        {group.items.map(item => (
                            <button
                                key={item.key}
                                className={`meta-sidebar-item ${tabKey === item.key ? 'active' : ''}`}
                                onClick={() => navigate(`/admin/meta/${item.key}`)}
                            >
                                <span className="meta-sidebar-icon">{item.icon}</span>
                                <span className="meta-sidebar-label-wrap">
                                    {item.label}
                                    {item.key === 'contact' && newMessageCount > 0 && (
                                        <span className="meta-sidebar-badge">
                                            {newMessageCount > 99 ? '99+' : newMessageCount}
                                        </span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                ))}
            </aside>

            <main className="meta-main">
                <div className="meta-main-header">
                    <span className="meta-main-icon">{activeItem.icon}</span>
                    <div>
                        <h2 className="meta-main-title">{activeItem.label}</h2>
                        <p className="meta-main-sub">
                            {activeItem.type === 'cms'       ? 'Edit content, SEO meta, and publish status for this page.' :
                             activeItem.type === 'contact'   ? 'Manage contact info, page description, and form submissions.' :
                             activeItem.type === 'faq'       ? 'Manage bilingual FAQ and page content for the Help & Support page.' :
                             activeItem.type === 'org-types' ? 'Manage the Organization Type options offered at registration and in org editing.' :
                             'Reserved for future development.'}
                        </p>
                    </div>
                </div>

                {activeItem.type === 'cms'
                    ? <CmsEditor key={activeItem.key} pageKey={activeItem.key} />
                    : activeItem.type === 'contact'
                        ? <ContactAdmin key="contact" newMessageCount={newMessageCount} onStatusChange={refreshCount} />
                        : activeItem.type === 'faq'
                            ? <HelpFaqAdmin key="help-faq" />
                            : activeItem.type === 'org-types'
                                ? <OrgTypesAdmin key="org-types" />
                                : <PlaceholderPanel item={activeItem} />
                }
            </main>
        </div>
    );
};

export default AdminMeta;
