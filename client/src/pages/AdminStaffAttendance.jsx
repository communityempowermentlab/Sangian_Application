import React, { useState, useEffect, useCallback } from 'react';
import axiosAdmin from '../services/axiosAdmin';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const fmtDuration = (secs) => {
    const s = Number(secs) || 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const AdminStaffAttendance = () => {
    const [rows, setRows]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate]     = useState('');

    const fetchAttendance = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosAdmin.get('/admin/staff/attendance', { params: { startDate, endDate } });
            setRows(data.attendance || []);
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

    return (
        <main className="admin-content" aria-label="Staff Attendance">
            <div className="admin-card w12">
                <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Staff Attendance</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
                        Derived from login/logout sessions — check-in is the first login of the day, check-out is the last logout,
                        and working hours sum every session's duration that day.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>From:</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <label style={{ fontSize: 13, fontWeight: 600 }}>To:</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Staff Name</th>
                                <th>Check-In</th>
                                <th>Check-Out</th>
                                <th>Working Hours</th>
                                <th>Sessions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Loading...</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No attendance recorded yet.</td></tr>
                            ) : (
                                rows.map((r, i) => (
                                    <tr key={`${r.staff_id}-${r.date}-${i}`}>
                                        <td>{fmtDate(r.date)}</td>
                                        <td style={{ fontWeight: 600 }}>{r.staff_name}</td>
                                        <td>{fmtTime(r.check_in)}</td>
                                        <td>{fmtTime(r.check_out)}</td>
                                        <td>{fmtDuration(r.total_seconds)}</td>
                                        <td>{r.session_count}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
};

export default AdminStaffAttendance;
