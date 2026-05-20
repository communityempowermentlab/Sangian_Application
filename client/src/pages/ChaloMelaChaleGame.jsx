import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import './ChaloMelaChaleGame.css';
const GAME_NAME = 'rover_mela';
const TOTAL_QUESTIONS = 22; 

const AUDIO_DIR = '/assets/audios/chalo_mela_chale';
const IMG_DIR = '/assets/images/chalo_mela_chale';

const IMG_MAPPING = {
  "7-SP": "/assets/images/chalo_mela_chale/7-SP.png",
  "7-T1": "/assets/images/chalo_mela_chale/7-T1.png",
  "7-T2": "/assets/images/chalo_mela_chale/7-T2.png",
  "7-T3": "/assets/images/chalo_mela_chale/7-T3.png",
  "7-EP": "/assets/images/chalo_mela_chale/7-EP.png"
};

const MATRIX_P1 = [
  ["7-T1","7-T1","7-T1","7-T1"],
  ["7-T1","7-T1","7-EP","7-T1"],
  ["7-T1","7-T2","7-T2","7-T1"],
  ["7-SP","7-T1","7-T1","7-T1"]
];

const MATRIX_TQ1 = [
  ["7-T1","7-T1","7-T1","7-T1"],
  ["7-T1","7-T1","7-EP","7-T1"],
  ["7-T1","7-T2","7-T2","7-T1"],
  ["7-SP","7-T1","7-T1","7-T1"]
];

const MATRIX_TQ2 = [
  ["7-SP", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T2", "7-T1"],
  ["7-T1", "7-T2", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-EP"]
];

const MATRIX_SB = [
  ["7-T1", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-EP"],
  ["7-T3", "7-T2", "7-T1", "7-T1"],
  ["7-SP", "7-T2", "7-T1", "7-T1"]
];

const MATRIX_TQ3 = [
  ["7-T1", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T2", "7-EP"],
  ["7-T3", "7-T3", "7-T1", "7-T1"],
  ["7-SP", "7-T1", "7-T1", "7-T1"]
];

const MATRIX_TQ4 = [
  ["7-T1", "7-T1", "7-T1", "7-T1"],
  ["7-EP", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T2", "7-T3"],
  ["7-T1", "7-T1", "7-T2", "7-SP"]
];

const MATRIX_Q1 = [
  ["7-T1", "7-T1", "7-T1", "7-EP"],
  ["7-T1", "7-T1", "7-T2", "7-T1"],
  ["7-T1", "7-T2", "7-T1", "7-T2"],
  ["7-T1", "7-T1", "7-T2", "7-SP"]
];

const MATRIX_Q2 = [
  ["7-T1", "7-T1", "7-T1", "7-T1"],
  ["7-SP", "7-T2", "7-T1", "7-T1"],
  ["7-T2", "7-T3", "7-T1", "7-T1"],
  ["7-EP", "7-T2", "7-T1", "7-T1"]
];

const MATRIX_Q3 = [
  ["7-SP", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T3", "7-T2", "7-T1"],
  ["7-T2", "7-T3", "7-T3", "7-T1"],
  ["7-T1", "7-EP", "7-T1", "7-T1"]
];

const MATRIX_Q4 = [
  ["7-T1", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-SP", "7-T2", "7-EP"],
  ["7-T1", "7-T1", "7-T3", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-T1"]
];

const MATRIX_Q5 = [
  ["7-T2", "7-T1", "7-EP", "7-T1"],
  ["7-T1", "7-T3", "7-T3", "7-T2"],
  ["7-T1", "7-T3", "7-T3", "7-T1"],
  ["7-T1", "7-SP", "7-T1", "7-T1"]
];

const MATRIX_Q6 = [
  ["7-T1", "7-T1", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T2", "7-T1", "7-EP"],
  ["7-T2", "7-T3", "7-T2", "7-T1", "7-T1"],
  ["7-SP", "7-T2", "7-T1", "7-T1", "7-T1"],
  ["7-T2", "7-T3", "7-T1", "7-T1", "7-T1"]
];

const MATRIX_Q7 = [
  ["7-T1", "7-T1", "7-T1", "7-T2", "7-T2"],
  ["7-T1", "7-T1", "7-T1", "7-T3", "7-EP"],
  ["7-T1", "7-T3", "7-T1", "7-T2", "7-T1"],
  ["7-SP", "7-T1", "7-T1", "7-T2", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-T1", "7-T1"]
];

const MATRIX_Q8 = [
  ["7-SP", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T2", "7-T1", "7-T2"],
  ["7-T1", "7-T2", "7-T2", "7-T1"],
  ["7-T1", "7-T3", "7-EP", "7-T1"]
];

const MATRIX_Q9 = [
  ["7-T1", "7-T1", "7-T2", "7-T3", "7-SP"],
  ["7-T1", "7-T2", "7-T1", "7-T2", "7-T3"],
  ["7-T1", "7-T1", "7-T1", "7-T3", "7-T2"],
  ["7-T1", "7-T1", "7-T2", "7-T2", "7-T1"],
  ["7-T1", "7-T3", "7-EP", "7-T1", "7-T1"]
];

const MATRIX_Q10 = [
  ["7-T1", "7-T2", "7-T1", "7-SP"],
  ["7-EP", "7-T2", "7-T3", "7-T1"],
  ["7-T1", "7-T3", "7-T3", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-T1"]
];

const MATRIX_Q11 = [
  ["7-T1", "7-SP", "7-T3", "7-T2", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-T1", "7-T3", "7-T1"],
  ["7-T3", "7-T2", "7-T2", "7-T2", "7-T1", "7-T1"],
  ["7-T1", "7-T3", "7-T2", "7-T3", "7-T2", "7-T1"],
  ["7-T1", "7-T2", "7-T1", "7-EP", "7-T3", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-T1", "7-T1", "7-T1"]
];

const MATRIX_Q12 = [
  ["7-T1", "7-T1", "7-T1", "7-T1", "7-SP", "7-T1"],
  ["7-T1", "7-T1", "7-T2", "7-T3", "7-T2", "7-T2"],
  ["7-T1", "7-T2", "7-T3", "7-T2", "7-T1", "7-T3"],
  ["7-T3", "7-T1", "7-T2", "7-T3", "7-T2", "7-T3"],
  ["7-T1", "7-T1", "7-T3", "7-T3", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-EP", "7-T1", "7-T1"]
];

const MATRIX_Q13 = [
  ["7-T1", "7-T1", "7-T2", "7-SP"],
  ["7-T3", "7-T2", "7-T1", "7-T1"],
  ["7-EP", "7-T2", "7-T2", "7-T1"],
  ["7-T1", "7-T1", "7-T3", "7-T1"]
];

const MATRIX_Q14 = [
  ["7-T1", "7-T3", "7-T2", "7-T1", "7-T1"],
  ["7-T1", "7-T1", "7-T2", "7-T1", "7-T1"],
  ["7-EP", "7-T2", "7-T3", "7-T2", "7-SP"],
  ["7-T1", "7-T3", "7-T1", "7-T3", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-T1", "7-T1"]
];

const MATRIX_Q15 = [
  ["7-SP", "7-T1", "7-T1", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T2", "7-T3", "7-T1", "7-T3", "7-T3"],
  ["7-T1", "7-T3", "7-T1", "7-T3", "7-T2", "7-T1"],
  ["7-T1", "7-T3", "7-T3", "7-T2", "7-T1", "7-T1"],
  ["7-T3", "7-T2", "7-T1", "7-T3", "7-EP", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-T3", "7-T1", "7-T1"]
];

const MATRIX_Q16 = [
  ["7-T1", "7-T1", "7-T1", "7-T1", "7-T1", "7-T1"],
  ["7-T1", "7-T2", "7-T1", "7-T2", "7-T1", "7-T1"],
  ["7-T1", "7-T2", "7-T1", "7-T2", "7-EP", "7-T1"],
  ["7-T1", "7-T3", "7-T3", "7-T2", "7-T3", "7-T1"],
  ["7-T1", "7-T3", "7-T3", "7-T2", "7-T3", "7-T1"],
  ["7-SP", "7-T3", "7-T1", "7-T3", "7-T1", "7-T1"]
];

const MATRIX_Q17 = [
  ["7-T2", "7-T2", "7-T3", "7-T1", "7-T1", "7-T2"],
  ["7-T2", "7-T3", "7-EP", "7-T3", "7-T2", "7-T3"],
  ["7-T3", "7-T2", "7-T2", "7-T2", "7-T2", "7-T1"],
  ["7-T3", "7-T2", "7-SP", "7-T3", "7-T1", "7-T1"],
  ["7-T2", "7-T3", "7-T2", "7-T1", "7-T1", "7-T1"],
  ["7-T2", "7-T2", "7-T1", "7-T2", "7-T1", "7-T1"]
];

const MATRIX_Q18 = [
  ["7-T1", "7-T3", "7-T3", "7-T3", "7-T1", "7-T1"],
  ["7-T1", "7-T2", "7-T1", "7-T2", "7-T2", "7-T1"],
  ["7-EP", "7-T2", "7-T1", "7-T2", "7-SP", "7-T3"],
  ["7-T1", "7-T1", "7-T2", "7-T2", "7-T1", "7-T3"],
  ["7-T1", "7-T1", "7-T3", "7-T2", "7-T3", "7-T1"],
  ["7-T1", "7-T1", "7-T1", "7-T3", "7-T1", "7-T1"]
];

const QUESTION_CONFIG = {
  tq1: { time: 60 },
  tq2: { time: 60 },
  tq3: { time: 60 },
  tq4: { time: 60 },
  q1: { time: 60, t2: 3, t1: 4 },
  q2: { time: 60, t2: 3, t1: 4 },
  q3: { time: 60, t2: 4, t1: 5 },
  q4: { time: 60, t2: 2, t1: 3 },
  q5: { time: 60, t2: 4, t1: 5 },
  q6: { time: 90, t2: 5, t1: 6 },
  q7: { time: 90, t2: 5, t1: 6 },
  q8: { time: 90, t2: 4, t1: 5 },
  q9: { time: 120, t2: 6, t1: 7 },
  q10: { time: 120, t2: 5, t1: 6 },
  q11: { time: 120, t2: 6, t1: 7 },
  q12: { time: 120, t2: 7, t1: 8 },
  q13: { time: 120, t2: 5, t1: 6 },
  q14: { time: 180, t2: 5, t1: 6 },
  q15: { time: 180, t2: 7, t1: 8 },
  q16: { time: 180, t2: 8, t1: 9 },
  q17: { time: 180, t2: 8, t1: 9 },
  q18: { time: 180, t2: 8, t1: 9 }
};

const MATRIX_MAP = {
  p1: MATRIX_P1,
  tq1: MATRIX_TQ1,
  tq2: MATRIX_TQ2,
  sb: MATRIX_SB,
  tq3: MATRIX_TQ3,
  tq4: MATRIX_TQ4,
  q1: MATRIX_Q1, q2: MATRIX_Q2, q3: MATRIX_Q3, q4: MATRIX_Q4,
  q5: MATRIX_Q5, q6: MATRIX_Q6, q7: MATRIX_Q7, q8: MATRIX_Q8,
  q9: MATRIX_Q9, q10: MATRIX_Q10, q11: MATRIX_Q11, q12: MATRIX_Q12,
  q13: MATRIX_Q13, q14: MATRIX_Q14, q15: MATRIX_Q15, q16: MATRIX_Q16,
  q17: MATRIX_Q17, q18: MATRIX_Q18
};

const getTargetMoves = (id) => {
  if (id.startsWith('tq')) return id === 'tq4' ? 5 : 3;
  if (id.startsWith('p') || id.startsWith('sb')) return '-';
  return QUESTION_CONFIG[id]?.t2 || '-';
};


const PATH1_SEQ = ["R4C1","R4C2","R4C3","R4C4","R3C4","R2C4","R2C3"];
const PATH2_SEQ = ["R4C1","R3C1","R2C1","R2C2","R2C3"];
const PATH3_SEQ = ["R4C1", "R3C1", "R2C2", "R2C3"];

const SB_PATH1_SEQ = ["R4C1","R3C1","R2C1","R2C2","R2C3","R2C4"];
const SB_PATH2_SEQ = ["R4C1","R3C1","R2C2","R2C3","R2C4"];

const ChaloMelaChaleGame = () => {
  const { t }    = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [childData, setChildData] = useState(null);
  const [screen, setScreen] = useState('splash');
  const [allScores, setAllScores] = useState([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [retakeCount, setRetakeCount] = useState(0);
  const [audioFinished, setAudioFinished] = useState(false);
  const totalScore = allScores.reduce((acc, s) => acc + s.score, 0);
  const [gameSessionId, setGameSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [qStartTime, setQStartTime] = useState(null);
  const qStartTimeRef = useRef(null);
  
  // Keep ref in sync for event handlers
  useEffect(() => { qStartTimeRef.current = qStartTime; }, [qStartTime]);
  const [showResultsGrid, setShowResultsGrid] = useState(false);
  const [assessment, setAssessment] = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);
  const [assessmentSaveMsg, setAssessmentSaveMsg] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);
  const [isDropped, setIsDropped] = useState(false);
  
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  const pauseStartTimeRef = useRef(null);

  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingResumeData, setPendingResumeData] = useState(null);
  const [attemptNo, setAttemptNo] = useState(1);
  
  // Animation State
  const [activePath, setActivePath] = useState(null);
  const [pathProgress, setPathProgress] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [unlockedPaths, setUnlockedPaths] = useState({ p2: false, p3: false, tq1: false, sbP2: false, tq3: false });
  const [completedPaths, setCompletedPaths] = useState({ p1: false, p2: false, p3: false, sbP1: false, sbP2: false });

  // Generic Question State
  const [questionState, setQuestionState] = useState({
    id: '',
    matrix: [],
    currentTrial: 1,
    gameStarted: false,
    path: [],
    moveCount: 0,
    timeRemaining: 10,
    trial1Result: "Not Started",
    trial2Result: "Not Started",
    trial1Score: 0,
    trial2Score: 0,
    trial2Unlocked: false,
    trial2Hidden: false,
    isComplete: false,
    nextUnlocked: false
  });
  
  const audioRef        = useRef(null);
  const timerRef        = useRef(null);
  const allIntervalsRef = useRef([]);
  const playingAudiosRef= useRef([]);
  const isStoppedRef    = useRef(false); // set true by stopAll; blocks ALL new audio/intervals
  const questionStateRef = useRef(questionState);
  const hasAutoStarted = useRef({ sampleA: false, sampleB: false });
  const isMountedRef    = useRef(false);

  useEffect(() => { questionStateRef.current = questionState; }, [questionState]);

  // safeSetTimeout — respects pause state AND the isStoppedRef kill-switch
  const safeSetTimeout = useCallback((cb, delay) => {
    if (isStoppedRef.current) return; // game already stopped — don't schedule anything
    let elapsed = 0;
    const interval = setInterval(() => {
      if (isStoppedRef.current) { clearInterval(interval); return; } // killed mid-flight
      if (!isPausedRef.current) {
        elapsed += 50;
        if (elapsed >= delay) {
          clearInterval(interval);
          allIntervalsRef.current = allIntervalsRef.current.filter(id => id !== interval);
          if (!isStoppedRef.current) cb();
        }
      }
    }, 50);
    allIntervalsRef.current.push(interval);
    return interval;
  }, []);

  const stopAudio = useCallback(() => {
    // Detach handlers BEFORE pausing to prevent browser firing onended → new audio chain
    playingAudiosRef.current.forEach(a => {
      try {
        a.onended = null; a.onerror = null; a.onabort = null;
        a.pause(); a.currentTime = 0; a.src = '';
      } catch { /* ignore */ }
    });
    playingAudiosRef.current = [];
    if (audioRef.current) {
      try { audioRef.current.onended = null; audioRef.current.pause(); } catch { /* ignore */ }
    }
  }, []);

  // stopAll — sets isStoppedRef immediately so nothing new can start
  const stopAll = useCallback(() => {
    isStoppedRef.current = true; // must be first — blocks any in-flight callbacks
    stopAudio();
    allIntervalsRef.current.forEach(id => { try { clearInterval(id); } catch { /* ignore */ } });
    allIntervalsRef.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsAnimating(false);
  }, [stopAudio]);

  // Cleanup on unmount — prevents audio playing after navigation
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Detach handlers first so stopping audio cannot trigger onEnded chains
      playingAudiosRef.current.forEach(a => {
        try {
          a.onended = null; a.onerror = null; a.onabort = null;
          a.pause(); a.currentTime = 0; a.src = '';
        } catch { /* ignore */ }
      });
      playingAudiosRef.current = [];
      allIntervalsRef.current.forEach(id => { try { clearInterval(id); } catch { /* ignore */ } });
      allIntervalsRef.current = [];
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (audioRef.current) {
        try { audioRef.current.onended = null; audioRef.current.pause(); } catch { /* ignore */ }
      }
    };
  }, []);

  const sessionCheckRef = useRef(false);

  useEffect(() => {
    if (sessionCheckRef.current) return;
    sessionCheckRef.current = true;
    const data = localStorage.getItem('currentChild');
    if (data) {
      const parsed = JSON.parse(data);
      setChildData(parsed);
      checkSession(parsed.child_id);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const checkSession = async (childId) => {
    try {
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/${GAME_NAME}`, config);
      if (res.data.success && res.data.sessionInfo) {
        const info = res.data.sessionInfo;
        setGameSessionId(info.id);
        if (info.status === 'paused' && info.saved_state) {
          setPendingResumeData(info.saved_state);
          setAttemptNo(info.attempt_no || 1);
          setShowResumeModal(true);
        } else {
          startNewGame(childId);
        }
      } else {
        startNewGame(childId);
      }
    } catch (e) {
      console.error('Resume check failed', e);
      startNewGame(childId);
    } finally {
      setIsCheckingSession(false);
    }
  };

  const resumeGame = () => {
    if (!pendingResumeData) return;
    const ss = pendingResumeData;
    if (ss.allScores) setAllScores(ss.allScores);
    if (ss.unlockedPaths) setUnlockedPaths(ss.unlockedPaths);
    if (ss.completedPaths) setCompletedPaths(ss.completedPaths);
    if (ss.screen) setScreen(ss.screen);
    if (ss.refreshCount !== undefined) setRefreshCount(ss.refreshCount);
    if (ss.retakeCount !== undefined) setRetakeCount(ss.retakeCount);
    if (ss.questionState) {
      setQuestionState(ss.questionState);
      if (ss.questionState.gameStarted && !ss.questionState.isComplete) {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          if (isPausedRef.current) return;
          setQuestionState(prev => {
            if (prev.timeRemaining <= 1) { 
              clearInterval(timerRef.current); 
              handleResult(false, "Timeout"); 
              return { ...prev, timeRemaining: 0 }; 
            }
            if (prev.timeRemaining === 6) playSoundEffect('timer_warning.wav'); 
            return { ...prev, timeRemaining: prev.timeRemaining - 1 };
          });
        }, 1000);
        const timeLimit = QUESTION_CONFIG[ss.questionState.id]?.time || 10;
        const timeSpent = timeLimit - ss.questionState.timeRemaining;
        const adjustedQStart = Date.now() - (timeSpent * 1000);
        setQStartTime(adjustedQStart);
        qStartTimeRef.current = adjustedQStart;
      }
    }
    if (ss.isDropped) setIsDropped(true);
    setStartTime(Date.now());
    setShowResumeModal(false);
  };

  const startNewGame = async (childId) => {
    try {
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childId,
        game_name: GAME_NAME,
        total_questions: TOTAL_QUESTIONS,
      }, config);
      const newSessionId = res.data.sessionId;
      setGameSessionId(newSessionId);
      setAttemptNo(res.data.attempt_no || 1);
      setStartTime(Date.now());
      setQStartTime(null);

      // Save initial in_progress state using newSessionId directly
      // (avoids React state closure issue — gameSessionId isn't updated yet in this render)
      const config2 = {};
      if (token) config2.headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API_URL}/games/sessions/update/${newSessionId}`, {
        score: 0, progress_level: 1, status: 'in_progress',
        saved_state: { allScores: [], totalScore: 0, screen: 'game' },
      }, config2);
    } catch (e) {
      console.error('Failed to start session', e);
    }
  };

  const saveToServer = async (statusOverride, currentScores = null, currentTotal = null, optionalQuitReason = null, isDroppedOverride = false) => {
    if (!gameSessionId) return;
    try {
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      const scoresToSave = currentScores || allScores;
      const totalToSave = currentTotal !== null ? currentTotal : totalScore;
      
      await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
        score: totalToSave,
        progress_level: scoresToSave.length,
        status: statusOverride || 'in_progress',
        quit_reason: optionalQuitReason || quitReason,
        saved_state: { 
          allScores: scoresToSave, 
          totalScore: totalToSave, 
          unlockedPaths, 
          completedPaths,
          screen,
          questionState,
          isDropped: isDroppedOverride || isDropped,
          refreshCount,
          retakeCount
        }
      }, config);
    } catch (e) { console.error('Save error', e); }
  };

  // Stop all audio/timers when results screen is shown
  useEffect(() => {
    if (screen === 'results') {
      stopAll();
    }
  }, [screen, stopAll]);

  // Sync state on screen change to ensure real-time "In Progress" tracking
  useEffect(() => {
    if (gameSessionId && screen !== 'splash' && screen !== 'results') {
      saveToServer('in_progress');
    }
  }, [screen, gameSessionId]);

  const playAudio = useCallback((file, onEnded) => {
    if (isStoppedRef.current) return; // don't start new audio after stopAll
    stopAudio();
    const audio = new Audio(`${AUDIO_DIR}/${file}`);
    audioRef.current = audio;
    playingAudiosRef.current.push(audio); // track so stopAll/unmount can kill it
    
    // Safety fallback for onEnded
    let called = false;
    const safeOnEnded = () => {
      if (!called) {
        called = true;
        if (onEnded) onEnded();
      }
    };

    audio.play().catch(e => {
      console.log('Audio play failed', e);
      safeSetTimeout(safeOnEnded, 1000); // Trigger fallback if play fails
    });
    
    audio.onended = safeOnEnded;
    
    // Absolute safety timeout if audio is longer than expected but never ends
    safeSetTimeout(safeOnEnded, 20000); 

    return audio;
  }, [stopAudio, safeSetTimeout]);

  const playSoundEffect = useCallback((file) => {
    const sfx = new Audio(`${AUDIO_DIR}/${file}`);
    sfx.play().catch(e => console.log('SFX play failed', e));
  }, []);

  const startTrial = useCallback((trialNum) => {
    stopAll();
    let spPos = {r:0, c:0};
    questionStateRef.current.matrix.forEach((row, ri) => row.forEach((cell, ci) => {
      if(cell === "7-SP") spPos = {r:ri, c:ci};
    }));
    const timeLimit = QUESTION_CONFIG[questionStateRef.current.id]?.time || 10;
    setQuestionState(prev => ({
      ...prev,
      currentTrial: trialNum,
      gameStarted: true,
      path: [{ row: spPos.r, col: spPos.c }],
      moveCount: 0,
      timeRemaining: timeLimit,
      isComplete: false,
      wrongMovePos: null
    }));
    const now = Date.now();
    setQStartTime(now);
    qStartTimeRef.current = now;
    playSoundEffect('start_trial.wav');
    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      setQuestionState(prev => {
        if (prev.timeRemaining <= 1) { clearInterval(timerRef.current); handleResult(false, "Timeout"); return { ...prev, timeRemaining: 0 }; }
        if (prev.timeRemaining === 6) playSoundEffect('timer_warning.wav'); 
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);
  }, [stopAll, playSoundEffect]);

  const handleRefresh = useCallback((trialNum) => {
    if (refreshCount >= 1) return;
    setRefreshCount(prev => prev + 1);
    startTrial(trialNum);
  }, [refreshCount, startTrial]);

  const handleRetake = useCallback(() => {
    if (retakeCount >= 2) return;
    setRetakeCount(prev => prev + 1);
    
    let spPos = {r:0, c:0};
    questionStateRef.current.matrix.forEach((row, ri) => row.forEach((cell, ci) => {
      if(cell === "7-SP") spPos = {r:ri, c:ci};
    }));
    
    setQuestionState(prev => ({
      ...prev,
      path: [{ row: spPos.r, col: spPos.c }],
      moveCount: 0,
      isComplete: false
    }));
    playSoundEffect('start_trial.wav');
  }, [retakeCount, playSoundEffect]);

  const initQuestion = useCallback((id, matrix) => {
    stopAll();
    setRefreshCount(0);
    setRetakeCount(0);
    const timeLimit = QUESTION_CONFIG[id]?.time || 10;
    const newState = {
      id,
      matrix,
      currentTrial: 1,
      gameStarted: false,
      path: [],
      moveCount: 0,
      timeRemaining: timeLimit,
      trial1Result: "Not Started",
      trial2Result: "Not Started",
      trial1Score: 0,
      trial2Score: 0,
      trial2Unlocked: false,
      trial2Hidden: false,
      isComplete: false,
      nextUnlocked: false,
      wrongMovePos: null
    };
    setQuestionState(newState);
    setScreen(id);
    setQStartTime(null);
    qStartTimeRef.current = null;
    safeSetTimeout(() => startTrial(1), 500);
  }, [stopAll, startTrial, safeSetTimeout]);

  // --- DEMO LOGIC ---
  const runPathSequence = useCallback(async (seq, pathKey, nextPathKey = null) => {
    setActivePath(pathKey); 
    setPathProgress(-1);
    setIsAnimating(true);
    
    let elapsed1 = 0;
    while(elapsed1 < 500) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
      if (!isPausedRef.current) elapsed1 += 50;
    }

    let audioFile = '';
    if (pathKey.startsWith('sb')) {
      audioFile = pathKey === 'sbP1' ? 'SB_path1.wav' : 'SB_path2.wav';
    } else {
      audioFile = pathKey === 'p1' ? 'path1.wav' : pathKey === 'p2' ? 'path2.wav' : 'path3.wav';
    }

    playAudio(audioFile);
    const totalMs = pathKey.startsWith('sb') ? 9000 : (pathKey === 'p1' ? 11000 : 8000);
    const stepDelay = Math.round(totalMs / seq.length);
    for (let i = 0; i < seq.length; i++) {
      while(isPausedRef.current) await new Promise(r => setTimeout(r, 100));
      if (isStoppedRef.current) return;
      setPathProgress(i);

      let elapsed2 = 0;
      while(elapsed2 < stepDelay) {
        await new Promise(r => setTimeout(r, 50));
        if (isStoppedRef.current) return;
        if (!isPausedRef.current) elapsed2 += 50;
      }
    }

    if (isStoppedRef.current) return;
    let resultFile = '';
    if (pathKey.startsWith('sb')) {
      resultFile = pathKey === 'sbP1' ? 'SB_path1_result.wav' : 'SB_path2_result.wav';
    } else {
      resultFile = pathKey === 'p1' ? 'path1_result.wav' : pathKey === 'p2' ? 'path2_result.wav' : 'path3_result.wav';
    }

    playAudio(resultFile, () => {
      setIsAnimating(false);
      setCompletedPaths(prev => ({ ...prev, [pathKey]: true })); 
      
      if (nextPathKey) {
        setUnlockedPaths(prev => ({ ...prev, [nextPathKey]: true }));
        
        // If the next step is a question, clear the active path highlight
        if (nextPathKey.startsWith('tq')) {
          setActivePath(null);
        }

        safeSetTimeout(() => {
          if (nextPathKey === 'p2') runPathSequence(PATH2_SEQ, 'p2', 'p3');
          else if (nextPathKey === 'p3') runPathSequence(PATH3_SEQ, 'p3', 'tq1');
          else if (nextPathKey === 'sbP2') runPathSequence(SB_PATH2_SEQ, 'sbP2', 'tq3');
        }, 1000);
      }
    });
  }, [playAudio, safeSetTimeout]);

  const startAutoDemoA = useCallback(() => {
    setUnlockedPaths(prev => ({ ...prev, p2: false, p3: false, tq1: false }));
    setCompletedPaths(prev => ({ ...prev, p1: false, p2: false, p3: false }));
    runPathSequence(PATH1_SEQ, 'p1', 'p2');
  }, [runPathSequence]);

  const startAutoDemoSB = useCallback(() => {
    setUnlockedPaths(prev => ({ ...prev, sbP2: false, tq3: false }));
    setCompletedPaths(prev => ({ ...prev, sbP1: false, sbP2: false }));
    playAudio('SB_splash2.wav', () => {
      safeSetTimeout(() => runPathSequence(SB_PATH1_SEQ, 'sbP1', 'sbP2'), 500);
    });
  }, [playAudio, runPathSequence, safeSetTimeout]);

  // Handle auto-start on screen change
  useEffect(() => {
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && audioRef.current && !audioFinished) {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Autoplay blocked by browser policy:', err);
          setAudioFinished(true);
        });
      }
    }
    
    if (screen === 'splash') {
      hasAutoStarted.current = { sampleA: false, sampleB: false };
    } else if (screen === 'sampleA' && !hasAutoStarted.current.sampleA) {
      hasAutoStarted.current.sampleA = true;
      startAutoDemoA();
    } else if (screen === 'sampleB' && !hasAutoStarted.current.sampleB) {
      hasAutoStarted.current.sampleB = true;
      startAutoDemoSB();
    }
  }, [isCheckingSession, screen, showResumeModal, startAutoDemoA, startAutoDemoSB, audioFinished]);

  const handleGridClick = (r, c) => {
    const s = questionStateRef.current;
    if (!s.gameStarted || s.isComplete) return;
    const lastPos = s.path[s.path.length - 1];
    if (r === lastPos.row && c === lastPos.col) return;
    const isAdj = Math.abs(r - lastPos.row) <= 1 && Math.abs(c - lastPos.col) <= 1;
    if (!isAdj) return;
    if (s.matrix[r][c] === "7-T2") { 
      playSoundEffect('wrong_move.wav'); 
      setQuestionState(prev => ({ ...prev, wrongMovePos: { row: r, col: c } }));
      handleResult(false, "Hit Weed"); 
      return; 
    }
    
    const newPath = [...s.path, { row: r, col: c }];
    const cellType = s.matrix[r][c];
    const addMoves = cellType === "7-T3" ? 2 : 1;
    const newMoveCount = s.moveCount + addMoves;
    
    setQuestionState(prev => ({ ...prev, path: newPath, moveCount: newMoveCount }));
    playSoundEffect('move.wav');
    const isTQ = s.id.startsWith('tq');
    if (cellType === "7-EP") {
      clearInterval(timerRef.current);
      let isSuccess = false;
      let reason = '';
      if (isTQ) {
        const targetMoves = s.id === 'tq4' ? 5 : 3;
        if (newMoveCount === targetMoves) isSuccess = true;
        else reason = `Wrong Moves: ${newMoveCount}`;
      } else {
        const config = QUESTION_CONFIG[s.id];
        if (config && newMoveCount >= config.t2) isSuccess = true;
        else reason = `Too Few Moves: ${newMoveCount}`;
      }
      handleResult(isSuccess, reason, newMoveCount);
    }
  };

  const handleResult = (isSuccess, reason, finalMoveCount = null) => {
    const s = questionStateRef.current;
    const isTQ = s.id.startsWith('tq');
    let score = 0;
    const moveCount = finalMoveCount !== null ? finalMoveCount : s.moveCount;
    
    if (isSuccess) {
      if (isTQ) {
        score = s.currentTrial === 1 ? 2 : 1;
      } else {
        const config = QUESTION_CONFIG[s.id];
        if (config) {
          if (moveCount === config.t2) score = 2;
          else if (moveCount <= config.t1) score = 1;
        }
      }
    }
    
    const resultMsg = isSuccess ? `✅ Reached End | Score: ${score}` : `❌ ${reason} | Score: 0`;
    const now = Date.now();
    const startTimeToUse = qStartTimeRef.current;
    const timeTaken = startTimeToUse ? ((now - startTimeToUse) / 1000).toFixed(1) : "0.0";
    const scoreEntry = { id: s.id, score, moves: moveCount, trial: s.currentTrial, timeTaken, path: s.path, failReason: isSuccess ? null : reason };
    
    // Compute new scores array synchronously outside setState
    setAllScores(prev => {
      const existingIdx = prev.findIndex(e => e.id === s.id);
      let newArr;
      if (existingIdx !== -1) {
        newArr = [...prev];
        if (score >= newArr[existingIdx].score) {
          newArr[existingIdx] = { ...scoreEntry, timeTaken: (parseFloat(newArr[existingIdx].timeTaken) + parseFloat(timeTaken)).toFixed(1) };
        } else {
          newArr[existingIdx].timeTaken = (parseFloat(newArr[existingIdx].timeTaken) + parseFloat(timeTaken)).toFixed(1);
        }
      } else {
        newArr = [...prev, scoreEntry];
      }
      return newArr;
    });

    // Save to server outside setState (cannot use await inside setState callback)
    const currentScores = allScores;
    const existingIdx = currentScores.findIndex(e => e.id === s.id);
    let computedArr;
    if (existingIdx !== -1) {
      computedArr = [...currentScores];
      if (score >= computedArr[existingIdx].score) {
        computedArr[existingIdx] = { ...scoreEntry, timeTaken: (parseFloat(computedArr[existingIdx].timeTaken) + parseFloat(timeTaken)).toFixed(1) };
      } else {
        computedArr[existingIdx].timeTaken = (parseFloat(computedArr[existingIdx].timeTaken) + parseFloat(timeTaken)).toFixed(1);
      }
    } else {
      computedArr = [...currentScores, scoreEntry];
    }
    const latestTotal = computedArr.reduce((acc, item) => acc + item.score, 0);
    const isFinalQ = s.id === 'q18';
    saveToServer(isFinalQ ? 'completed' : 'in_progress', computedArr, latestTotal);
    
    setQStartTime(Date.now()); // Reset for next trial/question
    
    setQuestionState(prev => {
      const newState = { ...prev, gameStarted: false, isComplete: true, [`trial${prev.currentTrial}Result`]: resultMsg, [`trial${prev.currentTrial}Score`]: score };
      if (isTQ) {
        if (prev.currentTrial === 1) {
          if (score === 2) { newState.nextUnlocked = true; newState.trial2Hidden = true; }
          else { newState.trial2Unlocked = true; safeSetTimeout(() => startTrial(2), 1500); }
        } else { newState.nextUnlocked = true; }
      } else { newState.nextUnlocked = true; }
      return newState;
    });
    if (isSuccess) playSoundEffect('success.wav'); else playSoundEffect('failure.wav');
  };

  const submitAssessmentForm = async () => {
    setIsAssessmentSubmitting(true);
    try {
      // Mark session status appropriately
      const finalStatus = isDropped ? 'dropped' : (quitReason ? 'quit' : 'completed');
      await saveToServer(finalStatus);

      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_URL}/games/assessments`, {
        session_id: gameSessionId,
        child_id: childData.child_id,
        q1_enjoyment: assessment.q1,
        q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3,
        q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors,
        additional_notes: (assessment.notes || '') + (quitReason ? `\n[Quit Reason: ${quitReason}]` : ''),
      }, config);
      setAssessmentSubmitted(true);
      setAssessmentSaveMsg('✅ Assessment saved successfully!');
      safeSetTimeout(() => {
        generateAndUploadPDF();
      }, 1000);
    } catch (e) {
      console.error(e);
      setAssessmentSaveMsg('❌ Failed to save assessment. Please try again.');
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const generateAndUploadPDF = async () => {
    try {
      const element = document.getElementById('dashboard-capture-area');
      if (!element) return;
      
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('dashboard-capture-area');
          if (el) {
            el.style.background = '#ffffff';
            el.style.padding = '20px';
            el.style.borderRadius = '0';
          }
        },
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
      formData.append('pdf', pdfBlob, `${childNameSafe}_Chalo_Mela_Chalen_SES${gameSessionId}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', gameSessionId);
      formData.append('game_name', GAME_NAME);
      
      const config = {};
      const token = localStorage.getItem('token');
      if (token) config.headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_URL}/games/pdfs/upload`, formData, config);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    }
  };

  const handleRestartFresh = () => {
    setGameSessionId(null);
    setShowResumeModal(false);
    setScreen('splash');
    stopAll();
    // Reset all game state
    setAllScores([]);
    setUnlockedPaths({ p2: false, p3: false, tq1: false, sbP2: false, tq3: false });
    setCompletedPaths({ p1: false, p2: false, p3: false, sbP1: false, sbP2: false });
    setIsDropped(false);
    setAudioFinished(false);
    setRefreshCount(0);
    setRetakeCount(0);
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
    setQuitReason('');
    setAssessmentSubmitted(false);
    setIsPaused(false);
    hasAutoStarted.current = { sampleA: false, sampleB: false };
    setQuestionState({
      id: '',
      matrix: [],
      currentTrial: 1,
      gameStarted: false,
      path: [],
      moveCount: 0,
      timeRemaining: 10,
      trial1Result: "Not Started",
      trial2Result: "Not Started",
      trial1Score: 0,
      trial2Score: 0,
      trial2Unlocked: false,
      trial2Hidden: false,
      isComplete: false,
      nextUnlocked: false
    });
  };

  const handlePauseAction = async (actionStatus) => {
    if (!quitReason.trim()) {
      alert('Please provide a reason for pausing or quitting.');
      return;
    }
    
    if (actionStatus === 'quit') {
      await saveToServer('quit', null, null, quitReason);
      stopAll(); // stop all audio and timers before going to results
      setShowPauseModal(false);
      setIsPaused(false);
      setScreen('results');
    } else {
      await saveToServer(actionStatus);
      stopAll();
      setIsPaused(false);
      navigate('/');
    }
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
        if (target === 'notes') setAssessment(p => ({ ...p, notes: p.notes + final }));
        else setQuitReason(p => p + final);
      }
    };
    recognition.onend = () => { setIsRecording(false); setRecordingTarget(null); };
    recognition.onerror = () => { setIsRecording(false); setRecordingTarget(null); };
    window.activeRecognition = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingTarget(target);
  };

  const renderResultsScreen = () => {
    const attempted = allScores.length;
    const correctCount = allScores.filter(s => s.score > 0).length;
    const accuracy = TOTAL_QUESTIONS > 0 ? Math.round((correctCount / TOTAL_QUESTIONS) * 100) : 0;
    const totalTimeSeconds = allScores.reduce((acc, s) => acc + parseFloat(s.timeTaken), 0);
    const totalTimeMin = Math.floor(totalTimeSeconds / 60);
    const totalTimeSec = Math.floor(totalTimeSeconds % 60);

    return (
      <div className="results-screen" id="dashboard-capture-area">
        <div className="screen-header">
          <div>
            <div className="screen-title">{isDropped ? 'Session Dropped (Clinical Rule)' : (quitReason ? 'Session Terminated (Partial)' : 'Assessment Complete')}</div>
            <div className="screen-subtitle">{isDropped ? 'Q1-Q3 score < 2: System-enforced drop' : (quitReason ? 'Assessor requested early exit' : 'Test finished successfully')}</div>
          </div>
          <div className="chips">
            <span className="chip" style={{ background: '#4f46e5', color: '#fff' }}>Attempt #{attemptNo}</span>
            <span className="chip" style={{ background: '#eff6ff', color: '#2563eb' }}>Final Results</span>
            <span className="chip" style={{ background: '#f0fdf4', color: '#16a34a' }}>Time: {totalTimeMin}m {totalTimeSec}s</span>
          </div>
        </div>

        <div className="results-grid-top">
          <div className="score-main-card">
            <div className="score-big-circle">
              <div className="score-val">{correctCount}</div>
              <div className="score-label">/ {TOTAL_QUESTIONS}</div>
            </div>
            <div className="performance-meter">
              <div className="meter-bar">
                <div className="meter-fill" style={{ width: `${accuracy}%` }}></div>
              </div>
              <div className="meter-labels">
                <span>0</span>
                <span>Performance meter</span>
                <span>{TOTAL_QUESTIONS}</span>
              </div>
            </div>
          </div>

          <div className="metrics-summary-cards">
            <div className="metric-mini-card">
              <div className="metric-label">Total Score</div>
              <div className="metric-value">{correctCount} / {TOTAL_QUESTIONS}</div>
            </div>
            <div className="metric-mini-card">
              <div className="metric-label">Correct</div>
              <div className="metric-value" style={{ color: '#16a34a' }}>{correctCount}</div>
            </div>
            <div className="metric-mini-card">
              <div className="metric-label">Incorrect</div>
              <div className="metric-value" style={{ color: '#dc2626' }}>{TOTAL_QUESTIONS - correctCount}</div>
            </div>
            <div className="metric-mini-card">
              <div className="metric-label">Percentage</div>
              <div className="metric-value">{accuracy}.0%</div>
            </div>
            <div className="metric-mini-card">
              <div className="metric-label">Total Time</div>
              <div className="metric-value">{totalTimeMin}m {totalTimeSec}s</div>
            </div>
            <div className="metric-mini-card">
              <div className="metric-label">Questions</div>
              <div className="metric-value">{allScores.length} / {TOTAL_QUESTIONS}</div>
            </div>
            <div className="metric-mini-card">
              <div className="metric-label">Avg Time/Q</div>
              <div className="metric-value">{allScores.length > 0 ? (totalTimeSeconds / allScores.length).toFixed(0) : 0}s</div>
            </div>
          </div>
        </div>

        <div className="accordion-section">
          <div className="results-grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {allScores.map((s, idx) => {
              const matrix = MATRIX_MAP[s.id];
              const cumulativeMoves = [];
              let currentMoves = 0;
              if (s.path && matrix) {
                for (let i = 0; i < s.path.length; i++) {
                  if (i === 0) {
                    cumulativeMoves.push(0);
                  } else {
                    const p = s.path[i];
                    const type = matrix[p.row][p.col];
                    currentMoves += (type === "7-T3" ? 2 : 1);
                    cumulativeMoves.push(currentMoves);
                  }
                }
              }
              return (
                <div key={idx} className="result-mini-card" style={{ gap: '12px' }}>
                  <div className="res-card-top">
                    <span className="res-qname" style={{ fontSize: '1.05rem' }}>{s.id.toUpperCase()}</span>
                    <span className="res-status" style={{ fontSize: '1.3rem' }}>{s.score > 0 ? '✅' : '❌'}</span>
                  </div>
                  {s.failReason && (
                    <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '6px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', border: '1px solid #fca5a5' }}>
                      {s.failReason === "Hit Weed" ? "Question Ended Due to Illegal Moves" : 
                       s.failReason === "Timeout" ? "Time Out – Destination Not Achieved" : 
                       "Destination Not Achieved"}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f1f5f9', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Targeted Moves:</span>
                      <span style={{ color: '#1e293b', fontWeight: '700' }}>{getTargetMoves(s.id)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>User Moves:</span>
                      <span style={{ color: '#0369a1', fontWeight: '700' }}>{s.moves}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b', fontWeight: '600' }}>Time Taken:</span>
                      <span style={{ color: '#1e293b', fontWeight: '700' }}>{Math.round(parseFloat(s.timeTaken))}s</span>
                    </div>
                  </div>
                  {matrix && s.path && s.path.length > 0 && (
                    <div className="res-path-visualization" style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                       <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Selected Path</span>
                       <div className="mini-matrix" style={{ display: 'grid', gridTemplateColumns: `repeat(${matrix[0].length}, 1fr)`, gap: '2px', width: '100%', maxWidth: '240px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
                          {matrix.flat().map((type, i) => {
                             const r = Math.floor(i / matrix[0].length);
                             const c = i % matrix[0].length;
                             const pathIndex = s.path.findIndex(p => p.row === r && p.col === c);
                             const inPath = pathIndex !== -1;
                             const isStart = type === "7-SP";
                             const isEnd = type === "7-EP";
                             
                             let bg = '#ffffff';
                             if (inPath) {
                                bg = isStart ? '#bfdbfe' : isEnd ? '#bbf7d0' : '#e0e7ff';
                             } else {
                                if (isStart || isEnd) bg = '#f1f5f9';
                             }

                             return (
                               <div key={i} style={{ aspectRatio: '1/1', background: bg, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                 <img src={IMG_MAPPING[type]} alt={type} style={{ width: '85%', height: '85%', objectFit: 'contain', opacity: inPath ? 0.3 : 0.9 }} />
                                 {inPath && (
                                   <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '900', color: '#1e3a8a', textShadow: '0 0 4px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.8)' }}>
                                     {pathIndex === 0 ? "S" : cumulativeMoves[pathIndex]}
                                   </div>
                                 )}
                               </div>
                             );
                          })}
                       </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {assessmentSaveMsg && (
          <div style={{
            margin: '12px 0', padding: '12px 18px', borderRadius: '10px',
            background: assessmentSaveMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${assessmentSaveMsg.startsWith('✅') ? '#86efac' : '#fca5a5'}`,
            color: assessmentSaveMsg.startsWith('✅') ? '#16a34a' : '#dc2626',
            fontWeight: 600, fontSize: '0.9rem', textAlign: 'center',
          }}>
            {assessmentSaveMsg}
          </div>
        )}

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
            <button
                className="btn btn-primary"
                onClick={() => { setScreen('splash'); setGameSessionId(null); setAssessmentSubmitted(false); setAudioFinished(false); setAssessmentSaveMsg(''); }}
              >{t('game.retest')}</button>
            <button className="btn btn-secondary" onClick={() => { stopAll(); navigate('/'); }}>{t('game.home')}</button>
          </>
        </SessionAssessmentForm>
      </div>
    );
  };

  const renderQuestionShell = (title) => {
    const isTQ = questionState.id.startsWith('tq');
    const isT1Active = questionState.currentTrial === 1 && !questionState.nextUnlocked;
    const isT2Active = questionState.currentTrial === 2 && !questionState.nextUnlocked;
    const isT1Disabled = questionState.currentTrial > 1 || questionState.nextUnlocked;
    const isT2Disabled = questionState.nextUnlocked || !questionState.trial2Unlocked;

    return (
      <div className="screen">
        <div className="screen-header">
          <div>
            <div className="screen-title">Chalo Mela Chalen - {title}</div>
            <div className="screen-subtitle">
              {QUESTION_CONFIG[questionState.id]?.subtitle || ""}
            </div>
          </div>
          <div className="chips">
            {QUESTION_CONFIG[questionState.id]?.chips?.map(c => (
              <span key={c} className="chip">{c}</span>
            ))}
          </div>
        </div>
        <div className="pattern-controls">
          {!isTQ && (
            <button className={`pattern-btn ${refreshCount >= 1 || questionState.nextUnlocked ? 'pattern-btn-disabled' : 'pattern-btn-secondary'}`} disabled={refreshCount >= 1 || questionState.nextUnlocked} onClick={() => handleRefresh(questionState.currentTrial)}>🔄 Refresh</button>
          )}
          {isTQ && (
            <button className={`pattern-btn ${retakeCount >= 2 || questionState.nextUnlocked ? 'pattern-btn-disabled' : 'pattern-btn-secondary'}`} disabled={retakeCount >= 2 || questionState.nextUnlocked} onClick={handleRetake}>↺ Retake ({Math.max(0, 2 - retakeCount)}/2)</button>
          )}
          {isTQ && (
            <>
              <button className={`pattern-btn ${isT1Active ? 'pattern-btn-primary' : (isT1Disabled ? 'pattern-btn-disabled' : 'pattern-btn-secondary')}`} disabled={isT1Disabled} style={{ cursor: 'default' }}>Trial 1</button>
              {!questionState.trial2Hidden && (
                <button className={`pattern-btn ${isT2Active ? 'pattern-btn-primary' : (isT2Disabled ? 'pattern-btn-disabled' : 'pattern-btn-secondary')}`} disabled={isT2Disabled} style={{ cursor: 'default' }}>Trial 2</button>
              )}
            </>
          )}
          <button className={`pattern-btn ${questionState.nextUnlocked ? 'pattern-btn-highlight' : 'pattern-btn-disabled'}`} disabled={!questionState.nextUnlocked} onClick={async () => {
            if (questionState.id === 'tq1') initQuestion('tq2', MATRIX_TQ2);
            else if (questionState.id === 'tq2') initQuestion('q1', MATRIX_Q1);
            else if (questionState.id === 'q1') setScreen('sampleB');
            else if (questionState.id === 'tq3') initQuestion('tq4', MATRIX_TQ4);
            else if (questionState.id === 'tq4') initQuestion('q2', MATRIX_Q2);
            else if (questionState.id === 'q2') initQuestion('q3', MATRIX_Q3);
            else if (questionState.id === 'q3') {
              const q1s = allScores.find(s => s.id === 'q1')?.score || 0;
              const q2s = allScores.find(s => s.id === 'q2')?.score || 0;
              const q3s = allScores.find(s => s.id === 'q3')?.score || 0;
              if (q1s < 2 && q2s < 2 && q3s < 2) {
                // Drop Out - Only after first 3 main questions (q1, q2, q3)
                setIsDropped(true);
                setScreen('results');
                await saveToServer('dropped', null, null, 'Clinical Drop-Out Rule Triggered (Q1-Q3 < 2)', true);
              } else {
                initQuestion('q4', MATRIX_Q4);
              }
            }
            else if (questionState.id === 'q4') initQuestion('q5', MATRIX_Q5);
            else if (questionState.id === 'q5') initQuestion('q6', MATRIX_Q6);
            else if (questionState.id === 'q6') initQuestion('q7', MATRIX_Q7);
            else if (questionState.id === 'q7') initQuestion('q8', MATRIX_Q8);
            else if (questionState.id === 'q8') initQuestion('q9', MATRIX_Q9);
            else if (questionState.id === 'q9') initQuestion('q10', MATRIX_Q10);
            else if (questionState.id === 'q10') initQuestion('q11', MATRIX_Q11);
            else if (questionState.id === 'q11') initQuestion('q12', MATRIX_Q12);
            else if (questionState.id === 'q12') initQuestion('q13', MATRIX_Q13);
            else if (questionState.id === 'q13') initQuestion('q14', MATRIX_Q14);
            else if (questionState.id === 'q14') initQuestion('q15', MATRIX_Q15);
            else if (questionState.id === 'q15') initQuestion('q16', MATRIX_Q16);
            else if (questionState.id === 'q16') initQuestion('q17', MATRIX_Q17);
            else if (questionState.id === 'q17') initQuestion('q18', MATRIX_Q18);
            else {
              setScreen('results');
              await saveToServer('completed', allScores, totalScore);
            }
          }}>
            {questionState.id === 'tq1' ? 'Teaching Question 2' : questionState.id === 'tq2' ? 'Question 1' : questionState.id === 'q1' ? 'Sample B' : questionState.id === 'tq3' ? 'Teaching Question 4' : questionState.id === 'tq4' ? 'Question 2' : (questionState.id.startsWith('q') && parseInt(questionState.id.substring(1)) < 18) ? `Question ${parseInt(questionState.id.substring(1)) + 1}` : 'Next Question'}
          </button>
        </div>
        <div className="matrix-wrap">
          <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${questionState.matrix[0]?.length || 4}, 1fr)` }}>
            {questionState.matrix.flat().map((type, idx) => {
              const cols = questionState.matrix[0]?.length || 4;
              const r = Math.floor(idx / cols), c = idx % cols;
              const inPath = questionState.path.some(p => p.row === r && p.col === c);
              const isStart = questionState.matrix[r][c] === "7-SP";
              const isLast = questionState.path.length > 0 && questionState.path[questionState.path.length-1].row === r && questionState.path[questionState.path.length-1].col === c;
              const isEP = type === "7-EP";
              
              let highClass = "";
              if (inPath) {
                if (isStart) highClass = "cell-start";
                else if (isLast && isEP) highClass = "cell-end";
                else highClass = "cell-path";
              }
              const isWrongMove = questionState.wrongMovePos && questionState.wrongMovePos.row === r && questionState.wrongMovePos.col === c;
              
              return (
                <div key={idx} className={`matrix-cell ${highClass}`} onClick={() => handleGridClick(r, c)}>
                  <img src={IMG_MAPPING[type]} alt={type}/>
                  {isLast && <img src="/assets/images/chalo_mela_chale/character.png" alt="character" className="character-token" />}
                  {isWrongMove && <div className="cross-mark">❌</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="tq1-info-panel">
          <div className="info-row" style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'12px'}}>
            <div className="info-card"><div className="info-label">CURRENT TRIAL</div><div className="info-value">{questionState.gameStarted ? (isTQ ? `Trial ${questionState.currentTrial}` : 'Question') : '—'}</div></div>
            <div className="info-card"><div className="info-label">MOVES</div><div className="info-value">{questionState.moveCount}</div></div>
            <div className="info-card"><div className="info-label">TIME</div><div className="info-value" style={{color: questionState.timeRemaining <= 3 ? '#ef4444' : '#2563eb'}}>{questionState.timeRemaining}s</div></div>
            <div className="info-card"><div className="info-label">SCORE</div><div className="info-value">{totalScore}</div></div>
          </div>
          <div className="trial-results" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginTop:'12px'}}>
            <div className="result-card"><div className="result-title">Trial 1 Result</div><div className="result-details">{questionState.trial1Result}</div></div>
            {isTQ && !questionState.trial2Hidden && <div className="result-card"><div className="result-title">Trial 2 Result</div><div className="result-details">{questionState.trial2Result}</div></div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rover-body-shell">
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <img src="/cel_admin_logo.png" alt="CEL Logo" className="brand-img" />
            <div className="divider"></div>
            <span className="test-title">Chalo Mela Chalen</span>
          </div>
          <div className="stats">
            <div className="stat-pill"><span className="stat-label">CHILD ID</span><span className="stat-value">{childData?.child_id || '—'}</span></div>
            <div className="stat-pill"><span className="stat-label">SCORE</span><span className="stat-value">{totalScore}</span></div>
            {screen !== 'splash' && screen !== 'results' && (
              <button className="btn-pause-quit" onClick={() => { 
                setQuitReason(''); 
                setShowPauseModal(true); 
                setIsPaused(true);
                pauseStartTimeRef.current = Date.now();
                if (audioRef.current && !audioRef.current.paused) {
                  audioRef.current.pause();
                  audioRef.current.wasPlayingBeforePause = true;
                }
              }}><span>⏸</span> Pause/Quit</button>
            )}
          </div>
        </header>
        <main className="main">
          {screen === 'splash' && (
            <div className="screen">
              <div className="screen-header">
                <div style={{ textAlign: 'center', width: '100%' }}>
                  {/* Header text removed as requested */}
                </div>
              </div>
              <div className="card splash-card">
                <div className="splash-image-wrapper"><img src={`${IMG_DIR}/chalo_mela_chale.jpg`} alt="Chalo Mela Chalen" className="splash-image" /></div>
                <h2 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '25px', color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                  Welcome to Chalo Mela Chalen
                </h2>

                <div className="btn-row">
                  <button className={`btn btn-primary ${!audioFinished ? 'btn-disabled' : 'btn-highlight'}`} disabled={!audioFinished} onClick={() => setScreen('sampleA')} style={{ fontSize: '1.2rem', padding: '16px 40px' }}>Start Now</button>
                  <button className="btn btn-secondary" onClick={() => { setAudioFinished(false); playAudio('SB_splash.wav', () => setAudioFinished(true)); }} style={{ fontSize: '1.2rem', padding: '16px 40px' }}>Replay Audio</button>
                </div>

              </div>
            </div>
          )}
          {screen === 'sampleA' && (
            <div className="screen">
              <div className="screen-header">
                <div>
                  <div className="screen-title">Chalo Mela Chalen - Sample A</div>
                </div>
              </div>
          <div className="pattern-controls">
            <button 
              className={`pattern-btn ${activePath === 'p1' ? 'active-highlight' : (completedPaths.p1 ? 'pattern-btn-disabled' : 'pattern-btn-secondary')}`} 
              onClick={() => !isAnimating && !completedPaths.p1 && runPathSequence(PATH1_SEQ, 'p1', 'p2')}
            >Path 1</button>
            <button 
              className={`pattern-btn ${activePath === 'p2' ? 'active-highlight' : (completedPaths.p2 ? 'pattern-btn-disabled' : (unlockedPaths.p2 ? 'pattern-btn-secondary' : 'pattern-btn-disabled'))}`} 
              onClick={() => !isAnimating && !completedPaths.p2 && unlockedPaths.p2 && runPathSequence(PATH2_SEQ, 'p2', 'p3')}
            >Path 2</button>
            <button 
              className={`pattern-btn ${activePath === 'p3' ? 'active-highlight' : (completedPaths.p3 ? 'pattern-btn-disabled' : (unlockedPaths.p3 ? 'pattern-btn-secondary' : 'pattern-btn-disabled'))}`} 
              onClick={() => !isAnimating && !completedPaths.p3 && unlockedPaths.p3 && runPathSequence(PATH3_SEQ, 'p3', 'tq1')}
            >Path 3</button>
            <button 
              className={`pattern-btn ${unlockedPaths.tq1 ? 'pattern-btn-highlight' : 'pattern-btn-disabled'} ${isAnimating ? 'unclickable' : ''}`} 
              onClick={() => !isAnimating && unlockedPaths.tq1 && initQuestion('tq1', MATRIX_TQ1)}
            >Teaching Question 1</button>
          </div>
              <div className="matrix-wrap">
                <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${MATRIX_P1[0].length}, 1fr)` }}>
                  {MATRIX_P1.flat().map((type, idx) => {
                    const row = Math.floor(idx / 4) + 1, col = (idx % 4) + 1, rc = `R${row}C${col}`;
                    let highClass = "";
                    let isCurrent = false;
                    if (activePath) {
                      const seq = activePath === 'p1' ? PATH1_SEQ : activePath === 'p2' ? PATH2_SEQ : PATH3_SEQ;
                      const sIdx = seq.indexOf(rc);
                      if (sIdx !== -1 && sIdx <= pathProgress) {
                        if (sIdx === 0) highClass = "cell-start";
                        else if (sIdx === seq.length-1 && pathProgress === seq.length-1) highClass = "cell-end";
                        else highClass = "cell-path";
                      }
                      if (sIdx !== -1 && ((pathProgress === -1 && sIdx === 0) || sIdx === pathProgress)) {
                        isCurrent = true;
                      }
                    }
                    return (
                      <div key={idx} className={`matrix-cell ${highClass}`}>
                        <img src={IMG_MAPPING[type]} alt={type}/>
                        {isCurrent && <img src="/assets/images/chalo_mela_chale/character.png" alt="character" className="character-token" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {['tq1', 'tq2', 'q1', 'tq3', 'tq4', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18'].includes(screen) && renderQuestionShell(
            screen.startsWith('tq') ? `Teaching Question ${screen.substring(2)}` : `Question ${screen.substring(1)}`
          )}
          {screen === 'results' && renderResultsScreen()}
          
          {screen === 'sampleB' && (
            <div className="screen">
              <div className="screen-header">
                <div>
                  <div className="screen-title">Chalo Mela Chalen - Sample B</div>
                </div>
              </div>
          <div className="pattern-controls">
            <button 
              className={`pattern-btn ${activePath === 'sbP1' ? 'active-highlight' : (completedPaths.sbP1 ? 'pattern-btn-disabled' : 'pattern-btn-secondary')} unclickable`} 
            >Path 1</button>
            <button 
              className={`pattern-btn ${activePath === 'sbP2' ? 'active-highlight' : (completedPaths.sbP2 ? 'pattern-btn-disabled' : (unlockedPaths.sbP2 ? 'pattern-btn-secondary' : 'pattern-btn-disabled'))} unclickable`} 
            >Path 2</button>
            <button 
              className={`pattern-btn ${unlockedPaths.tq3 ? 'pattern-btn-highlight' : 'pattern-btn-disabled'} ${isAnimating ? 'unclickable' : ''}`} 
              onClick={() => !isAnimating && unlockedPaths.tq3 && initQuestion('tq3', MATRIX_TQ3)}
            >Teaching Question 3</button>
          </div>
              <div className="matrix-wrap">
                <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${MATRIX_SB[0].length}, 1fr)` }}>
                  {MATRIX_SB.flat().map((type, idx) => {
                    const cols = MATRIX_SB[0].length;
                    const row = Math.floor(idx / cols) + 1, col = (idx % cols) + 1, rc = `R${row}C${col}`;
                    let highClass = "";
                    let isCurrent = false;
                    if (activePath) {
                      const seq = activePath === 'sbP1' ? SB_PATH1_SEQ : SB_PATH2_SEQ;
                      const sIdx = seq.indexOf(rc);
                      if (sIdx !== -1 && sIdx <= pathProgress) {
                        if (sIdx === 0) highClass = "cell-start";
                        else if (sIdx === seq.length-1 && pathProgress === seq.length-1) highClass = "cell-end";
                        else highClass = "cell-path";
                      }
                      if (sIdx !== -1 && ((pathProgress === -1 && sIdx === 0) || sIdx === pathProgress)) {
                        isCurrent = true;
                      }
                    }
                    return (
                      <div key={idx} className={`matrix-cell ${highClass}`}>
                        <img src={IMG_MAPPING[type]} alt={type}/>
                        {isCurrent && <img src="/assets/images/chalo_mela_chale/character.png" alt="character" className="character-token" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showPauseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Pause or Quit</h2>
            <p>Why are you stopping the game? <span style={{ color: '#dc2626', fontWeight: 700 }}>* (Required)</span></p>
            
            <div className="modal-textarea-wrapper">
              <textarea 
                className="modal-textarea"
                placeholder="Please enter a reason here..."
                value={quitReason} 
                onChange={e => setQuitReason(e.target.value)}
              />
              <button 
                className={`modal-mic-btn ${isRecording && recordingTarget === 'quitReason' ? 'recording' : ''}`}
                onClick={() => toggleRecording('quitReason')}
              >
                🎙️
              </button>
            </div>

            <div className="modal-actions-row">
              <button className="modal-btn modal-btn-cancel" onClick={() => { 
                setShowPauseModal(false); 
                setIsPaused(false); 
                if (pauseStartTimeRef.current) {
                  const pauseDuration = Date.now() - pauseStartTimeRef.current;
                  if (qStartTimeRef.current) {
                    setQStartTime(prev => prev + pauseDuration);
                    qStartTimeRef.current += pauseDuration;
                  }
                  pauseStartTimeRef.current = null;
                }
                if (audioRef.current && audioRef.current.wasPlayingBeforePause) {
                  audioRef.current.play().catch(e => console.log('resume audio failed', e));
                  audioRef.current.wasPlayingBeforePause = false;
                }
              }}>Cancel</button>
              <button 
                className="modal-btn modal-btn-pause" 
                disabled={!quitReason.trim()}
                onClick={() => handlePauseAction('paused')}
              >
                Pause & Save
              </button>
              <button 
                className="modal-btn modal-btn-quit" 
                disabled={!quitReason.trim()}
                onClick={() => handlePauseAction('quit')}
              >
                Quit & End
              </button>
            </div>
          </div>
        </div>
      )}

      {showResumeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Saved Progress Found</h2>
            <p>You have a previously paused game session for this child. Would you like to resume?</p>
            <div className="modal-actions-row" style={{ marginTop: '20px' }}>
              <button className="modal-btn modal-btn-cancel" onClick={handleRestartFresh}>Restart Fresh</button>
              <button className="modal-btn modal-btn-pause" style={{ background: '#2563eb', color: 'white', border: 'none' }} onClick={resumeGame}>Resume Game</button>
            </div>
          </div>
        </div>
      )}

      {isPaused && <div style={{ position: 'fixed', inset: 0, zIndex: 999, cursor: 'not-allowed' }} />}
      <audio 
        ref={audioRef} 
        src={screen === 'splash' ? `${AUDIO_DIR}/SB_splash.wav` : undefined}
        onEnded={() => setAudioFinished(true)}
        onError={() => setAudioFinished(true)}
      />
    </div>
  );
};

export default ChaloMelaChaleGame;
