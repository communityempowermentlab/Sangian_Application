import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';

const PendingAssessmentModal = ({ session, childName, onClose, onComplete }) => {
    const [assessment, setAssessment] = useState({
        q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const behaviorsOptions = [
        'Difficulty sustaining attention',
        'Impulsive or random responding',
        'Negative reaction to correction',
        'Hesitation in responding',
        'High focus or persistence',
        'Verbalisation of a memory strategy',
        'Needed frequent reassurance',
        'Calm and engaged throughout'
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!assessment.q1 || !assessment.q2 || !assessment.q3 || !assessment.q4) {
            alert('Please answer all evaluation questions.');
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.post(`${API_URL}/games/assessments`, {
                session_id: session.id,
                child_id: session.child_id,
                q1_enjoyment: assessment.q1,
                q2_feeling: assessment.q2,
                q3_tiredness: assessment.q3,
                q4_play_again: assessment.q4,
                q5_behaviors: assessment.behaviors,
                additional_notes: assessment.notes
            });
            alert('Assessment submitted successfully.');
            onComplete();
        } catch (error) {
            console.error('Assessment submission error:', error);
            alert('Failed to submit assessment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleBehavior = (bhv) => {
        if (assessment.behaviors.includes(bhv)) {
            setAssessment({ ...assessment, behaviors: assessment.behaviors.filter(b => b !== bhv) });
        } else {
            setAssessment({ ...assessment, behaviors: [...assessment.behaviors, bhv] });
        }
    };

    return (
        <div className="rs-modal-overlay" style={{ zIndex: 2000 }}>
            <div className="rs-modal" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ margin: 0, color: '#111827', fontSize: '1.5rem' }}>Session Summary & Assessment</h2>
                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
                                Child: <strong>{childName}</strong> | Game: <strong>{session.game_name.replace(/_/g, ' ').toUpperCase()}</strong>
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                                STATUS: {session.status.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '20px' }}>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Score</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{session.score}</div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Attempted</div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{session.progress_level} / {session.total_questions}</div>
                        </div>
                        <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '12px', border: '1px solid #fecaca', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#ef4444', textTransform: 'uppercase', fontWeight: '600' }}>Reason for Stop</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#dc2626', marginTop: '4px' }}>{session.quit_reason || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="rs-assessment-section" style={{ border: 'none', paddingTop: 0 }}>
                        {[
                            { key: 'q1', label: "Q1. Did the child enjoy playing the game?" },
                            { key: 'q2', label: "Q2. How did the game feel for the child?" },
                            { key: 'q3', label: "Q3. Did the child feel tired while playing?" },
                            { key: 'q4', label: "Q4. Would the child like to play again?" }
                        ].map((q) => (
                            <div key={q.key} className="rs-q-group">
                                <label className="rs-q-label">{q.label}</label>
                                <div className="rs-radio-row">
                                    {['Yes, a lot', 'A little', 'Not much'].map(opt => (
                                        <label key={opt} className="rs-radio-label">
                                            <input 
                                                type="radio" 
                                                name={q.key} 
                                                checked={assessment[q.key] === opt} 
                                                onChange={() => setAssessment({ ...assessment, [q.key]: opt })} 
                                            />
                                            {opt}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <div className="rs-q-group">
                            <label className="rs-q-label">Q5. Observed Behaviours (Multiple selection allowed)</label>
                            <div className="rs-checkbox-grid">
                                {behaviorsOptions.map(bhv => (
                                    <label key={bhv} className="rs-checkbox-label">
                                        <input 
                                            type="checkbox" 
                                            checked={assessment.behaviors.includes(bhv)} 
                                            onChange={() => toggleBehavior(bhv)} 
                                        />
                                        {bhv}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="rs-q-group">
                            <label className="rs-q-label">Additional Observations/Notes</label>
                            <textarea 
                                className="rs-textarea" 
                                rows="3" 
                                placeholder="Any specific observations during the session..." 
                                value={assessment.notes} 
                                onChange={(e) => setAssessment({ ...assessment, notes: e.target.value })}
                            ></textarea>
                        </div>
                    </div>

                    <div className="rs-modal-footer" style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" className="rs-btn rs-btn-secondary" onClick={onClose} disabled={isSubmitting}>Skip for now</button>
                        <button type="submit" className="rs-btn rs-btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Submit & Close Session'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PendingAssessmentModal;
