// ============================================================
// TriangleRachnaGame.jsx — Rachna
// React port of rachna.js integrated with Sangian backend.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage, STT_LANG_MAP } from '../contexts/LanguageContext';
import { useHeaderConfig } from '../contexts/HeaderConfigContext';
import { useTestAudio } from '../hooks/useTestAudio';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import { ShapeEl, SHAPE_SIZE_PX } from '../components/RachnaShapeEl';
import {
  QUESTIONS, QUESTION_ORDER, TIMER_LIMITS, SCORED_QUESTIONS, MAX_SCORE,
  TEXTURED_QS, SAMPLE_QS, TEACHING_QS, ORIGINAL_QS,
  getTargetImageName, getQuestionCounter, getQuestionTitle,
} from '../data/rachnaQuestions';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import './TriangleRachnaGame.css';

const GAME_NAME  = 'triangle_rachna';
const AUDIO_PATH = '/assets/audios/rachna';
const IMAGE_PATH = '/assets/images/rachna';
const SERVER_BASE = API_URL.replace(/\/api$/, '');

const formatTimerDisplay = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
};

// ─── Main Component ───────────────────────────────────────────
const TriangleRachnaGame = () => {
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
  const { showLogo, showGameIcon, showGameName, showChildId, showScore } = useHeaderConfig();
  const navigate = useNavigate();

  const [childData, setChildData]           = useState(null);
  const [activityData, setActivityData]     = useState({ lastPlayed: 'Never', attempts: 0 });
  const [screen, setScreen]                 = useState('loading');
  const [audioFinished, setAudioFinished]   = useState(false);
  const [isCheckingSession, setIsCheck]     = useState(true);

  const [currentKey, setCurrentKey]         = useState('sampleA');
  const [attemptNo, setAttemptNo]           = useState(1);
  const [workspaceItems, setWorkspaceItems] = useState([]);
  const [timeElapsed, setTimeElapsed]       = useState(0);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [qAnswers, setQAnswers] = useState({ q1: null, q2: null, q3: null });
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeState, setResumeState] = useState(null);
  // Admin-editable per-question overrides (shapes/target image) from the
  // Elements panel, keyed by question key. Empty object = every question
  // uses its hardcoded default, identical to before this existed.
  const [elementOverrides, setElementOverrides] = useState({});

  const [totalScore, setTotalScore]         = useState(0);
  const [questionScores, setQuestionScores] = useState({});
  const [questionTimes, setQuestionTimes]   = useState({});
  const [questionMoves, setQuestionMoves]   = useState({});
  const [questionDetails, setQuestionDetails] = useState({});

  const [showGrid, setShowGrid]             = useState(false);
  const [showQuitModal, setShowQuitModal]   = useState(false);
  const [quitReason, setQuitReason]         = useState('');
  const [pauses, setPauses]                 = useState([]);
  const [assessment, setAssessment]         = useState({ q1:'', q2:'', q3:'', q4:'', behaviors:[], notes:'' });
  const [assessmentSubmitting, setAssSub]   = useState(false);
  const [assessmentSubmitted, setAssDone]   = useState(false);
  const [isRecording, setIsRecording]               = useState(false);
  const [recordingTarget, setRecordingTarget]       = useState(null);
  const [fullImg, setFullImg]                       = useState(null);
  const [sessionElapsed, setSessionElapsed]         = useState(0);

  const sessionIdRef       = useRef(null);
  const sessionStartRef    = useRef(null);
  const sessionTimerRef    = useRef(null);
  const sessionElapsedRef  = useRef(0);
  const timerRef           = useRef(null);
  const audioSplashRef  = useRef(null);
  const workspaceRef    = useRef(null);
  const { getAudioUrl, ready: audioReady } = useTestAudio('triangle_rachna');
  const dragItemRef     = useRef(null); // { sourceItem }
  const itemDragRef     = useRef(null); // { id, startX, startY, origX, origY }
  const rotateRef       = useRef(null); // { id, centerX, centerY, startAngle, origRot }
  const pausesRef       = useRef([]);
  const timeElapsedRef  = useRef(0);
  const questionDetailsRef = useRef({});

  useEffect(() => { pausesRef.current = pauses; }, [pauses]);
  useEffect(() => { timeElapsedRef.current = timeElapsed; }, [timeElapsed]);
  useEffect(() => { questionDetailsRef.current = questionDetails; }, [questionDetails]);

  // ── Admin-editable question overrides (Elements panel) ─────────
  // Background fetch — deliberately does not gate the loading screen or any
  // other startup flow. If it hasn't resolved yet by the time a question
  // renders, that question just uses its hardcoded default (same as if this
  // feature didn't exist), so there's no new failure mode on slow networks.
  useEffect(() => {
    axios.get(`${API_URL}/public/elements`, { params: { test_id: GAME_NAME } })
      .then(res => {
        const map = {};
        (res.data.elements || []).forEach(el => {
          if (el.asset_type !== 'splash_screen') map[el.asset_type] = el;
        });
        setElementOverrides(map);
      })
      .catch(() => {}); // silent — falls back to defaults
  }, []);

  const getQuestionSources = (key) => elementOverrides[key]?.config?.sources || QUESTIONS[key].sources;
  const getTargetImageSrc = (key) => elementOverrides[key]?.file_path
    ? `${SERVER_BASE}${elementOverrides[key].file_path}`
    : `${IMAGE_PATH}/${getTargetImageName(key)}.png`;
  const isQuestionActive = (key) => elementOverrides[key]?.config?.active !== false;
  // Walks the (unchanged) next-pointer chain forward from fromKey, skipping
  // any admin-deactivated question, until it lands on an active one or the
  // chain runs out. Question order/timers/scoring themselves never move —
  // this only redirects which key gets shown next.
  const nextActiveKey = (fromKey) => {
    let k = fromKey;
    while (k && !isQuestionActive(k)) k = QUESTIONS[k]?.next ?? null;
    return k;
  };

  const toggleRecording = (target) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert(t('common.speechNotSupported')); return; }

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

    recognition.onresult = (e) => {
      let finalTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
      }
      if (finalTranscript) {
         if (target === 'quitReason') setQuitReason(prev => prev + finalTranscript);
         else if (target === 'assessmentNotes') setAssessment(prev => ({ ...prev, notes: prev.notes + finalTranscript }));
      }
    };

    recognition.onend = () => { setIsRecording(false); setRecordingTarget(null); };
    recognition.onerror = (e) => { console.error("Speech recognition error", e); setIsRecording(false); setRecordingTarget(null); };

    window.activeRecognition = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingTarget(target);
  };

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

  // ── Auth & Resume ──────────────────────────────────────────────
  useEffect(() => {
    document.title = 'Rachna';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAssessmentModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const raw = localStorage.getItem('currentChild');
    if (!raw) { navigate('/login'); return; }
    const cd = JSON.parse(raw);
    setChildData(cd);
    setIsCheck(false);
    fetchActivity(cd.child_id);

    axios.get(`${API_URL}/games/sessions/resume/${cd.child_id}/${GAME_NAME}`)
      .then(res => {
        if (res.data.success && res.data.sessionInfo) {
          sessionIdRef.current = res.data.sessionInfo.id;
          setAttemptNo(res.data.sessionInfo.attempt_no || 1);
          setResumeState(res.data.sessionInfo);
          setShowResumeModal(true);
          setScreen('splash');
        } else {
          setScreen('splash');
        }
      }).catch(e => {
        console.error(e);
        setScreen('splash');
      });

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const fetchActivity = async (cid) => {
    try {
      const res = await axios.get(`${API_URL}/games/sessions/summaries/${cid}`);
      if (res.data.success) {
        const summary = res.data.summaries.find(s => s.game_name === 'triangle_rachna');
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

  // ── Splash audio autoplay ──────────────────────────────────────
  useEffect(() => {
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && audioSplashRef.current && !audioFinished && audioReady) {
      audioSplashRef.current.currentTime = 0;
      audioSplashRef.current.play().catch(() => setAudioFinished(true));
    }
  }, [isCheckingSession, screen, showResumeModal, audioFinished, audioReady]);

  // ── Timer Reset ──────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'game') {
      setTimeElapsed(0);
    }
  }, [currentKey, screen]);

  // ── Timer Interval ───────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game' || showQuitModal || showAssessmentModal) { 
      clearInterval(timerRef.current); 
      return; 
    }
    
    const limit = TIMER_LIMITS[currentKey] || 0;
    clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeElapsed(t => {
        const next = t + 1;
        if (limit > 0 && next >= limit) {
          clearInterval(timerRef.current);
          setTimeout(() => handleDone(true), 0);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [screen, currentKey, showQuitModal, showAssessmentModal]); // eslint-disable-line

  // ── Workspace cleanup on question change ──────────────────────
  useEffect(() => {
    if (screen === 'game') setWorkspaceItems([]);
  }, [currentKey, screen]);

  // ── Global mouse/touch handlers for item drag & rotation ──────
  useEffect(() => {
    const onPointerMove = (e) => {
      if (itemDragRef.current) {
        const { id, startX, startY, origX, origY } = itemDragRef.current;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        setWorkspaceItems(prev => {
          const item = prev.find(it => it.id === id);
          if (!item || !workspaceRef.current) return prev;
          const sz = SHAPE_SIZE_PX[item.size] || 100;
          const rect = workspaceRef.current.getBoundingClientRect();
          let newX = origX + dx;
          let newY = origY + dy;
          // Boundary clamping
          newX = Math.max(0, Math.min(newX, rect.width - sz));
          newY = Math.max(0, Math.min(newY, rect.height - sz));
          return prev.map(it => it.id === id ? { ...it, x: newX, y: newY } : it);
        });
      }
      if (rotateRef.current) {
        const { id, centerX, centerY } = rotateRef.current;
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
        
        let deltaAngle = angle - rotateRef.current.lastAngle;
        if (deltaAngle > 180) deltaAngle -= 360;
        if (deltaAngle < -180) deltaAngle += 360;
        
        rotateRef.current.currentRot += deltaAngle;
        rotateRef.current.lastAngle = angle;
        
        let targetRot = rotateRef.current.currentRot;
        const snapThreshold = 12;
        const nearestSnap = Math.round(targetRot / 45) * 45;
        let isSnapping = false;
        
        if (Math.abs(targetRot - nearestSnap) <= snapThreshold) {
          targetRot = nearestSnap;
          if (rotateRef.current.lastSnapped !== nearestSnap) {
            try { new Audio(`${AUDIO_PATH}/rotate.wav`).play().catch(() => {}); } catch(_) {}
            rotateRef.current.lastSnapped = nearestSnap;
          }
          isSnapping = true;
        } else {
          rotateRef.current.lastSnapped = null;
        }

        setWorkspaceItems(prev => prev.map(it =>
          it.id === id ? { ...it, rotation: targetRot, isSnapping } : it));
      }
    };
    const onPointerUp = () => { 
      itemDragRef.current = null; 
      if (rotateRef.current) {
        const rotId = rotateRef.current.id;
        setWorkspaceItems(prev => prev.map(it => it.id === rotId ? { ...it, isSnapping: false } : it));
      }
      rotateRef.current = null; 
    };
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    return () => { 
      document.removeEventListener('pointermove', onPointerMove); 
      document.removeEventListener('pointerup', onPointerUp); 
      document.removeEventListener('pointercancel', onPointerUp); 
    };
  }, []);

  // ── API: Start session ────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!childData) return;
    try {
      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childData.child_id, game_name: GAME_NAME, total_questions: SCORED_QUESTIONS.length,
      });
      sessionIdRef.current = res.data.sessionId;
      setAttemptNo(res.data.attempt_no || 1);
      // Start session-level screentime timer
      sessionStartRef.current = Date.now();
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        sessionElapsedRef.current = elapsed;
        setSessionElapsed(elapsed);
      }, 1000);
    } catch (e) { console.error(e); }
  }, [childData]);

  // ── API: Save progress ────────────────────────────────────────
  const saveProgress = useCallback((scores, times, totalSc, status = 'in_progress') => {
    if (!sessionIdRef.current) return;
    const allScores = Object.entries(scores).map(([k, sc]) => ({
      qId: k, category: k, score: sc, timeTaken: times[k] || 0,
    }));
    const screentime = sessionElapsedRef.current || 0;
    axios.put(`${API_URL}/games/sessions/update/${sessionIdRef.current}`, {
      score: totalSc, progress_level: Object.keys(scores).length,
      status, saved_state: { allScores, totalScore: totalSc, screentime, pauses: pausesRef.current, questionDetails: questionDetailsRef.current },
    }).catch(e => console.error(e));
  }, []);

  // ── Handle Done / Next ────────────────────────────────────────
  const proceedToNext = useCallback((manualScore) => {
    const q = QUESTIONS[currentKey];
    const elapsed = timeElapsedRef.current;

    let newScores = questionScores, newTimes = questionTimes, newTotal = totalScore;
    if (manualScore !== null) {
      newScores = { ...questionScores, [currentKey]: manualScore };
      newTimes  = { ...questionTimes,  [currentKey]: elapsed };
      newTotal  = Object.values(newScores).reduce((a, b) => a + b, 0);
      setQuestionScores(newScores);
      setQuestionTimes(newTimes);
      setTotalScore(newTotal);
    }

    let nextKey = q.next;
    // Distinguishes a milestone drop-test ending the session early from a
    // natural finish (question27's next is also null) — both used to be
    // saved as status:'completed' indistinguishably. Matches the status
    // split already used elsewhere for an equivalent clinical stop rule
    // (HerPherGameV2.jsx/HerPherGameV3.jsx's completeGame(autoStopped),
    // AtlantisBagiyaGame.jsx, ChaloMelaChaleGame.jsx, ChorMachayeShorGame.jsx,
    // NumberSkillGameV2.jsx).
    let droppedByRule = false;

    // Milestone 1: At Question 8 (Internal Q7 = question10)
    // Check cumulative score of Q1-Q7 (question3 through question10)
    if (currentKey === 'question10') {
      const q1_q7 = ['question3','question4','question6','question7','question8','question9','question10'];
      const sum1 = q1_q7.reduce((acc, k) => acc + (newScores[k] || 0), 0);
      if (sum1 <= 3) { nextKey = null; droppedByRule = true; } // Drop test
    }

    // Milestone 2: At Question 13 (Internal Q12 = question15)
    // Check cumulative score of Q1-Q12
    if (currentKey === 'question15') {
      const q1_q12 = ['question3','question4','question6','question7','question8','question9','question10',
                      'question11','question12','question13','question14','question15'];
      const sum2 = q1_q12.reduce((acc, k) => acc + (newScores[k] || 0), 0);
      if (sum2 <= 6) { nextKey = null; droppedByRule = true; } // Drop test
    }

    // Skip any admin-deactivated question(s) — after the milestone checks
    // above, which take priority: a drop-test null must stay null, never
    // get "resolved" into some later active question.
    if (nextKey) nextKey = nextActiveKey(nextKey);

    if (!nextKey) {
      saveProgress(newScores, newTimes, newTotal, droppedByRule ? 'dropped' : 'completed');
      setShowAssessmentModal(false);
      setScreen('score');
    } else {
      saveProgress(newScores, newTimes, newTotal, 'in_progress');
      setCurrentKey(nextKey);
      setShowAssessmentModal(false);
      setQAnswers({ q1: null, q2: null, q3: null });
    }
  }, [currentKey, questionScores, questionTimes, totalScore, saveProgress, elementOverrides]);

  const handleDone = useCallback((autoSubmit = false) => {
    clearInterval(timerRef.current);
    if (SCORED_QUESTIONS.includes(currentKey)) {
      setShowAssessmentModal(true);
    } else {
      proceedToNext(null);
    }
  }, [currentKey, proceedToNext]);

  // ── Handle Retake (sample questions) ─────────────────────────
  const handleRetake = () => {
    clearInterval(timerRef.current);
    setWorkspaceItems([]);
  };

  // ── Drag from source → workspace ─────────────────────────────
  const onSourceDragStart = (e, src) => {
    dragItemRef.current = src;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', src.id);
  };

  const onWorkspaceDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (workspaceRef.current) workspaceRef.current.classList.add('drag-over');
  };

  const onWorkspaceDragLeave = () => {
    if (workspaceRef.current) workspaceRef.current.classList.remove('drag-over');
  };

  const onWorkspaceDrop = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (workspaceRef.current) workspaceRef.current.classList.remove('drag-over');
    const src = dragItemRef.current;
    if (!src) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    const sz = SHAPE_SIZE_PX[src.size] || 100;
    let x = e.clientX - rect.left - sz / 2;
    let y = e.clientY - rect.top  - sz / 2;
    // Boundary clamping
    x = Math.max(0, Math.min(x, rect.width - sz));
    y = Math.max(0, Math.min(y, rect.height - sz));
    addToWorkspace(src, x, y);
    dragItemRef.current = null;
  };

  const addToWorkspace = (src, x, y) => {
    setWorkspaceItems(prev => [...prev, {
      id: Date.now() + Math.random(), sourceId: src.id,
      name: src.name, shape: src.shape, color: src.color,
      size: src.size, orientation: src.orientation || 'BL',
      scale: src.scale || 1,
      x, y, rotation: 0,
    }]);
    setQuestionMoves(p => ({ ...p, [currentKey]: (p[currentKey] || 0) + 1 }));
  };

  const removeFromWorkspace = (id) => {
    setWorkspaceItems(prev => prev.filter(it => it.id !== id));
    setQuestionMoves(p => ({ ...p, [currentKey]: (p[currentKey] || 0) + 1 }));
  };

  // ── Start dragging a workspace item ──────────────────────────
  const onItemPointerDown = (e, item) => {
    if (e.target.classList.contains('rg-remove-btn') ||
        e.target.classList.contains('rg-rotation-handle')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    itemDragRef.current = { id: item.id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y };
    // Bring to front: move this item to the end of the array so it renders
    // on top (highest index = highest z-index) during and after drag.
    setWorkspaceItems(prev => {
      const others = prev.filter(it => it.id !== item.id);
      const current = prev.find(it => it.id === item.id);
      return current ? [...others, current] : prev;
    });
  };

  // ── Start rotating a workspace item ──────────────────────────
  const onRotHandlePointerDown = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.closest('.rg-workspace-item').getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top  + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    rotateRef.current = { 
      id: item.id, 
      centerX, 
      centerY, 
      lastAngle: startAngle, 
      currentRot: item.rotation || 0,
      lastSnapped: null 
    };
  };

  // ── Double-click: rotate 90° snap ────────────────────────────
  const onItemDblClick = (e, item) => {
    if (e.target.classList.contains('rg-remove-btn') ||
        e.target.classList.contains('rg-rotation-handle')) return;
    setWorkspaceItems(prev => prev.map(it =>
      it.id === item.id ? { ...it, rotation: it.rotation + 90 } : it));
    setQuestionMoves(p => ({ ...p, [currentKey]: (p[currentKey] || 0) + 1 }));
    try { new Audio(`${AUDIO_PATH}/rotate.wav`).play().catch(() => {}); } catch(_) {}
  };

  // ── Touch: source → workspace ─────────────────────────────────
  const touchCloneRef = useRef(null);
  const touchSrcRef   = useRef(null);

  const onSourceTouchStart = (e, src) => {
    e.preventDefault();
    dragItemRef.current = src;
    touchSrcRef.current = e.currentTarget;
    const clone = e.currentTarget.cloneNode(true);
    clone.className = 'rg-touch-clone';
    const t = e.touches[0];
    clone.style.left = (t.clientX - 40) + 'px';
    clone.style.top  = (t.clientY - 40) + 'px';
    document.body.appendChild(clone);
    touchCloneRef.current = clone;
  };

  const onSourceTouchMove = (e) => {
    if (!touchCloneRef.current) return;
    e.preventDefault();
    const t = e.touches[0];
    touchCloneRef.current.style.left = (t.clientX - 40) + 'px';
    touchCloneRef.current.style.top  = (t.clientY - 40) + 'px';
    const ws = workspaceRef.current;
    if (ws) {
      const r = ws.getBoundingClientRect();
      ws.classList.toggle('drag-over',
        t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom);
    }
  };

  const onSourceTouchEnd = (e) => {
    if (touchCloneRef.current) { touchCloneRef.current.remove(); touchCloneRef.current = null; }
    const ws = workspaceRef.current;
    if (ws) ws.classList.remove('drag-over');
    const src = dragItemRef.current;
    if (!src || !ws) { dragItemRef.current = null; return; }
    const t = e.changedTouches[0];
    const r = ws.getBoundingClientRect();
    if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) {
      const sz = SHAPE_SIZE_PX[src.size] || 100;
      addToWorkspace(src, t.clientX - r.left - sz / 2, t.clientY - r.top - sz / 2);
    }
    dragItemRef.current = null;
  };

  // ── Quit / Pause / Resume ─────────────────────────────────────
  const restartFresh = () => {
    setShowResumeModal(false);
    clearInterval(sessionTimerRef.current);
    setSessionElapsed(0);
    sessionElapsedRef.current = 0;
    sessionStartRef.current = null;
    sessionIdRef.current = null;
    pausesRef.current = [];
    setPauses([]);
    setQuestionScores({});
    setQuestionTimes({});
    setTotalScore(0);
    setAudioFinished(false);
    setQuestionDetails({});
    questionDetailsRef.current = {};
    setQuestionMoves({});
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
    setQuitReason('');
    setAssDone(false);
    setScreen('splash');
  };

  const resumeGame = () => {
    const s = resumeState;
    if (!s || !s.saved_state) return restartFresh();
    const st = s.saved_state;
    
    const scDict = {};
    const tDict = {};
    (st.allScores || []).forEach(item => {
      scDict[item.qId] = item.score;
      tDict[item.qId] = item.timeTaken || 0;
    });

    setQuestionScores(scDict);
    setQuestionTimes(tDict);
    setTotalScore(st.totalScore || 0);

    const loadedPauses = st.pauses || [];
    setPauses(loadedPauses);
    pausesRef.current = loadedPauses;

    const loadedDetails = st.questionDetails || {};
    setQuestionDetails(loadedDetails);
    questionDetailsRef.current = loadedDetails;

    // Estimate questionMoves based on details
    const loadedMoves = {};
    Object.keys(loadedDetails).forEach(k => { loadedMoves[k] = loadedDetails[k].moves || 0; });
    setQuestionMoves(loadedMoves);

    let nextUnanswered = SCORED_QUESTIONS[0];
    for (let i = 0; i < SCORED_QUESTIONS.length; i++) {
        const k = SCORED_QUESTIONS[i];
        if (scDict[k] === undefined && isQuestionActive(k)) {
            nextUnanswered = k;
            break;
        }
    }
    
    if (Object.keys(scDict).length === SCORED_QUESTIONS.length) {
        setScreen('score');
    } else {
        setCurrentKey(nextUnanswered);
        setScreen('game');
    }
    setShowResumeModal(false);
  };

  const submitQuit = (statusType = 'paused') => {
    const p = [...pausesRef.current, { questionKey: currentKey, reason: quitReason }];
    setPauses(p);
    pausesRef.current = p; // Apply exact state before saving
    saveProgress(questionScores, questionTimes, totalScore, statusType);
    setShowQuitModal(false);
    setQuitReason('');
    
    if (statusType === 'quit') {
      setScreen('score');
      // Wait for score screen to render then upload PDF
      setTimeout(() => {
        generateAndUploadPDF();
      }, 1000);
    } else {
      navigate('/');
    }
  };

  // ── Assessment submit ─────────────────────────────────────────
  const submitAssessment = async () => {
    if (!sessionIdRef.current || !childData) return;
    setAssSub(true);
    try {
      await axios.post(`${API_URL}/games/assessments`, {
        session_id: sessionIdRef.current,
        child_id: childData.child_id,
        q1_enjoyment: assessment.q1, q2_feeling: assessment.q2,
        q3_tiredness: assessment.q3, q4_play_again: assessment.q4,
        q5_behaviors: assessment.behaviors,
        additional_notes: assessment.notes,
      });
      setAssDone(true);
      // Freeze screentime on submission — ref holds the exact displayed value
      clearInterval(sessionTimerRef.current);
      sessionElapsedRef.current = sessionElapsed;
      saveProgress(questionScores, questionTimes, totalScore, 'completed');

      // Wait for DOM to render then capture
      setTimeout(() => {
        generateAndUploadPDF();
      }, 1000);
      
      alert(t('game.assessmentSubmitted'));
    } catch (e) { console.error(e); alert(e?.response?.data?.message || t('common.failedToSave')); } finally { setAssSub(false); }
  };

  const generateAndUploadPDF = async () => {
    let wrapper = null;
    try {
      const element = document.getElementById('dashboard-capture-area');
      if (!element) return;

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Clone into a clean wrapper on document.body — .rg-app has
      // backdrop-filter plus height:100dvh, so capturing the live element in
      // place clips it to the viewport instead of its full content size.
      // Also neutralize any scrollable inner region — html2canvas paints
      // scrollable content as currently scrolled, so it stays clipped even
      // once the outer container is unconstrained.
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

      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const pdfBlob = pdf.output('blob');

      const formData = new FormData();
      const childNameSafe = (childData?.name || childData?.child_id || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
      const ts = new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14);
      formData.append('pdf', pdfBlob, `${childNameSafe}_Triangle_SES${sessionIdRef.current}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', sessionIdRef.current);
      formData.append('game_name', 'triangle_rachna');

      await axios.post(`${API_URL}/games/pdfs/upload`, formData);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    } finally {
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
  };

  // ──────────────────────── RENDER ────────────────────────────

  const timerCls = () => {
    const limit = TIMER_LIMITS[currentKey] || 0;
    if (!limit) return 'no-limit';
    const rem = limit - timeElapsed;
    if (rem <= 10) return 'danger';
    if (rem <= 30) return 'warning';
    return '';
  };

  const getSP = (age) => {
    if (age >= 3 && age <= 6) return '5-1';
    if (age >= 7 && age <= 12) return '5-4';
    return '—';
  };

  // ── Splash ────────────────────────────────────────────────────
  const renderSplash = () => (
    <div className="rg-screen rg-screen-splash">
      <div className="rg-splash-cover">
        <img src={`${IMAGE_PATH}/rachna.jpg`} alt="Rachna" className="rg-splash-img-full" onError={e => { e.target.style.display = 'none'; }} />
        <div className="rg-splash-btn-overlay">
          <button
            className={`rg-btn rg-btn-primary ${audioFinished ? 'rg-btn-highlight' : ''}`}
            style={{ opacity: !audioFinished ? 0.55 : 1, cursor: !audioFinished ? 'not-allowed' : 'pointer' }}
            disabled={!audioFinished}
            onClick={() => { startSession(); setScreen('game'); setCurrentKey(nextActiveKey('sampleA') || 'sampleA'); }}
          >
            {`▶ ${t('game.startNow')}`}
          </button>
          <button
            className="rg-btn rg-btn-secondary"
            onClick={() => {
              if (audioSplashRef.current) {
                setAudioFinished(false);
                audioSplashRef.current.currentTime = 0;
                audioSplashRef.current.play().catch(() => setAudioFinished(true));
              }
            }}
          >
            {t('game.replayAudio')}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Game ──────────────────────────────────────────────────────
  const renderGame = () => {
    const q = QUESTIONS[currentKey];
    if (!q) return null;
    const sources = getQuestionSources(currentKey);
    const isRotatable = (src) => ['triangle-up','triangle-down','right-triangle','diamond'].includes(src.shape);
    const limit = TIMER_LIMITS[currentKey] || 0;

    return (
      <div className="rg-screen">
        {/* Header */}
        <div className="rg-screen-header">
          <div className="rg-header-left">
            {/* Title moved to topbar */}
          </div>
          <div className="rg-header-right">
            <div className="rg-chips">


              {limit !== 0 && (
                <div className="rg-timer blue-timer">
                  <span className="timer-icon">⏱</span> {t('game.timer')}:
                  <span className={`rg-timer-val ${timerCls()}`}>
                    {formatTimerDisplay(timeElapsed)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main row: Target + Workspace */}
        <div className="rg-game-main-row">
          <div className="rg-panel rg-target-panel">
            <div className="rg-panel-content">
              <img
                src={getTargetImageSrc(currentKey)}
                alt="Target"
                className="rg-target-image"
                onError={e => { e.target.style.display='none'; }}
              />
            </div>
          </div>

          <div className="rg-panel rg-workspace-panel">
            <div className="rg-panel-content" style={{ padding: 0, alignItems: 'stretch' }}>
              <div
                ref={workspaceRef}
                className="rg-workspace"
                onDragOver={onWorkspaceDragOver}
                onDragLeave={onWorkspaceDragLeave}
                onDrop={onWorkspaceDrop}
              >
                {workspaceItems.map((item, index) => {
                  const sz = SHAPE_SIZE_PX[item.size] || 100;
                  const rotatable = isRotatable(item);
                  return (
                    <div
                      key={item.id}
                      className={`rg-workspace-item ${item.isSnapping ? 'rg-snap-highlight' : ''}`}
                      style={{ left: item.x, top: item.y, width: sz, height: sz, zIndex: 5 + index }}
                      onPointerDown={e => onItemPointerDown(e, item)}
                      onDoubleClick={e => rotatable && onItemDblClick(e, item)}
                    >
                      <div className="rg-shape-wrapper" style={{ transform: `rotate(${item.rotation}deg) scale(${item.scale || 1})` }}>
                        <ShapeEl shape={item.shape} color={item.color} size={item.size} orientation={item.orientation} workspace textured={TEXTURED_QS.has(currentKey)} />
                      </div>
                      <button className="rg-remove-btn" onClick={() => removeFromWorkspace(item.id)}>×</button>
                      {rotatable && (
                        <div className="rg-rotation-handle" onPointerDown={e => onRotHandlePointerDown(e, item)}>↻</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Controls row: Source shapes + Buttons */}
        <div className="rg-game-controls-row">
          <div className="rg-source-panel">
            <div className="rg-source-items">
              {sources.map((src, i) => {
                const isUsed = workspaceItems.some(w => w.sourceId === src.id);
                return (
                <div
                  key={src.id + i}
                  className={`rg-source-item ${isUsed ? 'used' : ''}`}
                  draggable={!isUsed}
                  onDragStart={e => onSourceDragStart(e, src)}
                  onDragEnd={e => { e.preventDefault(); dragItemRef.current = null; }}
                  onTouchStart={e => onSourceTouchStart(e, src)}
                  onTouchMove={onSourceTouchMove}
                  onTouchEnd={onSourceTouchEnd}
                >
                  <div style={{ transform: `scale(${src.scale || 1})`, display: 'inline-flex' }}>
                    <ShapeEl shape={src.shape} color={src.color} size={src.size} orientation={src.orientation} workspace={false} textured={TEXTURED_QS.has(currentKey)} />
                  </div>
                </div>
              )})}
            </div>
          </div>

          <div className="rg-btn-panel">
            <button
              className="rg-btn rg-btn-primary"
              onClick={handleDone}
            >↻ Done</button>
            {q.type === 'sample' && (
              <button className="rg-btn rg-btn-secondary" onClick={handleRetake}>↺ Retake</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Score Screen ──────────────────────────────────────────────
  const renderScore = () => {
    const TOTAL_Q = SCORED_QUESTIONS.length;
    const MAX_SCORE = TOTAL_Q * 2; // 24 × 2 = 48
    const scoredEntries = Object.entries(questionScores);
    const totalAttempted = scoredEntries.length;
    const totalCorrect  = scoredEntries.filter(([k, sc]) => sc === 2).length;
    const totalPartial  = scoredEntries.filter(([k, sc]) => sc === 1).length;
    const totalIncorrect = scoredEntries.filter(([k, sc]) => sc === 0).length;
    const pct = Math.round((totalScore / MAX_SCORE) * 100) || 0;
    
    const totalTime = Object.values(questionTimes).reduce((a, b) => a + b, 0);
    const avgTime = totalAttempted ? Math.round(totalTime / totalAttempted) : 0;

    const BEHAVIORS = [
      'Difficulty sustaining attention', 'Impulsive or random responding', 'Negative reaction to correction',
      'Hesitation in responding', 'High focus or persistence', 'Verbalisation of a memory strategy',
      'Needed frequent reassurance', 'Calm and engaged throughout'
    ];

    return (
      <div className="rg-screen" id="dashboard-capture-area">
        <div className="rg-screen-header">
          <div>
            <div className="rg-screen-title">{quitReason ? t('game.assessmentTerminated') : t('game.assessmentComplete')}</div>
            <div className="rg-screen-subtitle">{quitReason ? `${t('game.reasonLabel')} ${quitReason}` : t('game.finalResults')}</div>
          </div>
          <div className="rg-chips">
            <span className="rg-chip" style={{ background: '#4f46e5', color: '#fff' }}>{t('game.attemptLabel')}{attemptNo}</span>
            <span className="rg-chip">Screentime: {Math.floor(sessionElapsed/60)}m {sessionElapsed%60}s</span>
          </div>
        </div>

        <div style={{ padding: '16px 12px' }}>
          {/* KPI Row — Bagiya-style */}
          <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-start', marginBottom:24 }}>
            {/* Score dial — rounded square */}
            <div style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              background:'linear-gradient(135deg, #4f46e5, #818cf8)',
              borderRadius:16, padding:'20px 28px', color:'white', minWidth:130
            }}>
              <div style={{ fontSize:'2.8rem', fontWeight:900, lineHeight:1 }}>{totalScore}</div>
              <div style={{ fontSize:'0.82rem', opacity:0.85, marginTop:4 }}>/ {MAX_SCORE} pts</div>
            </div>

            {/* Metric boxes */}
            <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:10 }}>
              {[
                { label: '✓ Correct (2pts)',   val: totalCorrect,   cls: '#16a34a', sub: null },
                { label: '~ Partial (1pt)',    val: totalPartial,   cls: '#0f172a', sub: null },
                { label: '✕ Incorrect (0pts)', val: totalIncorrect, cls: '#dc2626', sub: null },
                { label: '% Accuracy',         val: `${pct}%`,      cls: '#d97706', sub: `${totalScore} / ${MAX_SCORE}`, info: true },
                { label: 'Duration',           val: `${Math.floor(totalTime/60)}m ${totalTime%60}s`, cls: '#0f172a', sub: null },
                { label: 'Questions',          val: `${totalAttempted} / ${TOTAL_Q}`, cls: '#0f172a', sub: null },
              ].map((m, i) => (
                <div key={i} style={{ background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 14px' }}>
                  <div style={{ fontSize:'0.74rem', color:'#6b7280', marginBottom:4, display:'flex', alignItems:'center', gap:2 }}>
                    {m.label}
                    {m.info && <span className="kpi-formula-icon" data-tooltip="Total Score ÷ Max Score (48) × 100">ⓘ</span>}
                  </div>
                  <div style={{ fontSize:'1.1rem', fontWeight:700, color: m.cls }}>{m.val}</div>
                  {m.sub && <div style={{ fontSize:'0.7rem', color:'#94a3b8', fontWeight:500, marginTop:2 }}>{m.sub}</div>}
                </div>
              ))}
            </div>
          </div>


          {/* Per-question detail */}
          {/* Per-question detail breakdown */}
          <div className="rg-breakdown-grid">
            {scoredEntries.map(([key, sc]) => {
              const t = questionTimes[key] || 0;
              const details = questionDetails[key] || {};
              const wsItems = details.workspaceItems || [];
              const qa = details.qAnswers || {};
              const moves = details.moves || 0;

              // Calculate bounding box for perfectly centered rendering
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              if (wsItems.length > 0) {
                wsItems.forEach(item => {
                  const sz = SHAPE_SIZE_PX[item.size] || 100;
                  minX = Math.min(minX, item.x);
                  minY = Math.min(minY, item.y);
                  maxX = Math.max(maxX, item.x + sz);
                  maxY = Math.max(maxY, item.y + sz);
                });
              } else {
                minX = 0; minY = 0; maxX = 200; maxY = 200;
              }
              
              const padding = 30;
              minX -= padding; minY -= padding; maxX += padding; maxY += padding;
              const contentWidth = maxX - minX;
              const contentHeight = maxY - minY;
              
              // Reduce scale to make the frame more compact
              const scale = Math.min(180 / contentWidth, 140 / contentHeight, 0.55);

              return (
                <div className="rg-breakdown-card" key={key}>
                  <div className="rg-breakdown-header">
                    <span className="rg-breakdown-title">{getQuestionTitle(key)}</span>
                    <div className="rg-breakdown-metrics">
                      <span className="rg-bd-metric" style={{
                        background: sc===2?'#dcfce7': sc===1?'#fef9c3':'#fee2e2',
                        color: sc===2?'#15803d': sc===1?'#92400e':'#b91c1c',
                        padding:'2px 10px', borderRadius:999, fontWeight:700, fontSize:'0.78rem'
                      }}>
                        {sc===2?'Correct': sc===1?'Partial':'Incorrect'}
                      </span>
                      <span className="rg-bd-metric"><strong>Score:</strong> <span style={{color: sc===2?'#059669': sc===1?'#d97706':'#e11d48'}}>{sc}</span></span>
                      <span className="rg-bd-metric"><strong>Duration:</strong> {formatTimerDisplay(t)}</span>
                    </div>
                  </div>

                  <div className="rg-breakdown-body">
                    {/* Target Column */}
                    <div className="rg-bd-col">
                      <div className="rg-bd-col-title" style={{visibility:'hidden', height:0, overflow:'hidden'}}></div>
                      <div className="rg-bd-img-container">
                        <img src={getTargetImageSrc(key)} alt="Target" className="rg-bd-target-img" style={{ cursor: 'zoom-in' }} onError={e => e.target.style.display='none'} onClick={() => setFullImg(getTargetImageSrc(key))} />
                      </div>
                    </div>

                    {/* User Generated Column */}
                    <div className="rg-bd-col">
                      <div className="rg-bd-col-title" style={{visibility:'hidden', height:0, overflow:'hidden'}}></div>
                      <div className="rg-bd-mini-ws">
                        {wsItems.length === 0 ? (
                          <span style={{color: '#94a3b8', fontSize: '0.85rem'}}>No attempt recorded</span>
                        ) : (
                          <div className="rg-mini-ws-inner" style={{ 
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: contentWidth * scale, 
                            height: contentHeight * scale, 
                            transform: `translate(-50%, -50%)` 
                          }}>
                            {wsItems.map((item, idx) => {
                              const origSz = SHAPE_SIZE_PX[item.size] || 100;
                              const sz = origSz * scale;
                              return (
                                <div key={idx} style={{ 
                                  position: 'absolute', 
                                  left: (item.x - minX) * scale, 
                                  top: (item.y - minY) * scale, 
                                  width: sz, 
                                  height: sz, 
                                  zIndex: 5 + idx, 
                                  pointerEvents: 'none' 
                                }}>
                                  <div style={{ transform: `rotate(${item.rotation}deg) scale(${item.scale || 1})`, width: '100%', height: '100%' }}>
                                    <ShapeEl
                                      shape={item.shape}
                                      color={item.color}
                                      size={item.size}
                                      orientation={item.orientation}
                                      workspace
                                      customSize={sz}
                                      textured={TEXTURED_QS.has(currentKey)}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Assessor Column */}
                    <div className="rg-bd-col rg-bd-criteria-col">
                      <div className="rg-bd-col-title" style={{visibility:'hidden', height:0, overflow:'hidden'}}></div>
                      <div className="rg-bd-criteria">
                        <div className="rg-bd-crit-item">
                          <span className="rg-crit-text">1. Gap {'>'} 2 squares</span>
                          <span className={`rg-crit-ans ${qa.q1 === 'yes' ? 'bad' : qa.q1 === 'no' ? 'good' : ''}`}>
                            {qa.q1 ? qa.q1.toUpperCase() : 'N/A'}
                          </span>
                        </div>
                        <div className="rg-bd-crit-item">
                          <span className="rg-crit-text">2. Align {'>'} 2 squares</span>
                          <span className={`rg-crit-ans ${qa.q2 === 'yes' ? 'bad' : qa.q2 === 'no' ? 'good' : ''}`}>
                            {qa.q2 ? qa.q2.toUpperCase() : 'N/A'}
                          </span>
                        </div>
                        <div className="rg-bd-crit-item">
                          <span className="rg-crit-text">3. Matches target</span>
                          <span className={`rg-crit-ans ${qa.q3 === 'yes' ? 'good' : qa.q3 === 'no' ? 'bad' : ''}`}>
                            {qa.q3 ? qa.q3.toUpperCase() : 'N/A'}
                          </span>
                        </div>
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
              <button className="rg-btn rg-btn-primary"
                onClick={() => { setScreen('splash'); setCurrentKey('sampleA'); setTotalScore(0); setQuestionScores({}); setQuestionTimes({}); setAssDone(false); setAssSub(false); setAssessment({q1:'',q2:'',q3:'',q4:'',behaviors:[],notes:''}); sessionIdRef.current=null; }}
              >{t('game.retest')}</button>
              <button className="rg-btn rg-btn-secondary" onClick={() => navigate('/')}>{t('game.home')}</button>
            </>
          </SessionAssessmentForm>
        </div>
      </div>
    );
  };

  // ── Quit modal ────────────────────────────────────────────────
  const renderQuitModal = () => (
    <div className="rg-modal-overlay">
      <div className="rg-modal">
        <h2>{t('game.pauseQuitTitle')}</h2>
        <p>Why are you stopping the game?</p>
        <div style={{ position: 'relative' }}>
          <textarea value={quitReason} onChange={e => setQuitReason(e.target.value)}
            {...{placeholder: t('game.pausePlaceholder')}} style={{ width: '100%' }} />
          <button 
            onClick={() => toggleRecording('quitReason')} 
            style={{
              position: 'absolute', top: '10px', right: '10px',
              background: isRecording && recordingTarget === 'quitReason' ? '#ef4444' : '#e2e8f0',
              color: isRecording && recordingTarget === 'quitReason' ? 'white' : '#475569',
              border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}
            title={isRecording ? 'Stop Recording' : 'Start Dictation'}
          >
            🎙
          </button>
        </div>
        <div className="rg-modal-btns" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
          <button className="rg-btn rg-btn-secondary" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', borderRadius:'999px'}} onClick={() => setShowQuitModal(false)}>Cancel</button>
          <button className="rg-btn" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', background:'#fef08a', color:'#854d0e', border:'none', borderRadius:'999px', cursor:'pointer'}} onClick={() => submitQuit('paused')}>{t('game.pauseSave')}</button>
          <button className="rg-btn rg-btn-danger" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', borderRadius:'999px'}} onClick={() => submitQuit('quit')}>{t('game.quitEnd')}</button>
        </div>
      </div>
    </div>
  );

  // ── Resume modal ──────────────────────────────────────────────
  const renderResumeModal = () => (
    <div className="rg-modal-overlay">
      <div className="rg-modal">
        <h2>{t('game.progressFound')}</h2>
        <p>{t('game.progressDesc')}</p>
        <div className="rg-modal-btns" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
          <button className="rg-btn" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', color:'#4b5563', background:'#f3f4f6', border:'none', borderRadius:'999px', cursor:'pointer'}} onClick={restartFresh}>{t('game.restartFresh')}</button>
          <button className="rg-btn rg-btn-primary" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', borderRadius:'999px'}} onClick={resumeGame}>{t('game.resumeGame')}</button>
        </div>
      </div>
    </div>
  );

  // ── Assessment Modal ──────────────────────────────────────────
  const submitQuestionModal = () => {
    let finalScore = 0;
    if (qAnswers.q1 === 'yes' || qAnswers.q2 === 'yes') {
      finalScore = 0;
    } else if (qAnswers.q3 === 'yes') {
      finalScore = 2;
    } else if (qAnswers.q3 === 'no') {
      finalScore = 1;
    }
    
    // Save details before proceeding
    const details = {
      workspaceItems: [...workspaceItems],
      qAnswers: { ...qAnswers },
      moves: questionMoves[currentKey] || 0
    };
    setQuestionDetails(prev => ({ ...prev, [currentKey]: details }));
    questionDetailsRef.current = { ...questionDetailsRef.current, [currentKey]: details };

    proceedToNext(finalScore);
  };

  const renderAssessmentModal = () => {
    const canSubmit = qAnswers.q1 !== null && qAnswers.q2 !== null && qAnswers.q3 !== null;
    return (
      <div className="rg-modal-overlay">
        <div className="rg-assessment-dialog">
          <div className="rg-ad-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 className="rg-ad-title">{t('game.assessmentTitle')}</h2>
              </div>
              <button className="rg-ad-close-btn" onClick={() => setShowAssessmentModal(false)}>✕</button>
            </div>
          </div>
          <div className="rg-ad-body">
            {/* Criteria 1 */}
            <div className={`rg-ad-card ${qAnswers.q1 ? 'answered' : ''}`}>
              <div className="rg-ad-question">
                <div>1. {t('game.triangleCriteria.q1')}</div>
              </div>
              <div className="rg-ad-actions">
                <button className={`rg-ad-btn ${qAnswers.q1==='yes'?'selected bad':''}`} onClick={()=>setQAnswers(p=>({...p,q1:'yes'}))}>{t('game.yesLabel')}</button>
                <button className={`rg-ad-btn ${qAnswers.q1==='no'?'selected good':''}`} onClick={()=>setQAnswers(p=>({...p,q1:'no'}))}>{t('game.noLabel')}</button>
              </div>
            </div>
            {/* Criteria 2 */}
            <div className={`rg-ad-card ${qAnswers.q2 ? 'answered' : ''}`}>
              <div className="rg-ad-question">
                <div>2. {t('game.triangleCriteria.q2')}</div>
              </div>
              <div className="rg-ad-actions">
                <button className={`rg-ad-btn ${qAnswers.q2==='yes'?'selected bad':''}`} onClick={()=>setQAnswers(p=>({...p,q2:'yes'}))}>{t('game.yesLabel')}</button>
                <button className={`rg-ad-btn ${qAnswers.q2==='no'?'selected good':''}`} onClick={()=>setQAnswers(p=>({...p,q2:'no'}))}>{t('game.noLabel')}</button>
              </div>
            </div>
            {/* Criteria 3 */}
            <div className={`rg-ad-card ${qAnswers.q3 ? 'answered' : ''}`}>
              <div className="rg-ad-question">
                <div>3. {t('game.triangleCriteria.q3')}</div>
              </div>
              <div className="rg-ad-actions">
                <button className={`rg-ad-btn ${qAnswers.q3==='yes'?'selected good':''}`} onClick={()=>setQAnswers(p=>({...p,q3:'yes'}))}>{t('game.yesLabel')}</button>
                <button className={`rg-ad-btn ${qAnswers.q3==='no'?'selected bad orange':''}`} onClick={()=>setQAnswers(p=>({...p,q3:'no'}))}>{t('game.noLabel')}</button>
              </div>
            </div>
          </div>
          <div className="rg-ad-footer">
            <button className={`rg-ad-submit-btn ${canSubmit ? 'active' : ''}`} disabled={!canSubmit} onClick={submitQuestionModal}>
              {t('game.finishAssessment')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────
  if (screen === 'loading') return <div className="rg-root"><div className="rg-loading">{t('common.loading')}</div></div>;

  return (
    <div className="rg-root">
      <div className={`rg-app${screen === 'splash' ? ' rg-app-splash' : ''}`}>
        {/* Topbar */}
        <header className="rg-topbar" style={{ position: 'relative' }}>
          <div className="rg-brand">
            {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="rg-brand-img" />}
            {showLogo && (showGameIcon || showGameName) && <div className="rg-divider"></div>}
            {showGameIcon && <img src="/assets/images/rachna/rachna.jpg" alt="Rachna" className="rg-test-logo" />}
            {showGameName && <span className="rg-test-title">{t('home.games.rachna.title')}</span>}
          </div>

          {screen === 'game' && currentKey && (
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontWeight: '800', fontSize: '1.5rem', color: '#1e293b' }}>
              {getQuestionTitle(currentKey)}
            </div>
          )}

          <div className="rg-stats">
            {showChildId && childData?.child_id && (
              <div className="rg-stat-pill">
                <span className="rg-stat-icon">👤</span>
                <span className="rg-stat-value">{childData.child_id}</span>
              </div>
            )}
            {showScore && (
            <div className="rg-stat-pill">
              <span className="rg-stat-icon">🏆</span>
              <span className="rg-stat-value">{totalScore}</span>
            </div>
            )}
            {screen === 'game' && (
              <button className="btn-pause-quit" onClick={() => { setQuitReason(''); setShowQuitModal(true); }}>
                <span>⏸</span> Pause/Quit
              </button>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className={`rg-main${screen === 'splash' ? ' rg-main-splash' : ''}`}>
          {screen === 'splash' && renderSplash()}
          {screen === 'game'   && renderGame()}
          {screen === 'score'  && renderScore()}
        </main>
      </div>

      {/* ── Splash Audio ── */}
      {!isCheckingSession && (
        <audio
          ref={audioSplashRef}
          src={getAudioUrl('splash', `${AUDIO_PATH}/splash.wav`)}
          preload="auto"
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {showQuitModal && renderQuitModal()}
      {showAssessmentModal && renderAssessmentModal()}
      {showResumeModal && renderResumeModal()}
      {fullImg && (
        <div className="q-img-fullscreen-overlay" onClick={() => setFullImg(null)}>
          <img src={fullImg} alt="Full view" />
        </div>
      )}
    </div>
  );
};

export default TriangleRachnaGame;
