import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import './AtlantisBagiyaGame.css';

// ─── Constants ───────────────────────────────────────────
const GAME_NAME = 'atlantis_bagiya';
const TOTAL_MAX_SUB_QUESTIONS = 53; // 1+2+2+3+3+4+5+4+5+7+6+11

const IMG = '/assets/images/bagiya';
const AUD = '/assets/audios/bagiya';

// ─── Item Catalogue ───────────────────────────────────────
const ITEMS = [
  { id: 1,  stem: 'bird_ba',         name: 'BA',        category: 'bird',   img: `${IMG}/bird_ba.png`,         audio: `${AUD}/bird_ba.wav`,         khaHai: `${AUD}/bird_ba_kha_hai.wav` },
  { id: 2,  stem: 'bird_2',          name: 'Bird 2',    category: 'bird',   img: `${IMG}/bird_2.png`,          audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 3,  stem: 'bird_deem',       name: 'DEEM',      category: 'bird',   img: `${IMG}/bird_deem.png`,       audio: `${AUD}/bird_deem.wav`,       khaHai: `${AUD}/bird_deem_kha_hai.wav` },
  { id: 4,  stem: 'bird_4',          name: 'Bird 4',    category: 'bird',   img: `${IMG}/bird_4.png`,          audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 5,  stem: 'bird_5',          name: 'Bird 5',    category: 'bird',   img: `${IMG}/bird_5.png`,          audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 6,  stem: 'bird_jul',        name: 'JUL',       category: 'bird',   img: `${IMG}/bird_jul.png`,        audio: `${AUD}/bird_jul.wav`,        khaHai: `${AUD}/bird_jul_kha_hai.wav` },
  { id: 7,  stem: 'bird_hoop',       name: 'HOOP',      category: 'bird',   img: `${IMG}/bird_hoop.png`,       audio: `${AUD}/bird_hoop.wav`,       khaHai: `${AUD}/bird_hoop_kha_hai.wav` },
  { id: 8,  stem: 'insect_ghesa',    name: 'GHESA',     category: 'insect', img: `${IMG}/insect_ghesa.png`,    audio: `${AUD}/insect_ghesa.wav`,    khaHai: `${AUD}/insect_ghesa_kha_hai.wav` },
  { id: 9,  stem: 'insect_mogju',    name: 'MOGJU',     category: 'insect', img: `${IMG}/insect_mogju.png`,    audio: `${AUD}/insect_mogju.wav`,    khaHai: `${AUD}/insect_mogju_kha_hai.wav` },
  { id: 10, stem: 'insect_baigul',   name: 'BAIGUL',    category: 'insect', img: `${IMG}/insect_baigul.png`,   audio: `${AUD}/insect_baigul.wav`,   khaHai: `${AUD}/insect_baigul_kha_hai.wav` },
  { id: 11, stem: 'insect_4',        name: 'Insect 4',  category: 'insect', img: `${IMG}/insect_4.png`,        audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 12, stem: 'insect_thooli',   name: 'THOOLI',    category: 'insect', img: `${IMG}/insect_thooli.png`,   audio: `${AUD}/insect_thooli.wav`,   khaHai: `${AUD}/insect_thooli_kha_hai.wav` },
  { id: 13, stem: 'flower_shibagu',  name: 'SHIBAGU',   category: 'flower', img: `${IMG}/flower_shibagu.png`,  audio: `${AUD}/flower_shibagu.wav`,  khaHai: `${AUD}/flower_shibagu_kha_hai.wav` },
  { id: 14, stem: 'flower_mulpaki',  name: 'MULPAKI',   category: 'flower', img: `${IMG}/flower_mulpaki.png`,  audio: `${AUD}/flower_mulpaki.wav`,  khaHai: `${AUD}/flower_mulpaki_kha_hai.wav` },
  { id: 15, stem: 'flower_dhulkoma', name: 'DHULKOMA',  category: 'flower', img: `${IMG}/flower_dhulkoma.png`, audio: `${AUD}/flower_dhulkoma.wav`, khaHai: `${AUD}/flower_dhulkoma_kha_hai.wav` },
  { id: 16, stem: 'flower_4',        name: 'Flower 4',  category: 'flower', img: `${IMG}/flower_4.png`,        audio: null,                         khaHai: `${AUD}/no_name_kha_hai.wav` },
  { id: 17, stem: 'flower_pegeto',   name: 'PEGETO',    category: 'flower', img: `${IMG}/flower_pegeto.png`,   audio: `${AUD}/flower_pegeto.wav`,   khaHai: `${AUD}/flower_pegeto_kha_hai.wav` },
];

const itemByStem = Object.fromEntries(ITEMS.map(i => [i.stem, i]));

// ─── Main-game Screen Configurations ─────────────────────
// Each screen: introduce one creature (question), then ask about multiple (response).
// subQStems: order in which the examiner asks "Where is X?"
// fixedResponseStems: hard-coded grid; requiredStems + responseCount: randomly generated.
// checkpoint: after this response screen, if totalScore <= threshold, stop game.
const SCREEN_CONFIGS = [
  {
    num: 1,
    questionStem: 'bird_ba',
    fixedResponseStems: ['bird_ba','bird_2','bird_deem','bird_4','bird_5','insect_thooli','flower_pegeto'],
    subQStems: ['bird_ba'],
    checkpoint: null,
  },
  {
    num: 2,
    questionStem: 'bird_jul',
    fixedResponseStems: ['bird_ba','bird_2','bird_4','bird_5','bird_jul','insect_baigul','flower_shibagu'],
    subQStems: ['bird_jul','bird_ba'],
    checkpoint: null,
  },
  {
    num: 3,
    questionStem: 'bird_deem',
    fixedResponseStems: ['bird_ba','bird_2','bird_deem','bird_4','bird_jul','insect_baigul','flower_mulpaki'],
    subQStems: ['bird_jul','bird_deem'],
    checkpoint: null,
  },
  {
    num: 4,
    questionStem: 'bird_hoop',
    requiredStems: ['bird_deem','bird_hoop','bird_ba'],
    responseCount: 8,
    subQStems: ['bird_deem','bird_hoop','bird_ba'],
    checkpoint: null,
  },
  {
    num: 5,
    questionStem: 'insect_ghesa',
    requiredStems: ['bird_jul','insect_ghesa','bird_hoop'],
    responseCount: 9,
    subQStems: ['bird_jul','insect_ghesa','bird_hoop'],
    checkpoint: { threshold: 15 },
  },
  {
    num: 6,
    questionStem: 'insect_thooli',
    requiredStems: ['bird_deem','insect_ghesa','insect_thooli','bird_ba'],
    responseCount: 9,
    subQStems: ['bird_deem','insect_ghesa','insect_thooli','bird_ba'],
    checkpoint: null,
  },
  {
    num: 7,
    questionStem: 'insect_baigul',
    requiredStems: ['bird_ba','insect_thooli','bird_jul','insect_baigul','bird_hoop'],
    responseCount: 10,
    subQStems: ['bird_ba','insect_thooli','bird_jul','insect_baigul','bird_hoop'],
    checkpoint: { threshold: 24 },
  },
  {
    num: 8,
    questionStem: 'insect_mogju',
    requiredStems: ['bird_hoop','insect_mogju','bird_ba','insect_baigul'],
    responseCount: 9,
    subQStems: ['bird_hoop','insect_mogju','bird_ba','insect_baigul'],
    checkpoint: null,
  },
  {
    num: 9,
    questionStem: 'flower_shibagu',
    requiredStems: ['bird_deem','insect_ghesa','flower_shibagu','bird_hoop','insect_mogju'],
    responseCount: 12,
    subQStems: ['bird_deem','insect_ghesa','flower_shibagu','bird_hoop','insect_mogju'],
    checkpoint: { threshold: 38 },
  },
  {
    num: 10,
    questionStem: 'flower_mulpaki',
    requiredStems: ['bird_ba','insect_thooli','flower_shibagu','bird_jul','insect_ghesa','flower_mulpaki','bird_4'],
    responseCount: 11,
    subQStems: ['bird_ba','insect_thooli','flower_shibagu','bird_jul','insect_ghesa','flower_mulpaki','bird_4'],
    checkpoint: null,
  },
  {
    num: 11,
    questionStem: 'bird_5',
    requiredStems: ['bird_deem','flower_pegeto','bird_jul','flower_mulpaki','insect_baigul','bird_5'],
    responseCount: 11,
    subQStems: ['bird_deem','flower_pegeto','bird_jul','flower_mulpaki','insect_baigul','bird_5'],
    checkpoint: { threshold: 63 },
  },
  {
    num: 12,
    questionStem: 'flower_dhulkoma',
    requiredStems: ['insect_thooli','flower_pegeto','bird_ba','flower_dhulkoma','insect_mogju','bird_2','insect_ghesa','insect_baigul','bird_hoop','flower_shibagu','flower_4'],
    responseCount: 12,
    subQStems: ['insect_thooli','flower_pegeto','bird_ba','flower_dhulkoma','insect_mogju','bird_2','insect_ghesa','insect_baigul','bird_hoop','flower_shibagu','flower_4'],
    checkpoint: null,
  },
];

// ─── Practice pool (items with named audio) ───────────────
const PRACTICE_POOL = ITEMS.filter(i => i.audio !== null);

// ─── Helpers ──────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildResponseSet(cfg) {
  if (cfg.fixedResponseStems) {
    return cfg.fixedResponseStems.map(s => itemByStem[s]).filter(Boolean);
  }
  const required = cfg.requiredStems.map(s => itemByStem[s]).filter(Boolean);
  const reqIds = new Set(required.map(i => i.id));
  const fillers = shuffle(ITEMS.filter(i => !reqIds.has(i.id))).slice(0, cfg.responseCount - required.length);
  return shuffle([...required, ...fillers]);
}

function generateAllResponseSets() {
  const sets = {};
  SCREEN_CONFIGS.forEach(cfg => { sets[cfg.num] = buildResponseSet(cfg); });
  return sets;
}

function scoreAnswer(chosenItem, targetItem) {
  if (!chosenItem) return 0;
  if (chosenItem.id === targetItem.id) return 2;
  if (chosenItem.category === targetItem.category) return 1;
  return 0;
}

const formatTime = (sec) => {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// ─── Main Component ───────────────────────────────────────
const AtlantisBagiyaGame = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Core session state ──────────────────────────────────
  const [childData, setChildData] = useState(null);
  const [activityData, setActivityData] = useState({ lastPlayed: 'Never', attempts: 0 });
  const [screen, setScreen] = useState('splash'); // splash|practice_q|practice_r|game|score
  const [gameSessionId, setGameSessionId] = useState(null);
  const [allScores, setAllScores] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [qTimer, setQTimer] = useState(0);
  const [pauses, setPauses] = useState([]);

  // ── Main game state ─────────────────────────────────────
  const [mainScreenNum, setMainScreenNum] = useState(1);
  const [mainPhase, setMainPhase] = useState('question'); // question|response
  const [subQIndex, setSubQIndex] = useState(0);         // which subQ is active (0-based)
  const [subQAnswered, setSubQAnswered] = useState({});   // {subQIndex: true}
  const [responseSets, setResponseSets] = useState({});
  const [gridFeedback, setGridFeedback] = useState({});  // {itemId: 'correct'|'wrong'}
  const [subQAudioDone, setSubQAudioDone] = useState(false);
  const [questionAudioDone, setQuestionAudioDone] = useState(false);
  const [feedbackAudioPlaying, setFeedbackAudioPlaying] = useState(false);

  // ── Practice state ──────────────────────────────────────
  const [practiceItem, setPracticeItem] = useState(null);
  const [practiceFeedback, setPracticeFeedback] = useState({});
  const [practiceAnswered, setPracticeAnswered] = useState(false);
  const [practiceAudioDone, setPracticeAudioDone] = useState(false);
  const [practiceResponseAudioDone, setPracticeResponseAudioDone] = useState(false);
  const [practiceResponseSet, setPracticeResponseSet] = useState([]);

  // ── Modal state ─────────────────────────────────────────
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeData, setResumeData] = useState(null);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [quitReason, setQuitReason] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [audioFinished, setAudioFinished] = useState(false);

  // ── Assessment form ─────────────────────────────────────
  const [assessment, setAssessment] = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  // ── STT ─────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);

  // ── Refs (race-condition safe) ──────────────────────────
  const allScoresRef = useRef([]);
  const gameSessionIdRef = useRef(null);
  const timerSecondsRef = useRef(0);
  const pausesRef = useRef([]);
  const mainScreenNumRef = useRef(1);
  const subQIndexRef = useRef(0);
  const qTimerRef = useRef(0);
  const subQAnsweredRef = useRef({});

  const timerRef = useRef(null);
  const splashAudioRef = useRef(null);
  const activeAudioRef = useRef(null);

  // ── Computed ────────────────────────────────────────────
  const totalScore = allScores.reduce((s, a) => s + a.score, 0);
  const currentConfig = SCREEN_CONFIGS.find(c => c.num === mainScreenNum);

  // ── Sync refs ───────────────────────────────────────────
  useEffect(() => { allScoresRef.current = allScores; }, [allScores]);
  useEffect(() => { gameSessionIdRef.current = gameSessionId; }, [gameSessionId]);
  useEffect(() => { timerSecondsRef.current = timerSeconds; }, [timerSeconds]);
  useEffect(() => { pausesRef.current = pauses; }, [pauses]);
  useEffect(() => { mainScreenNumRef.current = mainScreenNum; }, [mainScreenNum]);
  useEffect(() => { subQIndexRef.current = subQIndex; }, [subQIndex]);
  useEffect(() => { qTimerRef.current = qTimer; }, [qTimer]);
  useEffect(() => { subQAnsweredRef.current = subQAnswered; }, [subQAnswered]);

  // ── Login check + resume check ──────────────────────────
  useEffect(() => {
    const dataStr = localStorage.getItem('currentChild');
    if (!dataStr) { navigate('/login', { state: { from: location } }); return; }
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

  const formatDate = (iso) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/am|pm/g, match => match.toUpperCase());
  };

  // ── Splash audio autoplay ───────────────────────────────
  useEffect(() => {
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && splashAudioRef.current && !audioFinished) {
      splashAudioRef.current.currentTime = 0;
      splashAudioRef.current.play().catch(() => setAudioFinished(true));
    }
  }, [isCheckingSession, screen, showResumeModal, audioFinished]);

  // ── Session timer (runs during game response phase) ─────
  useEffect(() => {
    if (screen === 'game' && !showQuitModal) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, showQuitModal]);

  // ── Question timer ──────────────────────────────────────
  useEffect(() => {
    if (screen === 'game' && mainPhase === 'response' && !showQuitModal) {
      const id = setInterval(() => setQTimer(p => p + 1), 1000);
      return () => clearInterval(id);
    }
  }, [screen, mainPhase, subQIndex, showQuitModal]);

  // ─── API ────────────────────────────────────────────────
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
        total_questions: TOTAL_MAX_SUB_QUESTIONS,
      });
      setGameSessionId(res.data.sessionId);
    } catch (e) {
      console.error('Failed to start session', e);
    }
    resetInternalState();
    const sets = generateAllResponseSets();
    setResponseSets(sets);
    pickPracticeItem();
    setScreen('practice_q');
  };

  const resumeGame = () => {
    const saved = resumeData.saved_state || {};
    setGameSessionId(resumeData.id);
    const scores = saved.allScores || [];
    setAllScores(scores); allScoresRef.current = scores;
    setTimerSeconds(saved.timerSeconds || 0);
    setQTimer(saved.qTimer || 0);
    setPauses(saved.pauses || []);
    setMainScreenNum(saved.mainScreenNum || 1);
    setMainPhase('question');
    setSubQIndex(0);
    setSubQAnswered({});
    setGridFeedback({});
    const sets = generateAllResponseSets();
    setResponseSets(sets);
    setShowResumeModal(false);
    setScreen('game');
  };

  const resetInternalState = () => {
    setAllScores([]); allScoresRef.current = [];
    setTimerSeconds(0); timerSecondsRef.current = 0;
    setQTimer(0); qTimerRef.current = 0;
    setPauses([]); pausesRef.current = [];
    setMainScreenNum(1); mainScreenNumRef.current = 1;
    setMainPhase('question');
    setSubQIndex(0); subQIndexRef.current = 0;
    setSubQAnswered({}); subQAnsweredRef.current = {};
    setGridFeedback({});
    setSubQAudioDone(false);
    setQuestionAudioDone(false);
    setFeedbackAudioPlaying(false);
    setAssessmentSubmitted(false);
  };

  const saveToServer = useCallback(async (status, reason) => {
    const sessId = gameSessionIdRef.current;
    if (!sessId) return;
    try {
      const scores = allScoresRef.current;
      let updatedPauses = [...pausesRef.current];
      if (reason && (status === 'paused' || status === 'quit')) {
        updatedPauses.push({ questionNumber: mainScreenNumRef.current, reason, timestamp: new Date().toISOString() });
        setPauses(updatedPauses);
      }
      await axios.put(`${API_URL}/games/sessions/update/${sessId}`, {
        score: scores.reduce((s, a) => s + a.score, 0),
        progress_level: mainScreenNumRef.current,
        status,
        quit_reason: reason || null,
        saved_state: {
          allScores: scores,
          timerSeconds: timerSecondsRef.current,
          qTimer: qTimerRef.current,
          pauses: updatedPauses,
          mainScreenNum: mainScreenNumRef.current,
        },
      });
    } catch (e) { console.error('Save error', e); }
  }, []);

  const completeGame = useCallback(() => {
    const scores = allScoresRef.current;
    const sessId = gameSessionIdRef.current;
    if (sessId) {
      axios.put(`${API_URL}/games/sessions/update/${sessId}`, {
        score: scores.reduce((s, a) => s + a.score, 0),
        progress_level: TOTAL_MAX_SUB_QUESTIONS,
        status: 'completed',
        saved_state: { allScores: scores, timerSeconds: timerSecondsRef.current, pauses: pausesRef.current, mainScreenNum: 12 },
      }).catch(e => console.error(e));
    }
    setScreen('score');
  }, []);

  // ─── Auto-play Main Game Audio ───────────────────────────
  useEffect(() => {
    if (screen === 'game' && mainPhase === 'question') {
      setQuestionAudioDone(false);
      const cfg = SCREEN_CONFIGS.find(c => c.num === mainScreenNumRef.current);
      if (cfg) {
        const qi = itemByStem[cfg.questionStem];
        if (qi?.audio) {
          const audio = new Audio(qi.audio);
          activeAudioRef.current = audio;
          audio.play().catch(() => setQuestionAudioDone(true));
          audio.addEventListener('ended', () => setQuestionAudioDone(true));
          audio.addEventListener('error', () => setQuestionAudioDone(true));
        } else {
          setQuestionAudioDone(true);
        }
      }
    }
  }, [screen, mainPhase, mainScreenNum]);

  useEffect(() => {
    if (screen === 'game' && mainPhase === 'response') {
      setSubQAudioDone(false);
      const cfg = SCREEN_CONFIGS.find(c => c.num === mainScreenNumRef.current);
      if (cfg && cfg.subQStems[subQIndex]) {
        const item = itemByStem[cfg.subQStems[subQIndex]];
        if (item?.khaHai) {
          const audio = new Audio(item.khaHai);
          activeAudioRef.current = audio;
          audio.play().catch(() => setSubQAudioDone(true));
          audio.addEventListener('ended', () => setSubQAudioDone(true));
          audio.addEventListener('error', () => setSubQAudioDone(true));
        } else {
          setSubQAudioDone(true);
        }
      }
    }
  }, [screen, mainPhase, mainScreenNum, subQIndex]);

  // ─── Practice helpers ────────────────────────────────────
  const pickPracticeItem = () => {
    const item = PRACTICE_POOL[Math.floor(Math.random() * PRACTICE_POOL.length)];
    setPracticeItem(item);
    setPracticeFeedback({});
    setPracticeAnswered(false);
    setPracticeAudioDone(false);
  };

  // Auto-play practice audio when practice_q screen loads
  useEffect(() => {
    if (screen === 'practice_q' && practiceItem?.audio) {
      setPracticeAudioDone(false);
      const audio = new Audio(practiceItem.audio);
      activeAudioRef.current = audio;
      audio.play().catch(() => setPracticeAudioDone(true));
      audio.addEventListener('ended', () => setPracticeAudioDone(true));
      audio.addEventListener('error', () => setPracticeAudioDone(true));
    }
  }, [screen, practiceItem]);

  // Auto-play kha_hai audio + build stable response set when practice_r loads
  useEffect(() => {
    if (screen === 'practice_r' && practiceItem) {
      setPracticeResponseAudioDone(false);
      setPracticeResponseSet(buildResponseSet({ requiredStems: [practiceItem.stem], responseCount: 7 }));
      if (practiceItem.khaHai) {
        const audio = new Audio(practiceItem.khaHai);
        activeAudioRef.current = audio;
        audio.play().catch(() => setPracticeResponseAudioDone(true));
        audio.addEventListener('ended', () => setPracticeResponseAudioDone(true));
        audio.addEventListener('error', () => setPracticeResponseAudioDone(true));
      } else {
        setPracticeResponseAudioDone(true);
      }
    }
  }, [screen, practiceItem]);

  const handlePracticeAnswer = (chosenItem) => {
    const isCorrect = chosenItem.id === practiceItem.id;
    setPracticeFeedback({ [chosenItem.id]: isCorrect ? 'correct' : 'wrong', [practiceItem.id]: 'correct' });
    setPracticeAnswered(true);
    if (isCorrect) playAudio(`${AUD}/bilkul_sahi.wav`);
  };

  // ─── Audio helpers ────────────────────────────────────────
  const playAudio = (src) => {
    if (!src) return;
    if (activeAudioRef.current) {
      try { 
        activeAudioRef.current.pause();
        // Force resolve any ongoing audio states since it was interrupted by selection
        setPracticeResponseAudioDone(true);
        setSubQAudioDone(true);
        setQuestionAudioDone(true);
        setPracticeAudioDone(true);
      } catch (_) {}
    }
    setFeedbackAudioPlaying(true);
    const audio = new Audio(src);
    activeAudioRef.current = audio;
    audio.play().catch(() => setFeedbackAudioPlaying(false));
    audio.addEventListener('ended', () => setFeedbackAudioPlaying(false));
    audio.addEventListener('error', () => setFeedbackAudioPlaying(false));
  };

  // ─── Main game answer handler ─────────────────────────────
  const handleMainAnswer = useCallback((chosenItem) => {
    const cfg = SCREEN_CONFIGS.find(c => c.num === mainScreenNumRef.current);
    if (!cfg) return;
    const sqIdx = subQIndexRef.current;

    const targetStem = cfg.subQStems[sqIdx];
    const target = itemByStem[targetStem];
    if (!target) return;

    const pts = scoreAnswer(chosenItem, target);

    // Visual feedback
    setGridFeedback(() => {
      const next = {};
      next[chosenItem.id] = pts === 2 ? 'correct' : 'wrong';
      if (pts !== 2) next[target.id] = 'correct';
      return next;
    });

    if (pts === 2) playAudio(`${AUD}/bilkul_sahi.wav`);

    // Record score
    const newEntry = {
      qId: `r${mainScreenNumRef.current}_q${sqIdx + 1}`,
      screen: mainScreenNumRef.current,
      subQ: sqIdx + 1,
      targetStem,
      targetName: target.name,
      chosenStem: chosenItem.stem,
      chosenName: chosenItem.name,
      score: pts,
      timeTaken: qTimerRef.current,
    };
    
    // Allow re-answering by removing old entry if it exists
    const updScores = allScoresRef.current.filter(s => s.qId !== newEntry.qId);
    updScores.push(newEntry);
    allScoresRef.current = updScores;
    setAllScores(updScores);

    // Mark sub-question answered
    const updAnswered = { ...subQAnsweredRef.current, [sqIdx]: true };
    subQAnsweredRef.current = updAnswered;
    setSubQAnswered(updAnswered);
  }, []);

  const advanceToNextScreen = useCallback(() => {
    const currentNum = mainScreenNumRef.current;
    const cfg = SCREEN_CONFIGS.find(c => c.num === currentNum);

    // Check checkpoint
    if (cfg?.checkpoint) {
      const pts = allScoresRef.current.reduce((s, a) => s + a.score, 0);
      if (pts <= cfg.checkpoint.threshold) {
        completeGame();
        return;
      }
    }

    const nextNum = currentNum + 1;
    if (nextNum > 12) {
      completeGame();
      return;
    }

    mainScreenNumRef.current = nextNum;
    setMainScreenNum(nextNum);
    setMainPhase('question');
    setSubQIndex(0); subQIndexRef.current = 0;
    setSubQAnswered({}); subQAnsweredRef.current = {};
    setGridFeedback({});
    setSubQAudioDone(false);
    setQuestionAudioDone(false);
    setFeedbackAudioPlaying(false);
    setQTimer(0); qTimerRef.current = 0;
    saveToServer('in_progress');
  }, [completeGame, saveToServer]);

  const handleQuit = async (status) => {
    if (!quitReason.trim()) { alert('Please enter a reason'); return; }
    await saveToServer(status, quitReason);
    if (status === 'quit') {
      setShowQuitModal(false);
      setScreen('score');
    } else {
      navigate('/');
    }
  };

  // ─── STT ─────────────────────────────────────────────────
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

  // ─── Assessment submit ────────────────────────────────────
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

  // ─── Score screen helpers ─────────────────────────────────
  const totalPts = allScores.reduce((s, a) => s + a.score, 0);
  const maxPts = allScores.length * 2;
  const correctCount = allScores.filter(s => s.score === 2).length;
  const partialCount = allScores.filter(s => s.score === 1).length;
  const wrongCount   = allScores.filter(s => s.score === 0).length;
  const accuracyPct  = allScores.length > 0 ? ((correctCount / allScores.length) * 100).toFixed(1) : '0.0';
  const totalTimeSec = timerSeconds;

  // ─── RENDER ──────────────────────────────────────────────
  return (
    <div className="ab-app">

      {/* ── Topbar ── */}
      <header className="ab-topbar">
        <div className="ab-brand">
          <img src="/cel_admin_logo.png" alt="CEL Logo" style={{ height: '36px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))' }} />
        </div>
        <div className="ab-stats">
          {childData?.child_id && (
            <div className="ab-stat-pill">
              <span className="ab-stat-label">CHILD ID</span>
              <span className="ab-stat-value">{childData.child_id}</span>
            </div>
          )}
          <div className="ab-stat-pill">
            <span className="ab-stat-label">SCORE</span>
            <span className="ab-stat-value">{totalScore}</span>
          </div>
          {screen === 'game' && (
            <button className="btn-pause-quit" onClick={() => setShowQuitModal(true)}>
              <span>⏸</span> Pause/Quit
            </button>
          )}
        </div>
      </header>

      <main className="ab-main">

        {/* ── SPLASH ── */}
        {!isCheckingSession && screen === 'splash' && !showResumeModal && (
          <div className="ab-screen">
            <div className="ab-screen-header">
              <div style={{ textAlign: 'center', width: '100%' }}>
                {/* Header text removed as requested */}
              </div>
            </div>

            <div className="ab-splash-centered">
              <div className="ab-splash-img-box">
                <img src={`${IMG}/bagiya.jpg`} alt="Atlantis Game" className="ab-splash-img-full"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
              <div className="ab-splash-title-center">Welcome to Atlantis Game</div>
              

              <div className="ab-btn-row" style={{ justifyContent: 'center', marginTop: 20 }}>
                <button
                  className={`ab-btn ab-btn-primary${!audioFinished ? ' ab-btn-disabled' : ' ab-btn-highlight'}`}
                  disabled={!audioFinished}
                  onClick={startNewGame}
                  style={{ minWidth: 160, padding: '13px 36px', fontSize: '1rem' }}
                >
                  Start Now
                </button>
                <button
                  className="ab-btn ab-btn-secondary"
                  style={{ minWidth: 150, padding: '13px 28px', fontSize: '1rem' }}
                  onClick={() => {
                    if (splashAudioRef.current) {
                      splashAudioRef.current.currentTime = 0;
                      splashAudioRef.current.play().catch(() => {});
                    }
                  }}
                >
                  Replay Audio
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PRACTICE QUESTION ── */}
        {screen === 'practice_q' && practiceItem && (
          <div className="ab-screen">
            <div className="ab-screen-header">
              <div>
                <div className="ab-screen-title">Practice · Question</div>
              </div>
              <div className="ab-chips">
                <span className="ab-chip">Practice</span>
                <span className="ab-chip">Not Scored</span>
              </div>
            </div>

            <div className="ab-splash-centered">
              <div className="ab-splash-img-box">
                <img src={practiceItem.img} alt={practiceItem.name} style={{ width: '100%', display: 'block' }} />
              </div>
              <div className="ab-btn-row" style={{ justifyContent: 'center', marginTop: 20 }}>
                <button
                  className="ab-btn ab-btn-secondary"
                  style={{ minWidth: 150, padding: '13px 28px', fontSize: '1rem' }}
                  onClick={() => {
                    setPracticeAudioDone(false);
                    const audio = new Audio(practiceItem.audio);
                    activeAudioRef.current = audio;
                    audio.play().catch(() => setPracticeAudioDone(true));
                    audio.addEventListener('ended', () => setPracticeAudioDone(true));
                    audio.addEventListener('error', () => setPracticeAudioDone(true));
                  }}
                >
                  Replay Audio
                </button>
                <button
                  className={`ab-btn ab-btn-primary${!practiceAudioDone ? ' ab-btn-disabled' : ''}`}
                  disabled={!practiceAudioDone}
                  style={{ minWidth: 160, padding: '13px 36px', fontSize: '1rem' }}
                  onClick={() => setScreen('practice_r')}
                >
                  Answer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PRACTICE RESPONSE ── */}
        {screen === 'practice_r' && practiceItem && (
          <div className="ab-screen">
            <div className="ab-screen-header">
              <div>
                <div className="ab-screen-title">Practice · Response</div>
              </div>
              <div className="ab-chips">
                <span className="ab-chip">Practice</span>
              </div>
            </div>

            <div className="ab-card">
              <div className="ab-btn-row" style={{ marginBottom: 16, marginTop: 0 }}>
                <button className="ab-btn ab-btn-secondary" onClick={() => {
                  setPracticeResponseAudioDone(false);
                  const audio = new Audio(practiceItem.khaHai);
                  activeAudioRef.current = audio;
                  audio.play().catch(() => setPracticeResponseAudioDone(true));
                  audio.addEventListener('ended', () => setPracticeResponseAudioDone(true));
                  audio.addEventListener('error', () => setPracticeResponseAudioDone(true));
                }}>
                  Replay Audio
                </button>
              </div>

              <div className="ab-grid ab-grid-large">
                {practiceResponseSet.map(item => (
                  <div
                    key={item.id}
                    className="ab-grid-item"
                    onClick={() => handlePracticeAnswer(item)}
                  >
                    <img src={item.img} alt={item.name} className="ab-grid-item-img-large" />
                  </div>
                ))}
              </div>

              <div className="ab-btn-row" style={{ marginTop: 20 }}>
                <button className="ab-btn ab-btn-secondary" onClick={() => { pickPracticeItem(); setScreen('practice_q'); }}>
                  Try Again
                </button>
                <button
                  className={`ab-btn ab-btn-primary${!(practiceResponseAudioDone && practiceAnswered && !feedbackAudioPlaying) ? ' ab-btn-disabled' : ''}`}
                  disabled={!(practiceResponseAudioDone && practiceAnswered && !feedbackAudioPlaying)}
                  onClick={() => {
                    const sets = generateAllResponseSets();
                    setResponseSets(sets);
                    setMainScreenNum(1); mainScreenNumRef.current = 1;
                    setMainPhase('question');
                    setSubQIndex(0); subQIndexRef.current = 0;
                    setSubQAnswered({}); subQAnsweredRef.current = {};
                    setGridFeedback({});
                    setScreen('game');
                  }}>
                  Start Main Game
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN GAME ── */}
        {screen === 'game' && currentConfig && (
          <div className="ab-screen">
            {/* Progress */}
            <div className="ab-progress-bar-wrap">
              <div className="ab-progress-bar-fill" style={{ width: `${((mainScreenNum - 1) / 12) * 100}%` }} />
            </div>

            {mainPhase === 'question' && (
              <>
                <div className="ab-screen-header">
                  <div>
                    <div className="ab-screen-title">Question {mainScreenNum} of 12</div>
                  </div>
                  <div className="ab-chips">
                    <span className="ab-chip">Question Screen {mainScreenNum}</span>
                    <span className="ab-chip">{itemByStem[currentConfig.questionStem]?.category}</span>
                  </div>
                </div>

                {(() => {
                  const qi = itemByStem[currentConfig.questionStem];
                  return (
                    <div className="ab-splash-centered">
                      <div className="ab-splash-img-box">
                        <img src={qi.img} alt={qi.name} style={{ width: '100%', display: 'block' }} />
                      </div>
                      <div className="ab-btn-row" style={{ justifyContent: 'center', marginTop: 20 }}>
                        <button className="ab-btn ab-btn-secondary" style={{ minWidth: 150, padding: '13px 28px', fontSize: '1rem' }}
                          onClick={() => {
                            if (qi?.audio) {
                              setQuestionAudioDone(false);
                              const audio = new Audio(qi.audio);
                              activeAudioRef.current = audio;
                              audio.play().catch(() => setQuestionAudioDone(true));
                              audio.addEventListener('ended', () => setQuestionAudioDone(true));
                              audio.addEventListener('error', () => setQuestionAudioDone(true));
                            }
                          }}>
                          Replay Audio
                        </button>
                        <button 
                          className={`ab-btn ab-btn-primary${!questionAudioDone ? ' ab-btn-disabled' : ''}`}
                          disabled={!questionAudioDone}
                          style={{ minWidth: 160, padding: '13px 36px', fontSize: '1rem' }}
                          onClick={() => {
                            setMainPhase('response');
                            setSubQIndex(0); subQIndexRef.current = 0;
                            setSubQAnswered({}); subQAnsweredRef.current = {};
                            setGridFeedback({});
                            setSubQAudioDone(false);
                            setQTimer(0); qTimerRef.current = 0;
                          }}>
                          Next Question
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {mainPhase === 'response' && (() => {
              const responseItems = responseSets[mainScreenNum] || [];
              const allSubQsDone = currentConfig.subQStems.every((_, i) => subQAnswered[i]);
              const activeTargetStem = currentConfig.subQStems[subQIndex];
              const activeTarget = itemByStem[activeTargetStem];

              return (
                <>
                  <div className="ab-screen-header">
                    <div>
                      <div className="ab-screen-title">Response {mainScreenNum}</div>
                      <div className="ab-screen-subtitle">
                        {allSubQsDone ? 'All questions answered!' : `Sub-question ${subQIndex + 1} of ${currentConfig.subQStems.length}`}
                      </div>
                    </div>
                    <div className="ab-chips">
                      <span className="ab-chip">Response Screen {mainScreenNum}</span>
                      <span className="ab-chip">⏱ {formatTime(qTimer)}</span>
                    </div>
                  </div>

                  <div className="ab-card">
                    <div className="ab-btn-row" style={{ marginBottom: 16, marginTop: 0, justifyContent: 'flex-start' }}>
                      <button className="ab-btn ab-btn-secondary" onClick={() => {
                        setSubQAudioDone(false);
                        const item = itemByStem[currentConfig.subQStems[subQIndex]];
                        if (item?.khaHai) {
                          const audio = new Audio(item.khaHai);
                          activeAudioRef.current = audio;
                          audio.play().catch(() => setSubQAudioDone(true));
                          audio.addEventListener('ended', () => setSubQAudioDone(true));
                          audio.addEventListener('error', () => setSubQAudioDone(true));
                        }
                      }}>
                        Replay Audio
                      </button>
                    </div>

                    {/* Response grid */}
                    <div className="ab-grid">
                      {responseItems.map(item => (
                        <div
                          key={item.id}
                          className="ab-grid-item"
                          onClick={() => handleMainAnswer(item)}
                        >
                          <img src={item.img} alt={item.name} className="ab-grid-item-img" />
                        </div>
                      ))}
                    </div>

                    {/* Next question button */}
                    <div className="ab-btn-row" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
                      <button 
                        className={`ab-btn ab-btn-primary${!(subQAudioDone && subQAnswered[subQIndex] && !feedbackAudioPlaying) ? ' ab-btn-disabled' : ''}`}
                        disabled={!(subQAudioDone && subQAnswered[subQIndex] && !feedbackAudioPlaying)}
                        onClick={() => {
                          if (subQIndex < currentConfig.subQStems.length - 1) {
                            const nextIdx = subQIndex + 1;
                            setSubQIndex(nextIdx);
                            subQIndexRef.current = nextIdx;
                            setGridFeedback({}); 
                            setQTimer(0); qTimerRef.current = 0;
                          } else {
                            advanceToNextScreen();
                          }
                        }}>
                        {subQIndex < currentConfig.subQStems.length - 1 ? 'Next Question →' : (mainScreenNum < 12 ? 'Next Screen →' : 'Finish Game')}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── SCORE ── */}
        {screen === 'score' && (
          <div className="ab-screen">
            <div className="ab-screen-header">
              <div>
                <div className="ab-screen-title">{quitReason ? 'Assessment Terminated' : 'Assessment Complete'}</div>
                <div className="ab-screen-subtitle">{quitReason ? `Reason: ${quitReason}` : 'Atlantis Game · Final Results'}</div>
              </div>
              <div className="ab-chips">
                <span className="ab-chip">Final Results</span>
                <span className="ab-chip">Time: {formatTime(totalTimeSec)}</span>
              </div>
            </div>

            <div className="ab-result-card">
              {/* Score summary */}
              <div className="ab-score-top">
                <div className="ab-score-dial">
                  <div className="ab-score-big">{totalPts}</div>
                  <div className="ab-score-label">/ {maxPts} pts</div>
                </div>
                <div className="ab-metric-grid">
                  {[
                    { label: '✓ Exact (2pts)', val: correctCount, cls: 'green' },
                    { label: '~ Partial (1pt)', val: partialCount, cls: '' },
                    { label: '✗ Wrong (0pts)', val: wrongCount, cls: 'red' },
                    { label: '% Accuracy', val: `${accuracyPct}%`, cls: '' },
                    { label: '⏱ Time', val: formatTime(totalTimeSec), cls: '' },
                    { label: 'Screens', val: `${SCREEN_CONFIGS.findIndex(c => c.num === mainScreenNum) + 1} / 12`, cls: '' },
                  ].map((m, i) => (
                    <div key={i} className="ab-metric-box">
                      <label>{m.label}</label>
                      <div className={`ab-metric-val ${m.cls}`}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {totalPts >= maxPts * 0.8 && maxPts > 0 && (
                <div className="ab-banner">Outstanding performance! Excellent visual memory! ⭐</div>
              )}

              {/* Per-question grid toggle */}
              <div className="ab-accordion-toggle" onClick={() => setShowGrid(!showGrid)}>
                {showGrid ? '▼' : '▶'} Show per-question results
              </div>

              {showGrid && (
                <div className="ab-q-table-wrap">
                  <table className="ab-q-table">
                    <thead>
                      <tr>
                        <th>Screen</th>
                        <th>Sub-Q</th>
                        <th>Target</th>
                        <th>Child Chose</th>
                        <th>Status</th>
                        <th>Score</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allScores.map((s, i) => (
                        <tr key={i}>
                          <td>S{s.screen}</td>
                          <td>Q{s.subQ}</td>
                          <td>
                            <img src={itemByStem[s.targetStem]?.img} alt={s.targetName} className="ab-q-img" />
                          </td>
                          <td>
                            <img src={itemByStem[s.chosenStem]?.img} alt={s.chosenName} className="ab-q-img" />
                          </td>
                          <td>
                            <span className="ab-badge">
                              {s.score === 2 ? 'Correct' : s.score === 1 ? 'Partial' : 'Wrong'}
                            </span>
                          </td>
                          <td>{s.score}</td>
                          <td>{s.timeTaken != null ? `${s.timeTaken}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Assessment Form */}
              <div className="ab-assessment-section">
                <h3 className="ab-form-title">Session Assessment Details</h3>
                {[
                  { key: 'q1', label: 'Q1. Did you enjoy playing the game?' },
                  { key: 'q2', label: 'Q2. How did the game feel for you?' },
                  { key: 'q3', label: 'Q3. Did you feel tired while playing the game?' },
                  { key: 'q4', label: 'Q4. Would you like to play the game again?' },
                ].map(q => (
                  <div key={q.key} className="ab-q-group">
                    <label className="ab-q-label">{q.label}</label>
                    <div className="ab-radio-row">
                      {['Yes, a lot', 'A little', 'Not much'].map(opt => (
                        <label key={opt} className="ab-radio-label">
                          <input type="radio" name={q.key} disabled={assessmentSubmitted}
                            checked={assessment[q.key] === opt}
                            onChange={() => setAssessment({ ...assessment, [q.key]: opt })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="ab-q-group">
                  <label className="ab-q-label">Q5. Observed Behaviours during the session (multiple selection allowed)</label>
                  <div className="ab-checkbox-grid">
                    {[
                      'Difficulty sustaining attention', 'Impulsive or random responding',
                      'Negative reaction to correction', 'Hesitation in responding',
                      'High focus or persistence', 'Verbalisation of a memory strategy',
                      'Needed frequent reassurance', 'Calm and engaged throughout',
                    ].map(bhv => (
                      <label key={bhv} className="ab-checkbox-label">
                        <input type="checkbox" disabled={assessmentSubmitted}
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

                <div className="ab-q-group">
                  <label className="ab-q-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Additional Notes</span>
                    <button
                      onClick={() => toggleRecording('assessmentNotes')}
                      style={{
                        background: isRecording && recordingTarget === 'assessmentNotes' ? '#fee2e2' : '#eff6ff',
                        color: isRecording && recordingTarget === 'assessmentNotes' ? '#ef4444' : '#2563eb',
                        border: '1px solid', borderColor: isRecording && recordingTarget === 'assessmentNotes' ? '#fca5a5' : '#bfdbfe',
                        padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit',
                      }}
                    >
                      🎙 {isRecording && recordingTarget === 'assessmentNotes' ? 'Recording… (Stop)' : 'Use Mic'}
                    </button>
                  </label>
                  <textarea className="ab-textarea" rows="3" disabled={assessmentSubmitted}
                    placeholder="Type or dictate observations…"
                    value={assessment.notes}
                    onChange={e => setAssessment({ ...assessment, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="ab-final-actions">
                {assessmentSubmitted ? (
                  <>
                    <button onClick={() => { resetInternalState(); setScreen('splash'); setAudioFinished(false); }} className="ab-btn ab-btn-primary">↻ Retest</button>
                    <button onClick={() => navigate('/')} className="ab-btn ab-btn-secondary">Home</button>
                  </>
                ) : (
                  <button onClick={submitAssessmentForm} disabled={isAssessmentSubmitting}
                    className="ab-btn ab-btn-primary" style={{ minWidth: 220 }}>
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
          ref={splashAudioRef}
          src={`${AUD}/splash.wav`}
          preload="auto"
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {/* ── RESUME MODAL ── */}
      {showResumeModal && (
        <div className="ab-modal-overlay">
          <div className="ab-modal">
            <h2>Saved Progress Found</h2>
            <p>You have a previously paused session for this game.</p>
            <div className="ab-btn-row" style={{ marginTop: 20 }}>
              <button className="ab-btn ab-btn-secondary" onClick={() => {
                setShowResumeModal(false);
                resetInternalState();
                setAudioFinished(false);
                setScreen('splash');
              }}>
                Restart Fresh
              </button>
              <button className="ab-btn ab-btn-primary" onClick={resumeGame}>
                Resume Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUIT MODAL ── */}
      {showQuitModal && (
        <div className="ab-modal-overlay">
          <div className="ab-modal">
            <h2>Pause or Quit</h2>
            <p>Why are you stopping the game?</p>
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="E.g., Child is tired, disconnected, etc."
                value={quitReason}
                onChange={e => setQuitReason(e.target.value)}
                style={{ paddingRight: 44, width: '100%', boxSizing: 'border-box' }}
              />
              <button onClick={() => toggleRecording('quitReason')}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: isRecording && recordingTarget === 'quitReason' ? '#ef4444' : '#e2e8f0',
                  color: isRecording && recordingTarget === 'quitReason' ? 'white' : '#475569',
                  border: 'none', borderRadius: '50%', width: 32, height: 32,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >🎙</button>
            </div>
            <div className="ab-btn-row" style={{ marginTop: 16 }}>
              <button className="ab-btn ab-btn-secondary" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem' }}
                onClick={() => setShowQuitModal(false)}>Cancel</button>
              <button className="ab-btn ab-btn-warning" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem' }}
                onClick={() => handleQuit('paused')}>Pause & Save</button>
              <button className="ab-btn ab-btn-danger" style={{ padding: '8px 18px', minWidth: 0, fontSize: '0.88rem' }}
                onClick={() => handleQuit('quit')}>Quit & End</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtlantisBagiyaGame;
