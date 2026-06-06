import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import './AuditoryAttentionGame.css';

// ─── Constants & Configurations ─────────────────────────────────────────
const GAME_NAME = 'auditory_dhyan';

const CONFIG = {
  AUDIO_PATH: "/assets/audios/dhyan_kahan_hai",
  IMAGE_PATH: "/assets/images/dhyan_kahan_hai",
  
  TIMING: {
    WORD_INTERVAL: 1300,
    FEEDBACK_DURATION: 600
  },
  
  RESPONSE_WINDOW_WORDS: 0,
  
  IMAGES: [
    { id: 'suraj', name: 'Suraj', normal: 'suraj.png', highlighted: 'suraj_over.png' },
    { id: 'badal', name: 'Badal', normal: 'badal.png', highlighted: 'badal_over.png' },
    { id: 'tara',  name: 'Tara',  normal: 'tara.png',  highlighted: 'tara_over.png' },
    { id: 'chand', name: 'Chand', normal: 'chand.png', highlighted: 'chand_over.png' }
  ],
  
  QUESTION1: {
    TARGET_WORDS: ['SURAJ'], TARGET_IMAGES: ['suraj'],
    WORDS: [
      "CHAND","GHAAS","PANI","THEEK","SUNO","SURAJ","GOLA","CUP","TARA","GADHAA",
      "BADAL","SURAJ","DUS","DENA","TARA","GOLA","DUS","BHALOO","CUP","CHAND",
      "SURAJ","BADAL","TARA","DENA","DUS","GAAY","RAAT","CUP","BADAL",
      "GOLA","CHAND","DENA","SURAJ","TARA","DUS","PANI","CHAND","NAHI",
      "CUP","BADAL","GOLA","CHAND","CUP","TARA","GOLA","GHAAS","KHALI","TARA"
    ],
    INSTRUCTION_AUDIO: "question1.wav"
  },
  QUESTION2: {
    TARGET_WORDS: ['SURAJ', 'BADAL'], TARGET_IMAGES: ['suraj', 'badal'],
    WORDS: [
      "TARA","GOLA","GHAAS","KHALI","TARA","BADAL","CUP","SURAJ","THALI",
      "CHAND","TARA","LAO","CHAND","POORA","RAAT","BADAL","TARA",
      "CUP","SURAJ","GHAAS","PANI","THEEK","YAHAAN","CHAND","CUP","TARA","GADHAA",
      "DUS","GAAY","DENA","SURAJ","CHAND","GHAAS","PANI","THEEK","SUNO","TARA",
      "GOLA","CUP","TARA","GADHAA","DUS"
    ],
    INSTRUCTION_AUDIO: "question2.wav"
  },
  QUESTION3: {
    TARGET_WORDS: ['CHAND', 'TARA'], TARGET_IMAGES: ['chand', 'tara'],
    WORDS: [
      "BADAL","GAAY","DENA","SURAJ","TARA","GOLA","DUS","BHALOO","CUP","BADAL",
      "DENA","DUS","GAAY","RAAT","CUP","SURAJ","GOLA","DENA","TARA",
      "DUS","CHAND","BADAL","NAHI","CUP","BADAL","GOLA","CUP","GOLA",
      "CHAND","GHAAS","KHALI","TARA","BADAL","CUP","THALI","CHAND","CUP",
      "TARA","LAO","CUP","SURAJ","GOLA","CHAND","TARA","GHAAS","POORA","RAAT"
    ],
    INSTRUCTION_AUDIO: "question3.wav"
  },
  QUESTION4: {
    TARGET_WORDS: ['SURAJ', 'BADAL', 'CHAND', 'TARA'], TARGET_IMAGES: ['suraj', 'badal', 'chand', 'tara'],
    WORDS: [
      "SURAJ","BADAL","CUP","CHAND","TARA","SURAJ","YAHAAN","THEEK",
      "GOLA","CUP","TARA","GADHAA","DUS","CHAND","DENA","GAAY","SURAJ","GHAAS",
      "PANI","THEEK","SUNO","CHAND","GOLA","CUP","TARA","GADHAA","CHAND","SURAJ",
      "GAAY","DENA","TARA","GOLA","GAAY","BHALOO","SURAJ","CHAND","SUNO","THEEK"
    ],
    INSTRUCTION_AUDIO: "question4.wav"
  },
  AUDIO: { SAMPLE_INSTRUCTION: "aa_instruction.wav" }
};

// Formatting helpers
const formatTime = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const AuditoryAttentionGame = () => {
  const { t }    = useLanguage();
  const navigate = useNavigate();
  const [activityData, setActivityData] = useState({ lastPlayed: 'Never', attempts: 0 });

  // ─── Core Nav State ──────────────────────────────
  const [screen, setScreen] = useState('checking'); // checking, splash, sampleA, q1..q4-landing, q1..q4-game, score
  const [childId, setChildId] = useState('');
  const [childData, setChildData] = useState(null);
  const [gameSessionId, setGameSessionId] = useState(null);
  const [attemptNo, setAttemptNo] = useState(1);
  
  // Checking/Resume States
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  
  // Pause/Quit State
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  // ─── Game Global Tracking ────────────────────────
  const [questionScores, setQuestionScores] = useState({ 1: null, 2: null, 3: null, 4: null });
  const [questionTimes, setQuestionTimes] = useState({ 1: null, 2: null, 3: null, 4: null });

  // ─── Active Level Variables ──────────────────────
  const [currentQIndex, setCurrentQIndex] = useState(0); 
  const [wordsList, setWordsList] = useState([]);
  const [wordIndex, setWordIndex] = useState(-1);
  const [pendingTargets, setPendingTargets] = useState([]);
  
  const [levelScores, setLevelScores] = useState({ correct: 0, eoc: 0, eoi: 0, eoo: 0 });
  const [levelTime, setLevelTime] = useState(0);

  // Flow control
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [isPlayingWord, setIsPlayingWord] = useState(false);
  
  // Refs
  const audioRef = useRef(null);
  const wordAudioRef = useRef(null);
  const wordTimeoutRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const isGameRunningRef = useRef(false);
  // Hard lock: reset to false when each new word starts, set to true after one click
  const clickLockedRef = useRef(false);
  const isPausedRef = useRef(false);
  const wordsListRef = useRef([]);
  const wordIndexRef = useRef(-1);
  const pendingTargetsRef = useRef([]);
  const currentQIndexRef = useRef(0);
  const actionLogRef = useRef([]);
  const levelTimeRef = useRef(0);

  useEffect(() => { currentQIndexRef.current = currentQIndex; }, [currentQIndex]);

  // Toast
  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  // ─── Specific Screen states ───────────────────────
  // Sample A
  const [sampleClicked, setSampleClicked] = useState([]);
  const [sampleAudioPlaying, setSampleAudioPlaying] = useState(false);

  // Q Landing 
  const [landingAudioPlaying, setLandingAudioPlaying] = useState(false);
  const [canStartQ, setCanStartQ] = useState(true);

  // Assessment 
  const [assessment, setAssessment] = useState({ behaviors: [], notes: '' });
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  
  // Voice Recording Hook
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);
  
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

  useEffect(() => { isGameRunningRef.current = isGameRunning; }, [isGameRunning]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { wordsListRef.current = wordsList; }, [wordsList]);

  // ─── Clear Timeouts Helper ───────────────────────
  const clearAllTimers = useCallback(() => {
    if (wordTimeoutRef.current) clearTimeout(wordTimeoutRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    wordTimeoutRef.current = null;
    timerIntervalRef.current = null;
  }, []);

  useEffect(() => { return () => clearAllTimers(); }, [clearAllTimers]);

  // ─── Audio Helpers ───────────────────────────────
  const cleanupAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (wordAudioRef.current) { wordAudioRef.current.pause(); wordAudioRef.current.currentTime = 0; }
  };

  const showToast = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: '', message: '' }), CONFIG.TIMING.FEEDBACK_DURATION);
  };

  // ─── DB Setup & Resume Flow ──────────────────────
  const handleProceedClick = async (idToUse = childId) => {
    if (!idToUse || !idToUse.trim()) return;
    setIsCheckingSession(true);
    try {
      const res = await axios.get(`${API_URL}/games/sessions/resume/${idToUse}/${GAME_NAME}`);
      if (res.data.success && res.data.sessionInfo) {
        setResumeData(res.data.sessionInfo);
        setShowResumeModal(true);
      } else {
        setScreen('splash');
      }
    } catch (e) {
      console.error('Check Session Error:', e);
      setScreen('splash');
    } finally {
      setIsCheckingSession(false);
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem('currentChild');
    if (!raw) {
      navigate('/login');
      return;
    }
    try {
      const c = JSON.parse(raw);
      setChildData(c);
      setChildId(c.child_id);
      handleProceedClick(c.child_id);
      fetchActivity(c.child_id);
    } catch(e) {
      navigate('/login');
    }
  // eslint-disable-next-line
  }, []);

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

  const startNewGameSession = async () => {
    try {
      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childId,
        game_name: GAME_NAME,
        total_questions: 4
      });
      setGameSessionId(res.data.sessionId);
      setAttemptNo(res.data.attempt_no || 1);
      
      // Reset full state
      setQuestionScores({ 1: null, 2: null, 3: null, 4: null });
      setQuestionTimes({ 1: null, 2: null, 3: null, 4: null });
      setCanStartQ(false);
      setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
      setQuitReason('');
      setAssessmentSubmitted(false);
      setScreen('sampleA');
    } catch (e) {
      alert(t('common.failedToStart'));
      setCanStartQ(false);
      setScreen('sampleA');
    }
  };

  const resumeSessionData = () => {
    setShowResumeModal(false);
    if (!resumeData) return startNewGameSession();
    setGameSessionId(resumeData.id);
    setAttemptNo(resumeData.attempt_no || 1);
    
    // Parse scores
    const saved = resumeData.saved_state || {};
    const qs = { 1: null, 2: null, 3: null, 4: null };
    const qt = { 1: null, 2: null, 3: null, 4: null };
    
    if (saved.allScores && Array.isArray(saved.allScores)) {
      saved.allScores.forEach(s => {
        if (s.qId >= 1 && s.qId <= 4) {
          qs[s.qId] = s.scoreObj || { correct: s.score, eoc: 0, eoi: 0, eoo: 0 };
          qt[s.qId] = s.timeTaken;
        }
      });
    }
    setQuestionScores(qs);
    setQuestionTimes(qt);
    
    setCanStartQ(false);

     if (saved.activeQuestion) {
      const aq = saved.activeQuestion;
      setCurrentQIndex(aq.qIndex);
      currentQIndexRef.current = aq.qIndex;
      
      if (aq.screen && aq.screen.endsWith('-game')) {
        startGameForLevel(aq);
      } else {
        setScreen(aq.screen || 'splash');
      }
    } else {
      // Auto jump to first uncompleted question
      if (!qs[1]) { setScreen('question1-landing'); setCurrentQIndex(1); currentQIndexRef.current = 1; }
      else if (!qs[2]) { setScreen('question2-landing'); setCurrentQIndex(2); currentQIndexRef.current = 2; }
      else if (!qs[3]) { setScreen('question3-landing'); setCurrentQIndex(3); currentQIndexRef.current = 3; }
      else if (!qs[4]) { setScreen('question4-landing'); setCurrentQIndex(4); currentQIndexRef.current = 4; }
      else setScreen('score');
    }
  };

  const handleRestartFresh = () => {
    setGameSessionId(null);
    setShowResumeModal(false);
    setScreen('splash');
    cleanupAudio();
    // Reset all game state
    setQuestionScores({ 1: null, 2: null, 3: null, 4: null });
    setQuestionTimes({ 1: null, 2: null, 3: null, 4: null });
    setCurrentQIndex(0);
    setAssessment({ behaviors: [], notes: '', q1: '', q2: '', q3: '', q4: '' });
    setAssessmentSubmitted(false);
    setCanStartQ(true);
    setLandingAudioPlaying(false);
    setSampleClicked([]);
  };

  const getMappedSavedState = (qs, qt) => {
    const allScores = [];
    Object.keys(qs).forEach(qKey => {
      if (qs[qKey] !== null) {
        allScores.push({ 
          qId: parseInt(qKey), 
          score: qs[qKey].correct,
          eoi: qs[qKey].eoi || 0,
          eoo: qs[qKey].eoo || 0,
          eoc: qs[qKey].eoc || 0,
          timeTaken: Math.max(1, Math.round((qt[qKey] || 0) / 1000)),
          actionLog: qs[qKey].actionLog || [],
          scoreObj: qs[qKey] // internal reference
        });
      }
    });
    
    const state = { allScores };
    if (isGameRunning || isPaused) {
      state.activeQuestion = {
        qIndex: currentQIndex,
        wordIndex: wordIndexRef.current,
        levelScores,
        levelTime: levelTimeRef.current,
        actionLog: actionLogRef.current,
        pendingTargets: pendingTargetsRef.current,
        screen
      };
    }
    return state;
  };

  const syncSessionProgress = async (status, quitRsn = null, p_qs = questionScores, p_qt = questionTimes) => {
    if (!gameSessionId) return;
    try {
      const qNum = Object.values(p_qs).filter(v => v !== null).length;
      const totalCorrect = Object.values(p_qs).reduce((acc, curr) => acc + (curr ? curr.correct : 0), 0);
      
      const payload = {
        score: totalCorrect,
        progress_level: qNum,
        status: status,
        quit_reason: quitRsn,
        saved_state: getMappedSavedState(p_qs, p_qt)
      };
      await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, payload);
    } catch(e) {
      console.error('Session sync error', e);
    }
  };

  const handleQuitRequest = (actionType) => {
    if (isGameRunning) {
      setIsPaused(true); clearAllTimers();
    }
    syncSessionProgress(actionType, quitReason).then(() => {
      setShowQuitModal(false);
      if (actionType === 'quit') {
        setScreen('score');
      } else {
        navigate('/');
      }
    });
  };

  // ─── GAME CORE ENGINE ────────────────────────────
  const playInstructionAudio = (soundFile, onCompleted) => {
    cleanupAudio();
    audioRef.current = new Audio(`${CONFIG.AUDIO_PATH}/${soundFile}`);
    setLandingAudioPlaying(true);
    setCanStartQ(false);

    audioRef.current.onended = () => {
      setLandingAudioPlaying(false);
      setCanStartQ(true);
      if (onCompleted) onCompleted();
    };
    audioRef.current.onerror = () => {
      setLandingAudioPlaying(false);
      setCanStartQ(true);
    };
    audioRef.current.play().catch(() => {
      setLandingAudioPlaying(false);
      setCanStartQ(true);
    });
  };

  const stopInstructionAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setLandingAudioPlaying(false);
  };

  const navigateToLanding = (qIndex) => {
    cleanupAudio();
    setCanStartQ(false);
    setCurrentQIndex(qIndex);
    currentQIndexRef.current = qIndex;
    setScreen(`question${qIndex}-landing`);
  };
  useEffect(() => {
    if (!canStartQ) {
      if (screen === 'sampleA') {
        playInstructionAudio(CONFIG.AUDIO.SAMPLE_INSTRUCTION);
      } else if (screen === 'question1-landing') {
        playInstructionAudio(CONFIG.QUESTION1.INSTRUCTION_AUDIO);
      } else if (screen === 'question2-landing') {
        playInstructionAudio(CONFIG.QUESTION2.INSTRUCTION_AUDIO);
      } else if (screen === 'question3-landing') {
        playInstructionAudio(CONFIG.QUESTION3.INSTRUCTION_AUDIO);
      } else if (screen === 'question4-landing') {
        playInstructionAudio(CONFIG.QUESTION4.INSTRUCTION_AUDIO);
      }
    }
  }, [screen, canStartQ]);

  // -- Word playing loop --
  const getQConfig = (idx = currentQIndex) => {
    if (idx===1) return CONFIG.QUESTION1;
    if (idx===2) return CONFIG.QUESTION2;
    if (idx===3) return CONFIG.QUESTION3;
    if (idx===4) return CONFIG.QUESTION4;
    return {
      INSTRUCTION_AUDIO: '',
      TARGET_WORDS: [],
      TARGET_IMAGES: [],
      WORDS: []
    };
  };

  const playNextWord = useCallback(() => {
    if (!isGameRunningRef.current || isPausedRef.current) return;
    const currentWords = wordsListRef.current;

    const nextIndex = wordIndexRef.current + 1;
    wordIndexRef.current = nextIndex;
    setWordIndex(nextIndex);

    const config = getQConfig();
    if (!config) return;

    // Check pending targets for EOO (expired)
    let eooCount = 0;
    const newArr = pendingTargetsRef.current.filter(pt => {
      if (!pt.responded && nextIndex > pt.wordIndex + CONFIG.RESPONSE_WINDOW_WORDS) {
        eooCount++;
        return false;
      }
      return true;
    });

    if (eooCount > 0) {
      setLevelScores(prev => ({...prev, eoo: prev.eoo + eooCount}));
    }

    if (nextIndex >= currentWords.length) {
      pendingTargetsRef.current = newArr;
      setPendingTargets(newArr);
      setTimeout(() => completeCurrentQuestion(nextIndex), 500);
      return;
    }

    const nextWord = currentWords[nextIndex];
    const targetIndex = config.TARGET_WORDS.indexOf(nextWord);
    
    // If it's a target word, add to pending
    if (targetIndex !== -1) {
      newArr.push({
        targetWord: nextWord,
        targetImage: config.TARGET_IMAGES[targetIndex],
        wordIndex: nextIndex,
        responded: false
      });
    }

    // Log EVERY word
    actionLogRef.current.push({
      id: nextIndex,
      requestedWord: nextWord,
      response: 'No Tap',
      result: targetIndex !== -1 ? 'EOO' : 'No Action Required',
      time: formatTime(Math.floor(levelTimeRef.current/1000)),
      isTarget: targetIndex !== -1
    });

    pendingTargetsRef.current = newArr;
    setPendingTargets([...newArr]);

    // Play word audio
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
    }
    wordAudioRef.current = new Audio(`${CONFIG.AUDIO_PATH}/${nextWord.toLowerCase()}.wav`);
    clickLockedRef.current = false;   // reset: allow one click for this word cycle
    setIsPlayingWord(true);
    
    const finishWord = () => {
      setIsPlayingWord(false);
      wordTimeoutRef.current = setTimeout(playNextWord, CONFIG.TIMING.WORD_INTERVAL);
    };

    const skipWord = () => {
      setIsPlayingWord(false);
    };

    wordAudioRef.current.onended = finishWord;
    
    const fallbackTTS = () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(nextWord);
        utterance.rate = 0.9;
        utterance.onend = finishWord;
        utterance.onerror = skipWord;
        window.speechSynthesis.speak(utterance);
      } else {
        skipWord();
      }
    };
    
    wordAudioRef.current.onerror = fallbackTTS;
    wordAudioRef.current.play().catch(fallbackTTS);

  }, [currentQIndex]);

  const startGameForLevel = (resumeState = null) => {
    cleanupAudio();
    clearAllTimers();
    
    const isResume = !!(resumeState && resumeState.qIndex !== undefined);
    const qIdx = isResume ? resumeState.qIndex : currentQIndex;
    currentQIndexRef.current = qIdx;
    const config = getQConfig(qIdx);
    
    if (!config || !config.WORDS || config.WORDS.length === 0) {
      setScreen('splash');
      return;
    }
    setWordsList([...config.WORDS]);
    wordsListRef.current = [...config.WORDS];
    
    if (isResume) {
      wordIndexRef.current = resumeState.wordIndex ?? -1;
      setWordIndex(resumeState.wordIndex ?? -1);
      
      const pts = Array.isArray(resumeState.pendingTargets) ? resumeState.pendingTargets : [];
      pendingTargetsRef.current = [...pts];
      setPendingTargets([...pts]);
      
      const logs = Array.isArray(resumeState.actionLog) ? resumeState.actionLog : [];
      actionLogRef.current = [...logs];
      
      levelTimeRef.current = resumeState.levelTime || 0;
      setLevelTime(resumeState.levelTime || 0);
      setLevelScores(resumeState.levelScores || { correct: 0, eoc: 0, eoi: 0, eoo: 0 });
      setScreen(resumeState.screen || `question${currentQIndex}-game`);
    } else {
      wordIndexRef.current = -1;
      setWordIndex(-1);
      pendingTargetsRef.current = [];
      setPendingTargets([]);
      actionLogRef.current = [];
      levelTimeRef.current = 0;
      setLevelTime(0);
      setLevelScores({ correct: 0, eoc: 0, eoi: 0, eoo: 0 });
      setScreen(`question${currentQIndex}-game`);
    }

    setIsGameRunning(true);
    setIsPaused(false);
    clickLockedRef.current = false;

    // Timer setup
    timerIntervalRef.current = setInterval(() => {
      setLevelTime(prev => {
        const nt = prev + 100;
        levelTimeRef.current = nt;
        return nt;
      });
    }, 100);

    setTimeout(() => playNextWord(), resumeState ? 500 : 1500);
  };

  const completeCurrentQuestion = (finalWordLen) => {
    setIsGameRunning(false);
    clearAllTimers();
    
    // Add leftover pending as EOO
    setPendingTargets(prev => {
      const unresponded = prev.filter(pt => !pt.responded);
      if (unresponded.length > 0) {
        setLevelScores(s => ({...s, eoo: s.eoo + unresponded.length}));
      }
      return [];
    });

    // We must use a callback style functional update to freeze scores reliably
    setLevelScores(finalScores => {
      setLevelTime(finalTime => {
        // Prepare state update
        const finalObjWithLog = { ...finalScores, actionLog: [...actionLogRef.current] };
        const newQs = { ...questionScores, [currentQIndex]: finalObjWithLog };
        const newQt = { ...questionTimes, [currentQIndex]: finalTime };
        
        setQuestionScores(newQs);
        setQuestionTimes(newQt);
        
        syncSessionProgress('in_progress', null, newQs, newQt);
        return finalTime;
      });
      return finalScores;
    });
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
         setLevelTime(prev => {
            const nt = prev + 100;
            levelTimeRef.current = nt;
            return nt;
         });
      }, 100);
      wordTimeoutRef.current = setTimeout(playNextWord, 500);
    } else {
      setIsPaused(true);
      clearAllTimers();
      if (wordAudioRef.current) wordAudioRef.current.pause();
      syncSessionProgress('paused');
    }
  };

  // Image clicks handlers
  const onSampleImageClick = (id) => {
    if (landingAudioPlaying) return; // Prevent clicking while audio is playing
    setSampleClicked(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  };

  const onGameImageClick = (imageId) => {
    // Rule 1 & 2: block if game not running, paused, or no word played yet
    if (!isGameRunning || isPaused || wordIndexRef.current < 0) return;
    // Rule 2: disable clicks while word audio is playing
    if (isPlayingWord) return;
    // Rule 3 & 4: allow only one click per word cycle
    if (clickLockedRef.current) return;
    clickLockedRef.current = true;   // lock immediately — no more clicks this cycle
    
    const config = getQConfig();
    const currentWord = wordsList[wordIndexRef.current];
    const targetIdx = config.TARGET_WORDS.indexOf(currentWord);
    const isTargetWord = targetIdx !== -1;

    // SCORING DECISION TREE IMPLEMENTATION
    if (isTargetWord) {
      // 2. Target Word (Key Component)
      const expectedImage = config.TARGET_IMAGES[targetIdx];
      
      if (imageId === expectedImage) {
        // 2.A.i: Correct Response
        setLevelScores(prev => ({...prev, correct: prev.correct + 1 }));
        
        const logE = actionLogRef.current.find(l => l.id === wordIndexRef.current);
        if (logE) {
          logE.response = 'Tap';
          logE.result = 'Correct Response';
        }
      } else {
        // 2.A.ii: Error of Inhibition (EOI)
        setLevelScores(prev => ({...prev, eoi: prev.eoi + 1 }));
        
        const logE = actionLogRef.current.find(l => l.id === wordIndexRef.current);
        if (logE) {
          logE.response = 'Incorrect Tap';
          logE.result = 'EOI';
        }
      }

      // Mark as responded so EOO (Error of Omission) doesn't trigger later for this stimulus
      const pendingIndex = pendingTargetsRef.current.findIndex(pt => !pt.responded && pt.wordIndex === wordIndexRef.current);
      if (pendingIndex !== -1) {
        pendingTargetsRef.current[pendingIndex].responded = true;
        setPendingTargets([...pendingTargetsRef.current]);
      }

    } else {
      // 3. Non-Target Word
      // 3.A: Error of Commission (EOC)
      setLevelScores(prev => ({...prev, eoc: prev.eoc + 1 }));
      
      const logE = actionLogRef.current.find(l => l.id === wordIndexRef.current);
      if (logE) {
        logE.response = 'Wrong Tap';
        logE.result = 'EOC';
      }
    }
  };

  // ─── Assessment Submission ───────────────────────
  const submitAssessmentForm = async () => {
    setIsAssessmentSubmitting(true);
    try {
      await axios.post(`${API_URL}/games/assessments`, {
        session_id: gameSessionId, child_id: resumeData?.child_id || childId,
        q1_enjoyment: assessment.q1, q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3, q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors, additional_notes: assessment.notes
      });
      const finalStatus = quitReason ? 'quit' : 'completed';
      await syncSessionProgress(finalStatus, quitReason || null);

      // Small delay to ensure the DOM (including the summary table) is fully settled
      setTimeout(async () => {
        try {
          const element = document.getElementById('dashboard-container');
          if (element) {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const canvas = await html2canvas(element, { 
              scale: 1.5, 
              useCORS: true,
              windowWidth: element.scrollWidth,
              windowHeight: element.scrollHeight,
              logging: false
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.9);
            
            const pdfWidth = 210; 
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            
            const pdfBlob = pdf.output('blob');
            
            const formData = new FormData();
            const childNameSafe = (childData?.name || childId || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
            const ts = new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14);
            formData.append('pdf', pdfBlob, `${childNameSafe}_Dhyan_Kahan_Hai_SES${gameSessionId}_${ts}.pdf`);
            formData.append('child_id', childId);
            formData.append('session_id', gameSessionId);
            formData.append('game_name', 'auditory_dhyan');
            
            await axios.post(`${API_URL}/games/pdfs/upload`, formData);
            console.log("Dashboard PDF successfully uploaded for session:", gameSessionId);
          }
        } catch (err) {
          console.error("PDF generation failed:", err);
        }
      }, 1000);

      setAssessmentSubmitted(true);
      alert(t('game.assessmentSubmitted'));
    } catch (e) {
      alert(t('common.failedToSave'));
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  // ─── UI Renders ──────────────────────────────────
  
  // Progress Helper
  const displayWordCount = Math.min(wordsList.length, Math.max(0, wordIndex+1));
  const progressPct = wordsList.length ? Math.round((displayWordCount / wordsList.length) * 100) : 0;
  
  const renderNavButtons = () => {
     const isEnd = !isGameRunning && wordIndex >= wordsList.length - 1;
     
     if (isEnd) {
       if (currentQIndex === 4) {
         return <button className="aa-btn aa-btn-highlight" onClick={() => setScreen('score')}>🏆 Score Dashboard →</button>
       } else {
         return <button className="aa-btn aa-btn-highlight" onClick={() => navigateToLanding(currentQIndex + 1)}>Question {currentQIndex + 1} →</button>
       }
     }
     return null;
  };

  return (
    <div className="aa-wrap">
      <div className="aa-app">
        {/* TOPBAR */}
        <header className="aa-topbar">
          <div className="aa-brand">
            <img src="/cel_admin_logo.png" alt="CEL Logo" className="aa-brand-img" />
            <div className="aa-divider"></div>
            <img src="/assets/images/dhyan_kahan_hai/dhyan_kahan_hai.jpg" alt="Dhyan Kahan Hai" className="aa-test-logo" />
            <span className="aa-test-title">{t('home.games.dhyan.title')}</span>
          </div>
          <div className="aa-stats">
            {childId && (
              <div className="aa-stat-pill">
                <span className="aa-stat-label">{t('game.childId')}</span>
                <span className="aa-stat-value">{childId}</span>
              </div>
            )}
            <div className="aa-stat-pill">
              <span className="aa-stat-label">{t('game.score')}</span>
              <span className="aa-stat-value">{Object.values(questionScores).reduce((a,c) => a + (c ? c.correct : 0), 0) + levelScores.correct}</span>
            </div>
            {screen !== 'checking' && screen !== 'splash' && screen !== 'score' && (
              <button 
                className="btn-pause-quit" 
                onClick={() => {
                  if (isGameRunning) {
                    setIsPaused(true);
                  }
                  cleanupAudio();
                  clearAllTimers();
                  setQuitReason('');
                  setShowQuitModal(true);
                }}>
                <span>⏸</span> {t('game.pauseQuit')}
              </button>
            )}
          </div>
        </header>

        <main className="aa-main">
          
          {/* CHECKING STATE */}
          {screen === 'checking' && (
            <div className="aa-screen" style={{ backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
               <h2 className="aa-title">Loading...</h2>
            </div>
          )}

          {/* SPLASH */}
          {screen === 'splash' && (
            <div className="aa-screen">
               <div className="aa-header">
                 <div style={{ textAlign: 'center', width: '100%' }}>
                   {/* Header text removed as requested */}
                 </div>
               </div>
               <div className="aa-card aa-splash-card">
                 <div className="aa-splash-image-wrapper">
                    <img src={`${CONFIG.IMAGE_PATH}/dhyan_kahan_hai.jpg`} alt="Dhyan" className="aa-splash-image" />
                 </div>
                 <h2 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '28px', color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                   {t('game.welcomeDhyan')}
                 </h2>

                  <button
                    className={`aa-btn aa-btn-primary ${canStartQ ? 'aa-btn-highlight' : ''}`}
                    disabled={!canStartQ}
                    style={{ fontSize: '1.2rem', padding: '16px 40px', opacity: !canStartQ ? 0.6 : 1, cursor: !canStartQ ? 'not-allowed' : 'pointer' }}
                    onClick={startNewGameSession}
                  >
                    {t('game.startNow')}
                  </button>
               </div>
            </div>
          )}

          {/* SAMPLE A */}
          {screen === 'sampleA' && (
            <div className="aa-screen">
               <div className="aa-header">
                 <div>
                   <h2 className="aa-title">{t('game.sampleQuestionA')}</h2>
                   <p className="aa-subtitle">Listen to instructions and click all images</p>
                 </div>
               </div>
               
               <div className="aa-audio-panel">
                 <div className="aa-audio-status">
                   <div className={`aa-audio-indicator ${landingAudioPlaying ? 'playing' : ''}`}>
                      <div className="aa-audio-waves">
                        {[1,2,3,4,5].map(i => <div key={i} className="aa-audio-wave"></div>)}
                      </div>
                   </div>
                 </div>
                 <div className="aa-btn-row">
                    <button className="aa-btn aa-btn-secondary aa-btn-sm" onClick={() => {
                      setSampleClicked([]);
                      playInstructionAudio(CONFIG.AUDIO.SAMPLE_INSTRUCTION);
                    }}>↻ Replay</button>
                    <button className="aa-btn aa-btn-secondary aa-btn-sm" onClick={stopInstructionAudio}>■ Stop</button>
                 </div>
               </div>


               <div className="aa-image-area">
                 <div className="aa-image-row">
                   {CONFIG.IMAGES.map(img => {
                     const isClicked = sampleClicked.includes(img.id);
                     return (
                     <div key={img.id} onClick={() => onSampleImageClick(img.id)} className={`aa-image-item ${isClicked ? 'selected' : ''}`}>
                        <img className="aa-selectable-image" src={`${CONFIG.IMAGE_PATH}/${isClicked ? img.highlighted : img.normal}`} alt={img.name} />
                        <span className="aa-image-label">{img.name}</span>
                     </div>
                     );
                   })}
                 </div>
               </div>

               <div className="aa-nav-panel">
                 <div></div>
                 {sampleClicked.length >= 4 && (
                   <button className="aa-btn aa-btn-primary aa-btn-highlight" onClick={() => navigateToLanding(1)}>Question 1 →</button>
                 )}
               </div>
            </div>
          )}

          {/* LANDING SCREENS */}
          {screen && screen.endsWith('-landing') && (
            <div className="aa-screen">
               <div className="aa-header">
                 <div>
                   <h2 className="aa-title">Question {currentQIndex}</h2>
                   <p className="aa-subtitle">{t('game.listenInstructions')}</p>
                 </div>
               </div>

               <div className="aa-audio-panel">
                 <div className="aa-audio-status">
                   <div className={`aa-audio-indicator ${landingAudioPlaying ? 'playing' : ''}`}>
                      <div className="aa-audio-waves">{[1,2,3,4,5].map(i => <div key={i} className="aa-audio-wave"></div>)}</div>
                   </div>
                 </div>
                 <div className="aa-btn-row">
                    <button className="aa-btn aa-btn-secondary aa-btn-sm" onClick={() => playInstructionAudio(getQConfig().INSTRUCTION_AUDIO, () => setCanStartQ(true))}>↻ Replay</button>
                    <button className="aa-btn aa-btn-secondary aa-btn-sm" onClick={stopInstructionAudio}>■ Stop</button>
                 </div>
               </div>

               <div className="aa-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                 <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: '1.2rem' }}>
                   Click on the <strong style={{color: 'var(--danger)'}}>{getQConfig().TARGET_WORDS.join(' & ')}</strong> image whenever you hear it.
                 </p>
                 <div className="aa-image-row" style={{ marginBottom: 30 }}>
                    {CONFIG.IMAGES.map(img => {
                      const isT = getQConfig().TARGET_IMAGES.includes(img.id);
                      return (
                        <div key={img.id} className={`aa-image-item ${isT ? 'target-item selected' : ''}`} style={{cursor: 'default'}}>
                           <img src={`${CONFIG.IMAGE_PATH}/${isT ? img.highlighted : img.normal}`} alt={img.name} className="aa-selectable-image" />
                           <span className="aa-image-label">{img.name}</span>
                        </div>
                      );
                    })}
                 </div>
                 <button disabled={!canStartQ} className={`aa-btn ${canStartQ ? 'aa-btn-success aa-btn-highlight' : 'aa-btn-secondary'}`} onClick={() => startGameForLevel()}>
                   ▶ Start Question {currentQIndex}
                 </button>
               </div>
            </div>
          )}

          {/* GAMEPLAY SCREENS */}
          {screen && screen.endsWith('-game') && (
            <div className="aa-screen">
               <div className="aa-header">
                 <div>
                   <h2 className="aa-title">Question {currentQIndex}</h2>
                 </div>
                 <div className="aa-chips">
                   <div className="aa-timer-display"><span className="aa-timer-icon">⏱</span> {formatTime(Math.floor(levelTime/1000))}</div>
                 </div>
               </div>

               <div className="aa-game-info-bar">
                 <div className="aa-info-group">
                   <span className="aa-info-label">Word:</span>
                   <span className="aa-info-value">{displayWordCount} / {wordsList.length}</span>
                 </div>
                 <div className="aa-info-group">
                   <span className="aa-info-label">{t('game.progressFound')}:</span>
                   <span className="aa-info-value" style={{color: 'var(--danger)'}}>{getQConfig().TARGET_WORDS.join(' & ')} ★</span>
                 </div>
               </div>

               <div className="aa-progress-bar-container">
                 <div className="aa-progress-bar-label"><span>Progress</span><span>{progressPct}%</span></div>
                 <div className="aa-progress-bar"><div className="aa-progress-bar-fill" style={{ width: `${progressPct}%` }}></div></div>
               </div>


               <div className="aa-image-area">
                 <div className="aa-image-row">
                   {CONFIG.IMAGES.map(img => (
                     <div key={img.id} id={`game-item-${img.id}`} className="aa-image-item" onClick={() => onGameImageClick(img.id)}>
                        <img src={`${CONFIG.IMAGE_PATH}/${img.normal}`} alt={img.name} className="aa-selectable-image" />
                        <span className="aa-image-label">{img.name}</span>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="aa-score-panel">
                 <div className="aa-score-item"><div className="aa-score-value correct">{levelScores.correct}</div><div className="aa-score-label">Correct</div></div>
                 <div className="aa-score-item"><div className="aa-score-value eoc">{levelScores.eoc}</div><div className="aa-score-label">EOC</div></div>
                 <div className="aa-score-item"><div className="aa-score-value eoi">{levelScores.eoi}</div><div className="aa-score-label">EOI</div></div>
                 <div className="aa-score-item"><div className="aa-score-value eoo">{levelScores.eoo}</div><div className="aa-score-label">EOO</div></div>
               </div>

               <div className="aa-nav-panel">
                 {renderNavButtons()}
               </div>
            </div>
          )}

          {/* FINAL SCORE & ASSESSMENT */}
          {screen === 'score' && (
            <div id="dashboard-container" className="aa-screen" style={{ overflowY: 'auto' }}>
               <div className="aa-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                   <h2 className="aa-title">{quitReason ? ('🏆 ' + t('game.assessmentTerminated')) : ('🏆 ' + t('game.assessmentComplete'))}</h2>
                   <p className="aa-subtitle">{quitReason ? `${t('game.reasonLabel')} ${quitReason}` : t('game.finalResults')}</p>
                 </div>
                 <div style={{ background: '#4f46e5', color: '#fff', padding: '6px 14px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem' }}>
                   {t('game.attemptLabel')}{attemptNo}
                 </div>
               </div>

               <div className="aa-card" style={{ background: 'white', padding: 24, borderRadius: 16, marginBottom: 20 }}>
                 <h3 className="nr-form-title" style={{ marginBottom: 16, textAlign: 'center' }}>Question-wise Summary</h3>
                 <div style={{ overflowX: 'auto' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                     <thead>
                       <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.85rem' }}>
                         <th style={{ padding: '10px', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}></th>
                         <th style={{ padding: '10px', borderBottom: '2px solid #e2e8f0', color: '#059669' }}>Correct Response</th>
                         <th style={{ padding: '10px', borderBottom: '2px solid #e2e8f0', color: '#d97706' }}>EOI</th>
                         <th style={{ padding: '10px', borderBottom: '2px solid #e2e8f0', color: '#dc2626' }}>EOO</th>
                         <th style={{ padding: '10px', borderBottom: '2px solid #e2e8f0', color: '#7c3aed' }}>EOC</th>
                         <th style={{ padding: '10px', borderBottom: '2px solid #e2e8f0', color: '#3b82f6' }}>Total Play Time</th>
                       </tr>
                     </thead>
                     <tbody>
                       {[1, 2, 3, 4].map((q, idx) => {
                         const qs = questionScores[q] || { correct: 0, eoi: 0, eoo: 0, eoc: 0 };
                         const qt = Math.round((questionTimes[q] || 0) / 1000);
                         return (
                           <tr key={q} style={{ borderBottom: idx===3?'none':'1px solid #f1f5f9' }}>
                             <td style={{ padding: '12px', fontWeight: 600, color: '#0f172a', textAlign: 'left' }}>Q{q}</td>
                             <td style={{ padding: '12px', fontWeight: 500 }}>{qs.correct || 0}</td>
                             <td style={{ padding: '12px', fontWeight: 500 }}>{qs.eoi || 0}</td>
                             <td style={{ padding: '12px', fontWeight: 500 }}>{qs.eoo || 0}</td>
                             <td style={{ padding: '12px', fontWeight: 500 }}>{qs.eoc || 0}</td>
                             <td style={{ padding: '12px', fontWeight: 500 }}>{qt}s</td>
                           </tr>
                         )
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>

               <div className="aa-card" style={{ background: 'white', padding: 24, borderRadius: 16, marginBottom: 20 }}>
                 <h3 className="nr-form-title" style={{ marginBottom: 16, textAlign: 'center' }}>Analytical Action Dashboard</h3>
                 <div style={{ overflowX: 'auto' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569' }}>
                          <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', width: '50px' }}>Q#</th>
                          <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', minWidth: '120px' }}>Requested Words</th>
                          <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', minWidth: '120px' }}>User Responses</th>
                          <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', minWidth: '120px' }}>Result Type</th>
                          <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', width: '80px' }}>Time</th>
                        </tr>
                      </thead>
                     <tbody>
                       {[1, 2, 3, 4].map(q => {
                         const qs = questionScores[q];
                         if (!qs || !qs.actionLog || qs.actionLog.length === 0) return null;
                         
                         return qs.actionLog.map((l, idx) => {
                           let clr = '#475569';
                           if (l.result === 'Correct Response') clr = '#059669';
                           else if (l.result === 'EOO') clr = '#dc2626';
                           else if (l.result === 'EOC') clr = '#7c3aed';
                           else if (l.result === 'EOI') clr = '#d97706';

                           // Only show Question number on the very first row of that question
                           const showQNum = idx === 0;

                           return (
                             <tr key={`log-${q}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                               <td style={{ padding: '10px 12px', fontWeight: showQNum ? 700 : 400, color: showQNum ? '#0f172a' : '#cbd5e1' }}>{showQNum ? q : ''}</td>
                               <td style={{ padding: '10px 12px', fontWeight: 600 }}>{l.requestedWord}</td>
                               <td style={{ padding: '10px 12px' }}>{l.response}</td>
                               <td style={{ padding: '10px 12px', color: clr, fontWeight: clr !== '#475569' ? 600 : 400 }}>{l.result}</td>
                               <td style={{ padding: '10px 12px', color: '#64748b' }}>{l.time}</td>
                             </tr>
                           );
                         });
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>

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
                 <div style={{ display: 'flex', gap: 16 }}>
                    <button onClick={() => handleRestartFresh()} className="aa-btn aa-btn-primary" style={{ padding: '12px 32px', borderRadius: 999, background: 'linear-gradient(135deg, #4f46e5, #3730a3)', border: 'none', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>↻ Retest</button>
                    <button onClick={() => navigate('/')} className="aa-btn" style={{ padding: '12px 32px', borderRadius: 999, background: '#e0e7ff', border: 'none', color: '#3730a3', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>🏠 Home</button>
                 </div>
               </SessionAssessmentForm>
            </div>
          )}

        </main>
      </div>

      {/* MODALS */}
      {showResumeModal && (
        <div className="nr-modal-overlay">
          <div className="nr-modal">
            <h2>{t('game.progressFound')}</h2>
            <p>{t('game.progressDesc')}</p>
            <div className="aa-btn-row">
              <button className="aa-btn aa-btn-secondary" onClick={handleRestartFresh}>{t('game.restartFresh')}</button>
              <button className="aa-btn aa-btn-primary" onClick={resumeSessionData}>{t('game.resumeGame')}</button>
            </div>
          </div>
        </div>
      )}

      {showQuitModal && (
        <div className="nr-modal-overlay">
          <div className="nr-modal">
            <h2>{t('game.pauseQuitTitle')}</h2>
            <p>{t('game.pauseDesc')}</p>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <textarea placeholder="E.g., Child is tired..." value={quitReason} onChange={e => setQuitReason(e.target.value)} style={{ width: '100%', padding: '12px 40px 12px 12px' }} />
              <button 
                onClick={() => toggleRecording('quitReason')} 
                style={{
                  position: 'absolute', right: 8, top: 12, border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 6,
                  background: isRecording && recordingTarget === 'quitReason' ? '#fee2e2' : 'transparent',
                  color: isRecording && recordingTarget === 'quitReason' ? '#ef4444' : 'inherit'
                }} 
                title="Use Mic"
              >
                🎙
              </button>
            </div>
            <div className="aa-btn-row">
              <button className="aa-btn aa-btn-secondary" onClick={() => {
                setShowQuitModal(false);
                if (isPaused) {
                  togglePause();
                }
              }}>{t('game.cancel')}</button>
              <button className="aa-btn" style={{ background: '#fef08a' }} onClick={() => handleQuitRequest('paused')}>{t('game.pauseSave')}</button>
              <button className="aa-btn" style={{ background: '#fee2e2', color: 'red' }} onClick={() => handleQuitRequest('quit')}>{t('game.quitEnd')}</button>
            </div>
          </div>
        </div>
      )}

      <audio 
        ref={audioRef} 
        src={undefined} // No audio on splash, other screens handle audio via playInstructionAudio
        onEnded={() => { setCanStartQ(true); setLandingAudioPlaying(false); }}
        onError={() => { setCanStartQ(true); setLandingAudioPlaying(false); }}
      />
      <div className={`aa-toast ${toast.show ? 'show':''} ${toast.type}`}>{toast.message}</div>
    </div>
  );
};

export default AuditoryAttentionGame;
