import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage, STT_LANG_MAP } from '../contexts/LanguageContext';
import { useHeaderConfig } from '../contexts/HeaderConfigContext';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import './ChaloMelaChaleGame.css';
const GAME_NAME = 'rover_mela';
const TOTAL_QUESTIONS = 18;
const MAX_SCORE = 44;

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
  q16: { time: 180, t2: 9, t1: 10 },
  q17: { time: 180, t2: 8, t1: 9 },
  q18: { time: 180, t2: 8, t1: 9 }
};

const QUESTION_SEQUENCE = ['tq1', 'tq2', 'q1', 'tq3', 'tq4', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18'];

const fmtMmSs = (secs) => {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
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

const kAdditionalCoinValue = 4;
const SAMPLE_A_COINS_TOTAL = 7;
// Fixed 9-coin bar shared by both SB paths (same fixed-total design as Sample A's 7).
// Ticket Ghar is the "7-T3" cell — the *second* cell in each path (index 1), not the "7-SP" start cell (index 0).
// Reaching it counts as 2 coins; every cell after that counts as 1 each. Path 1 crosses 6 of 9; Path 2 crosses 5 of 9 — each path resets independently.
const SAMPLE_B_COINS_TOTAL = 9;
// Local coin count within a single SB path, given its own pathProgress (-1/0 = not yet reached Ticket Ghar).
const sbLocalCoinCross = (progress) => (progress <= 0 ? 0 : progress + 1);

const fmtSecs = (v) => {
  if (v == null) return '—';
  const s = Math.round(Number(v));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;
};

const getCoinsTotal = (id) => {
  if (!id || id.startsWith('p') || id.startsWith('sb')) return 0;
  if (id.startsWith('tq')) return (id === 'tq4' ? 5 : 3) + kAdditionalCoinValue;
  return (QUESTION_CONFIG[id]?.t2 || 0) + kAdditionalCoinValue;
};

const CoinBar = ({ coinsTotal, moveCount, allCoinsDrained }) => {
  const size  = coinsTotal > 10 ? 54 : coinsTotal > 8 ? 60 : 66;
  const gap   = coinsTotal > 8  ? 3  : 5;

  let row1Count = coinsTotal;
  let row2Count = 0;

  if (coinsTotal > 7) {
    row1Count = Math.ceil(coinsTotal / 2);
    row2Count = Math.floor(coinsTotal / 2);
  }

  const renderCoin = (index) => {
    const isSpent = allCoinsDrained || index < moveCount;
    return (
      <div key={index} className="coin-slot" style={{ width: size, height: size }}>
        <img src="/assets/images/chalo_mela_chale/rover_coin_gold.png" className="coin-img" alt="" />
        {isSpent && (
          <img
            src="/assets/images/chalo_mela_chale/rover_cross.png"
            className="coin-cross"
            alt=""
            style={{ animationDelay: allCoinsDrained ? `${index * 30}ms` : '0ms' }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="coin-bar" style={{ gap: '8px' }}>
      <div className="coin-bar-col" style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, justifyContent: 'center' }}>
        {Array.from({ length: row1Count }, (_, i) => renderCoin(i))}
      </div>
      {row2Count > 0 && (
        <div className="coin-bar-col" style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px`, justifyContent: 'center' }}>
          {Array.from({ length: row2Count }, (_, i) => renderCoin(i + row1Count))}
        </div>
      )}
    </div>
  );
};

const PATH1_SEQ = ["R4C1","R4C2","R4C3","R4C4","R3C4","R2C4","R2C3"];
const PATH2_SEQ = ["R4C1","R3C1","R2C1","R2C2","R2C3"];
const PATH3_SEQ = ["R4C1", "R3C1", "R2C2", "R2C3"];

const SB_PATH1_SEQ = ["R4C1","R3C1","R2C1","R2C2","R2C3","R2C4"];
const SB_PATH2_SEQ = ["R4C1","R3C1","R2C2","R2C3","R2C4"];

const ChaloMelaChaleGame = () => {
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
  const location = useLocation();
  const [childData, setChildData] = useState(null);
  const [screen, setScreen] = useState('splash');
  const [allScores, setAllScores] = useState([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [retakeCount, setRetakeCount] = useState(0);
  const [collectedCoins, setCollectedCoins] = useState(0);
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
    nextUnlocked: false,
    allCoinsDrained: false,
  });
  
  const audioRef        = useRef(null);
  const timerRef        = useRef(null);
  const allIntervalsRef = useRef([]);
  const playingAudiosRef= useRef([]);
  const isStoppedRef    = useRef(false); // set true by stopAll; blocks ALL new audio/intervals
  const questionStateRef = useRef(questionState);
  const hasAutoStarted = useRef({ sampleA: false, sampleB: false });
  const isMountedRef          = useRef(false);
  const pdfGeneratedRef       = useRef(false);
  const tqTrialsRef           = useRef({});   // stores per-trial data for teaching questions
  const splashAudioStartedRef = useRef(false); // gate: play audio only once per splash entry

  // Single reused Audio element for all narration played via playAudio() (samplea/
  // sampleb/sa_path*/sb_path*/last_instruction). iOS Safari's autoplay-unlock is
  // tied to the specific HTMLMediaElement instance that was played during a user
  // gesture — a brand-new `new Audio()` created later doesn't inherit that unlock.
  // Reusing one instance (just swapping its src) means once it's unlocked, every
  // future narration clip played through it stays unlocked too.
  const pooledAudioRef = useRef(null);
  if (pooledAudioRef.current === null) pooledAudioRef.current = new Audio();

  // ── Session screentime timer ─────────────────────────────────────────────
  // Starts only when "Start Now" is clicked (or game is resumed); stops when assessment is submitted.
  const [timerSeconds, setTimerSeconds]   = useState(0);
  const timerSecondsRef                   = useRef(0);
  const sessionTimerRef                   = useRef(null);
  const [sessionActive, setSessionActive] = useState(false);

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
    if (!gameSessionId || assessmentSubmitted || !sessionActive) {
      clearInterval(sessionTimerRef.current);
      return;
    }
    sessionTimerRef.current = setInterval(() => {
      setTimerSeconds(s => { timerSecondsRef.current = s + 1; return s + 1; });
    }, 1000);
    return () => clearInterval(sessionTimerRef.current);
  }, [gameSessionId, assessmentSubmitted, sessionActive]);

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
    if (ss.collectedCoins !== undefined) setCollectedCoins(ss.collectedCoins);
    if (ss.tqTrials) tqTrialsRef.current = ss.tqTrials;
    if (ss.screentime) { timerSecondsRef.current = ss.screentime; setTimerSeconds(ss.screentime); }
    setStartTime(Date.now());
    setSessionActive(true);
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
          retakeCount,
          collectedCoins,
          tqTrials: tqTrialsRef.current,
          screentime: timerSecondsRef.current,
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

  // Auto-generate PDF when results screen loads (ensures Dashboard link appears in admin reports)
  useEffect(() => {
    if (screen === 'results' && gameSessionId && !pdfGeneratedRef.current) {
      pdfGeneratedRef.current = true;
      const t = setTimeout(() => { generateAndUploadPDF(); }, 2000);
      return () => clearTimeout(t);
    }
  }, [screen, gameSessionId]); // eslint-disable-line

  // Sync state on screen change to ensure real-time "In Progress" tracking
  useEffect(() => {
    if (gameSessionId && screen !== 'splash' && screen !== 'results') {
      saveToServer('in_progress');
    }
  }, [screen, gameSessionId]);

  const playAudio = useCallback((file, onEnded) => {
    if (isStoppedRef.current) return; // don't start new audio after stopAll
    stopAudio();
    const audio = pooledAudioRef.current; // reused, not `new Audio()` — see note above
    audio.src = `${AUDIO_DIR}/${file}`;
    audio.currentTime = 0;
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
    safeSetTimeout(safeOnEnded, 60000); 

    return audio;
  }, [stopAudio, safeSetTimeout]);

  const playSoundEffect = useCallback((file) => {
    const sfx = new Audio(`${AUDIO_DIR}/${file}`);
    sfx.play().catch(e => console.log('SFX play failed', e));
  }, []);

  const startTrial = useCallback((trialNum) => {
    stopAll();
    isStoppedRef.current = false; // reset: starting a new trial, not a permanent stop
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
      wrongMovePos: null,
      allCoinsDrained: false,
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
      isComplete: false,
      allCoinsDrained: false,
    }));
    playSoundEffect('start_trial.wav');
  }, [retakeCount, playSoundEffect]);

  const initQuestion = useCallback((id, matrix) => {
    stopAll();
    isStoppedRef.current = false; // reset: starting a new question, not a permanent stop
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
      wrongMovePos: null,
      allCoinsDrained: false,
    };
    setQuestionState(newState);
    setScreen(id);
    setQStartTime(null);
    qStartTimeRef.current = null;
    safeSetTimeout(() => startTrial(1), 500);
  }, [stopAll, startTrial, safeSetTimeout]);

  // --- DEMO LOGIC ---
  const animatePathA = useCallback(async (seq, pathKey, audioFile, durationMs, waitForAudio = true, delayBeforeMoveMs = 0, customStepDelays = {}) => {
    setActivePath(pathKey);
    setPathProgress(-1);
    setIsAnimating(true);
    
    let audioFinished = false;
    playAudio(audioFile, () => { audioFinished = true; });

    if (delayBeforeMoveMs > 0) {
      let elapsedDelay = 0;
      while(elapsedDelay < delayBeforeMoveMs) {
        await new Promise(r => setTimeout(r, 50));
        if (isStoppedRef.current) return;
        if (!isPausedRef.current) elapsedDelay += 50;
      }
    }

    const stepDelay = Math.round(durationMs / seq.length);
    for (let i = 0; i < seq.length; i++) {
      while(isPausedRef.current) await new Promise(r => setTimeout(r, 100));
      if (isStoppedRef.current) return;
      setPathProgress(i);

      let currentStepDelay = stepDelay;
      if (customStepDelays[i]) {
        currentStepDelay += customStepDelays[i];
      }
      if (currentStepDelay < 0) currentStepDelay = 0;

      let elapsed = 0;
      while(elapsed < currentStepDelay) {
        await new Promise(r => setTimeout(r, 50));
        if (isStoppedRef.current) return;
        if (!isPausedRef.current) elapsed += 50;
      }
    }

    if (waitForAudio) {
      while(!audioFinished) {
        await new Promise(r => setTimeout(r, 50));
        if (isStoppedRef.current) return;
      }
    }

    setCompletedPaths(prev => ({ ...prev, [pathKey]: true }));
    setIsAnimating(false);
  }, [playAudio]);

  const startAutoDemoA = useCallback(async () => {
    isStoppedRef.current = false;
    setUnlockedPaths(prev => ({ ...prev, p2: false, p3: false, tq1: false }));
    setCompletedPaths(prev => ({ ...prev, p1: false, p2: false, p3: false }));

    // Step 1: Wait 1 second
    let elapsed = 0;
    while(elapsed < 1000) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
      if (!isPausedRef.current) elapsed += 50;
    }

    // Play samplea.wav
    let audioFinished = false;
    playAudio('samplea.wav', () => { audioFinished = true; });
    while(!audioFinished) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
    }

    // Wait 1 second (reduced from 2000ms)
    elapsed = 0;
    while(elapsed < 1000) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
      if (!isPausedRef.current) elapsed += 50;
    }

    // Step 3: sa_path1.wav, duration 12.75s (movement 2s faster)
    setUnlockedPaths(prev => ({ ...prev, p1: true }));
    // Base stepDelay for p1 is 10750 / 7 = 1536ms
    await animatePathA(PATH1_SEQ, 'p1', 'sa_path1.wav', 10750, true, 1000, { 3: 1500 - 1536, 4: 500 - 1536 });
    if (isStoppedRef.current) return;
    
    // Step 4: sa_path2.wav, duration 17.34s (movement 2s faster)
    setUnlockedPaths(prev => ({ ...prev, p2: true }));
    // Base stepDelay is 15340 / 5 = 3068ms. We offset to hit exact target times.
    await animatePathA(PATH2_SEQ, 'p2', 'sa_path2.wav', 15340, false, 1000, { 1: 1000 - 3068, 2: 1000 - 3068, 3: 1000 - 3068, 4: -500 }); // Don't wait for audio to finish so Path 3 starts 3s earlier
    if (isStoppedRef.current) return;

    // Wait 0 seconds before path 3
    elapsed = 0;
    while(elapsed < 0) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
      if (!isPausedRef.current) elapsed += 50;
    }

    // Step 5: sa_path3.wav, duration 33.38s (movement reduced by 4s -> 24380)
    setUnlockedPaths(prev => ({ ...prev, p3: true }));
    // Base stepDelay for p3 is 24380 / 4 = 6095ms. Offsetting indices 0,1,2 to 1000ms.
    await animatePathA(PATH3_SEQ, 'p3', 'sa_path3.wav', 24380, true, 3000, { 0: 1200 - 6095, 1: 1200 - 6095, 2: 1200 - 6095 });
    if (isStoppedRef.current) return;

    // Completion
    setActivePath(null);
    setUnlockedPaths(prev => ({ ...prev, tq1: true }));

  }, [playAudio, animatePathA]);

  const startAutoDemoSB = useCallback(async () => {
    isStoppedRef.current = false;
    setUnlockedPaths(prev => ({ ...prev, sbP2: false, tq3: false }));
    setCompletedPaths(prev => ({ ...prev, sbP1: false, sbP2: false }));

    // Step 1: Wait 1 second
    let elapsed = 0;
    while(elapsed < 1000) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
      if (!isPausedRef.current) elapsed += 50;
    }

    // Play sampleb.wav
    let audioFinished = false;
    playAudio('sampleb.wav', () => { audioFinished = true; });
    while(!audioFinished) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
    }

    // Wait 2 seconds
    elapsed = 0;
    while(elapsed < 2000) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
      if (!isPausedRef.current) elapsed += 50;
    }

    // Step 3: sb_path1.wav, duration 12.735s
    // Base stepDelay for sbP1 is 12735 / 6 = 2123ms; cells 2-3, 3-4, 4-5, 5-6 tightened to ~1s
    setUnlockedPaths(prev => ({ ...prev, sbP1: true }));
    await animatePathA(SB_PATH1_SEQ, 'sbP1', 'sb_path1.wav', 12735, true, 0, { 1: 1000 - 2123, 2: 1000 - 2123, 3: 1000 - 2123, 4: 1000 - 2123 });
    if (isStoppedRef.current) return;
    
    // Wait 2 seconds
    elapsed = 0;
    while(elapsed < 2000) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
      if (!isPausedRef.current) elapsed += 50;
    }

    // Step 4: sb_path2.wav, duration 14.015s
    // Base stepDelay for sbP2 is 14015 / 5 = 2803ms; cells 2-3, 3-4, 4-5 tightened to ~1.5s
    setUnlockedPaths(prev => ({ ...prev, sbP2: true }));
    await animatePathA(SB_PATH2_SEQ, 'sbP2', 'sb_path2.wav', 14015, true, 0, { 1: 1500 - 2803, 2: 1500 - 2803, 3: 1500 - 2803 });
    if (isStoppedRef.current) return;

    // Step 5: Wait 2 seconds, then play last_instruction.wav
    elapsed = 0;
    while(elapsed < 2000) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
      if (!isPausedRef.current) elapsed += 50;
    }

    audioFinished = false;
    playAudio('last_instruction.wav', () => { audioFinished = true; });
    while(!audioFinished) {
      await new Promise(r => setTimeout(r, 50));
      if (isStoppedRef.current) return;
    }

    // Completion
    setActivePath(null);
    setUnlockedPaths(prev => ({ ...prev, tq3: true }));

  }, [playAudio, animatePathA]);

  // ── Layout effect: runs synchronously BEFORE browser paint ──────────────────
  // This guarantees the button is visually disabled before the user ever sees
  // the splash screen, regardless of which navigation path brought them here.
  useLayoutEffect(() => {
    if (screen === 'splash') {
      setAudioFinished(false);               // button locked — must complete audio first
      splashAudioStartedRef.current = false; // allow audio to play once
      hasAutoStarted.current = { sampleA: false, sampleB: false };
    }
  }, [screen]);

  // ── Audio auto-play + demo-screen trigger (after paint) ──────────────────
  // Plays as soon as the splash screen is visible — it used to also wait on
  // an in-flight resume-check network call that had no bearing on whether
  // the audio should play, which just delayed it for no functional reason.
  // showResumeModal (plus the pause-on-resume-modal effect right after this
  // one) already covers the one case that actually matters: not talking
  // over the resume modal if a resumable session turns up mid-playback.
  useEffect(() => {
    if (
      screen === 'splash' &&
      !showResumeModal &&
      !splashAudioStartedRef.current &&
      audioRef.current
    ) {
      splashAudioStartedRef.current = true;
      // Force-reload clears any stale error/ended state left from when src was
      // undefined on the results screen.  Without this, play() can immediately
      // reject and — via the old catch — instantly highlight the button.
      audioRef.current.load();
      audioRef.current.play().catch(err => {
        // play() failed (e.g. truly blocked by browser policy).
        // Do NOT set audioFinished here — that would highlight the button before
        // audio plays.  The Replay Audio button is the user's escape hatch.
        console.warn('Splash audio autoplay failed:', err);
      });
    } else if (screen === 'sampleA' && !hasAutoStarted.current.sampleA) {
      hasAutoStarted.current.sampleA = true;
      startAutoDemoA();
    } else if (screen === 'sampleB' && !hasAutoStarted.current.sampleB) {
      hasAutoStarted.current.sampleB = true;
      startAutoDemoSB();
    }
  }, [screen, showResumeModal, startAutoDemoA, startAutoDemoSB]); // eslint-disable-line

  // If a resumable session turns up mid-playback, don't talk over the modal.
  useEffect(() => {
    if (showResumeModal && audioRef.current) {
      audioRef.current.pause();
    }
  }, [showResumeModal]);

  // ── iOS Safari audio unlock ───────────────────────────────────────────────
  // iOS/iPadOS Safari ties its autoplay-unlock to the specific HTMLMediaElement
  // instance that was played during a user gesture — not to the page as a
  // whole. The splash audio autoplays on mount (no gesture yet), and the
  // demo-path narration (played through the reused pooledAudioRef) is
  // scheduled asynchronously, well after the "Start Now" tap. So this arms a
  // one-time listener for the very first tap/touch/key anywhere on the page
  // and, in that same gesture, directly primes BOTH real audio elements this
  // game ever plays through — the splash <audio> element and the pooled
  // narration element — with a real (silent) clip each, then immediately
  // resets them. Because both are reused for everything played later (the
  // splash element is only ever used for splash.wav; pooledAudioRef is
  // reused for every playAudio() call), priming them once here keeps them
  // unlocked for all later plays, regardless of how much time/async has
  // passed. Nothing about game flow/timing/logic changes — this only makes
  // the existing autoplay calls actually succeed on iOS Safari.
  const audioUnlockedRef = useRef(false);
  useEffect(() => {
    if (audioUnlockedRef.current) return;
    const events = ['touchstart', 'pointerdown', 'keydown'];
    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    const primeElement = (el) => {
      if (!el) return;
      const prevSrc = el.src;
      try {
        el.src = SILENT_WAV;
        el.play().then(() => {
          el.pause();
          el.currentTime = 0;
          el.src = prevSrc || '';
        }).catch(() => { el.src = prevSrc || ''; });
      } catch (_) { el.src = prevSrc || ''; }
    };
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      events.forEach(evt => document.removeEventListener(evt, unlock));
      primeElement(pooledAudioRef.current);
      if (screen === 'splash' && audioRef.current && audioRef.current !== pooledAudioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.load();
          audioRef.current.play().catch(() => {});
        }
      }
    };
    events.forEach(evt => document.addEventListener(evt, unlock, { passive: true }));
    return () => events.forEach(evt => document.removeEventListener(evt, unlock));
  }, [screen]);

  const handleGridClick = (r, c) => {
    const s = questionStateRef.current;
    if (!s.gameStarted || s.isComplete) return;
    const lastPos = s.path[s.path.length - 1];
    if (r === lastPos.row && c === lastPos.col) return;
    const isAdj = Math.abs(r - lastPos.row) <= 1 && Math.abs(c - lastPos.col) <= 1;
    if (!isAdj) return; // silent ignore — no state change, no scoring, no path closure
    if (s.matrix[r][c] === "7-T2") {
      clearInterval(timerRef.current);
      playSoundEffect('wrong_move.wav');
      setQuestionState(prev => ({ ...prev, allCoinsDrained: true, wrongMovePos: { row: r, col: c }, gameStarted: false }));
      safeSetTimeout(() => handleResult(false, "Hit Weed"), 400);
      return;
    }

    const newPath = [...s.path, { row: r, col: c }];
    const cellType = s.matrix[r][c];
    const addMoves = cellType === "7-T3" ? 2 : 1;
    const newMoveCount = s.moveCount + addMoves;

    const coinsTotal = getCoinsTotal(s.id);
    if (coinsTotal > 0 && newMoveCount >= coinsTotal && cellType !== "7-EP") {
      clearInterval(timerRef.current);
      setQuestionState(prev => ({ ...prev, path: newPath, moveCount: newMoveCount, allCoinsDrained: true, gameStarted: false }));
      safeSetTimeout(() => handleResult(false, "Out of Coins", newMoveCount), 400);
      return;
    }

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
      handleResult(isSuccess, reason, newMoveCount, newPath);
    }
  };

  const handleResult = (isSuccess, reason, finalMoveCount = null, finalPath = null) => {
    const s = questionStateRef.current;
    const isTQ = s.id.startsWith('tq');
    let score = 0;
    const moveCount = finalMoveCount !== null ? finalMoveCount : s.moveCount;
    // finalPath is passed from handleGridClick for EP clicks (ref not yet synced);
    // for timeout-based endings (hit weed, out of coins) the ref is already updated.
    const pathToSave = finalPath ?? s.path;

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

    const coinsTotal = getCoinsTotal(s.id);
    const coinsRemaining = coinsTotal > 0 ? Math.max(0, coinsTotal - moveCount) : 0;
    if (coinsRemaining > 0 && reason !== 'Hit Weed') {
      setCollectedCoins(prev => prev + coinsRemaining);
    }

    const resultMsg = isSuccess ? `✅ Reached End | Score: ${score}` : `❌ ${reason} | Score: 0`;
    const now = Date.now();
    const startTimeToUse = qStartTimeRef.current;
    const timeTaken = startTimeToUse ? ((now - startTimeToUse) / 1000).toFixed(1) : "0.0";

    // Store per-trial data for TQ questions so both trials appear in reports
    if (isTQ) {
      tqTrialsRef.current[`${s.id}_t${s.currentTrial}`] = { score, moves: moveCount, timeTaken, retakeCount, path: pathToSave };
    }
    const scoreEntry = { id: s.id, score, moves: moveCount, trial: s.currentTrial, timeTaken, path: pathToSave, failReason: isSuccess ? null : reason };
    
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
      // Regenerate PDF now that assessment answers are filled — overrides the earlier blank-form PDF
      pdfGeneratedRef.current = false;
      setTimeout(() => generateAndUploadPDF(), 1000);
    } catch (e) {
      console.error(e);
      const serverMsg = e.response?.data?.message;
      setAssessmentSaveMsg(`❌ Failed to save assessment. ${serverMsg ? serverMsg : 'Please try again.'}`);
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const generateAndUploadPDF = async () => {
    let wrapper = null;
    try {
      const element = document.getElementById('dashboard-capture-area');
      if (!element) return;
      
      document.body.classList.add('pdf-capturing');
      await new Promise(r => setTimeout(r, 100));

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Clone content into a clean wrapper directly on document.body so it has
      // NO .app / .rover-body-shell ancestors — no backdrop-filter, no rgba bleed.
      const originalNodes = element.querySelectorAll('*');
      const clone = element.cloneNode(true);
      const cloneNodes = clone.querySelectorAll('*');

      // Kill all CSS animations BEFORE appending to DOM.
      // The fadeIn animation starts from opacity:0 — if html2canvas captures during
      // that animation the whole PDF appears washed-out/grey.
      // Also neutralize any scrollable inner region — html2canvas paints scrollable
      // content as currently scrolled, so wide/tall content stays clipped even once
      // the outer container is unconstrained.
      clone.style.animation = 'none';
      clone.style.opacity = '1';
      cloneNodes.forEach((node, i) => {
        node.style.animation = 'none';
        node.style.transition = 'none';
        node.style.opacity = '';   // clear any inline opacity so full opacity is used
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
        windowHeight: wrapper.scrollHeight,
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
    } finally {
      document.body.classList.remove('pdf-capturing');
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
  };

  const handleRetest = () => {
    stopAll();
    isStoppedRef.current = false;
    setGameSessionId(null);
    setShowResumeModal(false);
    setScreen('splash');
    setAllScores([]);
    setUnlockedPaths({ p2: false, p3: false, tq1: false, sbP2: false, tq3: false });
    setCompletedPaths({ p1: false, p2: false, p3: false, sbP1: false, sbP2: false });
    setIsDropped(false);
    setAudioFinished(false);
    setRefreshCount(0);
    setRetakeCount(0);
    setCollectedCoins(0);
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
    setQuitReason('');
    setAssessmentSubmitted(false);
    setAssessmentSaveMsg('');
    setIsPaused(false);
    hasAutoStarted.current = { sampleA: false, sampleB: false };
    splashAudioStartedRef.current = false;
    pdfGeneratedRef.current = false;
    tqTrialsRef.current = {};
    setQuestionState({
      id: '', matrix: [], currentTrial: 1, gameStarted: false, path: [],
      moveCount: 0, timeRemaining: 10,
      trial1Result: 'Not Started', trial2Result: 'Not Started',
      trial1Score: 0, trial2Score: 0,
      trial2Unlocked: false, trial2Hidden: false,
      isComplete: false, nextUnlocked: false, allCoinsDrained: false,
    });
    // Start a fresh server session so the new attempt is saved
    if (childData?.child_id) startNewGame(childData.child_id);
  };

  const handleRestartFresh = () => {
    setGameSessionId(null);
    setShowResumeModal(false);
    setScreen('splash');
    stopAll();
    isStoppedRef.current = false; // reset: restarting fresh, not a permanent stop
    // Reset all game state
    setAllScores([]);
    setUnlockedPaths({ p2: false, p3: false, tq1: false, sbP2: false, tq3: false });
    setCompletedPaths({ p1: false, p2: false, p3: false, sbP1: false, sbP2: false });
    setIsDropped(false);
    setAudioFinished(false);
    setRefreshCount(0);
    setRetakeCount(0);
    setCollectedCoins(0);
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
    setQuitReason('');
    setAssessmentSubmitted(false);
    setIsPaused(false);
    hasAutoStarted.current = { sampleA: false, sampleB: false };
    splashAudioStartedRef.current = false;
    pdfGeneratedRef.current = false;
    tqTrialsRef.current = {};
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
      nextUnlocked: false,
      allCoinsDrained: false,
    });
  };

  const handlePauseAction = async (actionStatus) => {
    if (!quitReason.trim()) {
      alert(t('common.enterReason'));
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
    if (!SR) { alert(t('common.speechNotSupported')); return; }
    if (isRecording && recordingTarget === target) {
      if (window.activeRecognition) {
        window.activeRecognition.onend = null;
        window.activeRecognition.onerror = null;
        try { window.activeRecognition.stop(); } catch(e) {}
      }
      setIsRecording(false); setRecordingTarget(null); return;
    }

    // Explicitly kill any zombie hardware lock before creating a new one
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
        if (target === 'notes') setAssessment(p => ({ ...p, notes: p.notes + final }));
        else setQuitReason(p => p + final);
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

  const renderResultsScreen = () => {
    const nonTQScores = allScores.filter(s => !s.id.startsWith('tq'));
    const correctCount = nonTQScores.filter(s => s.score === 2).length;
    const partialCount = nonTQScores.filter(s => s.score === 1).length;
    const accuracy = MAX_SCORE > 0 ? Math.round((totalScore / MAX_SCORE) * 100) : 0;
    const totalTimeSeconds = nonTQScores.reduce((acc, s) => acc + parseFloat(s.timeTaken), 0);
    const totalTimeMin = Math.floor(totalTimeSeconds / 60);
    const totalTimeSec = Math.floor(totalTimeSeconds % 60);
    // Recompute from the recorded per-item data (same formula each result card shows) rather than
    // trusting the incrementally-accumulated collectedCoins state, so already-saved sessions self-correct.
    const teachingCoinItems = ['tq1', 'tq2', 'tq3', 'tq4'].flatMap(qId => {
      const t1 = tqTrialsRef.current[`${qId}_t1`];
      const t2 = tqTrialsRef.current[`${qId}_t2`];
      return [t1, t2].filter(Boolean).map(t => ({ qId, moves: t.moves }));
    });
    const totalCollectedCoins =
      nonTQScores.reduce((sum, s) => sum + (s.failReason === 'Hit Weed' ? 0 : Math.max(0, getCoinsTotal(s.id) - (s.moves || 0))), 0)
      + teachingCoinItems.reduce((sum, item) => sum + Math.max(0, getCoinsTotal(item.qId) - (item.moves || 0)), 0);

    return (
      <div className="results-screen" id="dashboard-capture-area" style={{ backgroundColor: '#fff', padding: '20px' }}>
        <div className="screen-header">
          <div>
            <div className="screen-title">{isDropped ? t('game.sessionDropped') : (quitReason ? t('game.sessionTerminatedPartial') : t('game.assessmentComplete'))}</div>
            <div className="screen-subtitle">{isDropped ? t('game.droppedSubtitle') : (quitReason ? t('game.assessorExit') : t('game.testFinished'))}</div>
          </div>
          <div className="chips">
            <span className="chip" style={{ background: '#4f46e5', color: '#fff' }}>{t('game.attemptLabel')}{attemptNo}</span>
            <span className="chip" style={{ background: '#f0fdf4', color: '#16a34a' }}>{t('game.timeChip')} {Math.floor(timerSeconds / 60)}m {(timerSeconds % 60).toString().padStart(2, '0')}s</span>
          </div>
        </div>

        {/* ── Compact summary card ── */}
        <div className="results-top-card">
          {/* Circle row-spans + 2 KPI rows */}
          <div className="results-main-grid">
            {/* Left: dial spans both KPI rows */}
            <div className="score-col">
              <div className="score-dial-sm">
                <div className="score-val-sm">{totalScore}</div>
                <div className="score-lbl-sm">/ {MAX_SCORE}</div>
              </div>
            </div>

            {/* Right: KPI row 1 */}
            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="kpi-card">
                <div className="kpi-label">{t('game.correct2')}</div>
                <div className="kpi-val kpi-green">{correctCount}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Partially</div>
                <div className="kpi-val" style={{ color: '#a16207' }}>{partialCount}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">{t('game.incorrect2')}</div>
                <div className="kpi-val kpi-red">{nonTQScores.filter(s => s.score === 0).length}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {t('game.percentage')} <span className="kpi-formula-icon" data-tooltip="Total Score ÷ Max Score × 100">ⓘ</span>
                </div>
                <div className="kpi-val">{accuracy}%</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: 1 }}>{totalScore} / {MAX_SCORE}</div>
              </div>
            </div>

            {/* Right: KPI row 2 */}
            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="kpi-card">
                <div className="kpi-label">{t('game.totalTime')}</div>
                <div className="kpi-val">{totalTimeMin}m {totalTimeSec}s</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">{t('game.questionsLabel')}</div>
                <div className="kpi-val">{nonTQScores.length} / {TOTAL_QUESTIONS}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">{t('game.avgTimeQ')}</div>
                <div className="kpi-val">{nonTQScores.length > 0 ? (totalTimeSeconds / nonTQScores.length).toFixed(0) : 0}s</div>
              </div>
              <div className="kpi-card kpi-coin">
                <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <img src="/assets/images/chalo_mela_chale/rover_coin_gold.png" style={{ width: 24, height: 24 }} alt="" />
                  Collected / Budget
                </div>
                <div className="kpi-val kpi-gold">{totalCollectedCoins}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="accordion-section">
          <div className="results-grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {(() => {
              // Helper: build cumulative moves for path visualization
              const buildCumMoves = (path, matrix) => {
                const cum = []; let cur = 0;
                for (let i = 0; i < path.length; i++) {
                  if (i === 0) { cum.push(0); continue; }
                  const t = matrix[path[i].row][path[i].col];
                  cur += (t === "7-T3" ? 2 : 1);
                  cum.push(cur);
                }
                return cum;
              };

              // Helper: status label + style from score
              const statusInfo = (score, isTQTrial2 = false) => {
                if (score === 2) return { label: 'Correct',   style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' } };
                if (score === 1) return { label: 'Correct',   style: { background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' } };
                if (isTQTrial2)  return { label: 'Incorrect', style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' } };
                return               { label: 'Incorrect',   style: { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' } };
              };

              // Helper: render a single card from a data object
              const renderCard = (key, label, scoreVal, maxScore, moves, timeTaken, failReason, path, qId, dimmed = false) => {
                const matrix = MATRIX_MAP[qId];
                const cumMoves = (path && matrix) ? buildCumMoves(path, matrix) : [];
                const qCoinsTotal = getCoinsTotal(qId);
                const qCoinsUsed  = failReason === 'Hit Weed' ? qCoinsTotal : (moves || 0);
                const qCoinsKept  = Math.max(0, qCoinsTotal - qCoinsUsed);
                const isTQ = qId.startsWith('tq');
                const isTrial2 = label.includes('Trial 2');

                let statusLabel, statusStyle;
                if (dimmed) {
                  statusLabel = 'Not Needed';
                  statusStyle = { background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' };
                } else if (isTQ) {
                  if (scoreVal > 0) {
                    statusLabel = 'Completed';
                    statusStyle = { background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' };
                  } else if (!isTrial2 && (moves || 0) === getTargetMoves(qId) + 1) {
                    statusLabel = '→ Trial 2';
                    statusStyle = { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
                  } else {
                    statusLabel = 'Not Completed';
                    statusStyle = { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' };
                  }
                } else {
                  statusLabel = scoreVal === 2 ? 'Correct' : scoreVal === 1 ? 'Partially' : 'Incorrect';
                  statusStyle = scoreVal === 2
                    ? { background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }
                    : scoreVal === 1
                    ? { background: '#fefce8', color: '#a16207', border: '1px solid #fde68a' }
                    : { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5' };
                }

                return (
                  <div key={key} className="result-mini-card" style={{ gap: '12px', opacity: dimmed ? 0.55 : 1 }}>
                    <div className="res-card-top">
                      <span className="res-qname" style={{ fontSize: '1.05rem' }}>{label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ ...statusStyle, padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700' }}>
                          {statusLabel}
                        </span>
                        {!dimmed && !isTQ && (
                          <span style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0', padding: '3px 9px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700' }}>
                            {scoreVal} / {maxScore}
                          </span>
                        )}
                      </div>
                    </div>

                    {!dimmed && failReason && (
                      <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '6px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center', border: '1px solid #fca5a5' }}>
                        {failReason === "Hit Weed"    ? t('game.questionEndedMoves') :
                         failReason === "Timeout"      ? t('game.timeoutDestination') :
                         failReason === "Out of Coins" ? '🪙 Out of coins' :
                         t('game.destinationNotAchieved')}
                      </div>
                    )}

                    {!dimmed && (
                      <div style={{ display: 'flex', gap: '12px', background: '#f1f5f9', padding: '8px 10px', borderRadius: '6px', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                        <span><span style={{ color: '#64748b', fontWeight: '600' }}>{t('game.targetedMoves')}</span> <span style={{ color: '#1e293b', fontWeight: '700' }}>{getTargetMoves(qId)}</span></span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span><span style={{ color: '#64748b', fontWeight: '600' }}>{t('game.userMoves')}</span> <span style={{ color: '#0369a1', fontWeight: '700' }}>{moves}</span></span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span><span style={{ color: '#64748b', fontWeight: '600' }}>{t('game.timeTakenLabel')}</span> <span style={{ color: '#1e293b', fontWeight: '700' }}>{fmtSecs(timeTaken)}</span></span>
                      </div>
                    )}

                    {dimmed && (
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', padding: '8px 0' }}>
                        Trial 1 passed — Trial 2 not needed
                      </div>
                    )}

                    {/* Coin trail */}
                    {!dimmed && qCoinsTotal > 0 && (
                      <div className="q-coin-trail">
                        <div className="q-coin-trail-label">
                          <img src="/assets/images/chalo_mela_chale/rover_coin_gold.png" style={{ width: 24, height: 24 }} alt="" />
                          <span>Budget {qCoinsTotal} · Used {qCoinsUsed} · Collected {qCoinsKept}</span>
                        </div>
                        <div className="q-coin-dots">
                          {Array.from({ length: qCoinsTotal }, (_, i) => (
                            <div key={i} className="q-coin-slot-mini">
                              <img src="/assets/images/chalo_mela_chale/rover_coin_gold.png" className="q-coin-img-mini" alt="" />
                              {i < qCoinsUsed && <img src="/assets/images/chalo_mela_chale/rover_cross.png" className="q-coin-cross-mini" alt="" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Path visualization */}
                    {!dimmed && matrix && path && path.length > 0 && (
                      <div className="res-path-visualization" style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div className="mini-matrix" style={{ display: 'grid', gridTemplateColumns: `repeat(${matrix[0].length}, 1fr)`, gap: '2px', width: '100%', maxWidth: '240px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
                          {matrix.flat().map((type, i) => {
                            const r = Math.floor(i / matrix[0].length);
                            const c = i % matrix[0].length;
                            const pathIndex = path.findIndex(p => p.row === r && p.col === c);
                            const inPath = pathIndex !== -1;
                            const isStart = type === "7-SP";
                            const isEnd   = type === "7-EP";
                            let bg = '#ffffff';
                            if (inPath) bg = isStart ? '#bfdbfe' : isEnd ? '#bbf7d0' : '#e0e7ff';
                            else if (isStart || isEnd) bg = '#f1f5f9';
                            return (
                              <div key={i} style={{ aspectRatio: '1/1', background: bg, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                <img src={IMG_MAPPING[type]} alt={type} style={{ width: '85%', height: '85%', objectFit: 'contain', opacity: inPath ? 0.3 : 0.9 }} />
                                {inPath && (
                                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '900', color: '#1e3a8a', textShadow: '0 0 4px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.8)' }}>
                                    {pathIndex === 0 ? "S" : cumMoves[pathIndex]}
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
              };

              // Render all cards in QUESTION_SEQUENCE order
              return QUESTION_SEQUENCE.flatMap(qId => {
                if (qId.startsWith('tq')) {
                  const teachingNum = qId.replace('tq', '');
                  const t1 = tqTrialsRef.current[`${qId}_t1`];
                  const t2 = tqTrialsRef.current[`${qId}_t2`];
                  const cards = [];
                  if (t1) {
                    cards.push(renderCard(
                      `${qId}_t1`, `${t('game.teachingLabel')} ${teachingNum} (${t('game.trialLabel')} 1)`,
                      t1.score, 2, t1.moves, t1.timeTaken, null, t1.path, qId
                    ));
                  }
                  if (t2) {
                    cards.push(renderCard(
                      `${qId}_t2`, `${t('game.teachingLabel')} ${teachingNum} (${t('game.trialLabel')} 2)`,
                      t2.score, 1, t2.moves, t2.timeTaken, null, t2.path, qId
                    ));
                  } else if (t1 && t1.score === 2) {
                    cards.push(renderCard(
                      `${qId}_t2`, `${t('game.teachingLabel')} ${teachingNum} (${t('game.trialLabel')} 2)`,
                      null, 1, null, null, null, null, qId, true
                    ));
                  }
                  return cards;
                }
                const n = qId.replace(/^q/, '');
                const s = allScores.find(e => e.id === qId);
                if (!s) return [];
                return [renderCard(s.id, `Q${n}`, s.score, 2, s.moves, s.timeTaken, s.failReason, s.path, qId)];
              });
            })()}
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
                className="cm-btn cm-btn-primary"
                onClick={handleRetest}
              >{t('game.retest')}</button>
            <button className="cm-btn cm-btn-secondary" onClick={() => { stopAll(); navigate('/'); }}>{t('game.home')}</button>
          </>
        </SessionAssessmentForm>
      </div>
    );
  };

  const renderQuestionShell = (title) => {
    const isTQ = questionState.id.startsWith('tq');
    const seqNum   = QUESTION_SEQUENCE.indexOf(questionState.id) + 1;
    const qNum     = parseInt(questionState.id.replace('q', ''), 10) || 0;
    const TOTAL_Q  = QUESTION_SEQUENCE.filter(id => !id.startsWith('tq')).length;

    return (
      <div className="cm-screen">
        <div className="screen-header">
          <div>
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
        <div className="matrix-with-coins">
          <div className="matrix-wrap">
            <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${questionState.matrix[0]?.length || 4}, 1fr)` }}>
              {questionState.matrix.flat().map((type, idx) => {
                const cols = questionState.matrix[0]?.length || 4;
                const rows = questionState.matrix.length || 4;
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
          {getCoinsTotal(questionState.id) > 0 && (
            <CoinBar
              coinsTotal={getCoinsTotal(questionState.id)}
              moveCount={questionState.moveCount}
              allCoinsDrained={questionState.allCoinsDrained || false}
            />
          )}
        </div>
        <div className="cm-btn-row" style={{ marginTop: 'auto', padding: '0 10px' }}>
          <div>
            {isTQ ? (
              <button
                className={`cm-btn ${retakeCount >= 2 || questionState.nextUnlocked ? 'cm-btn-disabled' : 'cm-btn-secondary'}`}
                disabled={retakeCount >= 2 || questionState.nextUnlocked}
                onClick={handleRetake}
              >
                {t('game.retakeBtn')} ({Math.max(0, 2 - retakeCount)}/2)
              </button>
            ) : (
              <button
                className={`cm-btn ${refreshCount >= 1 || questionState.nextUnlocked ? 'cm-btn-disabled' : 'cm-btn-secondary'}`}
                disabled={refreshCount >= 1 || questionState.nextUnlocked}
                onClick={() => handleRefresh(questionState.currentTrial)}
              >
                🔄 {t('game.refreshBtn')}
              </button>
            )}
          </div>
          <button
            className={`cm-btn ${questionState.nextUnlocked ? 'cm-btn-primary' : 'cm-btn-disabled'}`}
            disabled={!questionState.nextUnlocked}
            onClick={async () => {
              if (questionState.id === 'tq1') initQuestion('tq2', MATRIX_TQ2);
              else if (questionState.id === 'tq2') initQuestion('q1', MATRIX_Q1);
              else if (questionState.id === 'tq3') initQuestion('tq4', MATRIX_TQ4);
              else if (questionState.id === 'tq4') initQuestion('q2', MATRIX_Q2);
              else if (questionState.id === 'q1') setScreen('sampleB');
              else if (questionState.id === 'q2') initQuestion('q3', MATRIX_Q3);
              else if (questionState.id === 'q3') {
                const q1s = allScores.find(s => s.id === 'q1')?.score || 0;
                const q2s = allScores.find(s => s.id === 'q2')?.score || 0;
                const q3s = allScores.find(s => s.id === 'q3')?.score || 0;
                if (q1s < 2 && q2s < 2 && q3s < 2) {
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
            }}
          >
            {questionState.id === 'tq1' ? t('game.teachingQ2Label')
              : questionState.id === 'tq2' ? `${t('game.question')} 1`
              : questionState.id === 'tq3' ? t('game.teachingQ4Label')
              : questionState.id === 'tq4' ? `${t('game.question')} 2`
              : questionState.id === 'q1' ? t('game.sampleBLabel')
              : (questionState.id.startsWith('q') && parseInt(questionState.id.substring(1)) < 18) ? `${t('game.question')} ${parseInt(questionState.id.substring(1)) + 1}`
              : t('game.nextQuestion')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="cm-app">
        <header className="cm-topbar">
          <div className="cm-brand">
            {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="cm-brand-img" />}
            {showLogo && (showGameIcon || showGameName) && <div className="cm-divider"></div>}
            {showGameIcon && <img src="/assets/images/chalo_mela_chale/chalo_mela_chale.jpg" alt="Chalo Mela Chale" className="cm-mela-test-logo" />}
            {showGameName && <span className="cm-test-title">{t('home.games.mela.title')}</span>}
          </div>
          <div className="cm-topbar-center">
            {screen === 'sampleA' && (
              <div className="screen-title" style={{ margin: 0 }}>{t('game.sampleALabel')}</div>
            )}
            {screen === 'sampleB' && (
              <div className="screen-title" style={{ margin: 0 }}>{t('game.sampleBLabel')}</div>
            )}
            {screen.startsWith('tq') && (
              <div className="screen-title" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 14 }}>
                {`${t('game.teachingLabel')} ${screen.substring(2)}`}
                <span style={{ fontSize: '0.55em', fontWeight: 700, color: '#1d4ed8', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1.5px solid #93c5fd', borderRadius: 20, padding: '3px 14px', letterSpacing: '0.04em', boxShadow: '0 1px 4px rgba(59,91,219,0.10)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', boxShadow: '0 0 0 2px #bfdbfe' }} />
                  {t('game.trialLabel')} {questionState.currentTrial}
                </span>
              </div>
            )}
            {screen.startsWith('q') && !screen.startsWith('tq') && (
              <div className="screen-title" style={{ margin: 0 }}>
                {t('game.question')} {parseInt(screen.replace('q', ''), 10) || 0}
              </div>
            )}
          </div>
          <div className="cm-stats">
            {showChildId && (
            <div className="cm-stat-pill">
              <span className="cm-stat-icon" style={{marginRight: '6px', fontSize: '1.2rem'}}>👤</span>
              <span className="cm-stat-value">{childData?.child_id || '—'}</span>
            </div>
            )}
            {showTimer && (screen.startsWith('q') || screen.startsWith('tq')) && questionState?.id && (
              <div className="cm-stat-pill">
                <span className="cm-stat-icon" style={{marginRight: '6px', fontSize: '1.2rem'}}>⏱</span>
                <span className="cm-stat-value" style={{color: questionState.timeRemaining <= 5 ? '#ef4444' : undefined}}>
                  {fmtMmSs(questionState.timeRemaining)}
                </span>
              </div>
            )}
            {(screen.startsWith('q') || screen.startsWith('tq')) && questionState?.id && getCoinsTotal(questionState.id) > 0 && (
              <div className="cm-stat-pill">
                <span className="cm-stat-icon" style={{marginRight: '6px', display: 'flex', alignItems: 'center'}}>
                  <img src="/assets/images/chalo_mela_chale/rover_coin_gold.png" style={{ width: 22, height: 22 }} alt="coin" />
                </span>
                <span className="cm-stat-value">{collectedCoins}</span>
              </div>
            )}
            {showScore && (
            <div className="cm-stat-pill">
              <span className="cm-stat-icon" style={{marginRight: '6px', fontSize: '1.2rem'}}>🏆</span>
              <span className="cm-stat-value">{totalScore}</span>
            </div>
            )}
            {screen !== 'splash' && screen !== 'results' && (
              <button className="cm-btn-pause-quit" onClick={() => { 
                setQuitReason(''); 
                setShowPauseModal(true); 
                setIsPaused(true);
                pauseStartTimeRef.current = Date.now();
                if (audioRef.current && !audioRef.current.paused) {
                  audioRef.current.pause();
                  audioRef.current.wasPlayingBeforePause = true;
                }
              }}><span>⏸</span> {t('game.pauseQuit')}</button>
            )}
          </div>
        </header>
        <main className={`cm-main${screen === 'splash' ? ' cm-main-splash' : ''}${screen === 'results' ? ' cm-main-results' : ''}`}>
          {screen === 'splash' && (
            <div className="cm-screen cm-screen-splash">
              <div className="cm-splash-cover">
                <img src={`${IMG_DIR}/chalo_mela_chale.jpg`} alt="Chalo Mela Chalen" className="cm-splash-img-full" onError={e => { e.target.style.display = 'none'; }} />
                <div className="cm-splash-btn-overlay">
                  <button style={{ padding: '14px 40px', fontSize: '1.2rem' }} className={`cm-btn cm-btn-primary ${!audioFinished ? 'cm-btn-disabled' : ''}`} disabled={!audioFinished} onClick={() => { setScreen('sampleA'); setSessionActive(true); }}>{t('game.startNow')}</button>
                  <button style={{ padding: '14px 40px', fontSize: '1.2rem' }} className="cm-btn cm-btn-secondary" onClick={() => { setAudioFinished(false); playAudio('splash.wav', () => setAudioFinished(true)); }}>{t('game.replayAudio')}</button>
                </div>
              </div>
            </div>
          )}
          {screen === 'sampleA' && (
            <div className="cm-screen">
              <div className="screen-header">
                <div>
                </div>
              </div>
              <div className="matrix-with-coins">
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
                      } else if (!completedPaths.p1 && type === '7-SP') {
                        isCurrent = true;
                      } else if (completedPaths.p3 && type === '7-EP') {
                        isCurrent = true;
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
                <CoinBar
                  coinsTotal={SAMPLE_A_COINS_TOTAL}
                  moveCount={['p1', 'p2', 'p3'].includes(activePath) ? Math.max(0, pathProgress) : (completedPaths.p3 ? PATH3_SEQ.length - 1 : 0)}
                  allCoinsDrained={false}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', padding: '0 10px' }}>
                <button
                  className="pattern-btn pattern-btn-secondary"
                  style={{ padding: '14px 36px', fontSize: '1.2rem', minWidth: 'auto', background: '#e5edff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                  onClick={() => {
                    stopAll();
                    setTimeout(startAutoDemoA, 100);
                  }}
                  disabled={!unlockedPaths.tq1 || isAnimating}
                >{t('game.replayAudio')}</button>
                <button
                  style={{ padding: '14px 36px', fontSize: '1.2rem', minWidth: 'auto' }}
                  className={`pattern-btn ${unlockedPaths.tq1 ? 'pattern-btn-highlight' : 'pattern-btn-disabled'} ${isAnimating ? 'unclickable' : ''}`}
                  onClick={() => !isAnimating && unlockedPaths.tq1 && initQuestion('tq1', MATRIX_TQ1)}
                >{t('game.teachingQ1Label')}</button>
              </div>
            </div>
          )}
          {['tq1', 'tq2', 'q1', 'tq3', 'tq4', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18'].includes(screen) && renderQuestionShell(
            screen.startsWith('tq') ? `${t('game.teachingLabel')} ${screen.substring(2)}` : `${t('game.question')} ${screen.substring(1)}`
          )}
          {screen === 'results' && renderResultsScreen()}
          
          {screen === 'sampleB' && (
            <div className="cm-screen">
              <div className="screen-header">
                <div>
                </div>
              </div>
              <div className="matrix-with-coins">
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
                      } else if (!completedPaths.sbP1 && type === '7-SP') {
                        isCurrent = true;
                      } else if (completedPaths.sbP2 && type === '7-EP') {
                        isCurrent = true;
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
                <CoinBar
                  coinsTotal={SAMPLE_B_COINS_TOTAL}
                  moveCount={
                    activePath === 'sbP1' || activePath === 'sbP2' ? sbLocalCoinCross(pathProgress)
                    : completedPaths.sbP2 ? sbLocalCoinCross(SB_PATH2_SEQ.length - 1)
                    : completedPaths.sbP1 ? sbLocalCoinCross(SB_PATH1_SEQ.length - 1)
                    : 0
                  }
                  allCoinsDrained={false}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', padding: '0 10px' }}>
                <button
                  className="pattern-btn pattern-btn-secondary"
                  style={{ padding: '14px 36px', fontSize: '1.2rem', minWidth: 'auto', background: '#e5edff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                  onClick={() => {
                    stopAll();
                    setActivePath(null);
                    setPathProgress(-1);
                    setCompletedPaths(prev => ({ ...prev, sbP1: false, sbP2: false }));
                    setTimeout(startAutoDemoSB, 100);
                  }}
                  disabled={!unlockedPaths.tq3 || isAnimating}
                >{t('game.replayAudio')}</button>
                <button
                  style={{ padding: '14px 36px', fontSize: '1.2rem', minWidth: 'auto' }}
                  className={`pattern-btn ${unlockedPaths.tq3 ? 'pattern-btn-highlight' : 'pattern-btn-disabled'} ${isAnimating ? 'unclickable' : ''}`}
                  onClick={() => !isAnimating && unlockedPaths.tq3 && initQuestion('tq3', MATRIX_TQ3)}
                >{t('game.teachingQ3Label')}</button>
              </div>
            </div>
          )}
        </main>
      {showPauseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{t('game.pauseQuitTitle')}</h2>
            <p>{t('game.pauseDesc')} <span style={{ color: '#dc2626', fontWeight: 700 }}>{t('game.requiredStar')}</span></p>
            
            <div className="modal-textarea-wrapper">
              <textarea 
                className="modal-textarea"
                {...{placeholder: t('game.pausePlaceholder')}}
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
              }}>{t('game.cancel')}</button>
              <button 
                className="modal-btn modal-btn-pause" 
                disabled={!quitReason.trim()}
                onClick={() => handlePauseAction('paused')}
              >
                {t('game.pauseSave')}
              </button>
              <button 
                className="modal-btn modal-btn-quit" 
                disabled={!quitReason.trim()}
                onClick={() => handlePauseAction('quit')}
              >
                {t('game.quitEnd')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResumeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{t('game.progressFound')}</h2>
            <p>{t('game.progressDesc')}</p>
            <div className="modal-actions-row" style={{ marginTop: '20px' }}>
              <button className="modal-btn modal-btn-cancel" onClick={handleRestartFresh}>{t('game.restartFresh')}</button>
              <button className="modal-btn modal-btn-pause" style={{ background: '#2563eb', color: 'white', border: 'none' }} onClick={resumeGame}>{t('game.resumeGame')}</button>
            </div>
          </div>
        </div>
      )}

      {isPaused && <div style={{ position: 'fixed', inset: 0, zIndex: 999, cursor: 'not-allowed' }} />}
      <audio
        ref={audioRef}
        src={screen === 'splash' ? `${AUDIO_DIR}/splash.wav` : undefined}
        preload="auto"
        onEnded={() => setAudioFinished(true)}
      />
    </div>
  );
};

export default ChaloMelaChaleGame;
