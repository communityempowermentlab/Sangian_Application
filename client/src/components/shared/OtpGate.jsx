import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../services/api';
import './OtpGate.css';

// Inline (non-modal) OTP verification control — generalizes the send/verify/
// resend-timer/dev-otp-display pattern from HelpPage.jsx's OtpModal so both
// the Individual and Organization registration forms can embed one of these
// per channel (email, phone) instead of duplicating the flow. Phone OTPs
// have no real SMS gateway yet (see server/src/services/smsService.js) so
// both channels always show the OTP on-screen for now via devOtp.
const OtpGate = ({ channel, identifier, purpose, isValid, verified, onVerified, onAlreadyRegistered }) => {
    const [sent, setSent] = useState(false);
    const [otpVal, setOtpVal] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resendSecs, setResendSecs] = useState(0);
    const [devOtp, setDevOtp] = useState(null);
    const timerRef = useRef(null);
    const sentForIdentifier = useRef(null);

    useEffect(() => () => clearInterval(timerRef.current), []);

    // If the identifier changes after an OTP was sent/verified for a
    // previous value, reset — the old OTP no longer applies.
    useEffect(() => {
        if (sentForIdentifier.current && sentForIdentifier.current !== identifier) {
            setSent(false); setOtpVal(''); setDevOtp(null); setError('');
            clearInterval(timerRef.current); setResendSecs(0);
        }
    }, [identifier]);

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

    const handleSend = async () => {
        setError('');
        setLoading(true);
        try {
            const endpoint = channel === 'email' ? 'send-email-otp' : 'send-phone-otp';
            const body = channel === 'email' ? { email: identifier, purpose } : { mobile: identifier, purpose };
            const { data } = await axios.post(`${API_URL}/otp/${endpoint}`, body);
            setDevOtp(data.devOtp || null);
            sentForIdentifier.current = identifier;
            setSent(true);
            startResendTimer();
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to send OTP. Please try again.';
            setError(message);
            // Tells the parent form this field is already registered, so its
            // own submit-time validation can reuse this exact reason instead
            // of showing a contradictory generic "please verify" message.
            if (err.response?.data?.alreadyRegistered) onAlreadyRegistered?.(message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e?.preventDefault();
        setError('');
        if (!otpVal.trim()) { setError('Please enter the OTP.'); return; }
        setLoading(true);
        try {
            await axios.post(`${API_URL}/otp/verify`, { channel, identifier, otp: otpVal.trim(), purpose });
            onVerified();
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const label = channel === 'email' ? 'Email' : 'Mobile Number';

    if (verified) {
        return <div className="otpg-verified">✓ {label} verified</div>;
    }

    if (!sent) {
        return (
            <div className="otpg-row">
                <button type="button" className="otpg-send-btn" disabled={!isValid || loading} onClick={handleSend}>
                    {loading ? 'Sending…' : `Verify ${label} with OTP`}
                </button>
                {error && <div className="otpg-error">{error}</div>}
            </div>
        );
    }

    // A plain div, not a <form> — this control is always embedded inside a
    // larger registration <form> (see UnifiedRegister.jsx), and a nested
    // <form> is invalid HTML: the native 'submit' event on the inner form
    // bubbles up into the outer form's onSubmit too, silently triggering
    // full-form validation (and its error messages on unrelated fields)
    // every time this is clicked, before this OTP call even resolves.
    // Enter-to-submit is preserved via onKeyDown below.
    return (
        <div className="otpg-verify-form">
            <p className="otpg-sent-to">OTP sent to <strong>{identifier}</strong></p>

            {devOtp && (
                <div className="otpg-dev-banner">
                    <span className="otpg-dev-label">Dev mode — SMS/email gateway pending</span>
                    <span className="otpg-dev-code">{devOtp}</span>
                    <button type="button" className="otpg-dev-fill" onClick={() => setOtpVal(devOtp)}>Autofill</button>
                </div>
            )}

            {error && <div className="otpg-error">{error}</div>}

            <div className="otpg-code-row">
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="otpg-code-input"
                    placeholder="6-digit code"
                    value={otpVal}
                    onChange={e => setOtpVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => { if (e.key === 'Enter') handleVerify(e); }}
                    autoFocus
                />
                <button type="button" className="otpg-verify-btn" disabled={loading} onClick={handleVerify}>
                    {loading ? 'Verifying…' : 'Verify'}
                </button>
            </div>

            <button type="button" className="otpg-resend" disabled={resendSecs > 0 || loading} onClick={handleSend}>
                {resendSecs > 0 ? `Resend in ${resendSecs}s` : 'Resend OTP'}
            </button>
        </div>
    );
};

export default OtpGate;
