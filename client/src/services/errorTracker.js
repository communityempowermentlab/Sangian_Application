/**
 * errorTracker — global web error catcher for Sangian
 * Captures: window errors, unhandled promise rejections, manual reports
 * Sends to: POST /api/errors/log (no auth required)
 */

import { API_URL } from './api';

const API_BASE = process.env.REACT_APP_API_URL || API_URL;

// Simple hash for deduplication & fingerprinting
const hashStr = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
};

const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown', os = 'Unknown', device = 'Desktop';

    if      (ua.includes('Edg'))                               browser = 'Edge';
    else if (ua.includes('OPR') || ua.includes('Opera'))      browser = 'Opera';
    else if (ua.includes('Chrome') && !ua.includes('Edg'))    browser = 'Chrome';
    else if (ua.includes('Firefox'))                           browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

    if      (ua.includes('Windows'))              os = 'Windows';
    else if (ua.includes('Mac OS X'))             os = 'macOS';
    else if (ua.includes('Android'))              os = 'Android';
    else if (ua.includes('iPhone'))               os = 'iOS';
    else if (ua.includes('iPad'))                 os = 'iPadOS';
    else if (ua.includes('Linux'))                os = 'Linux';

    if      (ua.includes('Mobile'))  device = 'Mobile';
    else if (ua.includes('iPad'))    device = 'Tablet';

    return { browser, os, device };
};

const getSessionId = () => {
    const KEY = 'et_sid';
    let id = sessionStorage.getItem(KEY);
    if (!id) {
        id = hashStr(Math.random().toString()) + Date.now().toString(36);
        sessionStorage.setItem(KEY, id);
    }
    return id;
};

// Rate-limit: max 15 errors per minute, deduplicate within 60s
const seen  = new Set();
let errCount = 0;
let windowEnd = Date.now() + 60_000;

const shouldSend = (fp) => {
    if (seen.has(fp)) return false;
    if (Date.now() > windowEnd) { errCount = 0; windowEnd = Date.now() + 60_000; }
    if (errCount >= 15) return false;
    return true;
};

const send = (payload) => {
    const fp = payload.fingerprint;
    if (!shouldSend(fp)) return;
    seen.add(fp);
    errCount++;
    setTimeout(() => seen.delete(fp), 60_000);

    const body = JSON.stringify(payload);

    // sendBeacon is fire-and-forget and survives page unload
    if (navigator.sendBeacon) {
        try {
            navigator.sendBeacon(`${API_BASE}/errors/log`, new Blob([body], { type: 'application/json' }));
            return;
        } catch { /* fall through to fetch */ }
    }

    fetch(`${API_BASE}/errors/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
    }).catch(() => {});
};

const buildPayload = ({ message, stack, errorType, sourceType, severity }) => {
    const fp = hashStr((message || '') + (stack ? stack.split('\n').slice(0, 2).join('') : ''));
    const { browser, os, device } = getBrowserInfo();
    return {
        fingerprint: fp,
        message:     String(message || 'Unknown error').slice(0, 2000),
        stack:       stack ? String(stack).slice(0, 8000) : null,
        error_type:  errorType  || 'Error',
        source_type: sourceType || 'window_error',
        severity:    severity   || 'error',
        page_url:    window.location.href,
        page_title:  document.title,
        browser,
        os,
        device_type:  device,
        app_version:  process.env.REACT_APP_VERSION || '1.0.0',
        session_id:   getSessionId(),
    };
};

// ── Public API ────────────────────────────────────────────────────────────────

export const logError = (error, severity = 'error', sourceType = 'manual') => {
    send(buildPayload({
        message:    error?.message || String(error),
        stack:      error?.stack,
        errorType:  error?.constructor?.name || 'Error',
        sourceType,
        severity,
    }));
};

export const initErrorTracker = () => {
    // Already initialized guard
    if (window.__etInit) return;
    window.__etInit = true;

    // Uncaught JS errors
    window.addEventListener('error', (event) => {
        const err = event.error;
        send(buildPayload({
            message:    err?.message || event.message,
            stack:      err?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
            errorType:  err?.constructor?.name || 'Error',
            sourceType: 'window_error',
            severity:   'fatal',
        }));
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        send(buildPayload({
            message:    reason?.message || String(reason),
            stack:      reason?.stack,
            errorType:  reason?.constructor?.name || 'UnhandledRejection',
            sourceType: 'promise_rejection',
            severity:   'error',
        }));
    });
};
