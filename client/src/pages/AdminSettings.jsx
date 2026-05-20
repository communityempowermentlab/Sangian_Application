import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axiosAdmin from '../services/axiosAdmin';
import { useGoogleAnalytics } from '../contexts/GoogleAnalyticsContext';
import { useCrashAnalytics } from '../contexts/CrashAnalyticsContext';

// ─── Sidebar menu items ──────────────────────────────────────────────────────

const SETTINGS_MENU = [
    { key: 'google_analytics',  icon: '📊', label: 'Google Analytics',  color: '#e37400', available: true  },
    { key: 'crash_analytics',   icon: '🔥', label: 'Crash Analytics',   color: '#dc2626', available: true  },
    { key: 'integrations',      icon: '🔗', label: 'Integrations',      color: '#6366f1', available: false },
    { key: 'preferences',       icon: '🎨', label: 'Preferences',       color: '#0891b2', available: false },
    { key: 'security',          icon: '🔒', label: 'Security',          color: '#7c3aed', available: false },
    { key: 'notifications',     icon: '🔔', label: 'Notifications',     color: '#f59e0b', available: false },
    { key: 'api_keys',          icon: '🔑', label: 'API Keys',          color: '#10b981', available: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) => n !== undefined && n !== null ? Number(n).toLocaleString() : '—';
const fmtPct = (n) => n !== undefined && n !== null ? `${(Number(n) * 100).toFixed(1)}%` : '—';
const fmtDur = (secs) => {
    if (secs === undefined || secs === null) return '—';
    const s = Math.round(Number(secs));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

// ─── Metric card ─────────────────────────────────────────────────────────────

const MetricCard = ({ label, value, icon, color, sub }) => (
    <div style={{
        background: '#fff', borderRadius: '14px', padding: '20px 22px',
        border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontSize: '1.4rem' }}>{icon}</span>
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: color || '#111827', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.73rem', color: '#6b7280' }}>{sub}</div>}
    </div>
);

// ─── Google Analytics Tab ─────────────────────────────────────────────────────

const GA_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const DATE_RANGES = [
    { label: 'Last 7 days',  startDate: '7daysAgo',  endDate: 'today' },
    { label: 'Last 30 days', startDate: '30daysAgo', endDate: 'today' },
    { label: 'Last 90 days', startDate: '90daysAgo', endDate: 'today' },
];

const GoogleAnalyticsTab = () => {
    // ── Persistent global state (survives tab navigation) ──────────────────
    const { accessToken, propertyId, gaLogin, gaLogout, setPropertyId } = useGoogleAnalytics();

    // ── Local UI state (ok to reset on mount) ──────────────────────────────
    const [propertyInput, setPropertyInput] = useState(propertyId || '');
    const [metrics, setMetrics]             = useState(null);
    const [topPages, setTopPages]           = useState(null);
    const [activeUsers, setActiveUsers]     = useState(null);
    const [isLoading, setIsLoading]         = useState(false);
    const [error, setError]                 = useState('');
    const [dateRange, setDateRange]         = useState(DATE_RANGES[1]);
    const realtimeTimer = useRef(null);

    const triggerGoogleLogin = useGoogleLogin({
        scope: GA_SCOPE,
        onSuccess: (tokenResponse) => {
            // Store in global context + sessionStorage — persists across navigation
            gaLogin(tokenResponse.access_token, tokenResponse.expires_in);
            setError('');
        },
        onError: () => setError('Google sign-in failed. Please try again.'),
    });

    const fetchData = useCallback(async (token, pid, range) => {
        if (!token || !pid) return;
        setIsLoading(true);
        setError('');
        try {
            const [reportRes, pagesRes] = await Promise.all([
                axiosAdmin.post('/analytics/report', {
                    accessToken: token,
                    propertyId: pid,
                    startDate: range.startDate,
                    endDate: range.endDate,
                }),
                axiosAdmin.post('/analytics/top-pages', {
                    accessToken: token,
                    propertyId: pid,
                    startDate: range.startDate,
                    endDate: range.endDate,
                }),
            ]);
            setMetrics(reportRes.data.data);
            setTopPages(pagesRes.data.data);
        } catch (e) {
            const msg = e.response?.data?.error || e.message;
            if (msg?.includes('Token has been expired') || msg?.includes('invalid_grant') || e.response?.status === 401) {
                gaLogout();
                setError('Your Google session expired. Please sign in again.');
            } else {
                setError(`Failed to load analytics: ${msg}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [gaLogout]);

    const fetchRealtime = useCallback(async (token, pid) => {
        if (!token || !pid) return;
        try {
            const res = await axiosAdmin.post('/analytics/realtime', { accessToken: token, propertyId: pid });
            setActiveUsers(res.data.activeUsers);
        } catch {
            // silently skip realtime errors
        }
    }, []);

    // Fetch data on mount (when already logged in) and on date range change
    useEffect(() => {
        if (accessToken && propertyId) {
            fetchData(accessToken, propertyId, dateRange);
        }
    }, [accessToken, propertyId, dateRange, fetchData]);

    // Real-time polling every 30 seconds
    useEffect(() => {
        if (accessToken && propertyId) {
            fetchRealtime(accessToken, propertyId);
            realtimeTimer.current = setInterval(() => fetchRealtime(accessToken, propertyId), 30_000);
        }
        return () => clearInterval(realtimeTimer.current);
    }, [accessToken, propertyId, fetchRealtime]);

    const handleConnect = () => {
        const pid = propertyInput.trim();
        if (!pid) { setError('Please enter your GA4 Property ID.'); return; }
        setPropertyId(pid);
        triggerGoogleLogin();
    };

    const handleDisconnect = () => {
        gaLogout();
        setMetrics(null);
        setTopPages(null);
        setActiveUsers(null);
        setError('');
    };

    // Extract summary — prefer totals (requires metricAggregations:TOTAL), fall back to first row
    const summary = (metrics?.totals?.[0]?.metricValues?.length
        ? metrics.totals[0].metricValues
        : metrics?.rows?.[0]?.metricValues) || [];
    const [totalUsers, sessions, newUsers, pageViews, bounceRate, avgDuration] =
        summary.map(v => v?.value);

    // Not configured (no client ID)
    if (!GA_CLIENT_ID) {
        return (
            <div style={{ padding: '48px 40px', maxWidth: '560px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>⚙️ Setup Required</div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.7, marginBottom: '20px' }}>
                    To enable Google Analytics integration, set the <code style={codeStyle}>REACT_APP_GOOGLE_CLIENT_ID</code> environment
                    variable in your <code style={codeStyle}>client/.env</code> file with your Google OAuth 2.0 Web Client ID.
                </div>
                <div style={{ background: '#1e1e2e', color: '#cdd6f4', borderRadius: '10px', padding: '16px 20px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {'# client/.env'}<br />
                    {'REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com'}
                </div>
                <div style={{ marginTop: '20px', fontSize: '0.82rem', color: '#9ca3af', lineHeight: 1.7 }}>
                    <strong>Steps:</strong><br />
                    1. Go to <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong><br />
                    2. Create an <strong>OAuth 2.0 Web Client ID</strong><br />
                    3. Add <strong>http://localhost:3000</strong> (dev) and your production URL to Authorized JavaScript Origins<br />
                    4. Enable the <strong>Google Analytics Data API</strong> in your project<br />
                    5. Paste the Client ID in your <code style={codeStyle}>.env</code> and restart the dev server
                </div>
            </div>
        );
    }

    // Not logged in
    if (!accessToken) {
        return (
            <div style={{ padding: '48px 40px', maxWidth: '520px' }}>
                <div style={{ fontSize: '0.88rem', color: '#6b7280', marginBottom: '20px' }}>
                    Connect your GA4 account to view analytics inside the admin panel.
                </div>

                <div style={{ background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={labelStyle}>GA4 Property ID</label>
                        <input
                            type="text"
                            value={propertyInput}
                            onChange={e => setPropertyInput(e.target.value)}
                            placeholder="e.g. 123456789"
                            style={inputStyle}
                        />
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>
                            Find it in Google Analytics → Admin → Property Settings → Property ID
                        </div>
                    </div>

                    {error && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#b91c1c' }}>
                            {error}
                        </div>
                    )}

                    <button onClick={handleConnect} style={googleBtnStyle}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                        </svg>
                        Sign in with Google
                    </button>
                </div>

                <div style={{ marginTop: '20px', fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.6 }}>
                    <strong>What you'll see after connecting:</strong><br />
                    Total Users · Sessions · New Users · Page Views · Bounce Rate · Top Pages · Real-time Active Visitors
                </div>
            </div>
        );
    }

    // Dashboard
    return (
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>

            {/* Controls bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    Property ID: <strong style={{ color: '#374151' }}>{propertyId}</strong>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Date range selector */}
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                        {DATE_RANGES.map(r => (
                            <button
                                key={r.label}
                                onClick={() => setDateRange(r)}
                                style={{
                                    padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                    fontSize: '0.75rem', fontWeight: 600,
                                    background: dateRange.label === r.label ? '#fff' : 'transparent',
                                    color: dateRange.label === r.label ? '#111827' : '#6b7280',
                                    boxShadow: dateRange.label === r.label ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => fetchData(accessToken, propertyId, dateRange)}
                        disabled={isLoading}
                        style={{ ...btnStyle('#4f46e5', '#fff'), opacity: isLoading ? 0.6 : 1 }}
                    >
                        {isLoading ? '⟳ Loading…' : '↻ Refresh'}
                    </button>
                    <button onClick={handleDisconnect} style={btnStyle('#f1f5f9', '#374151')}>
                        Disconnect
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', fontSize: '0.83rem', color: '#b91c1c', marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            {isLoading && !metrics ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '0.95rem' }}>
                    Loading analytics data…
                </div>
            ) : metrics ? (
                <>
                    {/* Real-time banner */}
                    {activeUsers !== null && (
                        <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #6ee7b7', borderRadius: '12px', padding: '12px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 0 3px rgba(16,185,129,0.3)', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontWeight: 700, color: '#065f46', fontSize: '1rem' }}>{fmt(activeUsers)}</span>
                            <span style={{ fontSize: '0.82rem', color: '#047857' }}>active users right now (auto-refreshes every 30s)</span>
                        </div>
                    )}

                    {/* KPI cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                        <MetricCard label="Total Users"    value={fmt(totalUsers)}        icon="👤" color="#4f46e5" sub={dateRange.label} />
                        <MetricCard label="Sessions"       value={fmt(sessions)}           icon="🔁" color="#0891b2" sub={dateRange.label} />
                        <MetricCard label="New Users"      value={fmt(newUsers)}            icon="✨" color="#10b981" sub={dateRange.label} />
                        <MetricCard label="Page Views"     value={fmt(pageViews)}           icon="👁️" color="#7c3aed" sub={dateRange.label} />
                        <MetricCard label="Bounce Rate"    value={fmtPct(bounceRate)}       icon="↩️" color="#f59e0b" />
                        <MetricCard label="Avg. Session"   value={fmtDur(avgDuration)}      icon="⏱️" color="#dc2626" />
                    </div>

                    {/* Top Pages */}
                    {topPages?.rows?.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontWeight: 700, color: '#111827', marginBottom: '14px', fontSize: '0.95rem' }}>🏆 Top Pages</div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                        <th style={thStyle}>#</th>
                                        <th style={thStyle}>Page</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Views</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Users</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topPages.rows.map((row, i) => {
                                        const path  = row.dimensionValues[0]?.value || '/';
                                        const title = row.dimensionValues[1]?.value || '—';
                                        const views = row.metricValues[0]?.value;
                                        const users = row.metricValues[1]?.value;
                                        return (
                                            <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                                                <td style={{ ...tdStyle, color: '#9ca3af', width: '32px' }}>{i + 1}</td>
                                                <td style={tdStyle}>
                                                    <div style={{ fontWeight: 600, color: '#374151' }}>{title}</div>
                                                    <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '1px' }}>{path}</div>
                                                </td>
                                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{fmt(views)}</td>
                                                <td style={{ ...tdStyle, textAlign: 'right', color: '#374151' }}>{fmt(users)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

// ─── Crash Analytics Tab (Custom Web Error Tracking) ─────────────────────────

const SEV = {
    fatal:   { bg: '#fef2f2', text: '#dc2626', dot: '#dc2626', label: 'FATAL'   },
    error:   { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b', label: 'ERROR'   },
    warning: { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6', label: 'WARNING' },
    info:    { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e', label: 'INFO'    },
};
const STATUS_STYLES = {
    open:     { bg: '#fef2f2', text: '#dc2626' },
    resolved: { bg: '#f0fdf4', text: '#16a34a' },
    ignored:  { bg: '#f9fafb', text: '#9ca3af' },
};

const CrashAnalyticsTab = () => {
    const [summary, setSummary]           = useState(null);
    const [errors, setErrors]             = useState([]);
    const [total, setTotal]               = useState(0);
    const [pages, setPages]               = useState(1);
    const [page, setPage]                 = useState(1);
    const [selectedError, setSelectedError] = useState(null);
    const [selectedIds, setSelectedIds]   = useState([]);
    const [isLoading, setIsLoading]       = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(true);
    const [loadError, setLoadError]       = useState('');
    const [statusFilter, setStatusFilter] = useState('open');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [search, setSearch]             = useState('');
    const [searchInput, setSearchInput]   = useState('');
    const [autoRefresh, setAutoRefresh]   = useState(true);
    const autoRefreshTimer                = useRef(null);

    const fmtTime = (iso) => iso
        ? new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : '—';

    const loadSummary = useCallback(async () => {
        try {
            const r = await axiosAdmin.get('/errors/summary');
            setSummary(r.data.summary);
        } catch { /* silently skip */ }
        finally { setIsSummaryLoading(false); }
    }, []);

    const loadErrors = useCallback(async (pg = 1) => {
        setIsLoading(true);
        setLoadError('');
        try {
            const r = await axiosAdmin.get('/errors/list', {
                params: { status: statusFilter, severity: severityFilter, search, page: pg, limit: 20 },
            });
            setErrors(r.data.errors || []);
            setTotal(r.data.total || 0);
            setPages(r.data.pages || 1);
            setPage(pg);
        } catch (e) {
            setLoadError(e.response?.data?.error || e.message);
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, severityFilter, search]);

    useEffect(() => { loadSummary(); loadErrors(1); }, [loadSummary, loadErrors]);

    // Auto-refresh every 30 s
    useEffect(() => {
        clearInterval(autoRefreshTimer.current);
        if (autoRefresh) {
            autoRefreshTimer.current = setInterval(() => { loadSummary(); loadErrors(page); }, 30_000);
        }
        return () => clearInterval(autoRefreshTimer.current);
    }, [autoRefresh, loadSummary, loadErrors, page]);

    const openError = useCallback(async (err) => {
        try {
            const r = await axiosAdmin.get(`/errors/${err.id}`);
            setSelectedError(r.data);
        } catch {
            setSelectedError({ error: err, related: [] });
        }
    }, []);

    const changeStatus = useCallback(async (id, status) => {
        await axiosAdmin.patch(`/errors/${id}/status`, { status });
        setErrors(prev => prev.map(e => e.id === id ? { ...e, status } : e));
        if (selectedError?.error?.id === id)
            setSelectedError(prev => ({ ...prev, error: { ...prev.error, status } }));
        loadSummary();
    }, [selectedError, loadSummary]);

    const bulkChange = useCallback(async (status) => {
        if (!selectedIds.length) return;
        await axiosAdmin.patch('/errors/bulk-status', { ids: selectedIds, status });
        setSelectedIds([]);
        loadErrors(page);
        loadSummary();
    }, [selectedIds, page, loadErrors, loadSummary]);

    const purge = useCallback(async () => {
        if (!window.confirm('Delete all resolved & ignored errors?')) return;
        await axiosAdmin.delete('/errors/purge');
        loadErrors(1); loadSummary();
    }, [loadErrors, loadSummary]);

    const toggleId = (id) => setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

    const s = summary || {};
    const trendUp = Number(s.last_24h) >= Number(s.prev_24h);

    // ── Error Detail Slide-over ───────────────────────────────────────────────
    if (selectedError) {
        const e = selectedError.error;
        const sev = SEV[e.severity] || SEV.error;
        const sts = STATUS_STYLES[e.status] || STATUS_STYLES.open;
        return (
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    <button onClick={() => setSelectedError(null)} style={{ ...btnStyle('#f1f5f9','#374151'), marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ← Back
                    </button>

                    {/* Error header card */}
                    <div style={{ background: 'linear-gradient(135deg,#1e1e2e,#2d2d44)', borderRadius: '16px', padding: '24px', marginBottom: '16px', color: '#fff' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                            <span style={{ background: sev.bg, color: sev.text, padding: '3px 12px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em' }}>{sev.label}</span>
                            <span style={{ background: sts.bg, color: sts.text, padding: '3px 12px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{e.status}</span>
                            <span style={{ background: 'rgba(255,255,255,0.1)', color: '#a5b4fc', padding: '3px 12px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>{e.error_type}</span>
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.4, marginBottom: '8px', wordBreak: 'break-word' }}>{e.message}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{e.source_type} · {fmtTime(e.created_at)}</div>
                    </div>

                    {/* Meta grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '10px', marginBottom: '16px' }}>
                        {[
                            ['Browser',  e.browser    || '—', '🌐'],
                            ['OS',       e.os          || '—', '💻'],
                            ['Device',   e.device_type || '—', '📱'],
                            ['Version',  e.app_version || '—', '🏷️'],
                        ].map(([label, val, icon]) => (
                            <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 14px' }}>
                                <div style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{icon} {label}</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#374151' }}>{val}</div>
                            </div>
                        ))}
                    </div>

                    {/* Page */}
                    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.82rem', color: '#374151', wordBreak: 'break-all' }}>
                        <span style={{ color: '#9ca3af', fontWeight: 700, marginRight: '8px' }}>PAGE</span>{e.page_url || '—'}
                    </div>

                    {/* Stack trace */}
                    {e.stack && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#111827', marginBottom: '8px', fontSize: '0.88rem' }}>📋 Stack Trace</div>
                            <pre style={{
                                background: '#0f172a', color: '#e2e8f0', borderRadius: '12px',
                                padding: '20px', fontSize: '0.75rem', overflowX: 'auto',
                                lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>{e.stack}</pre>
                        </div>
                    )}

                    {/* Related */}
                    {selectedError.related?.length > 0 && (
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#111827', marginBottom: '10px', fontSize: '0.85rem' }}>🔗 Related Occurrences</div>
                            {selectedError.related.map(r => (
                                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.8rem', color: '#6b7280' }}>
                                    <span>#{r.id}</span>
                                    <span style={{ color: (SEV[r.severity]||SEV.error).text, fontWeight: 600 }}>{r.severity}</span>
                                    <span>{fmtTime(r.created_at)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {e.status !== 'resolved' && <button onClick={() => changeStatus(e.id,'resolved')} style={btnStyle('#10b981','#fff')}>✅ Mark Resolved</button>}
                        {e.status !== 'ignored'  && <button onClick={() => changeStatus(e.id,'ignored')}  style={btnStyle('#6b7280','#fff')}>🚫 Ignore</button>}
                        {e.status !== 'open'     && <button onClick={() => changeStatus(e.id,'open')}     style={btnStyle('#dc2626','#fff')}>🔴 Reopen</button>}
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Dashboard ────────────────────────────────────────────────────────
    return (
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* ── Summary cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px' }}>
                {[
                    { label: 'Total Errors',    val: s.total,            icon: '💥', grad: 'linear-gradient(135deg,#dc2626,#ef4444)', light: '#fef2f2' },
                    { label: 'Open',            val: s.open,             icon: '🔴', grad: 'linear-gradient(135deg,#d97706,#f59e0b)', light: '#fffbeb' },
                    { label: 'Fatal',           val: s.fatal,            icon: '☠️', grad: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', light: '#f5f3ff' },
                    { label: 'Errors',          val: s.errors,           icon: '⚠️', grad: 'linear-gradient(135deg,#0891b2,#06b6d4)', light: '#ecfeff' },
                    { label: 'Warnings',        val: s.warnings,         icon: '🟡', grad: 'linear-gradient(135deg,#2563eb,#3b82f6)', light: '#eff6ff' },
                    { label: 'Resolved',        val: s.resolved,         icon: '✅', grad: 'linear-gradient(135deg,#059669,#10b981)', light: '#ecfdf5' },
                ].map(c => (
                    <div key={c.label} style={{ borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                        <div style={{ background: c.grad, padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
                            <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
                        </div>
                        <div style={{ background: c.light, padding: '10px 16px 14px' }}>
                            <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>{isSummaryLoading ? '…' : fmt(c.val)}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── 24h trend ── */}
            {!isSummaryLoading && s.last_24h !== undefined && (
                <div style={{ background: trendUp ? '#fef2f2' : '#f0fdf4', border: `1px solid ${trendUp ? '#fca5a5' : '#86efac'}`, borderRadius: '12px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{trendUp ? '📈' : '📉'}</span>
                    <span style={{ fontWeight: 700, color: trendUp ? '#dc2626' : '#16a34a' }}>
                        {fmt(s.last_24h)} errors in last 24h
                    </span>
                    <span style={{ color: '#6b7280' }}>vs {fmt(s.prev_24h)} previous 24h</span>
                </div>
            )}

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: '#fff', borderRadius: '12px', padding: '12px 16px', border: '1px solid #e5e7eb' }}>
                {/* Search */}
                <div style={{ display: 'flex', flex: 1, minWidth: '200px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                    <input
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); loadErrors(1); }}}
                        placeholder="Search errors…"
                        style={{ flex: 1, border: 'none', outline: 'none', padding: '7px 12px', background: 'transparent', fontSize: '0.83rem', color: '#374151' }}
                    />
                    <button onClick={() => { setSearch(searchInput); loadErrors(1); }} style={{ padding: '7px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>🔍</button>
                </div>

                {/* Severity filter */}
                <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); }} style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.82rem', cursor: 'pointer', color: '#374151', background: '#f9fafb' }}>
                    <option value="all">All Severities</option>
                    <option value="fatal">Fatal</option>
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                </select>

                {/* Status tabs */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                    {['open','resolved','ignored','all'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)} style={{
                            padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            fontSize: '0.73rem', fontWeight: 600, textTransform: 'capitalize',
                            background: statusFilter === s ? '#fff' : 'transparent',
                            color: statusFilter === s ? '#111827' : '#6b7280',
                            boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}>{s}</button>
                    ))}
                </div>

                {/* Auto-refresh toggle */}
                <button
                    onClick={() => setAutoRefresh(v => !v)}
                    style={{ ...btnStyle(autoRefresh ? '#ecfdf5' : '#f1f5f9', autoRefresh ? '#16a34a' : '#6b7280'), border: `1px solid ${autoRefresh ? '#86efac' : '#e5e7eb'}`, fontSize: '0.75rem' }}
                >
                    {autoRefresh ? '⟳ Auto' : '⟳ Off'}
                </button>
                <button onClick={() => { loadSummary(); loadErrors(page); }} disabled={isLoading} style={{ ...btnStyle('#4f46e5','#fff'), opacity: isLoading ? 0.6 : 1 }}>
                    {isLoading ? 'Loading…' : '↻ Refresh'}
                </button>
            </div>

            {/* ── Bulk actions ── */}
            {selectedIds.length > 0 && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '0.82rem' }}>{selectedIds.length} selected</span>
                    <button onClick={() => bulkChange('resolved')} style={btnStyle('#10b981','#fff')}>✅ Resolve All</button>
                    <button onClick={() => bulkChange('ignored')}  style={btnStyle('#6b7280','#fff')}>🚫 Ignore All</button>
                    <button onClick={() => setSelectedIds([])}     style={btnStyle('#f1f5f9','#374151')}>✕ Clear</button>
                    <button onClick={purge} style={{ ...btnStyle('#fef2f2','#dc2626'), border: '1px solid #fca5a5', marginLeft: 'auto' }}>🗑️ Purge Resolved</button>
                </div>
            )}

            {loadError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', fontSize: '0.82rem', color: '#b91c1c' }}>{loadError}</div>}

            {/* ── Error table ── */}
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.92rem' }}>
                        💥 Error Log <span style={{ background: '#f1f5f9', color: '#6b7280', borderRadius: '999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600, marginLeft: '8px' }}>{fmt(total)}</span>
                    </div>
                    {!selectedIds.length && (
                        <button onClick={purge} style={{ ...btnStyle('#fef2f2','#dc2626'), border: '1px solid #fca5a5', fontSize: '0.75rem' }}>🗑️ Purge Resolved</button>
                    )}
                </div>

                {isLoading ? (
                    <div style={{ padding: '50px', textAlign: 'center', color: '#9ca3af' }}>Loading errors…</div>
                ) : errors.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>✅</div>
                        <div style={{ fontWeight: 700, color: '#374151', fontSize: '1rem' }}>No errors found</div>
                        <div style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '4px' }}>Your web app is running cleanly.</div>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                <th style={{ ...thStyle, width: '36px' }}>
                                    <input type="checkbox"
                                        checked={selectedIds.length === errors.length}
                                        onChange={e => setSelectedIds(e.target.checked ? errors.map(er => er.id) : [])}
                                    />
                                </th>
                                <th style={thStyle}>Severity</th>
                                <th style={thStyle}>Error</th>
                                <th style={thStyle}>Type</th>
                                <th style={thStyle}>Browser</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Time</th>
                                <th style={thStyle}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {errors.map((er) => {
                                const sev = SEV[er.severity] || SEV.error;
                                const sts = STATUS_STYLES[er.status] || STATUS_STYLES.open;
                                return (
                                    <tr key={er.id} style={{ borderTop: '1px solid #f3f4f6', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ ...tdStyle, width: '36px' }}>
                                            <input type="checkbox" checked={selectedIds.includes(er.id)} onChange={() => toggleId(er.id)} />
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{ background: sev.bg, color: sev.text, padding: '3px 10px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sev.dot, display: 'inline-block' }} />
                                                {sev.label}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, maxWidth: '280px' }}>
                                            <div style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={er.message}>{er.message}</div>
                                            <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={er.page_url}>{er.page_url}</div>
                                        </td>
                                        <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>{er.error_type}</td>
                                        <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>{er.browser || '—'} · {er.os || '—'}</td>
                                        <td style={tdStyle}>
                                            <span style={{ background: sts.bg, color: sts.text, padding: '3px 10px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize' }}>{er.status}</span>
                                        </td>
                                        <td style={{ ...tdStyle, color: '#9ca3af', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{fmtTime(er.created_at)}</td>
                                        <td style={tdStyle}>
                                            <button onClick={() => openError(er)} style={{ ...btnStyle('#f1f5f9','#374151'), fontSize: '0.75rem', padding: '5px 12px' }}>View →</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {pages > 1 && (
                    <div style={{ padding: '12px 18px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Page {page} of {pages} · {fmt(total)} total</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button disabled={page <= 1}  onClick={() => loadErrors(page - 1)} style={{ ...btnStyle('#f1f5f9','#374151'), opacity: page <= 1 ? 0.4 : 1 }}>← Prev</button>
                            <button disabled={page >= pages} onClick={() => loadErrors(page + 1)} style={{ ...btnStyle('#4f46e5','#fff'), opacity: page >= pages ? 0.4 : 1 }}>Next →</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const errorBoxStyle = { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#b91c1c' };

const codeStyle = { background: '#f1f5f9', color: '#7c3aed', padding: '1px 6px', borderRadius: '4px', fontSize: '0.85em', fontFamily: 'monospace' };
const labelStyle = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none', color: '#111827' };
const googleBtnStyle = {
    display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center',
    padding: '11px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
    background: '#fff', color: '#374151', fontWeight: 600, fontSize: '0.88rem',
    cursor: 'pointer', width: '100%', transition: 'box-shadow 0.15s',
};
const btnStyle = (bg, color) => ({
    padding: '7px 16px', borderRadius: '7px', border: 'none',
    background: bg, color, fontWeight: 600, fontSize: '0.82rem',
    cursor: 'pointer', transition: 'opacity 0.15s',
});
const thStyle = { padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '10px 12px', verticalAlign: 'top' };

// ─── Main AdminSettings page ──────────────────────────────────────────────────

const CONTENT_MAP = {
    google_analytics: <GoogleAnalyticsTab />,
    crash_analytics:  <CrashAnalyticsTab />,
};

const AdminSettings = () => {
    const [activeTab, setActiveTab] = useState('google_analytics');
    const active = SETTINGS_MENU.find(m => m.key === activeTab);

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>

            {/* LEFT SIDEBAR */}
            <div style={{ width: '240px', minWidth: '240px', background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Admin Panel</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>⚙️ Settings</div>
                </div>

                {SETTINGS_MENU.map(item => (
                    <button
                        key={item.key}
                        onClick={() => item.available && setActiveTab(item.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 20px', border: 'none', cursor: item.available ? 'pointer' : 'default',
                            textAlign: 'left', width: '100%',
                            background: activeTab === item.key ? '#f0f4ff' : 'transparent',
                            borderLeft: activeTab === item.key ? `4px solid ${item.color}` : '4px solid transparent',
                            transition: 'all 0.15s',
                            opacity: item.available ? 1 : 0.45,
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: activeTab === item.key ? item.color : '#374151' }}>
                                {item.label}
                            </div>
                            {!item.available && (
                                <div style={{ fontSize: '0.68rem', color: '#d1d5db', fontWeight: 500 }}>Coming soon</div>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* RIGHT CONTENT */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* Content Header */}
                <div style={{ padding: '16px 28px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.4rem' }}>{active?.icon}</span>
                    <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>{active?.label}</div>
                        <div style={{ fontSize: '0.73rem', color: '#9ca3af' }}>Settings › {active?.label}</div>
                    </div>
                </div>

                {/* Dynamic Content */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {CONTENT_MAP[activeTab] || (
                        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#9ca3af' }}>
                            This section is coming soon.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
