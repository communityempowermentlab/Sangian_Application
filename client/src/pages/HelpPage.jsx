import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './HelpPage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SERVER_BASE = API_URL.replace(/\/api$/, '');

const STATUS_META = {
    open:             { label: 'Open',               cls: 'badge-open'    },
    in_progress:      { label: 'In Progress',         cls: 'badge-progress'},
    waiting_for_user: { label: 'Waiting for Reply',   cls: 'badge-waiting' },
    resolved:         { label: 'Resolved',            cls: 'badge-resolved'},
    closed:           { label: 'Closed',              cls: 'badge-closed'  },
};

const StatusBadge = ({ status }) => {
    const m = STATUS_META[status] || { label: status, cls: 'badge-open' };
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
    const [step,       setStep]       = useState('email'); // 'email' | 'otp'
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
            setError('Please enter a valid email address.');
            return;
        }
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/tickets/send-otp`, { email });
            setDevOtp(data.devOtp || null);
            setStep('otp');
            startResendTimer();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        if (!otpVal.trim()) { setError('Please enter the OTP.'); return; }
        setLoading(true);
        try {
            const { data } = await axios.post(`${API_URL}/tickets/verify-otp`, {
                email: emailVal.trim().toLowerCase(),
                otp:   otpVal.trim(),
            });
            onVerified(data.token, data.email);
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const purposeLabel = purpose === 'create' ? 'Create New Ticket' : 'Access My Tickets';

    return (
        <div className="otp-overlay" onClick={onClose}>
            <div className="otp-card" onClick={e => e.stopPropagation()}>
                <button className="otp-close" onClick={onClose}>✕</button>

                <div className="otp-icon">🔐</div>
                <h2 className="otp-title">Verify Your Email</h2>
                <p className="otp-sub">
                    We'll send a one-time code to confirm your email before you can <strong>{purposeLabel}</strong>.
                </p>

                {error && <div className="otp-error">{error}</div>}

                {step === 'email' ? (
                    <form onSubmit={handleSendOtp} className="otp-form">
                        <label className="otp-label">Email Address</label>
                        <input
                            type="email"
                            className="otp-input"
                            placeholder="you@example.com"
                            value={emailVal}
                            onChange={e => setEmailVal(e.target.value)}
                            autoFocus
                        />
                        <button className="otp-btn" disabled={loading}>
                            {loading ? 'Sending…' : 'Send Verification Code'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="otp-form">
                        <p className="otp-sent-to">Code sent to <strong>{emailVal}</strong></p>

                        {devOtp && (
                            <div className="otp-dev-banner">
                                <span className="otp-dev-label">⚠️ Dev Mode — SMTP not configured</span>
                                <span className="otp-dev-code">{devOtp}</span>
                                <button
                                    type="button"
                                    className="otp-dev-fill"
                                    onClick={() => setOtpVal(devOtp)}
                                >
                                    Auto-fill
                                </button>
                            </div>
                        )}

                        <label className="otp-label">6-Digit Code</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            className="otp-input otp-input--code"
                            placeholder="• • • • • •"
                            value={otpVal}
                            onChange={e => setOtpVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            autoFocus
                        />
                        <button className="otp-btn" disabled={loading}>
                            {loading ? 'Verifying…' : 'Verify & Continue'}
                        </button>
                        <button
                            type="button"
                            className="otp-resend"
                            disabled={resendSecs > 0 || loading}
                            onClick={handleSendOtp}
                        >
                            {resendSecs > 0 ? `Resend OTP in ${resendSecs}s` : 'Resend OTP'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

// ── File Upload Preview ────────────────────────────────────────────────────────
const FileUploadBox = ({ files, setFiles, maxFiles = 3 }) => {
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
                    <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="file-chip-thumb"
                    />
                    <span className="file-chip-name">{f.name}</span>
                    <button type="button" className="file-chip-remove" onClick={() => remove(i)}>✕</button>
                </div>
            ))}
            {files.length < maxFiles && (
                <button type="button" className="file-add-btn" onClick={() => inputRef.current.click()}>
                    📎 Add Image
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
            <span className="file-hint">{files.length}/{maxFiles} · JPG, PNG, WEBP · max 5 MB each</span>
        </div>
    );
};

// ── Ticket Create Form ────────────────────────────────────────────────────────
const CreateTicketForm = ({ token, userEmail, onCreated, onBack }) => {
    const [title,    setTitle]    = useState('');
    const [desc,     setDesc]     = useState('');
    const [files,    setFiles]    = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!title.trim()) { setError('Ticket title is required.'); return; }
        if (!desc.trim())  { setError('Description is required.'); return; }

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
            setError(err.response?.data?.error || 'Failed to create ticket. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="help-section">
            <button className="help-back-btn" onClick={onBack}>← Back</button>
            <div className="help-section-header">
                <h2 className="help-section-title">Create New Ticket</h2>
                <p className="help-section-sub">Verified as <strong>{userEmail}</strong></p>
            </div>

            {error && <div className="help-error">{error}</div>}

            <form className="ticket-form" onSubmit={handleSubmit}>
                <div className="ticket-field">
                    <label className="ticket-label">Subject / Title <span className="req">*</span></label>
                    <input
                        type="text"
                        className="ticket-input"
                        placeholder="Brief description of your issue…"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        maxLength={200}
                    />
                    <span className="ticket-count">{title.length}/200</span>
                </div>

                <div className="ticket-field">
                    <label className="ticket-label">Description <span className="req">*</span></label>
                    <textarea
                        className="ticket-textarea"
                        placeholder="Describe your issue in detail — what happened, what you expected, and any steps to reproduce…"
                        rows={6}
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                    />
                </div>

                <div className="ticket-field">
                    <label className="ticket-label">Attachments <span className="ticket-optional">(optional)</span></label>
                    <FileUploadBox files={files} setFiles={setFiles} maxFiles={3} />
                </div>

                <button className="ticket-submit-btn" disabled={loading}>
                    {loading ? 'Submitting…' : '🎫 Submit Ticket'}
                </button>
            </form>
        </div>
    );
};

// ── Ticket Created Success ────────────────────────────────────────────────────
const TicketCreatedSuccess = ({ ticketId, onViewTickets, onNewTicket }) => (
    <div className="help-section help-success-section">
        <div className="help-success-icon">🎉</div>
        <h2 className="help-success-title">Ticket Submitted!</h2>
        <p className="help-success-sub">Your support ticket has been created. We'll get back to you within 1–2 business days.</p>
        <div className="help-success-id">
            <span className="help-success-id-label">Your Ticket ID</span>
            <span className="help-success-id-value">{ticketId}</span>
        </div>
        <p className="help-success-note">Keep this ID handy — you'll need it to track your ticket.</p>
        <div className="help-success-actions">
            <button className="ticket-submit-btn" onClick={onViewTickets}>View My Tickets</button>
            <button className="help-outline-btn" onClick={onNewTicket}>Create Another Ticket</button>
        </div>
    </div>
);

// ── My Tickets List ───────────────────────────────────────────────────────────
const MyTicketsList = ({ token, userEmail, onSelectTicket, onBack }) => {
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
                setError(err.response?.data?.error || 'Failed to load tickets.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [token]);

    if (loading) return (
        <div className="help-section">
            <div className="help-spinner-wrap"><div className="help-spinner" /></div>
        </div>
    );

    return (
        <div className="help-section">
            <button className="help-back-btn" onClick={onBack}>← Back</button>
            <div className="help-section-header">
                <h2 className="help-section-title">My Tickets</h2>
                <p className="help-section-sub">Viewing tickets for <strong>{userEmail}</strong></p>
            </div>

            {error && <div className="help-error">{error}</div>}

            {!error && tickets.length === 0 && (
                <div className="help-empty">
                    <div className="help-empty-icon">🎫</div>
                    <p>No tickets found for this email address.</p>
                </div>
            )}

            <div className="ticket-list">
                {tickets.map(t => (
                    <button key={t.ticket_id} className="ticket-list-item" onClick={() => onSelectTicket(t.ticket_id)}>
                        <div className="tli-header">
                            <span className="tli-id">{t.ticket_id}</span>
                            <StatusBadge status={t.status} />
                        </div>
                        <div className="tli-title">{t.title}</div>
                        <div className="tli-date">Created {fmtDateShort(t.created_at)}</div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ── Ticket Detail ─────────────────────────────────────────────────────────────
const TicketDetail = ({ ticketId, token, userEmail, onBack }) => {
    const [ticket,   setTicket]   = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [replyMsg, setReplyMsg] = useState('');
    const [replyFiles, setReplyFiles] = useState([]);
    const [sending,  setSending]  = useState(false);
    const [sendErr,  setSendErr]  = useState('');
    const threadRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API_URL}/tickets/${ticketId}`, {
                headers: { 'x-ticket-token': token },
            });
            setTicket(data.ticket);
            setMessages(data.messages);
            setTimeout(() => {
                if (threadRef.current) {
                    threadRef.current.scrollTop = threadRef.current.scrollHeight;
                }
            }, 50);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load ticket.');
        } finally {
            setLoading(false);
        }
    }, [ticketId, token]);

    useEffect(() => { load(); }, [load]);

    const handleReply = async (e) => {
        e.preventDefault();
        setSendErr('');
        if (!replyMsg.trim()) { setSendErr('Please type a message before sending.'); return; }

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
            setSendErr(err.response?.data?.error || 'Failed to send reply.');
        } finally {
            setSending(false);
        }
    };

    if (loading) return (
        <div className="help-section">
            <div className="help-spinner-wrap"><div className="help-spinner" /></div>
        </div>
    );
    if (error)  return (
        <div className="help-section">
            <button className="help-back-btn" onClick={onBack}>← Back</button>
            <div className="help-error">{error}</div>
        </div>
    );

    const isClosed = ticket?.status === 'closed';

    return (
        <div className="help-section td-shell">
            <button className="help-back-btn" onClick={onBack}>← My Tickets</button>

            {/* Ticket header */}
            <div className="td-header">
                <div className="td-meta">
                    <span className="td-id">{ticket.ticket_id}</span>
                    <StatusBadge status={ticket.status} />
                </div>
                <h2 className="td-title">{ticket.title}</h2>
                <p className="td-date">Opened {fmtDate(ticket.created_at)}</p>
            </div>

            {/* Conversation thread */}
            <div className="td-thread" ref={threadRef}>
                {messages.map((m) => {
                    const isUser  = m.sender_type === 'user';
                    const attachs = m.attachments
                        ? (typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments)
                        : [];
                    return (
                        <div key={m.id} className={`msg-bubble ${isUser ? 'msg-user' : 'msg-admin'}`}>
                            <div className="msg-sender">{isUser ? '👤 You' : '🛡️ Support Team'}</div>
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

            {/* Reply box */}
            {isClosed ? (
                <div className="td-closed-note">This ticket is closed. Please create a new ticket if you need further assistance.</div>
            ) : (
                <form className="td-reply-form" onSubmit={handleReply}>
                    {sendErr && <div className="help-error">{sendErr}</div>}
                    <textarea
                        className="td-reply-input"
                        placeholder="Write your reply…"
                        rows={4}
                        value={replyMsg}
                        onChange={e => setReplyMsg(e.target.value)}
                        disabled={sending}
                    />
                    <div className="td-reply-footer">
                        <FileUploadBox files={replyFiles} setFiles={setReplyFiles} maxFiles={3} />
                        <button className="ticket-submit-btn td-send-btn" disabled={sending}>
                            {sending ? 'Sending…' : '📤 Send Reply'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

// ── Default FAQs (fallback if API unavailable) ────────────────────────────────
const DEFAULT_FAQS = [
    { id: '1', q: 'How long does it take to get a response?',  a: 'Our team typically responds within 1–2 business days. Complex issues may take slightly longer.' },
    { id: '2', q: 'What types of issues can I raise?',          a: 'Technical bugs, login problems, game session issues, data concerns, or any platform-related questions.' },
    { id: '3', q: 'Can I attach screenshots?',                  a: 'Yes — you can attach up to 3 images (JPG, PNG, or WEBP, max 5 MB each) when creating a ticket or replying.' },
    { id: '4', q: 'How do I track my ticket?',                  a: 'Use "My Tickets" with your verified email to see the full conversation thread and current status.' },
];

const HELP_T = {
    en: {
        badge:    '🎫 Help & Support',
        title:    'How can we help you?',
        subtitle: 'Our support team is here to assist you with any issues related to the Sangian Assessment Platform. Create a ticket and we\'ll respond within 1–2 business days.',
        createBtn:  'Create Ticket →',
        myTicketBtn:'View My Tickets →',
        defaultCreateTitle: 'Create New Ticket',
        defaultMyTitle:     'My Tickets',
        defaultFaqTitle:    'Frequently Asked Questions',
    },
    hi: {
        badge:    '🎫 सहायता और समर्थन',
        title:    'हम आपकी कैसे मदद कर सकते हैं?',
        subtitle: 'हमारी सपोर्ट टीम संज्ञान मूल्यांकन प्लेटफ़ॉर्म से संबंधित किसी भी समस्या में आपकी मदद के लिए यहाँ है। टिकट बनाएं और हम 1–2 कार्य दिवसों में जवाब देंगे।',
        createBtn:  'टिकट बनाएं →',
        myTicketBtn:'मेरे टिकट देखें →',
        defaultCreateTitle: 'नया सपोर्ट टिकट बनाएं',
        defaultMyTitle:     'मेरे टिकट',
        defaultFaqTitle:    'अक्सर पूछे जाने वाले प्रश्न',
    },
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HelpPage
// ══════════════════════════════════════════════════════════════════════════════
const HelpPage = () => {
    const { language } = useLanguage();
    const ht = HELP_T[language] || HELP_T.en;

    // view: 'home' | 'create-form' | 'create-success' | 'my-tickets' | 'ticket-detail'
    const [view,          setView]          = useState('home');
    const [otpModal,      setOtpModal]      = useState(null); // null | 'create' | 'view'
    const [verifiedToken, setVerifiedToken] = useState(null);
    const [verifiedEmail, setVerifiedEmail] = useState(null);
    const [createdId,     setCreatedId]     = useState(null);
    const [selectedId,    setSelectedId]    = useState(null);
    const [faqs,          setFaqs]          = useState(DEFAULT_FAQS);
    const [cmsContent,    setCmsContent]    = useState({});

    // Load all section content (bilingual) + FAQs
    useEffect(() => {
        const lang = language || 'en';
        axios.get(`${API_URL}/help-content/all/${lang}`)
            .then(({ data }) => {
                if (data.content) {
                    setCmsContent(data.content);
                    // Extract FAQs from the faq section if available
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
            {/* ── OTP Modal ────────────────────────────────────────────────── */}
            {otpModal && (
                <OtpModal
                    purpose={otpModal}
                    onClose={() => setOtpModal(null)}
                    onVerified={handleVerified}
                />
            )}

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div className="help-hero">
                <div className="help-hero-badge">{ht.badge}</div>
                <h1 className="help-hero-title">{ht.title}</h1>
                <p className="help-hero-sub">{ht.subtitle}</p>
            </div>

            {/* ── Content ──────────────────────────────────────────────────── */}
            <div className="help-body">

                {view === 'home' && (
                    <div className="help-cards-grid">
                        {/* Create ticket card */}
                        <div className="help-action-card help-action-card--primary">
                            <div className="help-action-icon">✉️</div>
                            <h3 className="help-action-title">
                                {cmsContent.create_ticket?.title || ht.defaultCreateTitle}
                            </h3>
                            {cmsContent.create_ticket?.content ? (
                                <div
                                    className="help-action-cms-body"
                                    dangerouslySetInnerHTML={{ __html: cmsContent.create_ticket.content }}
                                />
                            ) : (
                                <>
                                    <p className="help-action-desc">
                                        Have an issue or question? Submit a support ticket and we'll get back to you as soon as possible.
                                    </p>
                                    <ul className="help-action-list">
                                        <li>Email verification required</li>
                                        <li>Attach up to 3 screenshots</li>
                                        <li>Unique Ticket ID assigned</li>
                                        <li>Email confirmation sent</li>
                                    </ul>
                                </>
                            )}
                            <button
                                className="help-action-btn"
                                onClick={() => setOtpModal('create')}
                            >
                                {ht.createBtn}
                            </button>
                        </div>

                        {/* My tickets card */}
                        <div className="help-action-card">
                            <div className="help-action-icon">📋</div>
                            <h3 className="help-action-title">
                                {cmsContent.my_tickets?.title || ht.defaultMyTitle}
                            </h3>
                            {cmsContent.my_tickets?.content ? (
                                <div
                                    className="help-action-cms-body"
                                    dangerouslySetInnerHTML={{ __html: cmsContent.my_tickets.content }}
                                />
                            ) : (
                                <>
                                    <p className="help-action-desc">
                                        Already submitted a ticket? Access your ticket history and continue the conversation with our team.
                                    </p>
                                    <ul className="help-action-list">
                                        <li>View all your tickets</li>
                                        <li>Full conversation history</li>
                                        <li>Reply and add attachments</li>
                                        <li>Track ticket status live</li>
                                    </ul>
                                </>
                            )}
                            <button
                                className="help-action-btn help-action-btn--outline"
                                onClick={() => setOtpModal('view')}
                            >
                                {ht.myTicketBtn}
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
                        onNewTicket={() => {
                            setCreatedId(null);
                            setView('create-form');
                        }}
                    />
                )}

                {view === 'my-tickets' && (
                    <MyTicketsList
                        token={verifiedToken}
                        userEmail={verifiedEmail}
                        onSelectTicket={(id) => {
                            setSelectedId(id);
                            setView('ticket-detail');
                        }}
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

                {/* ── FAQ strip ─────────────────────────────────────────── */}
                {view === 'home' && (
                    <div className="help-faq">
                        <h3 className="help-faq-title">
                            {cmsContent.faq?.title || ht.defaultFaqTitle}
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
