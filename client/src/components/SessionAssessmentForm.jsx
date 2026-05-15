import React, { useState } from 'react';

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
  const [validationErrors, setValidationErrors] = useState({});

  const handleValidationAndSubmit = () => {
    const errors = {};
    if (!assessment.q1) errors.q1 = true;
    if (!assessment.q2) errors.q2 = true;
    if (!assessment.q3) errors.q3 = true;
    if (!assessment.q4) errors.q4 = true;

    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      submitAssessmentForm();
    } else {
      // Optional: scroll to the first error
    }
  };

  return (
    <div className="shared-assessment-section">
      <h3 className="shared-form-title">{t('game.sessionDetails')}</h3>
      
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
                  name={q.key} 
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
            <div className="shared-error-text">This field is required. Please select an option.</div>
          )}
        </div>
      ))}

      <div className="shared-form-group">
        <label className="shared-form-label">{t('game.q5Label')}</label>
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
                  if(e.target.checked) setAssessment({...assessment, behaviors:[...assessment.behaviors, bhv.val]});
                  else setAssessment({...assessment, behaviors: assessment.behaviors.filter(b=>b!==bhv.val)});
               }} />
               {bhv.str}
             </label>
          ))}
        </div>
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
    </div>
  );
};

export default SessionAssessmentForm;
