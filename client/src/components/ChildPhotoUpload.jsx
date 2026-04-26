import React, { useRef, useState } from 'react';
import { getChildPhotoOrDefault } from '../services/photoUtils';

/**
 * Reusable photo upload widget.
 *
 * Props:
 *  - currentPhoto  {string|null}  Filename stored in DB (used to show existing photo)
 *  - onChange      {Function}     Called with the selected File object (or null)
 *  - label         {string}       Optional label text
 */
const ChildPhotoUpload = ({ currentPhoto = null, onChange, label = 'Child Photo' }) => {
    const inputRef               = useRef();
    const [preview, setPreview]  = useState(null);  // local blob URL for new selection
    const [error, setError]      = useState('');

    const displaySrc = preview ?? getChildPhotoOrDefault(currentPhoto);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        setError('');

        if (!file) {
            setPreview(null);
            onChange?.(null);
            return;
        }

        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) {
            setError('Only JPG, PNG, or WebP images are allowed.');
            e.target.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setError('Image must be smaller than 2 MB.');
            e.target.value = '';
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);
        onChange?.(file);
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        setPreview(null);
        onChange?.(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>
                {label} <span style={{ fontWeight: '400', color: '#9ca3af' }}>(optional · max 2 MB · JPG/PNG/WebP)</span>
            </label>

            <div
                onClick={() => inputRef.current?.click()}
                style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    cursor: 'pointer',
                    border: '2px dashed #d1d5db',
                    borderRadius: '14px',
                    padding: '14px 18px',
                    background: '#f9fafb',
                    transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#f0f4ff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#f9fafb'; }}
            >
                {/* Avatar preview */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                        src={displaySrc}
                        alt="Child photo"
                        style={{
                            width: '68px', height: '68px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '3px solid #e0e7ff',
                            background: '#e0e7ff',
                        }}
                    />
                    {(preview || currentPhoto) && (
                        <button
                            type="button"
                            onClick={handleRemove}
                            title="Remove photo"
                            style={{
                                position: 'absolute', top: '-4px', right: '-4px',
                                width: '20px', height: '20px',
                                borderRadius: '50%',
                                background: '#ef4444', color: '#fff',
                                border: 'none', cursor: 'pointer',
                                fontSize: '10px', fontWeight: '800',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                lineHeight: 1,
                            }}
                        >✕</button>
                    )}
                </div>

                {/* Text */}
                <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                        {preview ? 'Photo selected — click to change' : currentPhoto ? 'Current photo — click to replace' : 'Click to upload photo'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                        JPG, PNG or WebP · Max 2 MB
                    </div>
                </div>
            </div>

            {error && (
                <div style={{ fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚠ {error}
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
        </div>
    );
};

export default ChildPhotoUpload;
