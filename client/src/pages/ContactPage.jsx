import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './ContactPage.css';

const ContactPage = () => {
    const { language, t } = useLanguage();

    const [info,        setInfo]        = useState(null);
    const [infoErr,     setInfoErr]     = useState(false);
    // Languages beyond English/Hindi store their description as their own
    // cms_pages row ('contact_<lang>') — same mechanism as Terms/Privacy's
    // per-language pages (see CmsPublicPage.jsx). en/hi keep reading
    // info.content/info.content_hi below, unchanged.
    const [descOverride, setDescOverride] = useState(null);
    const [form,      setForm]      = useState({ name: '', email: '', phone: '', subject: '', message: '', website: '' });
    const [errors,    setErrors]    = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted,  setSubmitted]  = useState(false);
    const [submitErr,  setSubmitErr]  = useState('');

    useEffect(() => {
        axios.get(`${API_URL}/contact/info`)
            .then(({ data }) => setInfo(data.info))
            .catch(() => setInfoErr(true));
    }, []);

    useEffect(() => {
        if (language === 'en' || language === 'hi') { setDescOverride(null); return; }
        let cancelled = false;
        axios.get(`${API_URL}/public/cms/contact_${language}`)
            .then(({ data }) => { if (!cancelled) setDescOverride(data.page?.content || null); })
            .catch(() => { if (!cancelled) setDescOverride(null); });
        return () => { cancelled = true; };
    }, [language]);

    useEffect(() => {
        document.title = t('contact.docTitle');
    }, [t]);

    const validate = () => {
        const e = {};
        if (!form.name.trim())    e.name    = t('contact.eReqName');
        if (!form.email.trim())   e.email   = t('contact.eReqEmail');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('contact.eBadEmail');
        if (!form.phone.trim())   e.phone   = t('contact.eReqPhone');
        if (!form.subject.trim()) e.subject = t('contact.eReqSubject');
        if (!form.message.trim()) e.message = t('contact.eReqMessage');
        else if (form.message.length > 5000) e.message = t('contact.eMaxMessage');
        return e;
    };

    const handleChange = e => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
        if (errors[name]) setErrors(err => ({ ...err, [name]: '' }));
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setSubmitErr('');
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSubmitting(true);
        try {
            await axios.post(`${API_URL}/contact/submit`, { ...form, lang: language });
            setSubmitted(true);
            setForm({ name: '', email: '', phone: '', subject: '', message: '', website: '' });
        } catch (err) {
            setSubmitErr(err.response?.data?.message || t('contact.eFailSend'));
        } finally {
            setSubmitting(false);
        }
    };

    const infoCards = [
        info?.contact_email && { icon: '📧', label: t('contact.infoEmail'), value: info.contact_email, href: `mailto:${info.contact_email}` },
        info?.contact_phone && { icon: '📞', label: t('contact.infoPhone'), value: info.contact_phone, href: `tel:${info.contact_phone}` },
    ].filter(Boolean);

    return (
        <div className="contact-shell">

            {/* ── Hero ─────────────────────────────────────────────────── */}
            <div className="contact-hero">
                <div className="contact-hero-badge">{t('contact.badge')}</div>
                <h1 className="contact-hero-title">{t('contact.title')}</h1>
                <p className="contact-hero-sub">{t('contact.subtitle')}</p>
            </div>

            {/* ── Main grid ────────────────────────────────────────────── */}
            <div className="contact-grid">

                {/* Left column */}
                <aside className="contact-left">

                    {(info?.content || info?.content_hi) && (
                        <div className="contact-desc-card">
                            <div
                                className="contact-desc-body"
                                dangerouslySetInnerHTML={{
                                    __html: (language === 'hi' && info.content_hi)
                                        ? info.content_hi
                                        : (descOverride || info.content)
                                }}
                            />
                        </div>
                    )}

                    {!infoErr && infoCards.length > 0 && (
                        <div className="contact-info-cards">
                            {infoCards.map(card => (
                                <div key={card.label} className="contact-info-card">
                                    <div className="contact-info-icon">{card.icon}</div>
                                    <div className="contact-info-body">
                                        <span className="contact-info-label">{card.label}</span>
                                        {card.href
                                            ? <a className="contact-info-value" href={card.href}>{card.value}</a>
                                            : <span className="contact-info-value">{card.value}</span>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {info?.contact_map_link?.trim() && (
                        <div className="contact-map-wrap">
                            <iframe
                                title="Office Location"
                                src={info.contact_map_link.trim()}
                                width="100%"
                                height="300"
                                style={{ border: 0 }}
                                allowFullScreen=""
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                            {info?.contact_address && (
                                <div className="contact-map-address">
                                    <span>📍</span> {info.contact_address}
                                </div>
                            )}
                        </div>
                    )}
                </aside>

                {/* Right column — form */}
                <section className="contact-form-card">
                    <div className="contact-form-header">
                        <h2 className="contact-form-title">{t('contact.formTitle')}</h2>
                        <p className="contact-form-sub">{t('contact.formSub')}</p>
                    </div>

                    {submitted ? (
                        <div className="contact-success">
                            <div className="contact-success-icon">✅</div>
                            <h3>{t('contact.successTitle')}</h3>
                            <p>{t('contact.successBody')}</p>
                            <p className="contact-success-note">
                                {t('contact.successNote')}{' '}
                                <a href="/help" className="contact-success-link">{t('contact.successLink')}</a>{' '}
                                {t('contact.successNoteEnd')}
                            </p>
                            <button className="contact-btn-primary" onClick={() => setSubmitted(false)}>
                                {t('contact.sendAnother')}
                            </button>
                        </div>
                    ) : (
                        <form className="contact-form" onSubmit={handleSubmit} noValidate>
                            {/* Honeypot */}
                            <input type="text" name="website" value={form.website} onChange={handleChange}
                                tabIndex={-1} autoComplete="off" style={{ display: 'none' }} />

                            <div className="contact-form-row">
                                <div className={`contact-field ${errors.name ? 'has-error' : ''}`}>
                                    <label className="contact-label"><span>{t('contact.fName')}<span className="req"> *</span></span></label>
                                    <input className="contact-input" type="text" name="name"
                                        value={form.name} onChange={handleChange}
                                        placeholder={t('contact.fNamePH')} maxLength={255} />
                                    {errors.name && <span className="contact-error">{errors.name}</span>}
                                </div>
                                <div className={`contact-field ${errors.email ? 'has-error' : ''}`}>
                                    <label className="contact-label"><span>{t('contact.fEmail')}<span className="req"> *</span></span></label>
                                    <input className="contact-input" type="email" name="email"
                                        value={form.email} onChange={handleChange}
                                        placeholder={t('contact.fEmailPH')} maxLength={255} />
                                    {errors.email && <span className="contact-error">{errors.email}</span>}
                                </div>
                            </div>

                            <div className="contact-form-row">
                                <div className={`contact-field ${errors.phone ? 'has-error' : ''}`}>
                                    <label className="contact-label"><span>{t('contact.fPhone')}<span className="req"> *</span></span></label>
                                    <input className="contact-input" type="tel" name="phone"
                                        value={form.phone} onChange={handleChange}
                                        placeholder={t('contact.fPhonePH')} maxLength={50} />
                                    {errors.phone && <span className="contact-error">{errors.phone}</span>}
                                </div>
                                <div className={`contact-field ${errors.subject ? 'has-error' : ''}`}>
                                    <label className="contact-label"><span>{t('contact.fSubject')}<span className="req"> *</span></span></label>
                                    <input className="contact-input" type="text" name="subject"
                                        value={form.subject} onChange={handleChange}
                                        placeholder={t('contact.fSubjectPH')} maxLength={500} />
                                    {errors.subject && <span className="contact-error">{errors.subject}</span>}
                                </div>
                            </div>

                            <div className={`contact-field ${errors.message ? 'has-error' : ''}`}>
                                <label className="contact-label">
                                    <span>{t('contact.fMessage')}<span className="req"> *</span></span>
                                    <span className="contact-char-count">{form.message.length}/5000</span>
                                </label>
                                <textarea className="contact-textarea" name="message"
                                    value={form.message} onChange={handleChange}
                                    placeholder={t('contact.fMessagePH')} rows={6} maxLength={5000} />
                                {errors.message && <span className="contact-error">{errors.message}</span>}
                            </div>

                            {submitErr && <div className="contact-submit-error">{submitErr}</div>}

                            <button type="submit" className="contact-btn-primary" disabled={submitting}>
                                {submitting ? t('contact.sendingBtn') : t('contact.sendBtn')}
                            </button>
                        </form>
                    )}
                </section>

            </div>
        </div>
    );
};

export default ContactPage;
