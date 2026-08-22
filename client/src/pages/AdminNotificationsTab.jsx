import React, { useState, useEffect, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { getLanguageIcon } from '../utils/languageIcons';

const FALLBACK_LANGUAGES = [{ code: 'english', shortCode: 'en', label: 'English' }];
const EMPTY_TRANSLATION = { subject: '', heading: '', body_html: '' };

// Triggers that are deliberately always-English regardless of the
// recipient's selected language (the sender never passes a `language` to
// sendFromTemplate for these) — hiding the language tabs here avoids an
// admin adding a translation that would silently never be used.
const NON_TRANSLATABLE_TRIGGERS = ['ticket_status_shared', 'contact_status_shared'];

// Sample values used only for the client-side "Preview" render — never sent
// anywhere, just substituted into {{var}} placeholders so an Admin can see
// roughly how the email will look before saving.
const SAMPLE_VALUES = {
    otp: '482913', full_name: 'Priya Sharma', email: 'priya@example.com', mobile: '9876543210',
    org_name: 'Bright Future NGO', ticket_id: 'SUP-1042', subject: 'Unable to submit assessment',
    status: 'Open', status_label: 'Resolved', from_email: 'user@example.com',
    message: 'The submit button is not responding on the last screen.',
    reply_preview: 'Thanks for reporting this — we have pushed a fix, please try again.',
    name: 'Rahul Verma', phone: '9876500000', admin_panel_url: 'https://sangian.celworld.org/admin/help-support',
};

const renderPreview = (str) => (str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => SAMPLE_VALUES[k] ?? m);

const Toggle = ({ checked, onChange, disabled }) => (
    <label style={{ position: 'relative', display: 'inline-block', width: '42px', height: '24px', flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ opacity: 0, width: 0, height: 0 }} />
        <span style={{ position: 'absolute', cursor: 'inherit', inset: 0, borderRadius: '34px', background: checked ? '#4f46e5' : '#d1d5db', transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', height: '18px', width: '18px', left: checked ? '21px' : '3px', bottom: '3px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </span>
    </label>
);

const fieldStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', color: '#1f2937', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' };

const CATEGORY_COLORS = {
    'Account Verification': '#0369a1', 'Individual': '#059669', 'Organization': '#7c3aed',
    'Support Ticket': '#4f46e5', 'Contact Form': '#ec4899',
};

// ─── Edit panel ─────────────────────────────────────────────────────────────
const NotificationEditPanel = ({ triggerKey, onBack, onSaved }) => {
    const [notif, setNotif] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [toast, setToast] = useState(null);

    // Every trigger can carry per-language overrides for subject/heading/body
    // (see notification_template_translations) — English above is always the
    // base row; other languages only need to fill these three fields in.
    const [languages,    setLanguages]    = useState(FALLBACK_LANGUAGES);
    const [activeLang,   setActiveLang]   = useState('en');
    const [translations, setTranslations] = useState({}); // { [shortCode]: {subject,heading,body_html} }
    const [transSaving,  setTransSaving]  = useState(false);

    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

    useEffect(() => {
        axiosAdmin.get('/admin/translations/languages')
            .then(({ data }) => {
                const enabled = (data.languages || []).filter(l => l.enabled);
                if (enabled.length) setLanguages(enabled);
            })
            .catch(() => {}); // keep the English-only fallback (e.g. no 'multilingual' grant)
    }, []);

    const load = useCallback(() => {
        setLoading(true);
        setActiveLang('en');
        axiosAdmin.get(`/admin/notifications/${triggerKey}`)
            .then(({ data }) => {
                setNotif(data.notification);
                const map = {};
                (data.translations || []).forEach(t => { map[t.language] = t; });
                setTranslations(map);
            })
            .catch(() => showToast('error', 'Failed to load notification.'))
            .finally(() => setLoading(false));
    }, [triggerKey]);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await axiosAdmin.put(`/admin/notifications/${triggerKey}`, {
                subject: notif.subject, heading: notif.heading, body_html: notif.body_html,
                sender_name: notif.sender_name, sender_email: notif.sender_email, status: notif.status,
            });
            showToast('success', 'Notification saved successfully!');
            onSaved();
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Failed to save notification.');
        } finally { setSaving(false); }
    };

    const activeTranslation = translations[activeLang] || EMPTY_TRANSLATION;
    const setActiveTranslation = (updater) => {
        setTranslations(prev => ({ ...prev, [activeLang]: updater(prev[activeLang] || EMPTY_TRANSLATION) }));
    };

    const saveTranslation = async () => {
        setTransSaving(true);
        try {
            const { data } = await axiosAdmin.put(`/admin/notifications/${triggerKey}/translations/${activeLang}`, activeTranslation);
            showToast('success', data.cleared ? 'Cleared — this language now falls back to English.' : 'Translation saved!');
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Failed to save translation.');
        } finally { setTransSaving(false); }
    };

    if (loading || !notif) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: '#9ca3af' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading…
        </div>
    );

    let variables = notif.available_variables;
    if (typeof variables === 'string') {
        try { variables = JSON.parse(variables); } catch { variables = []; }
    }
    if (!Array.isArray(variables)) variables = [];

    return (
        <div style={{ padding: '28px 32px', maxWidth: '760px' }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '16px' }}>
                ← Back to all notifications
            </button>

            {toast && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: toast.type === 'success' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: '14px' }}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '6px' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{notif.trigger_label}</h3>
                    <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: CATEGORY_COLORS[notif.category] || '#6b7280', background: '#f3f4f6', padding: '2px 10px', borderRadius: '999px' }}>{notif.category}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: notif.status === 'on' ? '#16a34a' : '#9ca3af' }}>{notif.status === 'on' ? 'ON' : 'OFF'}</span>
                    <Toggle checked={notif.status === 'on'} onChange={e => setNotif(n => ({ ...n, status: e.target.checked ? 'on' : 'off' }))} />
                </div>
            </div>
            {notif.description && <p style={{ margin: '6px 0 24px', fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>{notif.description}</p>}

            {notif.recipient_note && (
                <div style={{ marginBottom: '20px', padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', fontSize: '12.5px', color: '#1e40af' }}>
                    ℹ️ {notif.recipient_note}
                </div>
            )}

            {NON_TRANSLATABLE_TRIGGERS.includes(triggerKey) && (
                <div style={{ marginBottom: '20px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '12.5px', color: '#4b5563' }}>
                    🌐 This email is always sent in English, regardless of the customer's selected language.
                </div>
            )}

            {/* Language tabs — English is this trigger's base row; every
                other language is an optional override for subject/heading/
                body only (status, sender, variables stay global). */}
            {languages.length > 1 && !NON_TRANSLATABLE_TRIGGERS.includes(triggerKey) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                    {languages.map(l => {
                        const hasOverride = l.shortCode !== 'en' && !!translations[l.shortCode];
                        return (
                            <button key={l.shortCode}
                                onClick={() => setActiveLang(l.shortCode)}
                                style={{
                                    padding: '6px 12px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700,
                                    border: `1.5px solid ${activeLang === l.shortCode ? '#4f46e5' : '#e5e7eb'}`,
                                    background: activeLang === l.shortCode ? '#eef2ff' : '#fff',
                                    color: activeLang === l.shortCode ? '#4338ca' : '#6b7280',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                }}
                            >
                                {getLanguageIcon(l.shortCode)} {l.label}{hasOverride ? ' ✓' : ''}
                            </button>
                        );
                    })}
                </div>
            )}

            {activeLang === 'en' ? (
                <>
                    <div style={{ marginBottom: '18px' }}>
                        <label style={labelStyle}>Subject</label>
                        <input style={fieldStyle} value={notif.subject} onChange={e => setNotif(n => ({ ...n, subject: e.target.value }))} />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={labelStyle}>Heading</label>
                        <input style={fieldStyle} value={notif.heading} onChange={e => setNotif(n => ({ ...n, heading: e.target.value }))} />
                        <div style={{ marginTop: '5px', fontSize: '12px', color: '#9ca3af' }}>The large title shown inside the email, below the Sangian header bar.</div>
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={labelStyle}>Body (HTML)</label>
                        <textarea
                            rows={12}
                            style={{ ...fieldStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12.5px', lineHeight: 1.6, resize: 'vertical' }}
                            value={notif.body_html}
                            onChange={e => setNotif(n => ({ ...n, body_html: e.target.value }))}
                        />
                    </div>
                </>
            ) : (
                <>
                    <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '12.5px', color: '#92400e' }}>
                        ✏️ Overrides the English content above when this trigger fires for a {languages.find(l => l.shortCode === activeLang)?.label || activeLang}-language recipient. Leave all three fields blank and save to clear the override and fall back to English.
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={labelStyle}>Subject</label>
                        <input style={fieldStyle} value={activeTranslation.subject} onChange={e => setActiveTranslation(t => ({ ...t, subject: e.target.value }))} />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={labelStyle}>Heading</label>
                        <input style={fieldStyle} value={activeTranslation.heading} onChange={e => setActiveTranslation(t => ({ ...t, heading: e.target.value }))} />
                    </div>

                    <div style={{ marginBottom: '18px' }}>
                        <label style={labelStyle}>Body (HTML)</label>
                        <textarea
                            rows={12}
                            style={{ ...fieldStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12.5px', lineHeight: 1.6, resize: 'vertical' }}
                            value={activeTranslation.body_html}
                            onChange={e => setActiveTranslation(t => ({ ...t, body_html: e.target.value }))}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '20px' }}>
                        <button
                            onClick={saveTranslation}
                            disabled={transSaving}
                            style={{ padding: '9px 20px', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: transSaving ? 'not-allowed' : 'pointer', opacity: transSaving ? 0.7 : 1, fontFamily: 'inherit' }}
                        >
                            {transSaving ? '⏳ Saving…' : `💾 Save ${languages.find(l => l.shortCode === activeLang)?.label || activeLang}`}
                        </button>
                    </div>
                </>
            )}

            {variables.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                    <label style={labelStyle}>Available Variables</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {variables.map(v => (
                            <span key={v} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', background: '#eef2ff', color: '#4338ca', padding: '4px 10px', borderRadius: '999px', fontWeight: 600 }}>
                                {`{{${v}}}`}
                            </span>
                        ))}
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '12px', color: '#9ca3af' }}>Use these placeholders anywhere in the subject, heading, or body — they're filled in automatically when the email is sent.</div>
                </div>
            )}

            {activeLang === 'en' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', marginBottom: '8px' }}>
                    <div style={{ marginBottom: '18px' }}>
                        <label style={labelStyle}>Sender Name (optional)</label>
                        <input style={fieldStyle} value={notif.sender_name || ''} onChange={e => setNotif(n => ({ ...n, sender_name: e.target.value }))} placeholder="Uses SMTP default if blank" />
                    </div>
                    <div style={{ marginBottom: '18px' }}>
                        <label style={labelStyle}>Sender Email (optional)</label>
                        <input style={fieldStyle} value={notif.sender_email || ''} onChange={e => setNotif(n => ({ ...n, sender_email: e.target.value }))} placeholder="Uses SMTP default if blank" />
                    </div>
                </div>
            )}

            <button
                onClick={() => setShowPreview(v => !v)}
                style={{ marginBottom: '20px', padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
                {showPreview ? '🙈 Hide Preview' : '👁️ Preview (with sample data)'}
            </button>

            {showPreview && (
                <div style={{ marginBottom: '24px', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>
                        Subject: {renderPreview(activeLang === 'en' ? notif.subject : (activeTranslation.subject || notif.subject))}
                    </div>
                    <div style={{ padding: '20px', background: '#fff' }}>
                        <h2 style={{ margin: '0 0 16px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                            {renderPreview(activeLang === 'en' ? notif.heading : (activeTranslation.heading || notif.heading))}
                        </h2>
                        <div dangerouslySetInnerHTML={{ __html: renderPreview(activeLang === 'en' ? notif.body_html : (activeTranslation.body_html || notif.body_html)) }} />
                    </div>
                </div>
            )}

            {activeLang === 'en' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                    <button
                        onClick={save}
                        disabled={saving}
                        style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
                    >
                        {saving ? '⏳ Saving…' : '💾 Save Notification'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── List view ──────────────────────────────────────────────────────────────
const AdminNotificationsTab = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingKey, setEditingKey] = useState(null);
    const [togglingKey, setTogglingKey] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

    const load = () => {
        setLoading(true);
        axiosAdmin.get('/admin/notifications')
            .then(({ data }) => setNotifications(data.notifications || []))
            .catch(() => showToast('error', 'Failed to load notifications.'))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const toggleStatus = async (row) => {
        const nextStatus = row.status === 'on' ? 'off' : 'on';
        setTogglingKey(row.trigger_key);
        try {
            await axiosAdmin.patch(`/admin/notifications/${row.trigger_key}/status`, { status: nextStatus });
        } catch {
            showToast('error', 'Failed to update status.');
        } finally {
            setTogglingKey(null);
            load();
        }
    };

    if (editingKey) {
        return <NotificationEditPanel triggerKey={editingKey} onBack={() => { setEditingKey(null); load(); }} onSaved={load} />;
    }

    return (
        <div style={{ padding: '28px 32px' }}>
            {toast && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: toast.type === 'success' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: '14px' }}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>System Notifications</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                    Every automated email the platform sends. Turn any of them on/off, or edit their subject, sender, and content — changes apply immediately, no code changes needed.
                </p>
            </div>

            {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', gap: '12px', color: '#9ca3af' }}>
                    <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Loading…
                </div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '14px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6b7280', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notification / Trigger</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#6b7280', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', color: '#6b7280', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Status</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px', color: '#6b7280', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {notifications.map(row => (
                                <tr key={row.trigger_key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ fontWeight: 700, color: '#1f2937' }}>{row.trigger_label}</div>
                                        <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10.5px', fontWeight: 700, color: CATEGORY_COLORS[row.category] || '#6b7280', background: '#f3f4f6', padding: '2px 9px', borderRadius: '999px' }}>{row.category}</span>
                                    </td>
                                    <td style={{ padding: '14px 16px', color: '#4b5563', maxWidth: '320px' }}>{row.subject}</td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        <Toggle checked={row.status === 'on'} disabled={togglingKey === row.trigger_key} onChange={() => toggleStatus(row)} />
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => setEditingKey(row.trigger_key)}
                                            style={{ padding: '7px 16px', borderRadius: '8px', border: '1.5px solid #6366f1', background: '#fff', color: '#4f46e5', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            View / Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminNotificationsTab;
