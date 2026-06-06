import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
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
  MIN_CORRECT_SENTENCE: 1,
  TOTAL_SINGLE: 10,
  TOTAL_DOUBLE: 8,
  TOTAL_SENTENCE: 2
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
    assessmentCriteria: ["skipWords", "pronunciation", "neededHelp"]
  },
  { 
    id: 22, order: 22, category: CATEGORY.PARAGRAPH, 
    text: "भारत एक विशाल देश है। यहाँ विभिन्न संस्कृतियाँ और भाषाएँ हैं। हमारे देश में अनेक त्योहार मनाए जाते हैं। दिवाली, होली, ईद और क्रिसमस प्रमुख त्योहार हैं। सभी लोग मिलजुलकर रहते हैं। हमें अपने देश पर गर्व है।", 
    categoryName: "Paragraph",
    assessmentCriteria: ["skipWords", "pronunciation", "neededHelp"]
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
  const [attemptNo, setAttemptNo] = useState(1);
  
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [pauses, setPauses] = useState([]);
  
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [dropReason, setDropReason] = useState('');
  const [audioFinished, setAudioFinished] = useState(false);
  
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  const [qTimer, setQTimer] = useState(0);

  // Mid-test Assessment Modal
  const [showMidTestModal, setShowMidTestModal] = useState(false);
  const [midTestAnswers, setMidTestAnswers] = useState({});

  // Final Assessment Form State
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState({});
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
        const info = res.data.sessionInfo;
        const resumable = ['in_progress', 'paused'];
        // Only offer resume for genuinely incomplete sessions; ignore completed/dropped/quit ones
        if (resumable.includes(info.status) && !info.saved_state?.assessmentSubmitted) {
          setResumeData(info);
          setShowResumeModal(true);
        }
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
    setAssessmentSubmitted(false);
    setAudioFinished(false);
    setQuitReason('');
    setDropReason('');
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
  }, [screen, showQuitModal, showMidTestModal, questionIndex]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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

  const saveToServer = async (statusOverride = null, reason = null) => {
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

  // ── PDF Generation & Upload ───────────────────────────────────
  const generateAndUploadPDF = async () => {
    try {
      const element = document.getElementById('dashboard-capture-area');
      if (!element) return;
      
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, { 
        scale: 1.5, 
        useCORS: true,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
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
      formData.append('pdf', pdfBlob, `${childNameSafe}_ReadingSkill_SES${gameSessionId}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', gameSessionId);
      formData.append('game_name', 'literacy_reading_skill');
      
      await axios.post(`${API_URL}/games/pdfs/upload`, formData);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    }
  };

  const processScoring = (score, ssrAnswers = null) => {
    const q = QUESTIONS[questionIndex];
    const newScoreRec = {
      qId: q.id,
      questionNumber: questionIndex + 1,
      score: score,
      timeTaken: qTimer,
      ssrAnswers: ssrAnswers
    };

    const upScores = [...allScores, newScoreRec];
    setAllScores(upScores);

    let shouldDrop = false;
    let localDropReason = '';

    // Single Letter Drop: < 4 correct out of 10
    if (upScores.length === RULES.TOTAL_SINGLE) {
      const correct = upScores.slice(0, RULES.TOTAL_SINGLE).filter(s => s.score === 1).length;
      if (correct < RULES.MIN_CORRECT_SINGLE) {
        shouldDrop = true;
        localDropReason = `Single Letter Drop: ${correct}/${RULES.TOTAL_SINGLE} correct (minimum ${RULES.MIN_CORRECT_SINGLE} required).`;
      }
    }

    // Double Letter Drop: < 4 correct out of 8
    const totalDoubleSoFar = RULES.TOTAL_SINGLE + RULES.TOTAL_DOUBLE;
    if (!shouldDrop && upScores.length === totalDoubleSoFar) {
      const correct = upScores.slice(RULES.TOTAL_SINGLE, totalDoubleSoFar).filter(s => s.score === 1).length;
      if (correct < RULES.MIN_CORRECT_DOUBLE) {
        shouldDrop = true;
        localDropReason = `Double Letter Drop: ${correct}/${RULES.TOTAL_DOUBLE} correct (minimum ${RULES.MIN_CORRECT_DOUBLE} required).`;
      }
    }

    // Sentence Drop: 0 correct out of 2
    const totalSentenceSoFar = RULES.TOTAL_SINGLE + RULES.TOTAL_DOUBLE + RULES.TOTAL_SENTENCE;
    if (!shouldDrop && upScores.length === totalSentenceSoFar) {
      const sentenceScores = upScores.slice(RULES.TOTAL_SINGLE + RULES.TOTAL_DOUBLE, totalSentenceSoFar);
      const correct = sentenceScores.filter(s => s.score === 1).length;
      if (correct < RULES.MIN_CORRECT_SENTENCE) {
        shouldDrop = true;
        localDropReason = `Sentence Category Drop: ${correct}/${RULES.TOTAL_SENTENCE} correct — at least ${RULES.MIN_CORRECT_SENTENCE} correct answer required to continue.`;
      }
    }

    // Story / Paragraph Drop: score = 0
    if (!shouldDrop && (q.category === CATEGORY.STORY || q.category === CATEGORY.PARAGRAPH)) {
      if (score === 0) {
        shouldDrop = true;
        localDropReason = `${q.categoryName} Drop: Score 0 — child did not meet reading criteria.`;
      }
    }

    if (localDropReason) setDropReason(localDropReason);

    if (shouldDrop || questionIndex + 1 >= QUESTIONS.length) {
      setScreen('score');
      if (gameSessionId) {
        const finalStatus = localDropReason ? 'dropped' : 'completed';
        axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
          score: upScores.reduce((sum, s) => sum + s.score, 0),
          progress_level: questionIndex + 1,
          status: finalStatus,
          quit_reason: localDropReason || null,
          saved_state: { questionIndex: questionIndex + 1, allScores: upScores, timerSeconds, qTimer, pauses }
        }).then(() => {
          setTimeout(generateAndUploadPDF, 1500);
        }).catch(e => console.log(e));
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
    // Scoring Rules (Updated): 
    // ANY "Yes" = 0.0
    // ALL "No" = 1.0
    const answers = Object.values(midTestAnswers);
    const yesCount = answers.filter(val => val === 'yes').length;
    const finalScore = (yesCount > 0) ? 0 : 1;
    
    setShowMidTestModal(false);
    processScoring(finalScore, midTestAnswers);
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

  const submitAssessmentForm = async () => {
    setIsAssessmentSubmitting(true);
    try {
      // 1. Submit the assessment form
      await axios.post(`${API_URL}/games/assessments`, {
        session_id: gameSessionId,
        child_id: childData.child_id,
        q1_enjoyment: assessment.q1,
        q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3,
        q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors,
        additional_notes: (assessment.notes || '') + (dropReason ? `\n[Drop Reason: ${dropReason}]` : '')
      });

      // 2. Guarantee the session is marked completed in the DB so the admin panel
      //    reflects the final state and the resume popup never shows again.
      if (gameSessionId) {
        const finalStatus = dropReason ? 'dropped' : quitReason ? 'quit' : 'completed';
        await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
          score: allScores.reduce((acc, s) => acc + s.score, 0),
          progress_level: allScores.length,
          status: finalStatus,
          quit_reason: dropReason || quitReason || null,
          saved_state: {
            questionIndex: allScores.length,
            allScores,
            timerSeconds,
            qTimer,
            pauses,
            assessmentSubmitted: true  // prevents resume popup on next visit
          }
        });
      }

      setAssessmentSubmitted(true);
      setTimeout(generateAndUploadPDF, 1000);
    } catch(e) {
      console.error(e);
      alert(t('common.failedToSave'));
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const currentQuestion = QUESTIONS[questionIndex];

  const getCategoryName = (name) => {
    const map = {
      'Single Letter': t('game.categories.singleLetter'),
      'Double Letter': t('game.categories.doubleLetter'),
      'Sentence': t('game.categories.sentence'),
      'Story': t('game.categories.story'),
      'Paragraph': t('game.categories.paragraph'),
    };
    return map[name] || name;
  };

  const getStyleForCategory = (cat) => {
    if (cat === CATEGORY.SINGLE_LETTER || cat === CATEGORY.DOUBLE_LETTER) return { fontSize: 200, padding: 15 };
    if (cat === CATEGORY.SENTENCE) return { fontSize: 140, padding: 12 };
    if (cat === CATEGORY.STORY) return { fontSize: 74, padding: 10 };
    if (cat === CATEGORY.PARAGRAPH) return { fontSize: 64, padding: 4 };
    return { fontSize: 100, padding: 10 };
  };

  const totalScoreVal = allScores.reduce((sum, s) => sum + s.score, 0);
  const totalQuestionsCount = QUESTIONS.length;
  const attemptedCount = allScores.length;
  const skippedCount = totalQuestionsCount - attemptedCount;
  const incorrectCount = attemptedCount - totalScoreVal;
  const accuracyPercent = ((totalScoreVal / totalQuestionsCount) * 100).toFixed(1);
  const totalTimeSeconds = allScores.reduce((acc, s)=>acc+ (s.timeTaken||0), 0);
  const totalTimeDisp = `${Math.floor(totalTimeSeconds / 60)}m ${totalTimeSeconds % 60}s`;
  const avgTimePerQuestion = Math.round(totalTimeSeconds / (attemptedCount || 1)) + 's';

  return (
    <div className="rs-app">
      <header className="rs-topbar" style={{ borderBottom: '1px solid #f1f5f9' }}>
        <div className="rs-brand">
          <img src="/cel_admin_logo.png" alt="CEL Logo" className="rs-brand-img" />
          <div className="rs-divider"></div>
          <img src="/assets/images/reading_skill/reading_skill.jpg" alt="Reading Skill" className="rs-test-logo" />
          <span className="rs-test-title">{t('home.games.literacy.title')}</span>
        </div>
        <div className="rs-stats">
          {childData?.child_id && (
            <div className="rs-stat-pill"><span className="rs-stat-label">{t('game.childId')}</span> <span className="rs-stat-value">{childData.child_id}</span></div>
          )}
          <div className="rs-stat-pill"><span className="rs-stat-label">{t('game.score')}</span> <span className="rs-stat-value">{totalScoreVal}</span></div>
          {screen === 'game' && <button className="btn-pause-quit" onClick={() => { setQuitReason(''); setShowQuitModal(true); }}><span>⏸</span> {t('game.pauseQuit')}</button>}
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
                <img src="/assets/images/reading_skill/reading_skill.jpg" alt="Padh ke batao" className="rs-splash-image" onError={e => e.target.style.display='none'} />
              </div>
              <h2 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '25px', color: '#1e293b', letterSpacing: '-0.02em' }}>
                {t('game.welcomeLiteracy')}
              </h2>


              <div className="rs-btn-row">
                <button
                  className={`rs-btn rs-btn-primary ${audioFinished ? 'rs-btn-highlight' : ''}`}
                  disabled={!audioFinished}
                  style={{ opacity: !audioFinished ? 0.6 : 1, cursor: !audioFinished ? 'not-allowed' : 'pointer' }}
                  onClick={() => startNewGame()}
                >
                  {t('game.startNow')}
                </button>
                <button className="rs-btn rs-btn-secondary" onClick={() => {
                   if (audioRef.current) {
                     setAudioFinished(false);
                     audioRef.current.currentTime = 0;
                     audioRef.current.play().catch(() => setAudioFinished(true));
                   }
                }}>{t('game.replayAudio')}</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'game' && currentQuestion && (
          <div className="rs-screen" style={{ backgroundColor: '#fff' }}>
            <div className="rs-screen-header">
              <div>
                <div className="rs-screen-title" style={{fontSize: '1.4rem'}}>{getCategoryName(currentQuestion.categoryName)} ({questionIndex + 1} {t('game.of')} {QUESTIONS.length})</div>
              </div>
              <div className="rs-chips">

                <span className="rs-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', display:'inline-flex', alignItems:'center', gap:'4px' }}>
                  {t('game.timerLabel')} {formatTime(qTimer)}
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
                  {t('game.doneReading')}
                </button>
              </div>
            ) : (
              <div className="rs-response-buttons">
                <button className="rs-response-btn rs-btn-correct" onClick={() => handleManualScoring(true)}>✓ {t('game.correct2')}</button>
                <button className="rs-response-btn rs-btn-incorrect" onClick={() => handleManualScoring(false)}>✗ {t('game.incorrect2')}</button>
              </div>
            )}
          </div>
        )}

        {screen === 'score' && (
          <div className="rs-screen" id="dashboard-capture-area" style={{ backgroundColor: '#fff', padding: '20px' }}>
            <div className="rs-screen-header">
              <div>
                <div className="rs-screen-title">
                  {dropReason ? t('game.sessionDropped') : quitReason ? t('game.sessionTerminatedPartial') : t('game.assessmentComplete')}
                </div>
                <div className="rs-screen-subtitle">
                  {dropReason ? dropReason : quitReason ? `${t('game.assessorStopped')} ${quitReason}` : t('game.testFinished')}
                </div>
              </div>
              <div className="rs-chips">
                <span className="rs-chip" style={{ color: '#fff', background: '#4f46e5', border: '1px solid #4338ca' }}>{t('game.attemptLabel')}{attemptNo}</span>
                {dropReason
                  ? <span className="rs-chip" style={{ color: '#fff', background: '#dc2626', border: '1px solid #b91c1c' }}>{t('game.droppedChip')}</span>
                  : <span className="rs-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>{t('game.finalResults')}</span>
                }
                <span className="rs-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  {t('game.timeChip')} {totalTimeDisp}
                </span>
              </div>
            </div>

            <div className="rs-card rs-result-card">
              <div className="rs-score-top">
                <div className="rs-score-dial-container">
                  <div className="rs-score-dial-big">{totalScoreVal}</div>
                  <div className="rs-score-dial-small">/ {totalQuestionsCount}</div>
                </div>

                <div className="rs-metric-grid">
                  <div className="rs-metric-box">
                    <label>{t('game.totalScore')}</label>
                    <div className="metric-val">{totalScoreVal} / {totalQuestionsCount}</div>
                  </div>
                  <div className="rs-metric-box">
                    <label>{t('game.correct2')}</label>
                    <div className="metric-val green">{totalScoreVal}</div>
                  </div>
                  <div className="rs-metric-box">
                    <label>{t('game.incorrect2')}</label>
                    <div className="metric-val red">{incorrectCount}</div>
                  </div>
                  <div className="rs-metric-box">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {t('game.percentage')} <span className="kpi-formula-icon" data-tooltip="Correct Answers ÷ Total Attempted × 100">ⓘ</span>
                    </label>
                    <div className="metric-val">{accuracyPercent}%</div>
                  </div>
                  <div className="rs-metric-box">
                    <label>{t('game.totalTime')}</label>
                    <div className="metric-val">{totalTimeDisp}</div>
                  </div>
                  <div className="rs-metric-box">
                    <label>{t('game.avgTimeQ')}</label>
                    <div className="metric-val">{avgTimePerQuestion}</div>
                  </div>
                </div>
              </div>

              <div className="rs-table-container" style={{ marginTop: '0', boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                  <div className="rs-table-responsive">
                    <table className="rs-data-table">
                      <thead>
                        <tr>
                          <th>{t('game.questionNo')}</th>
                          <th>{t('game.questionImage')}</th>
                          <th>{t('game.questionType')}</th>
                          <th>{t('game.scoreTable.question')}</th>
                          <th>{t('game.scoreTable.correctAnswer')}</th>
                          <th>{t('game.scoreTable.score')}</th>
                          <th>{t('game.scoreTable.timeTaken')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {QUESTIONS.filter(q => allScores.some(s => s.qId === q.id)).map((q, idx) => {
                          const scoreObj = allScores.find(s => s.qId === q.id);
                          const hasSSR = q.category === CATEGORY.STORY || q.category === CATEGORY.PARAGRAPH;

                          return (
                            <React.Fragment key={q.id}>
                              <tr style={{ cursor: 'default' }}>
                                <td>{idx + 1}</td>
                                <td><span className="q-no-image">No Image</span></td>
                                <td>{getCategoryName(q.categoryName)}</td>
                                <td className="col-text" title={q.text}>{q.text}</td>
                                <td>{hasSSR ? t('game.allCriteriaMet') : q.text}</td>
                                <td style={{ fontWeight: 'bold' }}>{scoreObj.score}</td>
                                <td>{scoreObj.timeTaken}s</td>
                              </tr>
                              {hasSSR && (
                                <tr>
                                  <td colSpan="7" style={{ padding: '0', backgroundColor: '#f8fafc' }}>
                                    <div style={{ padding: '15px 30px' }}>
                                      <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>{t('game.ssrQuestion')}</th>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>{t('game.userAnswer')}</th>
                                            <th style={{ textAlign: 'left', padding: '8px' }}>{t('game.scoreTable.correctAnswer')}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(q.assessmentCriteria || []).map((criterion, cIdx) => {
                                            const answer = scoreObj.ssrAnswers?.[cIdx] || '—';
                                            return (
                                              <tr key={cIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '8px' }}>{t(`game.readingCriteria.${criterion}`)}</td>
                                                <td style={{ padding: '8px', textTransform: 'capitalize' }}>{answer}</td>
                                                <td style={{ padding: '8px' }}>{t('game.noLabel')}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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
                  <button onClick={() => { resetInternalState(); setScreen('splash'); }} className="rs-btn rs-btn-primary">{t('game.retest')}</button>
                  <button onClick={() => navigate('/')} className="rs-btn rs-btn-secondary">{t('game.home')}</button>
                </>
              </SessionAssessmentForm>
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
              <h3>{t('game.assessmentLabel')}</h3>
              <p>{t('game.assessmentComplete')}</p>
            </div>
            
            <div className="rs-assessment-criteria" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(currentQuestion.assessmentCriteria || []).map((criterion, index) => (
                <div key={index} className={`rs-criterion-row ${midTestAnswers[index] ? 'complete' : ''}`}>
                  <div className="rs-criterion-text">{t(`game.readingCriteria.${criterion}`)}</div>
                  <div className="rs-criterion-buttons">
                    <button
                      className={`rs-criterion-btn rs-btn-yes ${midTestAnswers[index] === 'yes' ? 'selected' : ''}`}
                      onClick={() => setMidTestAnswers({...midTestAnswers, [index]: 'yes'})}
                    >
                      {t('game.yesLabel')}
                    </button>
                    <button
                      className={`rs-criterion-btn rs-btn-no ${midTestAnswers[index] === 'no' ? 'selected' : ''}`}
                      onClick={() => setMidTestAnswers({...midTestAnswers, [index]: 'no'})}
                    >
                      {t('game.noLabel')}
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
                {t('game.finishAssessment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other Modals */}
      {showResumeModal && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <h2>{t('game.progressFound')}</h2>
            <p>{t('game.progressDesc')}</p>
            <div className="rs-btn-row" style={{marginTop:'20px'}}>
              <button className="rs-btn rs-btn-secondary" onClick={() => { setShowResumeModal(false); resetInternalState(); setScreen('splash'); }}>{t('game.restartFresh')}</button>
              <button className="rs-btn rs-btn-primary" onClick={resumeGame}>{t('game.resumeGame')}</button>
            </div>
          </div>
        </div>
      )}

      {showQuitModal && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <h2>{t('game.pauseQuitTitle')}</h2>
            <p>{t('game.pauseDesc')}</p>
            
            <div style={{ position: 'relative' }}>
              <textarea 
                {...{placeholder: t('game.pausePlaceholder')}}
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
              <button className="rs-btn rs-btn-secondary" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem'}} onClick={() => setShowQuitModal(false)}>{t('game.cancel')}</button>
              <button className="rs-btn" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', background:'#fef08a', color:'#854d0e'}} onClick={() => handleQuit('paused')}>{t('game.pauseSave')}</button>
              <button className="rs-btn rs-btn-incorrect" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem'}} onClick={() => handleQuit('quit')}>{t('game.quitEnd')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReadingSkillGame;
