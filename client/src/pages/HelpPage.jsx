import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './HelpPage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SERVER_BASE = API_URL.replace(/\/api$/, '');

const getStatusMeta = (t) => ({
    open:             { label: t('help.statusOpen'),            cls: 'badge-open'    },
    in_progress:      { label: t('help.statusInProgress'),      cls: 'badge-progress'},
    waiting_for_user: { label: t('help.statusWaitingForReply'), cls: 'badge-waiting' },
    resolved:         { label: t('help.statusResolved'),        cls: 'badge-resolved'},
    closed:           { label: t('help.statusClosed'),          cls: 'badge-closed'  },
});

const StatusBadge = ({ status }) => {
    const { t } = useLanguage();
    const meta = getStatusMeta(t);
    const m = meta[status] || { label: status, cls: 'badge-open' };
    return <span className={`help-badge ${m.cls}`}>{m.label}</span>;
};

const fmtDate = (d) => new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
});

const fmtDateShort = (d) => new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
});

// ── OTP Modal ─────────────────────────────────────────────────────────────────
const OtpModal = ({ purpose, onClose, onVerified }) => {
    const { t } = useLanguage();
    const [step,       setStep]       = useState('email');
    const [emailVal,   setEmailVal]   = useState('');
    const [otpVal,     setOtpVal]     = useState('');
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState('');
    const [resendSecs, setResendSecs] = useState(0);
    const [devOtp,     setDevOtp]     = useState(null);
    const timerRef = useRef(null);

    const startResendTimer = useCallback(() => {
        setResendSecs(60);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setResendSecs(s => {
                if (s <= 1) { clearInterval(timerRef.current); return 0; }
                return s - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => () => clearInterval(timerRef.current), []);

    const handleSendOtp = async (e) => {
        e?.preventDefault();
        setError('');
        const email = emailVal.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError(t('help.otpErrEmail'));
            return;
        }
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/tickets/send-otp`, { email });
            setDevOtp(data.devOtp || null);
            setStep('otp');
            startResendTimer();
        } catch (err) {
            setError(err.response?.data?.error || t('help.otpErrSend'));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        if (!otpVal.trim()) { setError(t('help.otpErrEnter')); return; }
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/tickets/verify-otp`, {
                email: emailVal.trim().toLowerCase(),
                otp:   otpVal.trim(),
            });
            onVerified(data.token, data.email);
        } catch (err) {
            setError(err.response?.data?.error || t('help.otpErrVerify'));
        } finally {
            setLoading(false);
        }
    };

    const purposeLabel = purpose === 'create' ? t('help.otpPurposeCreate') : t('help.otpPurposeView');

    return (
        <div className="otp-overlay" onClick={onClose}>
            <div className="otp-card" onClick={e => e.stopPropagation()}>
                <button className="otp-close" onClick={onClose}>✕</button>

                <div className="otp-icon">🔐</div>
                <h2 className="otp-title">{t('help.otpTitle')}</h2>
                <p className="otp-sub">
                    {t('help.otpSubPrefix')} <strong>{purposeLabel}</strong>.
                </p>

                {error && <div className="otp-error">{error}</div>}

                {step === 'email' ? (
                    <form onSubmit={handleSendOtp} className="otp-form">
                        <label className="otp-label">{t('help.otpEmailLabel')}</label>
                        <input
                            type="email"
                            className="otp-input"
                            placeholder={t('help.otpEmailPlaceholder')}
                            value={emailVal}
                            onChange={e => setEmailVal(e.target.value)}
                            autoFocus
                        />
                        <button className="otp-btn" disabled={loading}>
                            {loading ? t('help.otpSending') : t('help.otpSendBtn')}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="otp-form">
                        <p className="otp-sent-to">{t('help.otpSentTo')} <strong>{emailVal}</strong></p>

                        {devOtp && (
                            <div className="otp-dev-banner">
                                <span className="otp-dev-label">{t('help.otpDevMode')}</span>
                                <span className="otp-dev-code">{devOtp}</span>
                                <button
                                    type="button"
                                    className="otp-dev-fill"
                                    onClick={() => setOtpVal(devOtp)}
                                >
                                    {t('help.otpAutoFill')}
                                </button>
                            </div>
                        )}

                        <label className="otp-label">{t('help.otpCodeLabel')}</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            className="otp-input otp-input--code"
                            placeholder={t('help.otpCodePlaceholder')}
                            value={otpVal}
                            onChange={e => setOtpVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            autoFocus
                        />
                        <button className="otp-btn" disabled={loading}>
                            {loading ? t('help.otpVerifying') : t('help.otpVerifyBtn')}
                        </button>
                        <button
                            type="button"
                            className="otp-resend"
                            disabled={resendSecs > 0 || loading}
                            onClick={handleSendOtp}
                        >
                            {resendSecs > 0
                                ? t('help.otpResendIn').replace('{n}', resendSecs)
                                : t('help.otpResend')}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

// ── File Upload Preview ────────────────────────────────────────────────────────
const FileUploadBox = ({ files, setFiles, maxFiles = 3 }) => {
    const { t } = useLanguage();
    const inputRef = useRef(null);

    const handleAdd = (e) => {
        const newFiles = Array.from(e.target.files || []);
        const combined = [...files, ...newFiles].slice(0, maxFiles);
        setFiles(combined);
        e.target.value = '';
    };

    const remove = (idx) => setFiles(files.filter((_, i) => i !== idx));

    return (
        <div className="file-upload-box">
            {files.map((f, i) => (
                <div key={i} className="file-chip">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="file-chip-thumb" />
                    <span className="file-chip-name">{f.name}</span>
                    <button type="button" className="file-chip-remove" onClick={() => remove(i)}>✕</button>
                </div>
            ))}
            {files.length < maxFiles && (
                <button type="button" className="file-add-btn" onClick={() => inputRef.current.click()}>
                    {t('help.addImage')}
                </button>
            )}
            <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                multiple
                style={{ display: 'none' }}
                onChange={handleAdd}
            />
            <span className="file-hint">
                {t('help.fileHint').replace('{cur}', files.length).replace('{max}', maxFiles)}
            </span>
        </div>
    );
};

// ── Ticket Create Form ────────────────────────────────────────────────────────
const CreateTicketForm = ({ token, userEmail, onCreated, onBack }) => {
    const { t } = useLanguage();
    const [title,   setTitle]   = useState('');
    const [desc,    setDesc]    = useState('');
    const [files,   setFiles]   = useState([]);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!title.trim()) { setError(t('help.errTitle')); return; }
        if (!desc.trim())  { setError(t('help.errDesc'));  return; }

        setLoading(true);
        const fd = new FormData();
        fd.append('title',       title.trim());
        fd.append('description', desc.trim());
        files.forEach(f => fd.append('attachments', f));

        try {
            const { data } = await axios.post(`${API_URL}/tickets/create`, fd, {
                headers: { 'x-ticket-token': token, 'Content-Type': 'multipart/form-data' },
            });
            onCreated(data.ticket_id);
        } catch (err) {
            setError(err.response?.data?.error || t('help.errCreate'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="help-section">
            <button className="help-back-btn" onClick={onBack}>{t('help.back')}</button>
            <div className="help-section-header">
                <h2 className="help-section-title">{t('help.createTitle')}</h2>
                <p className="help-section-sub">{t('help.verifiedAs')} <strong>{userEmail}</strong></p>
            </div>

            {error && <div className="help-error">{error}</div>}

            <form className="ticket-form" onSubmit={handleSubmit}>
                <div className="ticket-field">
                    <label className="ticket-label">{t('help.fieldSubject')} <span className="req">*</span></label>
                    <input
                        type="text"
                        className="ticket-input"
                        placeholder={t('help.fieldSubjectPlaceholder')}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        maxLength={200}
                    />
                    <span className="ticket-count">{title.length}/200</span>
                </div>

                <div className="ticket-field">
                    <label className="ticket-label">{t('help.fieldDesc')} <span className="req">*</span></label>
                    <textarea
                        className="ticket-textarea"
                        placeholder={t('help.fieldDescPlaceholder')}
                        rows={6}
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                    />
                </div>

                <div className="ticket-field">
                    <label className="ticket-label">
                        {t('help.fieldAttachments')} <span className="ticket-optional">{t('help.optional')}</span>
                    </label>
                    <FileUploadBox files={files} setFiles={setFiles} maxFiles={3} />
                </div>

                <button className="ticket-submit-btn" disabled={loading}>
                    {loading ? t('help.submitting') : t('help.submitBtn')}
                </button>
            </form>
        </div>
    );
};

// ── Ticket Created Success ────────────────────────────────────────────────────
const TicketCreatedSuccess = ({ ticketId, onViewTickets, onNewTicket }) => {
    const { t } = useLanguage();
    return (
        <div className="help-section help-success-section">
            <div className="help-success-icon">🎉</div>
            <h2 className="help-success-title">{t('help.successTitle')}</h2>
            <p className="help-success-sub">{t('help.successSub')}</p>
            <div className="help-success-id">
                <span className="help-success-id-label">{t('help.successIdLabel')}</span>
                <span className="help-success-id-value">{ticketId}</span>
            </div>
            <p className="help-success-note">{t('help.successNote')}</p>
            <div className="help-success-actions">
                <button className="ticket-submit-btn" onClick={onViewTickets}>{t('help.viewMyTickets')}</button>
                <button className="help-outline-btn" onClick={onNewTicket}>{t('help.createAnother')}</button>
            </div>
        </div>
    );
};

// ── My Tickets List ───────────────────────────────────────────────────────────
const MyTicketsList = ({ token, userEmail, onSelectTicket, onBack }) => {
    const { t } = useLanguage();
    const [tickets,  setTickets]  = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await axios.get(`${API_URL}/tickets/my-tickets`, {
                    headers: { 'x-ticket-token': token },
                });
                setTickets(data.tickets);
            } catch (err) {
                setError(err.response?.data?.error || t('help.errLoad'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [token, t]);

    if (loading) return (
        <div className="help-section">
            <div className="help-spinner-wrap"><div className="help-spinner" /></div>
        </div>
    );

    return (
        <div className="help-section">
            <button className="help-back-btn" onClick={onBack}>{t('help.back')}</button>
            <div className="help-section-header">
                <h2 className="help-section-title">{t('help.myTicketsTitle')}</h2>
                <p className="help-section-sub">{t('help.viewingFor')} <strong>{userEmail}</strong></p>
            </div>

            {error && <div className="help-error">{error}</div>}

            {!error && tickets.length === 0 && (
                <div className="help-empty">
                    <div className="help-empty-icon">🎫</div>
                    <p>{t('help.noTickets')}</p>
                </div>
            )}

            <div className="ticket-list">
                {tickets.map(ticket => (
                    <button key={ticket.ticket_id} className={`ticket-list-item${ticket.unread_count > 0 ? ' ticket-list-item--unread' : ''}`} onClick={() => onSelectTicket(ticket.ticket_id)}>
                        <div className="tli-header">
                            <span className="tli-id">{ticket.ticket_id}</span>
                            <div className="tli-header-right">
                                {ticket.unread_count > 0 && (
                                    <span className="tli-unread-badge">
                                        {ticket.unread_count > 9 ? '9+' : ticket.unread_count} {t('help.unreadNew')}
                                    </span>
                                )}
                                <StatusBadge status={ticket.status} />
                            </div>
                        </div>
                        <div className="tli-title">{ticket.title}</div>
                        <div className="tli-date">{t('help.createdOn')} {fmtDateShort(ticket.created_at)}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ── Ticket Detail ─────────────────────────────────────────────────────────────
const TicketDetail = ({ ticketId, token, userEmail, onBack }) => {
    const { t } = useLanguage();
    const [ticket,     setTicket]     = useState(null);
    const [messages,   setMessages]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [replyMsg,   setReplyMsg]   = useState('');
    const [replyFiles, setReplyFiles] = useState([]);
    const [sending,    setSending]    = useState(false);
    const [sendErr,    setSendErr]    = useState('');
    const threadRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API_URL}/tickets/${ticketId}`, {
                headers: { 'x-ticket-token': token },
            });
            setTicket(data.ticket);
            setMessages(data.messages);
            setTimeout(() => {
                if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
            }, 50);
        } catch (err) {
            setError(err.response?.data?.error || t('help.errLoadTicket'));
        } finally {
            setLoading(false);
        }
    }, [ticketId, token, t]);

    useEffect(() => { load(); }, [load]);

    const handleReply = async (e) => {
        e.preventDefault();
        setSendErr('');
        if (!replyMsg.trim()) { setSendErr(t('help.errReply')); return; }

        setSending(true);
        const fd = new FormData();
        fd.append('message', replyMsg.trim());
        replyFiles.forEach(f => fd.append('attachments', f));

        try {
            await axios.post(`${API_URL}/tickets/${ticketId}/reply`, fd, {
                headers: { 'x-ticket-token': token, 'Content-Type': 'multipart/form-data' },
            });
            setReplyMsg('');
            setReplyFiles([]);
            await load();
        } catch (err) {
            setSendErr(err.response?.data?.error || t('help.errSendReply'));
        } finally {
            setSending(false);
        }
    };

    if (loading) return (
        <div className="help-section">
            <div className="help-spinner-wrap"><div className="help-spinner" /></div>
        </div>
    );
    if (error) return (
        <div className="help-section">
            <button className="help-back-btn" onClick={onBack}>{t('help.backToTickets')}</button>
            <div className="help-error">{error}</div>
        </div>
    );

    const isClosed = ticket?.status === 'closed';

    return (
        <div className="help-section td-shell">
            <button className="help-back-btn" onClick={onBack}>{t('help.backToTickets')}</button>

            <div className="td-header">
                <div className="td-meta">
                    <span className="td-id">{ticket.ticket_id}</span>
                    <StatusBadge status={ticket.status} />
                </div>
                <h2 className="td-title">{ticket.title}</h2>
                <p className="td-date">{t('help.openedOn')} {fmtDate(ticket.created_at)}</p>
            </div>

            <div className="td-thread" ref={threadRef}>
                {messages.map((m) => {
                    const isUser  = m.sender_type === 'user';
                    const attachs = m.attachments
                        ? (typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments)
                        : [];
                    return (
                        <div key={m.id} className={`msg-bubble ${isUser ? 'msg-user' : 'msg-admin'}`}>
                            <div className="msg-sender">{isUser ? t('help.you') : t('help.supportTeam')}</div>
                            <div className="msg-text">{m.message}</div>
                            {attachs.length > 0 && (
                                <div className="msg-attachments">
                                    {attachs.map((src, i) => (
                                        <a key={i} href={`${SERVER_BASE}${src}`} target="_blank" rel="noreferrer">
                                            <img
                                                src={`${SERVER_BASE}${src}`}
                                                alt={`attachment-${i + 1}`}
                                                className="msg-attach-thumb"
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                            <div className="msg-time">{fmtDate(m.created_at)}</div>
                        </div>
                    );
                })}
            </div>

            {isClosed ? (
                <div className="td-closed-note">{t('help.closedNote')}</div>
            ) : (
                <form className="td-reply-form" onSubmit={handleReply}>
                    {sendErr && <div className="help-error">{sendErr}</div>}
                    <textarea
                        className="td-reply-input"
                        placeholder={t('help.replyPlaceholder')}
                        rows={4}
                        value={replyMsg}
                        onChange={e => setReplyMsg(e.target.value)}
                        disabled={sending}
                    />
                    <div className="td-reply-footer">
                        <FileUploadBox files={replyFiles} setFiles={setReplyFiles} maxFiles={3} />
                        <button className="ticket-submit-btn td-send-btn" disabled={sending}>
                            {sending ? t('help.sending') : t('help.sendReply')}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

// ── Default FAQs ──────────────────────────────────────────────────────────────
const DEFAULT_FAQS = [
    { id: '1', q: 'How long does it take to get a response?',  a: 'Our team typically responds within 1–2 business days. Complex issues may take slightly longer.' },
    { id: '2', q: 'What types of issues can I raise?',          a: 'Technical bugs, login problems, game session issues, data concerns, or any platform-related questions.' },
    { id: '3', q: 'Can I attach screenshots?',                  a: 'Yes — you can attach up to 3 images (JPG, PNG, or WEBP, max 5 MB each) when creating a ticket or replying.' },
    { id: '4', q: 'How do I track my ticket?',                  a: 'Use "My Tickets" with your verified email to see the full conversation thread and current status.' },
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HelpPage
// ══════════════════════════════════════════════════════════════════════════════
const HelpPage = () => {
    const { t, language } = useLanguage();

    const [view,          setView]          = useState('home');
    const [otpModal,      setOtpModal]      = useState(null);
    const [verifiedToken, setVerifiedToken] = useState(null);
    const [verifiedEmail, setVerifiedEmail] = useState(null);
    const [createdId,     setCreatedId]     = useState(null);
    const [selectedId,    setSelectedId]    = useState(null);
    const [faqs,          setFaqs]          = useState(DEFAULT_FAQS);
    const [cmsContent,    setCmsContent]    = useState({});

    useEffect(() => {
        const lang = language || 'en';
        axios.get(`${API_URL}/help-content/all/${lang}`)
            .then(({ data }) => {
                if (data.content) {
                    setCmsContent(data.content);
                    const faqSection = data.content.faq;
                    if (faqSection?.content) {
                        try {
                            const parsed = typeof faqSection.content === 'string'
                                ? JSON.parse(faqSection.content)
                                : faqSection.content;
                            if (Array.isArray(parsed) && parsed.length) setFaqs(parsed);
                        } catch { /* keep defaults */ }
                    }
                }
            })
            .catch(() => { /* keep defaults */ });
    }, [language]);

    const handleVerified = (token, email) => {
        setVerifiedToken(token);
        setVerifiedEmail(email);
        const purpose = otpModal;
        setOtpModal(null);
        if (purpose === 'create') setView('create-form');
        else                      setView('my-tickets');
    };

    const handleCreated = (ticketId) => {
        setCreatedId(ticketId);
        setView('create-success');
    };

    const goHome = () => {
        setView('home');
        setVerifiedToken(null);
        setVerifiedEmail(null);
        setCreatedId(null);
        setSelectedId(null);
    };

    return (
        <div className="help-shell">
            {otpModal && (
                <OtpModal
                    purpose={otpModal}
                    onClose={() => setOtpModal(null)}
                    onVerified={handleVerified}
                />
            )}

            <div className="help-hero">
                <div className="help-hero-badge">{t('help.badge')}</div>
                <h1 className="help-hero-title">{t('help.title')}</h1>
                <p className="help-hero-sub">{t('help.subtitle')}</p>
            </div>

            <div className="help-body">

                {view === 'home' && (
                    <div className="help-cards-grid">
                        <div className="help-action-card help-action-card--primary">
                            <div className="help-action-icon">✉️</div>
                            <h3 className="help-action-title">
                                {cmsContent.create_ticket?.title || t('help.createCardTitle')}
                            </h3>
                            {cmsContent.create_ticket?.content ? (
                                <div
                                    className="help-action-cms-body"
                                    dangerouslySetInnerHTML={{ __html: cmsContent.create_ticket.content }}
                                />
                            ) : (
                                <>
                                    <p className="help-action-desc">{t('help.createCardDesc')}</p>
                                    <ul className="help-action-list">
                                        <li>{t('help.createCardItem1')}</li>
                                        <li>{t('help.createCardItem2')}</li>
                                        <li>{t('help.createCardItem3')}</li>
                                        <li>{t('help.createCardItem4')}</li>
                                    </ul>
                                </>
                            )}
                            <button className="help-action-btn" onClick={() => setOtpModal('create')}>
                                {t('help.createBtn')}
                            </button>
                        </div>

                        <div className="help-action-card">
                            <div className="help-action-icon">📋</div>
                            <h3 className="help-action-title">
                                {cmsContent.my_tickets?.title || t('help.myCardTitle')}
                            </h3>
                            {cmsContent.my_tickets?.content ? (
                                <div
                                    className="help-action-cms-body"
                                    dangerouslySetInnerHTML={{ __html: cmsContent.my_tickets.content }}
                                />
                            ) : (
                                <>
                                    <p className="help-action-desc">{t('help.myCardDesc')}</p>
                                    <ul className="help-action-list">
                                        <li>{t('help.myCardItem1')}</li>
                                        <li>{t('help.myCardItem2')}</li>
                                        <li>{t('help.myCardItem3')}</li>
                                        <li>{t('help.myCardItem4')}</li>
                                    </ul>
                                </>
                            )}
                            <button className="help-action-btn help-action-btn--outline" onClick={() => setOtpModal('view')}>
                                {t('help.myTicketBtn')}
                            </button>
                        </div>
                    </div>
                )}

                {view === 'create-form' && (
                    <CreateTicketForm
                        token={verifiedToken}
                        userEmail={verifiedEmail}
                        onCreated={handleCreated}
                        onBack={goHome}
                    />
                )}

                {view === 'create-success' && (
                    <TicketCreatedSuccess
                        ticketId={createdId}
                        onViewTickets={() => setView('my-tickets')}
                        onNewTicket={() => { setCreatedId(null); setView('create-form'); }}
                    />
                )}

                {view === 'my-tickets' && (
                    <MyTicketsList
                        token={verifiedToken}
                        userEmail={verifiedEmail}
                        onSelectTicket={(id) => { setSelectedId(id); setView('ticket-detail'); }}
                        onBack={goHome}
                    />
                )}

                {view === 'ticket-detail' && (
                    <TicketDetail
                        ticketId={selectedId}
                        token={verifiedToken}
                        userEmail={verifiedEmail}
                        onBack={() => setView('my-tickets')}
                    />
                )}

                {view === 'home' && (
                    <div className="help-faq">
                        <h3 className="help-faq-title">
                            {cmsContent.faq?.title || t('help.defaultFaqTitle')}
                        </h3>
                        <div className="help-faq-grid">
                            {faqs.map(({ id, q, a }) => (
                                <div key={id} className="help-faq-item">
                                    <div className="help-faq-q">{q}</div>
                                    <div className="help-faq-a">{a}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default HelpPage;
