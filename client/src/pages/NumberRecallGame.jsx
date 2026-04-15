import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import './NumberRecallGame.css';

// ─── Game Name ─────────────────────────────────────────────────
const GAME_NAME = 'number_recall_lottery';
const TOTAL_SCORED_QUESTIONS = 20;
const MAX_CONSECUTIVE_WRONG = 3;

// ─── Asset Paths ───────────────────────────────────────────────
const AUDIO_PATH = '/assets/audios/lottery_ka_ticket';
const IMAGE_PATH = '/assets/images/lottery_ka_ticket';

// ─── All 20 scored questions ────────────────────────────────────
const QUESTIONS = [
  { qid: 1,  correct: [8, 9],                   maxSelect: 2, audio: '8_9.m4a' },
  { qid: 2,  correct: [4, 9, 5],                maxSelect: 3, audio: '4_9_5.m4a' },
  { qid: 3,  correct: [9, 1, 6],                maxSelect: 3, audio: '9_1_6.m4a' },
  { qid: 4,  correct: [10, 5, 3],               maxSelect: 3, audio: '10_5_3.m4a' },
  { qid: 5,  correct: [10, 2, 5, 8],            maxSelect: 4, audio: '10_2_5_8.m4a' },
  { qid: 6,  correct: [5, 2, 10, 3],            maxSelect: 4, audio: '5_2_10_3.m4a' },
  { qid: 7,  correct: [6, 1, 9, 5],             maxSelect: 4, audio: '6_1_9_5.m4a' },
  { qid: 8,  correct: [2, 3, 6, 10, 5],         maxSelect: 5, audio: '2_3_6_10_5.m4a' },
  { qid: 9,  correct: [1, 4, 6, 9, 2],          maxSelect: 5, audio: '1_4_6_9_2.m4a' },
  { qid: 10, correct: [3, 10, 1, 5, 8],         maxSelect: 5, audio: '3_10_1_5_8.m4a' },
  { qid: 11, correct: [9, 3, 5, 1, 8, 4],       maxSelect: 6, audio: '9_3_5_1_8_4.m4a' },
  { qid: 12, correct: [10, 2, 4, 9, 1, 6],      maxSelect: 6, audio: '10_2_4_9_1_6.m4a' },
  { qid: 13, correct: [2, 6, 3, 10, 8, 4],      maxSelect: 6, audio: '2_6_3_10_8_4.m4a' },
  { qid: 14, correct: [5, 3, 6, 9, 8, 4, 10],   maxSelect: 7, audio: '5_3_6_9_8_4_10.m4a' },
  { qid: 15, correct: [3, 1, 5, 9, 4, 6, 8],    maxSelect: 7, audio: '3_1_5_9_4_6_8.m4a' },
  { qid: 16, correct: [1, 10, 2, 6, 8, 5, 3],   maxSelect: 7, audio: '1_10_2_6_8_5_3.m4a' },
  { qid: 17, correct: [5, 8, 4, 1, 9, 4, 6, 3], maxSelect: 8, audio: '5_8_4_1_9_4_6_3.m4a' },
  { qid: 18, correct: [1, 8, 5, 3, 9, 4, 6, 2, 10], maxSelect: 9, audio: '1_8_5_3_9_4_6_2_10.m4a' },
  { qid: 19, correct: [9, 1, 2, 6, 4, 3, 8, 5, 10], maxSelect: 9, audio: '9_1_2_6_4_3_8_5_10.m4a' },
  { qid: 20, correct: [10, 5, 1, 9, 8, 2, 4, 6, 3], maxSelect: 9, audio: '10_5_1_9_8_2_4_6_3.m4a' },
];

// ─── Numpad key layout ──────────────────────────────────────────
const NUMPAD_KEYS = [
  { label: '1', val: 1 }, { label: '2', val: 2 }, { label: '3', val: 3 },
  { label: '4', val: 4 }, { label: '5', val: 5 }, { label: '6', val: 6 },
  { label: '8', val: 8 }, { label: '9', val: 9 }, { label: '10', val: 10 },
  { label: 'Clear', action: 'clear', cls: 'nr-key-danger' },
];

// ─── Helpers ────────────────────────────────────────────────────
const exactMatch = (selected, correct) => {
  if (selected.length !== correct.length) return false;
  return selected.every((v, i) => v === correct[i]);
};

const formatTime = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const formatDurationMs = (ms) => {
  if (!ms || ms < 0) return '0:00';
  return formatTime(Math.floor(ms / 1000));
};

const getSP = (age) => (age >= 3 && age <= 6) ? '5-1' : '5-4';

// ─── Numpad Panel Sub-Component ─────────────────────────────────
const NumpadPanel = ({
  title, chipLabel, audioSrc, qTimerDisplay,
  correct, maxSelect,
  onCorrect, onWrong, onAdvance,
  isScored = false, autoPlay = false,
}) => {
  const [selected, setSelected] = useState([]);
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef(null);

  const playAudio = useCallback(() => {
    if (!audioSrc) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(`${AUDIO_PATH}/${audioSrc}`);
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
      const t = setTimeout(playAudio, 400);
      return () => clearTimeout(t);
    }
    return () => {};
  }, [autoPlay, playAudio]);

  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  const formatDisplay = (arr) => arr.length === 0 ? '—' : arr.join(' – ');

  // Numpad and Clear are locked while audio plays OR after an answer
  const isInputDisabled = isPlaying || answered;

  const handleKey = (k) => {
    if (isInputDisabled) return;
    if (k.action === 'clear') { setSelected([]); return; }
    if (k.val != null) {
      if (selected.length >= maxSelect) return;
      const next = [...selected, k.val];
      setSelected(next);
      if (next.length === maxSelect) evaluate(next);
    }
  };

  const evaluate = (sel) => {
    setAnswered(true);
    const isCorrect = exactMatch(sel, correct);
    setWasCorrect(isCorrect);
    if (isCorrect) {
      onCorrect && onCorrect(sel);
      // For scored questions: user clicks Next; for unscored: immediate feedback only
    } else {
      onWrong && onWrong(sel);
      if (isScored) {
        // Auto-advance after short delay so user sees feedback
        setTimeout(() => onAdvance && onAdvance(), 700);
      }
    }
  };

  const hintText = isPlaying
    ? '🔊 Listening…'
    : selected.length < maxSelect
      ? `Select ${maxSelect} number${maxSelect > 1 ? 's' : ''} in order`
      : 'Selection complete';

  return (
    <div>
      <div className="nr-screen-header">
        <div>
          <div className="nr-screen-title">{title}</div>
        </div>
        <div className="nr-chips">
          <span className="nr-chip">{chipLabel}</span>
          {qTimerDisplay && (
            <span className="nr-chip" style={{ color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', fontWeight: 700 }}>
              ⏱ {qTimerDisplay}
            </span>
          )}
        </div>
      </div>

      <div className="nr-numpad-wrap">
        <div className="nr-numpad-top">
          <div className="nr-numpad-title">Listen &amp; Remember</div>
          <button className="nr-replay-btn" onClick={playAudio} disabled={isPlaying}>
            🔊 {isPlaying ? 'Playing…' : 'Replay Audio'}
          </button>
        </div>

        <div className="nr-numpad-display">
          <div className="nr-numpad-entered">{formatDisplay(selected)}</div>
          <div className="nr-numpad-hint">{hintText}</div>
        </div>

        <div className="nr-numpad" style={{ pointerEvents: isInputDisabled ? 'none' : 'auto', opacity: isInputDisabled ? 0.45 : 1 }}>
          {NUMPAD_KEYS.map((k, i) => (
            <button key={i} className={`nr-key ${k.cls || ''}`} onClick={() => handleKey(k)}>
              {k.label}
            </button>
          ))}
        </div>

        <div className="nr-numpad-actions">
          {isPlaying && <div className="nr-action-msg" style={{ color: '#94a3b8' }}>🔊 Listening carefully…</div>}
          {!isPlaying && answered && wasCorrect && (
            isScored
              ? <button className="nr-btn-next" onClick={() => onAdvance && onAdvance()}>✅ Correct! &nbsp; Next Question →</button>
              : <div className="nr-action-msg" style={{ color: '#4ade80' }}>✅ Correct!</div>
          )}
          {!isPlaying && answered && !wasCorrect && isScored && (
            <div className="nr-action-msg" style={{ color: '#fbbf24' }}>Not quite — moving to next question…</div>
          )}
          {!isPlaying && answered && !wasCorrect && !isScored && (
            <>
              <div className="nr-action-msg" style={{ color: '#f87171' }}>❌ Not quite right. Try again.</div>
              <button className="nr-replay-btn" onClick={() => { setSelected([]); setAnswered(false); setWasCorrect(null); }}>↩ Retry</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Teaching Screen Sub-Component ──────────────────────────────
const TeachingScreen = ({ title, chipLabel, audioSrc, correct, maxSelect, teachingAudioSrc, nextLabel, nextIcon, onNext }) => {
  const [selected, setSelected] = useState([]);
  const [firstAttemptDone, setFirstAttemptDone] = useState(false);
  const [teachingAudioPlayed, setTeachingAudioPlayed] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const mainAudioRef = useRef(null);
  const teachingAudioRef = useRef(null);

  const playMainAudio = useCallback(() => {
    if (!audioSrc) return;
    if (!mainAudioRef.current) {
      mainAudioRef.current = new Audio(`${AUDIO_PATH}/${audioSrc}`);
      mainAudioRef.current.addEventListener('playing', () => setIsPlaying(true));
      mainAudioRef.current.addEventListener('ended', () => setIsPlaying(false));
      mainAudioRef.current.addEventListener('error', () => setIsPlaying(false));
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
      teachingAudioRef.current = new Audio(`${AUDIO_PATH}/${teachingAudioSrc}`);
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
    }
    teachingAudioRef.current.currentTime = 0;
    teachingAudioRef.current.play().catch(() => {
      setTeachingAudioPlayed(true);
      setSelected([]);
      setIsWaiting(false);
    });
  }, [teachingAudioSrc]);

  useEffect(() => {
    const t = setTimeout(playMainAudio, 400);
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
    const correct_ = exactMatch(sel, correct);
    setIsCorrect(correct_);

    if (!firstAttemptDone) {
      setFirstAttemptDone(true);
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
  const formatDisplay = (arr) => arr.length === 0 ? '—' : arr.join(' – ');
  const hintText = selected.length < maxSelect ? `Select ${maxSelect} numbers in order` : 'Selection complete';

  return (
    <div>
      <div className="nr-screen-header">
        <div>
          <div className="nr-screen-title">{title}</div>
          <div className="nr-screen-subtitle">Listen carefully and reproduce the number sequence</div>
        </div>
        <div className="nr-chips">
          <span className="nr-chip">{chipLabel}</span>
          <span className="nr-chip">Not Scored</span>
        </div>
      </div>

      <div className="nr-numpad-wrap">
        <div className="nr-numpad-top">
          <div>
            <div className="nr-numpad-title">Listen &amp; Remember</div>
            <div className="nr-numpad-sub">Audio plays automatically</div>
          </div>
          <button className="nr-replay-btn" onClick={playMainAudio} disabled={isPlaying}>
            🔊 Replay Audio
          </button>
        </div>

        <div className="nr-numpad-display">
          <div className="nr-numpad-entered">{formatDisplay(selected)}</div>
          <div className="nr-numpad-hint">{hintText}</div>
        </div>

        <div className="nr-numpad" style={{ pointerEvents: isWaiting ? 'none' : 'auto', opacity: isWaiting ? 0.5 : 1 }}>
          {NUMPAD_KEYS.map((k, i) => (
            <button key={i} className={`nr-key ${k.cls || ''}`} onClick={() => handleKey(k)}>
              {k.label}
            </button>
          ))}
        </div>

        <div className="nr-numpad-actions">
          {isWaiting && (
            <div className="nr-action-msg" style={{ color: '#fbbf24' }}>🔊 Please wait for the correction audio…</div>
          )}
          {!isWaiting && firstAttemptDone && !isCorrect && !teachingAudioPlayed && teachingAudioSrc && (
            <div className="nr-action-msg" style={{ color: '#f87171' }}>❌ Not quite. Listen to the correction…</div>
          )}
          {!isWaiting && firstAttemptDone && !showNextButton && !isCorrect && (
            <div className="nr-action-msg" style={{ color: '#f87171' }}>❌ Not quite right.</div>
          )}
          {showNextButton && (
            <button className="nr-btn-next" onClick={onNext}>
              <span>{nextIcon}</span>
              <span>{nextLabel}</span>
              <span style={{ fontSize: '0.85rem' }}>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────
const NumberRecallGame = () => {
  const navigate = useNavigate();
  const [childData, setChildData] = useState(null);
  const [screen, setScreen] = useState('splash'); // splash | practice | teaching1 | teaching2 | game | score
  const [questionIndex, setQuestionIndex] = useState(0);
  const [allScores, setAllScores] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [qTimer, setQTimer] = useState(0);
  const [gameSessionId, setGameSessionId] = useState(null);
  const [pauses, setPauses] = useState([]);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);

  // Refs for race-condition-safe callbacks
  const questionIndexRef = useRef(0);
  const consecutiveWrongRef = useRef(0);
  const allScoresRef = useRef([]);
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

  const sp = childData?.age ? getSP(childData.age) : '—';
  const totalScore = allScores.filter(s => s.score === 1).length;

  // ── Child data + resume check ──────────────────────────────
  const [activitySummary, setActivitySummary] = useState({ lastPlayed: 'Never', attempts: 0 });

  useEffect(() => {
    const dataStr = localStorage.getItem('currentChild');
    if (!dataStr) { navigate('/login'); return; }
    const parsed = JSON.parse(dataStr);
    setChildData(parsed);
    checkResume(parsed.child_id);
    fetchActivitySummary(parsed.child_id);
  }, [navigate]);

  const fetchActivitySummary = async (childId) => {
    try {
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      const res = await axios.get(`${API_URL}/games/sessions/summaries/${childId}`, config);
      if (res.data.success) {
        const gameSum = res.data.summaries.find(s => s.game_name === GAME_NAME);
        if (gameSum) {
          setActivitySummary({
            lastPlayed: formatDateDisp(gameSum.last_played_at),
            attempts: gameSum.total_attempts
          });
        }
      }
    } catch (e) {
      console.error('Error fetching activity summary:', e);
    }
  };

  const formatDateDisp = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  // ── Splash audio autoplay ──────────────────────────────────
  useEffect(() => {
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && audioRef.current) {
      audioRef.current.play().catch(() => setAudioFinished(true));
    }
  }, [isCheckingSession, screen, showResumeModal]);

  // ── Session timer ──────────────────────────────────────────
  useEffect(() => {
    if (screen === 'game' && !showQuitModal) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, showQuitModal]);

  // ── Question timer ─────────────────────────────────────────
  useEffect(() => {
    if (screen === 'game' && !showQuitModal) {
      const interval = setInterval(() => setQTimer(p => p + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [screen, showQuitModal]);

  // ── Sync refs with state ───────────────────────────────────
  useEffect(() => { questionIndexRef.current = questionIndex; }, [questionIndex]);
  useEffect(() => { allScoresRef.current = allScores; }, [allScores]);
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
        total_questions: TOTAL_SCORED_QUESTIONS,
      });
      setGameSessionId(res.data.sessionId);
      resetInternalState();
      setScreen('practice');
    } catch (e) {
      alert('Failed to start session on server.');
      resetInternalState();
      setScreen('practice');
    }
  };

  const resumeGame = () => {
    setGameSessionId(resumeData.id);
    const saved = resumeData.saved_state || {};
    setQuestionIndex(saved.questionIndex || 0);
    setAllScores(saved.allScores || []);
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
    setTimerSeconds(0); timerSecondsRef.current = 0;
    setQTimer(0); qTimerRef.current = 0;
    setPauses([]); pausesRef.current = [];
    setConsecutiveWrong(0); consecutiveWrongRef.current = 0;
    setAssessmentSubmitted(false);
  };

  const saveToServer = async (statusOverride, reason) => {
    if (!gameSessionId) return;
    try {
      let updatedPauses = [...pauses];
      if (reason && (statusOverride === 'paused' || statusOverride === 'quit')) {
        updatedPauses.push({ questionNumber: questionIndex + 1, reason, timestamp: new Date().toISOString() });
        setPauses(updatedPauses);
      }
      await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
        score: allScores.filter(s => s.score === 1).length,
        progress_level: questionIndex + 1,
        status: statusOverride || 'in_progress',
        quit_reason: reason || null,
        saved_state: { questionIndex, allScores, timerSeconds, qTimer, pauses: updatedPauses, consecutiveWrong },
      });
    } catch (e) { console.error('Save error', e); }
  };

  // ── Scoring logic — uses refs to avoid stale closures ──────
  const handleCorrect = useCallback((sel) => {
    const idx = questionIndexRef.current;
    const q = QUESTIONS[idx];
    const newScore = {
      qId: q.qid,
      questionNumber: idx + 1,
      score: 1,
      timeTaken: qTimerRef.current,
      userResponse: sel || q.correct.slice(),
      correctAnswer: q.correct.slice(),
    };
    const upScores = [...allScoresRef.current, newScore];
    allScoresRef.current = upScores;
    setAllScores(upScores);
    consecutiveWrongRef.current = 0;
    setConsecutiveWrong(0);
    // NOTE: advance happens when user clicks the "Next" button via handleAdvance
  }, []);

  const handleWrong = useCallback((userResponse) => {
    const idx = questionIndexRef.current;
    const q = QUESTIONS[idx];
    const newScore = {
      qId: q.qid,
      questionNumber: idx + 1,
      score: 0,
      timeTaken: qTimerRef.current,
      userResponse: userResponse || [],
      correctAnswer: q.correct.slice(),
    };
    const upScores = [...allScoresRef.current, newScore];
    allScoresRef.current = upScores;
    setAllScores(upScores);
    const newConsec = consecutiveWrongRef.current + 1;
    consecutiveWrongRef.current = newConsec;
    setConsecutiveWrong(newConsec);
    // Advance happens via handleAdvance called by NumpadPanel after 700ms
  }, []);

  // Shared advance: called on correct (button click) OR wrong (auto, 700ms later)
  const handleAdvance = useCallback(() => {
    const idx = questionIndexRef.current;
    const consec = consecutiveWrongRef.current;
    const scores = allScoresRef.current;
    const sessId = gameSessionIdRef.current;

    const isGameOver = consec >= MAX_CONSECUTIVE_WRONG || idx + 1 >= TOTAL_SCORED_QUESTIONS;

    if (isGameOver) {
      setScreen('score');
      if (sessId) {
        axios.put(`${API_URL}/games/sessions/update/${sessId}`, {
          score: scores.filter(s => s.score === 1).length,
          progress_level: scores.length,
          status: 'completed',
          saved_state: { questionIndex: scores.length, allScores: scores, timerSeconds: timerSecondsRef.current, pauses: pausesRef.current, consecutiveWrong: consec },
        }).catch(e => console.error(e));
      }
    } else {
      const nextIdx = idx + 1;
      questionIndexRef.current = nextIdx;
      setQuestionIndex(nextIdx);
      setQTimer(0); qTimerRef.current = 0;
    }
  }, []);

  const handleQuit = async (status) => {
    if (!quitReason.trim()) { alert('Please enter a reason'); return; }
    await saveToServer(status, quitReason);
    navigate('/');
  };

  const toggleRecording = (target) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Speech Recognition not supported. Please type manually.'); return; }
    if (isRecording && recordingTarget === target) {
      if (window.activeRecognition) window.activeRecognition.stop();
      setIsRecording(false); setRecordingTarget(null); return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
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
    recognition.onerror = () => { setIsRecording(false); setRecordingTarget(null); };
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
      alert('Assessment successfully saved!');
    } catch (e) {
      console.error(e);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  // ── Score screen helpers ───────────────────────────────────
  const attempted = allScores.length;
  const correct = allScores.filter(s => s.score === 1).length;
  const wrong = allScores.filter(s => s.score === 0).length;
  const skipped = TOTAL_SCORED_QUESTIONS - attempted;
  const accuracyPct = attempted > 0 ? ((correct / attempted) * 100).toFixed(1) : '0.0';
  const totalTimeMs = allScores.reduce((acc, s) => acc + (s.timeTaken || 0) * 1000, 0);
  const avgTimeMs = attempted > 0 ? (totalTimeMs / attempted) : 0;
  const isStopped = consecutiveWrong >= MAX_CONSECUTIVE_WRONG && attempted < TOTAL_SCORED_QUESTIONS;

  const currentQ = QUESTIONS[questionIndex];

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="nr-app">
      {/* ─── Topbar ─── */}
      <header className="nr-topbar">
        <div className="nr-brand">
          <div className="nr-brand-icon">N</div>
          <div>Number Recall</div>
        </div>
        <div className="nr-stats">
          {childData?.child_id && (
            <div className="nr-stat-pill">
              <span className="nr-stat-label">Child ID</span>
              <span className="nr-stat-value">{childData.child_id}</span>
            </div>
          )}
          <div className="nr-stat-pill">
            <span className="nr-stat-label">Score</span>
            <span className="nr-stat-value">{totalScore}</span>
          </div>
          {screen === 'game' && (
            <button
              className="nr-btn nr-btn-warning"
              style={{ padding: '4px 12px', minWidth: 0, fontSize: '0.8rem' }}
              onClick={() => setShowQuitModal(true)}
            >
              Pause/Quit
            </button>
          )}
        </div>
      </header>

      <main className="nr-main">
        {/* ─────────────── SPLASH ─────────────── */}
        {screen === 'splash' && (
          <div className="nr-screen" style={{ backgroundColor: '#fff' }}>
            <div className="nr-screen-header">
              <div>
                <div className="nr-screen-title">Number Recall</div>
                <div className="nr-screen-subtitle">Screen 0 · Listen to the instructions, then start the practice.</div>
              </div>
              <div className="nr-chips">
                <span className="nr-chip">Screen 0 · Splash</span>
                <span className="nr-chip">Audio + Image</span>
              </div>
            </div>

            <div className="nr-splash-card">
              <div className="nr-splash-image-wrapper">
                <img
                  src={`${IMAGE_PATH}/lottery_ka_ticket.jpg`}
                  alt="Lottery Ka Ticket"
                  className="nr-splash-image"
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div class="nr-splash-image-fallback">🎟️</div>';
                  }}
                />
              </div>

              <div className="nr-splash-title">Welcome to Number Recall</div>
              <p className="nr-splash-subtitle">
                Please listen to the instructions. When the audio finishes, you can start the practice.
              </p>

              <div className="nr-activity-summary" style={{
                marginBottom: '24px', padding: '12px 0px', background: 'transparent', borderRadius: '12px',
                borderTop: '1px dashed #e2e8f0', borderBottom: '1px dashed #e2e8f0', display: 'block', textAlign: 'center', width: '100%', maxWidth: '400px', margin: '0 auto 24px'
              }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', marginRight: '6px' }}>Last Played:</span> {activitySummary.lastPlayed}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', marginRight: '6px' }}>Attempts:</span> {activitySummary.attempts} times
                </div>
              </div>

              <div className="nr-btn-row">
                <button
                  className={`nr-btn nr-btn-primary ${!audioFinished ? 'nr-btn-disabled' : ''}`}
                  disabled={!audioFinished}
                  onClick={startNewGame}
                  style={{ minWidth: 160, padding: '13px 36px', fontSize: '1rem' }}
                >
                  Start Now
                </button>
                <button
                  className="nr-btn nr-btn-secondary"
                  style={{ minWidth: 150, padding: '13px 28px', fontSize: '1rem' }}
                  onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } }}
                >
                  Replay Audio
                </button>
              </div>


            </div>
          </div>
        )}

        {/* ─────────────── PRACTICE ─────────────── */}
        {screen === 'practice' && (
          <div className="nr-screen" style={{ backgroundColor: '#fff' }}>
            <TeachingScreen
              title="Practice · sample_0"
              chipLabel="Practice"
              audioSrc="4_6.m4a"
              correct={[4, 6]}
              maxSelect={2}
              teachingAudioSrc="4_6_teaching_audio.m4a"
              nextLabel="Teaching Question 1"
              nextIcon="📝"
              onNext={() => setScreen('teaching1')}
            />
          </div>
        )}

        {/* ─────────────── TEACHING 1 ─────────────── */}
        {screen === 'teaching1' && (
          <div className="nr-screen" style={{ backgroundColor: '#fff' }}>
            <TeachingScreen
              title="Teaching · teaching_1"
              chipLabel="teaching_1"
              audioSrc="9_4.m4a"
              correct={[9, 4]}
              maxSelect={2}
              teachingAudioSrc="9_4_teaching_audio.m4a"
              nextLabel="Teaching Question 2"
              nextIcon="📝"
              onNext={() => setScreen('teaching2')}
            />
          </div>
        )}

        {/* ─────────────── TEACHING 2 ─────────────── */}
        {screen === 'teaching2' && (
          <div className="nr-screen" style={{ backgroundColor: '#fff' }}>
            <TeachingScreen
              title="Teaching · teaching_2"
              chipLabel="teaching_2"
              audioSrc="2_8.m4a"
              correct={[2, 8]}
              maxSelect={2}
              teachingAudioSrc={null}
              nextLabel="Start Main Questions"
              nextIcon="🎯"
              onNext={() => setScreen('game')}
            />
          </div>
        )}

        {/* ─────────────── GAME ─────────────── */}
        {screen === 'game' && currentQ && (
          <div className="nr-screen" style={{ backgroundColor: '#fff' }}>
            <NumpadPanel
              key={`q-${questionIndex}`}
              title={`Question ${questionIndex + 1} of ${TOTAL_SCORED_QUESTIONS}`}
              chipLabel={`Q${questionIndex + 1}`}
              qTimerDisplay={formatTime(qTimer)}
              audioSrc={currentQ.audio}
              correct={currentQ.correct}
              maxSelect={currentQ.maxSelect}
              isScored={true}
              autoPlay={true}
              onCorrect={handleCorrect}
              onWrong={handleWrong}
              onAdvance={handleAdvance}
            />
          </div>
        )}

        {/* ─────────────── SCORE ─────────────── */}
        {screen === 'score' && (
          <div className="nr-screen" style={{ backgroundColor: '#fff' }}>
            <div className="nr-screen-header">
              <div>
                <div className="nr-screen-title">Assessment Complete</div>
                <div className="nr-screen-subtitle">
                  {isStopped ? 'Stopped after 3 consecutive incorrect answers' : 'Test completed'}
                </div>
              </div>
              <div className="nr-chips">
                <span className="nr-chip">Final Results</span>
                <span className="nr-chip">Time: {formatDurationMs(totalTimeMs)}</span>
              </div>
            </div>

            <div className="nr-result-card">
              {/* Score + Stats */}
              <div className="nr-score-top">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="nr-score-dial-container">
                    <div className="nr-score-dial-big">{correct + wrong}</div>
                    <div className="nr-score-dial-small">/ {TOTAL_SCORED_QUESTIONS}</div>
                  </div>
                  <div className="nr-score-accuracy">Total / Correct</div>
                </div>

                <div className="nr-metric-grid">
                  {[
                    { label: '✓ Correct', val: correct, cls: 'green' },
                    { label: '✗ Incorrect', val: wrong, cls: 'red' },
                    { label: '% Accuracy', val: `${accuracyPct}%`, cls: '' },
                    { label: '⏱ Total Time', val: formatDurationMs(totalTimeMs), cls: '' },
                    { label: '⚡ Avg/Q', val: formatDurationMs(avgTimeMs), cls: '' },
                  ].map((m, i) => (
                    <div key={i} className="nr-metric-box">
                      <label>{m.label}</label>
                      <div className={`nr-metric-val ${m.cls}`}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {correct / TOTAL_SCORED_QUESTIONS >= 0.8 && (
                <div className="nr-banner">Outstanding performance! Great memory span! ⭐</div>
              )}

              {/* Per-question grid toggle */}
              <div className="nr-accordion-toggle" onClick={() => setShowGrid(!showGrid)}>
                {showGrid ? '▼' : '▶'} Show per-question results
              </div>

              {showGrid && (
                <div className="nr-q-table-wrap">
                  <table className="nr-q-table">
                    <thead>
                      <tr>
                        <th>Q#</th>
                        <th>Your Response</th>
                        <th>Correct Answer</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allScores.map((s, i) => {
                        const ok = s.score === 1;
                        return (
                          <tr key={i} className={ok ? 'nr-row-correct' : 'nr-row-incorrect'}>
                            <td>Q{s.questionNumber}</td>
                            <td style={{ fontFamily: 'monospace' }}>{(s.userResponse || []).join(', ')}</td>
                            <td style={{ fontFamily: 'monospace' }}>{(s.correctAnswer || []).join(', ')}</td>
                            <td>
                              <span className={`nr-status-badge ${ok ? 'nr-badge-correct' : 'nr-badge-incorrect'}`}>
                                {ok ? 'Correct' : 'Incorrect'}
                              </span>
                            </td>
                            <td>{s.score}</td>
                            <td style={{ fontFamily: 'monospace' }}>{s.timeTaken != null ? `${s.timeTaken}s` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Assessment Form */}
              <div className="nr-assessment-section">
                <h3 className="nr-form-title">Session Assessment Details</h3>

                {[
                  { key: 'q1', label: 'Q1. Did you enjoy playing the game?' },
                  { key: 'q2', label: 'Q2. How did the game feel for you?' },
                  { key: 'q3', label: 'Q3. Did you feel tired while playing the game?' },
                  { key: 'q4', label: 'Q4. Would you like to play the game again?' },
                ].map(q => (
                  <div key={q.key} className="nr-q-group">
                    <label className="nr-q-label">{q.label}</label>
                    <div className="nr-radio-row">
                      {['Yes, a lot', 'A little', 'Not much'].map(opt => (
                        <label key={opt} className="nr-radio-label">
                          <input
                            type="radio"
                            name={q.key}
                            disabled={assessmentSubmitted}
                            checked={assessment[q.key] === opt}
                            onChange={() => setAssessment({ ...assessment, [q.key]: opt })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="nr-q-group">
                  <label className="nr-q-label">Q5. Observed Behaviours during the session (Multiple selection allowed)</label>
                  <div className="nr-checkbox-grid">
                    {[
                      'Difficulty sustaining attention', 'Impulsive or random responding',
                      'Negative reaction to correction', 'Hesitation in responding',
                      'High focus or persistence', 'Verbalisation of a memory strategy',
                      'Needed frequent reassurance', 'Calm and engaged throughout',
                    ].map(bhv => (
                      <label key={bhv} className="nr-checkbox-label">
                        <input
                          type="checkbox"
                          disabled={assessmentSubmitted}
                          checked={assessment.behaviors.includes(bhv)}
                          onChange={e => {
                            if (e.target.checked) setAssessment({ ...assessment, behaviors: [...assessment.behaviors, bhv] });
                            else setAssessment({ ...assessment, behaviors: assessment.behaviors.filter(b => b !== bhv) });
                          }}
                        />
                        {bhv}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="nr-q-group">
                  <label className="nr-q-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Additional Notes</span>
                    <button
                      onClick={() => toggleRecording('assessmentNotes')}
                      style={{
                        background: isRecording && recordingTarget === 'assessmentNotes' ? '#fee2e2' : '#eff6ff',
                        color: isRecording && recordingTarget === 'assessmentNotes' ? '#ef4444' : '#2563eb',
                        border: '1px solid',
                        borderColor: isRecording && recordingTarget === 'assessmentNotes' ? '#fca5a5' : '#bfdbfe',
                        padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontFamily: 'inherit',
                      }}
                    >
                      🎙 {isRecording && recordingTarget === 'assessmentNotes' ? 'Recording… (Stop)' : 'Use Mic'}
                    </button>
                  </label>
                  <textarea
                    className="nr-textarea"
                    rows="3"
                    disabled={assessmentSubmitted}
                    placeholder="Type or dictate observations…"
                    value={assessment.notes}
                    onChange={e => setAssessment({ ...assessment, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="nr-final-actions">
                {assessmentSubmitted ? (
                  <>
                    <button onClick={() => { resetInternalState(); setScreen('splash'); }} className="nr-btn nr-btn-primary">↻ Retest</button>
                    <button onClick={() => navigate('/')} className="nr-btn nr-btn-secondary">🏠 Home</button>
                  </>
                ) : (
                  <button
                    onClick={submitAssessmentForm}
                    disabled={isAssessmentSubmitting}
                    className="nr-btn nr-btn-primary"
                    style={{ minWidth: 220 }}
                  >
                    {isAssessmentSubmitting ? 'Saving…' : 'Submit Assessment'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Splash audio */}
      {!isCheckingSession && (
        <audio
          ref={audioRef}
          src={`${AUDIO_PATH}/splash1.m4a`}
          preload="auto"
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {/* ─────────────── RESUME MODAL ─────────────── */}
      {showResumeModal && (
        <div className="nr-modal-overlay">
          <div className="nr-modal">
            <h2>Saved Progress Found</h2>
            <p>You have a previously paused session for this game.</p>
            <div className="nr-btn-row" style={{ marginTop: 20 }}>
              <button className="nr-btn nr-btn-secondary" onClick={() => { 
                setShowResumeModal(false); 
                setAudioFinished(false);
                setScreen('splash');
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                }
              }}>
                Restart Fresh
              </button>
              <button className="nr-btn nr-btn-primary" onClick={resumeGame}>
                Resume Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────── QUIT MODAL ─────────────── */}
      {showQuitModal && (
        <div className="nr-modal-overlay">
          <div className="nr-modal">
            <h2>Pause or Quit</h2>
            <p>Why are you stopping the game?</p>
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="E.g., Child is tired, disconnected, etc."
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
              <button className="nr-btn nr-btn-secondary" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem' }} onClick={() => setShowQuitModal(false)}>Cancel</button>
              <button className="nr-btn" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem', background: '#fef08a', color: '#854d0e' }} onClick={() => handleQuit('paused')}>Pause &amp; Save</button>
              <button className="nr-btn" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem', background: '#fee2e2', color: '#991b1b' }} onClick={() => handleQuit('quit')}>Quit &amp; End</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NumberRecallGame;
