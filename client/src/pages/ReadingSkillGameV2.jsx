import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage, STT_LANG_MAP } from '../contexts/LanguageContext';
import { useHeaderConfig } from '../contexts/HeaderConfigContext';
import SessionAssessmentForm from '../components/SessionAssessmentForm';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import './ReadingSkillGameV2.css';

const CONFIG = {
  IMAGE_PATH: "/assets/images",
  AUDIO_PATH: "/assets/audios"
};

// ASER 2014 Manual — Hindi toolkit content (Std I paragraph, Std II story,
// letter bank, word bank). Adaptive flow below replaces V1's fixed 22-question walk.
const ASSESSMENT_CRITERIA = ['skipWords', 'pronunciation', 'neededHelp'];

const LETTERS_BANK = ['ल', 'प', 'स', 'क', 'ग', 'ड', 'ब', 'म', 'ट', 'झ'];
const WORDS_BANK = ['लाल', 'दूध', 'पैर', 'तेल', 'किला', 'मोर', 'जूता', 'कुल', 'पानी', 'मौका'];
// Two Std-I paragraphs — the assessor picks one; the child reads only the selected one,
// and the same choice is reused verbatim for the Paragraph retry (never re-selected).
const PARAGRAPHS = [
  'बगीचे में एक पेड़ है। पेड़ पर एक तोता रहता है। तोते का रंग हरा है। वह लाल टमाटर खाता है।',
  'नीतू के घर में गाय है। उसका रंग सफेद है। गाय हरी घास खाती है। वह बहुत दूध देती है।'
];
const STORY_TEXT = 'सावन का महीना था। आसमान में बहुत काले-काले बादल छाए थे। ठंडी-ठंडी हवा चल रही थी। मुझे झूला झूलने का मन किया। बड़े भैया एक मोटी सी रस्सी लेकर बाहर आए। भैया ने रस्सी को पेड़ से लटकाकर झूला बनाया। सब ने मिलकर खूब झूला झूला। बाकी बच्चे भी आकर मज़े से झूलने लगे। झूलते-झूलते रात हो गई।';

const LEVELS = { Beginner: 0, Letter: 1, Word: 2, Paragraph: 3, Story: 4 };
const STAGE_LABELS = {
  paragraph: 'Paragraph', paragraph_retry: 'Paragraph (Retry)', story: 'Story',
  words: 'Words', words_retry: 'Words (Retry)', letters: 'Letters'
};

const ReadingSkillGameV2 = () => {
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
  const [screen, setScreen] = useState('splash'); // splash, game, score

  // ── ASER adaptive-flow state ────────────────────────────────────────────
  const [stage, setStage] = useState('paragraph'); // paragraph | words | letters | paragraph_retry | story
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState(null); // 0 | 1 — chosen once, reused for the retry
  const [wordsSource, setWordsSource] = useState('direct'); // 'direct' | 'afterLetters'
  const [marks, setMarks] = useState({}); // in-progress marking: { [text]: 'correct' | 'incorrect' }
  const [selectedTexts, setSelectedTexts] = useState([]); // in-progress tile picks, capped at 5 (words/letters screens)
  const [selectedWords, setSelectedWords] = useState([]); // first Word attempt: [{ text, correct }]
  const [selectedWordsRetry, setSelectedWordsRetry] = useState([]); // Word retry (after Letters pass)
  const [selectedLetters, setSelectedLetters] = useState([]);
  const [paragraphResult, setParagraphResult] = useState(null); // { pass, ssrAnswers, timeTaken }
  const [paragraphRetryResult, setParagraphRetryResult] = useState(null);
  const [storyResult, setStoryResult] = useState(null);
  const [path, setPath] = useState([]); // ordered list of stage names completed
  const [finalLevel, setFinalLevel] = useState(null);
  const [finalScore, setFinalScore] = useState(null);
  const [pendingAssessTarget, setPendingAssessTarget] = useState('paragraph');

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

  const [qTimer, setQTimer] = useState(0);

  // Mid-test Assessment Modal (reused verbatim for Paragraph/Story evaluation)
  const [showMidTestModal, setShowMidTestModal] = useState(false);
  const [midTestAnswers, setMidTestAnswers] = useState({});

  // Final Assessment Form State
  const [assessment, setAssessment] = useState({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  const [isAssessmentSubmitting, setIsAssessmentSubmitting] = useState(false);
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false);

  // STT State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState(null);

  const timerRef = useRef(null);
  const audioRef = useRef(null);

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
        const summary = res.data.summaries.find(s => s.game_name === 'literacy_reading_skill_v2');
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
    if (!isCheckingSession && screen === 'splash' && !showResumeModal && audioRef.current && !audioFinished) {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("Autoplay blocked by browser policy:", err);
          setAudioFinished(true);
        });
      }
    }
  }, [isCheckingSession, screen, showResumeModal, audioFinished]);

  useEffect(() => {
    if ((screen === 'game' && !showQuitModal && !showMidTestModal) || (screen === 'score' && !assessmentSubmitted)) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [screen, showQuitModal, showMidTestModal, assessmentSubmitted]);

  const checkResume = async (childId) => {
    setIsCheckingSession(true);
    try {
      const res = await axios.get(`${API_URL}/games/sessions/resume/${childId}/literacy_reading_skill_v2`);
      if (res.data.sessionInfo) {
        const info = res.data.sessionInfo;
        const resumable = ['in_progress', 'paused'];
        // Only offer resume for genuinely incomplete sessions; ignore completed/dropped/quit ones
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
        game_name: 'literacy_reading_skill_v2',
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
    setStage(saved.stage || 'paragraph');
    setSelectedParagraphIndex(saved.selectedParagraphIndex ?? null);
    setWordsSource(saved.wordsSource || 'direct');
    setMarks({});
    setSelectedTexts([]);
    setSelectedWords(saved.selectedWords || []);
    setSelectedWordsRetry(saved.selectedWordsRetry || []);
    setSelectedLetters(saved.selectedLetters || []);
    setParagraphResult(saved.paragraphResult || null);
    setParagraphRetryResult(saved.paragraphRetryResult || null);
    setStoryResult(saved.storyResult || null);
    setPath(saved.path || []);
    setFinalLevel(saved.finalLevel || null);
    setFinalScore(saved.finalScore ?? null);
    setTimerSeconds(saved.timerSeconds || 0);
    setQTimer(saved.qTimer || 0);
    setPauses(saved.pauses || []);
    setScreen(saved.finalLevel ? 'score' : 'game');
    setShowResumeModal(false);
  };

  const resetInternalState = () => {
    setStage('paragraph');
    setSelectedParagraphIndex(null);
    setWordsSource('direct');
    setMarks({});
    setSelectedTexts([]);
    setSelectedWords([]);
    setSelectedWordsRetry([]);
    setSelectedLetters([]);
    setParagraphResult(null);
    setParagraphRetryResult(null);
    setStoryResult(null);
    setPath([]);
    setFinalLevel(null);
    setFinalScore(null);
    setPendingAssessTarget('paragraph');
    setTimerSeconds(0);
    setQTimer(0);
    setPauses([]);
    setAssessmentSubmitted(false);
    setAudioFinished(false);
    setQuitReason('');
    setAssessment({ q1: '', q2: '', q3: '', q4: '', behaviors: [], notes: '' });
  };

  // Stage Timer Effect
  useEffect(() => {
    if (screen === 'game' && !showQuitModal && !showMidTestModal) {
      const interval = setInterval(() => {
        setQTimer(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [screen, showQuitModal, showMidTestModal, stage]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const fmtDuration = (sec) => {
    if (sec == null) return '—';
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
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

  const buildSavedState = (extra = {}) => ({
    stage, selectedParagraphIndex, wordsSource,
    selectedWords, selectedWordsRetry, selectedLetters,
    paragraphResult, paragraphRetryResult, storyResult,
    path, finalLevel, finalScore,
    timerSeconds, qTimer, pauses,
    ...extra
  });

  const saveToServer = async (statusOverride = null, reason = null) => {
    if (!gameSessionId) return;
    try {
      let updatedPauses = [...pauses];
      if (reason && (statusOverride === 'paused' || statusOverride === 'quit')) {
         updatedPauses.push({
             stage,
             reason: reason,
             timestamp: new Date().toISOString()
         });
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

  // ── PDF Generation & Upload ───────────────────────────────────
  const generateAndUploadPDF = async () => {
    let wrapper = null;
    try {
      const element = document.getElementById('dashboard-capture-area');
      if (!element) return;

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Clone into a clean wrapper on document.body — .rs-app has
      // backdrop-filter and is `position:fixed`, so capturing the live
      // element in place clips it to the viewport instead of its full
      // content size. Also neutralize any scrollable inner region —
      // html2canvas paints scrollable content as currently scrolled, so it
      // stays clipped even once the outer container is unconstrained.
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
      formData.append('pdf', pdfBlob, `${childNameSafe}_ReadingSkillV2_SES${gameSessionId}_${ts}.pdf`);
      formData.append('child_id', childData?.child_id);
      formData.append('session_id', gameSessionId);
      formData.append('game_name', 'literacy_reading_skill_v2');

      await axios.post(`${API_URL}/games/pdfs/upload`, formData);
    } catch (e) {
      console.error('Failed to generate and upload PDF:', e);
    } finally {
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    }
  };

  // ── ASER adaptive engine ─────────────────────────────────────────────
  const finalizeAssessment = (level, pathArg, overrides = {}) => {
    const score = LEVELS[level];
    setFinalLevel(level);
    setFinalScore(score);
    setScreen('score');
    if (gameSessionId) {
      const payload = buildSavedState({
        path: pathArg,
        finalLevel: level,
        finalScore: score,
        retries: {
          wordsRetried: pathArg.includes('words_retry'),
          paragraphRetried: pathArg.includes('paragraph_retry')
        },
        completedAt: new Date().toISOString(),
        assessorContext: { child_id: childData?.child_id, session_id: gameSessionId, attempt_no: attemptNo },
        ...overrides
      });
      axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
        score,
        progress_level: pathArg.length,
        status: 'completed',
        quit_reason: null,
        saved_state: payload
      }).then(() => {
        setTimeout(generateAndUploadPDF, 1500);
      }).catch(e => console.log(e));
    }
  };

  const handleDoneReading = (target) => {
    setPendingAssessTarget(target);
    setMidTestAnswers({});
    setShowMidTestModal(true);
  };

  const handleMidTestAssessmentComplete = () => {
    // Scoring Rule (existing convention): ANY "Yes" = fail, ALL "No" = pass
    const answers = Object.values(midTestAnswers);
    const pass = answers.filter(v => v === 'yes').length === 0;
    const result = { pass, ssrAnswers: midTestAnswers, timeTaken: qTimer };
    setShowMidTestModal(false);

    const target = pendingAssessTarget;
    const newPath = [...path, target];
    setPath(newPath);

    if (target === 'paragraph') {
      setParagraphResult(result);
      if (pass) {
        setStage('story');
      } else {
        setWordsSource('direct');
        setMarks({});
        setSelectedTexts([]);
        setStage('words');
      }
      setQTimer(0);
    } else if (target === 'paragraph_retry') {
      setParagraphRetryResult(result);
      if (pass) {
        setStage('story');
        setQTimer(0);
      } else {
        finalizeAssessment('Word', newPath, { paragraphRetryResult: result });
      }
    } else if (target === 'story') {
      setStoryResult(result);
      finalizeAssessment(pass ? 'Story' : 'Paragraph', newPath, { storyResult: result });
    }
  };

  const isWordsFixedRetry = stage === 'words' && wordsSource === 'afterLetters';
  const markingBank = stage === 'letters'
    ? LETTERS_BANK
    : (isWordsFixedRetry ? selectedWords.map(w => w.text) : WORDS_BANK);
  // The fixed Word-retry bank is already "the selected 5" — nothing left to pick.
  // Otherwise the assessor picks up to 5 tiles first; only picked tiles get Correct/Incorrect.
  const effectiveSelected = isWordsFixedRetry ? markingBank : selectedTexts;
  const markedCount = effectiveSelected.filter(text => text in marks).length;
  const canContinueMarking = effectiveSelected.length === 5 && markedCount === 5;

  const toggleTileSelection = (text) => {
    if (isWordsFixedRetry) return; // pre-selected — not a free pick
    const isSelected = selectedTexts.includes(text);
    if (isSelected) {
      setSelectedTexts(prev => prev.filter(t => t !== text));
      setMarks(prev => {
        if (!(text in prev)) return prev;
        const next = { ...prev };
        delete next[text];
        return next;
      });
    } else {
      if (selectedTexts.length >= 5) return; // cap reached
      setSelectedTexts(prev => [...prev, text]);
    }
  };

  const markTile = (text, correct) => {
    setMarks(prev => {
      const next = { ...prev };
      const value = correct ? 'correct' : 'incorrect';
      if (next[text] === value) {
        delete next[text]; // tap again to unmark
        return next;
      }
      next[text] = value;
      return next;
    });
  };

  const handleMarkingContinue = () => {
    const items = markingBank
      .filter(text => text in marks)
      .map(text => ({ text, correct: marks[text] === 'correct' }));
    const correctCount = items.filter(i => i.correct).length;
    const pass = correctCount >= 4;

    if (stage === 'words') {
      const isRetry = wordsSource === 'afterLetters';
      if (isRetry) setSelectedWordsRetry(items); else setSelectedWords(items);
      const stageName = isRetry ? 'words_retry' : 'words';
      const newPath = [...path, stageName];
      setPath(newPath);

      if (pass) {
        setStage('paragraph_retry');
        setMarks({});
        setSelectedTexts([]);
        setQTimer(0);
      } else if (!isRetry) {
        setStage('letters');
        setMarks({});
        setSelectedTexts([]);
        setQTimer(0);
      } else {
        finalizeAssessment('Letter', newPath, { selectedWordsRetry: items });
      }
    } else if (stage === 'letters') {
      setSelectedLetters(items);
      const newPath = [...path, 'letters'];
      setPath(newPath);

      if (pass) {
        setWordsSource('afterLetters');
        setStage('words');
        setMarks({});
        setSelectedTexts([]);
        setQTimer(0);
      } else {
        finalizeAssessment('Beginner', newPath, { selectedLetters: items });
      }
    }
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
        additional_notes: assessment.notes || ''
      });

      if (gameSessionId) {
        const finalStatus = quitReason ? 'quit' : 'completed';
        await axios.put(`${API_URL}/games/sessions/update/${gameSessionId}`, {
          score: finalScore ?? 0,
          progress_level: path.length,
          status: finalStatus,
          quit_reason: quitReason || null,
          saved_state: buildSavedState({ assessmentSubmitted: true })
        });
      }

      setAssessmentSubmitted(true);
      setTimeout(generateAndUploadPDF, 1000);
    } catch(e) {
      console.error(e);
      alert(t('common.failedToSave'));
    } finally {
      setIsAssessmentSubmitting(false);
    }
  };

  const storyTextStyle = { fontSize: 66, padding: 10 };
  const selectedParagraphText = selectedParagraphIndex != null ? PARAGRAPHS[selectedParagraphIndex] : null;

  const renderPassBadge = (pass) => (
    <span style={{
      display: 'inline-block', padding: '3px 14px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600,
      background: pass ? '#dcfce7' : '#fee2e2', color: pass ? '#16a34a' : '#dc2626',
    }}>{pass ? 'Pass' : 'Fail'}</span>
  );

  const renderStageRow = (stageName, idx) => {
    let detail = '—', pass, duration = null;
    if (stageName === 'paragraph') { detail = selectedParagraphText || '—'; pass = paragraphResult?.pass; duration = paragraphResult?.timeTaken; }
    else if (stageName === 'paragraph_retry') { detail = selectedParagraphText || '—'; pass = paragraphRetryResult?.pass; duration = paragraphRetryResult?.timeTaken; }
    else if (stageName === 'story') { detail = STORY_TEXT; pass = storyResult?.pass; duration = storyResult?.timeTaken; }
    else if (stageName === 'words') {
      detail = selectedWords.map(w => `${w.text}${w.correct ? '✓' : '✗'}`).join('  ');
      pass = selectedWords.filter(w => w.correct).length >= 4;
    } else if (stageName === 'words_retry') {
      detail = selectedWordsRetry.map(w => `${w.text}${w.correct ? '✓' : '✗'}`).join('  ');
      pass = selectedWordsRetry.filter(w => w.correct).length >= 4;
    } else if (stageName === 'letters') {
      detail = selectedLetters.map(l => `${l.text}${l.correct ? '✓' : '✗'}`).join('  ');
      pass = selectedLetters.filter(l => l.correct).length >= 4;
    }
    return (
      <tr key={idx}>
        <td>{STAGE_LABELS[stageName] || stageName}</td>
        <td>{renderPassBadge(pass)}</td>
        <td className="col-text" title={detail}>{detail}</td>
        <td>{fmtDuration(duration)}</td>
      </tr>
    );
  };

  const headerScoreDisplay = finalScore != null ? finalScore : path.length;

  return (
    <div className="rs-app">
      <header className="rs-topbar">
        <div className="rs-brand">
          {showLogo && <img src="/cel_admin_logo.png" alt="CEL Logo" className="rs-brand-img" />}
          {showLogo && (showGameIcon || showGameName) && <div className="rs-divider"></div>}
          {showGameIcon && <img src="/assets/images/reading_skill_v2/reading_skill_v2.jpg" alt="Reading Skill" className="rs-test-logo" />}
          {showGameName && <span className="rs-test-title">{t('home.games.literacy.title')}</span>}
        </div>
        <div className="rs-topbar-center">
          {screen === 'game' && (
            <div className="rs-topbar-screen-title">{STAGE_LABELS[stage] || stage}</div>
          )}
        </div>
        <div className="rs-stats">
          {showChildId && childData?.child_id && (
            <div className="rs-stat-pill"><span className="rs-stat-icon">👤</span> <span className="rs-stat-value">{childData.child_id}</span></div>
          )}
          {showTimer && screen === 'game' && (
            <div className="rs-stat-pill"><span className="rs-stat-icon">⏱</span> <span className="rs-stat-value">{formatTime(qTimer)}</span></div>
          )}
          {showScore && (
          <div className="rs-stat-pill"><span className="rs-stat-icon">🏆</span> <span className="rs-stat-value">{headerScoreDisplay}</span></div>
          )}
          {screen === 'game' && <button className="btn-pause-quit" onClick={() => { setQuitReason(''); setShowQuitModal(true); }}><span>⏸</span> {t('game.pauseQuit')}</button>}
        </div>
      </header>

      <main className={`rs-main${screen === 'splash' ? ' rs-main-splash' : ''}`}>
        {screen === 'splash' && (
          <div className="rs-screen rs-screen-splash">
            <div className="rs-splash-cover">
              <img src="/assets/images/reading_skill_v2/reading_skill_v2.jpg" alt="Padh ke batao" className="rs-splash-img-full" onError={e => { e.target.style.display = 'none'; }} />
              <div className="rs-splash-btn-overlay">
                <button
                  className={`rs-btn rs-btn-primary ${audioFinished ? 'rs-btn-highlight' : ''}`}
                  disabled={!audioFinished}
                  style={{ opacity: !audioFinished ? 0.6 : 1, cursor: !audioFinished ? 'not-allowed' : 'pointer' }}
                  onClick={() => startNewGame()}
                >
                  {t('game.startNow')}
                </button>
                <button className="rs-btn rs-btn-secondary" onClick={() => {
                  if (audioRef.current) {
                    setAudioFinished(false);
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(() => setAudioFinished(true));
                  }
                }}>{t('game.replayAudio')}</button>
              </div>
            </div>
          </div>
        )}

        {screen === 'game' && stage === 'story' && (
          <div className="rs-screen" style={{ backgroundColor: '#fff' }}>
            <div className="rs-card rs-question-card">
              <div className="rs-question-content">
                <div style={{
                  ...storyTextStyle,
                  lineHeight: (storyTextStyle.fontSize + 20) + 'px',
                  textAlign: 'justify'
                }}>
                  {STORY_TEXT}
                </div>
              </div>
            </div>

            <div className="rs-response-buttons">
              <button className="rs-response-btn rs-btn-done" onClick={() => handleDoneReading('story')}>
                {t('game.doneReading')}
              </button>
            </div>
          </div>
        )}

        {screen === 'game' && (stage === 'paragraph' || stage === 'paragraph_retry') && (
          <div className="rs-screen" style={{ backgroundColor: '#fff', padding: '20px' }}>
            <div className="rs-paragraph-options">
              {PARAGRAPHS.map((text, idx) => {
                const isSelected = selectedParagraphIndex === idx;
                const isDimmed = selectedParagraphIndex !== null && !isSelected;
                // Retry re-reads the paragraph already chosen — selection locks so the
                // assessor can't accidentally switch paragraphs mid-retry.
                const locked = stage === 'paragraph_retry';
                return (
                  <div
                    key={idx}
                    className={`rs-card rs-paragraph-card ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}
                    style={{ cursor: locked ? 'default' : 'pointer', pointerEvents: locked ? 'none' : 'auto' }}
                    onClick={() => { if (!locked) setSelectedParagraphIndex(idx); }}
                  >
                    <div className="rs-paragraph-text">{text}</div>
                  </div>
                );
              })}
            </div>

            <div className="rs-response-buttons">
              <button
                className="rs-response-btn rs-btn-done"
                disabled={selectedParagraphIndex === null}
                onClick={() => handleDoneReading(stage)}
              >
                {t('game.doneReading')}
              </button>
            </div>
          </div>
        )}

        {screen === 'game' && (stage === 'words' || stage === 'letters') && (
          <div className="rs-screen" style={{ background: '#fff', padding: '20px' }}>
            <div className="rs-chips" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
              <span className="rs-chip">{markedCount} / 5 marked</span>
            </div>

            <div className="rs-mark-grid">
              {markingBank.map((text) => {
                const isSelected = isWordsFixedRetry || selectedTexts.includes(text);
                const isCapLocked = !isSelected && !isWordsFixedRetry && selectedTexts.length >= 5;
                return (
                  <div
                    key={text}
                    className={`rs-mark-tile ${isSelected ? 'rs-mark-tile-selected' : ''} ${isCapLocked ? 'rs-mark-tile-locked' : ''}`}
                    onClick={() => toggleTileSelection(text)}
                    style={{ cursor: isWordsFixedRetry ? 'default' : 'pointer' }}
                  >
                    <div className="rs-mark-tile-text">{text}</div>
                    {/* Neutral toggle — same styling either way so the child gets no
                        colour/label cue about which option means correct vs incorrect;
                        only the assessor needs to know which is which. */}
                    <div className={`rs-mark-toggle-row ${isSelected ? 'visible' : ''}`}>
                      <button
                        aria-label="Mark as correct"
                        className={`rs-mark-toggle-btn ${marks[text] === 'correct' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); markTile(text, true); }}
                      >
                        ✓
                      </button>
                      <button
                        aria-label="Mark as incorrect"
                        className={`rs-mark-toggle-btn ${marks[text] === 'incorrect' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); markTile(text, false); }}
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rs-response-buttons">
              <button className="rs-btn rs-btn-primary" disabled={!canContinueMarking} onClick={handleMarkingContinue}>
                {t('game.finishAssessment')}
              </button>
            </div>
          </div>
        )}

        {screen === 'score' && (
          <div className="rs-screen" id="dashboard-capture-area" style={{ backgroundColor: '#fff', padding: '20px' }}>
            <div className="rs-screen-header">
              <div>
                <div className="rs-screen-title">
                  {quitReason ? t('game.sessionTerminatedPartial') : t('game.assessmentComplete')}
                </div>
                <div className="rs-screen-subtitle">
                  {quitReason ? `${t('game.assessorStopped')} ${quitReason}` : t('game.testFinished')}
                </div>
              </div>
              <div className="rs-chips">
                <span className="rs-chip" style={{ color: '#fff', background: '#4f46e5', border: '1px solid #4338ca' }}>{t('game.attemptLabel')}{attemptNo}</span>
                <span className="rs-chip" style={{ color: '#374151', background: '#f3f4f6', border: '1px solid #d1d5db' }}>
                  Screentime: {formatTime(timerSeconds)}
                </span>
              </div>
            </div>

            <div className="rs-card rs-result-card">
              {finalLevel && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                  <div className="rs-level-badge">
                    <span className="level-label">Final Reading Level</span>
                    <span className="level-name">{finalLevel}</span>
                  </div>
                  <div className="rs-path-trail">
                    {path.map((p, i) => (
                      <React.Fragment key={i}>
                        <span className="rs-chip">{STAGE_LABELS[p] || p}</span>
                        {i < path.length - 1 && <span className="rs-path-arrow">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              <div className="rs-table-container" style={{ marginTop: '0', boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                <div className="rs-table-responsive">
                  <table className="rs-data-table">
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>Result</th>
                        <th>Detail</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {path.map((stageName, idx) => renderStageRow(stageName, idx))}
                    </tbody>
                  </table>
                </div>
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
                  <button onClick={() => { resetInternalState(); setScreen('splash'); }} className="rs-btn rs-btn-primary">{t('game.retest')}</button>
                  <button onClick={() => navigate('/')} className="rs-btn rs-btn-secondary">{t('game.home')}</button>
                </>
              </SessionAssessmentForm>
            </div>
          </div>
        )}
      </main>

      {!isCheckingSession && (
        <audio
          ref={audioRef}
          src="/assets/audios/reading_skill_v2/splash.wav"
          preload="auto"
          onEnded={() => setAudioFinished(true)}
          onError={() => setAudioFinished(true)}
        />
      )}

      {/* Mid-Test Assessment Modal — reused for Paragraph/Story SSR evaluation */}
      {showMidTestModal && (
        <div className="rs-modal-overlay">
          <div className="rs-modal" style={{ maxWidth: '600px' }}>
            <button className="rs-modal-close" aria-label="Close" onClick={() => setShowMidTestModal(false)}>✕</button>
            <div className="rs-modal-header" style={{ marginBottom: '20px' }}>
              <h3>{t('game.assessmentLabel')}</h3>
            </div>

            <div className="rs-assessment-criteria" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ASSESSMENT_CRITERIA.map((criterion, index) => (
                <div key={index} className={`rs-criterion-row ${midTestAnswers[index] ? 'complete' : ''}`}>
                  <div className="rs-criterion-text">{t(`game.readingCriteria.${criterion}`)}</div>
                  <div className="rs-criterion-buttons">
                    <button
                      className={`rs-criterion-btn rs-btn-yes ${midTestAnswers[index] === 'yes' ? 'selected' : ''}`}
                      onClick={() => setMidTestAnswers({...midTestAnswers, [index]: 'yes'})}
                    >
                      {t('game.yesLabel')}
                    </button>
                    <button
                      className={`rs-criterion-btn rs-btn-no ${midTestAnswers[index] === 'no' ? 'selected' : ''}`}
                      onClick={() => setMidTestAnswers({...midTestAnswers, [index]: 'no'})}
                    >
                      {t('game.noLabel')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rs-modal-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <button
                className="rs-btn rs-btn-primary"
                disabled={Object.keys(midTestAnswers).length !== ASSESSMENT_CRITERIA.length}
                onClick={handleMidTestAssessmentComplete}
              >
                {t('game.finishAssessment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other Modals */}
      {showResumeModal && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <h2>{t('game.progressFound')}</h2>
            <p>{t('game.progressDesc')}</p>
            <div className="rs-btn-row" style={{marginTop:'20px'}}>
              <button className="rs-btn rs-btn-secondary" onClick={() => { setShowResumeModal(false); resetInternalState(); setScreen('splash'); }}>{t('game.restartFresh')}</button>
              <button className="rs-btn rs-btn-primary" onClick={resumeGame}>{t('game.resumeGame')}</button>
            </div>
          </div>
        </div>
      )}

      {showQuitModal && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <h2>{t('game.pauseQuitTitle')}</h2>
            <p>{t('game.pauseDesc')}</p>

            <div style={{ position: 'relative' }}>
              <textarea
                {...{placeholder: t('game.pausePlaceholder')}}
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

            <div className="rs-btn-row">
              <button className="rs-btn rs-btn-secondary" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem'}} onClick={() => setShowQuitModal(false)}>{t('game.cancel')}</button>
              <button className="rs-btn" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem', background:'#fef08a', color:'#854d0e'}} onClick={() => handleQuit('paused')}>{t('game.pauseSave')}</button>
              <button className="rs-btn rs-btn-incorrect" style={{padding:'8px 20px', minWidth:0, fontSize:'0.9rem'}} onClick={() => handleQuit('quit')}>{t('game.quitEnd')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReadingSkillGameV2;
