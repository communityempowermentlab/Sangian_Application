import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage, STT_LANG_MAP } from '../contexts/LanguageContext';
import { useHeaderConfig } from '../contexts/HeaderConfigContext';
import { useResponseMatching } from '../contexts/ResponseMatchingContext';
import { useTestAudio } from '../hooks/useTestAudio';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import { Capacitor } from '@capacitor/core';
import { unlockAudioContext } from '../utils/audioUnlock';
import { StatusBar } from '@capacitor/status-bar';
import './NumberRecallGameV2.css';

// ─── Game Name ─────────────────────────────────────────────────
const GAME_NAME = 'number_recall_lottery_v2';
const TOTAL_SCORED_QUESTIONS = 20;
const TEACHING_QUESTION_COUNT = 2;
const TOTAL_ALL_QUESTIONS = TOTAL_SCORED_QUESTIONS + TEACHING_QUESTION_COUNT;
const MAX_CONSECUTIVE_WRONG = 3;

// ─── Asset Paths ───────────────────────────────────────────────
const AUDIO_PATH = '/assets/audios/lottery_ka_ticket_V2';
const IMAGE_PATH = '/assets/images/lottery_ka_ticket_V2';

// ─── Numpad key layout ──────────────────────────────────────────
const NUMPAD_KEYS = [
  { label: '1', val: 1 }, { label: '2', val: 2 }, { label: '3', val: 3 },
  { label: '4', val: 4 }, { label: '5', val: 5 }, { label: '6', val: 6 },
  { label: '8', val: 8 }, { label: '9', val: 9 }, { label: '10', val: 10 },
  { label: 'Clear', action: 'clear', cls: 'nr-key-danger' },
];

// ─── Helpers ────────────────────────────────────────────────────
// Correctness is always a strict exact match — same length, same values, same
// order. The "Response Matching Mode" admin setting controls only when the
// user is allowed to *proceed* (see isResponseReady below); it never changes
// what counts as a correct answer.
const exactMatch = (selected, correct) => {
  if (selected.length !== correct.length) return false;
  return selected.every((v, i) => v === correct[i]);
};

const formatTime = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// Matches the "Xm SSs" format used by the Admin Reports screentime column,
// so the score screen's chip always reads identically to the report.
const fmtScreentime = (sec) => {
  const s = Math.round(Number(sec) || 0);
  return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
};

const formatDurationMs = (ms) => {
  if (!ms || ms < 0) return '0:00';
  return formatTime(Math.floor(ms / 1000));
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

const getSP = (age) => (age >= 3 && age <= 6) ? '5-1' : '5-4';

// ─── Numpad Panel Sub-Component ─────────────────────────────────
const NumpadPanel = ({
  title, chipLabel, audioSrc, qTimerDisplay,
  correct, maxSelect,
  onCorrect, onWrong, onAdvance,
  isScored = false, autoPlay = false, isLastQuestion = false, nextQuestionLabel,
}) => {
  const { t } = useLanguage();
  const { responseMatchingMode, displayUserInputString } = useResponseMatching();
  const isPartialMatch = responseMatchingMode === 'partial';
  const [selected, setSelected] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);

  const audioRef = useRef(null);

  const resolveAudio = (src) => {
    if (!src) return '';
    if (src.startsWith('/uploads/')) {
      const SERVER_BASE = API_URL.replace(/\/api$/, '');
      return `${SERVER_BASE}${src}`;
    }
    return `${AUDIO_PATH}/${src}`;
  };

  const playAudio = useCallback((isManual = false) => {
    if (!audioSrc) return;
    if (isManual) setReplayCount(prev => prev + 1);
    setIsPlaying(true);
    setSelected([]); // Clear selections when replaying audio
    if (!audioRef.current) {
      audioRef.current = new Audio(resolveAudio(audioSrc));
      audioRef.current.addEventListener('playing', () => setIsPlaying(true));
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
      audioRef.current.addEventListener('pause', () => setIsPlaying(false));
      audioRef.current.addEventListener('error', () => setIsPlaying(false));
    }
    setIsPlaying(true);
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => setIsPlaying(false));
  }, [audioSrc]);

  useEffect(() => {
    if (autoPlay) {
      const t = setTimeout(() => playAudio(false), 400);
      return () => clearTimeout(t);
    }
  }, [autoPlay, playAudio]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  // Numpad and Clear are locked while audio plays
  const isInputDisabled = isPlaying;

  const handleKey = (k) => {
    if (isInputDisabled) return;
    if (k.action === 'clear') { setSelected([]); return; }
    if (k.val != null) {
      if (selected.length >= maxSelect) return;
      setSelected([...selected, k.val]);
    }
  };

  // The question button itself is the only progression control: it lights up once
  // the response meets the configured matching mode, and submitting + advancing
  // happen together in a single click.
  const isResponseReady = isPartialMatch ? selected.length > 0 : selected.length === maxSelect;

  const handleSubmitAndAdvance = () => {
    if (isPlaying || !isResponseReady) return;
    const isCorrect = exactMatch(selected, [...correct].reverse());
    if (isCorrect) {
      onCorrect && onCorrect(selected, replayCount);
    } else {
      onWrong && onWrong(selected, replayCount);
    }
    onAdvance && onAdvance();
  };

  return (
    <div className="nr-panel-wrap">
      {displayUserInputString && (
        <div className="nr-input-display" style={{ visibility: selected.length > 0 ? 'visible' : 'hidden' }}>
          {selected.join(' ')}
        </div>
      )}
      <div className="nr-numpad-wrap">
        <div className="nr-numpad" style={{ pointerEvents: isInputDisabled ? 'none' : 'auto', opacity: isInputDisabled ? 0.45 : 1 }}>
          {NUMPAD_KEYS.map((k, i) => (
            <button key={i} className={`nr-key ${k.cls || ''}`} onClick={() => handleKey(k)}>
              {k.action === 'clear' ? t('game.clear') : k.label}
            </button>
          ))}
        </div>

        <div className="nr-numpad-actions">
          <div className="nr-action-feedback">
            <button className="nr-replay-btn" onClick={() => playAudio(true)} disabled={isPlaying}>
              {t('game.reply')}
            </button>
          </div>
          <button
            className="nr-btn-next"
            disabled={!isResponseReady}
            onClick={handleSubmitAndAdvance}
          >
            {isLastQuestion ? t('game.finishGame') : nextQuestionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Teaching Screen Sub-Component ──────────────────────────────
const TeachingScreen = ({ title, chipLabel, audioSrc, correct, maxSelect, teachingAudioSrc, nextLabel, nextIcon, onNext, onScored }) => {
  const { t } = useLanguage();
  const { displayUserInputString } = useResponseMatching();
  const [selected, setSelected] = useState([]);
  const [firstAttemptDone, setFirstAttemptDone] = useState(false);
  const [teachingAudioPlayed, setTeachingAudioPlayed] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [mainAudioDone, setMainAudioDone] = useState(false);
  const [showTeachingAudio, setShowTeachingAudio] = useState(false);

  const mainAudioRef = useRef(null);
  const teachingAudioRef = useRef(null);

  const resolveAudio = (src) => {
    if (!src) return '';
    if (src.startsWith('/uploads/')) {
      const SERVER_BASE = API_URL.replace(/\/api$/, '');
      return `${SERVER_BASE}${src}`;
    }
    return `${AUDIO_PATH}/${src}`;
  };

  const playMainAudio = useCallback((isManual = false) => {
    if (!audioSrc) return;
    if (isManual) setReplayCount(prev => prev + 1);
    setSelected([]);
    if (!mainAudioRef.current) {
      mainAudioRef.current = new Audio(resolveAudio(audioSrc));
      mainAudioRef.current.addEventListener('playing', () => setIsPlaying(true));
      mainAudioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setMainAudioDone(true);
      });
    } else {
      mainAudioRef.current.src = resolveAudio(audioSrc);
    }
    mainAudioRef.current.currentTime = 0;
    mainAudioRef.current.play().catch(() => setIsPlaying(false));
  }, [audioSrc]);

  const playTeachingAudio = useCallback(() => {
    if (!teachingAudioSrc) {
      setTeachingAudioPlayed(true);
      setSelected([]);
      setIsWaiting(false);
      return;
    }
    if (!teachingAudioRef.current) {
      teachingAudioRef.current = new Audio(resolveAudio(teachingAudioSrc));
      teachingAudioRef.current.addEventListener('ended', () => {
        setTeachingAudioPlayed(true);
        setSelected([]);
        setIsWaiting(false);
      });
      teachingAudioRef.current.addEventListener('error', () => {
        setTeachingAudioPlayed(true);
        setSelected([]);
        setIsWaiting(false);
      });
    } else {
      teachingAudioRef.current.src = resolveAudio(teachingAudioSrc);
    }
    teachingAudioRef.current.currentTime = 0;
    teachingAudioRef.current.play().catch(() => {
      setTeachingAudioPlayed(true);
      setSelected([]);
      setIsWaiting(false);
    });
  }, [teachingAudioSrc]);

  useEffect(() => {
    const t = setTimeout(() => playMainAudio(false), 400);
    return () => {
      clearTimeout(t);
      if (mainAudioRef.current) { mainAudioRef.current.pause(); mainAudioRef.current = null; }
      if (teachingAudioRef.current) { teachingAudioRef.current.pause(); teachingAudioRef.current = null; }
    };
  }, [playMainAudio]);

  const handleKey = (k) => {
    if (isWaiting) return;
    if (k.action === 'clear') { setSelected([]); return; }
    if (k.val != null) {
      if (selected.length >= maxSelect) return;
      const next = [...selected, k.val];
      setSelected(next);
      if (next.length === maxSelect) evaluateAnswer(next);
    }
  };

  const evaluateAnswer = (sel) => {
    const correct_ = exactMatch(sel, [...correct].reverse());
    setIsCorrect(correct_);

    if (!firstAttemptDone) {
      setFirstAttemptDone(true);
      onScored && onScored(sel, correct_); // Score is locked to the first attempt only
      if (!correct_ && teachingAudioSrc) {
        setIsWaiting(true);
        playTeachingAudio();
      } else if (!correct_ && !teachingAudioSrc) {
        // No teaching audio — second attempt allowed freely
      }
    }
    // second attempt or correct: show next button (handled in render)
  };

  const showNextButton = firstAttemptDone && (isCorrect || teachingAudioPlayed || !teachingAudioSrc);

  return (
    <div className="nr-panel-wrap">
      {displayUserInputString && (
        <div className="nr-input-display" style={{ visibility: selected.length > 0 ? 'visible' : 'hidden' }}>
          {selected.join(' ')}
        </div>
      )}
      <div className="nr-numpad-wrap">
        <div className="nr-numpad" style={{ pointerEvents: isWaiting ? 'none' : 'auto', opacity: isWaiting ? 0.5 : 1 }}>
          {NUMPAD_KEYS.map((k, i) => (
            <button key={i} className={`nr-key ${k.cls || ''}`} onClick={() => handleKey(k)}>
              {k.action === 'clear' ? t('game.clear') : k.label}
            </button>
          ))}
        </div>

        <div className="nr-numpad-actions">
          <div className="nr-action-feedback">
            <button className="nr-replay-btn" onClick={() => playMainAudio(true)} disabled={isPlaying || showNextButton}>
              {t('game.reply')}
            </button>
            {!isWaiting && firstAttemptDone && !isCorrect && !teachingAudioPlayed && teachingAudioSrc && (
              <div className="nr-action-msg" style={{ color: '#f87171' }}>{t('game.incorrectFeedback')}</div>
            )}
            {!isWaiting && firstAttemptDone && !showNextButton && !isCorrect && !teachingAudioSrc && (
              <div className="nr-action-msg" style={{ color: '#f87171' }}>{t('game.notQuiteRight')}</div>
            )}
          </div>
          <button
            className="nr-btn-next"
            disabled={!showNextButton}
            onClick={() => showNextButton && onNext && onNext()}
          >
            <span>{nextIcon}</span>
            <span>{nextLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────
const NumberRecallGameV2 = () => {
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
  const [childData, setChildData] = useState(null);
  const [activityData, setActivityData] = useState({ lastPlayed: 'Never', attempts: 0 });
  const [screen, setScreen] = useState('splash'); // splash | practice | teaching1 | teaching2 | game | score
  const [questionIndex, setQuestionIndex] = useState(0);
  const [allScores, setAllScores] = useState([]);
  const [teachingScores, setTeachingScores] = useState([]);
  const [attemptNo, setAttemptNo] = useState(1);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [qTimer, setQTimer] = useState(0);
  const [gameSessionId, setGameSessionId] = useState(null);
  const [pauses, setPauses] = useState([]);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  
  // Dynamic Questions State
  const [questions, setQuestions] = useState([]);
  const [practiceQ, setPracticeQ] = useState(null);
  const [teaching1Q, setTeaching1Q] = useState(null);
  const [teaching2Q, setTeaching2Q] = useState(null);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  // Refs for race-condition-safe callbacks
  const questionIndexRef = useRef(0);
  const consecutiveWrongRef = useRef(0);
  const allScoresRef = useRef([]);
  const teachingScoresRef = useRef([]);
  const qTimerRef = useRef(0);
  const gameSessionIdRef = useRef(null);
  const timerSecondsRef = useRef(0);
  const pausesRef = useRef([]);

  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [audioFinished, setAudioFinished] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Assessment form
  const [showGrid, setShowGrid] = useState(false);
  const [assessment, setAssessment] = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);

  // STT
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);

  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const { getAudioUrl, ready: audioReady } = useTestAudio('number_recall_lottery_v2');

  const sp = childData?.age ? getSP(childData.age) : '—';
  const totalScore = allScores.filter(s => s.score === 1).length + teachingScores.filter(s => s.score === 1).length;

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

  // ── Child data + resume check ──────────────────────────────
  useEffect(() => {
    const dataStr = localStorage.getItem('currentChild');
    if (!dataStr) { navigate('/login'); return; }
    const parsed = JSON.parse(dataStr);
    setChildData(parsed);
    checkResume(parsed.child_id);
    fetchActivity(parsed.child_id);
  }, [navigate]);

  const fetchActivity = async (childId) => {
    try {
      const res = await axios.get(`${API_URL}/games/sessions/summaries/${childId}`);
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

  const loadQuestions = async () => {
    try {
      const res = await axios.get(`${API_URL}/games/number-recall-v2/questions`);
      if (res.data.success) {
        const allQ = res.data.questions;
        const parseSeq = (seq) => seq.split(',').map(n => parseInt(n.trim(), 10));
        
        const mapQ = (q) => ({
          qid: q.qid,
          correct: parseSeq(q.correct_sequence),
          maxSelect: q.max_select,
          audio: q.audio_file,
          teachingAudio: q.teaching_audio
        });

        const gameQs = allQ.filter(q => !q.is_teaching).map(mapQ);
        const pQ = allQ.find(q => q.qid === 'Practice');
        const t1Q = allQ.find(q => q.qid === 'Teaching 1');
        const t2Q = allQ.find(q => q.qid === 'Teaching 2');

        setQuestions(gameQs);
        if (pQ) setPracticeQ(mapQ(pQ));
        if (t1Q) setTeaching1Q(mapQ(t1Q));
        if (t2Q) setTeaching2Q(mapQ(t2Q));
      }
    } catch (e) {
      console.error('Questions fetch error', e);
    } finally {
      setIsConfigLoaded(true);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/am|pm/g, match => match.toUpperCase());
  };

  // ── Splash audio autoplay ──────────────────────────────────
  useEffect(() => {
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && audioRef.current && !audioFinished && audioReady) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setAudioFinished(true));
    }
  }, [isCheckingSession, screen, showResumeModal, audioFinished, audioReady]);

  // ── Session timer ──────────────────────────────────────────
  // Keeps running on the score screen until the assessor submits the Session
  // Assessment Details form — screentime is meant to include that time. The
  // saved DB value is refreshed at submission time (see submitAssessmentForm)
  // so the report matches what's shown here, instead of an earlier snapshot.
  useEffect(() => {
    if ((screen !== 'splash' && screen !== 'score' && !showQuitModal) || (screen === 'score' && !assessmentSubmitted)) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, showQuitModal, assessmentSubmitted]);

  // ── Question timer ─────────────────────────────────────────
  useEffect(() => {
    // Timer runs only if the current question hasn't been answered yet
    if (screen === 'game' && !showQuitModal && allScores.length <= questionIndex) {
      const interval = setInterval(() => setQTimer(p => p + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [screen, showQuitModal, allScores.length, questionIndex]);

  // ── Sync refs with state ───────────────────────────────────
  useEffect(() => { questionIndexRef.current = questionIndex; }, [questionIndex]);
  useEffect(() => { allScoresRef.current = allScores; }, [allScores]);
  useEffect(() => { teachingScoresRef.current = teachingScores; }, [teachingScores]);
  useEffect(() => { qTimerRef.current = qTimer; }, [qTimer]);
  useEffect(() => { gameSessionIdRef.current = gameSessionId; }, [gameSessionId]);
  useEffect(() => { timerSecondsRef.current = timerSeconds; }, [timerSeconds]);
  useEffect(() => { pausesRef.current = pauses; }, [pauses]);

  // ── Auto-save on question advance ─────────────────────────
  useEffect(() => {
    if (screen === 'game' && questionIndex > 0) saveToServer('in_progress');
  }, [questionIndex]);

  // ── API calls ──────────────────────────────────────────────
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

  const startNewGame = async () => {
    try {
      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childData.child_id,
        game_name: GAME_NAME,
        total_questions: TOTAL_ALL_QUESTIONS,
      });
      setGameSessionId(res.data.sessionId);
      setAttemptNo(res.data.attempt_no || 1);
      resetInternalState();
      setScreen('practice');
    } catch (e) {
      alert(t('common.failedToStart'));
      resetInternalState();
      setScreen('practice');
    }
  };

  const resumeGame = () => {
    setGameSessionId(resumeData.id);
    setAttemptNo(resumeData.attempt_no || 1);
    const saved = resumeData.saved_state || {};
    setQuestionIndex(saved.questionIndex || 0);
    setAllScores(saved.allScores || []);
    setTeachingScores(saved.teachingScores || []);
    teachingScoresRef.current = saved.teachingScores || [];
    setTimerSeconds(saved.timerSeconds || 0);
    setQTimer(saved.qTimer || 0);
    setPauses(saved.pauses || []);
    setConsecutiveWrong(saved.consecutiveWrong || 0);
    setScreen('game');
    setShowResumeModal(false);
  };

  const resetInternalState = () => {
    setQuestionIndex(0); questionIndexRef.current = 0;
    setAllScores([]); allScoresRef.current = [];
    setTeachingScores([]); teachingScoresRef.current = [];
    setTimerSeconds(0); timerSecondsRef.current = 0;
    setQTimer(0); qTimerRef.current = 0;
    setPauses([]); pausesRef.current = [];
    setConsecutiveWrong(0); consecutiveWrongRef.current = 0;
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
    setQuitReason('');
    setAssessmentSubmitted(false);
  };

  const saveToServer = async (statusOverride, reason) => {
    if (!gameSessionIdRef.current) return;
    try {
      let updatedPauses = [...pausesRef.current];
      if (reason && (statusOverride === 'paused' || statusOverride === 'quit')) {
        updatedPauses.push({ questionNumber: questionIndexRef.current + 1, reason, timestamp: new Date().toISOString() });
        setPauses(updatedPauses);
        pausesRef.current = updatedPauses;
      }
      await axios.put(`${API_URL}/games/sessions/update/${gameSessionIdRef.current}`, {
        score: allScoresRef.current.filter(s => s.score === 1).length + teachingScoresRef.current.filter(s => s.score === 1).length,
        progress_level: questionIndexRef.current + 1,
        status: statusOverride || 'in_progress',
        quit_reason: reason || null,
        saved_state: {
          questionIndex: questionIndexRef.current,
          allScores: allScoresRef.current,
          teachingScores: teachingScoresRef.current,
          timerSeconds: timerSecondsRef.current,
          qTimer: qTimerRef.current,
          pauses: updatedPauses,
          consecutiveWrong: consecutiveWrongRef.current
        },
      });
    } catch (e) { console.error('Save error', e); }
  };

  // Teaching Q1/Q2 are scored like standard questions — locked to the child's first
  // attempt, before any teaching-audio correction is played (see TeachingScreen's onScored).
  const recordTeachingScore = useCallback((qId, qLabel, correctAnswer, sel, isCorrect) => {
    const entry = {
      qId,
      question: qLabel,
      score: isCorrect ? 1 : 0,
      attempts: 1,
      duration_ms: null,
      expected_response: correctAnswer.join(', '),
      user_response: (sel || []).join(', '),
      replayCount: 0,
    };
    const updated = [...teachingScoresRef.current, entry];
    teachingScoresRef.current = updated;
    setTeachingScores(updated);
  }, []);

  // ── Scoring logic — uses refs to avoid stale closures ──────
  const handleCorrect = useCallback((sel, replays = 0) => {
    const currentQ = questions[questionIndexRef.current];
    const newScore = {
      question: `Q${currentQ.qid}`,
      score: 1,
      attempts: attemptNo,
      duration_ms: qTimerRef.current,
      expected_response: currentQ.correct.join(', '),
      user_response: sel.join(', '),
      replayCount: replays,
    };
    const upScores = [...allScoresRef.current, newScore];
    allScoresRef.current = upScores;
    setAllScores(upScores);
    consecutiveWrongRef.current = 0;
    setConsecutiveWrong(0);
  }, [questions, attemptNo]);

  const handleWrong = useCallback((userResponse, replays = 0) => {
    const currentQ = questions[questionIndexRef.current];
    const newScore = {
      question: `Q${currentQ.qid}`,
      score: 0,
      attempts: attemptNo,
      duration_ms: qTimerRef.current,
      expected_response: currentQ.correct.join(', '),
      user_response: userResponse.join(', '),
      replayCount: replays,
    };
    const upScores = [...allScoresRef.current, newScore];
    allScoresRef.current = upScores;
    setAllScores(upScores);
    const newConsec = consecutiveWrongRef.current + 1;
    consecutiveWrongRef.current = newConsec;
    setConsecutiveWrong(newConsec);
  }, [questions, attemptNo]);

  const endGame = (isDroppedOut) => {
    setScreen('score');
    saveToServer(isDroppedOut ? 'dropped' : 'completed');
    if (!isDroppedOut) {
      setTimeout(() => generateAndUploadPDF(), 1000);
    }
  };

  const handleAdvance = useCallback(() => {
    if (questionIndexRef.current + 1 >= questions.length || consecutiveWrongRef.current >= MAX_CONSECUTIVE_WRONG) {
      endGame(consecutiveWrongRef.current >= MAX_CONSECUTIVE_WRONG);
    } else {
      setQuestionIndex(prev => { questionIndexRef.current = prev + 1; return prev + 1; });
      setAttemptNo(1);
      setQTimer(0);
      qTimerRef.current = 0;
    }
  }, [questions]);

  const handleQuit = async (status) => {
    if (!quitReason.trim()) { alert(t('common.enterReason')); return; }
    await saveToServer(status, quitReason);
    if (status === 'quit') {
      setShowQuitModal(false);
      setScreen('score');
      setTimeout(() => { generateAndUploadPDF(); }, 1000);
    } else {
      navigate('/');
    }
  };

  const toggleRecording = (target) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert(t('common.speechNotSupported')); return; }
    if (isRecording && recordingTarget === target) {
      if (window.activeRecognition) {
        window.activeRecognition.onend = null;
        window.activeRecognition.onerror = null;
        try { window.activeRecognition.stop(); } catch(e) {}
      }
      setIsRecording(false); setRecordingTarget(null); return;
    }

    if (window.activeRecognition) {
      window.activeRecognition.onend = null;
      window.activeRecognition.onerror = null;
      try { window.activeRecognition.stop(); } catch(e) {}
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.lang = STT_LANG_MAP[language] || 'en-US';
    
    recognition.onresult = (event) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
      }
      if (final) {
        if (target === 'quitReason') setQuitReason(p => p + final);
        else if (target === 'assessmentNotes') setAssessment(p => ({ ...p, notes: p.notes + final }));
      }
    };
    recognition.onend = () => { setIsRecording(false); setRecordingTarget(null); };
    recognition.onerror = (e) => { 
      setIsRecording(false); 
      setRecordingTarget(null); 
      alert(t('game.speechError') + ' / iPad Error: ' + (e.error || 'unknown'));
    };
    window.activeRecognition = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingTarget(target);
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
        additional_notes: assessment.notes,
      });
      setAssessmentSubmitted(true);

      if (gameSessionIdRef.current) {
        axios.put(`${API_URL}/games/sessions/update/${gameSessionIdRef.current}`, {
          saved_state: {
            questionIndex: allScoresRef.current.length,
            allScores: allScoresRef.current,
            teachingScores: teachingScoresRef.current,
            timerSeconds: timerSecondsRef.current,
            pauses: pausesRef.current,
            consecutiveWrong: consecutiveWrongRef.current,
          },
        }).catch(e => console.error('Screentime refresh error', e));
      }

      setTimeout(() => {
        generateAndUploadPDF();
      }, 1000);
      
      alert(t('game.assessmentSubmitted'));
    } catch (e) {
      console.error(e);
      alert(t('common.failedToSave'));
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const generateAndUploadPDF = async () => {
    let wrapper = null;
    try {
      const element = document.getElementById('dashboard-capture-area');
      if (!element) return;

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Clone into a clean wrapper on document.body — .nr-app is
      // `position:fixed` with backdrop-filter, so capturing the live element
      // in place clips it to the viewport instead of its full content size.
      const originalNodes = element.querySelectorAll('*');
      const clone = element.cloneNode(true);
      const cloneNodes = clone.querySelectorAll('*');
      clone.style.animation = 'none';
      clone.style.opacity = '1';
      cloneNodes.forEach((node, i) => {
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
        // Generous fixed desktop-class width rather than the live element's
        // scrollWidth — see ChorMachayeShorGame's PDF capture for why tying
        // wrapper width to the live (possibly narrow) viewport re-triggers
        // clipping inside the app shell's width:100%+overflow:hidden.
        'width:' + Math.max(element.scrollWidth, 1400) + 'px',
        'background:#ffffff', 'padding:20px',
        'z-index:-9999', 'pointer-events:none',
      ].join(';');
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: wrapper.scrollWidth,
        windowHeight: wrapper.scrollHeight
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);

      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const pdfBlob = pdf.output('blob');

      const formData = new FormData();
      const childNameSafe = (childData?.name || childData?.child_id || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
      const ts = new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14);
      formData.append('pdf', pdfBlob, `${childNameSafe}_Lottery_Ka_Ticket_SES${gameSessionId}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', gameSessionId);
      formData.append('game_name', 'number_recall_lottery');

      await axios.post(`${API_URL}/games/pdfs/upload`, formData);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    } finally {
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
  };

  // Teaching Q1/Q2 are treated as standard scored questions here: they're folded into
  // the combined total, correct/incorrect counts, accuracy %, and the results table.
  const combinedScores = [...teachingScores, ...allScores];
  const attempted = combinedScores.length;
  const correct = combinedScores.filter(s => s.score === 1).length;
  const wrong = combinedScores.filter(s => s.score === 0).length;
  const accuracyPct = ((correct / (questions.length + TEACHING_QUESTION_COUNT)) * 100).toFixed(1);
  const totalTimeMs = combinedScores.reduce((acc, s) => acc + (s.duration_ms || 0) * 1000, 0);
  const avgTimeMs = attempted > 0 ? (totalTimeMs / attempted) : 0;
  
  if ((!childData || isCheckingSession || !isConfigLoaded) && screen !== 'splash') {
    return <div className="nr-loading">Loading / Syncing...</div>;
  }

  const currentQ = questions[questionIndex];

  return (
    <div className="nr-app">
      <header className="nr-topbar">
        <div className="nr-brand">
          {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="nr-brand-img" />}
          {showLogo && (showGameIcon || showGameName) && <div className="nr-divider"></div>}
          {showGameIcon && <img src="/assets/images/lottery_ka_ticket_V2/lottery_ka_ticket.jpg" alt="Number Recall" className="nr-test-logo" />}
          {showGameName && <span className="nr-test-title">{t('home.games.lottery.title')}{t('common.version2')}</span>}
        </div>

        <div className="nr-topbar-center">
          {screen === 'practice' && <div className="nr-topbar-screen-title">{t('game.practiceQuestionLabel')}</div>}
          {screen === 'teaching1' && <div className="nr-topbar-screen-title">{t('game.teachingQ1Label')}</div>}
          {screen === 'teaching2' && <div className="nr-topbar-screen-title">{t('game.teachingQ2Label')}</div>}
          {screen === 'game' && <div className="nr-topbar-screen-title">{t('game.question')} {questionIndex + 1}</div>}
          {screen === 'score' && <div className="nr-topbar-screen-title">{quitReason ? t('game.assessmentTerminated') : t('game.assessmentComplete')}</div>}
        </div>

        <div className="nr-stats">
          {showChildId && childData?.child_id && (
            <div className="nr-stat-pill">
              <span className="nr-stat-icon">👤</span>
              <span className="nr-stat-value">{childData.child_id}</span>
            </div>
          )}
          {showTimer && screen === 'game' && (
            <div className="nr-stat-pill">
              <span className="nr-stat-icon">⏱</span>
              <span className="nr-stat-value">{formatTime(qTimer)}</span>
            </div>
          )}
          {showScore && (
            <div className="nr-stat-pill">
              <span className="nr-stat-icon">🏆</span>
              <span className="nr-stat-value">{totalScore}</span>
            </div>
          )}
          {screen === 'game' && (
            <button
              className="btn-pause-quit"
              onClick={() => { setQuitReason(''); setShowQuitModal(true); }}
            >
              <span>⏸</span> {t('game.pauseQuit')}
            </button>
          )}
        </div>
      </header>

      <main className={`nr-main${screen === 'splash' ? ' nr-main-splash' : ''}`}>
        {screen === 'splash' && (
          <div className="nr-screen nr-screen-splash">
            <div className="nr-splash-cover">
              <img src={`${IMAGE_PATH}/lottery_ka_ticket.jpg`} alt="Lottery Ka Ticket" className="nr-splash-img-full" onError={e => { e.target.style.display = 'none'; }} />
              <div className="nr-splash-btn-overlay">
                <button
                  className={`nr-btn nr-btn-primary ${(!audioFinished || isCheckingSession || !isConfigLoaded) ? 'nr-btn-disabled' : 'nr-btn-highlight'}`}
                  disabled={!audioFinished || isCheckingSession || !isConfigLoaded}
                  onClick={() => { unlockAudioContext(); startNewGame(); }}
                >
                  {t('game.startNow')}
                </button>
                <button
                  className="nr-btn nr-btn-secondary"
                  onClick={() => {
                    if (audioRef.current) {
                      setAudioFinished(false);
                      audioRef.current.currentTime = 0;
                      audioRef.current.play().catch(() => setAudioFinished(true));
                    }
                  }}
                >
                  {t('game.replayAudio')}
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === 'practice' && practiceQ && (
          <div className="nr-screen">
            <TeachingScreen
              title={`${t('game.practiceLabel')} · 1`}
              chipLabel={t('game.practiceLabel')}
              audioSrc={practiceQ.audio}
              correct={practiceQ.correct}
              maxSelect={practiceQ.maxSelect}
              teachingAudioSrc={practiceQ.teachingAudio}
              nextLabel={t('game.teachingQ1Label')}
              nextIcon=""
              onNext={() => setScreen('teaching1')}
            />
          </div>
        )}

        {/* ─────────────── TEACHING 1 ─────────────── */}
        {screen === 'teaching1' && (
          <div className="nr-screen">
            <TeachingScreen
              title={`${t('game.teachingLabel')} · Teaching 1`}
              chipLabel={t('game.teachingLabel')}
              audioSrc="2_8.m4a"
              correct={[2, 8]}
              maxSelect={2}
              teachingAudioSrc="2_8_teaching_audio.m4a"
              nextLabel={t('game.teachingQ2Label')}
              nextIcon=""
              onNext={() => setScreen('teaching2')}
              onScored={(sel, isCorrect) => recordTeachingScore('teaching1', 'Teaching 1', [2, 8], sel, isCorrect)}
            />
          </div>
        )}

        {/* ─────────────── TEACHING 2 ─────────────── */}
        {screen === 'teaching2' && (
          <div className="nr-screen">
            <TeachingScreen
              title={`${t('game.teachingLabel')} · Teaching 2`}
              chipLabel={t('game.teachingLabel')}
              audioSrc="5_10.m4a"
              correct={[5, 10]}
              maxSelect={2}
              teachingAudioSrc={null}
              nextLabel={t('modal.startGame')}
              nextIcon=""
              onNext={() => setScreen('game')}
              onScored={(sel, isCorrect) => recordTeachingScore('teaching2', 'Teaching 2', [5, 10], sel, isCorrect)}
            />
          </div>
        )}

        {/* ─────────────── GAME ─────────────── */}
        {screen === 'game' && currentQ && (
          <div className="nr-screen">
            <NumpadPanel
              key={`q-${questionIndex}`}
              title={`Question ${questionIndex + 1} of ${TOTAL_SCORED_QUESTIONS}`}
              chipLabel={`${t('game.question')} ${questionIndex + 1}`}
              qTimerDisplay={formatTime(qTimer)}
              audioSrc={currentQ.audio}
              correct={currentQ.correct}
              maxSelect={currentQ.maxSelect}
              isScored={true}
              autoPlay={true}
              isLastQuestion={questionIndex === TOTAL_SCORED_QUESTIONS - 1}
              nextQuestionLabel={`${t('game.question')} ${questionIndex + 2}`}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
              onAdvance={handleAdvance}
            />
          </div>
        )}

        {/* ─────────────── SCORE ─────────────── */}
        {screen === 'score' && (
          <div className="nr-screen" id="dashboard-capture-area">
            <div className="nr-screen-header">
              <div>
                <div className="nr-screen-title">{quitReason ? t('game.assessmentTerminated') : ((consecutiveWrong >= MAX_CONSECUTIVE_WRONG) ? t('game.sessionDropped') : t('game.assessmentComplete'))}</div>
                <div className="nr-screen-subtitle">
                  {quitReason ? `${t('game.reasonLabel')} ${quitReason}` : ((consecutiveWrong >= MAX_CONSECUTIVE_WRONG) ? t('game.stoppedMsg') : t('game.testCompleted'))}
                </div>
              </div>
              <div className="nr-chips">
                <span className="nr-chip" style={{ background: '#4f46e5', color: '#fff' }}>{t('game.attemptLabel')}{attemptNo}</span>
                <span className="nr-chip">{t('game.timeChip')} {fmtScreentime(timerSeconds)}</span>
              </div>
            </div>

            <div className="nr-result-card">
              {/* Score + Stats */}
              <div className="nr-score-top">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="nr-score-dial-container">
                    <div className="nr-score-dial-big">{correct}</div>
                    <div className="nr-score-dial-small">/ {TOTAL_ALL_QUESTIONS}</div>
                  </div>
                </div>

                <div className="nr-metric-grid">
                  {[
                    { label: t('game.correctMetric'), val: correct, cls: 'green' },
                    { label: t('game.incorrectMetric'), val: wrong, cls: 'red' },
                    { label: t('game.accuracyLabel'), val: `${accuracyPct}%`, cls: '', info: true, sub: `${correct} / ${TOTAL_ALL_QUESTIONS}` },
                    { label: t('game.totalTimeMetric'), val: formatDurationMs(totalTimeMs), cls: '' },
                    { label: t('game.avgQMetric'), val: formatDurationMs(avgTimeMs), cls: '' },
                  ].map((m, i) => (
                    <div key={i} className="nr-metric-box">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {m.label}
                        {m.info && <span className="kpi-formula-icon" data-tooltip={t('game.lotteryAccuracyTooltip')}>ⓘ</span>}
                      </label>
                      <div className={`nr-metric-val ${m.cls}`}>{m.val}</div>
                      {m.sub && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{m.sub}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-question results */}
              <div className="nr-q-table-wrap">
                <table className="nr-q-table">
                  <thead>
                    <tr>
                      <th>{t('game.sNo')}</th>
                      <th>{t('game.qNumHeader')}</th>
                      <th>{t('game.question')}</th>
                      <th>{t('game.responseLabel')}</th>
                      <th>{t('game.statusHeader')}</th>
                      <th>{t('game.scoreTable.score')}</th>
                      <th>{t('game.scoreTable.duration')}</th>
                      <th>{t('game.replaysHeader')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedScores.map((s, i) => {
                      const ok = s.score === 1;
                      return (
                        <tr key={i} className={ok ? 'nr-row-correct' : 'nr-row-incorrect'}>
                          <td>{i + 1}</td>
                          <td>{s.question || `Q${i + 1}`}</td>
                          <td style={{ fontFamily: 'monospace' }}>{s.expected_response || ''}</td>
                          <td style={{ fontFamily: 'monospace' }}>{s.user_response || ''}</td>
                          <td>
                            <span className={`nr-status-badge ${ok ? 'nr-badge-correct' : 'nr-badge-incorrect'}`}>
                              {ok ? t('game.scoreTable.correct') : t('game.scoreTable.incorrect')}
                            </span>
                          </td>
                          <td>{s.score}</td>
                          <td style={{ fontFamily: 'monospace' }}>{formatSec(s.duration_ms)}</td>
                          <td style={{ fontFamily: 'monospace' }}>{s.replayCount ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Assessment Form */}
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
                  <button onClick={() => { resetInternalState(); setScreen('splash'); setAudioFinished(false); }} className="nr-btn nr-btn-primary">{t('game.retest')}</button>
                  <button onClick={() => navigate('/')} className="nr-btn nr-btn-secondary">{t('game.home')}</button>
                </>
              </SessionAssessmentForm>
            </div>
          </div>
        )}
      </main>

      {/* Splash audio */}
      {!isCheckingSession && (
        <audio
          ref={audioRef}
          src={getAudioUrl('splash', `${AUDIO_PATH}/splash1.m4a`)}
          preload="auto"
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {/* ─────────────── RESUME MODAL ─────────────── */}
      {showResumeModal && (
        <div className="nr-modal-overlay">
          <div className="nr-modal">
            <h2>{t('game.progressFound')}</h2>
            <p>{t('game.progressDesc')}</p>
            <div className="nr-btn-row" style={{ marginTop: 20 }}>
              <button className="nr-btn nr-btn-secondary" onClick={() => { 
                setShowResumeModal(false); 
                resetInternalState();
                setAudioFinished(false);
                setScreen('splash');
              }}>
                {t('game.restartFresh')}
              </button>
              <button className="nr-btn nr-btn-primary" onClick={() => { unlockAudioContext(); resumeGame(); }}>
                {t('game.resumeGame')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────── QUIT MODAL ─────────────── */}
      {showQuitModal && (
        <div className="nr-modal-overlay">
          <div className="nr-modal">
            <h2>{t('game.pauseQuitTitle')}</h2>
            <p>{t('game.pauseDesc')}</p>
            <div style={{ position: 'relative' }}>
              <textarea
                {...{placeholder: t('game.pausePlaceholder')}}
                value={quitReason}
                onChange={e => setQuitReason(e.target.value)}
                style={{ paddingRight: 44 }}
              />
              <button
                onClick={() => toggleRecording('quitReason')}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: isRecording && recordingTarget === 'quitReason' ? '#ef4444' : '#e2e8f0',
                  color: isRecording && recordingTarget === 'quitReason' ? 'white' : '#475569',
                  border: 'none', borderRadius: '50%', width: 32, height: 32,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit', fontSize: '1rem',
                }}
              >🎙</button>
            </div>
            <div className="nr-btn-row" style={{ marginTop: 16 }}>
              <button className="nr-btn nr-btn-secondary" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem' }} onClick={() => setShowQuitModal(false)}>{t('game.cancel')}</button>
              <button className="nr-btn" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem', background: '#fef08a', color: '#854d0e' }} onClick={() => handleQuit('paused')}>{t('game.pauseSave')}</button>
              <button className="nr-btn" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem', background: '#fee2e2', color: '#991b1b' }} onClick={() => handleQuit('quit')}>{t('game.quitEnd')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NumberRecallGameV2;
