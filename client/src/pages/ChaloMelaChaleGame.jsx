import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
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
  tq2: { time: 10 },
  tq3: { time: 10 },
  tq4: { time: 10 },
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

const PATH1_SEQ = ["R4C1","R4C2","R4C3","R4C4","R3C4","R2C4","R2C3"];
const PATH2_SEQ = ["R4C1","R3C1","R2C1","R2C2","R2C3"];
const PATH3_SEQ = ["R4C1", "R3C1", "R2C2", "R2C3"];

const SB_PATH1_SEQ = ["R4C1","R3C1","R2C1","R2C2","R2C3","R2C4"];
const SB_PATH2_SEQ = ["R4C1","R3C1","R2C2","R2C3","R2C4"];

const ChaloMelaChaleGame = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [childData, setChildData] = useState(null);
  const [screen, setScreen] = useState('splash');
  const [allScores, setAllScores] = useState([]);
  const [audioFinished, setAudioFinished] = useState(false);
  const totalScore = allScores.reduce((acc, s) => acc + s.score, 0);
  const [gameSessionId, setGameSessionId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [qStartTime, setQStartTime] = useState(null);
  const [showResultsGrid, setShowResultsGrid] = useState(false);
  const [assessment, setAssessment] = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);
  
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingResumeData, setPendingResumeData] = useState(null);
  
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
  
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const questionStateRef = useRef(questionState);
  const hasAutoStarted = useRef({ sampleA: false, sampleB: false });
  
  useEffect(() => { questionStateRef.current = questionState; }, [questionState]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const stopAll = useCallback(() => {
    stopAudio();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsAnimating(false);
  }, [stopAudio]);

  useEffect(() => {
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
          setShowResumeModal(true);
        } else {
          // If in_progress but not paused, we might still want to resume or just start fresh
          // Usually, if it's in_progress and we are here, it's a new load
          startNewGame(childId);
        }
      } else {
        startNewGame(childId);
      }
    } catch (e) {
      console.error('Resume check failed', e);
      startNewGame(childId);
    }
  };

  const resumeGame = () => {
    if (!pendingResumeData) return;
    const ss = pendingResumeData;
    if (ss.allScores) setAllScores(ss.allScores);
    if (ss.unlockedPaths) setUnlockedPaths(ss.unlockedPaths);
    if (ss.completedPaths) setCompletedPaths(ss.completedPaths);
    if (ss.screen) setScreen(ss.screen);
    if (ss.questionState) setQuestionState(ss.questionState);
    
    setStartTime(Date.now()); // Reset session timer start to now (cumulative time is handled by progress)
    setQStartTime(Date.now());
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
      setStartTime(Date.now());
      setQStartTime(Date.now());
      
      // Initialize saved_state immediately so it's visible as In Progress
      setTimeout(() => {
        saveToServer('in_progress', [], 0);
      }, 500);
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
          isDropped: isDroppedOverride
        }
      }, config);
    } catch (e) { console.error('Save error', e); }
  };

  // Sync state on screen change to ensure real-time "In Progress" tracking
  useEffect(() => {
    if (gameSessionId && screen !== 'splash' && screen !== 'results') {
      saveToServer('in_progress');
    }
  }, [screen, gameSessionId]);

  const playAudio = useCallback((file, onEnded) => {
    stopAudio();
    const audio = new Audio(`${AUDIO_DIR}/${file}`);
    audioRef.current = audio;
    
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
      setTimeout(safeOnEnded, 1000); // Trigger fallback if play fails
    });
    
    audio.onended = safeOnEnded;
    
    // Absolute safety timeout if audio is longer than expected but never ends
    setTimeout(safeOnEnded, 20000); 

    return audio;
  }, [stopAudio]);

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
      isComplete: false
    }));
    playSoundEffect('start_trial.wav');
    timerRef.current = setInterval(() => {
      setQuestionState(prev => {
        if (prev.timeRemaining <= 1) { clearInterval(timerRef.current); handleResult(false, "Timeout"); return { ...prev, timeRemaining: 0 }; }
        if (prev.timeRemaining === 6) playSoundEffect('timer_warning.wav'); 
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);
  }, [stopAll, playSoundEffect]);

  const initQuestion = useCallback((id, matrix) => {
    stopAll();
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
      nextUnlocked: false
    };
    setQuestionState(newState);
    setScreen(id);
    if (!id.startsWith('tq')) {
      setTimeout(() => startTrial(1), 500);
    }
  }, [stopAll, startTrial]);

  // --- DEMO LOGIC ---
  const runPathSequence = useCallback(async (seq, pathKey, nextPathKey = null) => {
    setActivePath(pathKey); 
    setPathProgress(-1);
    setIsAnimating(true);
    
    await new Promise(r => setTimeout(r, 500));
    
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
      setPathProgress(i); await new Promise(r => setTimeout(r, stepDelay));
    }
    
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

        setTimeout(() => {
          if (nextPathKey === 'p2') runPathSequence(PATH2_SEQ, 'p2', 'p3');
          else if (nextPathKey === 'p3') runPathSequence(PATH3_SEQ, 'p3', 'tq1');
          else if (nextPathKey === 'sbP2') runPathSequence(SB_PATH2_SEQ, 'sbP2', 'tq3');
        }, 1000);
      }
    });
  }, [playAudio]);

  const startAutoDemoA = useCallback(() => {
    setUnlockedPaths(prev => ({ ...prev, p2: false, p3: false, tq1: false }));
    setCompletedPaths(prev => ({ ...prev, p1: false, p2: false, p3: false }));
    runPathSequence(PATH1_SEQ, 'p1', 'p2');
  }, [runPathSequence]);

  const startAutoDemoSB = useCallback(() => {
    setUnlockedPaths(prev => ({ ...prev, sbP2: false, tq3: false }));
    setCompletedPaths(prev => ({ ...prev, sbP1: false, sbP2: false }));
    playAudio('SB_splash2.wav', () => {
      setTimeout(() => runPathSequence(SB_PATH1_SEQ, 'sbP1', 'sbP2'), 500);
    });
  }, [playAudio, runPathSequence]);

  // Handle auto-start on screen change
  useEffect(() => {
    if (screen === 'splash') {
      hasAutoStarted.current = { sampleA: false, sampleB: false };
    } else if (screen === 'sampleA' && !hasAutoStarted.current.sampleA) {
      hasAutoStarted.current.sampleA = true;
      startAutoDemoA();
    } else if (screen === 'sampleB' && !hasAutoStarted.current.sampleB) {
      hasAutoStarted.current.sampleB = true;
      startAutoDemoSB();
    }
  }, [screen, startAutoDemoA, startAutoDemoSB]);

  const handleGridClick = (r, c) => {
    const s = questionStateRef.current;
    if (!s.gameStarted || s.isComplete) return;
    const lastPos = s.path[s.path.length - 1];
    if (r === lastPos.row && c === lastPos.col) return;
    const isAdj = Math.abs(r - lastPos.row) <= 1 && Math.abs(c - lastPos.col) <= 1;
    if (!isAdj) return;
    if (s.matrix[r][c] === "7-T2") { playSoundEffect('buzzer.wav'); handleResult(false, "Hit Weed"); return; }
    
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
    const timeTaken = qStartTime ? ((now - qStartTime) / 1000).toFixed(1) : "0.0";
    const scoreEntry = { id: s.id, score, moves: moveCount, trial: s.currentTrial, timeTaken };
    
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
      
      const latestTotal = newArr.reduce((acc, item) => acc + item.score, 0);
      
      // Auto-mark as completed if this is the final question (q18)
      const isFinalQ = s.id === 'q18';
      saveToServer(isFinalQ ? 'completed' : 'in_progress', newArr, latestTotal);
      
      return newArr;
    });
    
    setQStartTime(Date.now()); // Reset for next trial/question
    
    setQuestionState(prev => {
      const newState = { ...prev, gameStarted: false, isComplete: true, [`trial${prev.currentTrial}Result`]: resultMsg, [`trial${prev.currentTrial}Score`]: score };
      if (isTQ) {
        if (prev.currentTrial === 1) {
          if (score === 2) { newState.nextUnlocked = true; newState.trial2Hidden = true; }
          else { newState.trial2Unlocked = true; setTimeout(() => startTrial(2), 1500); }
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
      const finalStatus = quitReason ? 'quit' : 'completed';
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
      alert('Assessment successfully saved!');
    } catch (e) {
      console.error(e);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const handlePauseClick = () => {
    setIsPaused(true);
    setShowPauseModal(true);
    stopAll();
  };

  const handlePauseAction = async (actionStatus) => {
    if (!quitReason.trim()) {
      alert('Please provide a reason for pausing or quitting.');
      return;
    }
    
    if (actionStatus === 'quit') {
      // Save as in_progress first to capture current state, then move to results for assessment
      await saveToServer('in_progress'); 
      setShowPauseModal(false);
      setIsPaused(false);
      setScreen('results');
    } else {
      await saveToServer(actionStatus);
      // For 'paused', go to dashboard
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
      <div className="results-screen">
        <div className="screen-header">
          <div>
            <div className="screen-title">{quitReason ? 'Session Terminated (Partial)' : 'Assessment Complete'}</div>
            <div className="screen-subtitle">{quitReason ? 'Assessor requested early exit' : 'Test finished successfully'}</div>
          </div>
          <div className="chips">
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

        <div className="motivation-banner" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
          Excellent work! Keep it up! ⭐
        </div>

        <div className="accordion-section">
          <button className="accordion-btn" onClick={() => setShowResultsGrid(!showResultsGrid)}>
            {showResultsGrid ? '▼ Hide per-question results with time' : '▶ Show per-question results with time'}
          </button>
          {showResultsGrid && (
            <div className="results-grid-cards">
              {allScores.map((s, idx) => (
                <div key={idx} className="result-mini-card">
                  <div className="res-card-top">
                    <span className="res-qname">{s.id.toUpperCase()}</span>
                    <span className="res-status">{s.score > 0 ? '✅' : '❌'}</span>
                  </div>
                  <div className="res-card-bottom">
                    <span className="res-details">Moves: {s.moves} | {Math.round(parseFloat(s.timeTaken))} sec</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="assessment-form-section">
          <h3 className="form-section-title">Session Assessment Details</h3>
          {[
            { key: 'q1', label: 'Q1. Did the child enjoy playing the game?' },
            { key: 'q2', label: 'Q2. How did the child feel while playing?' },
            { key: 'q3', label: 'Q3. Did the child show signs of tiredness?' },
            { key: 'q4', label: 'Q4. Would the child like to play again?' },
          ].map(q => (
            <div key={q.key} className="form-group">
              <label className="form-label">{q.label}</label>
              <div className="radio-group">
                {['Yes, a lot', 'A little', 'Not much'].map(opt => (
                  <label key={opt} className="radio-item">
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

          <div className="form-group">
            <label className="form-label">Q5. Observed Behaviors during the session (Multiple selection allowed)</label>
            <div className="checkbox-grid">
              {[
                'Difficulty sustaining attention', 'Impulsive or random responding',
                'Negative reaction to correction', 'Hesitation in responding',
                'High focus or persistence', 'Calbalisation of a memory strategy',
                'Needed frequent reassurance', 'Calm and engaged throughout',
              ].map(bhv => (
                <label key={bhv} className="checkbox-item">
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

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Additional Notes</span>
              <button className="mic-btn" onClick={() => toggleRecording('notes')}>
                🎙️ {isRecording && recordingTarget === 'notes' ? 'Recording…' : 'Use Mic'}
              </button>
            </label>
            <textarea
              className="form-textarea"
              disabled={assessmentSubmitted}
              value={assessment.notes}
              onChange={e => setAssessment({ ...assessment, notes: e.target.value })}
              placeholder="Type or dictate observations…"
            ></textarea>
          </div>
        </div>

        <div className="final-actions">
          {assessmentSubmitted ? (
            <>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>Restart</button>
              <button className="btn btn-secondary" onClick={() => navigate('/')}>Back to Home</button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              disabled={isAssessmentSubmitting}
              onClick={submitAssessmentForm}
            >
              {isAssessmentSubmitting ? 'Saving...' : 'Submit Assessment'}
            </button>
          )}
        </div>
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
            <div className="screen-title">Rover - {title}</div>
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
          <button className="pattern-btn pattern-btn-secondary" onClick={() => startTrial(questionState.currentTrial)}>🔄 Refresh</button>
          <button className="pattern-btn pattern-btn-secondary" onClick={() => startTrial(questionState.currentTrial)}>↺ Retake</button>
          {isTQ && (
            <>
              <button className={`pattern-btn ${isT1Active ? 'pattern-btn-primary' : (isT1Disabled ? 'pattern-btn-disabled' : 'pattern-btn-secondary')}`} disabled={isT1Disabled} onClick={() => startTrial(1)}>Trial 1</button>
              {!questionState.trial2Hidden && (
                <button className={`pattern-btn ${isT2Active ? 'pattern-btn-primary' : (isT2Disabled ? 'pattern-btn-disabled' : 'pattern-btn-secondary')}`} disabled={isT2Disabled} onClick={() => startTrial(2)}>Trial 2</button>
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
                // We add an explicit flag in saved_state as requested
                await saveToServer('dropped', null, null, null, true);
                navigate('/');
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
              saveToServer('completed', allScores, totalScore);
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
              return <div key={idx} className={`matrix-cell ${highClass}`} onClick={() => handleGridClick(r, c)}><img src={IMG_MAPPING[type]} alt={type}/></div>;
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
          <div className="brand"><div className="brand-icon">R</div><span>Rover Game - Chalo Mela Chale</span></div>
          <div className="stats">
            <div className="stat-pill"><span className="stat-label">CHILD ID</span><span className="stat-value">{childData?.child_id || '—'}</span></div>
            <div className="stat-pill"><span className="stat-label">SCORE</span><span className="stat-value">{totalScore}</span></div>
            <button className="pause-btn-top" onClick={handlePauseClick} style={{ marginLeft: '8px' }}>Pause/Quit</button>
          </div>
        </header>
        <main className="main">
          {screen === 'splash' && (
            <div className="screen">
              <div className="screen-header"><div><div className="screen-title">Rover Game - Chalo Mela Chale</div></div></div>
              <div className="card splash-card">
                <div className="splash-image-wrapper"><img src={`${IMG_DIR}/chalo_mela_chale.jpg`} alt="Rover" className="splash-image" /></div>
                <div className="splash-title">Welcome to Rover</div>
                <div className="splash-subtitle">Please listen to the instructions. When the audio finishes, you can start the practice.</div>
                <div className="btn-row">
                  <button className={`btn btn-primary ${!audioFinished ? 'btn-disabled' : ''}`} disabled={!audioFinished} onClick={() => setScreen('sampleA')}>Start Now</button>
                  <button className="btn btn-secondary" onClick={() => playAudio('SB_splash.wav', () => setAudioFinished(true))}>Replay Audio</button>
                </div>
                <p className="instructions" style={{marginTop: '10px'}}>
                  The audio will play automatically. Once it ends, the <span className="accent-text">Start Now</span> button will become active.
                </p>
              </div>
            </div>
          )}
          {screen === 'sampleA' && (
            <div className="screen">
              <div className="screen-header">
                <div>
                  <div className="screen-title">Rover - Sample A</div>
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
                    if (activePath) {
                      const seq = activePath === 'p1' ? PATH1_SEQ : activePath === 'p2' ? PATH2_SEQ : PATH3_SEQ;
                      const sIdx = seq.indexOf(rc);
                      if (sIdx !== -1 && sIdx <= pathProgress) {
                        if (sIdx === 0) highClass = "cell-start";
                        else if (sIdx === seq.length-1 && pathProgress === seq.length-1) highClass = "cell-end";
                        else highClass = "cell-path";
                      }
                    }
                    return <div key={idx} className={`matrix-cell ${highClass}`}><img src={IMG_MAPPING[type]} alt={type}/></div>;
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
                  <div className="screen-title">Rover - Sample B</div>
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
                    if (activePath) {
                      const seq = activePath === 'sbP1' ? SB_PATH1_SEQ : SB_PATH2_SEQ;
                      const sIdx = seq.indexOf(rc);
                      if (sIdx !== -1 && sIdx <= pathProgress) {
                        if (sIdx === 0) highClass = "cell-start";
                        else if (sIdx === seq.length-1 && pathProgress === seq.length-1) highClass = "cell-end";
                        else highClass = "cell-path";
                      }
                    }
                    return <div key={idx} className={`matrix-cell ${highClass}`}><img src={IMG_MAPPING[type]} alt={type}/></div>;
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
              <button className="modal-btn modal-btn-cancel" onClick={() => { setShowPauseModal(false); setIsPaused(false); }}>Cancel</button>
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
              <button className="modal-btn modal-btn-cancel" onClick={() => { setShowResumeModal(false); startNewGame(childData?.child_id); }}>Start Fresh</button>
              <button className="modal-btn modal-btn-pause" style={{ background: '#2563eb', color: 'white', border: 'none' }} onClick={resumeGame}>Resume Game</button>
            </div>
          </div>
        </div>
      )}

      {isPaused && <div style={{ position: 'fixed', inset: 0, zIndex: 999, cursor: 'not-allowed' }} />}
    </div>
  );
};

export default ChaloMelaChaleGame;
