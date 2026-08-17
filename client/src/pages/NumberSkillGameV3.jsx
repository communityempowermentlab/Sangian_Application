import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage, STT_LANG_MAP } from '../contexts/LanguageContext';
import { useHeaderConfig } from '../contexts/HeaderConfigContext';
import { useTestAudio } from '../hooks/useTestAudio';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { unlockAudioContext } from '../utils/audioUnlock';
import { StatusBar } from '@capacitor/status-bar';
import './NumberSkillGame.css';
import './NumberSkillGameV3.css';

// ASER adaptive decision tree outcome levels — mirrors ReadingSkillGameV2's
// LEVELS pattern. Drives finalizeAssessment()'s numeric score and the
// ordinal score buckets configured server-side in analysisController.js.
const LEVELS = {
  Beginner: 0,
  'Number Recognition (1–9)': 1,
  'Number Recognition (10–99)': 2,
  Subtraction: 3,
  Division: 4,
};

const STAGE_LABELS = {
  subtraction_pair_select: 'Subtraction',
  subtraction_q1: 'Subtraction Q1',
  subtraction_q2: 'Subtraction Q2',
  subtraction_q1_retry: 'Subtraction Q1 (Retry)',
  division_select: 'Division',
  division_q1: 'Division',
  number_recognition_99_select: 'Number Recognition (10–99)',
  number_recognition_9_select: 'Number Recognition (1–9)',
};

const CATEGORY_NAMES = {
  recognition9: 'Number Recognition (1–9)',
  recognition99: 'Number Recognition (10–99)',
  subtraction: 'Two-Digit Subtraction',
  division: 'One-Digit Divisor (Three-Digit Dividend)',
};


const NumberSkillGameV3 = () => {
  // Global Microphone Cleanup: Ensure hardware lock is released on unmount
  useEffect(() => {
    return () => {
      if (window.activeRecognition) {
        window.activeRecognition.onend = null;
        window.activeRecognition.onerror = null;
        try { window.activeRecognition.stop(); } catch(e) {}
        window.activeRecognition = null;
      }
    };
  }, []);

  const { t, language } = useLanguage();
  const { showLogo, showGameIcon, showGameName, showChildId, showTimer, showScore } = useHeaderConfig();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`${API_URL}/public/ankganit-v3`);
        if (res.data.success) {
           setCategories(res.data.categories);
           setConfigLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load Ankganit V3 config', err);
      }
    };
    fetchConfig();
  }, []);

  // Admin-configured, language-specific display content for individual
  // questions (Admin → Elements → Ankganit V3) — keyed by question id,
  // scoped to the currently selected language. This ONLY overrides what's
  // rendered on the active question screens below; the canonical text/
  // correct_answer/remainder from `categories` above (used for scoring,
  // saved_state, the results table, and the PDF) is never touched, so
  // switching languages can't affect scoring, reports, or dashboards.
  const [contentOverrides, setContentOverrides] = useState({});
  useEffect(() => {
    const fetchOverrides = async () => {
      try {
        const res = await axios.get(`${API_URL}/public/elements`, { params: { test_id: 'numeracy_number_skill_v3' } });
        if (res.data.success) {
          const map = {};
          (res.data.elements || []).forEach(el => {
            if (el.language !== language) return;
            const m = /^q_(\d+)$/.exec(el.asset_type || '');
            if (!m) return;
            const display = el.config?.display;
            if (typeof display === 'string' && display.trim()) map[m[1]] = display.trim();
          });
          setContentOverrides(map);
        }
      } catch (err) {
        console.error('Failed to load Ankganit V3 language content', err);
      }
    };
    fetchOverrides();
  }, [language]);

  // `q` may be a raw question row ({id, text, ...}) or the in-progress
  // subtraction/division state ({questionId, text, ...}) — both carry a
  // `.text` fallback so an unconfigured language silently shows the same
  // canonical content as before, never a blank or wrong-language string.
  const getQuestionDisplay = (q) => {
    if (!q) return '';
    const override = contentOverrides[q.questionId ?? q.id];
    return override || q.text;
  };

  // Recognition-category tiles fall back to `title` (the bare number, e.g.
  // "51") rather than `text` ("Identify number 51"), matching nrBank's
  // existing title-then-text convention below.
  const getRecognitionDisplay = (q) => {
    const override = contentOverrides[q.id];
    return override || q.title || q.text;
  };

  const subtractionCat = categories.find(c => c.name === CATEGORY_NAMES.subtraction);
  const divisionCat = categories.find(c => c.name === CATEGORY_NAMES.division);
  const recognition99Cat = categories.find(c => c.name === CATEGORY_NAMES.recognition99);
  const recognition9Cat = categories.find(c => c.name === CATEGORY_NAMES.recognition9);

  const [childData, setChildData] = useState(null);
  const [activityData, setActivityData] = useState({ lastPlayed: 'Never', attempts: 0 });
  const [screen, setScreen] = useState('splash'); // splash, game, score
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

  // ── ASER adaptive-tree state ────────────────────────────────────────────
  const [stage, setStage] = useState('subtraction_pair_select');
  const [path, setPath] = useState([]);
  const [pendingSubtractionSelection, setPendingSubtractionSelection] = useState([]); // up to 2 question ids, in pick order (first = Q1)
  const [pendingDivisionSelection, setPendingDivisionSelection] = useState(null); // index within the division bank, or null
  const [subtraction, setSubtraction] = useState({ q1: null, q2: null, bothCorrect: null });
  const [division, setDivision] = useState(null);
  const [numberRecognition99, setNumberRecognition99] = useState(null);
  const [numberRecognition9, setNumberRecognition9] = useState(null);
  // Tile-marking transient state, shared by whichever Number Recognition
  // screen is currently active (only one is ever in progress at a time).
  const [nrMarks, setNrMarks] = useState({});
  const [nrSelectedTexts, setNrSelectedTexts] = useState([]);
  const [finalLevel, setFinalLevel] = useState(null);
  const [finalScore, setFinalScore] = useState(null);
  const [finalGameTime, setFinalGameTime] = useState(null);

  // Assessment Form State
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

  // Digital numpad entry — the child types directly, auto-scored against
  // the question bank (matches Ankganit V1/V2's input mechanics). Division
  // needs two fields (quotient + remainder); subtraction just one (answer).
  const [activeInput, setActiveInput] = useState('answer');
  const [answerVal, setAnswerVal] = useState('');
  const [quotientVal, setQuotientVal] = useState('');
  const [remainderVal, setRemainderVal] = useState('');

  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const { getAudioUrl, ready: audioReady } = useTestAudio('numeracy_number_skill_v3');

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
        const summary = res.data.summaries.find(s => s.game_name === 'numeracy_number_skill_v3');
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
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && audioRef.current && !audioFinished && audioReady) {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("Autoplay blocked by browser policy:", err);
          setAudioFinished(true);
        });
      }
    }
  }, [isCheckingSession, screen, showResumeModal, audioFinished, audioReady]);

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
      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/numeracy_number_skill_v3`);
      if (res.data.sessionInfo) {
        const info = res.data.sessionInfo;
        const resumable = ['in_progress', 'paused'];
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
        game_name: 'numeracy_number_skill_v3',
        total_questions: 5
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
    setStage(saved.stage || 'subtraction_pair_select');
    setPath(saved.path || []);
    setSubtraction(saved.subtraction || { q1: null, q2: null, bothCorrect: null });
    setDivision(saved.division || null);
    setNumberRecognition99(saved.numberRecognition99 || null);
    setNumberRecognition9(saved.numberRecognition9 || null);
    setFinalLevel(saved.finalLevel || null);
    setFinalScore(saved.finalScore ?? null);
    setFinalGameTime(saved.finalGameTime ?? null);
    setTimerSeconds(saved.timerSeconds || 0);
    setQTimer(saved.qTimer || 0);
    setPauses(saved.pauses || []);
    setScreen(saved.finalLevel ? 'score' : 'game');
    setShowResumeModal(false);
  };

  const resetInternalState = () => {
    setStage('subtraction_pair_select');
    setPath([]);
    setPendingSubtractionSelection([]);
    setPendingDivisionSelection(null);
    setSubtraction({ q1: null, q2: null, bothCorrect: null });
    setDivision(null);
    setNumberRecognition99(null);
    setNumberRecognition9(null);
    setNrMarks({});
    setNrSelectedTexts([]);
    setFinalLevel(null);
    setFinalScore(null);
    setFinalGameTime(null);
    setTimerSeconds(0);
    setQTimer(0);
    setPauses([]);
    setQuotientVal('');
    setRemainderVal('');
    setActiveInput('quotient');
    setAssessmentSubmitted(false);
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
    recognition.lang = STT_LANG_MAP[language] || 'en-US';

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

  // Single source of truth for the saved_state payload — every save call
  // (progress sync, quit, finalize, assessment submit) goes through this,
  // mirroring ReadingSkillGameV2.jsx's buildSavedState()/resumeGame() pair.
  const buildSavedState = (extra = {}) => ({
    stage, path,
    subtraction, division, numberRecognition99, numberRecognition9,
    finalLevel, finalScore, finalGameTime,
    timerSeconds, qTimer, pauses,
    ...extra
  });

  const saveToServer = async (statusOverride = null, reason = null) => {
    if (!gameSessionId) return;
    try {
      let updatedPauses = [...pauses];
      if (reason && (statusOverride === 'paused' || statusOverride === 'quit')) {
         updatedPauses.push({ stage, reason, timestamp: new Date().toISOString() });
         setPauses(updatedPauses);
      }

      await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
        score: finalScore ?? 0,
        progress_level: path.length + 1,
        status: statusOverride || 'in_progress',
        quit_reason: reason || null,
        saved_state: buildSavedState({ pauses: updatedPauses })
      });
    } catch (e) { console.error('Failed to sync progress to server:', e); }
  };

  // Sync progress to the server whenever the child advances to a new stage.
  useEffect(() => {
    if (screen === 'game' && path.length > 0) saveToServer('in_progress');
  }, [stage]);

  // Records the CURRENT stage into the navigation-path breadcrumb, then
  // switches to newStage — the single place that advances `stage`, so path
  // recording can never be forgotten in an individual transition handler.
  const goToStage = (newStage) => {
    setPath(p => [...p, stage]);
    setStage(newStage);
    setQTimer(0);
  };

  // ── Subtraction ─────────────────────────────────────────────────────────
  // All 8 questions are shown at once; the child/assessor picks any 2 (in
  // the order to attempt them — first pick = Q1). A selected question can
  // always be unpicked; once 2 are picked, further NEW picks are blocked
  // until one is unpicked or Confirm is pressed.
  const sortedSubtractionQuestions = subtractionCat ? [...subtractionCat.questions].sort((a, b) => a.display_order - b.display_order) : [];

  const toggleSubtractionSelection = (id) => {
    setPendingSubtractionSelection(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id); // unselect
      if (prev.length >= 2) return prev; // locked until one is freed
      return [...prev, id];
    });
  };

  const confirmSubtractionSelect = () => {
    if (pendingSubtractionSelection.length < 2) return;
    const q1src = sortedSubtractionQuestions.find(q => q.id === pendingSubtractionSelection[0]);
    const q2src = sortedSubtractionQuestions.find(q => q.id === pendingSubtractionSelection[1]);
    if (!q1src || !q2src) return;
    setSubtraction(prev => ({
      ...prev,
      q1: { questionId: q1src.id, text: q1src.text, correctAnswer: q1src.correct_answer, firstAttempt: null, retryGiven: false, retryAttempt: null, finalCorrect: null },
      q2: { questionId: q2src.id, text: q2src.text, correctAnswer: q2src.correct_answer, firstAttempt: null, finalCorrect: null },
    }));
    setAnswerVal('');
    setActiveInput('answer');
    goToStage('subtraction_q1');
  };

  // Q1 wrong is never an immediate failure — always move straight to Q2 and
  // only decide afterwards (see evaluateAfterQ2) whether Q1 gets a retry.
  const markSubtractionQ1 = (correct, enteredAnswer) => {
    const attempt = { correct, timeTaken: qTimer, enteredAnswer };
    setSubtraction(prev => ({ ...prev, q1: { ...prev.q1, firstAttempt: attempt, finalCorrect: correct } }));
    goToStage('subtraction_q2');
  };

  // The one-and-only Q1 retry — same Question 1, only reachable when Q1 was
  // wrong the first time and Q2 came back correct.
  const markSubtractionQ1Retry = (correct, enteredAnswer) => {
    const attempt = { correct, timeTaken: qTimer, enteredAnswer };
    const updated = { ...subtraction, q1: { ...subtraction.q1, retryGiven: true, retryAttempt: attempt, finalCorrect: correct } };
    setSubtraction(updated);
    proceedFromSubtractionResult(updated);
  };

  const markSubtractionQ2 = (correct, enteredAnswer) => {
    const attempt = { correct, timeTaken: qTimer, enteredAnswer };
    const updatedQ2 = { ...subtraction.q2, firstAttempt: attempt, finalCorrect: correct };
    const updated = { ...subtraction, q2: updatedQ2 };
    setSubtraction(updated);
    evaluateAfterQ2(updated);
  };

  // If Q1 was wrong but Q2 came back correct, give Q1 one retry (same
  // question). Otherwise the subtraction result is already final.
  const evaluateAfterQ2 = (sub) => {
    if (sub.q1.finalCorrect === false && sub.q2.finalCorrect === true) {
      goToStage('subtraction_q1_retry');
    } else {
      proceedFromSubtractionResult(sub);
    }
  };

  const proceedFromSubtractionResult = (sub) => {
    const bothCorrect = sub.q1.finalCorrect === true && sub.q2.finalCorrect === true;
    const updated = { ...sub, bothCorrect };
    setSubtraction(updated);
    if (bothCorrect && divisionCat) {
      setPendingDivisionSelection(null);
      goToStage('division_select');
    } else {
      setNrMarks({}); setNrSelectedTexts([]);
      goToStage('number_recognition_99_select');
    }
  };

  const getCurrentSubtractionQuestion = () => {
    if (['subtraction_q1', 'subtraction_q1_retry'].includes(stage)) return subtraction.q1;
    if (stage === 'subtraction_q2') return subtraction.q2;
    return null;
  };

  const handleSubtractionMark = (correct, enteredAnswer) => {
    if (stage === 'subtraction_q1') markSubtractionQ1(correct, enteredAnswer);
    else if (stage === 'subtraction_q1_retry') markSubtractionQ1Retry(correct, enteredAnswer);
    else if (stage === 'subtraction_q2') markSubtractionQ2(correct, enteredAnswer);
  };

  // Child types the answer on the numpad (matches Ankganit V1/V2's digital
  // auto-scored subtraction UI) — correctness is derived from the typed
  // value, not an assessor's manual judgment.
  const submitSubtractionAnswer = () => {
    const entered = parseInt(answerVal) || 0;
    const correct = entered === Number(currentSubtractionQuestion.correctAnswer);
    setAnswerVal('');
    handleSubtractionMark(correct, entered);
  };

  // ── Division ─────────────────────────────────────────────────────────────
  const sortedDivisionQuestions = divisionCat ? [...divisionCat.questions].sort((a, b) => a.display_order - b.display_order) : [];

  const confirmDivisionSelect = () => {
    const idx = pendingDivisionSelection ?? 0;
    const q = sortedDivisionQuestions[idx];
    if (!q) return;
    setDivision({ questionId: q.id, text: q.text, expectedQuotient: q.correct_answer, expectedRemainder: q.remainder, firstAttempt: null, finalCorrect: null });
    setActiveInput('quotient');
    goToStage('division_q1');
  };

  // No retry for division — a wrong quotient/remainder is final immediately.
  const submitDivisionAnswer = () => {
    const enteredQuotient = parseInt(quotientVal) || 0;
    const enteredRemainder = parseInt(remainderVal) || 0;
    const correct = enteredQuotient === Number(division.expectedQuotient) && enteredRemainder === Number(division.expectedRemainder);
    const attempt = { enteredQuotient, enteredRemainder, correct, timeTaken: qTimer };
    setQuotientVal(''); setRemainderVal('');
    const updated = { ...division, firstAttempt: attempt, finalCorrect: correct };
    setDivision(updated);
    finalizeAssessment(correct ? 'Division' : 'Subtraction', { division: updated });
  };

  // ── Number Recognition (shared tile-marking UI for both 1–9 and 11–99) ──
  const activeNrCategory = stage === 'number_recognition_99_select' ? recognition99Cat : recognition9Cat;
  // `key` (canonical title/text) is what all selection/marking state below is
  // keyed by — unchanged from before, so saved_state/reports/PDF still see
  // the same canonical values. `display` is the only language-aware part,
  // used purely for the tile's visible label.
  const nrBank = activeNrCategory ? [...activeNrCategory.questions].sort((a, b) => a.display_order - b.display_order).map(q => ({ key: q.title || q.text, display: getRecognitionDisplay(q) })) : [];

  const toggleNrTileSelection = (text) => {
    const isSelected = nrSelectedTexts.includes(text);
    if (isSelected) {
      if (text in nrMarks) return; // locked — already marked
      setNrSelectedTexts(prev => prev.filter(x => x !== text));
    } else {
      if (nrSelectedTexts.length >= 5) return; // cap reached
      setNrSelectedTexts(prev => [...prev, text]);
    }
  };

  const markNrTile = (text, correct) => {
    setNrMarks(prev => ({ ...prev, [text]: correct ? 'correct' : 'incorrect' }));
  };

  const nrMarkedCount = nrSelectedTexts.filter(text => text in nrMarks).length;
  const canContinueNrMarking = nrSelectedTexts.length === 5 && nrMarkedCount === 5;

  const finishNumberRecognition99 = () => {
    const selected = nrSelectedTexts.map(text => ({ text, correct: nrMarks[text] === 'correct' }));
    const correctCount = selected.filter(s => s.correct).length;
    const pass = correctCount >= 4;
    const record = { selected, correctCount, pass, timeTaken: qTimer };
    setNumberRecognition99(record);
    if (pass) {
      finalizeAssessment('Number Recognition (10–99)', { numberRecognition99: record });
    } else {
      setNrMarks({}); setNrSelectedTexts([]);
      goToStage('number_recognition_9_select');
    }
  };

  const finishNumberRecognition9 = () => {
    const selected = nrSelectedTexts.map(text => ({ text, correct: nrMarks[text] === 'correct' }));
    const correctCount = selected.filter(s => s.correct).length;
    const pass = correctCount >= 4;
    const record = { selected, correctCount, pass, timeTaken: qTimer };
    setNumberRecognition9(record);
    finalizeAssessment(pass ? 'Number Recognition (1–9)' : 'Beginner', { numberRecognition9: record });
  };

  const handleFinishNrMarking = () => {
    if (stage === 'number_recognition_99_select') finishNumberRecognition99();
    else if (stage === 'number_recognition_9_select') finishNumberRecognition9();
  };

  const handleNumpadInput = (val) => {
    const setter = activeInput === 'remainder' ? setRemainderVal : activeInput === 'quotient' ? setQuotientVal : setAnswerVal;
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

  const generateAndUploadPDF = async () => {
    if (!gameSessionId) return;
    let wrapper = null;
    try {
      await new Promise(r => setTimeout(r, 500)); // Wait for render

      const el = document.querySelector('.ns-main');
      if (!el) return;

      // Clone into a clean wrapper on document.body — .ns-app has
      // overflow:hidden + height:100dvh, so capturing the live element in
      // place clips it to the viewport instead of its full content size.
      // Also neutralize any scrollable inner region — html2canvas paints
      // scrollable content as currently scrolled, so it stays clipped even
      // once the outer container is unconstrained.
      const originalNodes = el.querySelectorAll('*');
      const clone = el.cloneNode(true);
      const cloneNodes = clone.querySelectorAll('*');
      clone.style.animation = 'none';
      clone.style.opacity = '1';
      cloneNodes.forEach((node, i) => {
        // Detached clone's inputs are never interacted with (it's a static
        // screenshot source) — but a same-`name` radio left in the DOM
        // collides with React's live-controlled group of the same name and
        // triggers "Mixing React and non-React radio inputs" errors.
        if (node.tagName === 'INPUT' && node.name) node.removeAttribute('name');
        node.style.animation = 'none';
        node.style.transition = 'none';
        node.style.opacity = '';
        const cs = window.getComputedStyle(originalNodes[i]);
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') node.style.overflowX = 'visible';
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') node.style.overflowY = 'visible';
      });

      wrapper = document.createElement('div');
      wrapper.style.cssText = [
        'position:fixed', 'top:-99999px', 'left:0',
        'width:' + Math.max(el.scrollWidth, 1400) + 'px',
        'background:#ffffff', 'padding:20px',
        'z-index:-9999', 'pointer-events:none',
      ].join(';');
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: wrapper.scrollWidth,
        windowHeight: wrapper.scrollHeight
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
      formData.append('pdf', pdfBlob, `${childNameSafe}_AnkganitV3_SES${gameSessionId}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', gameSessionId);
      formData.append('game_name', 'numeracy_number_skill_v3');

      await axios.post(`${API_URL}/games/pdfs/upload`, formData);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    } finally {
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
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
          saved_state: buildSavedState({ assessmentSubmitted: true })
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

  // The single terminal function — sets the final outcome, flips to the
  // score screen, and does the one status:'completed' save. Mirrors
  // ReadingSkillGameV2.jsx's finalizeAssessment() exactly.
  const finalizeAssessment = (level, overrides = {}) => {
    const finalPath = [...path, stage];
    setPath(finalPath);
    setFinalLevel(level);
    setFinalScore(LEVELS[level]);
    setFinalGameTime(timerSeconds);
    setScreen('score');
    if (gameSessionId) {
      const payload = buildSavedState({
        path: finalPath,
        finalLevel: level,
        finalScore: LEVELS[level],
        finalGameTime: timerSeconds,
        completedAt: new Date().toISOString(),
        ...overrides
      });
      axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
        score: LEVELS[level],
        progress_level: finalPath.length,
        status: 'completed',
        quit_reason: null,
        saved_state: payload
      }).then(() => {
        setTimeout(generateAndUploadPDF, 1500);
      }).catch(e => console.log(e));
    }
  };

  // fontSize/minWidth let call sites shrink the rendering to fit a grid of
  // many cards (e.g. all 8 subtraction questions on one screen) — defaults
  // are the full solve-screen size.
  const renderMathQuestion = (text, fontSize, minWidth) => {
    let cleanText = (text || '').replace(/Identify number\s*-?\s*/ig, '').trim();

    // Normalize all types of minus/dash characters to standard hyphen
    cleanText = cleanText.replace(/[−–—]/g, '-');

    // \p{Nd} (Unicode "decimal digit") instead of \d so a language-specific
    // override using Devanagari/Perso-Arabic/other script digits (e.g.
    // "५१ - ३५") still gets the fraction-bar/division-bracket layout below,
    // not just the ASCII 0-9 this originally supported.
    const isStrictMath = /^\s*\p{Nd}+\s*[-÷]\s*\p{Nd}+\s*$/u.test(cleanText);

    if (isStrictMath && cleanText.includes('-')) {
      const parts = cleanText.split('-');
      if (parts.length === 2) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: fontSize || '12rem', fontWeight: 800, color: '#333', lineHeight: 1.1 }}>
            <div>{parts[0].trim()}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderBottom: '10px solid #333', paddingBottom: '8px', minWidth: minWidth || '300px' }}>
              <span style={{ marginRight: '20px' }}>-</span>
              <span>{parts[1].trim()}</span>
            </div>
            <div style={{ height: '0.5em', width: '100%', borderBottom: '10px solid #333' }}></div>
          </div>
        );
      }
    } else if (isStrictMath && cleanText.includes('÷')) {
      const parts = cleanText.split('÷');
      if (parts.length === 2) {
        return (
          <div style={{ display: 'flex', alignItems: 'stretch', fontSize: fontSize || '8rem', fontWeight: 800, color: '#333', lineHeight: 1.2 }}>
            {/* Divisor */}
            <div style={{ paddingRight: '0.15em', display: 'flex', alignItems: 'center' }}>
              {parts[1].trim()}
            </div>

            {/* Dividend Container */}
            <div style={{ position: 'relative', display: 'flex' }}>

              {/* Main Top Bar */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                borderTop: '0.06em solid #333'
              }}></div>

              {/* Left Bracket ) (Uniform thickness, opens outside) */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: '0.25em',
                  height: '100%',
                  display: 'block',
                  overflow: 'visible'
                }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M 0,2.5 C 50,2.5 100,20 100,50 C 100,80 50,97.5 0,97.5"
                  fill="none"
                  stroke="#333"
                  style={{ vectorEffect: 'non-scaling-stroke', strokeWidth: '0.06em' }}
                />
              </svg>

              {/* Right Bracket ( (Uniform thickness, opens outside) */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: '0.25em',
                  height: '100%',
                  display: 'block',
                  overflow: 'visible'
                }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M 100,2.5 C 50,2.5 0,20 0,50 C 0,80 50,97.5 100,97.5"
                  fill="none"
                  stroke="#333"
                  style={{ vectorEffect: 'non-scaling-stroke', strokeWidth: '0.06em' }}
                />
              </svg>

              {/* Dividend Text */}
              <div style={{ padding: '0.15em 0.35em 0 0.35em' }}>
                {parts[0].trim()}
              </div>
            </div>
          </div>
        );
      }
    }

    return cleanText;
  };

  const renderPassBadge = (correct) => (
    <span style={{
      display: 'inline-block', padding: '3px 14px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600,
      background: correct ? '#dcfce7' : '#fee2e2', color: correct ? '#16a34a' : '#dc2626',
    }}>{correct ? t('game.scoreTable.correct') : t('game.scoreTable.incorrect')}</span>
  );

  // Results-screen per-stage breakdown — one row per path entry, resolved
  // against the recorded subtraction/division/number-recognition state.
  const getPathStageResult = (stageName) => {
    if (stageName === 'subtraction_q1') return { detail: subtraction.q1?.text, correct: subtraction.q1?.firstAttempt?.correct, duration: subtraction.q1?.firstAttempt?.timeTaken };
    if (stageName === 'subtraction_q1_retry') return { detail: subtraction.q1?.text, correct: subtraction.q1?.retryAttempt?.correct, duration: subtraction.q1?.retryAttempt?.timeTaken };
    if (stageName === 'subtraction_q2') return { detail: subtraction.q2?.text, correct: subtraction.q2?.firstAttempt?.correct, duration: subtraction.q2?.firstAttempt?.timeTaken };
    if (stageName === 'division_q1') return { detail: division?.text, correct: division?.firstAttempt?.correct, duration: division?.firstAttempt?.timeTaken };
    if (stageName === 'number_recognition_99_select') return { detail: `${numberRecognition99?.correctCount ?? 0} / 5`, correct: numberRecognition99?.pass, duration: numberRecognition99?.timeTaken };
    if (stageName === 'number_recognition_9_select') return { detail: `${numberRecognition9?.correctCount ?? 0} / 5`, correct: numberRecognition9?.pass, duration: numberRecognition9?.timeTaken };
    return { detail: '—', correct: undefined, duration: null };
  };

  const totalDuration = path
    .filter(s => STAGE_LABELS[s])
    .reduce((sum, s) => sum + (getPathStageResult(s).duration || 0), 0);

  const currentSubtractionQuestion = getCurrentSubtractionQuestion();

  return (
    <div className="ns-app">
      <header className="ns-topbar">
        <div className="ns-brand">
          {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="ns-brand-img" />}
          {showLogo && (showGameIcon || showGameName) && <div className="ns-divider"></div>}
          {showGameIcon && <img src="/assets/images/number_skill_v3/number_skill.jpg" alt="Number Skill" className="ns-test-logo" />}
          {showGameName && <span className="ns-test-title">{t('home.games.numeracy.title')}{t('common.version3')}</span>}
        </div>
        <div className="ns-topbar-center">
          {screen === 'game' && (
            <div className="ns-topbar-screen-title">{STAGE_LABELS[stage] || stage}</div>
          )}
        </div>
        <div className="ns-stats">
          {showChildId && childData?.child_id && (
            <div className="ns-stat-pill"><span className="ns-stat-icon">👤</span> <span className="ns-stat-value">{childData.child_id}</span></div>
          )}
          {showTimer && screen === 'game' && (
            <div className="ns-stat-pill"><span className="ns-stat-icon">⏱</span> <span className="ns-stat-value">{formatTime(qTimer)}</span></div>
          )}
          {showScore && (
          <div className="ns-stat-pill"><span className="ns-stat-icon">🏆</span> <span className="ns-stat-value">{finalLevel || '—'}</span></div>
          )}
          {screen === 'game' && <button className="btn-pause-quit" onClick={() => { setQuitReason(''); setShowQuitModal(true); }}><span>⏸</span> Pause/Quit</button>}
        </div>
      </header>

      <main className={`ns-main${screen === 'splash' ? ' ns-main-splash' : ''}`}>
        {screen === 'splash' && configLoaded && (
          <div className="ns-screen ns-screen-splash">
            <div className="ns-splash-cover">
              <img src="/assets/images/number_skill_v3/number_skill.jpg" alt="Ankganit" className="ns-splash-img-full" onError={e => { e.target.style.display = 'none'; }} />
              <div className="ns-splash-btn-overlay">
                <button
                  className={`ns-btn ns-btn-primary ${audioFinished ? 'ns-btn-highlight' : ''}`}
                  disabled={!audioFinished}
                  style={{ opacity: !audioFinished ? 0.6 : 1, cursor: !audioFinished ? 'not-allowed' : 'pointer' }}
                  onClick={() => { unlockAudioContext(); startNewGame(); }}
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

        {screen === 'game' && stage === 'subtraction_pair_select' && (
          <div className="ns-screen" style={{ backgroundColor: '#fff' }}>
            <div className="ns3-subtraction-grid">
              {[sortedSubtractionQuestions.slice(0, 4), sortedSubtractionQuestions.slice(4, 8)].map((row, rowIdx) => (
                <div key={rowIdx} className="ns3-division-row ns3-subtraction-row">
                  {row.map((q) => {
                    const isSelected = pendingSubtractionSelection.includes(q.id);
                    const isLocked = !isSelected && pendingSubtractionSelection.length >= 2;
                    return (
                      <div
                        key={q.id}
                        className={`ns3-pair-card ns3-subtraction-card ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                        onClick={() => toggleSubtractionSelection(q.id)}
                      >
                        {renderMathQuestion(getQuestionDisplay(q), '3.2rem', '110px')}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="ns-response-buttons">
              <button className="ns-btn ns-btn-primary" disabled={pendingSubtractionSelection.length < 2} onClick={confirmSubtractionSelect}>{t('game.confirm')}</button>
            </div>
          </div>
        )}

        {screen === 'game' && currentSubtractionQuestion && (
          <div className="ns-screen ns-screen-split" style={{ backgroundColor: '#fff' }}>
            <div className="ns-card ns-question-card ns-split-question" style={{ flexDirection: 'column' }}>
              {stage === 'subtraction_q1_retry' && (
                <div className="ns3-instruction">{t('game.subtractionQ1RetryInstruction')}</div>
              )}
              <div className="ns-question-content" style={{ display: 'flex', justifyContent: 'center' }}>
                {renderMathQuestion(getQuestionDisplay(currentSubtractionQuestion))}
              </div>
            </div>

            <div className="ns-auto-inputs ns-split-inputs">
              <div className="ns-input-group" onClick={() => setActiveInput('answer')}>
                <input type="text" readOnly value={answerVal} placeholder="?" className="ns-input-active" />
              </div>
              <button className="ns-btn ns-btn-submit" onClick={submitSubtractionAnswer}>{t('game.submitAnswer')}</button>

              <div className="ns-numpad">
                {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={()=>handleNumpadInput(num)} className="ns-key">{num}</button>)}
                <button onClick={()=>handleNumpadInput('clear')} className="ns-key ns-key-danger" style={{fontSize:'1.2rem'}}>{t('game.clear')}</button>
                <button onClick={()=>handleNumpadInput(0)} className="ns-key">0</button>
                <button onClick={()=>handleNumpadInput('back')} className="ns-key ns-key-back">⌫</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'game' && stage === 'division_select' && (
          <div className="ns-screen" style={{ backgroundColor: '#fff', justifyContent: 'center' }}>
            <div className="ns3-division-grid ns3-division-grid-large">
              {[sortedDivisionQuestions.slice(0, 2), sortedDivisionQuestions.slice(2, 4)].map((row, rowIdx) => (
                <div key={rowIdx} className="ns3-division-row">
                  {row.map((q, colIdx) => {
                    const idx = rowIdx * 2 + colIdx;
                    return (
                      <div
                        key={q.id}
                        className={`ns3-pair-card ns3-division-card ${pendingDivisionSelection === idx ? 'selected' : ''}`}
                        onClick={() => setPendingDivisionSelection(idx)}
                      >
                        {renderMathQuestion(getQuestionDisplay(q), '5.5rem')}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="ns-response-buttons">
              <button className="ns-btn ns-btn-primary" disabled={pendingDivisionSelection === null} onClick={confirmDivisionSelect}>{t('game.confirm')}</button>
            </div>
          </div>
        )}

        {screen === 'game' && stage === 'division_q1' && division && (
          <div className="ns-screen ns-screen-split" style={{ backgroundColor: '#fff' }}>
            <div className="ns-card ns-question-card ns-split-question">
              <div className="ns-question-content" style={{ display: 'flex', justifyContent: 'center' }}>
                {renderMathQuestion(getQuestionDisplay(division))}
              </div>
            </div>

            <div className="ns-auto-inputs ns-split-inputs">
              <div className="ns-input-row">
                <div className="ns-input-group" onClick={() => setActiveInput('quotient')}>
                  <label>{t('game.quotient')}</label>
                  <input type="text" readOnly value={quotientVal} className={activeInput === 'quotient' ? 'ns-input-active' : ''} />
                </div>
                <div className="ns-input-group" onClick={() => setActiveInput('remainder')}>
                  <label>{t('game.remainder')}</label>
                  <input type="text" readOnly value={remainderVal} className={activeInput === 'remainder' ? 'ns-input-active' : ''} />
                </div>
              </div>
              <button className="ns-btn ns-btn-submit" onClick={submitDivisionAnswer}>{t('game.submitAnswer')}</button>

              <div className="ns-numpad">
                {[1,2,3,4,5,6,7,8,9].map(num => <button key={num} onClick={()=>handleNumpadInput(num)} className="ns-key">{num}</button>)}
                <button onClick={()=>handleNumpadInput('clear')} className="ns-key ns-key-danger" style={{fontSize:'1.2rem'}}>{t('game.clear')}</button>
                <button onClick={()=>handleNumpadInput(0)} className="ns-key">0</button>
                <button onClick={()=>handleNumpadInput('back')} className="ns-key ns-key-back">⌫</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'game' && (stage === 'number_recognition_99_select' || stage === 'number_recognition_9_select') && (
          <div className="ns-screen" style={{ background: '#fff', padding: '20px' }}>
            <div className="ns-chips" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
              <span className="ns-chip">{nrMarkedCount} / 5 marked</span>
            </div>

            <div className="ns3-mark-grid">
              {(nrBank.length === 10 ? [nrBank.slice(0, 4), nrBank.slice(4, 6), nrBank.slice(6, 10)] : [nrBank])
                .map((row, rowIdx) => (
                  <div className="ns3-mark-row" key={rowIdx}>
                    {row.map(({ key, display }) => {
                      const isSelected = nrSelectedTexts.includes(key);
                      const isMarked = key in nrMarks;
                      return (
                        <div
                          key={key}
                          className={`ns3-mark-tile ${isSelected ? 'ns3-mark-tile-selected' : ''}`}
                          onClick={() => toggleNrTileSelection(key)}
                          style={{ cursor: isMarked ? 'default' : 'pointer' }}
                        >
                          <div className="ns3-mark-tile-text">{display}</div>
                          <div className={`ns3-mark-toggle-row ${isSelected ? 'visible' : ''}`}>
                            <button
                              aria-label="Mark as correct"
                              className={`ns3-mark-toggle-btn ${nrMarks[key] === 'correct' ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); markNrTile(key, true); }}
                            >✓</button>
                            <button
                              aria-label="Mark as incorrect"
                              className={`ns3-mark-toggle-btn ${nrMarks[key] === 'incorrect' ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); markNrTile(key, false); }}
                            >✗</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>

            <div className="ns-response-buttons">
              <button className="ns-btn ns-btn-primary" disabled={!canContinueNrMarking} onClick={handleFinishNrMarking}>
                {t('game.finishAssessment')}
              </button>
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
              {finalLevel && (
                <>
                  <div className="ns-score-top">
                    <div className="ns-score-dial-container">
                      <div className="ns-score-dial-big">{finalScore}</div>
                      <div className="ns-score-dial-small">/ {LEVELS.Division}</div>
                    </div>

                    <div className="ns-metric-grid">
                      <div className="ns-metric-box">
                        <label>{t('game.finalResults')}</label>
                        <div className="metric-val">{finalLevel}</div>
                      </div>
                      <div className="ns-metric-box">
                        <label>{t('game.totalTimeMetric')}</label>
                        <div className="metric-val">{formatSec(totalDuration)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="ns3-path-trail">
                    {path.filter(s => STAGE_LABELS[s]).map((p, i, arr) => (
                      <React.Fragment key={i}>
                        <span className="ns-chip">{STAGE_LABELS[p]}</span>
                        {i < arr.length - 1 && <span className="ns3-path-arrow">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}

              <div style={{ marginTop: '20px', overflowX: 'auto', marginBottom: '30px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Stage</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{t('game.scoreTable.status')}</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Detail</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>{t('game.scoreTable.duration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {path.filter(s => STAGE_LABELS[s]).map((stageName, idx) => {
                      const r = getPathStageResult(stageName);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#334155' }}>{STAGE_LABELS[stageName]}</td>
                          <td style={{ padding: '12px 16px' }}>{r.correct !== undefined ? renderPassBadge(r.correct) : '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#334155' }}>{r.detail}</td>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: '#64748b', fontFamily: 'monospace' }}>{formatSec(r.duration)}</td>
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
          src={getAudioUrl('splash', '/assets/audios/number_skill_v3/splash.wav')}
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
              <button className="ns-btn ns-btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => { unlockAudioContext(); resumeGame(); }}>{t('game.resumeGame')}</button>
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

export default NumberSkillGameV3;
