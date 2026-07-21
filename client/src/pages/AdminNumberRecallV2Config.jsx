import React, { useState, useEffect } from 'react';
import axiosAdmin from '../services/axiosAdmin';
import { API_URL } from '../services/api';
import './AdminAnkganitV2Config.css'; // Reuse some basic styles if applicable, or inline

const AdminNumberRecallV2Config = () => {
    const [questions, setQuestions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [editQData, setEditQData] = useState({});

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await axiosAdmin.get('/admin/number-recall-v2/questions');
            if (res.data.success) {
                setQuestions(res.data.questions);
            }
        } catch (error) {
            console.error('Failed to fetch config', error);
            alert('Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const startEditQuestion = (q) => {
        setEditingQuestion(q.id);
        setEditQData({
            correct_sequence: q.correct_sequence,
            max_select: q.max_select,
            audio_file: q.audio_file || '',
            teaching_audio: q.teaching_audio || ''
        });
    };

    const handleFileUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;
        setSaving(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await axiosAdmin.post('/admin/elements/upload', formData);
            if (res.data.success) {
                setEditQData(prev => ({ ...prev, [field]: res.data.file_path }));
            } else {
                alert('Upload failed: ' + res.data.message);
            }
        } catch (error) {
            console.error('Upload error', error);
            alert('Upload failed');
        } finally {
            setSaving(false);
        }
    };

    const saveQuestion = async (id) => {
        setSaving(true);
        try {
            const dataToSave = {
                correct_sequence: editQData.correct_sequence,
                max_select: parseInt(editQData.max_select),
                audio_file: editQData.audio_file,
                teaching_audio: editQData.teaching_audio
            };
            await axiosAdmin.put(`/admin/number-recall-v2/questions/${id}`, dataToSave);
            setEditingQuestion(null);
            await fetchConfig();
        } catch (error) {
            console.error('Failed to update question', error);
            alert('Failed to update question');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="admin-loading"><span className="spin">🔄</span> Loading configuration...</div>;

    return (
        <div className="ankganit-v2-nested">
            <header className="elements-section-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h3 style={{margin: 0}}>Number Recall V2 Configuration</h3>
                <button onClick={fetchConfig} className="admin-btn-secondary" style={{padding: '6px 12px', fontSize: '0.9rem'}}>
                    🔄 Refresh
                </button>
            </header>

            <div className="ankganit-config-container">
                <div className="admin-card mb-4">
                    <div className="admin-card-header">
                        <h3 style={{ margin: 0 }}>Questions Sequence</h3>
                    </div>
                    <div className="admin-card-body p-0" style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>QID</th>
                                    <th>Type</th>
                                    <th>Correct Sequence</th>
                                    <th>Max Select</th>
                                    <th>Audio File</th>
                                    <th>Teaching Audio</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {questions && questions.map((q) => (
                                    <tr key={q.id}>
                                        <td>{q.qid}</td>
                                        <td>{q.is_teaching ? 'Teaching/Practice' : 'Scored Question'}</td>
                                        {editingQuestion === q.id ? (
                                            <>
                                                <td><input type="text" value={editQData.correct_sequence} onChange={e=>setEditQData({...editQData, correct_sequence: e.target.value})} className="admin-input" style={{ minWidth: '150px' }} /></td>
                                                <td><input type="number" value={editQData.max_select} onChange={e=>setEditQData({...editQData, max_select: e.target.value})} className="admin-input" style={{ width: '80px' }} /></td>
                                                <td>
                                                    <input type="text" value={editQData.audio_file} onChange={e=>setEditQData({...editQData, audio_file: e.target.value})} className="admin-input" placeholder="Audio Path" style={{ width: '120px' }} />
                                                    <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, 'audio_file')} style={{display: 'block', fontSize: '10px', marginTop: '5px'}} />
                                                </td>
                                                <td>
                                                    {q.is_teaching && (
                                                        <>
                                                            <input type="text" value={editQData.teaching_audio} onChange={e=>setEditQData({...editQData, teaching_audio: e.target.value})} className="admin-input" placeholder="Teaching Audio" style={{ width: '120px' }} />
                                                            <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, 'teaching_audio')} style={{display: 'block', fontSize: '10px', marginTop: '5px'}} />
                                                        </>
                                                    )}
                                                </td>
                                                <td>
                                                    <button onClick={() => saveQuestion(q.id)} className="admin-btn-icon" style={{color: 'green'}} disabled={saving}>✔️</button>
                                                    <button onClick={() => setEditingQuestion(null)} className="admin-btn-icon" style={{color: 'red'}}>❌</button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>{q.correct_sequence}</td>
                                                <td>{q.max_select}</td>
                                                <td style={{fontSize: '12px', wordBreak: 'break-all'}}>{q.audio_file}</td>
                                                <td style={{fontSize: '12px', wordBreak: 'break-all'}}>{q.is_teaching ? q.teaching_audio : '-'}</td>
                                                <td>
                                                    <button onClick={() => startEditQuestion(q)} className="admin-btn-icon">✏️</button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminNumberRecallV2Config;
