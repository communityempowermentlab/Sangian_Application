import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import './AdminAnkganitV3Config.css';

const AdminAnkganitV3Config = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [editingCategory, setEditingCategory] = useState(null);
    const [editCatData, setEditCatData] = useState({});
    
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [editQData, setEditQData] = useState({});

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await axios.get(`${API_URL}/admin/ankganit-v3`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setConfig(res.data.categories);
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

    const startEditCategory = (cat) => {
        setEditingCategory(cat.id);
        setEditCatData({
            name: cat.name,
            minimum_correct: cat.minimum_correct,
            evaluation_type: cat.evaluation_type,
            is_active: cat.is_active ? 1 : 0
        });
    };

    const saveCategory = async (id) => {
        setSaving(true);
        try {
            const token = localStorage.getItem('adminToken');
            await axios.put(`${API_URL}/admin/ankganit-v3/categories/${id}`, editCatData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingCategory(null);
            await fetchConfig();
        } catch (error) {
            console.error('Failed to update category', error);
            alert('Failed to update category');
        } finally {
            setSaving(false);
        }
    };

    const startEditQuestion = (q) => {
        setEditingQuestion(q.id);
        setEditQData({
            text: q.text,
            title: q.title || '',
            correct_answer: q.correct_answer,
            remainder: q.remainder || ''
        });
    };

    const saveQuestion = async (id) => {
        setSaving(true);
        try {
            const token = localStorage.getItem('adminToken');
            const dataToSave = {
                ...editQData,
                remainder: editQData.remainder === '' ? null : parseInt(editQData.remainder)
            };
            await axios.put(`${API_URL}/admin/ankganit-v3/questions/${id}`, dataToSave, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
        <div className="ankganit-v3-nested">
            <header className="elements-section-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h3 style={{margin: 0}}>Test Logic Configuration</h3>
                <button onClick={fetchConfig} className="admin-btn-secondary" style={{padding: '6px 12px', fontSize: '0.9rem'}}>
                    🔄 Refresh
                </button>
            </header>

            <div className="ankganit-config-container">
                {config && config.map((cat, idx) => (
                    <div key={cat.id} className="admin-card mb-4">
                        <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {editingCategory === cat.id ? (
                                <div className="edit-cat-form" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
                                    <input 
                                        type="text" 
                                        value={editCatData.name} 
                                        onChange={e => setEditCatData({...editCatData, name: e.target.value})} 
                                        className="admin-input" 
                                        style={{ flex: '1 1 200px', minWidth: '150px' }}
                                    />
                                    <label style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>Min Correct: 
                                        <input 
                                            type="number" 
                                            value={editCatData.minimum_correct} 
                                            onChange={e => setEditCatData({...editCatData, minimum_correct: parseInt(e.target.value)})} 
                                            className="admin-input" style={{ width: '60px', marginLeft: '5px' }} 
                                        />
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>Eval Type:
                                        <select 
                                            value={editCatData.evaluation_type}
                                            onChange={e => setEditCatData({...editCatData, evaluation_type: e.target.value})}
                                            className="admin-select" style={{ marginLeft: '5px', maxWidth: '150px' }}
                                        >
                                            <option value="manual">Manual</option>
                                            <option value="auto_subtraction">Subtraction</option>
                                            <option value="auto_division">Division</option>
                                        </select>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>Active:
                                        <input 
                                            type="checkbox" 
                                            checked={editCatData.is_active === 1}
                                            onChange={e => setEditCatData({...editCatData, is_active: e.target.checked ? 1 : 0})}
                                            style={{ marginLeft: '5px' }}
                                        />
                                    </label>
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <button onClick={() => saveCategory(cat.id)} className="admin-btn-icon" style={{color: 'green', fontSize: '1.2rem'}} disabled={saving}>✔️</button>
                                        <button onClick={() => setEditingCategory(null)} className="admin-btn-icon" style={{color: 'red', fontSize: '1.2rem'}}>❌</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h3 style={{ margin: 0 }}>Category {idx + 1}: {cat.name} {!cat.is_active && <span style={{color: 'red'}}>(Inactive)</span>}</h3>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        <span className="badge badge-blue">Min Correct: {cat.minimum_correct}</span>
                                        <span className="badge badge-gray">Eval: {cat.evaluation_type}</span>
                                        <button onClick={() => startEditCategory(cat)} className="admin-btn-icon">✏️</button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="admin-card-body p-0" style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Question Text</th>
                                        <th>Answer Title (Optional)</th>
                                        <th>Correct Answer</th>
                                        {cat.evaluation_type === 'auto_division' && <th>Remainder</th>}
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cat.questions.map((q, qIdx) => (
                                        <tr key={q.id}>
                                            <td>{q.display_order || qIdx + 1}</td>
                                            {editingQuestion === q.id ? (
                                                <>
                                                    <td><input type="text" value={editQData.text} onChange={e=>setEditQData({...editQData, text: e.target.value})} className="admin-input" style={{ minWidth: '150px' }} /></td>
                                                    <td><input type="text" value={editQData.title} onChange={e=>setEditQData({...editQData, title: e.target.value})} className="admin-input" style={{ minWidth: '100px' }} /></td>
                                                    <td><input type="text" value={editQData.correct_answer} onChange={e=>setEditQData({...editQData, correct_answer: e.target.value})} className="admin-input" style={{ width: '80px' }} /></td>
                                                    {cat.evaluation_type === 'auto_division' && (
                                                        <td><input type="number" value={editQData.remainder} onChange={e=>setEditQData({...editQData, remainder: e.target.value})} className="admin-input" style={{ width: '60px' }} /></td>
                                                    )}
                                                    <td>
                                                        <button onClick={() => saveQuestion(q.id)} className="admin-btn-icon" style={{color: 'green'}} disabled={saving}>✔️</button>
                                                        <button onClick={() => setEditingQuestion(null)} className="admin-btn-icon" style={{color: 'red'}}>❌</button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>{q.text.replace(/Identify number\s*-?\s*/ig, '')}</td>
                                                    <td>{q.title || '-'}</td>
                                                    <td>{q.correct_answer}</td>
                                                    {cat.evaluation_type === 'auto_division' && <td>{q.remainder}</td>}
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
                ))}
            </div>
        </div>
    );
};

export default AdminAnkganitV3Config;
