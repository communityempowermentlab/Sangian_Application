import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './ReadingSkillGame.css';

const CONFIG = {
  IMAGE_PATH: "/assets/images",
  AUDIO_PATH: "/assets/audios"
};

const CATEGORY = {
  SINGLE_LETTER: 18,
  DOUBLE_LETTER: 19,
  SENTENCE: 20,
  STORY: 21,
  PARAGRAPH: 23
};

const RULES = {
  MIN_CORRECT_SINGLE: 4,
  MIN_CORRECT_DOUBLE: 4,
  TOTAL_SINGLE: 10,
  TOTAL_DOUBLE: 8
};

const QUESTIONS = [
  { id: 1, order: 1, category: CATEGORY.SINGLE_LETTER, text: "क", categoryName: "Single Letter" },
  { id: 2, order: 2, category: CATEGORY.SINGLE_LETTER, text: "ख", categoryName: "Single Letter" },
  { id: 3, order: 3, category: CATEGORY.SINGLE_LETTER, text: "ग", categoryName: "Single Letter" },
  { id: 4, order: 4, category: CATEGORY.SINGLE_LETTER, text: "घ", categoryName: "Single Letter" },
  { id: 5, order: 5, category: CATEGORY.SINGLE_LETTER, text: "च", categoryName: "Single Letter" },
  { id: 6, order: 6, category: CATEGORY.SINGLE_LETTER, text: "छ", categoryName: "Single Letter" },
  { id: 7, order: 7, category: CATEGORY.SINGLE_LETTER, text: "ज", categoryName: "Single Letter" },
  { id: 8, order: 8, category: CATEGORY.SINGLE_LETTER, text: "झ", categoryName: "Single Letter" },
  { id: 9, order: 9, category: CATEGORY.SINGLE_LETTER, text: "ट", categoryName: "Single Letter" },
  { id: 10, order: 10, category: CATEGORY.SINGLE_LETTER, text: "ठ", categoryName: "Single Letter" },
  { id: 11, order: 11, category: CATEGORY.DOUBLE_LETTER, text: "कम", categoryName: "Double Letter" },
  { id: 12, order: 12, category: CATEGORY.DOUBLE_LETTER, text: "घर", categoryName: "Double Letter" },
  { id: 13, order: 13, category: CATEGORY.DOUBLE_LETTER, text: "चल", categoryName: "Double Letter" },
  { id: 14, order: 14, category: CATEGORY.DOUBLE_LETTER, text: "जल", categoryName: "Double Letter" },
  { id: 15, order: 15, category: CATEGORY.DOUBLE_LETTER, text: "टल", categoryName: "Double Letter" },
  { id: 16, order: 16, category: CATEGORY.DOUBLE_LETTER, text: "फल", categoryName: "Double Letter" },
  { id: 17, order: 17, category: CATEGORY.DOUBLE_LETTER, text: "मन", categoryName: "Double Letter" },
  { id: 18, order: 18, category: CATEGORY.DOUBLE_LETTER, text: "रस", categoryName: "Double Letter" },
  { id: 19, order: 19, category: CATEGORY.SENTENCE, text: "राम घर जाता है।", categoryName: "Sentence" },
  { id: 20, order: 20, category: CATEGORY.SENTENCE, text: "सीता फल खाती है।", categoryName: "Sentence" },
  { 
    id: 21, order: 21, category: CATEGORY.STORY, 
    text: "एक बार की बात है। एक छोटा सा लड़का था। उसका नाम राम था। वह रोज स्कूल जाता था। वह बहुत मेहनती था। उसे किताबें पढ़ना बहुत पसंद था। एक दिन उसने एक बड़ी किताब पढ़ी। उस किताब में बहुत सारी अच्छी कहानियाँ थीं। राम बहुत खुश हुआ।", 
    categoryName: "Story",
    assessmentCriteria: ["Did the child skip any words?", "Did the child make pronunciation errors?", "Did the child need help reading?"]
  },
  { 
    id: 22, order: 22, category: CATEGORY.PARAGRAPH, 
    text: "भारत एक विशाल देश है। यहाँ विभिन्न संस्कृतियाँ और भाषाएँ हैं। हमारे देश में अनेक त्योहार मनाए जाते हैं। दिवाली, होली, ईद और क्रिसमस प्रमुख त्योहार हैं। सभी लोग मिलजुलकर रहते हैं। हमें अपने देश पर गर्व है।", 
    categoryName: "Paragraph",
    assessmentCriteria: ["Did the child skip any words?", "Did the child make pronunciation errors?", "Did the child need help reading?"]
  }
];

const ReadingSkillGame = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [childData, setChildData] = useState(null);
  const [activityData, setActivityData] = useState({ lastPlayed: 'Never', attempts: 0 });
  const [screen, setScreen] = useState('splash'); // splash, game, score
  const [questionIndex, setQuestionIndex] = useState(0);
  const [allScores, setAllScores] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [gameSessionId, setGameSessionId] = useState(null);
  
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [pauses, setPauses] = useState([]);
  
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [audioFinished, setAudioFinished] = useState(false);
  
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  const [qTimer, setQTimer] = useState(0);

  // Mid-test Assessment Modal
  const [showMidTestModal, setShowMidTestModal] = useState(false);
  const [midTestAnswers, setMidTestAnswers] = useState({});

  // Final Assessment Form State
  const [showGrid, setShowGrid] = useState(false);
  const [assessment, setAssessment] = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);

  // STT State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);

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
      fetchActivity(parsedData.child_id);
    }
  }, [navigate]);

  const fetchActivity = async (cid) => {
    try {
      const res = await axios.get(`${API_URL}/games/sessions/summaries/${cid}`);
      if (res.data.success) {
        const summary = res.data.summaries.find(s => s.game_name === 'literacy_reading_skill');
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
    if (screen === 'game' && !showQuitModal && !showMidTestModal) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, showQuitModal, showMidTestModal]);

  const checkResume = async (childId) => {
    setIsCheckingSession(true);
    try {
      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/literacy_reading_skill`);
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
        game_name: 'literacy_reading_skill',
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
    setAssessmentSubmitted(false);
    setAudioFinished(false);
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  };

  // Question Timer Effect
  useEffect(() => {
    if (screen === 'game' && !showQuitModal && !showMidTestModal) {
      const interval = setInterval(() => {
        setQTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [screen, showQuitModal, showMidTestModal]);

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
        score: allScores.reduce((acc, s) => acc + s.score, 0),
        progress_level: questionIndex + 1,
        status: statusOverride || 'in_progress',
        quit_reason: reason || null,
        saved_state: { questionIndex, allScores, timerSeconds, qTimer, pauses: updatedPauses }
      });
    } catch (e) { console.error('Failed to sync progress to server:', e); }
  };

  const processScoring = (score) => {
    const q = QUESTIONS[questionIndex];
    const newScoreRec = {
      qId: q.id,
      questionNumber: questionIndex + 1,
      score: score, // 0 or 1
      timeTaken: qTimer,
    };
    
    const upScores = [...allScores, newScoreRec];
    setAllScores(upScores);
    
    // Check Drop Rules
    let shouldDrop = false;

    // Single Letter Drop
    if (upScores.length === RULES.TOTAL_SINGLE) {
      const correctCount = upScores.slice(0, RULES.TOTAL_SINGLE).filter(s => s.score === 1).length;
      if (correctCount < RULES.MIN_CORRECT_SINGLE) shouldDrop = true;
    }
    
    // Double Letter Drop
    const totalDoubleSoFar = RULES.TOTAL_SINGLE + RULES.TOTAL_DOUBLE;
    if (!shouldDrop && upScores.length === totalDoubleSoFar) {
      const correctCount = upScores.slice(RULES.TOTAL_SINGLE, totalDoubleSoFar).filter(s => s.score === 1).length;
      if (correctCount < RULES.MIN_CORRECT_DOUBLE) shouldDrop = true;
    }

    // Assessment Drop (Story/Paragraph)
    if (!shouldDrop && (q.category === CATEGORY.STORY || q.category === CATEGORY.PARAGRAPH)) {
      if (score === 0) shouldDrop = true;
    }

    if (shouldDrop || questionIndex + 1 >= QUESTIONS.length) {
      setScreen('score');
      if (gameSessionId) {
        axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
          score: upScores.reduce((sum, s) => sum + s.score, 0),
          progress_level: questionIndex + 1,
          status: 'completed',
          saved_state: { questionIndex: questionIndex + 1, allScores: upScores, timerSeconds, qTimer, pauses }
        }).catch(e=>console.log(e));
      }
    } else {
      setQuestionIndex(i => i + 1);
      setQTimer(0);
    }
  };

  useEffect(() => {
    if (screen === 'game' && questionIndex > 0) saveToServer('in_progress');
  }, [questionIndex]);

  const handleManualScoring = (isCorrect) => processScoring(isCorrect ? 1 : 0);

  const handleDoneReading = () => {
    setMidTestAnswers({});
    setShowMidTestModal(true);
  };

  const handleMidTestAssessmentComplete = () => {
    // Score based on answers: ANY "yes" = 0, ALL "no" = 1
    let finalScore = 1;
    for (let key in midTestAnswers) {
      if (midTestAnswers[key] === 'yes') {
        finalScore = 0; break;
      }
    }
    setShowMidTestModal(false);
    processScoring(finalScore);
  };

  const handleQuit = async (status) => {
    if (!quitReason.trim()) return alert('Please enter a reason');
    await saveToServer(status, quitReason);
    if (status === 'quit') {
      setShowQuitModal(false);
      setScreen('score');
    } else {
      navigate('/');
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

  const getStyleForCategory = (cat) => {
    if (cat === CATEGORY.SINGLE_LETTER || cat === CATEGORY.DOUBLE_LETTER) return { fontSize: 200, padding: 15 };
    if (cat === CATEGORY.SENTENCE) return { fontSize: 140, padding: 12 };
    if (cat === CATEGORY.STORY) return { fontSize: 74, padding: 10 };
    if (cat === CATEGORY.PARAGRAPH) return { fontSize: 64, padding: 4 };
    return { fontSize: 100, padding: 10 };
  };

  const totalScoreVal = allScores.reduce((sum, s) => sum + s.score, 0);

  return (
    <div className="rs-app">
      <header className="rs-topbar" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <div className="rs-brand">
          <img src="/cel_admin_logo.png" alt="CEL Logo" style={{ height: '36px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))' }} />
        </div>
        <div className="rs-stats">
          {childData?.child_id && (
            <div className="rs-stat-pill"><span className="rs-stat-label">CHILD ID</span> <span className="rs-stat-value">{childData.child_id}</span></div>
          )}
          <div className="rs-stat-pill"><span className="rs-stat-label">SCORE</span> <span className="rs-stat-value">{totalScoreVal}</span></div>
          {screen === 'game' && <button className="btn-pause-quit" onClick={() => setShowQuitModal(true)}><span>⏸</span> Pause/Quit</button>}
        </div>
      </header>

      <main className="rs-main">
        {screen === 'splash' && (
          <div className="rs-screen" style={{ backgroundColor: '#fff' }}>
            <div className="rs-screen-header">
              <div style={{ textAlign: 'center', width: '100%' }}>
                {/* Header text removed as requested */}
              </div>
            </div>
            
            <div className="rs-card rs-splash-card" style={{ border: 'none', boxShadow: 'none', padding: '10px 24px', flex: 'none', minHeight: 'auto' }}>
              <div className="rs-splash-image-wrapper">
                <img src="/assets/images/reading_skill/reading_skill.jpg" alt="Reading Skill" className="rs-splash-image" onError={e => e.target.style.display='none'} />
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '8px', color: '#111827' }}>Welcome to Literacy Test</h2>

              
              <div className="rs-btn-row">
                <button 
                  className={`rs-btn rs-btn-primary ${audioFinished ? 'rs-btn-highlight' : ''}`} 
                  disabled={!audioFinished} 
                  style={{ opacity: !audioFinished ? 0.6 : 1, cursor: !audioFinished ? 'not-allowed' : 'pointer' }}
                  onClick={() => startNewGame()}
                >
                  Start Now
                </button>
                <button className="rs-btn rs-btn-secondary" onClick={() => {
                   if (audioRef.current) {
                     setAudioFinished(false);
                     audioRef.current.currentTime = 0;
                     audioRef.current.play();
                   }
                }}>Replay Audio</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'game' && currentQuestion && (
          <div className="rs-screen" style={{ backgroundColor: '#fff' }}>
            <div className="rs-screen-header">
              <div>
                <div className="rs-screen-title" style={{fontSize: '1.4rem'}}>{currentQuestion.categoryName} ({questionIndex + 1} of {QUESTIONS.length})</div>
              </div>
              <div className="rs-chips">

                <span className="rs-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', display:'inline-flex', alignItems:'center', gap:'4px' }}>
                  ⏱ Timer: {formatTime(qTimer)}
                </span>
              </div>
            </div>

            <div className="rs-card rs-question-card">
              <div className="rs-question-content">
                <div style={{ ...getStyleForCategory(currentQuestion.category), lineHeight: (getStyleForCategory(currentQuestion.category).fontSize + 5) + 'px' }}>
                  {currentQuestion.text}
                </div>
              </div>
            </div>

            { (currentQuestion.category === CATEGORY.STORY || currentQuestion.category === CATEGORY.PARAGRAPH) ? (
              <div className="rs-response-buttons">
                <button className="rs-response-btn rs-btn-done" onClick={handleDoneReading}>
                  Done Reading
                </button>
              </div>
            ) : (
              <div className="rs-response-buttons">
                <button className="rs-response-btn rs-btn-correct" onClick={() => handleManualScoring(true)}>✓ Correct</button>
                <button className="rs-response-btn rs-btn-incorrect" onClick={() => handleManualScoring(false)}>✗ Incorrect</button>
              </div>
            )}
          </div>
        )}

        {screen === 'score' && (
          <div className="rs-screen" style={{ backgroundColor: '#fff' }}>
            <div className="rs-screen-header">
              <div>
                <div className="rs-screen-title">Assessment Complete</div>
                <div className="rs-screen-subtitle">Test finished successfully</div>
              </div>
              <div className="rs-chips">
                <span className="rs-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>Final Results</span>
                <span className="rs-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  Time: {Math.floor(allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) / 60)}m {allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) % 60}s
                </span>
              </div>
            </div>
            
            <div className="rs-card rs-result-card">
              <div className="rs-result-header">
                <h2>{quitReason ? 'Assessment Terminated' : 'Performance'}</h2>
                <p>{quitReason ? `Reason: ${quitReason}` : 'Assessment Completed'}</p>
              </div>

              <div className="rs-score-top">
                <div className="rs-score-dial-container">
                  <div className="rs-score-dial-big">{totalScoreVal}</div>
                  <div className="rs-score-dial-small">/ {allScores.length}</div>
                </div>

                <div className="rs-metric-grid">
                  <div className="rs-metric-box">
                    <label>Total Score</label>
                    <div className="metric-val">{totalScoreVal} / {allScores.length}</div>
                  </div>
                  <div className="rs-metric-box">
                    <label>Correct</label>
                    <div className="metric-val green">{totalScoreVal}</div>
                  </div>
                  <div className="rs-metric-box">
                    <label>Incorrect</label>
                    <div className="metric-val red">{allScores.length - totalScoreVal}</div>
                  </div>
                  <div className="rs-metric-box">
                    <label>Percentage</label>
                    <div className="metric-val">{((totalScoreVal / (allScores.length || 1)) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="rs-metric-box">
                    <label>Total Time</label>
                    <div className="metric-val">
                       {Math.floor(allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) / 60)}m {allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) % 60}s
                    </div>
                  </div>
                  <div className="rs-metric-box">
                    <label>Avg Time/Q</label>
                    <div className="metric-val">{Math.round(allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0) / (allScores.length||1))}s</div>
                  </div>
                </div>
              </div>

              {((totalScoreVal / (allScores.length || 1)) * 100) >= 80 && (
                 <div className="rs-banner">Excellent work! Keep it up! ⭐</div>
              )}

              <div className="rs-accordion-toggle" onClick={() => setShowGrid(!showGrid)}>
                {showGrid ? '▼' : '▶'} Show per-question results with time
              </div>

              {showGrid && (
                <div className="rs-q-grid">
                  {allScores.map((scoreObj, idx) => {
                    const qObj = QUESTIONS.find(q=>q.id === scoreObj.qId);
                    const timeDisp = scoreObj.timeTaken === 0 ? '0s' : scoreObj.timeTaken + 's';
                    return (
                      <div key={idx} className="rs-q-card">
                        <div className="rs-q-top">
                          <span className="rs-q-num">Q{scoreObj.questionNumber}</span>
                          <span className="rs-q-cat">{qObj.categoryName}</span>
                        </div>
                        <div className="rs-q-bottom">
                          <span className="rs-q-time">{timeDisp}</span>
                          <span className={scoreObj.score === 1 ? 'rs-q-icon green' : 'rs-q-icon red'}>{scoreObj.score === 1 ? '✔' : '✖'}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Assessment Form Segment */}
              <div className="rs-assessment-section">
                <h3 className="rs-form-title">Session Assessment Details</h3>
                
                {[
                  { key: 'q1', label: "Q1. Did you enjoy playing the game?" },
                  { key: 'q2', label: "Q2. How did the game feel for you?" },
                  { key: 'q3', label: "Q3. Did you feel tired while playing the game?" },
                  { key: 'q4', label: "Q4. Would you like to play the game again?" }
                ].map((q) => (
                  <div key={q.key} className="rs-q-group">
                    <label className="rs-q-label">{q.label}</label>
                    <div className="rs-radio-row">
                      {[
                        { val: 'Yes, a lot', str: "Yes, a lot" },
                        { val: 'A little', str: "A little" },
                        { val: 'Not much', str: "Not much" }
                      ].map(opt => (
                        <label key={opt.val} className="rs-radio-label">
                          <input type="radio" name={q.key} disabled={assessmentSubmitted} checked={assessment[q.key] === opt.val} onChange={() => setAssessment({...assessment, [q.key]: opt.val})} />
                          {opt.str}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="rs-q-group">
                  <label className="rs-q-label">Q5. Observed Behaviours during the session (Multiple selection allowed)</label>
                  <div className="rs-checkbox-grid">
                    {[
                      { val: 'Difficulty sustaining attention', str: "Difficulty sustaining attention" },
                      { val: 'Impulsive or random responding', str: "Impulsive or random responding" },
                      { val: 'Negative reaction to correction', str: "Negative reaction to correction" },
                      { val: 'Hesitation in responding', str: "Hesitation in responding" },
                      { val: 'High focus or persistence', str: "High focus or persistence" },
                      { val: 'Verbalisation of a memory strategy', str: "Verbalisation of a memory strategy" },
                      { val: 'Needed frequent reassurance', str: "Needed frequent reassurance" },
                      { val: 'Calm and engaged throughout', str: "Calm and engaged throughout" }
                    ].map(bhv => (
                       <label key={bhv.val} className="rs-checkbox-label">
                         <input type="checkbox" disabled={assessmentSubmitted} checked={assessment.behaviors.includes(bhv.val)} onChange={(e) => {
                            if(e.target.checked) setAssessment({...assessment, behaviors:[...assessment.behaviors, bhv.val]});
                            else setAssessment({...assessment, behaviors: assessment.behaviors.filter(b=>b!==bhv.val)});
                         }} />
                         {bhv.str}
                       </label>
                    ))}
                  </div>
                </div>
                
                <div className="rs-q-group">
                   <label className="rs-q-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span>Additional Notes</span>
                     <button 
                       onClick={() => toggleRecording('assessmentNotes')} 
                       style={{ 
                         background: isRecording && recordingTarget === 'assessmentNotes' ? '#fee2e2' : '#eff6ff',
                         color: isRecording && recordingTarget === 'assessmentNotes' ? '#ef4444' : '#2563eb',
                         border: '1px solid',
                         borderColor: isRecording && recordingTarget === 'assessmentNotes' ? '#fca5a5' : '#bfdbfe',
                         padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                       }}>
                       🎙 {isRecording && recordingTarget === 'assessmentNotes' ? "Recording... (Stop)" : "Use Mic"}
                     </button>
                   </label>
                   <textarea className="rs-textarea" rows="3" disabled={assessmentSubmitted} placeholder="Type or dictate observations..." value={assessment.notes} onChange={(e) => setAssessment({...assessment, notes: e.target.value})}></textarea>
                </div>
              </div>

              <div className="rs-final-actions">
                {assessmentSubmitted ? (
                  <>
                    <button onClick={() => { resetInternalState(); setScreen('splash'); }} className="rs-btn rs-btn-primary">↻ Retest</button>
                    <button onClick={() => navigate('/')} className="rs-btn rs-btn-secondary">🏠 Home</button>
                  </>
                ) : (
                  <button onClick={submitAssessmentForm} disabled={isAssessmentSubmitting} className="rs-btn rs-btn-primary" style={{ minWidth: '220px' }}>
                    {isAssessmentSubmitting ? "Saving..." : "Submit Assessment"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {!isCheckingSession && (
        <audio 
          ref={audioRef} 
          src="/assets/audios/reading_skill/splash.wav" 
          preload="auto" 
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {/* Mid-Test Assessment Modal */}
      {showMidTestModal && currentQuestion && (
        <div className="rs-modal-overlay">
          <div className="rs-modal" style={{ maxWidth: '600px' }}>
            <div className="rs-modal-header" style={{ marginBottom: '20px' }}>
              <h3>Assessment</h3>
              <p>Please answer all criteria:</p>
            </div>
            
            <div className="rs-assessment-criteria" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(currentQuestion.assessmentCriteria || []).map((criterion, index) => (
                <div key={index} className={`rs-criterion-row ${midTestAnswers[index] ? 'complete' : ''}`}>
                  <div className="rs-criterion-text">{criterion}</div>
                  <div className="rs-criterion-buttons">
                    <button 
                      className={`rs-criterion-btn rs-btn-yes ${midTestAnswers[index] === 'yes' ? 'selected' : ''}`}
                      onClick={() => setMidTestAnswers({...midTestAnswers, [index]: 'yes'})}
                    >
                      Yes
                    </button>
                    <button 
                      className={`rs-criterion-btn rs-btn-no ${midTestAnswers[index] === 'no' ? 'selected' : ''}`}
                      onClick={() => setMidTestAnswers({...midTestAnswers, [index]: 'no'})}
                    >
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="rs-modal-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <button 
                className="rs-btn rs-btn-primary" 
                disabled={Object.keys(midTestAnswers).length !== (currentQuestion.assessmentCriteria?.length || 0)}
                onClick={handleMidTestAssessmentComplete}
              >
                Finish Assessment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other Modals */}
      {showResumeModal && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <h2>Saved Progress Found</h2>
            <p>You have a previously paused game session.</p>
            <div className="rs-btn-row" style={{marginTop:'20px'}}>
              <button className="rs-btn rs-btn-secondary" onClick={() => { setShowResumeModal(false); resetInternalState(); setScreen('splash'); }}>Restart Fresh</button>
              <button className="rs-btn rs-btn-primary" onClick={resumeGame}>Resume Game</button>
            </div>
          </div>
        </div>
      )}

      {showQuitModal && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <h2>Pause or Quit</h2>
            <p>Why are you stopping the game?</p>
            
            <div style={{ position: 'relative' }}>
              <textarea 
                placeholder="E.g., Child is tired, disconnected, etc."
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

            <div className="rs-btn-row">
              <button className="rs-btn rs-btn-secondary" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem'}} onClick={() => setShowQuitModal(false)}>Cancel</button>
              <button className="rs-btn" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', background:'#fef08a', color:'#854d0e'}} onClick={() => handleQuit('paused')}>Pause & Save</button>
              <button className="rs-btn rs-btn-incorrect" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem'}} onClick={() => handleQuit('quit')}>Quit & End</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReadingSkillGame;
