import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
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
  const [activityData, setActivityData] = useState({ lastPlayed: 'Never', attempts: 0 });
  const [screen, setScreen] = useState('splash'); // splash, game, score
  const [questionIndex, setQuestionIndex] = useState(0);
  const [allScores, setAllScores] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [gameSessionId, setGameSessionId] = useState(null);
  const [attemptNo, setAttemptNo] = useState(1);
  
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [pauses, setPauses] = useState([]);
  
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [audioFinished, setAudioFinished] = useState(false);
  
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

  // ─── StatusBar: hide on native during this game ───────────────────────────
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.hide().catch(() => {});
    }
    return () => {
      if (Capacitor.isNativePlatform()) {
        StatusBar.show().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const dataStr = localStorage.getItem('currentChild');
    if (!dataStr) {
      navigate('/login');
    } else {
      const parsedData = JSON.parse(dataStr);
      setChildData(parsedData);
      checkResume(parsedData.child_id);
      fetchActivity(parsedData.child_id);
    }
  }, [navigate]);

  const fetchActivity = async (cid) => {
    try {
      const res = await axios.get(`${API_URL}/games/sessions/summaries/${cid}`);
      if (res.data.success) {
        const summary = res.data.summaries.find(s => s.game_name === 'numeracy_number_skill');
        if (summary) {
          setActivityData({
            lastPlayed: formatDate(summary.last_played_at),
            attempts: summary.total_attempts
          });
        }
      }
    } catch (e) {
      console.error('Activity fetch error', e);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/am|pm/g, match => match.toUpperCase());
  };

  useEffect(() => {
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && audioRef.current && !audioFinished) {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("Autoplay blocked by browser policy:", err);
          setAudioFinished(true);
        });
      }
    }
  }, [isCheckingSession, screen, showResumeModal, audioFinished]);

  useEffect(() => {
    if ((screen === 'game' && !showQuitModal) || (screen === 'score' && !assessmentSubmitted)) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, showQuitModal, assessmentSubmitted]);

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
      setAttemptNo(res.data.attempt_no || 1);
      resetInternalState();
      setScreen('game');
    } catch (e) { alert(t('common.failedToStart')); setScreen('game'); }
  };

  const resumeGame = () => {
    setGameSessionId(resumeData.id);
    setAttemptNo(resumeData.attempt_no || 1);
    const saved = resumeData.saved_state || {};
    setQuestionIndex(saved.questionIndex || 0);
    setAllScores(saved.allScores || []);
    setTimerSeconds(saved.timerSeconds || 0);
    setQTimer(saved.qTimer || 0);
    setPauses(saved.pauses || []);
    setScreen('game');
    setShowResumeModal(false);
  };

  const resetInternalState = () => {
    setQuestionIndex(0);
    setAllScores([]);
    setTimerSeconds(0);
    setQTimer(0);
    setPauses([]);
    setAnswerVal('');
    setQuotientVal('');
    setRemainderVal('');
    setAssessmentSubmitted(false);
    setActiveInput('answer');
    setAudioFinished(false);
    setQuitReason('');
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  };

  // Question Timer Effect
  useEffect(() => {
    if (screen === 'game' && !showQuitModal) {
      const interval = setInterval(() => {
        setQTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [screen, showQuitModal]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatSec = (sec) => {
    if (sec == null || sec < 0) return '—';
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) {
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Speech to Text logic
  const toggleRecording = (target) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('common.speechNotSupported'));
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
      let updatedPauses = [...pauses];
      if (reason && (statusOverride === 'paused' || statusOverride === 'quit')) {
         updatedPauses.push({
             questionNumber: questionIndex + 1,
             reason: reason,
             timestamp: new Date().toISOString()
         });
         setPauses(updatedPauses);
      }

      await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
        score: allScores.filter(s => s.score === 1).length,
        progress_level: questionIndex + 1,
        status: statusOverride || 'in_progress',
        quit_reason: reason || null,
        saved_state: { questionIndex, allScores, timerSeconds, qTimer, pauses: updatedPauses }
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
          saved_state: { questionIndex: questionIndex + 1, allScores: upScores, timerSeconds, qTimer, pauses }
        }).then(() => {
          setTimeout(generateAndUploadPDF, 1500);
        }).catch(e=>console.log(e));
      }
    } else {
      setQuestionIndex(i => i + 1);
      setQTimer(0);
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
    if (!quitReason.trim()) return alert(t('common.enterReason'));
    await saveToServer(status, quitReason);
    if (status === 'quit') {
      setShowQuitModal(false);
      setScreen('score');
      setTimeout(generateAndUploadPDF, 1500);
    } else {
      navigate('/');
    }
  };

  const getTotalScore = () => allScores.filter(s => s.score === 1).length;

  const generateAndUploadPDF = async () => {
    if (!gameSessionId) return;
    try {
      setShowGrid(true); // Force table to be visible for PDF capture
      await new Promise(r => setTimeout(r, 500)); // Wait for render
      
      const el = document.querySelector('.ns-main');
      if (!el) return;
      
      const canvas = await html2canvas(el, { 
        scale: 1.5, 
        useCORS: true, 
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output('blob');
      
      const formData = new FormData();
      const childNameSafe = (childData?.name || childData?.child_id || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
      const ts = new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14);
      formData.append('pdf', pdfBlob, `${childNameSafe}_Ankganit_SES${gameSessionId}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', gameSessionId);
      formData.append('game_name', 'numeracy_number_skill');
      
      await axios.post(`${API_URL}/games/pdfs/upload`, formData);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    }
  };

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
      // Save final screentime (stops here) to session so admin panel reflects it
      if (gameSessionId) {
        axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
          saved_state: { questionIndex, allScores, timerSeconds, qTimer, pauses }
        }).catch(e => console.error('Screentime save error', e));
      }

      setAssessmentSubmitted(true);
      alert(t('game.assessmentSubmitted'));
      setTimeout(generateAndUploadPDF, 1500);
    } catch(e) {
      console.error(e);
      alert(t('common.failedToSave'));
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const currentQuestion = QUESTIONS[questionIndex];

  return (
    <div className="ns-app">
      <header className="ns-topbar">
        <div className="ns-brand">
          <img src="/cel_admin_logo.png" alt="CEL Logo" className="ns-brand-img" />
          <div className="ns-divider"></div>
          <img src="/assets/images/number_skill/number_skill.jpg" alt="Number Skill" className="ns-test-logo" />
          <span className="ns-test-title">{t('home.games.numeracy.title')}</span>
        </div>
        <div className="ns-topbar-center">
          {screen === 'game' && currentQuestion && (
            <div className="ns-topbar-screen-title">{t('game.question')} {questionIndex + 1}</div>
          )}
        </div>
        <div className="ns-stats">
          {childData?.child_id && (
            <div className="ns-stat-pill"><span className="ns-stat-icon">👤</span> <span className="ns-stat-value">{childData.child_id}</span></div>
          )}
          {screen === 'game' && (
            <div className="ns-stat-pill"><span className="ns-stat-icon">⏱</span> <span className="ns-stat-value">{formatTime(qTimer)}</span></div>
          )}
          <div className="ns-stat-pill"><span className="ns-stat-icon">🏆</span> <span className="ns-stat-value">{getTotalScore()}</span></div>
          {screen === 'game' && <button className="btn-pause-quit" onClick={() => { setQuitReason(''); setShowQuitModal(true); }}><span>⏸</span> Pause/Quit</button>}
        </div>
      </header>

      <main className={`ns-main${screen === 'splash' ? ' ns-main-splash' : ''}`}>
        {screen === 'splash' && (
          <div className="ns-screen ns-screen-splash">
            <div className="ns-splash-cover">
              <img src="/assets/images/number_skill/number_skill.jpg" alt="Ankganit" className="ns-splash-img-full" onError={e => { e.target.style.display = 'none'; }} />
              <div className="ns-splash-btn-overlay">
                <button
                  className={`ns-btn ns-btn-primary ${audioFinished ? 'ns-btn-highlight' : ''}`}
                  disabled={!audioFinished}
                  style={{ opacity: !audioFinished ? 0.6 : 1, cursor: !audioFinished ? 'not-allowed' : 'pointer' }}
                  onClick={() => { startNewGame(); }}
                >
                  {t('game.startNow')}
                </button>
                <button className="ns-btn ns-btn-secondary" onClick={() => {
                  if (audioRef.current) {
                    setAudioFinished(false);
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                  }
                }}>{t('game.replayAudio')}</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'game' && currentQuestion && QUESTIONS[questionIndex].type === 'manual' && (
          <div className="ns-screen" style={{ backgroundColor: '#fff' }}>
            <div className="ns-card ns-question-card">
              <div className="ns-question-content">{QUESTIONS[questionIndex].text}</div>
            </div>
            <div className="ns-response-buttons">
              <button className="ns-response-btn ns-btn-correct" onClick={() => handleManualScoring(true)}>✓ {t('game.correct')}</button>
              <button className="ns-response-btn ns-btn-incorrect" onClick={() => handleManualScoring(false)}>✗ {t('game.incorrect')}</button>
            </div>
          </div>
        )}

        {screen === 'game' && currentQuestion && QUESTIONS[questionIndex].type !== 'manual' && (
          <div className="ns-screen ns-screen-split" style={{ backgroundColor: '#fff' }}>
            <div className="ns-card ns-question-card ns-split-question">
              <div className="ns-question-content">{QUESTIONS[questionIndex].text}</div>
            </div>

            <div className="ns-auto-inputs ns-split-inputs">
              {QUESTIONS[questionIndex].questionCategory === 13 ? (
                <div className="ns-input-row">
                  <div className="ns-input-group" onClick={()=>setActiveInput('quotient')}>
                    <label>{t('game.quotient')}</label>
                    <input type="text" readOnly value={quotientVal} className={activeInput==='quotient' ? 'ns-input-active' : ''} />
                  </div>
                  <div className="ns-input-group" onClick={()=>setActiveInput('remainder')}>
                    <label>{t('game.remainder')}</label>
                    <input type="text" readOnly value={remainderVal} className={activeInput==='remainder' ? 'ns-input-active' : ''} />
                  </div>
                </div>
              ) : (
                <div className="ns-input-group" onClick={()=>setActiveInput('answer')}>
                  <input type="text" readOnly value={answerVal} placeholder="?" className="ns-input-active" />
                </div>
              )}
              <button className="ns-btn ns-btn-submit" onClick={handleAutoScoring}>{t('game.submitAnswer')}</button>

              <div className="ns-numpad">
                {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={()=>handleNumpadInput(num)} className="ns-key">{num}</button>)}
                <button onClick={()=>handleNumpadInput('clear')} className="ns-key ns-key-danger" style={{fontSize:'1.2rem'}}>{t('game.clear')}</button>
                <button onClick={()=>handleNumpadInput(0)} className="ns-key">0</button>
                <button onClick={()=>handleNumpadInput('back')} className="ns-key ns-key-back">⌫</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'score' && (
          <div className="ns-screen" style={{ backgroundColor: '#fff' }}>
            <div className="ns-screen-header">
              <div>
                <div className="ns-screen-title">{quitReason ? t('game.assessmentTerminated') : t('game.assessmentComplete')}</div>
                <div className="ns-screen-subtitle">{quitReason ? `${t('game.reasonLabel')} ${quitReason}` : t('game.allQuestionsCompleted')}</div>
              </div>
              <div className="ns-chips">
                <span className="ns-chip" style={{ color: '#fff', background: '#4f46e5', border: '1px solid #4338ca' }}>{t('game.attemptLabel')}{attemptNo}</span>
                <span className="ns-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  {t('game.timeChip')} {formatTime(timerSeconds)}
                </span>
              </div>
            </div>
            
            <div className="ns-card ns-result-card">


              <div className="ns-score-top">
                <div className="ns-score-dial-container">
                  <div className="ns-score-dial-big">{getTotalScore()}</div>
                  <div className="ns-score-dial-small">/ {QUESTIONS.length}</div>
                </div>

                <div className="ns-metric-grid">
                  <div className="ns-metric-box">
                    <label>{t('game.correct')}</label>
                    <div className="metric-val green">{getTotalScore()}</div>
                  </div>
                  <div className="ns-metric-box">
                    <label>{t('game.incorrect')}</label>
                    <div className="metric-val red">{allScores.length - getTotalScore()}</div>
                  </div>
                  <div className="ns-metric-box">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {t('game.accuracyLabel')}
                      <span className="kpi-formula-icon" data-tooltip="Correct Answers ÷ Total Attempted × 100">ⓘ</span>
                    </label>
                    <div className="metric-val">{((getTotalScore() / QUESTIONS.length) * 100).toFixed(1)}%</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{getTotalScore()} / {QUESTIONS.length}</div>
                  </div>
                  <div className="ns-metric-box">
                    <label>{t('game.totalTimeMetric')}</label>
                    <div className="metric-val">
                       {formatSec(allScores.reduce((acc, s) => acc + (s.timeTaken || 0), 0))}
                    </div>
                  </div>
                  <div className="ns-metric-box">
                    <label>{t('game.avgTimeQ')}</label>
                    <div className="metric-val">{Math.round(allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) / (allScores.length||1))}s</div>
                  </div>
                </div>
              </div>

                <div style={{ marginTop: '20px', overflowX: 'auto', marginBottom: '30px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{t('game.sNo')}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{t('game.scoreTable.question')}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{t('game.scoreTable.correctAnswer')}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{t('game.scoreTable.status')}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{t('game.scoreTable.score')}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{t('game.scoreTable.duration')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allScores.map((scoreObj, idx) => {
                        const qObj = QUESTIONS.find(q => q.qid === scoreObj.qId);
                        const timeDisp = scoreObj.timeTaken === 0 ? '0s' : scoreObj.timeTaken + 's';
                        let cAnsText = qObj?.correctAnswer || '—';
                        if (qObj?.questionCategory === 13) cAnsText = `Q:${qObj.correctAnswer}, R:${qObj.remainder}`;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>{idx + 1}</td>
                            <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#334155' }}>{qObj?.text}</td>
                            <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}>{cAnsText}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, background: scoreObj.score === 1 ? '#d1fae5' : '#fee2e2', color: scoreObj.score === 1 ? '#065f46' : '#991b1b' }}>
                                {scoreObj.score === 1 ? t('game.scoreTable.correct') : t('game.scoreTable.incorrect')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: 700, color: scoreObj.score === 1 ? '#059669' : '#dc2626' }}>{scoreObj.score}</td>
                            <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#64748b', fontFamily: 'monospace' }}>{formatSec(scoreObj.timeTaken)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              {/* Assessment Form Segment */}
              <SessionAssessmentForm
                assessment={assessment}
                setAssessment={setAssessment}
                assessmentSubmitted={assessmentSubmitted}
                isAssessmentSubmitting={isAssessmentSubmitting}
                submitAssessmentForm={submitAssessmentForm}
                isRecording={isRecording}
                recordingTarget={recordingTarget}
                toggleRecording={toggleRecording}
                t={t}
              >
                <>
                  <button onClick={() => { resetInternalState(); setScreen('splash'); }} className="ns-btn ns-btn-primary">{t('game.retest')}</button>
                  <button onClick={() => navigate('/')} className="ns-btn ns-btn-secondary">{t('game.home')}</button>
                </>
              </SessionAssessmentForm>
            </div>
          </div>
        )}
      </main>

      {!isCheckingSession && (
        <audio 
          ref={audioRef} 
          src="/assets/audios/number_skill/splash.wav"
          preload="auto" 
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {/* Modals */}
      {showResumeModal && (
        <div className="ns-modal-overlay">
          <div className="ns-modal">
            <h2>{t('game.progressFound')}</h2>
            <p>{t('game.progressDesc')}</p>
            <div className="ns-btn-row" style={{ marginTop: '20px', flexWrap: 'nowrap' }}>
              <button className="ns-btn ns-btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={() => { setShowResumeModal(false); resetInternalState(); setScreen('splash'); }}>{t('game.restartFresh')}</button>
              <button className="ns-btn ns-btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={resumeGame}>{t('game.resumeGame')}</button>
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
