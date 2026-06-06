import React, { useState, useId } from 'react';
import ReactDOM from 'react-dom';

const SessionAssessmentForm = ({
  assessment,
  setAssessment,
  assessmentSubmitted,
  isAssessmentSubmitting,
  submitAssessmentForm,
  isRecording,
  recordingTarget,
  toggleRecording,
  t,
  children
}) => {
  const formUid = useId();          // unique per instance — prevents radio name collision in StrictMode
  const [validationErrors, setValidationErrors] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);

  const handleValidationAndSubmit = () => {
    const errors = {};
    if (!assessment.q1) errors.q1 = true;
    if (!assessment.q2) errors.q2 = true;
    if (!assessment.q3) errors.q3 = true;
    if (!assessment.q4) errors.q4 = true;
    if (!assessment.behaviors || assessment.behaviors.length === 0) errors.q5 = true;

    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    submitAssessmentForm();
  };

  return (
    <div className="shared-assessment-section">
      <h3 className="shared-form-title">{t('game.sessionDetails')}</h3>
      <p className="shared-assessor-instruction">📋 {t('game.assessorInstruction')}</p>

      {[
        { key: 'q1', label: t('game.q1Label') },
        { key: 'q2', label: t('game.q2Label') },
        { key: 'q3', label: t('game.q3Label') },
        { key: 'q4', label: t('game.q4Label') }
      ].map((q) => (
        <div key={q.key} className={`shared-form-group ${validationErrors[q.key] ? 'error' : ''}`}>
          <label className="shared-form-label">
            {q.label} <span className="required-star">*</span>
          </label>
          <div className="shared-radio-group">
            {[
              { val: 'Yes, a lot', str: t('game.optYes') },
              { val: 'A little', str: t('game.optLittle') },
              { val: 'Not much', str: t('game.optNotMuch') }
            ].map(opt => (
              <label key={opt.val} className="shared-radio-item">
                <input 
                  type="radio" 
                  name={`${formUid}_${q.key}`}
                  disabled={assessmentSubmitted} 
                  checked={assessment[q.key] === opt.val} 
                  onChange={() => {
                    setAssessment({...assessment, [q.key]: opt.val});
                    if (validationErrors[q.key]) {
                      setValidationErrors({...validationErrors, [q.key]: false});
                    }
                  }} 
                />
                {opt.str}
              </label>
            ))}
          </div>
          {validationErrors[q.key] && (
            <div className="shared-error-text">{t('game.validationRequired')}</div>
          )}
        </div>
      ))}

      <div className={`shared-form-group ${validationErrors.q5 ? 'error' : ''}`}>
        <label className="shared-form-label">
          {t('game.q5Label')} <span className="required-star">*</span>
        </label>
        <div className="shared-checkbox-grid">
          {[
            { val: 'Difficulty sustaining attention', str: t('game.b1') },
            { val: 'Impulsive or random responding', str: t('game.b2') },
            { val: 'Negative reaction to correction', str: t('game.b3') },
            { val: 'Hesitation in responding', str: t('game.b4') },
            { val: 'High focus or persistence', str: t('game.b5') },
            { val: 'Verbalisation of a memory strategy', str: t('game.b6') },
            { val: 'Needed frequent reassurance', str: t('game.b7') },
            { val: 'Calm and engaged throughout', str: t('game.b8') }
          ].map(bhv => (
             <label key={bhv.val} className="shared-checkbox-item">
               <input
                 type="checkbox"
                 disabled={assessmentSubmitted}
                 checked={assessment.behaviors.includes(bhv.val)}
                 onChange={(e) => {
                  const updated = e.target.checked
                    ? [...assessment.behaviors, bhv.val]
                    : assessment.behaviors.filter(b => b !== bhv.val);
                  setAssessment({...assessment, behaviors: updated});
                  if (validationErrors.q5) setValidationErrors({...validationErrors, q5: false});
               }} />
               {bhv.str}
             </label>
          ))}
        </div>
        {validationErrors.q5 && (
          <div className="shared-error-text">{t('game.validationQ5')}</div>
        )}
      </div>
      
      <div className="shared-form-group">
         <label className="shared-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <span>{t('game.extraNotes')}</span>
           <button 
             type="button"
             className={`shared-mic-btn ${isRecording && recordingTarget === 'assessmentNotes' ? 'recording' : ''}`}
             onClick={() => toggleRecording('assessmentNotes')} 
           >
             🎙 {isRecording && recordingTarget === 'assessmentNotes' ? t('game.recordingStop') : t('game.useMic')}
           </button>
         </label>
         <textarea 
           className="shared-textarea" 
           disabled={assessmentSubmitted} 
           placeholder={t('game.dictatePlaceholder')} 
           value={assessment.notes} 
           onChange={(e) => setAssessment({...assessment, notes: e.target.value})}
         ></textarea>
      </div>

      <div className="shared-final-actions">
        {assessmentSubmitted ? (
          children
        ) : (
          <button
            onClick={handleValidationAndSubmit}
            disabled={isAssessmentSubmitting}
            className="shared-submit-btn"
          >
            {isAssessmentSubmitting ? t('game.saving') : t('game.submitAssessment')}
          </button>
        )}
      </div>

      {showConfirm && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', backgroundColor: 'rgba(0,0,0,0.5)'
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            width: '100%', maxWidth: '400px', padding: '24px'
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
              {t('game.submitAssessment')}
            </h2>
            <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '0.95rem' }}>
              {t('game.confirmSubmitMsg')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isAssessmentSubmitting}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: '#fff', color: '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem'
                }}
              >
                {t('game.cancel')}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isAssessmentSubmitting}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  background: '#4f46e5', color: '#fff', fontWeight: '600', cursor: 'pointer',
                  fontSize: '0.9rem', opacity: isAssessmentSubmitting ? 0.6 : 1
                }}
              >
                {isAssessmentSubmitting ? t('game.saving') : t('game.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SessionAssessmentForm;
