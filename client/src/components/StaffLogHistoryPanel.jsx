import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { ADMIN_MODULES } from '../utils/staffPermissions';
import ActivityDetailsModal from './ActivityDetailsModal';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour12: false }) : '—';
const fmtDateTime = (iso) => iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '—';
const fmtDuration = (secs) => {
    if (secs == null) return '—';
    const s = Math.max(0, Math.round(Number(secs) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const LOGIN_STATUS_TAG = {
    success: { bg: '#dcfce7', color: '#166534', label: 'Success' },
    failed:  { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
};
const LOGOUT_STATUS_TAG = {
    normal:          { bg: '#e0f2fe', color: '#0369a1', label: 'Normal' },
    force_logout:    { bg: '#fef3c7', color: '#92400e', label: 'Force Logout' },
    session_expired: { bg: '#f1f5f9', color: '#475569', label: 'Session Expired' },
    active:          { bg: '#dcfce7', color: '#166534', label: 'Active Now' },
};
const ACTION_TAG = {
    login:            { bg: '#dcfce7', color: '#166534', label: 'Login' },
    logout:           { bg: '#f1f5f9', color: '#475569', label: 'Logout' },
    create:           { bg: '#dbeafe', color: '#1e40af', label: 'Create' },
    edit:             { bg: '#fef9c3', color: '#854d0e', label: 'Edit' },
    delete:           { bg: '#fee2e2', color: '#991b1b', label: 'Delete' },
    password_change:  { bg: '#ede9fe', color: '#6d28d9', label: 'Password Change' },
    profile_update:   { bg: '#e0f2fe', color: '#0369a1', label: 'Profile Update' },
    force_logout:     { bg: '#fef3c7', color: '#92400e', label: 'Force Logout' },
    page_view:        { bg: '#f1f5f9', color: '#334155', label: 'Page View' },
    export:           { bg: '#ecfeff', color: '#0e7490', label: 'Report Download' },
};
const actionTag = (type) => ACTION_TAG[type] || { bg: '#f1f5f9', color: '#475569', label: type };

const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' };

const StatCard = ({ icon, label, value, color }) => (
    <div style={{ flex: '1 1 160px', minWidth: 160, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{icon} {label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: color || '#0f172a' }}>{value}</div>
    </div>
);

// ── Login History tab ───────────────────────────────────────────────────
const LoginHistoryTab = ({ id, staffInfo, sessions, summary, total, loading, page, setPage,
    search, setSearch, startDate, setStartDate, endDate, setEndDate,
    sortKey, sortDir, toggleSort, onForceLogout, exportExcel, exportPDF, exporting }) => {
    const limit = 20;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
                <button onClick={exportExcel} disabled={exporting} className="admin-btn">📊 Export Excel</button>
                <button onClick={exportPDF} disabled={exporting} className="admin-btn">📄 Export PDF</button>
            </div>

            {summary && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                    <StatCard icon="🔑" label="Total Logins" value={summary.totalLogins} color="#166534" />
                    <StatCard icon="⚠️" label="Failed Attempts" value={summary.totalFailed} color={summary.totalFailed > 0 ? '#991b1b' : '#0f172a'} />
                    <StatCard icon="🟢" label="Last Login" value={fmtDateTime(summary.lastLogin)} />
                    <StatCard icon="🔴" label="Last Logout" value={fmtDateTime(summary.lastLogout)} />
                    <StatCard icon="⏱️" label="Total Working Hours" value={fmtDuration(summary.totalWorkingSeconds)} />
                    <StatCard icon="📈" label="Avg Session Duration" value={fmtDuration(summary.avgSessionSeconds)} />
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="admin-search" style={{ maxWidth: '300px', flex: 1 }}>
                    <input type="search" placeholder="Search IP, browser, OS, device..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>From:</label>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} style={inputStyle} />
                <label style={{ fontSize: 13, fontWeight: 600 }}>To:</label>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} style={inputStyle} />
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th onClick={() => toggleSort('login_time')} style={{ cursor: 'pointer' }}>Login Date/Time {sortKey === 'login_time' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th onClick={() => toggleSort('logout_time')} style={{ cursor: 'pointer' }}>Logout Date/Time {sortKey === 'logout_time' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th onClick={() => toggleSort('session_duration')} style={{ cursor: 'pointer' }}>Session Duration {sortKey === 'session_duration' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th>Check-In</th>
                            <th>Check-Out</th>
                            <th>Working Hours</th>
                            <th onClick={() => toggleSort('ip_address')} style={{ cursor: 'pointer' }}>IP Address {sortKey === 'ip_address' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th onClick={() => toggleSort('browser')} style={{ cursor: 'pointer' }}>Browser {sortKey === 'browser' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th onClick={() => toggleSort('os')} style={{ cursor: 'pointer' }}>OS {sortKey === 'os' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th onClick={() => toggleSort('device_type')} style={{ cursor: 'pointer' }}>Device {sortKey === 'device_type' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th>Login Status</th>
                            <th>Logout Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={13} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
                        ) : sessions.length === 0 ? (
                            <tr><td colSpan={13} style={{ textAlign: 'center', padding: '20px' }}>No login history recorded yet.</td></tr>
                        ) : (
                            sessions.map((s, i) => {
                                const loginTag = LOGIN_STATUS_TAG[s.login_status] || { bg: '#f1f5f9', color: '#475569', label: s.login_status };
                                const logoutTag = s.logout_status ? (LOGOUT_STATUS_TAG[s.logout_status] || { bg: '#f1f5f9', color: '#475569', label: s.logout_status }) : null;
                                return (
                                    <tr key={s.id}>
                                        <td>{(page - 1) * limit + i + 1}</td>
                                        <td>{fmtDateTime(s.login_time)}</td>
                                        <td>{fmtDateTime(s.logout_time)}</td>
                                        <td>{fmtDuration(s.session_duration)}</td>
                                        <td>{fmtTime(s.login_time)}</td>
                                        <td>{fmtTime(s.logout_time)}</td>
                                        <td>{fmtDuration(s.session_duration)}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{s.ip_address || '—'}</td>
                                        <td>{s.browser || '—'}</td>
                                        <td>{s.os || '—'}</td>
                                        <td>{s.device_type || '—'}</td>
                                        <td><span style={{ background: loginTag.bg, color: loginTag.color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{loginTag.label}</span></td>
                                        <td>{logoutTag ? <span style={{ background: logoutTag.bg, color: logoutTag.color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{logoutTag.label}</span> : '—'}</td>
                                        <td>
                                            {s.logout_status === 'active' && (
                                                <button onClick={() => onForceLogout(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: '#dc2626', padding: 0, fontWeight: 600 }}>
                                                    ⛔ Force Logout
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="admin-btn">← Prev</button>
                    <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--muted)' }}>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn">Next →</button>
                </div>
            )}
        </>
    );
};

// ── Activity History tab ────────────────────────────────────────────────
const ActivityHistoryTab = ({ logs, total, loading, page, setPage,
    search, setSearch, startDate, setStartDate, endDate, setEndDate,
    module, setModule, actionType, setActionType, sessionId, setSessionId, sessionOptions,
    sortKey, sortDir, toggleSort, exportExcel, exportPDF, exporting }) => {
    const limit = 50;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const [detailsLog, setDetailsLog] = useState(null);

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
                <button onClick={exportExcel} disabled={exporting} className="admin-btn">📊 Export Excel</button>
                <button onClick={exportPDF} disabled={exporting} className="admin-btn">📄 Export PDF</button>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="admin-search" style={{ maxWidth: '260px', flex: 1 }}>
                    <input type="search" placeholder="Search description, page..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} style={inputStyle}>
                    <option value="">All Modules</option>
                    {ADMIN_MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    <option value="auth">Auth</option>
                    <option value="profile">Profile</option>
                    <option value="navigation">Navigation</option>
                </select>
                <select value={actionType} onChange={(e) => { setActionType(e.target.value); setPage(1); }} style={inputStyle}>
                    <option value="">All Actions</option>
                    <option value="login">Login</option>
                    <option value="logout">Logout</option>
                    <option value="page_view">Page View</option>
                    <option value="export">Report Download</option>
                    <option value="create">Create</option>
                    <option value="edit">Edit</option>
                    <option value="delete">Delete</option>
                    <option value="password_change">Password Change</option>
                    <option value="profile_update">Profile Update</option>
                    <option value="force_logout">Force Logout</option>
                </select>
                <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setPage(1); }} style={inputStyle}>
                    <option value="">All Sessions</option>
                    {sessionOptions.map(s => <option key={s.id} value={s.id}>Session #{s.id} — {fmtDateTime(s.login_time)}</option>)}
                </select>
                <label style={{ fontSize: 13, fontWeight: 600 }}>From:</label>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} style={inputStyle} />
                <label style={{ fontSize: 13, fontWeight: 600 }}>To:</label>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} style={inputStyle} />
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th onClick={() => toggleSort('created_at')} style={{ cursor: 'pointer' }}>Date &amp; Time {sortKey === 'created_at' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th onClick={() => toggleSort('module')} style={{ cursor: 'pointer' }}>Module {sortKey === 'module' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th>Menu</th>
                            <th>Page</th>
                            <th onClick={() => toggleSort('action_type')} style={{ cursor: 'pointer' }}>Action {sortKey === 'action_type' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                            <th>Description</th>
                            <th>Record Name</th>
                            <th>Record ID</th>
                            <th>IP Address</th>
                            <th>Browser</th>
                            <th>Device</th>
                            <th>Session</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={13} style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={13} style={{ textAlign: 'center', padding: '20px' }}>No activity recorded yet.</td></tr>
                        ) : (
                            logs.map(log => {
                                const tag = actionTag(log.action_type);
                                return (
                                    <tr key={log.id}>
                                        <td>{fmtDateTime(log.created_at)}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{log.module}</td>
                                        <td>{log.menu_name || '—'}</td>
                                        <td>{log.page_name || '—'}</td>
                                        <td><span style={{ background: tag.bg, color: tag.color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{tag.label}</span></td>
                                        <td>{log.description || '—'}</td>
                                        <td>{log.record_name || '—'}</td>
                                        <td>{log.record_id || '—'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{log.ip_address || '—'}</td>
                                        <td>{log.browser || '—'}</td>
                                        <td>{log.device_type || '—'}{log.os ? ` (${log.os})` : ''}</td>
                                        <td>{log.session_id ? `#${log.session_id}` : '—'}</td>
                                        <td>
                                            {log.metadata && (
                                                <button onClick={() => setDetailsLog(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: 'var(--primary)', padding: 0, fontWeight: 600 }}>
                                                    🔍 View
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="admin-btn">← Prev</button>
                    <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--muted)' }}>Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn">Next →</button>
                </div>
            )}

            {detailsLog && <ActivityDetailsModal log={detailsLog} onClose={() => setDetailsLog(null)} />}
        </>
    );
};

// ── Panel entry point — rendered as the "Log History" tab on AdminStaffEdit ──
const StaffLogHistoryPanel = ({ id }) => {
    const [tab, setTab] = useState('login');
    const [staffInfo, setStaffInfo] = useState(null);
    const [actionMsg, setActionMsg] = useState(null);
    const [exporting, setExporting] = useState(false);

    // ── Login History state ──
    const [sessions, setSessions] = useState([]);
    const [loginSummary, setLoginSummary] = useState(null);
    const [loginTotal, setLoginTotal] = useState(0);
    const [loginLoading, setLoginLoading] = useState(true);
    const [loginSearch, setLoginSearch] = useState('');
    const [loginStart, setLoginStart] = useState('');
    const [loginEnd, setLoginEnd] = useState('');
    const [loginSortKey, setLoginSortKey] = useState('login_time');
    const [loginSortDir, setLoginSortDir] = useState('desc');
    const [loginPage, setLoginPage] = useState(1);

    // ── Activity History state ──
    const [logs, setLogs] = useState([]);
    const [activityTotal, setActivityTotal] = useState(0);
    const [activityLoading, setActivityLoading] = useState(true);
    const [actSearch, setActSearch] = useState('');
    const [actStart, setActStart] = useState('');
    const [actEnd, setActEnd] = useState('');
    const [actModule, setActModule] = useState('');
    const [actActionType, setActActionType] = useState('');
    const [actSessionId, setActSessionId] = useState('');
    const [actSortKey, setActSortKey] = useState('created_at');
    const [actSortDir, setActSortDir] = useState('desc');
    const [actPage, setActPage] = useState(1);

    const fetchLoginHistory = useCallback(async () => {
        setLoginLoading(true);
        try {
            const { data } = await axiosAdmin.get(`/admin/staff/${id}/login-history`, {
                params: { search: loginSearch, startDate: loginStart, endDate: loginEnd, sortKey: loginSortKey, sortDir: loginSortDir, page: loginPage, limit: 20 },
            });
            setStaffInfo(data.staff);
            setSessions(data.sessions || []);
            setLoginTotal(data.total || 0);
            setLoginSummary(data.summary || null);
        } catch (error) {
            console.error('Failed to fetch login history:', error);
        } finally {
            setLoginLoading(false);
        }
    }, [id, loginSearch, loginStart, loginEnd, loginSortKey, loginSortDir, loginPage]);

    useEffect(() => { fetchLoginHistory(); }, [fetchLoginHistory]);

    const fetchActivity = useCallback(async () => {
        setActivityLoading(true);
        try {
            const { data } = await axiosAdmin.get('/admin/staff/activity-log', {
                params: {
                    staffId: id, search: actSearch, startDate: actStart, endDate: actEnd,
                    module: actModule, actionType: actActionType, sessionId: actSessionId,
                    sortKey: actSortKey, sortDir: actSortDir, page: actPage, limit: 50,
                },
            });
            setLogs(data.logs || []);
            setActivityTotal(data.total || 0);
        } catch (error) {
            console.error('Failed to fetch activity history:', error);
        } finally {
            setActivityLoading(false);
        }
    }, [id, actSearch, actStart, actEnd, actModule, actActionType, actSessionId, actSortKey, actSortDir, actPage]);

    useEffect(() => { if (tab === 'activity') fetchActivity(); }, [tab, fetchActivity]);

    const toggleLoginSort = (key) => {
        if (loginSortKey === key) setLoginSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setLoginSortKey(key); setLoginSortDir('desc'); }
    };
    const toggleActSort = (key) => {
        if (actSortKey === key) setActSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setActSortKey(key); setActSortDir('desc'); }
    };

    const handleForceLogout = async (session) => {
        if (!window.confirm('End this active session now? The staff member will be signed out immediately.')) return;
        try {
            await axiosAdmin.post(`/admin/staff/${id}/sessions/${session.id}/force-logout`);
            setActionMsg({ type: 'success', text: 'Session ended.' });
            fetchLoginHistory();
        } catch (error) {
            setActionMsg({ type: 'error', text: error.response?.data?.message || 'Failed to end session.' });
        }
    };

    const filterSummaryLines = useMemo(() => {
        const label = tab === 'login' ? 'Login History' : 'Activity History';
        const lines = [`${label} — ${staffInfo?.name || ''} (${staffInfo?.email || ''})`];
        const parts = [];
        const search = tab === 'login' ? loginSearch : actSearch;
        const startDate = tab === 'login' ? loginStart : actStart;
        const endDate = tab === 'login' ? loginEnd : actEnd;
        if (search.trim()) parts.push(`Search: "${search.trim()}"`);
        if (startDate) parts.push(`From: ${startDate}`);
        if (endDate) parts.push(`To: ${endDate}`);
        if (tab === 'activity' && actModule) parts.push(`Module: ${actModule}`);
        if (tab === 'activity' && actActionType) parts.push(`Action: ${actActionType}`);
        parts.push(`Generated: ${new Date().toLocaleString('en-IN')}`);
        lines.push(parts.join('   |   '));
        return lines;
    }, [tab, staffInfo, loginSearch, loginStart, loginEnd, actSearch, actStart, actEnd, actModule, actActionType]);

    const fetchAllLoginFiltered = async () => {
        const { data } = await axiosAdmin.get(`/admin/staff/${id}/login-history`, {
            params: { search: loginSearch, startDate: loginStart, endDate: loginEnd, sortKey: loginSortKey, sortDir: loginSortDir, page: 1, limit: 5000 },
        });
        return data.sessions || [];
    };
    const fetchAllActivityFiltered = async () => {
        const { data } = await axiosAdmin.get('/admin/staff/activity-log', {
            params: {
                staffId: id, search: actSearch, startDate: actStart, endDate: actEnd,
                module: actModule, actionType: actActionType, sessionId: actSessionId,
                sortKey: actSortKey, sortDir: actSortDir, page: 1, limit: 5000,
            },
        });
        return data.logs || [];
    };

    const nameForFile = (staffInfo?.name || 'staff').replace(/[^a-zA-Z0-9]/g, '_');

    const exportLoginExcel = async () => {
        setExporting(true);
        try {
            const rows = await fetchAllLoginFiltered();
            const XLSX = await import('xlsx');
            const headers = ['Login Date', 'Login Time', 'Logout Date', 'Logout Time', 'Session Duration',
                'Check-In Time', 'Check-Out Time', 'Working Hours', 'IP Address', 'Browser', 'Operating System', 'Device Type',
                'Login Status', 'Logout Status'];
            const aoa = [filterSummaryLines, [], headers, ...rows.map(r => [
                fmtDate(r.login_time), fmtTime(r.login_time), fmtDate(r.logout_time), fmtTime(r.logout_time),
                fmtDuration(r.session_duration), fmtTime(r.login_time), fmtTime(r.logout_time), fmtDuration(r.session_duration),
                r.ip_address || '', r.browser || '', r.os || '', r.device_type || '',
                LOGIN_STATUS_TAG[r.login_status]?.label || r.login_status,
                r.logout_status ? (LOGOUT_STATUS_TAG[r.logout_status]?.label || r.logout_status) : '—',
            ])];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            XLSX.utils.book_append_sheet(wb, ws, 'Login History');
            XLSX.writeFile(wb, `${nameForFile}_login_history.xlsx`);
        } catch (error) {
            console.error('Excel export failed:', error);
            setActionMsg({ type: 'error', text: 'Excel export failed.' });
        } finally {
            setExporting(false);
        }
    };

    const captureTableAsFile = async (headCols, bodyRowsHtml, filenameBase, kind) => {
        const html2canvas = (await import('html2canvas')).default;
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;top:-99999px;left:0;width:1900px;background:#ffffff;padding:20px;z-index:-9999;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;';
        const header = document.createElement('div');
        header.style.cssText = 'margin-bottom:14px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;';
        header.innerHTML = filterSummaryLines.map((line, i) => {
            const size = i === 0 ? '16px' : '12.5px';
            const weight = i === 0 ? '700' : '500';
            const color = i === 0 ? '#0f172a' : '#475569';
            return `<div style="font-size:${size};font-weight:${weight};color:${color};margin-bottom:3px;">${line}</div>`;
        }).join('');
        wrapper.appendChild(header);

        const table = document.createElement('table');
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:11px;';
        table.innerHTML = `
            <thead><tr>${headCols.map(h => `<th style="border:1px solid #e2e8f0;padding:6px 8px;background:#f8fafc;text-align:left;white-space:nowrap;">${h}</th>`).join('')}</tr></thead>
            <tbody>${bodyRowsHtml}</tbody>
        `;
        wrapper.appendChild(table);
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: wrapper.scrollWidth, windowHeight: wrapper.scrollHeight });
        document.body.removeChild(wrapper);

        if (kind === 'image') {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `${filenameBase}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        const { jsPDF } = await import('jspdf');
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const pdfWidth = 297;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const pdf = new jsPDF('l', 'mm', [pdfWidth, pdfHeight]);
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${filenameBase}.pdf`);
    };

    const td = (v) => `<td style="border:1px solid #e2e8f0;padding:6px 8px;white-space:nowrap;">${v ?? ''}</td>`;

    const exportLoginPDF = async () => {
        setExporting(true);
        try {
            const rows = await fetchAllLoginFiltered();
            const headCols = ['Login Date', 'Login Time', 'Logout Date', 'Logout Time', 'Duration',
                'Check-In', 'Check-Out', 'Working Hours', 'IP Address', 'Browser', 'OS', 'Device', 'Login Status', 'Logout Status'];
            const bodyRowsHtml = rows.map(r => `<tr>${[
                td(fmtDate(r.login_time)), td(fmtTime(r.login_time)), td(fmtDate(r.logout_time)), td(fmtTime(r.logout_time)),
                td(fmtDuration(r.session_duration)), td(fmtTime(r.login_time)), td(fmtTime(r.logout_time)), td(fmtDuration(r.session_duration)),
                td(r.ip_address), td(r.browser), td(r.os), td(r.device_type),
                td(LOGIN_STATUS_TAG[r.login_status]?.label || r.login_status),
                td(r.logout_status ? (LOGOUT_STATUS_TAG[r.logout_status]?.label || r.logout_status) : '—'),
            ].join('')}</tr>`).join('');
            await captureTableAsFile(headCols, bodyRowsHtml, `${nameForFile}_login_history`, 'pdf');
        } catch (error) {
            console.error('PDF export failed:', error);
            setActionMsg({ type: 'error', text: 'PDF export failed.' });
        } finally {
            setExporting(false);
        }
    };

    const exportActivityExcel = async () => {
        setExporting(true);
        try {
            const rows = await fetchAllActivityFiltered();
            const XLSX = await import('xlsx');
            const headers = ['Date & Time', 'Module', 'Menu', 'Page', 'Action', 'Description', 'Record Name', 'Record ID', 'IP Address', 'Browser', 'OS', 'Device', 'Session ID', 'Details'];
            const aoa = [filterSummaryLines, [], headers, ...rows.map(r => [
                fmtDateTime(r.created_at), r.module, r.menu_name || '', r.page_name || '',
                actionTag(r.action_type).label, r.description || '', r.record_name || '', r.record_id || '',
                r.ip_address || '', r.browser || '', r.os || '', r.device_type || '', r.session_id || '',
                r.metadata ? JSON.stringify(r.metadata) : '',
            ])];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            XLSX.utils.book_append_sheet(wb, ws, 'Activity History');
            XLSX.writeFile(wb, `${nameForFile}_activity_history.xlsx`);
        } catch (error) {
            console.error('Excel export failed:', error);
            setActionMsg({ type: 'error', text: 'Excel export failed.' });
        } finally {
            setExporting(false);
        }
    };

    const exportActivityPDF = async () => {
        setExporting(true);
        try {
            const rows = await fetchAllActivityFiltered();
            const headCols = ['Date & Time', 'Module', 'Menu', 'Page', 'Action', 'Description', 'Record Name', 'Record ID', 'IP Address', 'Browser', 'OS', 'Device', 'Session'];
            const bodyRowsHtml = rows.map(r => `<tr>${[
                td(fmtDateTime(r.created_at)), td(r.module), td(r.menu_name), td(r.page_name),
                td(actionTag(r.action_type).label), td(r.description), td(r.record_name), td(r.record_id),
                td(r.ip_address), td(r.browser), td(r.os), td(r.device_type), td(r.session_id ? `#${r.session_id}` : ''),
            ].join('')}</tr>`).join('');
            await captureTableAsFile(headCols, bodyRowsHtml, `${nameForFile}_activity_history`, 'pdf');
        } catch (error) {
            console.error('PDF export failed:', error);
            setActionMsg({ type: 'error', text: 'PDF export failed.' });
        } finally {
            setExporting(false);
        }
    };

    const sessionOptions = useMemo(() => sessions.map(s => ({ id: s.id, login_time: s.login_time })), [sessions]);

    return (
        <div>
            {actionMsg && (
                <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: actionMsg.type === 'success' ? '#dcfce7' : '#fee2e2', color: actionMsg.type === 'success' ? '#166534' : '#991b1b' }}>
                    {actionMsg.text}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
                {[['login', '🔑 Login History'], ['activity', '📋 Activity History']].map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        style={{
                            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                            fontSize: 14, fontWeight: 700, color: tab === key ? 'var(--primary)' : '#64748b',
                            borderBottom: tab === key ? '3px solid var(--primary)' : '3px solid transparent',
                            marginBottom: -2,
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'login' ? (
                <LoginHistoryTab
                    id={id} staffInfo={staffInfo} sessions={sessions} summary={loginSummary} total={loginTotal}
                    loading={loginLoading} page={loginPage} setPage={setLoginPage}
                    search={loginSearch} setSearch={setLoginSearch}
                    startDate={loginStart} setStartDate={setLoginStart}
                    endDate={loginEnd} setEndDate={setLoginEnd}
                    sortKey={loginSortKey} sortDir={loginSortDir} toggleSort={toggleLoginSort}
                    onForceLogout={handleForceLogout}
                    exportExcel={exportLoginExcel} exportPDF={exportLoginPDF} exporting={exporting}
                />
            ) : (
                <ActivityHistoryTab
                    logs={logs} total={activityTotal} loading={activityLoading} page={actPage} setPage={setActPage}
                    search={actSearch} setSearch={setActSearch}
                    startDate={actStart} setStartDate={setActStart}
                    endDate={actEnd} setEndDate={setActEnd}
                    module={actModule} setModule={setActModule}
                    actionType={actActionType} setActionType={setActActionType}
                    sessionId={actSessionId} setSessionId={setActSessionId} sessionOptions={sessionOptions}
                    sortKey={actSortKey} sortDir={actSortDir} toggleSort={toggleActSort}
                    exportExcel={exportActivityExcel} exportPDF={exportActivityPDF} exporting={exporting}
                />
            )}
        </div>
    );
};

export default StaffLogHistoryPanel;
