import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import axiosAdmin from '../services/axiosAdmin';
import { useGoogleAnalytics } from '../contexts/GoogleAnalyticsContext';
import { useCrashAnalytics } from '../contexts/CrashAnalyticsContext';
import { getAdminLogoUrl } from '../services/photoUtils';
import AdminLanguageSettingsTab from './AdminLanguageSettingsTab';
import AdminTestConfigTab from './AdminTestConfigTab';
import AdminNotificationsTab from './AdminNotificationsTab';

// ─── Sidebar menu items ──────────────────────────────────────────────────────

const SETTINGS_MENU = [
    { key: 'google_analytics',  icon: '📊', label: 'Google Analytics',    color: '#e37400', available: true  },
    { key: 'crash_analytics',   icon: '🔥', label: 'Crash Analytics',     color: '#dc2626', available: true  },
    { key: 'automated_testing', icon: '🧪', label: 'Automated Testing',   color: '#7c3aed', available: true  },
    { key: 'contact_email',     icon: '📧', label: 'Contact Us Email',    color: '#4f46e5', available: true  },
    { key: 'smtp_settings',     icon: '📨', label: 'SMTP Settings',        color: '#0369a1', available: true  },
    { key: 'help_email',        icon: '🎫', label: 'Ticket Notifications',  color: '#7c3aed', available: true  },
    { key: 'admin_profile',     icon: '👤', label: 'Update Profile',       color: '#059669', available: true  },
    { key: 'languages',         icon: '🌐', label: 'Languages',            color: '#0ea5e9', available: true  },
    { key: 'test_config',       icon: '🧪', label: 'Test Configuration',   color: '#dc2626', available: true  },
    { key: 'integrations',      icon: '🔗', label: 'Integrations',        color: '#6366f1', available: false },
    { key: 'preferences',       icon: '🎨', label: 'Preferences',       color: '#0891b2', available: false },
    { key: 'security',          icon: '🔒', label: 'Security',          color: '#374151', available: false },
    { key: 'notifications',     icon: '🔔', label: 'Notifications',     color: '#f59e0b', available: true  },
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

const Sparkline = ({ data = [] }) => {
    if (!data || data.length < 2) return null;
    const counts = data.map(d => Number(d.count));
    const max = Math.max(...counts, 1);
    const W = 180, H = 32;
    const pts = counts.map((c, i) => {
        const x = ((i / (counts.length - 1)) * W).toFixed(1);
        const y = (H - 4 - ((c / max) * (H - 8))).toFixed(1);
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
            <polyline fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" points={pts} />
            {counts.map((c, i) => {
                const x = ((i / (counts.length - 1)) * W).toFixed(1);
                const y = (H - 4 - ((c / max) * (H - 8))).toFixed(1);
                return <circle key={i} cx={x} cy={y} r="3" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />;
            })}
        </svg>
    );
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
    const [showInfo, setShowInfo]         = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeKpi, setActiveKpi]       = useState(null);

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

    const generateSamples = useCallback(async () => {
        if (!window.confirm('Insert 15 sample crash records for QA testing?\nThis cannot be undone.')) return;
        setIsGenerating(true);
        try {
            await axiosAdmin.post('/errors/generate-samples');
            loadErrors(1); loadSummary();
        } catch (e) {
            alert('Failed to generate samples: ' + (e.response?.data?.error || e.message));
        } finally {
            setIsGenerating(false);
        }
    }, [loadErrors, loadSummary]);

    const handleKpiClick = useCallback((kpiKey, filterStatus, filterSeverity) => {
        if (activeKpi === kpiKey) {
            // Toggle off — reset to default view
            setActiveKpi(null);
            setStatusFilter('open');
            setSeverityFilter('all');
        } else {
            setActiveKpi(kpiKey);
            setStatusFilter(filterStatus);
            setSeverityFilter(filterSeverity);
        }
    }, [activeKpi]);

    const clearKpiFilter = useCallback(() => {
        setActiveKpi(null);
        setStatusFilter('open');
        setSeverityFilter('all');
    }, []);

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

            {/* ── Info Banner ── */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', overflow: 'hidden' }}>
                <button
                    onClick={() => setShowInfo(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: 'transparent', border: 'none', cursor: 'pointer', gap: '10px' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
                        <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>What is Crash Analytics?</span>
                        <span style={{ fontSize: '0.72rem', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Web Error Tracker · Live</span>
                    </div>
                    <span style={{ color: '#b45309', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>{showInfo ? '▲ Hide' : '▼ Learn more'}</span>
                </button>
                {showInfo && (
                    <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ color: '#78350f', fontSize: '0.82rem', lineHeight: 1.7 }}>
                            This module automatically records <strong>application failures, runtime exceptions, API failures, media errors,</strong> and unexpected user-flow interruptions during gameplay or admin usage.
                            All errors are captured via global <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: '3px', fontSize: '0.8em' }}>window.onerror</code> and <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: '3px', fontSize: '0.8em' }}>unhandledrejection</code> handlers and sent to the server in real-time.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '10px' }}>
                            {[
                                { cat: '⚛️ Frontend', items: ['React rendering crash', 'Undefined variables / JS exceptions', 'Failed component mount', 'Broken route navigation'] },
                                { cat: '🎮 Game Errors', items: ['Question loading failure', 'Timer malfunction', 'Audio not stopping / leak', 'Resume state failure', 'Score calculation mismatch'] },
                                { cat: '🌐 API Errors', items: ['500 server error', 'Request timeout', 'Authentication failure', 'Missing or invalid response'] },
                                { cat: '📱 Device / Browser', items: ['Media autoplay restriction', 'Mobile asset load failure', 'Low memory crash', 'Blank screen after reload'] },
                            ].map(({ cat, items }) => (
                                <div key={cat} style={{ background: '#fff', borderRadius: '10px', padding: '12px 14px', border: '1px solid #fde68a' }}>
                                    <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.78rem', marginBottom: '8px' }}>{cat}</div>
                                    {items.map(item => (
                                        <div key={item} style={{ display: 'flex', gap: '6px', fontSize: '0.76rem', color: '#78350f', marginBottom: '4px', lineHeight: 1.4 }}>
                                            <span style={{ color: '#d97706', flexShrink: 0 }}>•</span>{item}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span>💡 <strong>Note:</strong> Only unexpected failures are recorded. Normal user exits (Pause/Quit with reason) are not treated as crashes.</span>
                            <span>🔧 <strong>Dev tip:</strong> Ensure <code style={{ background: '#fff', padding: '1px 4px', borderRadius: '3px' }}>initErrorTracker()</code> is called in <code style={{ background: '#fff', padding: '1px 4px', borderRadius: '3px' }}>App.js</code> for accurate reporting.</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Summary KPI cards (interactive filters) ── */}
            <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px' }}>
                    {[
                        { label: 'Total Errors', val: s.total,    icon: '💥', grad: 'linear-gradient(135deg,#dc2626,#ef4444)', light: '#fef2f2', accent: '#dc2626', kpiKey: 'total',    filterStatus: 'all',      filterSeverity: 'all'     },
                        { label: 'Open',         val: s.open,     icon: '🔴', grad: 'linear-gradient(135deg,#d97706,#f59e0b)', light: '#fffbeb', accent: '#d97706', kpiKey: 'open',     filterStatus: 'open',     filterSeverity: 'all'     },
                        { label: 'Fatal',        val: s.fatal,    icon: '☠️', grad: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', light: '#f5f3ff', accent: '#7c3aed', kpiKey: 'fatal',    filterStatus: 'all',      filterSeverity: 'fatal'   },
                        { label: 'Errors',       val: s.errors,   icon: '⚠️', grad: 'linear-gradient(135deg,#0891b2,#06b6d4)', light: '#ecfeff', accent: '#0891b2', kpiKey: 'errors',   filterStatus: 'all',      filterSeverity: 'error'   },
                        { label: 'Warnings',     val: s.warnings, icon: '🟡', grad: 'linear-gradient(135deg,#2563eb,#3b82f6)', light: '#eff6ff', accent: '#2563eb', kpiKey: 'warnings', filterStatus: 'all',      filterSeverity: 'warning' },
                        { label: 'Resolved',     val: s.resolved, icon: '✅', grad: 'linear-gradient(135deg,#059669,#10b981)', light: '#ecfdf5', accent: '#059669', kpiKey: 'resolved', filterStatus: 'resolved', filterSeverity: 'all'     },
                    ].map(c => {
                        const isActive = activeKpi === c.kpiKey;
                        return (
                            <div
                                key={c.kpiKey}
                                role="button"
                                tabIndex={0}
                                aria-pressed={isActive}
                                title={isActive ? `Remove filter: ${c.label}` : `Filter by: ${c.label}`}
                                onClick={() => handleKpiClick(c.kpiKey, c.filterStatus, c.filterSeverity)}
                                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleKpiClick(c.kpiKey, c.filterStatus, c.filterSeverity)}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.transform = 'none'; }}
                                style={{
                                    borderRadius: '14px', overflow: 'hidden', cursor: 'pointer',
                                    outline: 'none', position: 'relative',
                                    boxShadow: isActive
                                        ? `0 0 0 3px ${c.accent}, 0 8px 20px rgba(0,0,0,0.14)`
                                        : '0 2px 8px rgba(0,0,0,0.08)',
                                    transform: isActive ? 'translateY(-3px)' : 'none',
                                    transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                                }}
                            >
                                <div style={{ background: c.grad, padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
                                    <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
                                    {isActive && (
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                                            background: 'rgba(255,255,255,0.96)', color: c.accent,
                                            fontSize: '0.54rem', fontWeight: 900, padding: '2px 8px',
                                            borderRadius: '999px 999px 0 0', letterSpacing: '0.07em', whiteSpace: 'nowrap',
                                        }}>
                                            ● ACTIVE FILTER
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    background: c.light, padding: '10px 16px 14px',
                                    borderTop: `2px solid ${isActive ? c.accent : 'transparent'}`,
                                    transition: 'border-color 0.18s ease',
                                }}>
                                    <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                                        {isSummaryLoading ? '…' : fmt(c.val)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* helper text + clear filter row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
                        💡 Click any card to filter crash records — click again to reset.
                    </span>
                    {activeKpi !== null && (
                        <button
                            onClick={clearKpiFilter}
                            style={{ ...btnStyle('#fef2f2', '#dc2626'), border: '1px solid #fca5a5', fontSize: '0.72rem', padding: '4px 12px' }}
                        >
                            ✕ Clear Filter
                        </button>
                    )}
                </div>
            </div>

            {/* ── 24h trend + 7-day sparkline ── */}
            {!isSummaryLoading && s.last_24h !== undefined && (
                <div style={{ background: trendUp ? '#fef2f2' : '#f0fdf4', border: `1px solid ${trendUp ? '#fca5a5' : '#86efac'}`, borderRadius: '12px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.3rem' }}>{trendUp ? '📈' : '📉'}</span>
                    <div>
                        <span style={{ fontWeight: 700, color: trendUp ? '#dc2626' : '#16a34a' }}>
                            {fmt(s.last_24h)} errors in last 24h
                        </span>
                        <span style={{ color: '#6b7280', marginLeft: '8px' }}>vs {fmt(s.prev_24h)} previous 24h</span>
                    </div>
                    {s.daily && s.daily.length >= 2 && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, letterSpacing: '0.05em' }}>7-DAY TREND</span>
                            <Sparkline data={s.daily} />
                        </div>
                    )}
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
                <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setActiveKpi(null); }} style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.82rem', cursor: 'pointer', color: '#374151', background: '#f9fafb' }}>
                    <option value="all">All Severities</option>
                    <option value="fatal">Fatal</option>
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                </select>

                {/* Status tabs */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                    {['open','resolved','ignored','all'].map(s => (
                        <button key={s} onClick={() => { setStatusFilter(s); setActiveKpi(null); }} style={{
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
                <button onClick={generateSamples} disabled={isGenerating} title="Insert 15 sample crash records for QA testing" style={{ ...btnStyle('#f9fafb','#374151'), border: '1px solid #e5e7eb', fontSize: '0.75rem', opacity: isGenerating ? 0.6 : 1 }}>
                    {isGenerating ? '⏳ Generating…' : '🧪 Sample Logs'}
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
                    <div style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '3.5rem' }}>✅</div>
                        <div style={{ fontWeight: 700, color: '#374151', fontSize: '1.05rem' }}>No crash events recorded yet</div>
                        <div style={{ color: '#9ca3af', fontSize: '0.82rem', maxWidth: '380px', lineHeight: 1.7 }}>
                            Start gameplay or run automated tests to generate analytics data.
                            You can also insert sample records to verify logging, filtering, severity classification, and dashboard visibility.
                        </div>
                        <button
                            onClick={generateSamples} disabled={isGenerating}
                            style={{ ...btnStyle('#f59e0b', '#fff'), marginTop: '8px', padding: '10px 24px', fontSize: '0.85rem', opacity: isGenerating ? 0.6 : 1 }}
                        >
                            {isGenerating ? '⏳ Generating…' : '🧪 Generate Sample Crash Logs'}
                        </button>
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

            {/* ── Developer Notes ── */}
            <div style={{ background: '#1e1e2e', borderRadius: '14px', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '1rem' }}>🛠️</span>
                    <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.88rem' }}>Developer Notes</span>
                </div>
                {[
                    { icon: '⚡', text: 'Crash analytics only records unexpected failures. Normal user exits (Pause/Quit with a reason) are not treated as crashes.' },
                    { icon: '🔧', text: 'For accurate reporting, ensure initErrorTracker() is called in App.js and global error handlers are enabled in both frontend and backend.' },
                    { icon: '📡', text: 'Frontend errors are sent via sendBeacon (fire-and-forget) to POST /api/errors/log — no auth token required for error reporting.' },
                    { icon: '🔁', text: 'Rate limiting: max 15 errors/minute, 60s deduplication window per fingerprint to prevent log flooding from rapid-fire crashes.' },
                    { icon: '🏷️', text: 'Severity levels: fatal (uncaught window exceptions) → error (promise rejections / API failures) → warning (manual reports) → info.' },
                ].map(({ icon, text }) => (
                    <div key={icon} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.6 }}>
                        <span style={{ flexShrink: 0 }}>{icon}</span>
                        <span>{text}</span>
                    </div>
                ))}
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

// ─── Automated Testing Tab ───────────────────────────────────────────────────

const TEST_SUITES = [
    { key: 'all',          icon: '🧪', label: 'All Suites'       },
    { key: 'api_tests',    icon: '🌐', label: 'API Tests'        },
    { key: 'security_tests',icon:'🔒', label: 'Security'         },
    { key: 'db_tests',     icon: '🗄️', label: 'Database'         },
    { key: 'code_quality', icon: '🧹', label: 'Code Quality'     },
    { key: 'performance_tests',icon:'⚡',label:'Performance'     },
];

const DEV_STATUS = {
    open:        { bg: '#fef2f2', text: '#dc2626', label: 'Open'        },
    in_progress: { bg: '#fffbeb', text: '#d97706', label: 'In Progress' },
    completed:   { bg: '#f0fdf4', text: '#16a34a', label: 'Completed'   },
    blocked:     { bg: '#f5f3ff', text: '#7c3aed', label: 'Blocked'     },
};

const TEST_STATUS = {
    passed:  { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    failed:  { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
    warning: { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b' },
    error:   { bg: '#fdf4ff', text: '#7c3aed', dot: '#a855f7' },
    skipped: { bg: '#f9fafb', text: '#6b7280', dot: '#9ca3af' },
};

const SEVERITY_BADGE = {
    critical: { bg: '#fef2f2', text: '#dc2626' },
    high:     { bg: '#fff7ed', text: '#c2410c' },
    medium:   { bg: '#fffbeb', text: '#d97706' },
    low:      { bg: '#eff6ff', text: '#2563eb' },
    info:     { bg: '#f0fdf4', text: '#16a34a' },
};

const AutomatedTestingTab = () => {
    const [summary, setSummary]           = useState(null);
    const [runs, setRuns]                 = useState([]);
    const [results, setResults]           = useState([]);
    const [total, setTotal]               = useState(0);
    const [pages, setPages]               = useState(1);
    const [page, setPage]                 = useState(1);
    const [selectedResult, setSelectedResult] = useState(null);
    const [activeSuite, setActiveSuite]   = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [devFilter, setDevFilter]       = useState('all');
    const [isLoading, setIsLoading]       = useState(false);
    const [isSumLoading, setIsSumLoading] = useState(true);
    const [runId, setRunId]               = useState(null);
    const [showRuns, setShowRuns]         = useState(false);
    const [loadErr, setLoadErr]           = useState('');
    const [triggering, setTriggering]     = useState(false);
    const [triggerMsg, setTriggerMsg]     = useState('');
    const [showAbout, setShowAbout]       = useState(false);
    const [activeKpiTest, setActiveKpiTest] = useState(null);
    const [sevFilter, setSevFilter]         = useState('all');

    const fmtTime = (iso) => iso ? new Date(iso).toLocaleString('en-IN',{ day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const fmtMs   = (ms) => ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`;

    const loadSummary = useCallback(async () => {
        try {
            const r = await axiosAdmin.get('/testing/summary');
            setSummary(r.data);
            // Use latest completed run's ID for results table
            if (r.data.latestRun?.run_id && !runId) setRunId(r.data.latestRun.run_id);
        } catch { /* skip */ }
        finally { setIsSumLoading(false); }
    }, [runId]);

    const loadRuns = useCallback(async () => {
        try {
            const r = await axiosAdmin.get('/testing/runs');
            setRuns(r.data.runs || []);
        } catch { /* skip */ }
    }, []);

    const loadResults = useCallback(async (pg = 1) => {
        setIsLoading(true);
        setLoadErr('');
        try {
            const params = { page: pg, limit: 100 };
            if (activeSuite !== 'all') params.suite      = activeSuite;
            if (statusFilter !== 'all') params.status    = statusFilter;
            if (devFilter !== 'all')    params.dev_status = devFilter;
            if (sevFilter !== 'all')    params.severity   = sevFilter;
            // Only send run_id for "All Suites" view — suite-specific views span all runs
            if (runId && activeSuite === 'all') params.run_id = runId;
            const r = await axiosAdmin.get('/testing/results', { params });
            setResults(r.data.results || []);
            setTotal(r.data.total || 0);
            setPages(r.data.pages || 1);
            setPage(pg);
        } catch (e) {
            const raw = e.response?.data?.error || e.message || '';
            const friendly = /not defined|undefined|cannot read|reference/i.test(raw)
                ? 'Failed to load results — server encountered an initialization error. Please refresh and try again.'
                : /connect|ECONNREF|network|timeout/i.test(raw)
                ? 'Cannot connect to the testing service. Please verify the server is running.'
                : /403|401|unauthorized|forbidden/i.test(raw)
                ? 'Session expired. Please log out and back in.'
                : raw || 'An unexpected error occurred. Please refresh.';
            setLoadErr(friendly);
        } finally {
            setIsLoading(false);
        }
    }, [activeSuite, statusFilter, devFilter, sevFilter, runId]);

    useEffect(() => { loadSummary(); loadRuns(); }, [loadSummary, loadRuns]);
    useEffect(() => { loadResults(1); }, [loadResults]);

    const triggerRun = async (suite = 'all') => {
        setTriggering(true);
        setTriggerMsg('');
        try {
            const r = await axiosAdmin.post('/testing/trigger', { suite });
            const rid = r.data.run_id;
            setTriggerMsg(`✅ Run queued (ID: ${rid}). Now run the Python engine:\n\ncd testing-engine\npython run_tests.py --suite ${suite} --run-id ${rid}`);
        } catch (e) {
            const raw = e.response?.data?.error || e.message || '';
            const friendly = /not defined|undefined|cannot read|reference/i.test(raw)
                ? 'Testing session initialization failed. Please retry or contact the administrator.'
                : /duplicate|already exists/i.test(raw)
                ? 'A pending run already exists. Check run history before triggering a new one.'
                : /connect|ECONNREF|network|timeout/i.test(raw)
                ? 'Cannot connect to the testing service. Please verify the server is running.'
                : /403|401|unauthorized|forbidden/i.test(raw)
                ? 'Session expired. Please log out and back in.'
                : raw || 'An unexpected error occurred. Please try again.';
            setTriggerMsg(`❌ ${friendly}`);
        } finally {
            setTriggering(false);
        }
    };

    const updateDevStatus = async (id, dev_status, dev_note = '') => {
        await axiosAdmin.patch(`/testing/results/${id}/status`, { dev_status, dev_note });
        setResults(prev => prev.map(r => r.id === id ? { ...r, dev_status } : r));
        if (selectedResult?.id === id) setSelectedResult(prev => ({ ...prev, dev_status }));
        loadSummary();
    };

    const handleKpiClickTest = useCallback((kpiKey, filterStatus, filterDev, filterSev) => {
        if (activeKpiTest === kpiKey) {
            setActiveKpiTest(null); setStatusFilter('all'); setDevFilter('all'); setSevFilter('all');
        } else {
            setActiveKpiTest(kpiKey); setStatusFilter(filterStatus); setDevFilter(filterDev); setSevFilter(filterSev);
        }
    }, [activeKpiTest]);

    const clearKpiTestFilter = useCallback(() => {
        setActiveKpiTest(null); setStatusFilter('all'); setDevFilter('all'); setSevFilter('all');
    }, []);

    const s = summary?.totals || {};
    const latest  = summary?.latestRun;    // latest completed run
    const pending = summary?.pendingRun;   // pending run (queued but not yet executed)
    const suiteBreak = summary?.suiteBreakdown || [];

    // ── Detail View ───────────────────────────────────────────────────────────
    if (selectedResult) {
        const r = selectedResult;
        const ts = TEST_STATUS[r.status] || TEST_STATUS.passed;
        const sv = SEVERITY_BADGE[r.severity] || SEVERITY_BADGE.info;
        const dv = DEV_STATUS[r.dev_status] || DEV_STATUS.open;
        return (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                <button onClick={() => setSelectedResult(null)} style={{ ...btnStyle('#f1f5f9','#374151'), marginBottom: '20px' }}>
                    ← Back to Results
                </button>

                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#1e1e2e,#2d1f3d)', borderRadius: '16px', padding: '24px', marginBottom: '16px', color: '#fff' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        <span style={{ background: ts.bg, color: ts.text, padding: '3px 12px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800 }}>
                            <span style={{ width:'6px',height:'6px',borderRadius:'50%',background:ts.dot,display:'inline-block',marginRight:'5px' }}/>
                            {r.status?.toUpperCase()}
                        </span>
                        <span style={{ background: sv.bg, color: sv.text, padding: '3px 12px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{r.severity?.toUpperCase()}</span>
                        <span style={{ background: dv.bg, color: dv.text, padding: '3px 12px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{dv.label}</span>
                        <span style={{ background: 'rgba(255,255,255,0.12)', color: '#a5b4fc', padding: '3px 12px', borderRadius: '999px', fontSize: '0.7rem' }}>{r.suite}</span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.4, marginBottom: '6px' }}>{r.test_name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{r.category} · {fmtTime(r.created_at)} · {fmtMs(r.duration_ms)}</div>
                </div>

                {/* Message */}
                {r.message && (
                    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '14px', fontSize: '0.88rem', color: '#374151', lineHeight: 1.6 }}>
                        {r.message}
                    </div>
                )}

                {/* Details / stack */}
                {r.details && (
                    <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontWeight: 700, color: '#111827', marginBottom: '8px', fontSize: '0.85rem' }}>📋 Details</div>
                        <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: '12px', padding: '18px', fontSize: '0.75rem', overflowX: 'auto', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {r.details}
                        </pre>
                    </div>
                )}

                {/* Dev note */}
                {r.dev_note && (
                    <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', fontSize: '0.82rem', color: '#713f12' }}>
                        <strong>Developer Note:</strong> {r.dev_note}
                    </div>
                )}

                {/* Actions */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Developer Action:</span>
                    {r.dev_status !== 'in_progress' && <button onClick={() => updateDevStatus(r.id,'in_progress')} style={btnStyle('#fffbeb','#d97706')}>🔧 Start Working</button>}
                    {r.dev_status !== 'completed'   && <button onClick={() => updateDevStatus(r.id,'completed')}   style={btnStyle('#f0fdf4','#16a34a')}>✅ Mark Resolved</button>}
                    {r.dev_status !== 'blocked'     && <button onClick={() => updateDevStatus(r.id,'blocked')}     style={btnStyle('#f5f3ff','#7c3aed')}>🚧 Mark Blocked</button>}
                    {r.dev_status !== 'open'        && <button onClick={() => updateDevStatus(r.id,'open')}        style={btnStyle('#fef2f2','#dc2626')}>🔴 Reopen</button>}
                </div>
            </div>
        );
    }

    // ── Main Dashboard ─────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

            {/* Inner left sidebar — test suites */}
            <div style={{ width: '180px', minWidth: '180px', background: '#fafafa', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Test Suites</div>
                </div>
                {TEST_SUITES.map(s => (
                    <button key={s.key} onClick={() => setActiveSuite(s.key)} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                        background: activeSuite === s.key ? '#f0f4ff' : 'transparent',
                        borderLeft: activeSuite === s.key ? '3px solid #7c3aed' : '3px solid transparent',
                        transition: 'all 0.12s',
                    }}>
                        <span style={{ fontSize: '1rem' }}>{s.icon}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: activeSuite === s.key ? '#7c3aed' : '#374151' }}>{s.label}</span>
                    </button>
                ))}

                {/* Suite breakdown */}
                {suiteBreak.length > 0 && (
                    <div style={{ marginTop: '8px', padding: '8px 14px', borderTop: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px' }}>Last Run</div>
                        {suiteBreak.map(sb => (
                            <div key={sb.suite} style={{ marginBottom: '6px' }}>
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '2px' }}>{sb.suite}</div>
                                <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${sb.total > 0 ? (sb.passed/sb.total*100) : 0}%`, background: sb.failed > 0 ? '#ef4444' : '#22c55e', borderRadius: '2px' }} />
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '1px' }}>{sb.passed}/{sb.total} passed</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Main content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* ── About This Module ── */}
                <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '14px', overflow: 'hidden' }}>
                    {/* Header row */}
                    <button
                        onClick={() => setShowAbout(v => !v)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', gap: '12px' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '1rem', lineHeight: '1', flexShrink: 0 }}>🧪</span>
                            <span style={{ fontWeight: 700, color: '#4c1d95', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>About This Module</span>
                            <span style={{ color: '#c4b5fd', fontWeight: 400, fontSize: '0.85rem', flexShrink: 0 }}>—</span>
                            <span style={{ fontWeight: 600, color: '#5b21b6', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>AI Automated Testing</span>
                            <span style={{ fontSize: '0.7rem', color: '#7c3aed', background: '#ede9fe', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, border: '1px solid #c4b5fd', flexShrink: 0, whiteSpace: 'nowrap' }}>Python Engine · Multi-Suite</span>
                        </div>
                        <span style={{ color: '#7c3aed', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{showAbout ? '▲ Hide' : '▼ How it works'}</span>
                    </button>

                    {/* Expanded content — no internal scroll, compact layout avoids scrollbar width-shift */}
                    {showAbout && (
                        <div style={{ borderTop: '1px solid #ddd6fe', padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                            {/* Overview */}
                            <div style={{ color: '#5b21b6', fontSize: '0.8rem', lineHeight: 1.6 }}>
                                Python-based multi-suite engine that validates <strong>APIs, database integrity, security, code quality & performance</strong>. Results are ingested in real time, classified by severity, and tracked per developer.
                            </div>

                            {/* Workflow — horizontal scrollable row, no wrapping */}
                            <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: '0', paddingBottom: '2px' }}>
                                {[
                                    ['1','Trigger run'],['2','Engine executes'],['3','API & DB'],
                                    ['4','Security scan'],['5','Performance'],['6','Classify issues'],
                                    ['7','Ingest results'],['8','Dashboard live'],
                                ].map(([num, step], i, arr) => (
                                    <React.Fragment key={step}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            <span style={{ background: '#7c3aed', color: '#fff', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800, flexShrink: 0 }}>{num}</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#5b21b6' }}>{step}</span>
                                        </div>
                                        {i < arr.length - 1 && <span style={{ color: '#a78bfa', fontSize: '0.75rem', margin: '0 2px', flexShrink: 0 }}>→</span>}
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* Suite cards — 3 columns, compact */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {[
                                    { cat: '🌐 API',         items: ['Endpoint health', 'Auth validation', 'Response format'] },
                                    { cat: '🔒 Security',    items: ['Secret scanning', 'SQL patterns', 'Credential audit'] },
                                    { cat: '🗄️ Database',     items: ['Schema checks', 'Data integrity', 'Orphaned records'] },
                                    { cat: '🧹 Code Quality',items: ['Linting', 'Dead code', 'TODO audit'] },
                                    { cat: '⚡ Performance', items: ['Response time', 'Load testing', 'Slow queries'] },
                                    { cat: '🏷️ Severity',    items: ['critical → fix now', 'high → next release', 'medium → sprint', 'low → backlog', 'info → monitor'] },
                                ].map(({ cat, items }) => (
                                    <div key={cat} style={{ background: '#fff', borderRadius: '8px', padding: '9px 11px', border: '1px solid #ddd6fe' }}>
                                        <div style={{ fontWeight: 700, color: '#4c1d95', fontSize: '0.74rem', marginBottom: '5px' }}>{cat}</div>
                                        {items.map(item => (
                                            <div key={item} style={{ fontSize: '0.71rem', color: '#6b7280', marginBottom: '2px', paddingLeft: '8px', position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: 0, color: '#a78bfa' }}>·</span>{item}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* Quick notes — 3 pills in a row */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {[
                                    ['💡', 'Click ▶ Run Tests → copy run ID → run python3 run_tests.py --run-id <id> on server'],
                                    ['📊', 'Track each issue: Open → In Progress → Completed via Dev Status'],
                                    ['🔄', 'Results auto-appear once engine pushes to POST /api/testing/ingest'],
                                ].map(([icon, text]) => (
                                    <div key={icon} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', background: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '7px', padding: '6px 10px', fontSize: '0.74rem', color: '#3b0764', flex: '1 1 200px' }}>
                                        <span style={{ flexShrink: 0 }}>{icon}</span>
                                        <span style={{ lineHeight: 1.5 }}>{text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Run info bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Status info — only shown when there is data */}
                    {(latest || pending) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#6b7280' }}>
                            {latest && (
                                <>
                                    <span>Last completed:</span>
                                    <strong style={{ color: '#374151' }}>{latest.suite}</strong>
                                    <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '1px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>✅ completed</span>
                                    <span style={{ color: '#9ca3af' }}>{fmtTime(latest.started_at)}</span>
                                    <span style={{ color: '#9ca3af' }}>· {latest.passed}/{latest.total} passed</span>
                                </>
                            )}
                            {pending && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '3px 10px', color: '#d97706', fontWeight: 600, fontSize: '0.75rem' }}>
                                    ⏳ Pending run queued — run Python engine to execute
                                </div>
                            )}
                        </div>
                    )}
                    {/* Action buttons — always one row, no wrapping */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap' }}>
                        <button onClick={() => { setShowRuns(v=>!v); if (!showRuns) loadRuns(); }}
                            style={{ ...btnStyle('#f1f5f9','#374151'), fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            📋 {showRuns ? 'Hide' : 'View'} History
                        </button>
                        <button onClick={() => { loadSummary(); loadResults(1); }}
                            style={{ ...btnStyle('#f1f5f9','#374151'), fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            ↻ Refresh
                        </button>
                        <button onClick={() => triggerRun(activeSuite)} disabled={triggering}
                            style={{ ...btnStyle('#7c3aed','#fff'), opacity: triggering ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                            {triggering ? '⏳ Queuing…' : '▶ Run Tests'}
                        </button>
                    </div>
                </div>

                {/* Trigger message */}
                {triggerMsg && (
                    <div style={{ background: triggerMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${triggerMsg.startsWith('✅') ? '#86efac' : '#fca5a5'}`, borderRadius: '10px', padding: '14px 16px', fontSize: '0.8rem', color: '#374151', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {triggerMsg}
                        <button onClick={() => setTriggerMsg('')} style={{ float: 'right', ...btnStyle('#f1f5f9','#374151'), fontSize: '0.7rem' }}>✕</button>
                    </div>
                )}

                {/* Run history */}
                {showRuns && runs.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.85rem', color: '#111827' }}>📋 Run History</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead><tr style={{ background: '#f9fafb' }}>
                                {['Suite','Status','Passed','Failed','Warnings','Duration','Started',''].map(h => <th key={h} style={thStyle}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {runs.map(r => (
                                    <tr key={r.run_id} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                                        onClick={() => { setRunId(r.run_id); loadResults(1); setShowRuns(false); }}>
                                        <td style={tdStyle}>{r.suite}</td>
                                        <td style={tdStyle}><span style={{ background: r.status==='completed'?'#f0fdf4':'#fef2f2', color: r.status==='completed'?'#16a34a':'#dc2626', padding:'2px 8px', borderRadius:'999px', fontSize:'0.7rem', fontWeight:700 }}>{r.status}</span></td>
                                        <td style={{ ...tdStyle, color:'#16a34a', fontWeight:700 }}>{r.passed}</td>
                                        <td style={{ ...tdStyle, color:'#dc2626', fontWeight:700 }}>{r.failed}</td>
                                        <td style={{ ...tdStyle, color:'#d97706' }}>{r.warnings}</td>
                                        <td style={{ ...tdStyle, color:'#6b7280' }}>{fmtMs(r.duration_ms)}</td>
                                        <td style={{ ...tdStyle, color:'#9ca3af', whiteSpace:'nowrap' }}>{fmtTime(r.started_at)}</td>
                                        <td style={tdStyle}><button style={{ ...btnStyle('#f1f5f9','#374151'), fontSize:'0.72rem', padding:'3px 10px' }}>Load →</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Summary KPI cards (interactive filters) */}
                {!isSumLoading && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '10px' }}>
                            {[
                                { label:'Total Tests', kpiKey:'total',    val:s.total_results, icon:'🧪', g:'linear-gradient(135deg,#7c3aed,#8b5cf6)', l:'#f5f3ff', accent:'#7c3aed', fStatus:'all',     fDev:'all',  fSev:'all'      },
                                { label:'Passed',      kpiKey:'passed',   val:s.passed,        icon:'✅', g:'linear-gradient(135deg,#059669,#10b981)', l:'#ecfdf5', accent:'#059669', fStatus:'passed',  fDev:'all',  fSev:'all'      },
                                { label:'Failed',      kpiKey:'failed',   val:s.failed,        icon:'❌', g:'linear-gradient(135deg,#dc2626,#ef4444)', l:'#fef2f2', accent:'#dc2626', fStatus:'failed',  fDev:'all',  fSev:'all'      },
                                { label:'Warnings',    kpiKey:'warnings', val:s.warnings,      icon:'⚠️', g:'linear-gradient(135deg,#d97706,#f59e0b)', l:'#fffbeb', accent:'#d97706', fStatus:'warning', fDev:'all',  fSev:'all'      },
                                { label:'Critical',    kpiKey:'critical', val:s.critical,      icon:'☠️', g:'linear-gradient(135deg,#7f1d1d,#dc2626)', l:'#fef2f2', accent:'#7f1d1d', fStatus:'all',     fDev:'all',  fSev:'critical' },
                                { label:'Open Issues', kpiKey:'open',     val:s.open_issues,   icon:'🔴', g:'linear-gradient(135deg,#0891b2,#06b6d4)', l:'#ecfeff', accent:'#0891b2', fStatus:'all',     fDev:'open', fSev:'all'      },
                            ].map(c => {
                                const isActive = activeKpiTest === c.kpiKey;
                                return (
                                    <div
                                        key={c.kpiKey}
                                        role="button" tabIndex={0} aria-pressed={isActive}
                                        title={isActive ? `Remove filter: ${c.label}` : `Filter by: ${c.label}`}
                                        onClick={() => handleKpiClickTest(c.kpiKey, c.fStatus, c.fDev, c.fSev)}
                                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleKpiClickTest(c.kpiKey, c.fStatus, c.fDev, c.fSev)}
                                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.transform = 'none'; }}
                                        style={{
                                            borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', outline: 'none', position: 'relative',
                                            boxShadow: isActive ? `0 0 0 3px ${c.accent}, 0 8px 20px rgba(0,0,0,0.13)` : '0 2px 8px rgba(0,0,0,0.07)',
                                            transform: isActive ? 'translateY(-3px)' : 'none',
                                            transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                                        }}
                                    >
                                        <div style={{ background: c.g, padding: '12px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
                                            <span style={{ fontSize: '1.1rem' }}>{c.icon}</span>
                                            {isActive && (
                                                <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.96)', color: c.accent, fontSize: '0.52rem', fontWeight: 900, padding: '2px 7px', borderRadius: '999px 999px 0 0', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                                                    ● ACTIVE
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ background: c.l, padding: '8px 14px 12px', borderTop: `2px solid ${isActive ? c.accent : 'transparent'}`, transition: 'border-color 0.18s' }}>
                                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#111827', lineHeight: 1 }}>{isSumLoading ? '…' : fmt(c.val)}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
                                💡 Click any card to filter results — click again to reset.
                            </span>
                            {activeKpiTest !== null && (
                                <button onClick={clearKpiTestFilter} style={{ ...btnStyle('#fef2f2','#dc2626'), border: '1px solid #fca5a5', fontSize: '0.72rem', padding: '4px 12px' }}>
                                    ✕ Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: '#fff', borderRadius: '10px', padding: '10px 14px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                        {['all','passed','failed','warning','error'].map(s => (
                            <button key={s} onClick={() => setStatusFilter(s)} style={{
                                padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize',
                                background: statusFilter === s ? '#fff' : 'transparent',
                                color: statusFilter === s ? '#111827' : '#6b7280',
                                boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}>{s}</button>
                        ))}
                    </div>
                    <select value={devFilter} onChange={e => setDevFilter(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid #e5e7eb', fontSize: '0.78rem', color: '#374151', background: '#f9fafb', cursor: 'pointer' }}>
                        <option value="all">All Dev Status</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="blocked">Blocked</option>
                    </select>
                    <span style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: 'auto' }}>{fmt(total)} results</span>
                </div>

                {loadErr && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#b91c1c' }}>{loadErr}</div>}

                {/* Results table */}
                <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                    {isLoading ? (
                        <div style={{ padding: '50px', textAlign: 'center', color: '#9ca3af' }}>Loading test results…</div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🧪</div>
                            <div style={{ fontWeight: 700, color: '#374151' }}>No test results yet</div>
                            <div style={{ color: '#9ca3af', fontSize: '0.82rem', marginTop: '6px' }}>
                                Click <strong>▶ Run Tests</strong> then execute the Python engine to populate results.
                            </div>
                            <div style={{ marginTop: '14px', background: '#0f172a', color: '#e2e8f0', borderRadius: '10px', padding: '14px 18px', fontFamily: 'monospace', fontSize: '0.78rem', textAlign: 'left', maxWidth: '420px', margin: '14px auto 0' }}>
                                cd testing-engine<br/>
                                pip install -r requirements.txt<br/>
                                cp .env.example .env<br/>
                                python run_tests.py
                            </div>
                        </div>
                    ) : (
                        <>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb' }}>
                                        {['Status','Severity','Test Name','Suite','Dev Status','Duration',''].map(h => (
                                            <th key={h} style={thStyle}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map(r => {
                                        const ts = TEST_STATUS[r.status]   || TEST_STATUS.passed;
                                        const sv = SEVERITY_BADGE[r.severity] || SEVERITY_BADGE.info;
                                        const dv = DEV_STATUS[r.dev_status]   || DEV_STATUS.open;
                                        return (
                                            <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <td style={tdStyle}>
                                                    <span style={{ background: ts.bg, color: ts.text, padding: '2px 9px', borderRadius: '999px', fontSize: '0.67rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                                                        <span style={{ width:'5px',height:'5px',borderRadius:'50%',background:ts.dot,display:'inline-block' }}/>
                                                        {r.status?.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ background: sv.bg, color: sv.text, padding: '2px 8px', borderRadius: '999px', fontSize: '0.67rem', fontWeight: 700 }}>{r.severity}</span>
                                                </td>
                                                <td style={{ ...tdStyle, maxWidth: '260px' }}>
                                                    <div style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.test_name}>{r.test_name}</div>
                                                    {r.message && <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</div>}
                                                </td>
                                                <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{r.suite}</td>
                                                <td style={tdStyle}>
                                                    <span style={{ background: dv.bg, color: dv.text, padding: '2px 8px', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>{dv.label}</span>
                                                </td>
                                                <td style={{ ...tdStyle, color: '#9ca3af', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{fmtMs(r.duration_ms)}</td>
                                                <td style={tdStyle}>
                                                    <button onClick={() => setSelectedResult(r)} style={{ ...btnStyle('#f1f5f9','#374151'), fontSize: '0.72rem', padding: '4px 10px' }}>View →</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {pages > 1 && (
                                <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Page {page} of {pages}</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button disabled={page<=1}    onClick={() => loadResults(page-1)} style={{ ...btnStyle('#f1f5f9','#374151'), opacity: page<=1?0.4:1 }}>← Prev</button>
                                        <button disabled={page>=pages} onClick={() => loadResults(page+1)} style={{ ...btnStyle('#7c3aed','#fff'), opacity: page>=pages?0.4:1 }}>Next →</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Quick start box — only show when no results yet */}
                {!latest && !isLoading && (
                    <div style={{ background: 'linear-gradient(135deg,#1e1e2e,#2d1f3d)', borderRadius: '14px', padding: '20px 24px', color: '#fff' }}>
                        <div style={{ fontWeight: 700, marginBottom: '10px', fontSize: '0.95rem' }}>🚀 Quick Start — Run Tests on Server</div>
                        <pre style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '14px', fontSize: '0.75rem', color: '#e2e8f0', lineHeight: 1.8, margin: 0, overflowX: 'auto' }}>{`# SSH into your server, then:
cd /var/www/html/sangian/testing-engine
source venv/bin/activate

# Run all suites
python run_tests.py

# Or run a specific suite
python run_tests.py --suite api
python run_tests.py --suite security
python run_tests.py --suite db
python run_tests.py --suite code_quality
python run_tests.py --suite performance`}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Contact Us Email Settings Tab ───────────────────────────────────────────

const ToggleRow = ({ label, description, checked, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{label}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px', lineHeight: 1.5 }}>{description}</div>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '26px', flexShrink: 0 }}>
            <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: '34px', background: checked ? '#4f46e5' : '#d1d5db', transition: 'background 0.2s' }}>
                <span style={{ position: 'absolute', height: '20px', width: '20px', left: checked ? '23px' : '3px', bottom: '3px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </span>
        </label>
    </div>
);

const ContactEmailSettingsTab = () => {
    const [settings, setSettings] = useState({ send_sender_email: 1, send_admin_email: 1, admin_email: '' });
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [toast,    setToast]    = useState(null);
    const [emailErr, setEmailErr] = useState('');

    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

    useEffect(() => {
        setLoading(true);
        axiosAdmin.get('/admin/contact-email-settings')
            .then(({ data }) => {
                const s = data.settings;
                setSettings({ send_sender_email: s.send_sender_email ?? 1, send_admin_email: s.send_admin_email ?? 1, admin_email: s.admin_email ?? '' });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        if (settings.admin_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.admin_email)) {
            setEmailErr('Enter a valid email address.');
            return;
        }
        setEmailErr('');
        setSaving(true);
        try {
            await axiosAdmin.post('/admin/contact-email-settings', settings);
            showToast('success', 'Settings saved successfully!');
        } catch { showToast('error', 'Failed to save settings.'); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: '#9ca3af' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading…
        </div>
    );

    return (
        <div style={{ padding: '28px 32px', maxWidth: '640px' }}>

            {toast && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: toast.type === 'success' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: '14px' }}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Email Notifications</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                    Configure automatic emails sent when a visitor submits the Contact Us form.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                <ToggleRow
                    label="Send Thank-You Email to Sender"
                    description="Automatically email the visitor a confirmation when they submit the contact form. Sent in the visitor's selected language (English or Hindi)."
                    checked={!!settings.send_sender_email}
                    onChange={e => setSettings(s => ({ ...s, send_sender_email: e.target.checked ? 1 : 0 }))}
                />
                <ToggleRow
                    label="Send Admin Notification Email"
                    description="Notify the admin email address below whenever a new contact form is submitted. Includes the visitor's full message, email, and phone number."
                    checked={!!settings.send_admin_email}
                    onChange={e => setSettings(s => ({ ...s, send_admin_email: e.target.checked ? 1 : 0 }))}
                />
            </div>

            <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Admin Notification Email
                </label>
                <input
                    type="email"
                    value={settings.admin_email}
                    onChange={e => { setEmailErr(''); setSettings(s => ({ ...s, admin_email: e.target.value })); }}
                    placeholder="admin@example.com"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1.5px solid ${emailErr ? '#f87171' : '#e5e7eb'}`, fontSize: '14px', color: '#1f2937', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {emailErr ? (
                    <div style={{ marginTop: '5px', fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>{emailErr}</div>
                ) : (
                    <div style={{ marginTop: '5px', fontSize: '12px', color: '#9ca3af' }}>
                        Receives notification emails when "Send Admin Notification Email" is ON.
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>💡 Emails are sent asynchronously and do not delay form submission.</span>
                <button
                    onClick={save}
                    disabled={saving}
                    style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
                >
                    {saving ? '⏳ Saving…' : '💾 Save Settings'}
                </button>
            </div>
        </div>
    );
};

// ─── Admin Profile Tab ────────────────────────────────────────────────────────

const AdminProfileTab = () => {
    const [profile,     setProfile]     = useState({ name: '', email: '', logo_url: '' });
    const [loading,     setLoading]     = useState(true);
    const [saving,      setSaving]      = useState(false);
    const [uploading,   setUploading]   = useState(false);
    const [toast,       setToast]       = useState(null);
    const [currentPwd,    setCurrentPwd]    = useState('');
    const [newPwd,        setNewPwd]        = useState('');
    const [confirmPwd,    setConfirmPwd]    = useState('');
    const [pwdErr,        setPwdErr]        = useState('');
    const [showCurrent,   setShowCurrent]   = useState(false);
    const [showNew,       setShowNew]       = useState(false);
    const [showConfirm,   setShowConfirm]   = useState(false);
    const fileRef = useRef(null);

    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

    useEffect(() => {
        axiosAdmin.get('/admin/profile')
            .then(({ data }) => setProfile(data.profile || {}))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const saveProfile = async () => {
        if (newPwd || confirmPwd) {
            if (newPwd !== confirmPwd) { setPwdErr('New passwords do not match.'); return; }
            if (newPwd.length < 6)    { setPwdErr('New password must be at least 6 characters.'); return; }
        }
        setPwdErr('');
        setSaving(true);
        try {
            const { data } = await axiosAdmin.put('/admin/profile', {
                name: profile.name,
                email: profile.email,
                currentPassword: currentPwd || undefined,
                newPassword:     newPwd     || undefined,
            });
            if (data.success) {
                const stored = JSON.parse(localStorage.getItem('adminUser') || '{}');
                const updated = { ...stored, name: data.profile.name, email: data.profile.email };
                localStorage.setItem('adminUser', JSON.stringify(updated));
                window.dispatchEvent(new Event('adminProfileUpdated'));
                setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
                showToast('success', 'Profile updated successfully!');
            }
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Failed to save profile.');
        } finally { setSaving(false); }
    };

    const handleLogoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('logo', file);
        setUploading(true);
        try {
            const { data } = await axiosAdmin.post('/admin/profile/logo', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (data.success) {
                setProfile(p => ({ ...p, logo_url: data.logoUrl }));
                const stored = JSON.parse(localStorage.getItem('adminUser') || '{}');
                localStorage.setItem('adminUser', JSON.stringify({ ...stored, logo_url: data.logoUrl }));
                window.dispatchEvent(new Event('adminProfileUpdated'));
                showToast('success', 'Logo updated!');
            }
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Logo upload failed.');
        } finally { setUploading(false); e.target.value = ''; }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: '#9ca3af' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading…
        </div>
    );

    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', color: '#1f2937', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' };
    const sectionStyle = { marginBottom: '28px' };

    return (
        <div style={{ padding: '28px 32px', maxWidth: '640px' }}>

            {toast && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: toast.type === 'success' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: '14px' }}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            {/* Logo upload */}
            <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div
                    onClick={() => fileRef.current?.click()}
                    style={{ width: '72px', height: '72px', borderRadius: '16px', overflow: 'hidden', border: '2px dashed #d1d5db', cursor: 'pointer', flexShrink: 0, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {profile.logo_url
                        ? <img src={getAdminLogoUrl(profile.logo_url)} alt="Admin Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <span style={{ fontSize: '28px' }}>🖼️</span>
                    }
                </div>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>Admin Logo</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>Replaces the default logo in the top-left header. JPG, PNG, or WebP · max 2 MB.</div>
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        style={{ padding: '7px 16px', borderRadius: '8px', border: '1.5px solid #059669', background: 'transparent', color: '#059669', fontSize: '13px', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: uploading ? 0.7 : 1 }}
                    >
                        {uploading ? '⏳ Uploading…' : '📤 Upload Logo'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleLogoChange} />
                </div>
            </div>

            {/* Name & Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', ...sectionStyle }}>
                <div>
                    <label style={labelStyle}>Admin Name</label>
                    <input style={inputStyle} type="text" value={profile.name || ''} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
                </div>
                <div>
                    <label style={labelStyle}>Login Email</label>
                    <input style={inputStyle} type="email" value={profile.email || ''} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="admin@example.com" />
                </div>
            </div>

            {/* Password change */}
            <div style={{ ...sectionStyle, padding: '20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>Change Password</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>Leave blank to keep your current password.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                        <label style={labelStyle}>Current Password</label>
                        <div style={{ position: 'relative' }}>
                            <input style={{ ...inputStyle, paddingRight: '38px' }} type={showCurrent ? 'text' : 'password'} value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                            <button type="button" onClick={() => setShowCurrent(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', fontSize: '16px', lineHeight: 1 }}>
                                {showCurrent ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>New Password</label>
                        <div style={{ position: 'relative' }}>
                            <input style={{ ...inputStyle, paddingRight: '38px' }} type={showNew ? 'text' : 'password'} value={newPwd} onChange={e => { setNewPwd(e.target.value); setPwdErr(''); }} placeholder="••••••••" autoComplete="new-password" />
                            <button type="button" onClick={() => setShowNew(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', fontSize: '16px', lineHeight: 1 }}>
                                {showNew ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Confirm New</label>
                        <div style={{ position: 'relative' }}>
                            <input style={{ ...inputStyle, paddingRight: '38px', borderColor: pwdErr ? '#f87171' : '#e5e7eb' }} type={showConfirm ? 'text' : 'password'} value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setPwdErr(''); }} placeholder="••••••••" autoComplete="new-password" />
                            <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', fontSize: '16px', lineHeight: 1 }}>
                                {showConfirm ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>
                </div>
                {pwdErr && <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>{pwdErr}</div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <button
                    onClick={saveProfile}
                    disabled={saving}
                    style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#059669', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
                >
                    {saving ? '⏳ Saving…' : '💾 Save Profile'}
                </button>
            </div>
        </div>
    );
};

// ─── SMTP Settings Tab ────────────────────────────────────────────────────────

const SmtpSettingsTab = () => {
    const [settings, setSettings] = useState({ host: '', port: 587, username: '', password: '', encryption: 'tls', from_email: '', from_name: 'Sangian Support' });
    const [loading,   setLoading]   = useState(true);
    const [saving,    setSaving]    = useState(false);
    const [testing,   setTesting]   = useState(false);
    const [showPass,  setShowPass]  = useState(false);
    const [toast,     setToast]     = useState(null);

    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000); };

    useEffect(() => {
        axiosAdmin.get('/admin/smtp-settings')
            .then(({ data }) => {
                const s = data.settings || {};
                setSettings({
                    host:       s.host       || '',
                    port:       s.port       || 587,
                    username:   s.username   || '',
                    password:   s.password   || '',
                    encryption: s.encryption || 'tls',
                    from_email: s.from_email || '',
                    from_name:  s.from_name  || 'Sangian Support',
                });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await axiosAdmin.post('/admin/smtp-settings', settings);
            showToast('success', 'SMTP settings saved successfully!');
        } catch { showToast('error', 'Failed to save settings.'); }
        finally { setSaving(false); }
    };

    const testConnection = async () => {
        setTesting(true);
        try {
            const { data } = await axiosAdmin.post('/admin/smtp-test');
            showToast('success', data.message || 'Connection successful!');
        } catch (err) {
            showToast('error', err.response?.data?.error || 'Connection failed.');
        } finally { setTesting(false); }
    };

    const field = (label, key, type = 'text', placeholder = '') => (
        <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
            <input
                type={type}
                value={settings[key]}
                onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', color: '#1f2937', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
        </div>
    );

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: '#9ca3af' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading…
        </div>
    );

    return (
        <div style={{ padding: '28px 32px', maxWidth: '680px' }}>

            {toast && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: toast.type === 'success' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: '14px' }}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>SMTP Configuration</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                    Configure the outgoing email server. These settings are used for all automated emails — OTP verification, ticket notifications, and contact form responses.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <div style={{ gridColumn: '1 / -1' }}>{field('SMTP Host', 'host', 'text', 'smtp.example.com')}</div>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Port</label>
                    <input
                        type="number"
                        value={settings.port}
                        onChange={e => setSettings(s => ({ ...s, port: parseInt(e.target.value) || 587 }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', color: '#1f2937', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '18px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encryption</label>
                    <select
                        value={settings.encryption}
                        onChange={e => setSettings(s => ({ ...s, encryption: e.target.value }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', color: '#1f2937', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '18px' }}
                    >
                        <option value="tls">TLS (STARTTLS)</option>
                        <option value="ssl">SSL</option>
                        <option value="none">None</option>
                    </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>{field('Username / Email', 'username', 'text', 'smtp-user@example.com')}</div>
                <div style={{ gridColumn: '1 / -1', marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPass ? 'text' : 'password'}
                            value={settings.password}
                            onChange={e => setSettings(s => ({ ...s, password: e.target.value }))}
                            placeholder="SMTP password or app password"
                            style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '14px', color: '#1f2937', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                        />
                        <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0 }}>
                            {showPass ? '🙈' : '👁️'}
                        </button>
                    </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>{field('From Name', 'from_name', 'text', 'Sangian Support')}</div>
                <div style={{ gridColumn: '1 / -1' }}>{field('From Email Address', 'from_email', 'email', 'support@example.com')}</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                <button
                    onClick={testConnection}
                    disabled={testing || !settings.host}
                    style={{ padding: '10px 20px', borderRadius: '10px', border: '1.5px solid #6366f1', background: '#fff', color: '#4f46e5', fontSize: '14px', fontWeight: 700, cursor: (testing || !settings.host) ? 'not-allowed' : 'pointer', opacity: (testing || !settings.host) ? 0.6 : 1, fontFamily: 'inherit' }}
                >
                    {testing ? '⏳ Testing…' : '🔌 Test Connection'}
                </button>
                <div style={{ flex: 1 }} />
                <button
                    onClick={save}
                    disabled={saving}
                    style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
                >
                    {saving ? '⏳ Saving…' : '💾 Save Settings'}
                </button>
            </div>
        </div>
    );
};

// ─── Help & Support Email Settings Tab ────────────────────────────────────────

const HelpEmailSettingsTab = () => {
    const [settings, setSettings] = useState({ send_user_email: 1, send_admin_email: 1, send_on_admin_reply: 1, send_on_user_reply: 1, admin_email: '' });
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [toast,    setToast]    = useState(null);
    const [emailErr, setEmailErr] = useState('');

    const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

    useEffect(() => {
        axiosAdmin.get('/admin/help-email-settings')
            .then(({ data }) => {
                const s = data.settings || {};
                setSettings({
                    send_user_email:     s.send_user_email     ?? 1,
                    send_admin_email:    s.send_admin_email    ?? 1,
                    send_on_admin_reply: s.send_on_admin_reply ?? 1,
                    send_on_user_reply:  s.send_on_user_reply  ?? 1,
                    admin_email:         s.admin_email         ?? '',
                });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        if (settings.admin_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.admin_email)) {
            setEmailErr('Enter a valid email address.');
            return;
        }
        setEmailErr('');
        setSaving(true);
        try {
            await axiosAdmin.post('/admin/help-email-settings', settings);
            showToast('success', 'Settings saved successfully!');
        } catch { showToast('error', 'Failed to save settings.'); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: '#9ca3af' }}>
            <div style={{ width: '20px', height: '20px', border: '2px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading…
        </div>
    );

    return (
        <div style={{ padding: '28px 32px', maxWidth: '640px' }}>

            {toast && (
                <div style={{ marginBottom: '20px', padding: '12px 16px', borderRadius: '10px', background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`, color: toast.type === 'success' ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: '14px' }}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
                </div>
            )}

            <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>Ticket Email Notifications</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                    Control which automated emails are sent for Help &amp; Support ticket events.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
                <ToggleRow
                    label="Send Confirmation Email to User"
                    description="Email the user a confirmation with their ticket ID when they create a new ticket. Also sent when ticket status changes."
                    checked={!!settings.send_user_email}
                    onChange={e => setSettings(s => ({ ...s, send_user_email: e.target.checked ? 1 : 0 }))}
                />
                <ToggleRow
                    label="Send New Ticket Notification to Admin"
                    description="Notify the admin email address when a new support ticket is submitted. Includes ticket ID, subject, and user message."
                    checked={!!settings.send_admin_email}
                    onChange={e => setSettings(s => ({ ...s, send_admin_email: e.target.checked ? 1 : 0 }))}
                />
                <ToggleRow
                    label="Notify User When Admin Replies"
                    description="Send the user an email preview of the admin reply whenever the admin responds to their ticket."
                    checked={!!settings.send_on_admin_reply}
                    onChange={e => setSettings(s => ({ ...s, send_on_admin_reply: e.target.checked ? 1 : 0 }))}
                />
                <ToggleRow
                    label="Notify Admin When User Replies"
                    description="Send the admin an email notification with a preview when a user adds a reply to an existing ticket."
                    checked={!!settings.send_on_user_reply}
                    onChange={e => setSettings(s => ({ ...s, send_on_user_reply: e.target.checked ? 1 : 0 }))}
                />
            </div>

            <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Admin Notification Email
                </label>
                <input
                    type="email"
                    value={settings.admin_email}
                    onChange={e => { setEmailErr(''); setSettings(s => ({ ...s, admin_email: e.target.value })); }}
                    placeholder="admin@example.com"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1.5px solid ${emailErr ? '#f87171' : '#e5e7eb'}`, fontSize: '14px', color: '#1f2937', background: '#fafafa', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                {emailErr ? (
                    <div style={{ marginTop: '5px', fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>{emailErr}</div>
                ) : (
                    <div style={{ marginTop: '5px', fontSize: '12px', color: '#9ca3af' }}>
                        Receives new ticket and user reply notifications.
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>💡 Requires SMTP to be configured in the SMTP Settings tab.</span>
                <button
                    onClick={save}
                    disabled={saving}
                    style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
                >
                    {saving ? '⏳ Saving…' : '💾 Save Settings'}
                </button>
            </div>
        </div>
    );
};

// ─── Main AdminSettings page ──────────────────────────────────────────────────

const CONTENT_MAP = {
    google_analytics:  <GoogleAnalyticsTab />,
    crash_analytics:   <CrashAnalyticsTab />,
    automated_testing: <AutomatedTestingTab />,
    contact_email:     <ContactEmailSettingsTab />,
    smtp_settings:     <SmtpSettingsTab />,
    help_email:        <HelpEmailSettingsTab />,
    admin_profile:     <AdminProfileTab />,
    languages:         <AdminLanguageSettingsTab />,
    test_config:       <AdminTestConfigTab />,
    notifications:     <AdminNotificationsTab />,
};

const AdminSettings = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'google_analytics';

    const setActiveTab = (tab) => {
        setSearchParams({ tab });
    };

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
