import React, { useState, useRef } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';

const CATEGORIES = [
    { id: 'item0', label: 'Item 0', min: 6 },
    { id: 'item1', label: 'Item 1', min: 7 },
    { id: 'item2', label: 'Item 2', min: 8 },
    { id: 'item3', label: 'Item 3', min: 9 },
    { id: 'item4', label: 'Item 4', min: 10 },
    { id: 'item5', label: 'Item 5', min: 11 },
    { id: 'item6', label: 'Item 6', min: 12 },
    { id: 'item7', label: 'Item 7', min: 13 },
    { id: 'item8', label: 'Item 8', min: 14 }
];

export default function HerPherElements({ elements, loadElements, showToast }) {
    const [uploading, setUploading] = useState(null);
    const fileRefs = useRef({});

    const SERVER_BASE = API_URL.replace(/\/api$/, '');

    const getImageUrl = (element) => {
        if (element.file_path.startsWith('/assets')) {
            return element.file_path;
        }
        return `${SERVER_BASE}${element.file_path}`;
    };

    // Resize image via HTML5 Canvas
    const resizeImage = (file, maxWidth, maxHeight) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = maxWidth;
                canvas.height = maxHeight;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; // White background just in case
                ctx.fillRect(0, 0, maxWidth, maxHeight);
                
                // Draw image scaled to fit and centered, but the spec says EXACTLY 300x300.
                // We'll just draw it stretched to 300x300, or cover it.
                // Cover behavior:
                const scale = Math.max(maxWidth / img.width, maxHeight / img.height);
                const x = (maxWidth / 2) - (img.width / 2) * scale;
                const y = (maxHeight / 2) - (img.height / 2) * scale;
                
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                canvas.toBlob((blob) => {
                    const resizedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                    resolve(resizedFile);
                }, 'image/jpeg', 0.95);
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const handleFileSelect = async (category, file, replaceId = null) => {
        if (!file) return;

        setUploading(replaceId ? `replace_${replaceId}` : `upload_${category}`);

        try {
            // Resize image to 300x300
            const resizedFile = await resizeImage(file, 300, 300);

            const formData = new FormData();
            formData.append('file', resizedFile);
            formData.append('test_id', 'working_memory_herpher');
            formData.append('asset_type', category);
            formData.append('language', 'all'); // Her Pher images are language independent
            
            if (replaceId) {
                formData.append('replace_id', replaceId);
            }

            const res = await axiosAdmin.post('/admin/elements/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                showToast(replaceId ? 'Image replaced successfully' : 'Image uploaded successfully');
                loadElements('working_memory_herpher');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            showToast('Failed to upload image', 'error');
        } finally {
            setUploading(null);
            if (fileRefs.current[category]) fileRefs.current[category].value = '';
            if (replaceId && fileRefs.current[`replace_${replaceId}`]) fileRefs.current[`replace_${replaceId}`].value = '';
        }
    };

    const handleToggleStatus = async (id) => {
        try {
            const res = await axiosAdmin.put(`/admin/elements/${id}/status`);
            if (res.data.success) {
                showToast('Status updated successfully');
                loadElements('working_memory_herpher');
            }
        } catch (error) {
            console.error('Toggle failed:', error);
            showToast('Failed to update status', 'error');
        }
    };

    return (
        <div className="elements-section">
            <h3>Her Pher Game Items</h3>
            <p className="elements-desc">Manage images used for the Her Pher memory game. Images will be automatically resized to 300x300.</p>
            
            {CATEGORIES.map(category => {
                // Get all elements for this category
                const categoryElements = elements.filter(el => el.asset_type === category.id);
                
                return (
                    <div key={category.id} className="hp-category-block" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h4 style={{ margin: 0 }}>{category.label}</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontSize: '0.85rem', color: categoryElements.length < category.min ? '#ef4444' : '#10b981' }}>
                                    {categoryElements.length} / Min {category.min} required
                                </span>
                                <div>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        style={{ display: 'none' }}
                                        ref={el => fileRefs.current[category.id] = el}
                                        onChange={(e) => handleFileSelect(category.id, e.target.files[0])}
                                    />
                                    <button 
                                        className="admin-btn admin-btn-primary" 
                                        onClick={() => fileRefs.current[category.id]?.click()}
                                        disabled={uploading === `upload_${category.id}`}
                                    >
                                        {uploading === `upload_${category.id}` ? 'Uploading...' : 'Add Image'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="elements-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                            {categoryElements.map(el => (
                                <div key={el.id} className="element-card" style={{ padding: '0.5rem', opacity: el.is_active ? 1 : 0.5 }}>
                                    <div className="element-preview" style={{ height: '120px', marginBottom: '0.5rem' }}>
                                        <img 
                                            src={getImageUrl(el)} 
                                            alt={el.file_name} 
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    </div>
                                    <div className="element-meta" style={{ fontSize: '0.75rem', marginBottom: '0.5rem', wordBreak: 'break-all', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{el.file_name}</span>
                                        <span style={{ color: el.is_active ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                                            {el.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="element-actions" style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            style={{ display: 'none' }}
                                            ref={input => fileRefs.current[`replace_${el.id}`] = input}
                                            onChange={(e) => handleFileSelect(category.id, e.target.files[0], el.id)}
                                        />
                                        <button 
                                            className="admin-btn admin-btn-secondary" 
                                            style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem' }}
                                            onClick={() => fileRefs.current[`replace_${el.id}`]?.click()}
                                            disabled={uploading === `replace_${el.id}`}
                                        >
                                            Replace
                                        </button>
                                        <button 
                                            className={`admin-btn ${el.is_active ? 'admin-btn-danger' : 'admin-btn-primary'}`} 
                                            style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem' }}
                                            onClick={() => handleToggleStatus(el.id)}
                                        >
                                            {el.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
