import React, { useState, useEffect } from 'react';
import axiosAdmin from '../services/axiosAdmin';

const AdminLanguageSettingsTab = () => {
    const [languages, setLanguages] = useState([]);
    const [defaultLanguage, setDefaultLanguage] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await axiosAdmin.get('/admin/translations/languages');
            setLanguages(res.data.languages);
            setDefaultLanguage(res.data.defaultLanguage);
        } catch (error) {
            console.error('Failed to load language settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggleEnabled = (code) => {
        setLanguages((prev) => prev.map((l) => (l.code === code ? { ...l, enabled: !l.enabled } : l)));
    };

    const save = async () => {
        setSaving(true);
        setMessage('');
        try {
            await axiosAdmin.put('/admin/translations/languages', { defaultLanguage, languages });
            setMessage('✓ Saved');
        } catch (error) {
            setMessage(error.response?.data?.message || 'Failed to save.');
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(''), 2500);
        }
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>;
    }

    return (
        <div style={{ padding: '24px 28px', maxWidth: '640px' }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px' }}>
                Enable or disable languages for the mobile app's language selector, and choose the default
                language shown to new users. Disabled languages are hidden from the app but their content
                is preserved in the Multilingual editor.
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '20px' }}>
                <thead>
                    <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Language</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700 }}>Enabled</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700 }}>Default</th>
                    </tr>
                </thead>
                <tbody>
                    {languages.map((lang) => (
                        <tr key={lang.code} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{lang.label}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input type="checkbox" checked={lang.enabled} onChange={() => toggleEnabled(lang.code)} />
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input
                                    type="radio"
                                    name="defaultLanguage"
                                    checked={defaultLanguage === lang.code}
                                    disabled={!lang.enabled}
                                    onChange={() => setDefaultLanguage(lang.code)}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                    onClick={save}
                    disabled={saving}
                    style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                    {saving ? '⏳ Saving…' : '💾 Save Settings'}
                </button>
                {message && <span style={{ fontSize: '0.82rem', color: message.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{message}</span>}
            </div>
        </div>
    );
};

export default AdminLanguageSettingsTab;
