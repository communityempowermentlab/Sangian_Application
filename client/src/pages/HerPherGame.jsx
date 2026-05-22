// ============================================================
// HerPherGame.jsx — Her Pher
// React port of the standalone her_pher.js game.
// Integrated with child ID (localStorage) + backend API.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { API_URL } from '../services/api';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import './HerPherGame.css';

// ─── Constants ─────────────────────────────────────────────────────────────────
const GAME_NAME     = 'working_memory_herpher';
const AUDIO_PATH    = '/assets/audios/her_pher';
const IMAGE_PATH    = '/assets/images/her_pher/items';
const MAX_POSITIONS = 15;
const IMAGE_SIZE    = 200;
const GRID_COLS     = 5;
const GRID_ROWS     = 3;  // eslint-disable-line no-unused-vars
const GRID_OFFSET_X = 12;
const GRID_OFFSET_Y = 10;
const GRID_WIDTH    = 1024;
const GRID_HEIGHT_3 = 620;
const GRID_HEIGHT_2 = 420;

// ─── Helpers ────────────────────────────────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const randomPick = (pool, count) => shuffle(pool).slice(0, count);

const formatTime = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const getSP = (age) => {
  if (age >= 3 && age <= 6) return '5-1';
  if (age >= 7 && age <= 12) return '5-4';
  return '—';
};

// ─── Position Maps & Grid ───────────────────────────────────────────────────────
const POSITION_MAPS = {
  6:  [2, 3, 4, 7, 8, 9],
  7:  [2, 3, 4, 7, 8, 9, 13],
  8:  [2, 3, 4, 7, 8, 9, 12, 13],
  9:  [1, 2, 3, 4, 7, 8, 9, 12, 13],
  10: [1, 2, 3, 4, 5, 7, 8, 9, 12, 13],
  11: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13],
  12: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13],
  13: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  14: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
};

function generateAllPositions() {
  const positions = [];
  for (let i = 0; i < MAX_POSITIONS; i++) {
    const x = (i % GRID_COLS) * IMAGE_SIZE + GRID_OFFSET_X;
    const y = Math.floor(i / GRID_COLS) * IMAGE_SIZE + GRID_OFFSET_Y;
    positions.push({ x, y, index: i + 1 });
  }
  return positions;
}

function getPositionsForCount(count) {
  const all = generateAllPositions();
  const indices = POSITION_MAPS[count] || [];
  return indices.map(idx => all[idx - 1]);
}

// ─── Game Data ──────────────────────────────────────────────────────────────────
// Built once at module load so image selections are fixed per page load.
// Question numbering: 1=Sample, 2–9=Scored Questions 1–8
function buildGameData() {
  const r = (pool, n) => randomPick(pool, n);
  const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
  return {
    1: { questionOrder: 1, isSample: true,  imageCount: 6,  category: 'tools',     imageIds: r(range(14), 6)  },
    2: { questionOrder: 2, isSample: false, imageCount: 7,  category: 'birds',     imageIds: r(range(10), 7)  },
    3: { questionOrder: 3, isSample: false, imageCount: 8,  category: 'vegetables',imageIds: r(range(10), 8)  },
    4: { questionOrder: 4, isSample: false, imageCount: 9,  category: 'sports',    imageIds: r(range(14), 9)  },
    5: { questionOrder: 5, isSample: false, imageCount: 10, category: 'flowers',   imageIds: range(10)        },
    6: { questionOrder: 6, isSample: false, imageCount: 11, category: 'insects',   imageIds: range(11)        },
    7: { questionOrder: 7, isSample: false, imageCount: 12, category: 'household', imageIds: r(range(14), 12) },
    8: { questionOrder: 8, isSample: false, imageCount: 13, category: 'animals',   imageIds: r(range(14), 13) },
    9: { questionOrder: 9, isSample: false, imageCount: 13, category: 'transport', imageIds: r(range(14), 13) },
  };
}

// Scoring rules: for each scored question (key = question slot 2–9)
// value = { maxCorrect: pts, maxCorrect-1: pts }
const SCORING_RULES = {
  2: { 7: 2, 6: 1 },                 // Q1 (7 img)
  3: { 8: 2, 7: 1 },                 // Q2 (8 img)
  4: { 9: 3, 8: 2, 7: 1 },           // Q3 (9 img)
  5: { 10: 3, 9: 2, 8: 1 },          // Q4 (10 img)
  6: { 11: 3, 10: 2, 9: 1 },         // Q5 (11 img)
  7: { 12: 4, 11: 3, 10: 2, 9: 1 },  // Q6 (12 img)
  8: { 13: 4, 12: 3, 11: 2, 10: 1 }, // Q7 (13 img)
  9: { 13: 4, 12: 3, 11: 2, 10: 1 }, // Q8 (13 img)
};

function getPerformanceInterpretation(s) {
  if (s >= 20) return 'Excellent';
  if (s >= 15) return 'Good';
  if (s >= 10) return 'Average';
  return 'Needs Improvement';
}

function calcScore(questionNum, correctCount) {
  if (questionNum === 1) return 0; // sample
  const rule = SCORING_RULES[questionNum] || {};
  return rule[correctCount] || 0;
}

// ─── Main Component ─────────────────────────────────────────────────────────────
const HerPherGame = () => {
  const { t }       = useLanguage();
  const navigate    = useNavigate();
  const [activityData, setActivityData] = useState({ lastPlayed: 'Never', attempts: 0 });
  const [GAME_DATA, setGAME_DATA] = useState(() => buildGameData()); // stable per session

  // Child data
  const [childData, setChildData]         = useState(null);
  const [attemptNo, setAttemptNo]         = useState(1);
  const [gameSessionId, setGameSessionId] = useState(null);

  // Screen: 'splash' | 'game' | 'score'
  const [screen, setScreen]               = useState('splash');

  // Game progress
  const [currentQuestion, setCurrentQuestion]   = useState(1); // 1–9
  const [currentAttempt, setCurrentAttempt]     = useState(1); // 1 or 2
  const [scoreHistory, setScoreHistory]         = useState([]); // per attempt records
  const [totalScore, setTotalScore]             = useState(0);
  const [totalTime, setTotalTime]               = useState(0);

  // Per-question state
  const [clickedImages, setClickedImages]       = useState(new Set());
  const [responses, setResponses]               = useState([]);     // array of 0|1
  const [selectedOrder, setSelectedOrder]       = useState([]);     // imageIds in order
  const [imageLayout, setImageLayout]           = useState([]);     // { imageId, x, y }
  const [questionTime, setQuestionTime]         = useState(0);      // seconds this attempt
  const [showControls, setShowControls]         = useState(false);  // sample retake/next
  const [buttonsDisabled, setButtonsDisabled]   = useState(false);
  const [shuffleInProgress, setShuffleInProgress] = useState(false);

  // Splash audio
  const [audioFinished, setAudioFinished]       = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Session
  const gameSessionIdRef = useRef(null);

  // Modals
  const [showResumeModal, setShowResumeModal]   = useState(false);
  const [resumeData, setResumeData]             = useState(null);
  const [showQuitModal, setShowQuitModal]       = useState(false);
  const [quitReason, setQuitReason]             = useState('');
  const [pauses, setPauses]                     = useState([]);
  const pausesRef = useRef([]);

  // Score screen
  const [showGrid, setShowGrid]                 = useState(false);
  const [assessment, setAssessment]             = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted]   = useState(false);

  // STT
  const [isRecording, setIsRecording]           = useState(false);
  const [recordingTarget, setRecordingTarget]   = useState(null);

  // Timers
  const timerRef       = useRef(null);
  const audioSplashRef = useRef(null);
  const isResumingRef  = useRef(false);

  // ──── Init: load child from localStorage ────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('currentChild');
    if (!raw) { navigate('/login'); return; }
    const child = JSON.parse(raw);
    setChildData(child);
    checkResume(child.child_id);
    fetchActivity(child.child_id);
  }, [navigate]); // eslint-disable-line

  const fetchActivity = async (cid) => {
    try {
      const res = await axios.get(`${API_URL}/games/sessions/summaries/${cid}`);
      if (res.data.success) {
        const summary = res.data.summaries.find(s => s.game_name === GAME_NAME);
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

  // ──── Splash audio autoplay ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && audioSplashRef.current && !audioFinished) {
      audioSplashRef.current.currentTime = 0;
      audioSplashRef.current.play().catch(() => setAudioFinished(true));
    }
  }, [isCheckingSession, screen, showResumeModal, audioFinished]);

  // ──── Question timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'game' && !showQuitModal) {
      timerRef.current = setInterval(() => setQuestionTime(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, showQuitModal, currentQuestion, currentAttempt]);

  // ──── Sync ref ───────────────────────────────────────────────────────────────
  useEffect(() => { gameSessionIdRef.current = gameSessionId; }, [gameSessionId]);
  useEffect(() => { pausesRef.current = pauses; }, [pauses]);

  // ──── Build image layout when question/attempt changes ───────────────────────
  useEffect(() => {
    if (screen !== 'game') return;
    
    // Prevent reset if we are resuming an exact paused state
    if (isResumingRef.current) {
      // We keep the ref true until the screen has fully transitioned to 'game'
      // and the state has settled. The first execution that sees screen==='game'
      // will clear it.
      isResumingRef.current = false;
      return;
    }

    const qData = GAME_DATA[currentQuestion];
    const positions = shuffle(getPositionsForCount(qData.imageCount));
    const layout = qData.imageIds.map((imageId, i) => ({
      imageId,
      x: positions[i].x,
      y: positions[i].y,
    }));
    setImageLayout(layout);
    setClickedImages(new Set());
    setResponses([]);
    setSelectedOrder([]);
    setQuestionTime(0);
    setShowControls(false);
    setButtonsDisabled(false);
  }, [screen, currentQuestion, currentAttempt]); // eslint-disable-line

  // ──── API: Check Resume ──────────────────────────────────────────────────────
  const checkResume = async (childId) => {
    setIsCheckingSession(true);
    try {
      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/${GAME_NAME}`);
      if (res.data.sessionInfo) {
        setResumeData(res.data.sessionInfo);
        setShowResumeModal(true);
      }
    } catch (e) {
      console.error('Resume check error', e);
    } finally {
      setIsCheckingSession(false);
    }
  };

  // ──── API: Start new session ──────────────────────────────────────────────────
  const startNewGame = async () => {
    try {
      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childData.child_id,
        game_name: GAME_NAME,
        total_questions: 8, // 8 scored
      });
      setGameSessionId(res.data.sessionId);
      setAttemptNo(res.data.attempt_no || 1);
    } catch (e) {
      console.error('Start session failed', e);
    }
    resetGameState();
    setScreen('game');
  };

  // ──── Resume session ─────────────────────────────────────────────────────────
  const resumeGame = () => {
    setGameSessionId(resumeData.id);
    setAttemptNo(resumeData.attempt_no || 1);
    const saved = resumeData.saved_state || {};
    
    if (saved.gameData) {
      setGAME_DATA(saved.gameData);
    }
    
    setCurrentQuestion(saved.currentQuestion || 1);
    setCurrentAttempt(saved.currentAttempt || 1);
    setScoreHistory(saved.scoreHistory || []);
    setTotalScore(saved.totalScore || 0);
    setTotalTime(saved.totalTime || 0);
    setPauses(saved.pauses || []);
    
    if (saved.imageLayout) {
      isResumingRef.current = true;
      setImageLayout(saved.imageLayout);
      setClickedImages(new Set(saved.clickedImages || []));
      setResponses(saved.responses || []);
      setSelectedOrder(saved.selectedOrder || []);
      setQuestionTime(saved.questionTime || 0);
    }
    
    setScreen('game');
    setShowResumeModal(false);
  };

  const resetGameState = () => {
    setCurrentQuestion(1);
    setCurrentAttempt(1);
    setScoreHistory([]);
    setTotalScore(0);
    setTotalTime(0);
    setPauses([]);
    setAssessmentSubmitted(false);
    setQuitReason('');
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  };

  // ──── API: Save progress ─────────────────────────────────────────────────────
  const saveToServer = useCallback(async (statusOverride, reason, extraState = {}) => {
    const sessId = gameSessionIdRef.current;
    if (!sessId) return;
    try {
      let updatedPauses = [...pausesRef.current];
      if (reason && (statusOverride === 'paused' || statusOverride === 'quit')) {
        updatedPauses.push({ questionNumber: currentQuestion, attempt: currentAttempt, reason, timestamp: new Date().toISOString() });
        setPauses(updatedPauses);
        pausesRef.current = updatedPauses;
      }
      await axios.put(`${API_URL}/games/sessions/update/${sessId}`, {
        score: totalScore + (extraState.bonusScore || 0),
        progress_level: currentQuestion,
        status: statusOverride || 'in_progress',
        quit_reason: reason || null,
        saved_state: {
          currentQuestion, currentAttempt, scoreHistory, totalScore,
          totalTime, pauses: updatedPauses,
          
          // Current Attempt State
          clickedImages: Array.from(clickedImages),
          responses,
          selectedOrder,
          questionTime,
          imageLayout,
          gameData: GAME_DATA,
          
          allScores: scoreHistory.map(h => ({
            qId: h.question,
            score: h.score,
            timeTaken: h.time,
            correctCount: h.correctCount,
            expectedImages: h.expectedImages,
            selectedImages: h.selected,
            matchedImages: h.matchedImages,
            incorrectSelections: h.incorrectSelections,
            missedImages: h.missedImages,
            category: h.category
          })),
          ...extraState,
        },
      });
    } catch (e) { console.error('Save to server error', e); }
  }, [currentQuestion, currentAttempt, scoreHistory, totalScore, totalTime, clickedImages, responses, selectedOrder, questionTime, imageLayout, GAME_DATA]); 


  // ──── Image click handler ────────────────────────────────────────────────────
  const handleImageClick = useCallback((imageId) => {
    if (buttonsDisabled) return;

    // Lock interactions immediately
    setButtonsDisabled(true);

    const isNew = !clickedImages.has(imageId);
    const newClicked = new Set(clickedImages);
    newClicked.add(imageId);
    const newSelected = [...selectedOrder, imageId];
    const newResponses = [...responses, isNew ? 1 : 0];

    setClickedImages(newClicked);
    setSelectedOrder(newSelected);
    setResponses(newResponses);

    // Play touch sound
    new Audio(`${AUDIO_PATH}/touch.wav`).play().catch(() => {});

    // Update layout class for clicked button — done via state
    const qData = GAME_DATA[currentQuestion];

    if (newSelected.length >= qData.imageCount) {
      // All clicked — complete question
      clearInterval(timerRef.current);
      finishQuestion(newResponses, newSelected, qData);
    } else {
      // 1. Pause briefly then trigger visual scale-down "shuffle mode" state
      setTimeout(() => {
        setShuffleInProgress(true);
        
        // 2. Wait for scale-down animation to near completion before shuffling
        setTimeout(() => {
          setImageLayout(prev => {
            const positions = shuffle(getPositionsForCount(qData.imageCount));
            return prev.map((item, i) => ({ ...item, x: positions[i].x, y: positions[i].y }));
          });
          
          // 3. Wait for layout movement to bounce/settle
          setTimeout(() => {
            setShuffleInProgress(false);
            
            // 4. Finally release locks after scale-up concludes
            setTimeout(() => {
              setButtonsDisabled(false);
            }, 300);
          }, 600);
        }, 200);
      }, 150);
    }
  }, [buttonsDisabled, clickedImages, selectedOrder, responses, currentQuestion, GAME_DATA]); // eslint-disable-line

  // ──── Finish question attempt ────────────────────────────────────────────────
  const finishQuestion = useCallback((resp, sel, qData) => {
    const correctCount = resp.filter(v => v === 1).length;
    const questionScore = calcScore(currentQuestion, correctCount);
    
    // Detailed Match Analysis
    const expected = qData.imageIds;
    const matched = [];
    const incorrect = [];
    const seen = new Set();
    sel.forEach((id) => {
      if (!seen.has(id)) {
        seen.add(id);
        matched.push(id);
      } else {
        incorrect.push(id);
      }
    });
    const missed = expected.filter(id => !seen.has(id));

    const record = {
      question: currentQuestion,
      attempt: currentAttempt,
      selected: sel,
      responses: resp,
      correctCount,
      score: questionScore,
      time: questionTime,
      isSample: qData.isSample,
      category: qData.category,
      expectedImages: expected,
      matchedImages: matched,
      incorrectSelections: incorrect,
      missedImages: missed
    };

    setScoreHistory(prev => {
      const updated = [...prev, record];
      // Save to server after scoring (fire-and-forget)
      if (currentAttempt === 2 && !qData.isSample) {
        // Will be handled in moveNext via saveToServer
      }
      return updated;
    });
    setTotalTime(t => t + questionTime);

    if (currentAttempt === 2 && !qData.isSample) {
      setTotalScore(s => s + questionScore);
    }

    if (qData.isSample) {
      // Show Retake / Next buttons
      setShowControls(true);
    } else {
      // Auto-advance after 1.5s
      setTimeout(() => moveNext(qData), 1500);
    }
  }, [currentQuestion, currentAttempt, questionTime]); // eslint-disable-line

  // ──── Advance to next attempt or question ────────────────────────────────────
  const moveNext = useCallback((qData) => {
    new Audio(`${AUDIO_PATH}/screen_change.wav`).play().catch(() => {});

    if (currentAttempt === 1) {
      // Move to attempt 2
      setCurrentAttempt(2);
    } else {
      // Move to next question
      const next = currentQuestion + 1;
      if (next > 9) {
        // Game over
        completeGame();
      } else {
        setCurrentAttempt(1);
        setCurrentQuestion(next);
      }
    }
  }, [currentAttempt, currentQuestion]); // eslint-disable-line

  // ──── Sample question controls ───────────────────────────────────────────────
  const handleSampleRetake = () => {
    new Audio(`${AUDIO_PATH}/screen_change.wav`).play().catch(() => {});
    // Reset just the current screen without changing current question
    setClickedImages(new Set());
    setResponses([]);
    setSelectedOrder([]);
    setQuestionTime(0);
    setShowControls(false);
    setButtonsDisabled(false);
    const qData = GAME_DATA[1];
    const positions = shuffle(getPositionsForCount(qData.imageCount));
    setImageLayout(qData.imageIds.map((imageId, i) => ({
      imageId,
      x: positions[i].x,
      y: positions[i].y,
    })));
  };

  const handleSampleNext = () => {
    new Audio(`${AUDIO_PATH}/screen_change.wav`).play().catch(() => {});
    setCurrentQuestion(2);
    setCurrentAttempt(1);
  };

  // ──── Complete game ──────────────────────────────────────────────────────────
  const completeGame = useCallback(() => {
    setScreen('score');
    clearInterval(timerRef.current);
    const sessId = gameSessionIdRef.current;
    if (sessId) {
      // Final save
      setScoreHistory(hist => {
        const allScores = hist.filter(h => h.attempt === 2 && !h.isSample).map(h => ({
          qId: h.question,
          score: h.score,
          timeTaken: h.time,
          correctCount: h.correctCount,
          expectedImages: h.expectedImages,
          selectedImages: h.selected,
          matchedImages: h.matchedImages,
          incorrectSelections: h.incorrectSelections,
          missedImages: h.missedImages,
          category: h.category
        }));
        setTotalScore(ts => {
          axios.put(`${API_URL}/games/sessions/update/${sessId}`, {
            score: ts,
            progress_level: 9,
            status: 'completed',
            saved_state: { allScores, totalScore: ts, scoreHistory: hist },
          }).catch(e => console.error(e));
          return ts;
        });
        return hist;
      });
    }
  }, [totalScore, scoreHistory]);

  // ──── Quit/Pause ─────────────────────────────────────────────────────────────
  const handleQuit = async (status) => {
    if (!quitReason.trim()) { alert(t('common.enterReason')); return; }
    await saveToServer(status, quitReason);
    if (status === 'quit') {
      setShowQuitModal(false);
      setScreen('score');
      // Delay slightly so score screen renders before PDF capture
      setTimeout(() => generateAndUploadPDF(), 500);
    } else {
      navigate('/');
    }
  };

  // ──── Assessment submit ──────────────────────────────────────────────────────
  const submitAssessment = async () => {
    setAssessmentSubmitting(true);
    try {
      await axios.post(`${API_URL}/games/assessments`, {
        session_id: gameSessionId,
        child_id: childData.child_id,
        q1_enjoyment: assessment.q1,
        q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3,
        q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors,
        additional_notes: assessment.notes,
      });
      setAssessmentSubmitted(true);
      await generateAndUploadPDF();
      alert(t('game.assessmentSubmitted'));
    } catch (e) {
      console.error(e);
      alert(t('common.failedToSave'));
    } finally {
      setAssessmentSubmitting(false);
    }
  };

  // ──── PDF Generation ─────────────────────────────────────────────────────────
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
      formData.append('pdf', pdfBlob, `${childNameSafe}_Her_Pher_SES${gameSessionIdRef.current}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', gameSessionIdRef.current);
      formData.append('game_name', GAME_NAME);
      
      await axios.post(`${API_URL}/games/pdfs/upload`, formData);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    }
  };

  // ──── Speech to Text ─────────────────────────────────────────────────────────
  const toggleRecording = (target) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech Recognition not supported. Please type manually.'); return; }
    if (isRecording && recordingTarget === target) {
      if (window.activeRecognition) window.activeRecognition.stop();
      setIsRecording(false); setRecordingTarget(null); return;
    }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    rec.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (final) {
        if (target === 'quitReason') setQuitReason(p => p + final);
        else if (target === 'assessmentNotes') setAssessment(p => ({ ...p, notes: p.notes + final }));
      }
    };
    rec.onend  = () => { setIsRecording(false); setRecordingTarget(null); };
    rec.onerror = () => { setIsRecording(false); setRecordingTarget(null); };
    window.activeRecognition = rec;
    rec.start();
    setIsRecording(true);
    setRecordingTarget(target);
  };

  // ──── Derived values ─────────────────────────────────────────────────────────
  const qData     = GAME_DATA[currentQuestion];
  const sp        = childData?.age ? getSP(childData.age) : '—';
  const clickedCount = clickedImages.size;

  const questionLabel = qData?.isSample
    ? 'Sample Question'
    : `Question ${currentQuestion - 1}`;
  const attemptLabel  = `Attempt ${currentAttempt}/2`;

  // Score screen data
  const scoredHistory = scoreHistory.filter(h => h.attempt === 2 && !h.isSample);
  const totalCorrectAll = scoredHistory.reduce((s, h) => s + h.correctCount, 0);
  const totalIncorrectAll = scoredHistory.reduce((s, h) => s + (h.responses.length - h.correctCount), 0);

  // ──── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="hp-app">
      <div className="hp-container">

        {/* ── Top Bar ── */}
        <header className="hp-topbar">
          <div className="hp-brand">
            <img src="/cel_admin_logo.png" alt="CEL Logo" className="hp-brand-img" />
            <div className="hp-divider"></div>
            <span className="hp-test-title">Her Pher</span>
          </div>
          <div className="hp-stats">
            <div className="hp-stat-pill">
              <span className="hp-stat-label">CHILD ID</span>
              <span className="hp-stat-value">{childData?.child_id || '—'}</span>
            </div>
            <div className="hp-stat-pill">
              <span className="hp-stat-label">SCORE</span>
              <span className="hp-stat-value">{totalScore}</span>
            </div>

            {screen === 'game' && (
              <button
                className="btn-pause-quit"
                onClick={() => { setQuitReason(''); setShowQuitModal(true); }}
              >
                <span>⏸</span> Pause/Quit
              </button>
            )}
          </div>
        </header>

        <main className="hp-main">

          {/* ══════════════ SPLASH ══════════════ */}
          {screen === 'splash' && (
            <div className="hp-screen">
              <div className="hp-screen-header">
                <div style={{ textAlign: 'center', width: '100%' }}>
                  {/* Header text removed as requested */}
                </div>
              </div>

              <div className="hp-card hp-splash-card">
                <div className="hp-splash-img-wrapper">
                  <img
                    src="/assets/images/her_pher/her_pher.jpg"
                    alt="Her Pher"
                    className="hp-splash-img"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '<div class="hp-splash-fallback">🔄<br/>Her Pher</div>';
                    }}
                  />
                </div>

                <h2 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '25px', color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                  Welcome to Her Pher
                </h2>
                


                <div className="hp-btn-row">
                  <button
                    className={`hp-btn hp-btn-primary ${audioFinished ? 'hp-btn-highlight' : ''}`}
                    style={{ fontSize: '1.2rem', padding: '16px 40px', opacity: !audioFinished ? 0.55 : 1, cursor: !audioFinished ? 'not-allowed' : 'pointer' }}
                    disabled={!audioFinished}
                    onClick={startNewGame}
                  >
                    Start Now
                  </button>
                  <button
                    className="hp-btn hp-btn-secondary"
                    onClick={() => {
                      if (audioSplashRef.current) {
                        setAudioFinished(false);
                        audioSplashRef.current.currentTime = 0;
                        audioSplashRef.current.play().catch(() => setAudioFinished(true));
                      }
                    }}
                  >
                    Replay Audio
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ══════════════ GAME ══════════════ */}
          {screen === 'game' && qData && (
            <div className="hp-screen">
              <div className="hp-screen-header">
                <div>
                  <div className="hp-screen-title">Her Pher</div>
                  <div className="hp-screen-subtitle">
                    {questionLabel}
                  </div>
                </div>
                <div className="hp-chips">
                  {currentAttempt === 1 && !qData.isSample && (
                    <span className="hp-chip" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>
                      Practice (not scored)
                    </span>
                  )}
                  {currentAttempt === 2 && !qData.isSample && (
                    <span className="hp-chip hp-chip-success">Scored</span>
                  )}
                </div>
              </div>

              {/* Info Bar */}
              <div className="hp-info-bar">
                <div className="hp-info-item">
                  <span className="hp-info-label">⏱ Timer:</span>
                  <span className="hp-info-value">{formatTime(questionTime)}</span>
                </div>
                <div className="hp-info-item">
                  <span className="hp-info-label">📊 Progress:</span>
                  <span className="hp-info-value hp-info-progress">
                    {clickedCount}/{qData.imageCount}
                  </span>
                </div>
                <div className="hp-info-item">
                  <span className="hp-info-label">🗂 Category:</span>
                  <span className="hp-info-value" style={{ textTransform: 'capitalize' }}>
                    {qData.category}
                  </span>
                </div>
              </div>

              {/* Image Grid */}
              <div className={`hp-game-container ${qData.imageCount <= 6 ? 'hp-rows-2' : ''}`}>
                {imageLayout.map(({ imageId, x, y }) => {
                  const currentHeight = qData.imageCount <= 6 ? GRID_HEIGHT_2 : GRID_HEIGHT_3;
                  return (
                    <button
                      key={`${imageId}-${x}-${y}`}
                      className={`hp-img-btn ${shuffleInProgress ? 'hp-shuffling' : ''}`}
                      style={{
                        left: `${(x / GRID_WIDTH) * 100}%`,
                        top: `${(y / currentHeight) * 100}%`,
                        width: `${(IMAGE_SIZE / GRID_WIDTH) * 100}%`,
                        height: `${(IMAGE_SIZE / currentHeight) * 100}%`,
                      }}
                      disabled={buttonsDisabled}
                      onClick={() => handleImageClick(imageId)}
                    >
                      <img
                        src={`${IMAGE_PATH}/${qData.category}/${imageId}.png`}
                        alt={`${qData.category} ${imageId}`}
                        onError={(e) => {
                          e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23e5e7eb' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%236b7280' font-size='24'%3E${imageId}%3C/text%3E%3C/svg%3E`;
                        }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Sample controls */}
              {showControls && qData.isSample && (
                <div className="hp-game-controls">
                  <button className="hp-btn hp-btn-secondary" onClick={handleSampleRetake}>
                    🔄 Retake Sample
                  </button>
                  <button className="hp-btn hp-btn-primary hp-btn-highlight" onClick={handleSampleNext}>
                    Start Q1 →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ SCORE (End of Game) ══════════════ */}
          {screen === 'score' && (
            <div className="hp-screen">
              <div className="hp-screen-header">
                <div>
                  <div className="hp-screen-title">{quitReason ? 'Assessment Terminated' : 'Assessment Complete'}</div>
                  <div className="hp-screen-subtitle">{quitReason ? `Reason: ${quitReason}` : 'All questions completed'}</div>
                </div>
                <div className="hp-chips">
                  <span className="hp-chip" style={{ color: '#fff', background: '#4f46e5', border: '1px solid #4338ca' }}>{t('game.attemptLabel')}{attemptNo}</span>
                  <span className="hp-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>Final Results</span>
                  <span className="hp-chip" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', display:'inline-flex', alignItems:'center', gap:'4px' }}>
                    Time: {Math.floor(totalTime / 60)}m {totalTime % 60}s
                  </span>
                </div>
              </div>

              <div className="hp-card hp-result-card" style={{ padding: 30 }} id="dashboard-capture-area">
                <div className="hp-result-header" style={{ marginBottom: '24px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Her Pher Performance</h2>
                  <p style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: 500, margin: 0 }}>Assessment Completed</p>
                </div>

                <div className="hp-score-top">
                  <div className="hp-score-dial-container">
                    <div className="hp-score-dial-big">{totalScore}</div>
                    <div className="hp-score-dial-small">/ 25</div>
                  </div>

                  <div className="hp-metric-grid">
                    <div className="hp-metric-box">
                      <label>Total Score</label>
                      <div className="metric-val">{totalScore} / 25</div>
                    </div>
                    <div className="hp-metric-box">
                      <label>Correct</label>
                      <div className="metric-val green">{totalCorrectAll}</div>
                    </div>
                    <div className="hp-metric-box">
                      <label>Incorrect</label>
                      <div className="metric-val red">{totalIncorrectAll}</div>
                    </div>
                    <div className="hp-metric-box">
                      <label>Percentage</label>
                      <div className="metric-val">{((totalScore / 25) * 100).toFixed(1)}%</div>
                    </div>
                    <div className="hp-metric-box">
                      <label>Total Time</label>
                      <div className="metric-val">
                         {Math.floor(totalTime / 60)}m {totalTime % 60}s
                      </div>
                    </div>
                    <div className="hp-metric-box">
                      <label>Avg Time/Q</label>
                      <div className="metric-val">{scoredHistory.length ? Math.round(totalTime / scoredHistory.length) : 0}s</div>
                    </div>
                  </div>
                </div>

                {((totalScore / 25) * 100) > 80 && (
                   <div className="hp-banner">Outstanding performance! You're a memory star! ⭐</div>
                )}

                {/* Detailed Per-Question Integrity Dashboard */}
                <div className="hp-q-grid" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {scoredHistory.map((h, i) => {
                    const isPractice = h.isSample;
                    const cat = h.category || GAME_DATA[h.question]?.category;
                    const expected = h.expectedImages || [];
                    const selected = h.selectedImages || h.selected || [];
                    const matched = h.matchedImages || [];
                    const incorrect = h.incorrectSelections || [];
                    const missed = h.missedImages || [];
                    
                    return (
                      <div className="hp-q-card-detailed" key={`${h.question}-${h.attempt}-${i}`}>
                        <div className="hp-q-detailed-header">
                          <div className="hp-q-detailed-title">
                            <span className="hp-q-num">{isPractice ? 'Sample Round' : `Question ${h.question - 1}`}</span>
                            <span className="hp-q-cat" style={{ textTransform: 'capitalize' }}>{cat}</span>
                            {isPractice && <span className="hp-practice-badge">Practice</span>}
                          </div>
                          <div className="hp-q-detailed-metrics">
                            <span className="hp-q-time">⏱ {formatTime(h.time)}</span>
                            {!isPractice && (
                              <span style={{
                                fontSize: '0.9rem', fontWeight: 700,
                                color: h.score > 0 ? '#059669' : '#94a3b8',
                                background: h.score > 0 ? '#d1fae5' : '#f1f5f9',
                                borderRadius: '999px', padding: '4px 10px'
                              }}>
                                Score: {h.score > 0 ? `+${h.score}` : '0'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="hp-q-detailed-body">
                          {/* Expected Images */}
                          <div className="hp-img-section">
                            <h4 className="hp-img-section-title">Expected Images (Total: {expected.length})</h4>
                            <div className="hp-img-row">
                              {expected.map((imgId, idx) => (
                                <div key={`exp-${imgId}-${idx}`} className="hp-img-thumb-wrap expected">
                                  <img src={`${IMAGE_PATH}/${cat}/${imgId}.png`} alt={`Expected ${imgId}`} className="hp-img-thumb" />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* User Selected Images */}
                          <div className="hp-img-section">
                            <h4 className="hp-img-section-title">User Selected Images ({selected.length} clicks)</h4>
                            <div className="hp-img-row">
                              {selected.map((imgId, idx) => {
                                const isCorrectClick = h.responses[idx] === 1;
                                return (
                                  <div key={`sel-${imgId}-${idx}`} className={`hp-img-thumb-wrap ${isCorrectClick ? 'correct' : 'incorrect'}`}>
                                    <img src={`${IMAGE_PATH}/${cat}/${imgId}.png`} alt={`Selected ${imgId}`} className="hp-img-thumb" />
                                    {isCorrectClick ? (
                                      <span className="hp-icon-badge correct-badge">✓</span>
                                    ) : (
                                      <span className="hp-icon-badge incorrect-badge">✗</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Match Analysis */}
                          <div className="hp-match-analysis">
                            <div className="hp-match-item">
                              <span className="hp-match-label">Matched Correctly:</span>
                              <span className="hp-match-value green">{matched.length > 0 ? matched.join(', ') : 'None'}</span>
                            </div>
                            <div className="hp-match-item">
                              <span className="hp-match-label">Incorrect Selections (Duplicates):</span>
                              <span className="hp-match-value red">{incorrect.length > 0 ? incorrect.join(', ') : 'None'}</span>
                            </div>
                            <div className="hp-match-item">
                              <span className="hp-match-label">Missed Items:</span>
                              <span className="hp-match-value orange">{missed.length > 0 ? missed.join(', ') : 'None'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Assessment Form */}
                <SessionAssessmentForm
                  assessment={assessment}
                  setAssessment={setAssessment}
                  assessmentSubmitted={assessmentSubmitted}
                  isAssessmentSubmitting={assessmentSubmitting}
                  submitAssessmentForm={submitAssessment}
                  isRecording={isRecording}
                  recordingTarget={recordingTarget}
                  toggleRecording={toggleRecording}
                  t={t}
                >
                  <>
                    <button
                      className="hp-btn hp-btn-primary"
                      onClick={() => { resetGameState(); setScreen('splash'); setAudioFinished(false); }}
                      style={{ minWidth: '160px' }}
                    >
                      {t('game.retest')}
                    </button>
                    <button 
                      className="hp-btn hp-btn-secondary" 
                      onClick={() => navigate('/')}
                      style={{ minWidth: '160px' }}
                    >
                      {t('game.home')}
                    </button>
                  </>
                </SessionAssessmentForm>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── Splash Audio ── */}
      {!isCheckingSession && (
        <audio
          ref={audioSplashRef}
          src={`${AUDIO_PATH}/splash.wav`}
          preload="auto"
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {/* ── Resume Modal ── */}
      {showResumeModal && (
        <div className="hp-modal-overlay">
          <div className="hp-modal">
            <h2>Saved Progress Found</h2>
            <p>You have a previously saved game session. Would you like to resume or start fresh?</p>
            <div className="hp-btn-row" style={{ marginTop: 0 }}>
              <button
                className="hp-btn hp-btn-secondary"
                onClick={() => { setShowResumeModal(false); resetGameState(); setScreen('splash'); setAudioFinished(false); }}
              >
                Restart Fresh
              </button>
              <button className="hp-btn hp-btn-primary" onClick={resumeGame}>
                Resume Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quit / Pause Modal ── */}
      {showQuitModal && (
        <div className="hp-modal-overlay">
          <div className="hp-modal">
            <h2>Pause or Quit</h2>
            <p>Why are you stopping the game?</p>
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="E.g., Child is tired, disconnected, etc."
                value={quitReason}
                onChange={(e) => setQuitReason(e.target.value)}
              />
              <button
                onClick={() => toggleRecording('quitReason')}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: isRecording && recordingTarget === 'quitReason' ? '#ef4444' : '#e2e8f0',
                  color:      isRecording && recordingTarget === 'quitReason' ? 'white' : '#475569',
                  border: 'none', borderRadius: '50%', width: 32, height: 32,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                }}
                title={isRecording ? 'Stop Recording' : 'Start Dictation'}
              >🎙</button>
            </div>
            <div className="hp-btn-row" style={{ marginTop: 0 }}>
              <button
                className="hp-btn hp-btn-secondary"
                style={{ padding: '8px 20px', minWidth: 0, fontSize: '0.9rem' }}
                onClick={() => setShowQuitModal(false)}
              >
                Cancel
              </button>
              <button
                className="hp-btn hp-btn-warning"
                style={{ padding: '8px 20px', minWidth: 0, fontSize: '0.9rem' }}
                onClick={() => handleQuit('paused')}
              >
                Pause & Save
              </button>
              <button
                className="hp-btn"
                style={{ padding: '8px 20px', minWidth: 0, fontSize: '0.9rem', background: '#ef4444', color: 'white' }}
                onClick={() => handleQuit('quit')}
              >
                Quit & End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HerPherGame;
