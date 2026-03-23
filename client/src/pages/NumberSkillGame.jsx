import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './NumberSkillGame.css';

const CONFIG = {
  MAX_CONSECUTIVE_WRONG: 3,
  MIN_CORRECT: { SINGLE_NUMBER: 4, DOUBLE_NUMBER: 4, SUBTRACTION: 2, DIVISION: 1 },
  QUESTION_COUNT: { SINGLE_NUMBER: 10, DOUBLE_NUMBER: 10, SUBTRACTION: 4, DIVISION: 2 },
  CATEGORY: { SINGLE_NUMBER: 10, DOUBLE_NUMBER: 11, SUBTRACTION: 12, DIVISION: 13 }
};

const QUESTIONS = [
  // CAT 1
  { qid: 1, questionCategory: 10, title: "3,2", text: "What is 3 + 2?", correctAnswer: 5, type: "manual" },
  { qid: 2, questionCategory: 10, title: "5,1", text: "What is 5 - 1?", correctAnswer: 4, type: "manual" },
  { qid: 3, questionCategory: 10, title: "7,3", text: "What is 7 + 3?", correctAnswer: 10, type: "manual" },
  { qid: 4, questionCategory: 10, title: "2,4", text: "What is 2 + 4?", correctAnswer: 6, type: "manual" },
  { qid: 5, questionCategory: 10, title: "9,2", text: "What is 9 - 2?", correctAnswer: 7, type: "manual" },
  { qid: 6, questionCategory: 10, title: "4,5", text: "What is 4 + 5?", correctAnswer: 9, type: "manual" },
  { qid: 7, questionCategory: 10, title: "8,3", text: "What is 8 - 3?", correctAnswer: 5, type: "manual" },
  { qid: 8, questionCategory: 10, title: "6,2", text: "What is 6 + 2?", correctAnswer: 8, type: "manual" },
  { qid: 9, questionCategory: 10, title: "5,4", text: "What is 5 + 4?", correctAnswer: 9, type: "manual" },
  { qid: 10, questionCategory: 10, title: "7,2", text: "What is 7 - 2?", correctAnswer: 5, type: "manual" },
  // CAT 2
  { qid: 11, questionCategory: 11, title: "15,23", text: "What is 15 + 23?", correctAnswer: 38, type: "manual" },
  { qid: 12, questionCategory: 11, title: "42,17", text: "What is 42 - 17?", correctAnswer: 25, type: "manual" },
  { qid: 13, questionCategory: 11, title: "28,36", text: "What is 28 + 36?", correctAnswer: 64, type: "manual" },
  { qid: 14, questionCategory: 11, title: "53,29", text: "What is 53 - 29?", correctAnswer: 24, type: "manual" },
  { qid: 15, questionCategory: 11, title: "34,48", text: "What is 34 + 48?", correctAnswer: 82, type: "manual" },
  { qid: 16, questionCategory: 11, title: "67,32", text: "What is 67 - 32?", correctAnswer: 35, type: "manual" },
  { qid: 17, questionCategory: 11, title: "45,27", text: "What is 45 + 27?", correctAnswer: 72, type: "manual" },
  { qid: 18, questionCategory: 11, title: "81,46", text: "What is 81 - 46?", correctAnswer: 35, type: "manual" },
  { qid: 19, questionCategory: 11, title: "56,38", text: "What is 56 + 38?", correctAnswer: 94, type: "manual" },
  { qid: 20, questionCategory: 11, title: "74,29", text: "What is 74 - 29?", correctAnswer: 45, type: "manual" },
  // CAT 3
  { qid: 21, questionCategory: 12, title: "12,5", text: "12 - 5", correctAnswer: 7, type: "auto" },
  { qid: 22, questionCategory: 12, title: "23,8", text: "23 - 8", correctAnswer: 15, type: "auto" },
  { qid: 23, questionCategory: 12, title: "45,17", text: "45 - 17", correctAnswer: 28, type: "auto" },
  { qid: 24, questionCategory: 12, title: "62,34", text: "62 - 34", correctAnswer: 28, type: "auto" },
  // CAT 4
  { qid: 25, questionCategory: 13, title: "17,5", text: "17 ÷ 5", correctAnswer: 3, remainder: 2, type: "auto" },
  { qid: 26, questionCategory: 13, title: "29,4", text: "29 ÷ 4", correctAnswer: 7, remainder: 1, type: "auto" }
];

const NumberSkillGame = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [childData, setChildData] = useState(null);
  const [screen, setScreen] = useState('splash'); // splash, game, score
  const [questionIndex, setQuestionIndex] = useState(0);
  const [allScores, setAllScores] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [gameSessionId, setGameSessionId] = useState(null);
  
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // Timer State
  const [qTimer, setQTimer] = useState(0);

  // Assessment Form State
  const [showGrid, setShowGrid] = useState(false);
  const [assessment, setAssessment] = useState({
    q1: '', q2: '', q3: '', q4: '',
    behaviors: [],
    notes: ''
  });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);

  // STT State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);

  const [activeInput, setActiveInput] = useState('answer');
  const [answerVal, setAnswerVal] = useState('');
  const [quotientVal, setQuotientVal] = useState('');
  const [remainderVal, setRemainderVal] = useState('');

  const timerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const dataStr = localStorage.getItem('currentChild');
    if (!dataStr) {
      navigate('/login');
    } else {
      const parsedData = JSON.parse(dataStr);
      setChildData(parsedData);
      checkResume(parsedData.child_id);
    }
  }, [navigate]);

  useEffect(() => {
    if (screen === 'game') {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  const checkResume = async (childId) => {
    setIsCheckingSession(true);
    try {
      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/numeracy_number_skill`);
      if (res.data.sessionInfo) {
        setResumeData(res.data.sessionInfo);
        setShowResumeModal(true);
      }
    } catch (e) {
      console.error('Resume info fetch error', e); 
    } finally {
      setIsCheckingSession(false);
    }
  };

  const startNewGame = async () => {
    try {
      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childData.child_id,
        game_name: 'numeracy_number_skill',
        total_questions: QUESTIONS.length
      });
      setGameSessionId(res.data.sessionId);
      resetInternalState();
      setScreen('game');
    } catch (e) { alert('Failed to start session on server.'); setScreen('game'); }
  };

  const resumeGame = () => {
    setGameSessionId(resumeData.id);
    const saved = resumeData.saved_state || {};
    setQuestionIndex(saved.questionIndex || 0);
    setAllScores(saved.allScores || []);
    setTimerSeconds(saved.timerSeconds || 0);
    setScreen('game');
    setShowResumeModal(false);
  };

  const resetInternalState = () => {
    setQuestionIndex(0);
    setAllScores([]);
    setTimerSeconds(0);
    setAnswerVal('');
    setQuotientVal('');
    setRemainderVal('');
    setAssessmentSubmitted(false);
    setActiveInput('answer');
  };

  // Question Timer Effect
  useEffect(() => {
    if (screen === 'game') {
      setQTimer(0);
      const interval = setInterval(() => {
        setQTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [questionIndex, screen]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Speech to Text logic
  const toggleRecording = (target) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Please type manually.");
      return;
    }

    if (isRecording && recordingTarget === target) {
      if(window.activeRecognition) window.activeRecognition.stop();
      setIsRecording(false);
      setRecordingTarget(null);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      
      if (finalTranscript) {
         if (target === 'quitReason') {
            setQuitReason(prev => prev + finalTranscript);
         } else if (target === 'assessmentNotes') {
            setAssessment(prev => ({ ...prev, notes: prev.notes + finalTranscript }));
         }
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      setRecordingTarget(null);
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error", e);
      setIsRecording(false);
      setRecordingTarget(null);
    };

    window.activeRecognition = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingTarget(target);
  };

  const saveToServer = async (statusOverride, reason) => {
    if (!gameSessionId) return;
    try {
      await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
        score: allScores.filter(s => s.score === 1).length,
        progress_level: questionIndex + 1,
        status: statusOverride || 'in_progress',
        quit_reason: reason || null,
        saved_state: { questionIndex, allScores, timerSeconds }
      });
    } catch (e) { console.error('Failed to sync progress to server:', e); }
  };

  const processScoring = (score, customValues = {}) => {
    const q = QUESTIONS[questionIndex];
    const newScoreRec = {
      qId: q.qid,
      questionNumber: questionIndex + 1,
      score: score, // 0 or 1
      timeTaken: qTimer, // Time taken for current question
      ...customValues
    };
    
    const upScores = [...allScores, newScoreRec];
    setAllScores(upScores);
    setAnswerVal(''); setQuotientVal(''); setRemainderVal('');
    
    // Check Stop Rules
    let consecutive = 0;
    for (let i = upScores.length - 1; i >= 0; i--) {
      if (upScores[i].score === 0) consecutive++;
      else break;
    }

    let shouldStop = false;
    let stopMsg = "";
    if (consecutive >= CONFIG.MAX_CONSECUTIVE_WRONG) {
      shouldStop = true; stopMsg = "3 Consecutive Wrong";
    }

    if (!shouldStop) {
      const qLen = upScores.length;
      const getCatCorrect = (start, len) => upScores.slice(start, start + len).filter(s => s.score === 1).length;
      
      const c1End = CONFIG.QUESTION_COUNT.SINGLE_NUMBER;
      const c2End = c1End + CONFIG.QUESTION_COUNT.DOUBLE_NUMBER;
      const c3End = c2End + CONFIG.QUESTION_COUNT.SUBTRACTION;

      if (qLen === c1End && getCatCorrect(0, c1End) < CONFIG.MIN_CORRECT.SINGLE_NUMBER) { shouldStop = true; stopMsg = "Category 1 Min Failed"; }
      if (qLen === c2End && getCatCorrect(c1End, CONFIG.QUESTION_COUNT.DOUBLE_NUMBER) < CONFIG.MIN_CORRECT.DOUBLE_NUMBER) { shouldStop = true; stopMsg = "Category 2 Min Failed"; }
      if (qLen === c3End && getCatCorrect(c2End, CONFIG.QUESTION_COUNT.SUBTRACTION) < CONFIG.MIN_CORRECT.SUBTRACTION) { shouldStop = true; stopMsg = "Category 3 Min Failed"; }
    }

    if (shouldStop || questionIndex + 1 >= QUESTIONS.length) {
      setScreen('score');
      // Save final state immediately
      if (gameSessionId) {
        axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
          score: upScores.filter(s => s.score === 1).length,
          progress_level: questionIndex + 1,
          status: 'completed',
          saved_state: { questionIndex: questionIndex + 1, allScores: upScores, timerSeconds }
        }).catch(e=>console.log(e));
      }
    } else {
      setQuestionIndex(i => i + 1);
    }
  };

  // Run auto-save whenever question advances
  useEffect(() => {
    if (screen === 'game' && questionIndex > 0) saveToServer('in_progress');
  }, [questionIndex]);

  const handleManualScoring = (isCorrect) => processScoring(isCorrect ? 1 : 0);
  const handleAutoScoring = () => {
    const q = QUESTIONS[questionIndex];
    if (q.questionCategory === 13) {
      const cQuot = parseInt(quotientVal) || 0;
      const cRem = parseInt(remainderVal) || 0;
      const pass = (cQuot === q.correctAnswer && cRem === q.remainder);
      processScoring(pass ? 1 : 0, { uQ: cQuot, uR: cRem });
    } else {
      const cAns = parseInt(answerVal) || 0;
      processScoring((cAns === q.correctAnswer) ? 1 : 0, { uA: cAns });
    }
  };

  const handleNumpadInput = (val) => {
    let setter = activeInput === 'quotient' ? setQuotientVal : 
                 activeInput === 'remainder' ? setRemainderVal : setAnswerVal;
    
    if (val === 'clear') setter('');
    else if (val === 'back') setter(prev => prev.slice(0, -1));
    else setter(prev => String(prev) + String(val));
  };

  const handleQuit = async (status) => {
    if (!quitReason.trim()) return alert('Please enter a reason');
    await saveToServer(status, quitReason);
    navigate('/');
  };

  const getTotalScore = () => allScores.filter(s => s.score === 1).length;

  const submitAssessmentForm = async () => {
    setIsAssessmentSubmitting(true);
    try {
      await axios.post(`${API_URL}/games/assessments`, {
        session_id: gameSessionId,
        child_id: childData.child_id,
        q1_enjoyment: assessment.q1,
        q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3,
        q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors,
        additional_notes: assessment.notes
      });
      setAssessmentSubmitted(true);
      alert('Assessment successfully saved!');
    } catch(e) {
      console.error(e);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const currentQuestion = QUESTIONS[questionIndex];

  return (
    <div className="ns-app">
      <header className="ns-topbar">
        <div className="ns-brand">
          <div className="ns-brand-icon">धं</div>
          <div>{t('game.numeracyLabel')}</div>
        </div>
        <div className="ns-stats">
          {childData?.child_id && (
            <div className="ns-stat-pill"><span className="ns-stat-label">{t('game.childId')}:</span> <span className="ns-stat-value">{childData.child_id}</span></div>
          )}
          <div className="ns-stat-pill"><span className="ns-stat-label">{t('game.score')}:</span> <span className="ns-stat-value">{getTotalScore()}</span></div>
          {screen === 'game' && <button className="ns-btn ns-btn-warning" style={{padding:'4px 12px', minWidth:0, fontSize:'0.8rem'}} onClick={() => setShowQuitModal(true)}>{t('game.pauseQuit')}</button>}
        </div>
      </header>

      <main className="ns-main">
        {screen === 'splash' && (
          <div className="ns-screen" style={{ backgroundColor: '#fff' }}>
            <div className="ns-screen-header">
              <div>
                <div className="ns-screen-title">{t('game.numeracyLabel')}</div>
                <div className="ns-screen-subtitle">{t('game.splashSubtitle')}</div>
              </div>
            </div>
            
            <div className="ns-card ns-splash-card" style={{ border: 'none', boxShadow: 'none', padding: '10px 24px', flex: 'none', minHeight: 'auto' }}>
              <div className="ns-splash-image-wrapper">
                <img src="/assets/images/number_skill.jpg" alt="Number Skill" className="ns-splash-image" onError={e => e.target.style.display='none'} />
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '8px', color: '#111827' }}>{t('game.welcome')}</h2>
              <p style={{ color: '#4b5563', fontSize: '1rem', marginBottom: '24px', maxWidth: '400px', lineHeight: '1.5' }}>
                {t('game.splashDesc')}
              </p>
              
              <div className="ns-btn-row">
                <button className="ns-btn ns-btn-primary" onClick={() => {
                   startNewGame();
                }}>{t('game.startNow')}</button>
                <button className="ns-btn ns-btn-secondary" onClick={() => {
                   if (audioRef.current) {
                     audioRef.current.currentTime = 0;
                     audioRef.current.play();
                   }
                }}>{t('game.replayAudio')}</button>
              </div>

              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '24px', maxWidth: '450px', lineHeight: '1.4' }}>
                {t('game.audioNote')}
              </p>
            </div>
          </div>
        )}

        {screen === 'game' && currentQuestion && (
          <div className="ns-screen" style={{ backgroundColor: '#fff' }}>
            <div className="ns-screen-header">
              <div>
                <div className="ns-screen-title" style={{fontSize: '1.4rem'}}>{t('game.question')} {questionIndex + 1} {t('game.of')} {QUESTIONS.length}</div>
                <div className="ns-screen-subtitle">
                  {t('game.category')}: {currentQuestion.questionCategory === 10 ? t('game.catSingle') : currentQuestion.questionCategory === 11 ? t('game.catDouble') : currentQuestion.questionCategory === 12 ? t('game.catSub') : t('game.catDiv')}
                </div>
              </div>
              <div className="ns-chips">
                <span className="ns-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>Q{questionIndex + 1}</span>
                <span className="ns-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', display:'inline-flex', alignItems:'center', gap:'4px' }}>
                  ⏱ {t('game.timer')}: {formatTime(qTimer)}
                </span>
              </div>
            </div>

            <div className="ns-card ns-question-bg" style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
              <div className="ns-question-label">{QUESTIONS[questionIndex].text}</div>
              
              {QUESTIONS[questionIndex].type === 'manual' ? (
                <div className="ns-manual-buttons" style={{marginTop:'30px'}}>
                  <button className="ns-btn ns-btn-correct" onClick={() => handleManualScoring(true)}>✓ {t('game.correct')}</button>
                  <button className="ns-btn ns-btn-incorrect" onClick={() => handleManualScoring(false)}>✗ {t('game.incorrect')}</button>
                </div>
              ) : (
                <div className="ns-auto-inputs" style={{marginTop:'30px'}}>
                  {QUESTIONS[questionIndex].questionCategory === 13 ? (
                    <>
                      <div className="ns-input-group" onClick={()=>setActiveInput('quotient')} style={{cursor:'pointer'}}>
                        <label>{t('game.quotient')}:</label>
                        <input type="text" readOnly value={quotientVal} style={activeInput==='quotient'?{borderColor:'#2563eb'}:{}} />
                      </div>
                      <div className="ns-input-group" onClick={()=>setActiveInput('remainder')} style={{cursor:'pointer'}}>
                        <label>{t('game.remainder')}:</label>
                        <input type="text" readOnly value={remainderVal} style={activeInput==='remainder'?{borderColor:'#2563eb'}:{}} />
                      </div>
                    </>
                  ) : (
                    <div className="ns-input-group" onClick={()=>setActiveInput('answer')}>
                      <label>{t('game.answer')}:</label>
                      <input type="text" readOnly value={answerVal} />
                    </div>
                  )}
                  <button className="ns-btn ns-btn-submit" onClick={handleAutoScoring}>{t('game.submitAnswer')}</button>

                  <div className="ns-numpad" style={{marginTop:'20px'}}>
                    {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={()=>handleNumpadInput(num)} className="ns-key">{num}</button>)}
                    <button onClick={()=>handleNumpadInput('clear')} className="ns-key ns-key-danger" style={{fontSize:'1.2rem'}}>{t('game.clear')}</button>
                    <button onClick={()=>handleNumpadInput(0)} className="ns-key">0</button>
                    <button onClick={()=>handleNumpadInput('back')} className="ns-key" style={{background:'#6b7280'}}>⌫</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'score' && (
          <div className="ns-screen" style={{ backgroundColor: '#fff' }}>
            <div className="ns-screen-header">
              <div>
                <div className="ns-screen-title">{t('game.assessmentComplete')}</div>
                <div className="ns-screen-subtitle">{t('game.allQuestionsCompleted')}</div>
              </div>
              <div className="ns-chips">
                <span className="ns-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>{t('game.finalResults')}</span>
                <span className="ns-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  {t('game.time')}: {Math.floor(allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) / 60)}m {allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) % 60}s
                </span>
              </div>
            </div>
            
            <div className="ns-card ns-result-card">
              <div className="ns-result-header">
                <h2>{t('game.performance')}</h2>
                <p>{t('game.assessmentCompleted')}</p>
              </div>

              <div className="ns-score-top">
                <div className="ns-score-dial-container">
                  <div className="ns-score-dial-big">{getTotalScore()}</div>
                  <div className="ns-score-dial-small">/ {QUESTIONS.length}</div>
                </div>

                <div className="ns-metric-grid">
                  <div className="ns-metric-box">
                    <label>{t('game.totalScore')}</label>
                    <div className="metric-val">{getTotalScore()} / {QUESTIONS.length}</div>
                  </div>
                  <div className="ns-metric-box">
                    <label>{t('game.correct')}</label>
                    <div className="metric-val green">{getTotalScore()}</div>
                  </div>
                  <div className="ns-metric-box">
                    <label>{t('game.incorrect')}</label>
                    <div className="metric-val red">{QUESTIONS.length - getTotalScore()}</div>
                  </div>
                  <div className="ns-metric-box">
                    <label>{t('game.percentage')}</label>
                    <div className="metric-val">{((getTotalScore() / QUESTIONS.length) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="ns-metric-box">
                    <label>{t('game.totalTime')}</label>
                    <div className="metric-val">
                       {Math.floor(allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) / 60)}m {allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) % 60}s
                    </div>
                  </div>
                  <div className="ns-metric-box">
                    <label>{t('game.avgTimeQ')}</label>
                    <div className="metric-val">{Math.round(allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) / (allScores.length||1))}s</div>
                  </div>
                </div>
              </div>

              {((getTotalScore() / QUESTIONS.length) * 100) > 80 && (
                 <div className="ns-banner">{t('game.outstanding')}</div>
              )}

              <div className="ns-accordion-toggle" onClick={() => setShowGrid(!showGrid)}>
                {showGrid ? '▼' : '▶'} {t('game.showGrid')}
              </div>

              {showGrid && (
                <div className="ns-q-grid">
                  {allScores.map((scoreObj, idx) => {
                    const qObj = QUESTIONS.find(q=>q.qid === scoreObj.qId);
                    const catName = qObj?.questionCategory === 10 ? t('game.catSingle') : qObj?.questionCategory === 11 ? t('game.catDouble') : qObj?.questionCategory === 12 ? t('game.catSub') : t('game.catDiv');
                    const timeDisp = scoreObj.timeTaken === 0 ? '0s' : scoreObj.timeTaken + 's';
                    return (
                      <div key={idx} className="ns-q-card">
                        <div className="ns-q-top">
                          <span className="ns-q-num">Q{scoreObj.questionNumber}</span>
                          <span className="ns-q-cat">{catName}</span>
                        </div>
                        <div className="ns-q-bottom">
                          <span className="ns-q-time">{timeDisp}</span>
                          <span className={scoreObj.score === 1 ? 'ns-q-icon green' : 'ns-q-icon red'}>{scoreObj.score === 1 ? '✔' : '✖'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Assessment Form Segment */}
              <div className="ns-assessment-section">
                <h3 className="ns-form-title">{t('game.sessionDetails')}</h3>
                
                {[
                  { key: 'q1', label: t('game.q1Label') },
                  { key: 'q2', label: t('game.q2Label') },
                  { key: 'q3', label: t('game.q3Label') },
                  { key: 'q4', label: t('game.q4Label') }
                ].map((q) => (
                  <div key={q.key} className="ns-q-group">
                    <label className="ns-q-label">{q.label}</label>
                    <div className="ns-radio-row">
                      {[
                        { val: 'Yes, a lot', str: t('game.optYes') },
                        { val: 'A little', str: t('game.optLittle') },
                        { val: 'Not much', str: t('game.optNotMuch') }
                      ].map(opt => (
                        <label key={opt.val} className="ns-radio-label">
                          <input type="radio" name={q.key} disabled={assessmentSubmitted} checked={assessment[q.key] === opt.val} onChange={() => setAssessment({...assessment, [q.key]: opt.val})} />
                          {opt.str}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="ns-q-group">
                  <label className="ns-q-label">{t('game.q5Label')}</label>
                  <div className="ns-checkbox-grid">
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
                       <label key={bhv.val} className="ns-checkbox-label">
                         <input type="checkbox" disabled={assessmentSubmitted} checked={assessment.behaviors.includes(bhv.val)} onChange={(e) => {
                            if(e.target.checked) setAssessment({...assessment, behaviors:[...assessment.behaviors, bhv.val]});
                            else setAssessment({...assessment, behaviors: assessment.behaviors.filter(b=>b!==bhv.val)});
                         }} />
                         {bhv.str}
                       </label>
                    ))}
                  </div>
                </div>
                
                <div className="ns-q-group">
                   <label className="ns-q-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span>{t('game.extraNotes')}</span>
                     <button 
                       onClick={() => toggleRecording('assessmentNotes')} 
                       style={{ 
                         background: isRecording && recordingTarget === 'assessmentNotes' ? '#fee2e2' : '#eff6ff',
                         color: isRecording && recordingTarget === 'assessmentNotes' ? '#ef4444' : '#2563eb',
                         border: '1px solid',
                         borderColor: isRecording && recordingTarget === 'assessmentNotes' ? '#fca5a5' : '#bfdbfe',
                         padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                       }}>
                       🎙 {isRecording && recordingTarget === 'assessmentNotes' ? t('game.recordingStop') : t('game.useMic')}
                     </button>
                   </label>
                   <textarea className="ns-textarea" rows="3" disabled={assessmentSubmitted} placeholder={t('game.dictatePlaceholder')} value={assessment.notes} onChange={(e) => setAssessment({...assessment, notes: e.target.value})}></textarea>
                </div>
              </div>

              <div className="ns-final-actions">
                {assessmentSubmitted ? (
                  <>
                    <button onClick={() => { setScreen('splash'); resetInternalState(); }} className="ns-btn ns-btn-primary">{t('game.retest')}</button>
                    <button onClick={() => navigate('/')} className="ns-btn ns-btn-secondary">{t('game.home')}</button>
                  </>
                ) : (
                  <button onClick={submitAssessmentForm} disabled={isAssessmentSubmitting} className="ns-btn ns-btn-primary" style={{ minWidth: '220px' }}>
                    {isAssessmentSubmitting ? t('game.saving') : t('game.submitAssessment')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {!isCheckingSession && (
        <audio ref={audioRef} src="/assets/audios/number_skill_splash.wav" preload="auto" autoPlay={!showResumeModal && screen === 'splash'} />
      )}

      {/* Modals */}
      {showResumeModal && (
        <div className="ns-modal-overlay">
          <div className="ns-modal">
            <h2>{t('game.progressFound')}</h2>
            <p>{t('game.progressDesc')}</p>
            <div className="ns-btn-row" style={{marginTop:'20px'}}>
              <button className="ns-btn ns-btn-secondary" onClick={() => { setShowResumeModal(false); startNewGame(); }}>{t('game.restartFresh')}</button>
              <button className="ns-btn ns-btn-primary" onClick={resumeGame}>{t('game.resumeGame')}</button>
            </div>
          </div>
        </div>
      )}

      {showQuitModal && (
        <div className="ns-modal-overlay">
          <div className="ns-modal">
            <h2>{t('game.pauseQuitTitle')}</h2>
            <p>{t('game.pauseDesc')}</p>
            
            <div style={{ position: 'relative' }}>
              <textarea 
                placeholder={t('game.pausePlaceholder')}
                value={quitReason} 
                onChange={e => setQuitReason(e.target.value)}
              />
              <button 
                onClick={() => toggleRecording('quitReason')} 
                style={{
                  position: 'absolute', top: '25px', right: '10px',
                  background: isRecording && recordingTarget === 'quitReason' ? '#ef4444' : '#e2e8f0',
                  color: isRecording && recordingTarget === 'quitReason' ? 'white' : '#475569',
                  border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
                title={isRecording ? 'Stop Recording' : 'Start Dictation'}
              >
                🎙
              </button>
            </div>

            <div className="ns-btn-row">
              <button className="ns-btn ns-btn-secondary" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem'}} onClick={() => setShowQuitModal(false)}>{t('game.cancel')}</button>
              <button className="ns-btn" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', background:'#fef08a', color:'#854d0e'}} onClick={() => handleQuit('paused')}>{t('game.pauseSave')}</button>
              <button className="ns-btn ns-btn-incorrect" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem'}} onClick={() => handleQuit('quit')}>{t('game.quitEnd')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NumberSkillGame;
