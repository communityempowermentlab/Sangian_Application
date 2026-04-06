// ============================================================
// TriangleRachnaGame.jsx — Triangle Game (RACHNA)
// React port of rachna.js integrated with Sangian backend.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../services/api';
import './TriangleRachnaGame.css';

const GAME_NAME  = 'triangle_rachna';
const AUDIO_PATH = '/assets/audios/rachna';
const IMAGE_PATH = '/assets/images/rachna';

const formatTimerDisplay = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
};

const getTargetImageName = (key) => {
  if (key === 'sampleA') return 'sample_a';
  if (key === 'sampleB') return 'sample_b';
  if (key.startsWith('teachingQ')) return key.replace('teachingQ', 'teaching_question');
  if (key === 'question11') return 'teaching_question11';
  if (key === 'question12') return 'teaching_question12';
  return key;
};

const TIMER_LIMITS = {
  sampleA:0, teachingQ1:0, teachingQ2:0,
  question3:90, question4:90, teachingQ5:0,
  question6:135, question7:135, question8:150, question9:150, question10:150,
  question11:150, question12:150, sampleB:0,
  question13:300, question14:300, question15:300, question16:300, question17:300,
  question18:300, question19:300, question20:300, question21:300, question22:300,
  question23:300, question24:300, question25:300, question26:300, question27:300,
};

const SCORED_QUESTIONS = [
  'question3','question4','question6','question7','question8','question9','question10',
  'question11','question12','question13','question14','question15','question16','question17',
  'question18','question19','question20','question21','question22','question23','question24',
  'question25','question26','question27',
];

const MAX_SCORE = SCORED_QUESTIONS.length * 2; // 48

// ─── Question catalogue ───────────────────────────────────────
const QUESTIONS = {
  sampleA:    { type:'sample',   title:'Sample A',          next:'teachingQ1', isSample:true,
    sources:[{id:'rc-lg',name:'Red Circle',size:'large',color:'#e74c3c',shape:'circle'},
             {id:'yc-sm',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'}]},

  teachingQ1: { type:'teaching', title:'Teaching Question 1', next:'teachingQ2', isSample:true,
    sources:[{id:'bs-lg',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'rc-lg2',name:'Red Circle',size:'large',color:'#e74c3c',shape:'circle'},
             {id:'ys-sm',name:'Yellow Square',size:'small',color:'#f1c40f',shape:'square'}]},

  teachingQ2: { type:'teaching', title:'Teaching Question 2', next:'question3', isSample:true,
    sources:[{id:'rc-lg3',name:'Red Circle',size:'large',color:'#e74c3c',shape:'circle'},
             {id:'rc-sm',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'},
             {id:'yc-sm2',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'}]},

  question3:  { type:'question', title:'Question 3',  next:'question4', isSample:false,
    sources:[{id:'bs-lg4',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'rc-lg4',name:'Red Circle',size:'large',color:'#e74c3c',shape:'circle'},
             {id:'bs-sm4',name:'Blue Square',size:'small',color:'#3498db',shape:'square'},
             {id:'ys-sm4',name:'Yellow Square',size:'small',color:'#f1c40f',shape:'square'}]},

  question4:  { type:'question', title:'Question 4',  next:'teachingQ5', isSample:false,
    sources:[{id:'bs-lg5',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'bs-sm5',name:'Blue Square',size:'small',color:'#3498db',shape:'square'},
             {id:'rc-sm5',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'},
             {id:'yc-sm5',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'}]},

  teachingQ5: { type:'teaching', title:'Teaching Question 5', next:'question6', isSample:true,
    sources:[{id:'yt-lg6',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'triangle-up'},
             {id:'bs-lg6',name:'Blue Square',size:'large',color:'#3498db',shape:'square'}]},

  question6:  { type:'question', title:'Question 6',  next:'question7', isSample:false,
    sources:[{id:'bs-lg7a',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'bs-lg7b',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'bs-sm7',name:'Blue Square',size:'small',color:'#3498db',shape:'square'},
             {id:'ys-sm7',name:'Yellow Square',size:'small',color:'#f1c40f',shape:'square'}]},

  question7:  { type:'question', title:'Question 7',  next:'question8', isSample:false,
    sources:[{id:'yt-lg8',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'triangle-down'},
             {id:'yt-sm8',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'triangle-down'},
             {id:'rc-sm8',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'}]},

  question8:  { type:'question', title:'Question 8',  next:'question9', isSample:false,
    sources:[{id:'bs-lg9',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'yc-sm9a',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'},
             {id:'yc-sm9b',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'},
             {id:'rc-sm9a',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'},
             {id:'rc-sm9b',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'}]},

  question9:  { type:'question', title:'Question 9',  next:'question10', isSample:false,
    sources:[{id:'bs-lg10a',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'bs-lg10b',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'rt-lg10a',name:'Red Triangle',size:'large',color:'#e74c3c',shape:'triangle-up'},
             {id:'rt-lg10b',name:'Red Triangle',size:'large',color:'#e74c3c',shape:'triangle-up'},
             {id:'yc-sm10',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'}]},

  question10: { type:'question', title:'Question 10', next:'sampleB', isSample:false,
    sources:[{id:'bs-lg11',name:'Blue Square',size:'large',color:'#3498db',shape:'square'},
             {id:'yt-lg11',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'triangle-up'},
             {id:'ys-sm11',name:'Yellow Square',size:'small',color:'#f1c40f',shape:'diamond'}]},

  sampleB:    { type:'sample',   title:'Sample B', next:'question11', isSample:true,
    sources:[{id:'yrt-lg-s',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt-lg-s',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question11: { type:'question', title:'Question 11', next:'question12', isSample:false,
    sources:[{id:'yrt-a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt-b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'}]},

  question12: { type:'question', title:'Question 12', next:'question13', isSample:false,
    sources:[{id:'brt-a',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt-b',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question13: { type:'question', title:'Question 13', next:'question14', isSample:false,
    sources:[{id:'yrt13',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt13',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question14: { type:'question', title:'Question 14', next:'question15', isSample:false,
    sources:[{id:'yrt14a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt14b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt14',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question15: { type:'question', title:'Question 15', next:'question16', isSample:false,
    sources:[{id:'yrt15',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt15a',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt15b',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question16: { type:'question', title:'Question 16', next:'question17', isSample:false,
    sources:[{id:'yrt16',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt16a',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt16b',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt16c',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question17: { type:'question', title:'Question 17', next:'question18', isSample:false,
    sources:[{id:'yrt17a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt17b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt17a',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt17b',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question18: { type:'question', title:'Question 18', next:'question19', isSample:false,
    sources:[{id:'yrt18a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt18b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt18a',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt18b',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question19: { type:'question', title:'Question 19', next:'question20', isSample:false,
    sources:[{id:'yrt19a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt19b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt19a',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt19b',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question20: { type:'question', title:'Question 20', next:'question21', isSample:false,
    sources:[{id:'yrt20a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt20b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt20a',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt20b',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question21: { type:'question', title:'Question 21', next:'question22', isSample:false,
    sources:[{id:'yrt21a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt21b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt21c',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt21',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question22: { type:'question', title:'Question 22', next:'question23', isSample:false,
    sources:[{id:'yrt22a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt22b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt22c',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt22',name:'Blue Triangle',size:'large',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question23: { type:'question', title:'Question 23', next:'question24', isSample:false,
    sources:[{id:'yrt23a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt23b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt23c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt23d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt23a',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt23b',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt23c',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt23d',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question24: { type:'question', title:'Question 24', next:'question25', isSample:false,
    sources:[{id:'yrt24a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt24b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt24c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt24d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt24a',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt24b',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt24c',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt24d',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question25: { type:'question', title:'Question 25', next:'question26', isSample:false,
    sources:[{id:'yrt25a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25e',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25f',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25g',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt25a',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt25b',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question26: { type:'question', title:'Question 26', next:'question27', isSample:false,
    sources:[{id:'yrt26a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26e',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26f',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt26a',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt26b',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt26c',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},

  question27: { type:'question', title:'Question 27 (Final)', next:null, isSample:false,
    sources:[{id:'yrt27a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt27b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt27c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt27d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt27a',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt27b',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt27c',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'},
             {id:'brt27d',name:'Blue Triangle',size:'small',color:'#3498db',shape:'right-triangle',orientation:'BL'}]},
};

const QUESTION_ORDER = [
  'sampleA','teachingQ1','teachingQ2','question3','question4','teachingQ5',
  'question6','question7','question8','question9','question10',
  'sampleB','question11','question12',
  'question13','question14','question15','question16','question17','question18',
  'question19','question20','question21','question22','question23','question24',
  'question25','question26','question27',
];

const SAMPLE_QS = QUESTION_ORDER.filter(k => QUESTIONS[k].type === 'sample');
const TEACHING_QS = QUESTION_ORDER.filter(k => QUESTIONS[k].type === 'teaching');
const ORIGINAL_QS = QUESTION_ORDER.filter(k => QUESTIONS[k].type === 'question');

const getQuestionCounter = (key) => {
  const type = QUESTIONS[key].type;
  if (type === 'sample') return `${SAMPLE_QS.indexOf(key) + 1}/${SAMPLE_QS.length}`;
  if (type === 'teaching') return `${TEACHING_QS.indexOf(key) + 1}/${TEACHING_QS.length}`;
  return `${ORIGINAL_QS.indexOf(key) + 1}/${ORIGINAL_QS.length}`;
};

const getQuestionTitle = (key) => {
  if (!QUESTIONS[key]) return '';
  const type = QUESTIONS[key].type;
  if (type === 'sample') return `Sample ${String.fromCharCode(65 + SAMPLE_QS.indexOf(key))}`;
  if (type === 'teaching') return `Teaching Question ${TEACHING_QS.indexOf(key) + 1}`;
  return `Question ${ORIGINAL_QS.indexOf(key) + 1}`;
};

const SHAPE_SIZE_PX = { large: 200, small: 99 };
const SOURCE_SIZE_PX = { large: 56, small: 38 };

// ─── Shape renderer (both source and workspace) ───────────────
function ShapeEl({ shape, color, size, orientation, workspace = false }) {
  const sizePx = workspace ? SHAPE_SIZE_PX[size] : SOURCE_SIZE_PX[size];
  const cls = workspace ? 'rg-shape-' : 'rg-source-shape ';

  if (shape === 'circle') {
    return <div className={`${cls}circle ${size}`} style={{ width: sizePx, height: sizePx, background: color }} />;
  }
  if (shape === 'square') {
    return <div className={`${cls}square ${size}`} style={{ width: sizePx, height: sizePx, background: color }} />;
  }
  if (shape === 'diamond') {
    const innerSz = Math.round(sizePx * 0.85); // made larger for better usability
    return (
      <div style={{ width: sizePx, height: sizePx, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <div
          className={`${cls}square ${size}`}
          style={{ width: innerSz, height: innerSz, background: color, transform:'rotate(45deg)', flexShrink:0 }}
        />
      </div>
    );
  }
  if (shape === 'triangle-up') {
    const b = sizePx / 2;
    return (
      <div className={`${workspace ? 'rg-shape-triangle-up rg-shape-' : 'rg-source-shape triangle-up '}${size}`}
        style={{ borderBottomColor: color, borderLeftWidth: b, borderRightWidth: b, borderBottomWidth: b }} />
    );
  }
  if (shape === 'triangle-down') {
    const b = sizePx / 2;
    return (
      <div className={`${workspace ? 'rg-shape-triangle-down rg-shape-' : 'rg-source-shape triangle-down '}${size}`}
        style={{ borderTopColor: color, borderLeftWidth: b, borderRightWidth: b, borderTopWidth: b }} />
    );
  }
  if (shape === 'right-triangle') {
    const o = orientation || 'BL';
    return (
      <div
        className={`${workspace ? 'rg-shape-right-triangle rg-shape-' : 'rg-source-shape right-triangle rg-rt-'}${workspace ? size + ' rg-rt-' + o : o}`}
        style={{ width: sizePx, height: sizePx, background: color }}
      />
    );
  }
  return null;
}

// ─── Main Component ───────────────────────────────────────────
const TriangleRachnaGame = () => {
  const navigate = useNavigate();

  const [childData, setChildData]           = useState(null);
  const [screen, setScreen]                 = useState('loading');
  const [audioFinished, setAudioFinished]   = useState(false);
  const [isCheckingSession, setIsCheck]     = useState(true);

  const [currentKey, setCurrentKey]         = useState('sampleA');
  const [workspaceItems, setWorkspaceItems] = useState([]);
  const [timeElapsed, setTimeElapsed]       = useState(0);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [qAnswers, setQAnswers] = useState({ q1: null, q2: null, q3: null });

  const [totalScore, setTotalScore]         = useState(0);
  const [questionScores, setQuestionScores] = useState({});
  const [questionTimes, setQuestionTimes]   = useState({});

  const [showGrid, setShowGrid]             = useState(false);
  const [showQuitModal, setShowQuitModal]   = useState(false);
  const [quitReason, setQuitReason]         = useState('');
  const [pauses, setPauses]                 = useState([]);
  const [assessment, setAssessment]         = useState({ q1:'', q2:'', q3:'', q4:'', behaviors:[], notes:'' });
  const [assessmentSubmitting, setAssSub]   = useState(false);
  const [assessmentSubmitted, setAssDone]   = useState(false);
  const [isRecording, setIsRecording]               = useState(false);
  const [recordingTarget, setRecordingTarget]       = useState(null);

  const sessionIdRef    = useRef(null);
  const timerRef        = useRef(null);
  const audioRef        = useRef(null);
  const workspaceRef    = useRef(null);
  const dragItemRef     = useRef(null); // { sourceItem }
  const itemDragRef     = useRef(null); // { id, startX, startY, origX, origY }
  const rotateRef       = useRef(null); // { id, centerX, centerY, startAngle, origRot }
  const pausesRef       = useRef([]);
  const timeElapsedRef  = useRef(0);

  useEffect(() => { pausesRef.current = pauses; }, [pauses]);
  useEffect(() => { timeElapsedRef.current = timeElapsed; }, [timeElapsed]);

  const toggleRecording = (target) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Your browser does not support Speech Recognition. Please type manually."); return; }

    if (isRecording && recordingTarget === target) {
      if(window.activeRecognition) window.activeRecognition.stop();
      setIsRecording(false);
      setRecordingTarget(null);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

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

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('currentChild');
    if (!raw) { navigate('/login'); return; }
    setChildData(JSON.parse(raw));
    setIsCheck(false);
    setScreen('splash');
  }, [navigate]);

  // ── Splash audio ──────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'splash' && audioRef.current) {
      audioRef.current.play().catch((e) => {
        if (e.name !== 'NotAllowedError') setAudioFinished(true);
      });
    }
  }, [screen]);

  // ── Timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game' || showQuitModal || showAssessmentModal) { clearInterval(timerRef.current); return; }
    const limit = TIMER_LIMITS[currentKey] || 0;
    setTimeElapsed(0);
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
    const onMouseMove = (e) => {
      if (itemDragRef.current) {
        const { id, startX, startY, origX, origY } = itemDragRef.current;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        setWorkspaceItems(prev => prev.map(it =>
          it.id === id ? { ...it, x: origX + dx, y: origY + dy } : it));
      }
      if (rotateRef.current) {
        const { id, centerX, centerY, startAngle, origRot } = rotateRef.current;
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
        setWorkspaceItems(prev => prev.map(it =>
          it.id === id ? { ...it, rotation: origRot + (angle - startAngle) } : it));
      }
    };
    const onMouseUp = () => { itemDragRef.current = null; rotateRef.current = null; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
  }, []);

  // ── API: Start session ────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!childData) return;
    try {
      const res = await axios.post(`${API_URL}/games/sessions/start`, {
        child_id: childData.child_id, game_name: GAME_NAME, total_questions: SCORED_QUESTIONS.length,
      });
      sessionIdRef.current = res.data.sessionId;
    } catch (e) { console.error(e); }
  }, [childData]);

  // ── API: Save progress ────────────────────────────────────────
  const saveProgress = useCallback((scores, times, totalSc, status = 'in_progress') => {
    if (!sessionIdRef.current) return;
    const allScores = Object.entries(scores).map(([k, sc]) => ({
      qId: k, score: sc, timeTaken: times[k] || 0,
    }));
    axios.put(`${API_URL}/games/sessions/update/${sessionIdRef.current}`, {
      score: totalSc, progress_level: Object.keys(scores).length,
      status, saved_state: { allScores, totalScore: totalSc, pauses: pausesRef.current },
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

    // Milestone 1: At Question 8 (Internal Q7 = question10)
    // Check cumulative score of Q1-Q7 (question3 through question10)
    if (currentKey === 'question10') {
      const q1_q7 = ['question3','question4','question6','question7','question8','question9','question10'];
      const sum1 = q1_q7.reduce((acc, k) => acc + (newScores[k] || 0), 0);
      if (sum1 <= 3) nextKey = null; // Drop test
    }

    // Milestone 2: At Question 13 (Internal Q12 = question15)
    // Check cumulative score of Q1-Q12
    if (currentKey === 'question15') {
      const q1_q12 = ['question3','question4','question6','question7','question8','question9','question10',
                      'question11','question12','question13','question14','question15'];
      const sum2 = q1_q12.reduce((acc, k) => acc + (newScores[k] || 0), 0);
      if (sum2 <= 6) nextKey = null; // Drop test
    }
    if (!nextKey) {
      saveProgress(newScores, newTimes, newTotal, 'completed');
      setShowAssessmentModal(false);
      setScreen('score');
    } else {
      saveProgress(newScores, newTimes, newTotal, 'in_progress');
      setCurrentKey(nextKey);
      setShowAssessmentModal(false);
      setQAnswers({ q1: null, q2: null, q3: null });
    }
  }, [currentKey, questionScores, questionTimes, totalScore, saveProgress]);

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
    const x = e.clientX - rect.left - sz / 2;
    const y = e.clientY - rect.top  - sz / 2;
    addToWorkspace(src, x, y);
    dragItemRef.current = null;
  };

  const addToWorkspace = (src, x, y) => {
    setWorkspaceItems(prev => [...prev, {
      id: Date.now() + Math.random(), sourceId: src.id,
      name: src.name, shape: src.shape, color: src.color,
      size: src.size, orientation: src.orientation || 'BL',
      x, y, rotation: 0,
    }]);
  };

  const removeFromWorkspace = (id) => setWorkspaceItems(prev => prev.filter(it => it.id !== id));

  // ── Start dragging a workspace item ──────────────────────────
  const onItemMouseDown = (e, item) => {
    if (e.target.classList.contains('rg-remove-btn') ||
        e.target.classList.contains('rg-rotation-handle')) return;
    e.preventDefault();
    itemDragRef.current = { id: item.id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y };
  };

  // ── Start rotating a workspace item ──────────────────────────
  const onRotHandleMouseDown = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    const rect = e.currentTarget.closest('.rg-workspace-item').getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top  + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    rotateRef.current = { id: item.id, centerX, centerY, startAngle, origRot: item.rotation };
  };

  // ── Double-click: rotate 90° snap ────────────────────────────
  const onItemDblClick = (e, item) => {
    if (e.target.classList.contains('rg-remove-btn') ||
        e.target.classList.contains('rg-rotation-handle')) return;
    setWorkspaceItems(prev => prev.map(it =>
      it.id === item.id ? { ...it, rotation: it.rotation + 90 } : it));
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

  // ── Quit / Pause ──────────────────────────────────────────────
  const submitQuit = () => {
    const p = [...pausesRef.current, { questionKey: currentKey, reason: quitReason }];
    setPauses(p);
    saveProgress(questionScores, questionTimes, totalScore, 'paused');
    setShowQuitModal(false);
    setQuitReason('');
    navigate('/');
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
        q5_behaviors: JSON.stringify(assessment.behaviors),
        additional_notes: assessment.notes,
      });
      setAssDone(true);
    } catch (e) { console.error(e); } finally { setAssSub(false); }
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
    <div className="rg-screen">
      <div className="rg-splash-card">
        <div className="rg-splash-img-wrap">
          <img src={`${IMAGE_PATH}/rachna.jpg`} alt="Rachna" className="rg-splash-img" />
        </div>
        <div className="rg-splash-title">Triangle Game — Rachna</div>
        <div className="rg-splash-sub">Please listen to the instructions. The game will begin when the audio finishes.</div>
        <div className="rg-splash-footer">
          <div className="rg-btn-row" style={{ marginTop: 18 }}>
            <button
              className={`rg-btn rg-btn-primary ${audioFinished ? 'rg-btn-highlight' : ''}`}
              disabled={!audioFinished}
              onClick={() => { startSession(); setScreen('game'); setCurrentKey('sampleA'); }}
            >
              ▶ Start Now
            </button>
            <button className="rg-btn rg-btn-secondary"
              onClick={() => { if (audioRef.current) { setAudioFinished(false); audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); } }}>
              ↺ Replay Audio
            </button>
          </div>
          <p className="rg-splash-hint">
            The audio plays automatically. Once it ends, the <span className="rg-accent-text">Start Now</span> button activates.<br/>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>(If audio doesn't start, please click <b>↺ Replay Audio</b>)</span>
          </p>
        </div>
      </div>
      <audio ref={audioRef} src={`${AUDIO_PATH}/splash.wav`} preload="auto"
        onEnded={() => setAudioFinished(true)} onError={() => setAudioFinished(true)} />
    </div>
  );

  // ── Game ──────────────────────────────────────────────────────
  const renderGame = () => {
    const q = QUESTIONS[currentKey];
    if (!q) return null;
    const isRotatable = (src) => ['triangle-up','triangle-down','right-triangle','diamond'].includes(src.shape);
    const limit = TIMER_LIMITS[currentKey] || 0;

    return (
      <div className="rg-screen">
        {/* Header */}
        <div className="rg-screen-header">
          <div className="rg-header-left">
            <div className="rg-screen-title">{getQuestionTitle(currentKey)}</div>
          </div>
          <div className="rg-header-right">
            <div className="rg-chips">
              <span className={`rg-chip rg-chip-${q.type}`}>
                {q.type.toUpperCase()}
              </span>
              <span className="rg-chip">{getQuestionCounter(currentKey)}</span>
              <div className="rg-timer blue-timer">
                <span className="timer-icon">⏱</span> Timer: 
                <span className={`rg-timer-val ${timerCls()}`}>
                  {limit === 0 ? '∞' : formatTimerDisplay(timeElapsed)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main row: Target + Workspace */}
        <div className="rg-game-main-row">
          <div className="rg-panel rg-target-panel">
            <div className="rg-panel-header">
              <span className="rg-panel-title">Target Pattern</span>
              <span className="rg-panel-hint">Build this</span>
            </div>
            <div className="rg-panel-content">
              <img
                src={`${IMAGE_PATH}/${getTargetImageName(currentKey)}.png`}
                alt="Target"
                className="rg-target-image"
                onError={e => { e.target.style.display='none'; }}
              />
            </div>
          </div>

          <div className="rg-panel rg-workspace-panel">
            <div className="rg-panel-header">
              <span className="rg-panel-title">Workspace</span>
              <span className="rg-panel-hint">
                {q.sources.some(s => isRotatable(s)) ? 'Drag shapes here · Double-click to rotate 90°' : 'Drag shapes here to build the pattern'}
              </span>
            </div>
            <div className="rg-panel-content" style={{ padding: 0, alignItems: 'stretch' }}>
              <div
                ref={workspaceRef}
                className="rg-workspace"
                onDragOver={onWorkspaceDragOver}
                onDragLeave={onWorkspaceDragLeave}
                onDrop={onWorkspaceDrop}
              >
                {workspaceItems.length === 0 && (
                  <div className="rg-workspace-placeholder">Drop shapes here to build the pattern</div>
                )}
                {workspaceItems.map((item) => {
                  const sz = SHAPE_SIZE_PX[item.size] || 100;
                  const rotatable = isRotatable(item);
                  return (
                    <div
                      key={item.id}
                      className="rg-workspace-item"
                      style={{ left: item.x, top: item.y, width: sz, height: sz }}
                      onMouseDown={e => onItemMouseDown(e, item)}
                      onDoubleClick={e => rotatable && onItemDblClick(e, item)}
                    >
                      <div className="rg-shape-wrapper" style={{ transform: `rotate(${item.rotation}deg)` }}>
                        <ShapeEl shape={item.shape} color={item.color} size={item.size} orientation={item.orientation} workspace />
                      </div>
                      <button className="rg-remove-btn" onClick={() => removeFromWorkspace(item.id)}>×</button>
                      {rotatable && (
                        <div className="rg-rotation-handle" onMouseDown={e => onRotHandleMouseDown(e, item)}>↻</div>
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
            <div className="rg-source-header">
              <span className="rg-source-title">Source Shapes</span>
              <span className="rg-source-hint">Drag to workspace</span>
            </div>
            <div className="rg-source-items">
              {q.sources.map((src, i) => {
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
                  <ShapeEl shape={src.shape} color={src.color} size={src.size} orientation={src.orientation} workspace={false} />
                  <div className="rg-source-label">{src.name} ({src.size})</div>
                </div>
              )})}
            </div>
          </div>

          <div className="rg-btn-panel">
            <button className="rg-btn rg-btn-primary" onClick={() => handleDone(false)}>✔ Done</button>
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
    const scoredEntries = Object.entries(questionScores);
    const totalAttempted = scoredEntries.length;
    const totalCorrect = scoredEntries.filter(([k, sc]) => sc > 0).length;
    const pct = Math.round((totalCorrect / TOTAL_Q) * 100) || 0;
    
    const totalTime = Object.values(questionTimes).reduce((a, b) => a + b, 0);
    const avgTime = totalAttempted ? Math.round(totalTime / totalAttempted) : 0;

    const BEHAVIORS = [
      'Difficulty sustaining attention', 'Impulsive or random responding', 'Negative reaction to correction',
      'Hesitation in responding', 'High focus or persistence', 'Verbalisation of a memory strategy',
      'Needed frequent reassurance', 'Calm and engaged throughout'
    ];

    return (
      <div className="rg-screen">
        <div className="rg-screen-header">
          <div>
            <div className="rg-screen-title">Assessment Complete</div>
            <div className="rg-screen-subtitle">Triangle Rachna — Final Results</div>
          </div>
          <div className="rg-chips">
            <span className="rg-chip rg-chip-complete">COMPLETE</span>
            <span className="rg-chip">Time: {Math.floor(totalTime/60)}m {totalTime%60}s</span>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* KPI Row */}
          <div className="rg-score-top">
            <div className="rg-score-dial-container">
              <div className="rg-score-dial-big">{totalCorrect}</div>
              <div className="rg-score-dial-small">/ {TOTAL_Q}</div>
            </div>
            <div className="rg-metric-grid">
              <div className="rg-metric-box"><label>Correct</label><div className="rg-metric-val green">{totalCorrect}</div></div>
              <div className="rg-metric-box"><label>Attempted</label><div className="rg-metric-val">{totalAttempted} / {TOTAL_Q}</div></div>
              <div className="rg-metric-box"><label>Percentage</label><div className="rg-metric-val amber">{pct}%</div></div>
              <div className="rg-metric-box"><label>Total Time</label><div className="rg-metric-val">{Math.floor(totalTime/60)}m {totalTime%60}s</div></div>
              <div className="rg-metric-box"><label>Avg Time/Q</label><div className="rg-metric-val">{avgTime}s</div></div>
              <div className="rg-metric-box"><label>Total Questions</label><div className="rg-metric-val">{TOTAL_Q}</div></div>
            </div>
          </div>

          {pct >= 80 && <div className="rg-banner">Outstanding performance! 🌟</div>}

          {/* Per-question detail */}
          <div className="rg-accordion-toggle" onClick={() => setShowGrid(g => !g)}>
            {showGrid ? '▼' : '▶'} Show per-question breakdown
          </div>

          {showGrid && (
            <div className="rg-q-grid">
              {scoredEntries.map(([key, sc]) => {
                const t = questionTimes[key] || 0;
                return (
                  <div className="rg-q-card" key={key}>
                    <div className="rg-q-top">
                      <span className="rg-q-num">{getQuestionTitle(key).replace('Question ','Q')}</span>
                      <span className="rg-q-time">{formatTimerDisplay(t)}</span>
                    </div>
                    <div className="rg-q-bottom">
                      <span className="rg-q-stars">{'★'.repeat(sc)}{'☆'.repeat(2-sc)}</span>
                      <span style={{ fontSize:'0.8rem', fontWeight:700, color: sc>0?'#059669':'#94a3b8',
                        background: sc>0?'#d1fae5':'#f1f5f9', borderRadius:'999px', padding:'2px 7px' }}>
                        {sc}/2
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Assessment Form */}
          <div className="rg-assessment-section">
            <h3 className="rg-form-title">Session Assessment Details</h3>

            {[
              {k:'q1',l:'Q1. Did you enjoy playing the game?'},
              {k:'q2',l:'Q2. How did the game feel for you?'},
              {k:'q3',l:'Q3. Did you feel tired while playing the game?'},
              {k:'q4',l:'Q4. Would you like to play the game again?'}
            ].map(({k,l}) => (
              <div key={k} className="rg-q-group">
                <label className="rg-q-label">{l}</label>
                <div className="rg-radio-row">
                  {['Yes, a lot','A little','Not much'].map(opt => (
                    <label key={opt} className="rg-radio-label">
                      <input type="radio" name={k} value={opt} disabled={assessmentSubmitted}
                        checked={assessment[k] === opt}
                        onChange={() => setAssessment(a => ({...a,[k]:opt}))} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="rg-q-group">
              <label className="rg-q-label">Q5. Observed Behaviours during the session (Multiple selection allowed)</label>
              <div className="rg-checkbox-grid">
                {BEHAVIORS.map(b => (
                  <label key={b} className="rg-checkbox-label">
                    <input type="checkbox" disabled={assessmentSubmitted}
                      checked={assessment.behaviors.includes(b)}
                      onChange={e => setAssessment(a => ({
                        ...a, behaviors: e.target.checked ? [...a.behaviors,b] : a.behaviors.filter(x=>x!==b)
                      }))} />
                    {b}
                  </label>
                ))}
              </div>
            </div>

            <div className="rg-q-group">
               <label className="rg-q-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span>Additional Notes</span>
                 <button 
                   onClick={() => toggleRecording('assessmentNotes')} 
                   style={{ 
                     background: isRecording && recordingTarget === 'assessmentNotes' ? '#fee2e2' : '#eff6ff',
                     color: isRecording && recordingTarget === 'assessmentNotes' ? '#ef4444' : '#2563eb',
                     border: '1px solid',
                     borderColor: isRecording && recordingTarget === 'assessmentNotes' ? '#fca5a5' : '#bfdbfe',
                     padding: '4px 10px', borderRadius: '999px', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                   }}>
                   🎙 {isRecording && recordingTarget === 'assessmentNotes' ? "Recording..." : "Use Mic"}
                 </button>
               </label>
               <textarea className="rg-textarea" rows={3} disabled={assessmentSubmitted}
                 placeholder="Type or dictate observations…" value={assessment.notes}
                 onChange={e => setAssessment(a => ({...a,notes:e.target.value}))} />
            </div>

            <div className="rg-final-actions">
              {assessmentSubmitted ? (
                <>
                  <button className="rg-btn rg-btn-primary"
                    onClick={() => { setScreen('splash'); setCurrentKey('sampleA'); setTotalScore(0); setQuestionScores({}); setQuestionTimes({}); setAssDone(false); setAssSub(false); setAssessment({q1:'',q2:'',q3:'',q4:'',behaviors:[],notes:''}); sessionIdRef.current=null; }}
                  >↻ Retest</button>
                  <button className="rg-btn rg-btn-secondary" onClick={() => navigate('/')}>🏠 Home</button>
                </>
              ) : (
                <button className="rg-btn rg-btn-primary" disabled={assessmentSubmitting} onClick={submitAssessment}>
                  {assessmentSubmitting ? 'Saving…' : 'Submit Assessment'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Quit modal ────────────────────────────────────────────────
  const renderQuitModal = () => (
    <div className="rg-modal-overlay">
      <div className="rg-modal">
        <h2>Pause or Quit</h2>
        <p>Why are you stopping? Your progress will be saved.</p>
        <div style={{ position: 'relative' }}>
          <textarea value={quitReason} onChange={e => setQuitReason(e.target.value)}
            placeholder="E.g. child is tired, disconnected…" style={{ width: '100%' }} />
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
        <div className="rg-modal-btns">
          <button className="rg-btn rg-btn-secondary" onClick={() => setShowQuitModal(false)}>↩ Continue</button>
          <button className="rg-btn rg-btn-danger" onClick={submitQuit}>⏹ Save & Exit</button>
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
    proceedToNext(finalScore);
  };

  const renderAssessmentModal = () => {
    const canSubmit = qAnswers.q1 !== null && qAnswers.q2 !== null && qAnswers.q3 !== null;
    return (
      <div className="rg-modal-overlay">
        <div className="rg-assessment-dialog">
          <div className="rg-ad-header">
            <h2 className="rg-ad-title">Assessment</h2>
            <p className="rg-ad-subtitle">Please answer all criteria:</p>
          </div>
          <div className="rg-ad-body">
            {/* Criteria 1 */}
            <div className={`rg-ad-card ${qAnswers.q1 ? 'answered' : ''}`}>
              <div className="rg-ad-question">
                 <div className="rg-ad-q-hi">1. दो त्रिभुज के बीच में 2 खानों से ज़्यादा का अंतर है।</div>
                 <div className="rg-ad-q-en">The gap between two triangles is more than 2 squares.</div>
              </div>
              <div className="rg-ad-actions">
                <button className={`rg-ad-btn ${qAnswers.q1==='yes'?'selected bad':''}`} onClick={()=>setQAnswers(p=>({...p,q1:'yes'}))}>Yes</button>
                <button className={`rg-ad-btn ${qAnswers.q1==='no'?'selected good':''}`} onClick={()=>setQAnswers(p=>({...p,q1:'no'}))}>No</button>
              </div>
            </div>
            {/* Criteria 2 */}
            <div className={`rg-ad-card ${qAnswers.q2 ? 'answered' : ''}`}>
              <div className="rg-ad-question">
                 <div className="rg-ad-q-hi">2. त्रिभुजों के बीच का संरेखण (alignment) में 2 खानों से ज़्यादा का अंतर है।</div>
                 <div className="rg-ad-q-en">The alignment between the triangles has a difference of more than 2 squares.</div>
              </div>
              <div className="rg-ad-actions">
                <button className={`rg-ad-btn ${qAnswers.q2==='yes'?'selected bad':''}`} onClick={()=>setQAnswers(p=>({...p,q2:'yes'}))}>Yes</button>
                <button className={`rg-ad-btn ${qAnswers.q2==='no'?'selected good':''}`} onClick={()=>setQAnswers(p=>({...p,q2:'no'}))}>No</button>
              </div>
            </div>
            {/* Criteria 3 */}
            <div className={`rg-ad-card ${qAnswers.q3 ? 'answered' : ''}`}>
              <div className="rg-ad-question">
                 <div className="rg-ad-q-hi">3. बच्चे द्वारा बनाया हुआ आकर प्रेरक रूपरेखा से मेल खाता है।</div>
                 <div className="rg-ad-q-en">The shape created by the child matches the reference figure.</div>
              </div>
              <div className="rg-ad-actions">
                <button className={`rg-ad-btn ${qAnswers.q3==='yes'?'selected good':''}`} onClick={()=>setQAnswers(p=>({...p,q3:'yes'}))}>Yes</button>
                <button className={`rg-ad-btn ${qAnswers.q3==='no'?'selected bad orange':''}`} onClick={()=>setQAnswers(p=>({...p,q3:'no'}))}>No</button>
              </div>
            </div>
          </div>
          <div className="rg-ad-footer">
            <button className={`rg-ad-submit-btn ${canSubmit ? 'active' : ''}`} disabled={!canSubmit} onClick={submitQuestionModal}>
              Finish Assessment
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────
  if (screen === 'loading') return <div className="rg-root"><div className="rg-loading">Loading…</div></div>;

  return (
    <div className="rg-root">
      <div className="rg-app">
        {/* Topbar */}
        <header className="rg-topbar">
          <div className="rg-brand">
            <div className="rg-brand-icon">△</div>
            <span>Triangle Game — Rachna</span>
          </div>
          <div className="rg-topbar-right">
            {childData && (
              <>
                <div className="rg-stat-pill"><span className="rg-stat-label">Child:</span><span className="rg-stat-value">{childData.child_id}</span></div>
                <div className="rg-stat-pill"><span className="rg-stat-label">Score:</span><span className="rg-stat-value">{totalScore}</span></div>
              </>
            )}
            {screen === 'game' && <button className="rg-top-quit-btn" onClick={() => setShowQuitModal(true)}>Pause/Quit</button>}
          </div>
        </header>

        {/* Main content */}
        <main className="rg-main">
          {screen === 'splash' && renderSplash()}
          {screen === 'game'   && renderGame()}
          {screen === 'score'  && renderScore()}
        </main>
      </div>

      {showQuitModal && renderQuitModal()}
      {showAssessmentModal && renderAssessmentModal()}
    </div>
  );
};

export default TriangleRachnaGame;
