import React from 'react';

const rowStyle = { display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 };
const keyStyle = { width: 140, flexShrink: 0, fontWeight: 600, color: '#475569', textTransform: 'capitalize' };
const valStyle = { flex: 1, color: '#0f172a', wordBreak: 'break-word' };

const fmtVal = (v) => {
    if (v == null || v === '') return '—';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (typeof v === 'object') {
        const entries = Object.entries(v).filter(([, val]) => val != null && val !== '');
        return entries.length ? entries.map(([k, val]) => `${k}: ${Array.isArray(val) ? val.join('/') : val}`).join(', ') : '—';
    }
    return String(v);
};

// Renders whatever shape a staff_activity_logs.metadata JSON blob happens
// to have for this action type — an edit's { previous, updated } diff, or a
// report download's { reportType, format, filters, dateRange, status }.
// Deliberately generic (no action-type switch) so any future metadata
// shape logStaffActivity callers add just renders as a key/value list.
const ActivityDetailsModal = ({ log, onClose }) => {
    if (!log) return null;
    const meta = log.metadata || {};
    const hasDiff = meta.previous || meta.updated;
    const diffKeys = hasDiff ? [...new Set([...Object.keys(meta.previous || {}), ...Object.keys(meta.updated || {})])] : [];
    const otherKeys = Object.keys(meta).filter(k => k !== 'previous' && k !== 'updated');

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, marginBottom: 4, fontSize: 17 }}>Activity Details</h3>
                <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 13 }}>{log.description}</p>

                {log.record_name && (
                    <div style={rowStyle}><div style={keyStyle}>Record</div><div style={valStyle}>{log.record_name}{log.record_id ? ` (#${log.record_id})` : ''}</div></div>
                )}

                {hasDiff && (
                    <>
                        <div style={{ marginTop: 12, marginBottom: 6, fontWeight: 700, fontSize: 13, color: '#334155' }}>Changed Fields</div>
                        {diffKeys.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No field-level changes recorded.</div>
                        ) : diffKeys.map(k => (
                            <div key={k} style={rowStyle}>
                                <div style={keyStyle}>{k}</div>
                                <div style={valStyle}>
                                    <span style={{ color: '#991b1b', textDecoration: 'line-through' }}>{fmtVal(meta.previous?.[k])}</span>
                                    {' → '}
                                    <span style={{ color: '#166534', fontWeight: 600 }}>{fmtVal(meta.updated?.[k])}</span>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {otherKeys.length > 0 && (
                    <>
                        <div style={{ marginTop: 12, marginBottom: 6, fontWeight: 700, fontSize: 13, color: '#334155' }}>Details</div>
                        {otherKeys.map(k => (
                            <div key={k} style={rowStyle}>
                                <div style={keyStyle}>{k}</div>
                                <div style={valStyle}>{fmtVal(meta[k])}</div>
                            </div>
                        ))}
                    </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                    <button onClick={onClose} className="admin-btn">Close</button>
                </div>
            </div>
        </div>
    );
};

export default ActivityDetailsModal;
