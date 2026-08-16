import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../services/api';
import OtpGate from '../../components/shared/OtpGate';
import PasswordStrengthChecklist, { isStrongPassword } from '../../components/shared/PasswordStrengthChecklist';
import CmsModal from '../../components/shared/CmsModal';

// Inline-in-a-sentence trigger for the consent checkbox's Terms/Privacy
// links — visually a link, but a real <button> so it never submits the
// surrounding <form>.
const ConsentLink = ({ onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: '#4f46e5', textDecoration: 'underline', cursor: 'pointer' }}
    >
        {children}
    </button>
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Indian mobile: optional +91/91 prefix, optional leading 0, then 10 digits
// starting 6-9 — matches server/src/utils/mobileNumber.js's normalizer.
const MOBILE_RE = /^(\+?91[-\s]?)?0?[6-9]\d{9}$/;

// Fallback shown before the managed list loads (or if that fetch fails) —
// keeps the form usable offline-first rather than blocking on the network.
// The authoritative list is managed at Admin > Meta > Organization Types
// (orgTypeController.js) and fetched from /api/public/org-types below.
const FALLBACK_ORG_TYPES = [
    { value: 'ngo', label: 'NGO' },
    { value: 'school', label: 'School' },
    { value: 'hospital', label: 'Hospital' },
    { value: 'government', label: 'Government Department' },
    { value: 'other', label: 'Other' },
];

const EMPTY_INDIVIDUAL = { full_name: '', email: '', mobile: '', password: '', dobDay: '', dobMonth: '', dobYear: '', gender: '' };
const GENDER_OPTIONS = [
    ['male', 'Male'],
    ['female', 'Female'],
];
const DOB_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOB_CURRENT_YEAR = new Date().getFullYear();

// Mirrors AdminChildAdd.jsx's calculateAge — years/months/days as-of today,
// or null while the three DOB dropdowns aren't all filled in yet.
const calculateAge = (day, month, year) => {
    if (!day || !month || !year) return null;
    const dobDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (isNaN(dobDate.getTime())) return null;

    const today = new Date();
    let years = today.getFullYear() - dobDate.getFullYear();
    let months = today.getMonth() - dobDate.getMonth();
    let days = today.getDate() - dobDate.getDate();

    if (days < 0) {
        months--;
        days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }
    return { years, months, days };
};
const EMPTY_ORG = {
    org_name: '', org_type: '', org_email: '', org_mobile: '',
    address: '', city: '', state: '', country: '',
    contact_person_name: '', contact_person_designation: '',
    password: '',
};

// Single registration page for both account types — the accountType toggle
// is the first field; switching it swaps the fields below without leaving
// the page. Reached at both /signup/registration and /signup/organization
// (the route just decides the initial toggle position, via useLocation
// below), and from the /signup chooser.
const UnifiedRegister = () => {
    const location = useLocation();
    const [accountType, setAccountType] = useState(location.pathname.includes('organization') ? 'organization' : 'individual');

    const [orgTypes, setOrgTypes] = useState(FALLBACK_ORG_TYPES);
    useEffect(() => {
        axios.get(`${API_URL}/public/org-types`)
            .then(({ data }) => { if (data.orgTypes?.length) setOrgTypes(data.orgTypes); })
            .catch(() => {}); // keep FALLBACK_ORG_TYPES on failure
    }, []);

    // ── Individual state ────────────────────────────────────────────────
    const [indForm, setIndForm] = useState(EMPTY_INDIVIDUAL);
    const [indEmailVerified, setIndEmailVerified] = useState(false);
    const [indMobileVerified, setIndMobileVerified] = useState(false);
    // Set when OtpGate reports the field is already registered — lets
    // submit-time validation reuse that exact reason instead of a
    // contradictory generic "please verify" message (see OtpGate.jsx's
    // onAlreadyRegistered).
    const [indEmailTakenMsg, setIndEmailTakenMsg] = useState('');
    const [indMobileTakenMsg, setIndMobileTakenMsg] = useState('');
    const [indErrors, setIndErrors] = useState({});
    const [indConsentAccepted, setIndConsentAccepted] = useState(false);
    const [showIndPassword, setShowIndPassword] = useState(false);
    const [showOrgPassword, setShowOrgPassword] = useState(false);
    const indAge = calculateAge(indForm.dobDay, indForm.dobMonth, indForm.dobYear);

    // ── Organization state ──────────────────────────────────────────────
    const [orgForm, setOrgForm] = useState(EMPTY_ORG);
    const [orgEmailVerified, setOrgEmailVerified] = useState(false);
    const [orgMobileVerified, setOrgMobileVerified] = useState(false);
    const [orgEmailTakenMsg, setOrgEmailTakenMsg] = useState('');
    const [orgMobileTakenMsg, setOrgMobileTakenMsg] = useState('');
    const [orgErrors, setOrgErrors] = useState({});
    const [orgConsentAccepted, setOrgConsentAccepted] = useState(false);

    const [serverMsg, setServerMsg] = useState({ type: '', text: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Shared by both forms — only one can be open at a time. { pageKey, label } | null
    const [cmsModal, setCmsModal] = useState(null);

    const switchType = (type) => {
        setAccountType(type);
        setServerMsg({ type: '', text: '' });
    };

    // ── Individual handlers ─────────────────────────────────────────────
    const handleIndChange = (e) => {
        const { name, value } = e.target;
        setIndForm(prev => ({ ...prev, [name]: value }));
        if (indErrors[name]) setIndErrors(prev => ({ ...prev, [name]: '' }));
        if (['dobDay', 'dobMonth', 'dobYear'].includes(name) && indErrors.dob) setIndErrors(prev => ({ ...prev, dob: '' }));
        if (name === 'email' && indEmailVerified) setIndEmailVerified(false);
        if (name === 'mobile' && indMobileVerified) setIndMobileVerified(false);
        if (name === 'email' && indEmailTakenMsg) setIndEmailTakenMsg('');
        if (name === 'mobile' && indMobileTakenMsg) setIndMobileTakenMsg('');
    };
    const indEmailIsValid = EMAIL_RE.test(indForm.email.trim());
    const indMobileIsValid = MOBILE_RE.test(indForm.mobile.trim());
    // Day/Month/Year dropdowns compose into the same 'YYYY-MM-DD' string
    // the backend expects — mirrors AdminChildAdd.jsx's getDobString().
    const indDobString = (indForm.dobDay && indForm.dobMonth && indForm.dobYear)
        ? `${indForm.dobYear}-${indForm.dobMonth.padStart(2, '0')}-${indForm.dobDay.padStart(2, '0')}`
        : '';

    const validateIndividual = () => {
        const e = {};
        if (!indForm.full_name.trim()) e.full_name = 'Full name is required.';
        if (!indEmailIsValid) e.email = 'A valid email address is required.';
        if (!indMobileIsValid) e.mobile = 'A valid 10-digit Indian mobile number is required.';
        if (indEmailTakenMsg) e.email = indEmailTakenMsg;
        else if (!indEmailVerified) e.email = e.email || 'Please verify your email with OTP.';
        if (indMobileTakenMsg) e.mobile = indMobileTakenMsg;
        else if (!indMobileVerified) e.mobile = e.mobile || 'Please verify your mobile number with OTP.';
        if (!isStrongPassword(indForm.password)) e.password = 'Password does not meet the requirements below.';
        if (!indDobString || isNaN(new Date(indDobString).getTime())) e.dob = 'Date of birth is required.';
        if (!indForm.gender) e.gender = 'Please select a gender.';
        if (!indConsentAccepted) e.consent = 'Please agree to the Terms & Conditions and Privacy Policy to continue.';
        setIndErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── Organization handlers ───────────────────────────────────────────
    const handleOrgChange = (e) => {
        const { name, value } = e.target;
        setOrgForm(prev => ({ ...prev, [name]: value }));
        if (orgErrors[name]) setOrgErrors(prev => ({ ...prev, [name]: '' }));
        if (name === 'org_email' && orgEmailVerified) setOrgEmailVerified(false);
        if (name === 'org_mobile' && orgMobileVerified) setOrgMobileVerified(false);
        if (name === 'org_email' && orgEmailTakenMsg) setOrgEmailTakenMsg('');
        if (name === 'org_mobile' && orgMobileTakenMsg) setOrgMobileTakenMsg('');
    };
    const orgEmailIsValid = EMAIL_RE.test(orgForm.org_email.trim());
    const orgMobileIsValid = MOBILE_RE.test(orgForm.org_mobile.trim());

    const validateOrganization = () => {
        const e = {};
        if (!orgForm.org_name.trim()) e.org_name = 'Organization name is required.';
        if (!orgEmailIsValid) e.org_email = 'A valid organization email is required.';
        if (!orgMobileIsValid) e.org_mobile = 'A valid 10-digit Indian mobile number is required.';
        if (orgEmailTakenMsg) e.org_email = orgEmailTakenMsg;
        else if (!orgEmailVerified) e.org_email = e.org_email || 'Please verify the organization email with OTP.';
        if (orgMobileTakenMsg) e.org_mobile = orgMobileTakenMsg;
        else if (!orgMobileVerified) e.org_mobile = e.org_mobile || 'Please verify the organization mobile number with OTP.';
        if (!orgForm.contact_person_name.trim()) e.contact_person_name = 'Contact person name is required.';
        if (!isStrongPassword(orgForm.password)) e.password = 'Password does not meet the requirements below.';
        if (!orgConsentAccepted) e.consent = 'Please agree to the Terms & Conditions and Privacy Policy to continue.';
        setOrgErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerMsg({ type: '', text: '' });

        if (accountType === 'individual') {
            if (!validateIndividual()) return;
            setIsSubmitting(true);
            try {
                const { data } = await axios.post(`${API_URL}/individual/register`, { ...indForm, dob: indDobString });
                localStorage.setItem('individualToken', data.token);
                localStorage.setItem('individualUser', JSON.stringify(data.user));
                setServerMsg({ type: 'ok', text: '' });
            } catch (err) {
                setServerMsg({ type: 'err', text: err.response?.data?.message || 'Registration failed. Please try again.' });
            } finally {
                setIsSubmitting(false);
            }
        } else {
            if (!validateOrganization()) return;
            setIsSubmitting(true);
            try {
                const { data } = await axios.post(`${API_URL}/org/register`, orgForm);
                setServerMsg({ type: 'ok', text: data.message || 'Registration submitted for approval.' });
            } catch (err) {
                setServerMsg({ type: 'err', text: err.response?.data?.message || 'Registration failed. Please try again.' });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const isIndividual = accountType === 'individual';

    return (
        <main className="main-shell">
            <section className="register-shell">
                <div className="register-card">
                    <div className="register-left">
                        <div className="register-pill">{isIndividual ? 'Individual Registration' : 'Organization Registration'}</div>
                        <h1 className="register-heading">
                            {isIndividual ? <>Your Own<br /><span>Sangian Account</span></> : <>Bring Your<br /><span>Organization Onboard</span></>}
                        </h1>
                        <p className="register-text">
                            {isIndividual
                                ? "Register as an individual to get a personal account — for independent professionals, parents, or volunteers who aren't part of a registered organization."
                                : "Register your NGO, school, or institution to manage your own children, staff, supervisors, and volunteers on Sangian — fully isolated from every other organization."}
                        </p>
                        <ul className="register-bullets">
                            <li>Verify your email and mobile number with a one-time code.</li>
                            {isIndividual
                                ? <li>No approval wait — your account is active as soon as you register.</li>
                                : <li>An administrator reviews and approves new organizations before login is enabled.</li>}
                            <li>Use the toggle on the right to switch between Individual and Organization at any time.</li>
                        </ul>
                    </div>

                    <div className="register-right">
                        {serverMsg.type === 'ok' ? (
                            isIndividual ? (
                                <div>
                                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 14px' }}>Registration Successful!</h2>
                                    <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.6, margin: '0 0 12px' }}>Congratulations! Your account has been created successfully.</p>
                                    <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.6, margin: '0 0 12px' }}>You can now log in to the application and start playing the assessments/games.</p>
                                    <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.6, margin: '0 0 20px' }}>A welcome email containing complete instructions has been sent to your registered email address.</p>
                                    <a href="/" className="btn form-btn-primary" style={{ padding: '10px 24px', display: 'inline-block' }}>Continue to Sangian</a>
                                </div>
                            ) : (
                                <div>
                                    <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 14px' }}>Registration Submitted</h2>
                                    <p style={{ color: '#374151', fontSize: '15px', lineHeight: 1.6, margin: '0 0 20px' }}>{serverMsg.text}</p>
                                    <a href="/" className="form-link">Return home</a>
                                </div>
                            )
                        ) : (
                        <>
                        {/* First field — account type toggle */}
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                            <label>Registering as<span className="required">*</span></label>
                            <div style={{ display: 'flex', gap: '8px', padding: '4px', background: '#f3f4f6', borderRadius: '12px' }}>
                                {[
                                    ['individual', '🧑 Individual'],
                                    ['organization', '🏢 Organization'],
                                ].map(([value, label]) => (
                                    <button
                                        type="button"
                                        key={value}
                                        onClick={() => switchType(value)}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                            fontWeight: 700, fontSize: '13.5px', fontFamily: 'inherit',
                                            background: accountType === value ? '#fff' : 'transparent',
                                            color: accountType === value ? '#4f46e5' : '#6b7280',
                                            boxShadow: accountType === value ? '0 2px 8px rgba(15,23,42,0.12)' : 'none',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {serverMsg.text && (
                            <div className="form-success" style={{ display: 'block', backgroundColor: '#fef2f2', borderColor: '#ef4444', color: '#991b1b' }}>
                                {serverMsg.text}
                            </div>
                        )}

                        {isIndividual ? (
                            <form className="register-form" onSubmit={handleSubmit} noValidate>
                                <div className="form-group">
                                    <label htmlFor="full_name">Full Name<span className="required">*</span></label>
                                    <input id="full_name" name="full_name" value={indForm.full_name} onChange={handleIndChange} placeholder="Jane Doe" className={indErrors.full_name ? 'input-error' : ''} />
                                    <p className="field-error">{indErrors.full_name}</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="ind_email">Email Address<span className="required">*</span></label>
                                    <input id="ind_email" name="email" type="email" value={indForm.email} onChange={handleIndChange} placeholder="jane@example.com" className={indErrors.email ? 'input-error' : ''} />
                                    <OtpGate channel="email" identifier={indForm.email.trim().toLowerCase()} purpose="individual_registration" isValid={indEmailIsValid} verified={indEmailVerified} onVerified={() => setIndEmailVerified(true)} onAlreadyRegistered={setIndEmailTakenMsg} />
                                    <p className="field-error">{indErrors.email}</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="ind_mobile">Mobile Number<span className="required">*</span></label>
                                    <input id="ind_mobile" name="mobile" value={indForm.mobile} onChange={handleIndChange} placeholder="9876543210" maxLength={15} inputMode="tel" className={indErrors.mobile ? 'input-error' : ''} />
                                    <OtpGate channel="phone" identifier={indForm.mobile.trim()} purpose="individual_registration" isValid={indMobileIsValid} verified={indMobileVerified} onVerified={() => setIndMobileVerified(true)} onAlreadyRegistered={setIndMobileTakenMsg} />
                                    <p className="field-error">{indErrors.mobile}</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="ind_dob_day" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Date of Birth<span className="required">*</span></span>
                                        {indAge && indAge.years >= 0 && (
                                            <span style={{ color: '#4f46e5', fontWeight: 'bold', fontSize: '13px' }}>
                                                {indAge.years}y {indAge.months}m {indAge.days}d
                                            </span>
                                        )}
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <select id="ind_dob_day" name="dobDay" value={indForm.dobDay} onChange={handleIndChange} className={indErrors.dob ? 'input-error' : ''} style={{ flex: 1 }}>
                                            <option value="">Day</option>
                                            {[...Array(31)].map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                                        </select>
                                        <select id="ind_dob_month" name="dobMonth" value={indForm.dobMonth} onChange={handleIndChange} className={indErrors.dob ? 'input-error' : ''} style={{ flex: 1 }}>
                                            <option value="">Month</option>
                                            {DOB_MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                                        </select>
                                        <select id="ind_dob_year" name="dobYear" value={indForm.dobYear} onChange={handleIndChange} className={indErrors.dob ? 'input-error' : ''} style={{ flex: 1 }}>
                                            <option value="">Year</option>
                                            {[...Array(100)].map((_, i) => {
                                                const y = DOB_CURRENT_YEAR - i;
                                                return <option key={y} value={String(y)}>{y}</option>;
                                            })}
                                        </select>
                                    </div>
                                    <p className="field-error">{indErrors.dob}</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="ind_gender">Gender<span className="required">*</span></label>
                                    <select id="ind_gender" name="gender" value={indForm.gender} onChange={handleIndChange} className={indErrors.gender ? 'input-error' : ''}>
                                        <option value="">Select…</option>
                                        {GENDER_OPTIONS.map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                    <p className="field-error">{indErrors.gender}</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="ind_password">Password<span className="required">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="ind_password" name="password" type={showIndPassword ? 'text' : 'password'}
                                            value={indForm.password} onChange={handleIndChange} placeholder="••••••••"
                                            autoComplete="new-password" className={indErrors.password ? 'input-error' : ''}
                                            style={{ width: '100%', paddingRight: '38px', boxSizing: 'border-box' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowIndPassword(s => !s)}
                                            aria-label={showIndPassword ? 'Hide password' : 'Show password'}
                                            style={{
                                                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                                fontSize: '16px', lineHeight: 1, color: '#6b7280',
                                            }}
                                        >
                                            {showIndPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                    <PasswordStrengthChecklist password={indForm.password} />
                                    <p className="field-error">{indErrors.password}</p>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: 400, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={indConsentAccepted}
                                            onChange={(e) => {
                                                setIndConsentAccepted(e.target.checked);
                                                if (indErrors.consent) setIndErrors(prev => ({ ...prev, consent: '' }));
                                            }}
                                            style={{ marginTop: '3px' }}
                                        />
                                        <span>
                                            I agree to the{' '}
                                            <ConsentLink onClick={() => setCmsModal({ pageKey: 'terms', label: 'Terms & Conditions' })}>Terms &amp; Conditions</ConsentLink>
                                            {' '}and{' '}
                                            <ConsentLink onClick={() => setCmsModal({ pageKey: 'privacy', label: 'Privacy Policy' })}>Privacy Policy</ConsentLink>.
                                        </span>
                                    </label>
                                    <p className="field-error">{indErrors.consent}</p>
                                </div>

                                <div className="form-actions">
                                    <button type="submit" className="btn form-btn-primary" disabled={isSubmitting} style={{ padding: '10px 20px' }}>
                                        {isSubmitting ? 'Creating account…' : 'Create Account'}
                                    </button>
                                    <a href="/login" className="form-link">Already registered? Log in</a>
                                </div>
                            </form>
                        ) : (
                            <form className="register-form" onSubmit={handleSubmit} noValidate>
                                <div className="form-group">
                                    <label htmlFor="org_name">Organization Name<span className="required">*</span></label>
                                    <input id="org_name" name="org_name" value={orgForm.org_name} onChange={handleOrgChange} placeholder="Community Empowerment Lab" className={orgErrors.org_name ? 'input-error' : ''} />
                                    <p className="field-error">{orgErrors.org_name}</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="org_type">Organization Type</label>
                                    <select id="org_type" name="org_type" value={orgForm.org_type} onChange={handleOrgChange}>
                                        <option value="">Select Organization Type</option>
                                        {orgTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="org_email">Organization Email<span className="required">*</span></label>
                                    <input id="org_email" name="org_email" type="email" value={orgForm.org_email} onChange={handleOrgChange} placeholder="contact@ngo.org" className={orgErrors.org_email ? 'input-error' : ''} />
                                    <OtpGate channel="email" identifier={orgForm.org_email.trim().toLowerCase()} purpose="org_registration" isValid={orgEmailIsValid} verified={orgEmailVerified} onVerified={() => setOrgEmailVerified(true)} onAlreadyRegistered={setOrgEmailTakenMsg} />
                                    <p className="field-error">{orgErrors.org_email}</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="org_mobile">Organization Mobile Number<span className="required">*</span></label>
                                    <input id="org_mobile" name="org_mobile" value={orgForm.org_mobile} onChange={handleOrgChange} placeholder="9876543210" maxLength={15} inputMode="tel" className={orgErrors.org_mobile ? 'input-error' : ''} />
                                    <OtpGate channel="phone" identifier={orgForm.org_mobile.trim()} purpose="org_registration" isValid={orgMobileIsValid} verified={orgMobileVerified} onVerified={() => setOrgMobileVerified(true)} onAlreadyRegistered={setOrgMobileTakenMsg} />
                                    <p className="field-error">{orgErrors.org_mobile}</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="address">Address</label>
                                    <input id="address" name="address" value={orgForm.address} onChange={handleOrgChange} placeholder="Street address" />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="city">City</label>
                                    <input id="city" name="city" value={orgForm.city} onChange={handleOrgChange} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="state">State</label>
                                    <input id="state" name="state" value={orgForm.state} onChange={handleOrgChange} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="country">Country</label>
                                    <input id="country" name="country" value={orgForm.country} onChange={handleOrgChange} />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="contact_person_name">Contact Person Name<span className="required">*</span></label>
                                    <input id="contact_person_name" name="contact_person_name" value={orgForm.contact_person_name} onChange={handleOrgChange} className={orgErrors.contact_person_name ? 'input-error' : ''} />
                                    <p className="field-error">{orgErrors.contact_person_name}</p>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="contact_person_designation">Contact Person Designation</label>
                                    <input id="contact_person_designation" name="contact_person_designation" value={orgForm.contact_person_designation} onChange={handleOrgChange} placeholder="Director" />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="org_password">Password<span className="required">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="org_password" name="password" type={showOrgPassword ? 'text' : 'password'}
                                            value={orgForm.password} onChange={handleOrgChange} autoComplete="new-password"
                                            className={orgErrors.password ? 'input-error' : ''}
                                            style={{ width: '100%', paddingRight: '38px', boxSizing: 'border-box' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowOrgPassword(s => !s)}
                                            aria-label={showOrgPassword ? 'Hide password' : 'Show password'}
                                            style={{
                                                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                                fontSize: '16px', lineHeight: 1, color: '#6b7280',
                                            }}
                                        >
                                            {showOrgPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                    <PasswordStrengthChecklist password={orgForm.password} />
                                    <p className="field-error">{orgErrors.password}</p>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontWeight: 400, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={orgConsentAccepted}
                                            onChange={(e) => {
                                                setOrgConsentAccepted(e.target.checked);
                                                if (orgErrors.consent) setOrgErrors(prev => ({ ...prev, consent: '' }));
                                            }}
                                            style={{ marginTop: '3px' }}
                                        />
                                        <span>
                                            I agree to the{' '}
                                            <ConsentLink onClick={() => setCmsModal({ pageKey: 'terms', label: 'Terms & Conditions' })}>Terms &amp; Conditions</ConsentLink>
                                            {' '}and{' '}
                                            <ConsentLink onClick={() => setCmsModal({ pageKey: 'privacy', label: 'Privacy Policy' })}>Privacy Policy</ConsentLink>.
                                        </span>
                                    </label>
                                    <p className="field-error">{orgErrors.consent}</p>
                                </div>

                                <div className="form-actions">
                                    <button type="submit" className="btn form-btn-primary" disabled={isSubmitting} style={{ padding: '10px 20px' }}>
                                        {isSubmitting ? 'Submitting…' : 'Submit Registration'}
                                    </button>
                                    <a href="/admin/login" className="form-link">Already approved? Log in</a>
                                </div>
                            </form>
                        )}
                        </>
                        )}
                    </div>
                </div>
            </section>
            {cmsModal && (
                <CmsModal
                    pageKey={cmsModal.pageKey}
                    label={cmsModal.label}
                    onClose={() => setCmsModal(null)}
                />
            )}
        </main>
    );
};

export default UnifiedRegister;
