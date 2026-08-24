const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join(__dirname, '..', '..', 'translations');
const SETTINGS_FILE = path.join(TRANSLATIONS_DIR, 'language-settings.json');

const translationFilePath = (code) => path.join(TRANSLATIONS_DIR, `${code}.json`);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

const getLanguageSettings = () => readJson(SETTINGS_FILE);

const saveLanguageSettings = (settings) => writeJson(SETTINGS_FILE, settings);

const getLanguageCodes = () => getLanguageSettings().languages.map((l) => l.code);

const getTranslations = (code) => {
    const filePath = translationFilePath(code);
    if (!fs.existsSync(filePath)) return {};
    return readJson(filePath);
};

const saveTranslations = (code, data) => writeJson(translationFilePath(code), data);

// Flattens a nested object into dot-path leaves, e.g. { a: { b: 'x' } } -> { 'a.b': 'x' }
const flatten = (obj, prefix = '', out = {}) => {
    for (const [key, value] of Object.entries(obj)) {
        const path_ = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, path_, out);
        } else {
            out[path_] = value;
        }
    }
    return out;
};

const getValueAtPath = (obj, dotPath) => {
    const keys = dotPath.split('.');
    let cur = obj;
    for (const key of keys) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[key];
    }
    return cur;
};

const setValueAtPath = (obj, dotPath, value) => {
    const keys = dotPath.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
        cur = cur[key];
    }
    cur[keys[keys.length - 1]] = value;
};

// The "game" namespace is shared by 9 game components. Most keys are genuinely shared
// (pause/resume, score-table headers, the Q1-Q5 end-of-session survey, etc.), but a subset
// is only ever read by one specific game — determined by grepping each game .jsx file for
// its t('game.X') calls. Those go into a per-game section; everything else stays under
// "Games - Common" rather than being guessed at. This only affects how rows are grouped in
// the admin grid — the underlying game.* keys and t() lookups are untouched.
const GAME_KEY_TO_ID = {
    // Bagiya (AtlantisBagiyaGame.jsx)
    allAnswered: 'bagiya', answer: 'bagiya', childChoseHeader: 'bagiya', exactLabel: 'bagiya',
    nextScreenArrow: 'bagiya', partialLabel: 'bagiya', practiceQuestion: 'bagiya', practiceResponse: 'bagiya',
    ptsLabel: 'bagiya', responseLabel: 'bagiya', screenHeader: 'bagiya', screensLabel: 'bagiya',
    startMainGame: 'bagiya', statusCorrect: 'bagiya', statusPartial: 'bagiya', statusWrong: 'bagiya',
    subQHeader: 'bagiya', subQuestion: 'bagiya', targetHeader: 'bagiya', tryAgain: 'bagiya',
    wrongLabel: 'bagiya', welcomeBagiya: 'bagiya', reply: 'bagiya', nextScreen: 'bagiya',
    // Lottery Ka Ticket / Number Recall (NumberRecallGame.jsx)
    audioAutoPlay: 'lottery', avgQMetric: 'lottery', correctFeedback: 'lottery', correctMetric: 'lottery',
    incorrectMetric: 'lottery', listenRemember: 'lottery', listeningLabel: 'lottery', pleaseWaitAudio: 'lottery',
    qNumHeader: 'lottery', replayBtn: 'lottery', replaysHeader: 'lottery', sampleLabel: 'lottery',
    selectNumbers: 'lottery', selectionComplete: 'lottery', startMainQuestions: 'lottery', stoppedMsg: 'lottery',
    testCompleted: 'lottery', yourResponse: 'lottery', welcomeLottery: 'lottery', outstandingLottery: 'lottery',
    outstandingMemory: 'lottery',
    // Chalo Mela Chalen (ChaloMelaChaleGame.jsx)
    assessorExit: 'mela', destinationNotAchieved: 'mela', droppedSubtitle: 'mela', extraNotes: 'mela',
    q1Label: 'mela', q2Label: 'mela', q3Label: 'mela', q4Label: 'mela', q5Label: 'mela',
    questionEndedMoves: 'mela', questionsLabel: 'mela', refreshBtn: 'mela', requiredStar: 'mela',
    retakeBtn: 'mela', sampleALabel: 'mela', sampleBLabel: 'mela', sessionDetails: 'mela',
    targetedMoves: 'mela', teachingQ3Label: 'mela', teachingQ4Label: 'mela', timeTakenLabel: 'mela',
    timeoutDestination: 'mela', trialLabel: 'mela', userMoves: 'mela', welcomeMela: 'mela',
    // Rachna (TriangleRachnaGame.jsx)
    finalResults: 'rachna', timer: 'rachna', targetPattern: 'rachna', buildThis: 'rachna',
    workspaceLabel: 'rachna', dropShapes: 'rachna', sourceShapes: 'rachna', dragToWorkspace: 'rachna',
    welcomeRachna: 'rachna', outstandingRachna: 'rachna', assessmentTitle: 'rachna',
    'triangleCriteria.q1': 'rachna', 'triangleCriteria.q2': 'rachna', 'triangleCriteria.q3': 'rachna',
    // Dhyan Kahan Hai (AuditoryAttentionGame.jsx)
    sampleQuestionA: 'dhyan', welcomeDhyan: 'dhyan',
    // Her Pher (HerPherGame.jsx)
    sampleQuestionLabel: 'herpher', practiceLabel: 'herpher', welcomeHerPher: 'herpher',
    // Chor Machaye Shor (ChorMachayeShorGame.jsx)
    correctFeedbackChor: 'chor', foundPattern: 'chor', incorrectFeedbackChor: 'chor',
    phase1Complete: 'chor', trial2Label: 'chor', welcomeChor: 'chor',
    restartTrial: 'chor', dictateReason: 'chor',
    // Ankganit / Numeracy (NumberSkillGame.jsx)
    allQuestionsCompleted: 'numeracy', correct: 'numeracy', incorrect: 'numeracy', quotient: 'numeracy',
    remainder: 'numeracy', submitAnswer: 'numeracy', numeracyLabel: 'numeracy', welcome: 'numeracy',
    performance: 'numeracy', performanceLabel: 'numeracy', totalScore: 'numeracy', outstanding: 'numeracy',
    'categories.singleNumber': 'numeracy', 'categories.doubleNumber': 'numeracy',
    'categories.subtraction': 'numeracy', 'categories.division': 'numeracy',
    catSingle: 'numeracy', catDouble: 'numeracy', catSub: 'numeracy', catDiv: 'numeracy', category: 'numeracy',
    // Padh ke Batao / Literacy (ReadingSkillGame.jsx)
    allCriteriaMet: 'literacy', assessmentLabel: 'literacy', assessorStopped: 'literacy',
    'categories.doubleLetter': 'literacy', 'categories.paragraph': 'literacy', 'categories.sentence': 'literacy',
    'categories.singleLetter': 'literacy', 'categories.story': 'literacy', doneReading: 'literacy',
    droppedChip: 'literacy', finishAssessment: 'literacy', noLabel: 'literacy', questionNo: 'literacy',
    questionType: 'literacy', ssrQuestion: 'literacy', userAnswer: 'literacy', yesLabel: 'literacy',
    welcomeLiteracy: 'literacy', 'readingCriteria.skipWords': 'literacy', 'readingCriteria.pronunciation': 'literacy',
    'readingCriteria.neededHelp': 'literacy',
};

const GAME_SECTION_LABELS = {
    game_bagiya: 'Bagiya', game_lottery: 'Lottery Ka Ticket', game_mela: 'Chalo Mela Chalen',
    game_rachna: 'Rachna', game_dhyan: 'Dhyan Kahan Hai', game_herpher: 'Her Pher',
    game_chor: 'Chor Machaye Shor', game_numeracy: 'Ankganit - V0 (Numeracy)', game_literacy: 'Padh ke Batao (Literacy)',
    game_common: 'Games - Common',
};

const sectionForKey = (dotPath) => {
    const [top, ...rest] = dotPath.split('.');
    if (top !== 'game') return top;
    const leaf = rest.join('.');
    const gameId = GAME_KEY_TO_ID[leaf];
    return gameId ? `game_${gameId}` : 'game_common';
};

// Builds the admin grid: one row per leaf key, with each enabled+all language's current value,
// grouped into a "section" (see sectionForKey above for how the shared "game" namespace is split).
const buildGrid = ({ section, search } = {}) => {
    const languages = getLanguageSettings().languages;
    const baseLang = languages[0]?.code || 'english';
    const baseTranslations = getTranslations(baseLang);
    const leafKeys = Object.keys(flatten(baseTranslations));

    const perLanguageData = {};
    for (const lang of languages) {
        perLanguageData[lang.code] = getTranslations(lang.code);
    }

    let rows = leafKeys.map((key) => {
        const values = {};
        for (const lang of languages) {
            values[lang.code] = getValueAtPath(perLanguageData[lang.code], key);
        }
        return { key, section: sectionForKey(key), values };
    });

    if (section) {
        rows = rows.filter((row) => row.section === section);
    }
    if (search) {
        const needle = search.toLowerCase();
        rows = rows.filter((row) => {
            if (row.key.toLowerCase().includes(needle)) return true;
            return Object.values(row.values).some(
                (val) => typeof val === 'string' && val.toLowerCase().includes(needle)
            );
        });
    }

    return rows;
};

const getSections = () => {
    const baseLang = getLanguageSettings().languages[0]?.code || 'english';
    const leafKeys = Object.keys(flatten(getTranslations(baseLang)));
    return [...new Set(leafKeys.map(sectionForKey))];
};

const getSectionLabel = (section) => GAME_SECTION_LABELS[section] || null;

const updateCell = (code, key, value) => {
    const data = getTranslations(code);
    setValueAtPath(data, key, value);
    saveTranslations(code, data);
};

module.exports = {
    getLanguageSettings,
    saveLanguageSettings,
    getLanguageCodes,
    getTranslations,
    saveTranslations,
    buildGrid,
    getSections,
    getSectionLabel,
    updateCell,
};
