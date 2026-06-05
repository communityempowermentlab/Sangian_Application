import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './ContactPage.css';

const T = {
    en: {
        badge:       '📬 Get in Touch',
        title:       'Contact Us',
        subtitle:    'Have a question about the Sangian Assessment Programme? Our team is here to help. Reach out through any of our channels below.',
        infoEmail:   'EMAIL',
        infoPhone:   'PHONE',
        infoAddress: 'ADDRESS',
        formTitle:   'Send Us a Message',
        formSub:     "Fill in the form and we'll get back to you shortly.",
        fName:       'Full Name',        fNamePH:    'Your full name',
        fEmail:      'Email Address',    fEmailPH:   'you@example.com',
        fPhone:      'Phone Number',     fPhonePH:   '+91 00000 00000',
        fPhoneOpt:   '(optional)',
        fSubject:    'Subject',          fSubjectPH: 'How can we help?',
        fMessage:    'Message',          fMessagePH: 'Describe your query or message in detail…',
        sendBtn:     '🚀 Send Message',  sendingBtn: '⏳ Sending…',
        eReqName:    'Full name is required.',
        eReqEmail:   'Email address is required.',
        eBadEmail:   'Enter a valid email address.',
        eReqSubject: 'Subject is required.',
        eReqMessage: 'Message is required.',
        eMaxMessage: 'Message must be under 5000 characters.',
        eFailSend:   'Failed to send. Please try again.',
        successTitle: 'Thank You for Reaching Out!',
        successBody:  'Your message has been successfully submitted to the Community Empowerment Lab team. We typically respond within 1–2 business days via the email address you provided.',
        successNote:  'In the meantime, feel free to explore our assessment platform or check our',
        successLink:  'Help & Support',
        sendAnother:  'Send Another Message',
    },
    hi: {
        badge:       '📬 संपर्क करें',
        title:       'संपर्क करें',
        subtitle:    'संज्ञान मूल्यांकन कार्यक्रम के बारे में कोई प्रश्न है? हमारी टीम आपकी मदद के लिए यहाँ है। नीचे दिए गए किसी भी माध्यम से हमसे संपर्क करें।',
        infoEmail:   'ईमेल',
        infoPhone:   'फ़ोन',
        infoAddress: 'पता',
        formTitle:   'हमें संदेश भेजें',
        formSub:     'फ़ॉर्म भरें और हम जल्द ही आपसे संपर्क करेंगे।',
        fName:       'पूरा नाम',         fNamePH:    'आपका पूरा नाम',
        fEmail:      'ईमेल पता',         fEmailPH:   'you@example.com',
        fPhone:      'फ़ोन नंबर',        fPhonePH:   '+91 00000 00000',
        fPhoneOpt:   '(वैकल्पिक)',
        fSubject:    'विषय',             fSubjectPH: 'हम कैसे मदद कर सकते हैं?',
        fMessage:    'संदेश',            fMessagePH: 'अपनी समस्या या संदेश विस्तार से लिखें…',
        sendBtn:     '🚀 संदेश भेजें',   sendingBtn: '⏳ भेज रहे हैं…',
        eReqName:    'पूरा नाम आवश्यक है।',
        eReqEmail:   'ईमेल पता आवश्यक है।',
        eBadEmail:   'एक वैध ईमेल पता दर्ज करें।',
        eReqSubject: 'विषय आवश्यक है।',
        eReqMessage: 'संदेश आवश्यक है।',
        eMaxMessage: 'संदेश 5000 अक्षरों से कम होना चाहिए।',
        eFailSend:   'भेजने में विफल। कृपया पुनः प्रयास करें।',
        successTitle: 'संपर्क करने के लिए धन्यवाद!',
        successBody:  'आपका संदेश कम्युनिटी एम्पावरमेंट लैब टीम को सफलतापूर्वक भेज दिया गया है। हम आमतौर पर 1–2 कार्य दिवसों के भीतर आपके ईमेल पते पर जवाब देते हैं।',
        successNote:  'इस दौरान, त्वरित उत्तरों के लिए हमारा',
        successLink:  'सहायता और समर्थन',
        sendAnother:  'एक और संदेश भेजें',
    },
};

const ContactPage = () => {
    const { language } = useLanguage();
    const t = T[language] || T.en;

    const [info,      setInfo]      = useState(null);
    const [infoErr,   setInfoErr]   = useState(false);
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
        document.title = 'Contact Us | Community Empowerment Lab';
    }, []);

    const validate = () => {
        const e = {};
        if (!form.name.trim())    e.name    = t.eReqName;
        if (!form.email.trim())   e.email   = t.eReqEmail;
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t.eBadEmail;
        if (!form.subject.trim()) e.subject = t.eReqSubject;
        if (!form.message.trim()) e.message = t.eReqMessage;
        else if (form.message.length > 5000) e.message = t.eMaxMessage;
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
            await axios.post(`${API_URL}/contact/submit`, form);
            setSubmitted(true);
            setForm({ name: '', email: '', phone: '', subject: '', message: '', website: '' });
        } catch (err) {
            setSubmitErr(err.response?.data?.message || t.eFailSend);
        } finally {
            setSubmitting(false);
        }
    };

    const infoCards = [
        info?.contact_email   && { icon: '📧', label: t.infoEmail,   value: info.contact_email,   href: `mailto:${info.contact_email}` },
        info?.contact_phone   && { icon: '📞', label: t.infoPhone,   value: info.contact_phone,   href: `tel:${info.contact_phone}` },
        info?.contact_address && { icon: '📍', label: t.infoAddress, value: info.contact_address, href: null },
    ].filter(Boolean);

    return (
        <div className="contact-shell">

            {/* ── Hero ─────────────────────────────────────────────────── */}
            <div className="contact-hero">
                <div className="contact-hero-badge">{t.badge}</div>
                <h1 className="contact-hero-title">{t.title}</h1>
                <p className="contact-hero-sub">{t.subtitle}</p>
            </div>

            {/* ── Main grid ────────────────────────────────────────────── */}
            <div className="contact-grid">

                {/* Left column */}
                <aside className="contact-left">

                    {info?.content && (
                        <div className="contact-desc-card">
                            <div
                                className="contact-desc-body"
                                dangerouslySetInnerHTML={{ __html: info.content }}
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

                    {info?.contact_map_link && (
                        <div className="contact-map-wrap">
                            <iframe
                                title="Office Location"
                                src={info.contact_map_link}
                                className="contact-map-iframe"
                                allowFullScreen=""
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    )}
                </aside>

                {/* Right column — form */}
                <section className="contact-form-card">
                    <div className="contact-form-header">
                        <h2 className="contact-form-title">{t.formTitle}</h2>
                        <p className="contact-form-sub">{t.formSub}</p>
                    </div>

                    {submitted ? (
                        <div className="contact-success">
                            <div className="contact-success-icon">✅</div>
                            <h3>{t.successTitle}</h3>
                            <p>{t.successBody}</p>
                            <p className="contact-success-note">
                                {t.successNote}{' '}
                                <a href="/help" className="contact-success-link">{t.successLink}</a>{' '}
                                {language === 'hi' ? 'देखें।' : 'section for quick answers.'}
                            </p>
                            <button className="contact-btn-primary" onClick={() => setSubmitted(false)}>
                                {t.sendAnother}
                            </button>
                        </div>
                    ) : (
                        <form className="contact-form" onSubmit={handleSubmit} noValidate>
                            {/* Honeypot */}
                            <input type="text" name="website" value={form.website} onChange={handleChange}
                                tabIndex={-1} autoComplete="off" style={{ display: 'none' }} />

                            <div className="contact-form-row">
                                <div className={`contact-field ${errors.name ? 'has-error' : ''}`}>
                                    <label className="contact-label">{t.fName} <span className="req">*</span></label>
                                    <input className="contact-input" type="text" name="name"
                                        value={form.name} onChange={handleChange}
                                        placeholder={t.fNamePH} maxLength={255} />
                                    {errors.name && <span className="contact-error">{errors.name}</span>}
                                </div>
                                <div className={`contact-field ${errors.email ? 'has-error' : ''}`}>
                                    <label className="contact-label">{t.fEmail} <span className="req">*</span></label>
                                    <input className="contact-input" type="email" name="email"
                                        value={form.email} onChange={handleChange}
                                        placeholder={t.fEmailPH} maxLength={255} />
                                    {errors.email && <span className="contact-error">{errors.email}</span>}
                                </div>
                            </div>

                            <div className="contact-form-row">
                                <div className="contact-field">
                                    <label className="contact-label">{t.fPhone} <span className="contact-optional">{t.fPhoneOpt}</span></label>
                                    <input className="contact-input" type="tel" name="phone"
                                        value={form.phone} onChange={handleChange}
                                        placeholder={t.fPhonePH} maxLength={50} />
                                </div>
                                <div className={`contact-field ${errors.subject ? 'has-error' : ''}`}>
                                    <label className="contact-label">{t.fSubject} <span className="req">*</span></label>
                                    <input className="contact-input" type="text" name="subject"
                                        value={form.subject} onChange={handleChange}
                                        placeholder={t.fSubjectPH} maxLength={500} />
                                    {errors.subject && <span className="contact-error">{errors.subject}</span>}
                                </div>
                            </div>

                            <div className={`contact-field ${errors.message ? 'has-error' : ''}`}>
                                <label className="contact-label">
                                    {t.fMessage} <span className="req">*</span>
                                    <span className="contact-char-count">{form.message.length}/5000</span>
                                </label>
                                <textarea className="contact-textarea" name="message"
                                    value={form.message} onChange={handleChange}
                                    placeholder={t.fMessagePH} rows={6} maxLength={5000} />
                                {errors.message && <span className="contact-error">{errors.message}</span>}
                            </div>

                            {submitErr && <div className="contact-submit-error">{submitErr}</div>}

                            <button type="submit" className="contact-btn-primary" disabled={submitting}>
                                {submitting ? t.sendingBtn : t.sendBtn}
                            </button>
                        </form>
                    )}
                </section>

            </div>
        </div>
    );
};

export default ContactPage;
