import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';
import './AdminElements.css';
import HerPherElements from '../components/HerPherElements';
import AdminElementPositionManager from './AdminElementPositionManager';
import AdminAnkganitV2Config from './AdminAnkganitV2Config';
import AdminNumberRecallV2Config from './AdminNumberRecallV2Config';

const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'mr', name: 'Marathi' },
    { code: 'te', name: 'Telugu' },
    { code: 'kn', name: 'Kannada' }
];

export default function AdminElements() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tests, setTests] = useState([]);
    
    // Compute activeTest directly from URL or fallback
    const activeTest = searchParams.get('test') || (tests.length > 0 ? tests[0].key : null);
    
    const setActiveTest = (key) => {
        setSearchParams({ test: key });
    };

    const [elements, setElements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(null);
    const [toast, setToast] = useState(null);

    const fileRefs = useRef({});

    useEffect(() => {
        loadTests();
    }, []);

    useEffect(() => {
        if (activeTest) {
            loadElements(activeTest);
        }
    }, [activeTest]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const loadTests = async () => {
        try {
            const res = await axiosAdmin.get('/admin/test-config');
            const testArray = res.data.tests || [];
            setTests(testArray);
            
            // If no test is in URL and we have tests, default to first one
            if (testArray.length > 0 && !searchParams.get('test')) {
                setSearchParams({ test: testArray[0].key }, { replace: true });
            }
        } catch (error) {
            console.error('Failed to load tests:', error);
            showToast('Failed to load tests', 'error');
        }
    };

    const loadElements = async (testId) => {
        setLoading(true);
        try {
            const url = (testId === 'working_memory_herpher' || testId === 'working_memory_herpher_v2') 
                ? `/admin/elements?test_id=${testId}` 
                : `/admin/elements?test_id=${testId}&asset_type=splash_screen`;
            const res = await axiosAdmin.get(url);
            if (res.data.success) {
                setElements(res.data.elements || []);
            }
        } catch (error) {
            console.error('Failed to load elements:', error);
            showToast('Failed to load elements', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (langCode, file) => {
        if (!file) return;

        setUploading(langCode);
        const formData = new FormData();
        formData.append('test_id', activeTest);
        formData.append('asset_type', 'splash_screen');
        formData.append('language', langCode);
        formData.append('file', file);

        try {
            const res = await axiosAdmin.post('/admin/elements/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                showToast('Image uploaded successfully');
                loadElements(activeTest);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            showToast('Failed to upload image', 'error');
        } finally {
            setUploading(null);
            if (fileRefs.current[langCode]) {
                fileRefs.current[langCode].value = ''; // Reset input
            }
        }
    };



    const getElementForLang = (langCode) => {
        return elements.find(el => el.language === langCode);
    };

    const SERVER_BASE = API_URL.replace(/\/api$/, '');

    const getImageUrl = (element) => {
        if (element.file_path.startsWith('/assets')) {
            return element.file_path; // static asset served by frontend
        }
        return `${SERVER_BASE}${element.file_path}`; // uploaded asset served by backend
    };

    return (
        <div className="elements-container">
            <div className="elements-sidebar">
                <h3>Tests</h3>
                <ul className="elements-test-list">
                    {tests.map(test => (
                        <li 
                            key={test.key} 
                            className={`elements-test-item ${activeTest === test.key ? 'active' : ''}`}
                            onClick={() => setActiveTest(test.key)}
                        >
                            {test.title}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="elements-content">
                <h2>Elements for {tests.find(t => t.key === activeTest)?.title || activeTest}</h2>
                
                <div className="elements-section">
                    <h3>Splash Screen Images</h3>
                    <p className="elements-desc">Upload a splash screen image for each language. These will be displayed on the home cards.</p>

                    {loading ? (
                        <p>Loading...</p>
                    ) : (
                        <div className="elements-grid">
                        {LANGUAGES.map(lang => {
                            const element = getElementForLang(lang.code);
                            return (
                                <div key={lang.code} className="element-card">
                                    <div className="element-card-header">
                                        <strong>{lang.name}</strong> ({lang.code})
                                    </div>
                                    <div className="element-preview">
                                        {element ? (
                                            <img src={getImageUrl(element)} alt={`${activeTest} ${lang.name}`} />
                                        ) : (
                                            <div className="element-preview-empty">No Image</div>
                                        )}
                                    </div>
                                    <div className="element-actions">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            style={{ display: 'none' }}
                                            ref={el => fileRefs.current[lang.code] = el}
                                            onChange={(e) => handleFileSelect(lang.code, e.target.files[0])}
                                        />
                                        <button 
                                            className="admin-btn admin-btn-primary" 
                                            onClick={() => fileRefs.current[lang.code]?.click()}
                                            disabled={uploading === lang.code}
                                        >
                                            {uploading === lang.code ? 'Uploading...' : (element ? 'Replace' : 'Upload')}
                                        </button>
                                    </div>
                                    {element && (
                                        <div className="element-meta">
                                            Last updated: {new Date(element.updated_at).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                </div>

                {(activeTest === 'working_memory_herpher' || activeTest === 'working_memory_herpher_v2') && (
                    <>
                        <HerPherElements
                            elements={elements}
                            loadElements={loadElements}
                            showToast={showToast}
                        />
                        <div className="elements-section">
                            <h3>Screen-wise Element Positioning</h3>
                            <p className="elements-desc">
                                Drag and drop to fine-tune where elements appear on each response screen,
                                without a code deployment.
                            </p>
                            <AdminElementPositionManager 
                                gameKey={activeTest}
                                screenNums={activeTest === 'working_memory_herpher_v2' ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8, 9]}
                                screenCounts={activeTest === 'working_memory_herpher_v2' ? { 0: 10, 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 10, 8: 10 } : { 1: 6, 2: 7, 3: 8, 4: 9, 5: 10, 6: 11, 7: 12, 8: 13, 9: 13 }}
                                aspectW={1024}
                                aspectH={620}
                            />
                        </div>
                    </>
                )}

                {activeTest === 'atlantis_bagiya' && (
                    <div className="elements-section">
                        <h3>Element Position Manager</h3>
                        <p className="elements-desc">
                            Drag and drop to fine-tune where elements appear on each response screen,
                            without a code deployment.
                        </p>
                        <AdminElementPositionManager 
                            gameKey="atlantis_bagiya"
                            screenNums={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]}
                            screenCounts={{ 1: 7, 2: 7, 3: 7, 4: 8, 5: 9, 6: 9, 7: 10, 8: 9, 9: 12, 10: 11, 11: 11, 12: 12, 13: 13 }}
                            fixedScreenNames={{
                                1: ['BA', 'Bird 2', 'DEEM', 'Bird 4', 'Bird 5', 'THOOLI', 'PEGETO'],
                                2: ['BA', 'Bird 2', 'Bird 4', 'Bird 5', 'JUL', 'BAIGUL', 'SHIBAGU'],
                                3: ['BA', 'Bird 2', 'DEEM', 'Bird 4', 'JUL', 'BAIGUL', 'MULPAKI'],
                            }}
                            aspectW={1180}
                            aspectH={650}
                        />
                    </div>
                )}

                {activeTest === 'numeracy_number_skill_v2' && (
                    <div className="elements-section">
                        <AdminAnkganitV2Config />
                    </div>
                )}

                {activeTest === 'number_recall_lottery_v2' && (
                    <div className="elements-section">
                        <AdminNumberRecallV2Config />
                    </div>
                )}
            </div>

            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
