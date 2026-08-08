// ============================================================
// rachnaQuestions.js — Rachna's question catalogue
// Extracted verbatim from TriangleRachnaGame.jsx so the admin
// Elements editor (RachnaElements.jsx) reads the exact same
// question keys/order/defaults as the live game — single source
// of truth, avoids the two ever drifting apart.
//
// This is the hardcoded STRUCTURE (order, type, timers, scoring) —
// per the "don't change flow/logic/scoring" requirement, none of
// this becomes admin-editable. Only a question's `sources` array
// (and optionally its target image) can be overridden per-question
// via test_elements.config, layered on top of these defaults.
// ============================================================

export const getTargetImageName = (key) => {
  if (key === 'sampleA') return 'sample_a';
  if (key === 'sampleB') return 'sample_b';
  if (key.startsWith('teachingQ')) return key.replace('teachingQ', 'teaching_question');
  if (key === 'question11') return 'teaching_question11';
  if (key === 'question12') return 'teaching_question12';
  return key;
};

export const TIMER_LIMITS = {
  sampleA:0, teachingQ1:0, teachingQ2:0,
  question3:90, question4:90, teachingQ5:0,
  question6:135, question7:135, question8:150, question9:150, question10:150,
  question11:150, question12:150, sampleB:0,
  question13:300, question14:300, question15:300, question16:300, question17:300,
  question18:300, question19:300, question20:300, question21:300, question22:300,
  question23:300, question24:300, question25:300, question26:300, question27:300,
};

export const SCORED_QUESTIONS = [
  'question3','question4','question6','question7','question8','question9','question10',
  'question11','question12','question13','question14','question15','question16','question17',
  'question18','question19','question20','question21','question22','question23','question24',
  'question25','question26','question27',
];

export const MAX_SCORE = SCORED_QUESTIONS.length * 2; // 48

// ─── Question catalogue ───────────────────────────────────────
export const QUESTIONS = {
  sampleA:    { type:'sample',   title:'Sample A',          next:'teachingQ1', isSample:true,
    sources:[{id:'rc-lg',name:'Red Circle',size:'large',color:'#e74c3c',shape:'circle'},
             {id:'yc-sm',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'}]},

  teachingQ1: { type:'teaching', title:'Teaching Question 1', next:'teachingQ2', isSample:true,
    sources:[{id:'bs-lg',name:'Blue Square',size:'large',color:'#2471a3',shape:'square'},
             {id:'rc-lg2',name:'Red Circle',size:'large',color:'#e74c3c',shape:'circle'},
             {id:'ys-sm',name:'Yellow Square',size:'small',color:'#f1c40f',shape:'square'}]},

  teachingQ2: { type:'teaching', title:'Teaching Question 2', next:'question3', isSample:true,
    sources:[{id:'rc-lg3',name:'Red Circle',size:'large',color:'#e74c3c',shape:'circle'},
             {id:'rc-sm',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'},
             {id:'yc-sm2',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'}]},

  question3:  { type:'question', title:'Question 3',  next:'question4', isSample:false,
    sources:[{id:'bs-lg4',name:'Blue Square',size:'large',color:'#2471a3',shape:'square'},
             {id:'rc-lg4',name:'Red Circle',size:'large',color:'#e74c3c',shape:'circle'},
             {id:'bs-sm4',name:'Blue Square',size:'small',color:'#2471a3',shape:'square'},
             {id:'ys-sm4',name:'Yellow Square',size:'small',color:'#f1c40f',shape:'square'}]},

  question4:  { type:'question', title:'Question 4',  next:'teachingQ5', isSample:false,
    sources:[{id:'bs-lg5',name:'Blue Square',size:'large',color:'#2471a3',shape:'square'},
             {id:'bs-sm5',name:'Blue Square',size:'small',color:'#2471a3',shape:'square'},
             {id:'rc-sm5',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'},
             {id:'yc-sm5',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'}]},

  teachingQ5: { type:'teaching', title:'Teaching Question 5', next:'question6', isSample:true,
    sources:[{id:'yt-lg6',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'triangle-up', scale:1.21},
             {id:'bs-lg6',name:'Blue Square',size:'large',color:'#2471a3',shape:'square', scale:0.9}]},

  question6:  { type:'question', title:'Question 6',  next:'question7', isSample:false,
    sources:[{id:'bs-lg7a',name:'Blue Square',size:'large',color:'#2471a3',shape:'square'},
             {id:'bs-lg7b',name:'Blue Square',size:'large',color:'#2471a3',shape:'square'},
             {id:'bs-sm7',name:'Blue Square',size:'small',color:'#2471a3',shape:'square'},
             {id:'ys-sm7',name:'Yellow Square',size:'small',color:'#f1c40f',shape:'square'}]},

  question7:  { type:'question', title:'Question 7',  next:'question8', isSample:false,
    sources:[{id:'yt-lg8',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'triangle-down'},
             {id:'yt-sm8',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'triangle-down', scale:1.3},
             {id:'rc-sm8',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'}]},

  question8:  { type:'question', title:'Question 8',  next:'question9', isSample:false,
    sources:[{id:'bs-lg9',name:'Blue Square',size:'large',color:'#2471a3',shape:'square', scale:1.0},
             {id:'yc-sm9a',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'},
             {id:'yc-sm9b',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'},
             {id:'rc-sm9a',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'},
             {id:'rc-sm9b',name:'Red Circle',size:'small',color:'#e74c3c',shape:'circle'}]},

  question9:  { type:'question', title:'Question 9',  next:'question10', isSample:false,
    sources:[{id:'bs-lg10a',name:'Blue Square',size:'large',color:'#2471a3',shape:'square'},
             {id:'bs-lg10b',name:'Blue Square',size:'large',color:'#2471a3',shape:'square'},
             {id:'rt-lg10a',name:'Red Triangle',size:'large',color:'#e74c3c',shape:'triangle-up'},
             {id:'rt-lg10b',name:'Red Triangle',size:'large',color:'#e74c3c',shape:'triangle-up'},
             {id:'yc-sm10',name:'Yellow Circle',size:'small',color:'#f1c40f',shape:'circle'}]},

  question10: { type:'question', title:'Question 10', next:'sampleB', isSample:false,
    sources:[{id:'bs-lg11',name:'Blue Square',size:'large',color:'#2471a3',shape:'square'},
             {id:'yt-lg11',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'triangle-up'},
             {id:'ys-sm11',name:'Yellow Square',size:'small',color:'#f1c40f',shape:'diamond'}]},

  sampleB:    { type:'sample',   title:'Sample B', next:'question11', isSample:true,
    sources:[{id:'yrt-lg-s',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt-lg-s',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question11: { type:'question', title:'Question 11', next:'question12', isSample:false,
    sources:[{id:'yrt-a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt-b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'}]},

  question12: { type:'question', title:'Question 12', next:'question13', isSample:false,
    sources:[{id:'brt-a',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt-b',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question13: { type:'question', title:'Question 13', next:'question14', isSample:false,
    sources:[{id:'yrt13',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt13',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question14: { type:'question', title:'Question 14', next:'question15', isSample:false,
    sources:[{id:'yrt14a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt14b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt14',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question15: { type:'question', title:'Question 15', next:'question16', isSample:false,
    sources:[{id:'yrt15',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt15a',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt15b',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question16: { type:'question', title:'Question 16', next:'question17', isSample:false,
    sources:[{id:'yrt16',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt16a',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt16b',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt16c',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question17: { type:'question', title:'Question 17', next:'question18', isSample:false,
    sources:[{id:'yrt17a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt17b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt17a',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt17b',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question18: { type:'question', title:'Question 18', next:'question19', isSample:false,
    sources:[{id:'yrt18a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt18b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt18a',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt18b',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question19: { type:'question', title:'Question 19', next:'question20', isSample:false,
    sources:[{id:'yrt19a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt19b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt19a',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt19b',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question20: { type:'question', title:'Question 20', next:'question21', isSample:false,
    sources:[{id:'yrt20a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt20b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt20a',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt20b',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question21: { type:'question', title:'Question 21', next:'question22', isSample:false,
    sources:[{id:'yrt21a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt21b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt21c',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt21',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question22: { type:'question', title:'Question 22', next:'question23', isSample:false,
    sources:[{id:'yrt22a',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt22b',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt22c',name:'Yellow Triangle',size:'large',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt22',name:'Blue Triangle',size:'large',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question23: { type:'question', title:'Question 23', next:'question24', isSample:false,
    sources:[{id:'yrt23a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt23b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt23c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt23d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt23a',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt23b',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt23c',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt23d',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question24: { type:'question', title:'Question 24', next:'question25', isSample:false,
    sources:[{id:'yrt24a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt24b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt24c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt24d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt24a',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt24b',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt24c',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt24d',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question25: { type:'question', title:'Question 25', next:'question26', isSample:false,
    sources:[{id:'yrt25a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25e',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25f',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt25g',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt25a',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt25b',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question26: { type:'question', title:'Question 26', next:'question27', isSample:false,
    sources:[{id:'yrt26a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26e',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt26f',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt26a',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt26b',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt26c',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},

  question27: { type:'question', title:'Question 27 (Final)', next:null, isSample:false,
    sources:[{id:'yrt27a',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt27b',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt27c',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'yrt27d',name:'Yellow Triangle',size:'small',color:'#f1c40f',shape:'right-triangle',orientation:'BL'},
             {id:'brt27a',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt27b',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt27c',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'},
             {id:'brt27d',name:'Blue Triangle',size:'small',color:'#2471a3',shape:'right-triangle',orientation:'BL'}]},
};

export const QUESTION_ORDER = [
  'sampleA','teachingQ1','teachingQ2','question3','question4','teachingQ5',
  'question6','question7','question8','question9','question10',
  'sampleB','question11','question12',
  'question13','question14','question15','question16','question17','question18',
  'question19','question20','question21','question22','question23','question24',
  'question25','question26','question27',
];

export const TEXTURED_QS = new Set(QUESTION_ORDER.slice(QUESTION_ORDER.indexOf('sampleB')));
export const SAMPLE_QS = QUESTION_ORDER.filter(k => QUESTIONS[k].type === 'sample');
export const TEACHING_QS = QUESTION_ORDER.filter(k => QUESTIONS[k].type === 'teaching');
export const ORIGINAL_QS = QUESTION_ORDER.filter(k => QUESTIONS[k].type === 'question');

export const getQuestionCounter = (key) => {
  const type = QUESTIONS[key].type;
  if (type === 'sample') return `${SAMPLE_QS.indexOf(key) + 1}/${SAMPLE_QS.length}`;
  if (type === 'teaching') return `${TEACHING_QS.indexOf(key) + 1}/${TEACHING_QS.length}`;
  return `${ORIGINAL_QS.indexOf(key) + 1}/${ORIGINAL_QS.length}`;
};

export const getQuestionTitle = (key) => {
  if (!key || !QUESTIONS[key]) return '';
  const { type, isSample } = QUESTIONS[key];
  if (type === 'sample') return `Sample ${String.fromCharCode(65 + SAMPLE_QS.indexOf(key))}`;
  if (type === 'teaching') return `Teaching Item ${TEACHING_QS.indexOf(key) + 1}`;
  return `Item ${ORIGINAL_QS.indexOf(key) + 1}`;
};
