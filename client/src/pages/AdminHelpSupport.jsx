import React, { useState, useEffect, useCallback, useRef } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { useAdminNotification } from '../contexts/AdminNotificationContext';
import './AdminHelpSupport.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const SERVER_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : 'https://sangianapi.celworld.org';

const STATUS_META = {
    open:             { label: 'Open',              cls: 'abadge-open'     },
    in_progress:      { label: 'In Progress',        cls: 'abadge-progress' },
    waiting_for_user: { label: 'Waiting for User',   cls: 'abadge-waiting'  },
    resolved:         { label: 'Resolved',           cls: 'abadge-resolved' },
    closed:           { label: 'Closed',             cls: 'abadge-closed'   },
};
const ALL_STATUSES = Object.keys(STATUS_META);

const StatusBadge = ({ status }) => {
    const m = STATUS_META[status] || { label: status, cls: 'abadge-open' };
    return <span className={`ahs-badge ${m.cls}`}>{m.label}</span>;
};

const fmtDate = (d) => new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
});

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onDone }) => {
    useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
    return <div className={`ahs-toast ahs-toast--${type}`}>{msg}</div>;
};

// ── Stats Bar ─────────────────────────────────────────────────────────────────
const STAT_CHIPS = [
    { key: 'total',            label: 'Total',       color: '#6366f1' },
    { key: 'open',             label: 'Open',        color: '#16a34a' },
    { key: 'in_progress',      label: 'In Progress', color: '#1d4ed8' },
    { key: 'waiting_for_user', label: 'Waiting',     color: '#a16207' },
    { key: 'resolved',         label: 'Resolved',    color: '#065f46' },
    { key: 'closed',           label: 'Closed',      color: '#64748b' },
];

const StatsBar = ({ stats, activeStatus, onStatClick }) => (
    <div className="ahs-stats-bar">
        {STAT_CHIPS.map(({ key, label, color }) => {
            const isActive = key === 'total' ? activeStatus === '' : activeStatus === key;
            return (
                <button
                    key={key}
                    className={`ahs-stat-chip ahs-stat-chip--btn${isActive ? ' ahs-stat-chip--active' : ''}`}
                    style={isActive ? { borderColor: color, background: `${color}10` } : {}}
                    onClick={() => onStatClick(key)}
                    title={`Filter by: ${label}`}
                >
                    <span className="ahs-stat-num" style={{ color }}>{stats[key] ?? 0}</span>
                    <span className="ahs-stat-lbl" style={isActive ? { color } : {}}>{label}</span>
                </button>
            );
        })}
    </div>
);

// ── Filter Bar ────────────────────────────────────────────────────────────────
const FilterBar = ({ filters, onChange, onSearch }) => (
    <div className="ahs-filter-bar">
        <input
            className="ahs-filter-input"
            placeholder="Search Ticket ID…"
            value={filters.ticket_id}
            onChange={e => onChange('ticket_id', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
        />
        <input
            className="ahs-filter-input"
            placeholder="Search email…"
            value={filters.email}
            onChange={e => onChange('email', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
        />
        <select
            className="ahs-filter-select"
            value={filters.status}
            onChange={e => { onChange('status', e.target.value); }}
        >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
        </select>
        <input
            type="date"
            className="ahs-filter-input ahs-filter-date"
            value={filters.date_from}
            onChange={e => onChange('date_from', e.target.value)}
        />
        <span className="ahs-filter-sep">to</span>
        <input
            type="date"
            className="ahs-filter-input ahs-filter-date"
            value={filters.date_to}
            onChange={e => onChange('date_to', e.target.value)}
        />
        <button className="ahs-filter-btn" onClick={onSearch}>🔍 Search</button>
    </div>
);

// ── Ticket Detail Panel ───────────────────────────────────────────────────────
const TicketDetailPanel = ({ ticketId, onClose, onRefreshList }) => {
    const [ticket,    setTicket]   = useState(null);
    const [messages,  setMessages] = useState([]);
    const [loading,   setLoading]  = useState(true);
    const [status,    setStatus]   = useState('');
    const [replyMsg,  setReplyMsg] = useState('');
    const [replyFiles,setReplyFiles] = useState([]);
    const [saving,    setSaving]   = useState(false);
    const [sending,   setSending]  = useState(false);
    const [toast,     setToast]    = useState(null);
    const fileRef   = useRef(null);
    const threadRef = useRef(null);

    const showToast = (msg, type = 'success') => setToast({ msg, type });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/tickets/${ticketId}`);
            setTicket(data.ticket);
            setStatus(data.ticket.status);
            setMessages(data.messages);
            setTimeout(() => {
                if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
            }, 60);
        } catch {
            showToast('Failed to load ticket.', 'error');
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => { load(); }, [load]);

    const handleStatusSave = async () => {
        setSaving(true);
        try {
            await axiosAdmin.post(`/admin/tickets/${ticketId}/status`, { status });
            showToast('Status updated.');
            setTicket(t => ({ ...t, status }));
            onRefreshList();
        } catch {
            showToast('Failed to update status.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddFile = (e) => {
        const added   = Array.from(e.target.files || []);
        const combined = [...replyFiles, ...added].slice(0, 3);
        setReplyFiles(combined);
        e.target.value = '';
    };

    const handleReply = async (e) => {
        e.preventDefault();
        if (!replyMsg.trim()) { showToast('Please enter a message.', 'error'); return; }
        setSending(true);
        const fd = new FormData();
        fd.append('message', replyMsg.trim());
        replyFiles.forEach(f => fd.append('attachments', f));
        try {
            await axiosAdmin.post(`/admin/tickets/${ticketId}/reply`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setReplyMsg('');
            setReplyFiles([]);
            showToast('Reply sent.');
            await load();
            onRefreshList();
        } catch {
            showToast('Failed to send reply.', 'error');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="ahs-detail-panel">
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

            <div className="ahs-detail-topbar">
                <button className="ahs-back-btn" onClick={onClose}>← Back to list</button>
            </div>

            {loading ? (
                <div className="ahs-spinner-wrap"><div className="ahs-spinner" /></div>
            ) : ticket ? (
                <>
                    {/* Header */}
                    <div className="ahs-detail-header">
                        <div className="ahs-detail-meta">
                            <span className="ahs-detail-id">{ticket.ticket_id}</span>
                            <StatusBadge status={ticket.status} />
                        </div>
                        <h2 className="ahs-detail-title">{ticket.title}</h2>
                        <p className="ahs-detail-email">📧 {ticket.email}</p>
                        <p className="ahs-detail-date">Created {fmtDate(ticket.created_at)}</p>
                    </div>

                    {/* Status control */}
                    <div className="ahs-status-row">
                        <label className="ahs-status-label">Update Status</label>
                        <select
                            className="ahs-status-select"
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                        >
                            {ALL_STATUSES.map(s => (
                                <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                        </select>
                        <button
                            className="ahs-status-btn"
                            onClick={handleStatusSave}
                            disabled={saving || status === ticket.status}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </div>

                    {/* Conversation */}
                    <div className="ahs-thread" ref={threadRef}>
                        {messages.map((m) => {
                            const isUser  = m.sender_type === 'user';
                            const attachs = m.attachments
                                ? (typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments)
                                : [];
                            return (
                                <div key={m.id} className={`ahs-msg ${isUser ? 'ahs-msg-user' : 'ahs-msg-admin'}`}>
                                    <div className="ahs-msg-sender">
                                        {isUser ? `👤 ${ticket.email}` : '🛡️ Support Team'}
                                    </div>
                                    <div className="ahs-msg-text">{m.message}</div>
                                    {attachs.length > 0 && (
                                        <div className="ahs-msg-attachments">
                                            {attachs.map((src, i) => (
                                                <a key={i} href={`${SERVER_BASE}${src}`} target="_blank" rel="noreferrer">
                                                    <img
                                                        src={`${SERVER_BASE}${src}`}
                                                        alt={`attach-${i + 1}`}
                                                        className="ahs-msg-thumb"
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    <div className="ahs-msg-time">{fmtDate(m.created_at)}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Admin Reply */}
                    {ticket.status !== 'closed' && (
                        <form className="ahs-reply-form" onSubmit={handleReply}>
                            <label className="ahs-reply-label">Reply to User</label>
                            <textarea
                                className="ahs-reply-textarea"
                                placeholder="Type your reply…"
                                rows={4}
                                value={replyMsg}
                                onChange={e => setReplyMsg(e.target.value)}
                                disabled={sending}
                            />

                            {/* Attachment previews */}
                            {replyFiles.length > 0 && (
                                <div className="ahs-reply-files">
                                    {replyFiles.map((f, i) => (
                                        <div key={i} className="ahs-reply-chip">
                                            <img src={URL.createObjectURL(f)} alt={f.name} className="ahs-reply-chip-thumb" />
                                            <span>{f.name}</span>
                                            <button type="button" onClick={() => setReplyFiles(files => files.filter((_, j) => j !== i))}>✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="ahs-reply-actions">
                                {replyFiles.length < 3 && (
                                    <button type="button" className="ahs-attach-btn" onClick={() => fileRef.current.click()}>
                                        📎 Attach Image
                                    </button>
                                )}
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={handleAddFile}
                                />
                                <button className="ahs-reply-send-btn" disabled={sending}>
                                    {sending ? 'Sending…' : '📤 Send Reply'}
                                </button>
                            </div>
                        </form>
                    )}
                </>
            ) : (
                <div className="ahs-error">Failed to load ticket.</div>
            )}
        </div>
    );
};

// ── Ticket List View ──────────────────────────────────────────────────────────
const TicketListView = ({ onSelectTicket }) => {
    const { activeTicketCount } = useAdminNotification();
    const INIT_FILTERS = { ticket_id: '', email: '', status: '', date_from: '', date_to: '' };
    const [tickets,   setTickets]   = useState([]);
    const [stats,     setStats]     = useState({});
    const [filters,   setFilters]   = useState(INIT_FILTERS);
    const [page,      setPage]      = useState(1);
    const [total,     setTotal]     = useState(0);
    const [loading,   setLoading]   = useState(true);
    const LIMIT = 25;

    const loadStats = useCallback(async () => {
        try {
            const { data } = await axiosAdmin.get('/admin/tickets/stats');
            setStats(data);
        } catch {}
    }, []);

    const loadTickets = useCallback(async (pg = 1, overrideFilters = null) => {
        setLoading(true);
        try {
            const active = overrideFilters || filters;
            const params = { ...active, page: pg, limit: LIMIT };
            Object.keys(params).forEach(k => !params[k] && delete params[k]);
            const { data } = await axiosAdmin.get('/admin/tickets', { params });
            setTickets(data.tickets);
            setTotal(data.total);
            setPage(pg);
        } catch {}
        finally { setLoading(false); }
    }, [filters]);

    useEffect(() => { loadStats(); loadTickets(1); }, [loadStats, loadTickets]);

    const handleFilterChange = (key, val) => setFilters(f => ({ ...f, [key]: val }));
    const handleSearch = () => loadTickets(1);
    const handleClear  = () => { setFilters(INIT_FILTERS); loadTickets(1, INIT_FILTERS); };

    const handleStatClick = (key) => {
        const newStatus = key === 'total' ? '' : key;
        const newFilters = { ...filters, status: newStatus };
        setFilters(newFilters);
        loadTickets(1, newFilters);
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="ahs-list-view">
            <div className="ahs-list-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 className="ahs-page-title">Help &amp; Support Tickets</h2>
                        {activeTicketCount > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '22px', height: '22px', padding: '0 6px', borderRadius: '11px', background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 800, lineHeight: 1 }}>
                                {activeTicketCount > 99 ? '99+' : activeTicketCount}
                            </span>
                        )}
                    </div>
                    <p className="ahs-page-sub">Manage user support requests and respond to enquiries</p>
                </div>
                <button className="ahs-refresh-btn" onClick={() => { loadStats(); loadTickets(page); }}>
                    🔄 Refresh
                </button>
            </div>

            <StatsBar stats={stats} activeStatus={filters.status} onStatClick={handleStatClick} />

            <FilterBar filters={filters} onChange={handleFilterChange} onSearch={handleSearch} />
            {Object.values(filters).some(Boolean) && (
                <button className="ahs-clear-btn" onClick={handleClear}>✕ Clear Filters</button>
            )}

            {loading ? (
                <div className="ahs-spinner-wrap"><div className="ahs-spinner" /></div>
            ) : tickets.length === 0 ? (
                <div className="ahs-empty">
                    <div className="ahs-empty-icon">🎫</div>
                    <p>No tickets found.</p>
                </div>
            ) : (
                <>
                    <div className="ahs-table-wrap">
                        <table className="ahs-table">
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Email</th>
                                    <th>Subject</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Unread</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map(t => (
                                    <tr key={t.ticket_id} className="ahs-table-row">
                                        <td className="ahs-col-id">{t.ticket_id}</td>
                                        <td className="ahs-col-email">{t.email}</td>
                                        <td className="ahs-col-title">{t.title}</td>
                                        <td><StatusBadge status={t.status} /></td>
                                        <td className="ahs-col-date">{fmtDate(t.created_at)}</td>
                                        <td>
                                            {t.unread_replies > 0 && (
                                                <span className="ahs-unread-dot">{t.unread_replies}</span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className="ahs-view-btn"
                                                onClick={() => onSelectTicket(t.ticket_id)}
                                            >
                                                View →
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="ahs-pagination">
                            <button
                                className="ahs-page-btn"
                                disabled={page <= 1}
                                onClick={() => loadTickets(page - 1)}
                            >
                                ← Prev
                            </button>
                            <span className="ahs-page-info">
                                Page {page} of {totalPages} &nbsp;·&nbsp; {total} tickets
                            </span>
                            <button
                                className="ahs-page-btn"
                                disabled={page >= totalPages}
                                onClick={() => loadTickets(page + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTENT TAB — Bilingual CMS Editor
// ══════════════════════════════════════════════════════════════════════════════

const CONTENT_SECTIONS = [
    { key: 'create_ticket', icon: '✉️', label: 'Create Ticket',  type: 'rich' },
    { key: 'my_tickets',    icon: '📋', label: 'My Tickets',     type: 'rich' },
    { key: 'faq',           icon: '❓', label: 'FAQ',            type: 'faq'  },
];

const TOOLBAR_BTNS = [
    { cmd: 'bold',              label: 'B',   title: 'Bold',          style: { fontWeight: 'bold' } },
    { cmd: 'italic',            label: 'I',   title: 'Italic',        style: { fontStyle: 'italic' } },
    { cmd: 'underline',         label: 'U',   title: 'Underline',     style: { textDecoration: 'underline' } },
    { sep: true },
    { cmd: 'formatBlock', val: 'h3', label: 'H3', title: 'Heading 3' },
    { sep: true },
    { cmd: 'insertUnorderedList', label: '• List', title: 'Bullet list' },
    { cmd: 'insertOrderedList',   label: '1. List', title: 'Numbered list' },
];

// ── Rich Text Editor Panel ────────────────────────────────────────────────────
const RichContentEditor = ({ sectionKey, lang, onToast }) => {
    const [title,   setTitle]   = useState('');
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);
    const editorRef    = useRef(null);
    const pendingHTML  = useRef('');

    useEffect(() => {
        setLoading(true);
        pendingHTML.current = '';
        axiosAdmin.get(`/admin/help-content/${sectionKey}/${lang}`)
            .then(({ data }) => {
                setTitle(data.content.title || '');
                pendingHTML.current = data.content.content || '';
            })
            .catch(() => { setTitle(''); pendingHTML.current = ''; })
            .finally(() => setLoading(false));
    }, [sectionKey, lang]);

    useEffect(() => {
        if (!loading && editorRef.current) {
            editorRef.current.innerHTML = pendingHTML.current;
        }
    }, [loading]);

    const execCmd = (cmd, val) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, val || null);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axiosAdmin.post('/admin/help-content', {
                section_key: sectionKey,
                language:    lang,
                title:       title.trim(),
                content:     editorRef.current?.innerHTML || '',
            });
            onToast('Content saved.');
        } catch {
            onToast('Failed to save.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="ahs-spinner-wrap"><div className="ahs-spinner" /></div>;

    return (
        <div className="ahsc-editor-wrap">
            <div className="ahsc-title-row">
                <label className="ahsc-label">Section Title</label>
                <input
                    className="ahsc-title-input"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Section title…"
                />
            </div>

            <div className="ahsc-toolbar">
                {TOOLBAR_BTNS.map((b, i) =>
                    b.sep
                        ? <span key={i} className="ahsc-toolbar-sep" />
                        : <button key={i} type="button" className="ahsc-toolbar-btn"
                            title={b.title} style={b.style || {}}
                            onMouseDown={e => { e.preventDefault(); execCmd(b.cmd, b.val); }}>
                            {b.label}
                          </button>
                )}
            </div>

            <div
                ref={editorRef}
                className="ahsc-editor-body"
                contentEditable
                suppressContentEditableWarning
            />

            <button className="ahsc-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save Content'}
            </button>
        </div>
    );
};

// ── FAQ Editor Panel ──────────────────────────────────────────────────────────
const FaqContentEditor = ({ lang, onToast }) => {
    const [faqs,    setFaqs]    = useState([]);
    const [title,   setTitle]   = useState('');
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);
    const [editing, setEditing] = useState(null);
    const [form,    setForm]    = useState({ q: '', a: '' });

    const load = useCallback(() => {
        setLoading(true);
        axiosAdmin.get(`/admin/help-content/faq/${lang}`)
            .then(({ data }) => {
                setTitle(data.content.title || '');
                try {
                    const parsed = typeof data.content.content === 'string'
                        ? JSON.parse(data.content.content) : data.content.content;
                    setFaqs(Array.isArray(parsed) ? parsed : []);
                } catch { setFaqs([]); }
            })
            .catch(() => { setFaqs([]); })
            .finally(() => setLoading(false));
    }, [lang]);

    useEffect(() => { load(); }, [load]);

    const persist = async (updatedFaqs) => {
        setSaving(true);
        try {
            await axiosAdmin.post('/admin/help-content', {
                section_key: 'faq',
                language:    lang,
                title:       title,
                content:     JSON.stringify(updatedFaqs),
            });
            setFaqs(updatedFaqs);
            onToast('FAQ saved.');
        } catch {
            onToast('Failed to save.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const openNew  = () => { setEditing('new'); setForm({ q: '', a: '' }); };
    const openEdit = (f) => { setEditing(f.id); setForm({ q: f.q, a: f.a }); };
    const cancel   = () => { setEditing(null); setForm({ q: '', a: '' }); };

    const saveItem = async () => {
        if (!form.q.trim() || !form.a.trim()) { onToast('Both fields are required.', 'error'); return; }
        const updated = editing === 'new'
            ? [...faqs, { id: String(Date.now()), q: form.q.trim(), a: form.a.trim() }]
            : faqs.map(f => f.id === editing ? { ...f, q: form.q.trim(), a: form.a.trim() } : f);
        await persist(updated);
        cancel();
    };

    const deleteItem = (id) => persist(faqs.filter(f => f.id !== id));

    const move = (idx, dir) => {
        const arr = [...faqs];
        const to  = idx + dir;
        if (to < 0 || to >= arr.length) return;
        [arr[idx], arr[to]] = [arr[to], arr[idx]];
        persist(arr);
    };

    if (loading) return <div className="ahs-spinner-wrap"><div className="ahs-spinner" /></div>;

    return (
        <div className="ahsc-faq-wrap">
            <div className="ahsc-title-row">
                <label className="ahsc-label">Section Title</label>
                <input className="ahsc-title-input" value={title}
                    onChange={e => setTitle(e.target.value)} placeholder="FAQ section title…" />
            </div>

            <div className="ahsc-faq-topbar">
                <span className="ahsc-faq-count">{faqs.length} question{faqs.length !== 1 ? 's' : ''}</span>
                <button className="ahsc-faq-add-btn" onClick={openNew} disabled={saving}>+ Add Question</button>
            </div>

            {editing !== null && (
                <div className="ahsc-faq-form">
                    <label className="ahsc-label">Question</label>
                    <input className="ahsc-faq-input" value={form.q}
                        onChange={e => setForm(f => ({ ...f, q: e.target.value }))}
                        placeholder="Type the question…" />
                    <label className="ahsc-label" style={{ marginTop: 10 }}>Answer</label>
                    <textarea className="ahsc-faq-textarea" rows={3} value={form.a}
                        onChange={e => setForm(f => ({ ...f, a: e.target.value }))}
                        placeholder="Type the answer…" />
                    <div className="ahsc-faq-form-btns">
                        <button className="ahsc-save-btn" onClick={saveItem} disabled={saving}>
                            {saving ? 'Saving…' : '💾 Save'}
                        </button>
                        <button className="ahsc-cancel-btn" onClick={cancel}>Cancel</button>
                    </div>
                </div>
            )}

            <div className="ahsc-faq-list">
                {faqs.map((f, idx) => (
                    <div key={f.id} className={`ahsc-faq-item ${editing === f.id ? 'ahsc-faq-item--active' : ''}`}>
                        <div className="ahsc-faq-order">
                            <button className="ahsc-order-btn" onClick={() => move(idx, -1)} disabled={idx === 0 || saving}>▲</button>
                            <span className="ahsc-order-num">{idx + 1}</span>
                            <button className="ahsc-order-btn" onClick={() => move(idx, 1)} disabled={idx === faqs.length - 1 || saving}>▼</button>
                        </div>
                        <div className="ahsc-faq-body">
                            <div className="ahsc-faq-q">{f.q}</div>
                            <div className="ahsc-faq-a">{f.a}</div>
                        </div>
                        <div className="ahsc-faq-actions">
                            <button className="ahsc-edit-btn" onClick={() => openEdit(f)} disabled={saving}>✏️</button>
                            <button className="ahsc-del-btn"  onClick={() => deleteItem(f.id)} disabled={saving}>🗑️</button>
                        </div>
                    </div>
                ))}
                {faqs.length === 0 && editing === null && (
                    <div className="ahsc-faq-empty">No questions yet. Click <strong>+ Add Question</strong>.</div>
                )}
            </div>
        </div>
    );
};

// ── Content Tab ───────────────────────────────────────────────────────────────
const ContentTab = () => {
    const [activeSection, setActiveSection] = useState('create_ticket');
    const [activeLang,    setActiveLang]    = useState('en');
    const [toast,         setToast]         = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const section = CONTENT_SECTIONS.find(s => s.key === activeSection);

    return (
        <div className="ahsc-shell">
            {toast && <div className={`ahs-toast ahs-toast--${toast.type}`}>{toast.msg}</div>}

            {/* Left sidebar */}
            <aside className="ahsc-sidebar">
                <div className="ahsc-sidebar-label">Sections</div>
                {CONTENT_SECTIONS.map(s => (
                    <button
                        key={s.key}
                        className={`ahsc-sidebar-item ${activeSection === s.key ? 'active' : ''}`}
                        onClick={() => setActiveSection(s.key)}
                    >
                        <span>{s.icon}</span> {s.label}
                    </button>
                ))}
            </aside>

            {/* Right panel */}
            <div className="ahsc-panel">
                <div className="ahsc-panel-header">
                    <div className="ahsc-panel-title-row">
                        <span className="ahsc-panel-icon">{section.icon}</span>
                        <div>
                            <h3 className="ahsc-panel-title">{section.label}</h3>
                            <p className="ahsc-panel-sub">
                                {section.type === 'faq'
                                    ? 'Manage FAQ questions and answers for the selected language.'
                                    : 'Edit rich HTML content displayed in the help page card.'}
                            </p>
                        </div>
                    </div>

                    {/* Language toggle */}
                    <div className="ahsc-lang-toggle">
                        <button
                            className={`ahsc-lang-btn ${activeLang === 'en' ? 'active' : ''}`}
                            onClick={() => setActiveLang('en')}
                        >
                            🇬🇧 EN
                        </button>
                        <button
                            className={`ahsc-lang-btn ${activeLang === 'hi' ? 'active' : ''}`}
                            onClick={() => setActiveLang('hi')}
                        >
                            🇮🇳 HI
                        </button>
                    </div>
                </div>

                <div className="ahsc-panel-body">
                    {section.type === 'faq'
                        ? <FaqContentEditor key={`faq-${activeLang}`} lang={activeLang} onToast={showToast} />
                        : <RichContentEditor key={`${activeSection}-${activeLang}`} sectionKey={activeSection} lang={activeLang} onToast={showToast} />
                    }
                </div>
            </div>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN AdminHelpSupport
// ══════════════════════════════════════════════════════════════════════════════
const AdminHelpSupport = () => {
    const [activeTab,      setActiveTab]      = useState('tickets'); // 'tickets' | 'content'
    const [selectedTicket, setSelectedTicket] = useState(null);
    const listRefreshRef = useRef(null);

    return (
        <main className="admin-main ahs-shell">
            {/* Top tab bar */}
            <div className="ahs-tab-bar">
                <button
                    className={`ahs-tab-btn ${activeTab === 'tickets' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('tickets'); setSelectedTicket(null); }}
                >
                    🎫 Tickets
                </button>
                <button
                    className={`ahs-tab-btn ${activeTab === 'content' ? 'active' : ''}`}
                    onClick={() => setActiveTab('content')}
                >
                    📝 Content
                </button>
            </div>

            {activeTab === 'tickets' ? (
                selectedTicket ? (
                    <TicketDetailPanel
                        ticketId={selectedTicket}
                        onClose={() => setSelectedTicket(null)}
                        onRefreshList={() => listRefreshRef.current?.()}
                    />
                ) : (
                    <TicketListView
                        ref={listRefreshRef}
                        onSelectTicket={setSelectedTicket}
                    />
                )
            ) : (
                <ContentTab />
            )}
        </main>
    );
};

export default AdminHelpSupport;
