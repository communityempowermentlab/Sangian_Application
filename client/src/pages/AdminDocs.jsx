import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { API_URL } from '../services/api';

// ─── Design tokens (matches AdminDashboard.css) ───────────────────────────────
const T = {
    bg:        '#f6f7fb',
    white:     '#ffffff',
    text:      '#0f172a',
    muted:     '#64748b',
    faint:     '#94a3b8',
    border:    'rgba(229,231,235,0.95)',
    borderSoft:'rgba(229,231,235,0.7)',
    accent:    '#4f46e5',
    accentBg:  'rgba(79,70,229,0.07)',
    accentBd:  'rgba(79,70,229,0.22)',
    accentText:'#3730a3',
    shadow:    '0 1px 4px rgba(15,23,42,0.07), 0 4px 12px rgba(15,23,42,0.04)',
    shadowMd:  '0 4px 16px rgba(15,23,42,0.08)',
    shadowLg:  '0 8px 28px rgba(15,23,42,0.11)',
    radius:    '14px',
    font:      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial',
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const GAME_CATALOG = [
    { key: 'atlantis_bagiya',        icon: '🧠', title: 'Bagiya',             color: '#6366f1', image: '/assets/images/bagiya/bagiya.jpg' },
    { key: 'number_recall_lottery',  icon: '🎟️', title: 'Lottery Ka Ticket',  color: '#f59e0b', image: '/assets/images/lottery_ka_ticket/lottery_ka_ticket.jpg' },
    { key: 'number_recall_lottery_v2',  icon: '🎟️', title: 'Lottery Ka Ticket - Version 2',  color: '#f59e0b', image: '/assets/images/lottery_ka_ticket_V2/lottery_ka_ticket.jpg' },
    { key: 'rover_mela',             icon: '🗺️', title: 'Chalo Mela Chalen',  color: '#10b981', image: '/assets/images/chalo_mela_chale/chalo_mela_chale.jpg' },
    { key: 'auditory_dhyan',         icon: '👂', title: 'Dhyan Kahan Hai',    color: '#8b5cf6', image: '/assets/images/dhyan_kahan_hai/dhyan_kahan_hai.jpg' },
    { key: 'working_memory_herpher', icon: '🔄', title: 'Her Pher',           color: '#0891b2', image: '/assets/images/her_pher/her_pher.jpg' },
    { key: 'numeracy_number_skill',  icon: '🔢', title: 'Ankganit',           color: '#4f46e5', image: '/assets/images/number_skill/number_skill.jpg' },
    { key: 'literacy_reading_skill', icon: '📖', title: 'Padh ke batao',      color: '#059669', image: '/assets/images/reading_skill/reading_skill.jpg' },
    { key: 'cognitive_flex_chor',    icon: '⚡', title: 'Chor Machaye Shor',  color: '#dc2626', image: '/assets/images/chor_machaye_shor/chor_machaye_shor.jpg' },
    { key: 'triangle_rachna',        icon: '🔺', title: 'Rachna',             color: '#e11d48', image: '/assets/images/rachna/rachna.jpg' },
];

const GAME_SECTIONS = [
    { key: 'introduction',       icon: '📖', label: 'Introduction',                  available: true  },
    { key: 'technical_docs_2013',icon: '📜', label: 'Technical Documentation 2013',  available: true,  legacy: true  },
    { key: 'technical_docs',     icon: '⚙️', label: 'Technical Documentation',       available: true  },
    { key: 'gameplay_manual',    icon: '📋', label: 'Gameplay Manual',               available: true  },
    { key: 'workflow_diagram',   icon: '🔀', label: 'Workflow Diagram',               available: true  },
    { key: 'screenshots',        icon: '🖼️', label: 'Screenshot Library',            available: true  },
    { key: 'audio_logic',        icon: '🔊', label: 'Audio & Sound Logic',            available: true  },
    { key: 'score_logic',        icon: '🏆', label: 'Score Logic',                   available: true  },
    { key: 'cutoff_calc',        icon: '📊', label: 'Cutoff Calculation',              available: true  },
    { key: 'assessment',         icon: '🧪', label: 'Assessment Behavior',            available: true  },
    { key: 'api_integration',    icon: '🔗', label: 'API / Backend Logic',            available: true  },
    { key: 'database_flow',      icon: '🗄️', label: 'Data Flow',                      available: true  },
    { key: 'reports',            icon: '📈', label: 'Reports & Analysis',             available: true  },
];

const SEC_H = 38; // px per accordion section row

// ─── Bilingual Introduction Defaults ─────────────────────────────────────────

const HINDI_FONT = "'Hind', 'Noto Sans Devanagari', sans-serif";

const GAME_INTRO_DEFAULTS = {
    atlantis_bagiya: {
        en: {
            skill:       'Long-term Memory & Information Retrieval',
            objective:   'This test measures long-term storage and retrieval of information learned earlier in the testing session.',
            description: 'In this activity, children explore and remember different objects, patterns, or information shown during the session. Later, they are encouraged to recall and recognize what they learned earlier. This helps assess memory retention and long-term recall ability in an engaging and playful manner.',
            guidance:    'Look carefully at everything shown to you. Remember the names and details — you will be asked about them later!',
        },
        hi: {
            skill:       'दीर्घकालिक स्मृति और जानकारी पुनःप्राप्ति',
            objective:   'इस टेस्ट का उद्देश्य यह समझना है कि बच्चा टेस्ट के दौरान पहले सीखी गई जानकारी को कुछ समय बाद कितनी अच्छी तरह याद रख पाता है और आवश्यकता पड़ने पर उसे सही तरीके से दोबारा बता या पहचान पाता है।',
            description: 'इस गतिविधि में बच्चों को टेस्ट के दौरान दिखाई गई जानकारी, वस्तुओं या पैटर्न को याद रखना होता है। कुछ समय बाद बच्चे से उन चीज़ों को पहचानने या याद करने के लिए कहा जाता है। यह गतिविधि बच्चे की याद रखने और बाद में सही जानकारी को दोबारा पहचानने की क्षमता को समझने में मदद करती है।',
            guidance:    'ध्यान से देखो और जो दिखाया जाए उसे अच्छी तरह याद करो। बाद में जब पूछा जाए तो अपनी पूरी कोशिश करो!',
        },
    },
    number_recall_lottery: {
        en: {
            skill:       'Sequential Processing & Short-term Auditory Memory',
            objective:   'This test measures sequential processing and short-term memory within the auditory-vocal modality. In this test, the assessor says a series of numbers, and the child repeats them in the same sequence.',
            description: 'Listen carefully and remember the numbers in the correct order. This activity checks how well children can hear, remember, and repeat information step by step.',
            guidance:    'Listen carefully to the numbers. Then repeat them in the same order. Ready? Let\'s go!',
        },
        hi: {
            skill:       'क्रमबद्ध प्रसंस्करण और अल्पकालिक श्रवण स्मृति',
            objective:   'यह टेस्ट बच्चे की क्रमबद्ध रूप से सुनी गई जानकारी को समझने और थोड़े समय तक याद रखकर उसी क्रम में दोहराने की क्षमता का आकलन करता है।',
            description: 'इस गतिविधि में बच्चे को ध्यान से संख्याएँ सुनकर उन्हें उसी क्रम में दोहराना होता है। यह बच्चे की सुनने, याद रखने और सही क्रम बनाए रखने की क्षमता को समझने में मदद करता है।',
            guidance:    'ध्यान से संख्याएँ सुनो और फिर उन्हें उसी क्रम में दोहराओ। तैयार हो? चलो शुरू करते हैं!',
        },
    },
    number_recall_lottery_v2: {
        en: {
            skill:       'Sequential Processing & Short-term Auditory Memory (Reverse)',
            objective:   'This test measures sequential processing and short-term memory within the auditory-vocal modality. In this test, the assessor says a series of numbers, and the child repeats them in the reverse sequence.',
            description: 'Listen carefully and remember the numbers. Then repeat them backwards. This activity checks how well children can hear, remember, and reverse information.',
            guidance:    'Listen carefully to the numbers. Then repeat them in reverse order. Ready? Let\'s go!',
        },
        hi: {
            skill:       'क्रमबद्ध प्रसंस्करण और अल्पकालिक श्रवण स्मृति (विपरीत क्रम)',
            objective:   'यह टेस्ट बच्चे की सुनी गई जानकारी को समझने और थोड़े समय तक याद रखकर विपरीत क्रम में दोहराने की क्षमता का आकलन करता है।',
            description: 'इस गतिविधि में बच्चे को ध्यान से संख्याएँ सुनकर उन्हें उल्टे क्रम में दोहराना होता है। यह बच्चे की सुनने, याद रखने और सही क्रम को उलटने की क्षमता को समझने में मदद करता है।',
            guidance:    'ध्यान से संख्याएँ सुनो और फिर उन्हें उल्टे क्रम में दोहराओ। तैयार हो? चलो शुरू करते हैं!',
        },
    },
    rover_mela: {
        en: {
            skill:       'Visual Processing & Spatial Decision-Making',
            objective:   'It measures simultaneous or visual processing that requires decision-making to identify the shortest route to a goal.',
            description: 'Help Baby reach the mela using the shortest possible path. This Test encourages smart thinking, planning, and visual problem-solving skills.',
            guidance:    'Look at the paths carefully and think before you choose. Which is the shortest way to reach the mela?',
        },
        hi: {
            skill:       'देखकर सोचना और सही रास्ता चुनना',
            objective:   'इस टेस्ट में बच्चा तस्वीर देखकर समझता है और मेले तक जाने का सबसे छोटा रास्ता चुनता है।',
            description: 'इस खेल में बच्चे को सबसे छोटे रास्ते से मेले तक पहुँचाना होता है। यह सोचने, रास्ते देखने और सही चुनाव करने की क्षमता को समझने में मदद करता है।',
            guidance:    'रास्तों को ध्यान से देखो और सोचकर चुनो। मेले तक जाने का सबसे छोटा रास्ता कौन सा है?',
        },
    },
    auditory_dhyan: {
        en: {
            skill:       'Auditory Attention & Sustained Focus',
            objective:   'This test assesses how well the child listens to vocally presented words, sustains attention during fixed pauses, and accurately identifies the corresponding object within the given time.',
            description: 'Carefully listen to the spoken words and quickly identify the correct object. This game helps measure focus, listening ability, and sustained attention.',
            guidance:    'Listen carefully to what is said and quickly point to or choose the right object. Stay focused!',
        },
        hi: {
            skill:       'श्रवण ध्यान और निरंतर एकाग्रता',
            objective:   'इस टेस्ट का उद्देश्य बच्चे की बोले गए शब्दों को ध्यानपूर्वक सुनने, निश्चित अंतराल के दौरान ध्यान बनाए रखने, और निर्धारित समय में संबंधित वस्तु को सही ढंग से पहचानने की क्षमता का आकलन करना है।',
            description: 'इस गतिविधि में बच्चे को बोले गए शब्दों को ध्यान से सुनकर सही वस्तु पहचाननी होती है। यह बच्चे की एकाग्रता, ध्यान और सुनने की क्षमता का आकलन करता है।',
            guidance:    'ध्यान से सुनो और जल्दी से सही वस्तु चुनो। एकाग्र रहो!',
        },
    },
    working_memory_herpher: {
        en: {
            skill:       'Working Memory & Mental Processing',
            objective:   'This test assesses the child\'s ability to temporarily hold information in mind, mentally work with it, and respond accurately without losing track of the task.',
            description: 'Remember the information, think carefully, and respond correctly. This activity checks how well children can manage and use information in their mind while completing a task.',
            guidance:    'Remember what you see or hear. Think about it carefully. Then give your answer!',
        },
        hi: {
            skill:       'कार्यशील स्मृति और मानसिक प्रसंस्करण',
            objective:   'इस टेस्ट का उद्देश्य बच्चे की जानकारी को थोड़े समय के लिए मन में रखने, उस पर मानसिक रूप से काम करने, और कार्य पर ध्यान बनाए रखते हुए सही प्रतिक्रिया देने की क्षमता का आकलन करना है।',
            description: 'इस गतिविधि में बच्चे को जानकारी को याद रखते हुए उस पर सोचकर सही उत्तर देना होता है। यह बच्चे की कार्यशील स्मृति और मानसिक ध्यान बनाए रखने की क्षमता को समझने में मदद करता है।',
            guidance:    'जो देखो या सुनो उसे याद करो। ध्यान से सोचो। फिर अपना उत्तर दो!',
        },
    },
    numeracy_number_skill: {
        en: {
            skill:       'Foundational Numeracy & Mathematical Reasoning',
            objective:   'This test assesses the child\'s foundational numeracy-related academic ability, including number recognition, understanding of basic arithmetic concepts, and solving simple arithmetic problems.',
            description: 'Let\'s explore numbers, counting, and simple calculations in a fun way. This activity helps understand how comfortably children work with numbers and basic maths concepts.',
            guidance:    'Look at the numbers and questions carefully. Think and give your best answer. You\'re great at maths!',
        },
        hi: {
            skill:       'बुनियादी संख्या ज्ञान और गणितीय तर्क',
            objective:   'इस Test का उद्देश्य बच्चे की बुनियादी गणितीय क्षमता का आकलन करना है।',
            description: 'इस गतिविधि में बच्चे संख्याओं की पहचान, गिनती और सरल गणितीय सवालों को हल करते हैं। इससे बच्चे की बुनियादी गणितीय समझ का आकलन किया जाता है।',
            guidance:    'संख्याओं और सवालों को ध्यान से देखो। सोचो और अपना सर्वश्रेष्ठ उत्तर दो। तुम गणित में बहुत अच्छे हो!',
        },
    },
    literacy_reading_skill: {
        en: {
            skill:       'Foundational Literacy & Reading Comprehension',
            objective:   'This test assesses the child\'s foundational literacy-related academic ability, particularly letter recognition, word reading, and reading simple connected text with understanding.',
            description: 'Read letters, words, and simple sentences carefully. This activity helps evaluate reading ability, understanding, and language development.',
            guidance:    'Look carefully and read what you see. Take your time. You are a wonderful reader!',
        },
        hi: {
            skill:       'बुनियादी साक्षरता और पठन कौशल',
            objective:   'इस टेस्ट का उद्देश्य बच्चे की बुनियादी पढ़ने की क्षमता का आकलन करना है।',
            description: 'इस गतिविधि में बच्चे अक्षरों, शब्दों और छोटे वाक्यों को पढ़ते हैं। यह बच्चे की पढ़ने और समझने की क्षमता को जानने में मदद करता है।',
            guidance:    'ध्यान से देखो और जो दिखे उसे पढ़ो। जल्दी मत करो। तुम एक अच्छे पाठक हो!',
        },
    },
    cognitive_flex_chor: {
        en: {
            skill:       'Cognitive Flexibility & Adaptive Thinking',
            objective:   'This test assesses cognitive flexibility, which means the child\'s ability to quickly shift attention, adapt to changing rules, and respond accurately in changing situations.',
            description: 'Be alert and ready to adapt! In this activity, rules and situations may change quickly, and the child must respond carefully and accurately. This helps measure flexible thinking and adaptive problem-solving skills.',
            guidance:    'Pay close attention! The rules might change. Stay alert and respond quickly and correctly!',
        },
        hi: {
            skill:       'संज्ञानात्मक लचीलापन और अनुकूली सोच',
            objective:   'यह टेस्ट बच्चे की बदलती परिस्थितियों और नियमों के अनुसार जल्दी सोचने, ध्यान बदलने और सही प्रतिक्रिया देने की क्षमता का आकलन करता है।',
            description: 'इस गतिविधि में बच्चे को बदलते नियमों और परिस्थितियों के अनुसार जल्दी प्रतिक्रिया देनी होती है। यह बच्चे की सोच में लचीलापन, ध्यान बदलने और सही निर्णय लेने की क्षमता को समझने में मदद करता है।',
            guidance:    'ध्यान रखो! नियम बदल सकते हैं। सतर्क रहो और जल्दी तथा सही प्रतिक्रिया दो!',
        },
    },
    triangle_rachna: {
        en: {
            skill:       'Visual Construction & Spatial Reasoning',
            objective:   'This test assesses the child\'s visual construction ability and understanding of spatial relationships.',
            description: 'Observe the model carefully and arrange the shapes correctly. This activity helps understand how children recognize patterns, shapes, and spatial relationships.',
            guidance:    'Look at the model carefully. Try to arrange the shapes just like you see. You can do it!',
        },
        hi: {
            skill:       'दृश्य निर्माण और स्थानिक तर्क',
            objective:   'यह टेस्ट यह देखने में मदद करता है कि बच्चा दिए गए चित्र या नमूने को देखकर अलग-अलग आकार और रंगों वाली आकृतियों को सही जगह और सही दिशा में व्यवस्थित कर पाता है या नहीं।',
            description: 'इस गतिविधि में बच्चे को दिए गए चित्र के अनुसार आकृतियों को सही तरीके से व्यवस्थित करना होता है। यह बच्चे की आकृति पहचानने, दिशा समझने और संरचना बनाने की क्षमता का आकलन करता है।',
            guidance:    'नमूने को ध्यान से देखो। आकृतियों को वैसे ही व्यवस्थित करने की कोशिश करो जैसा दिखाया गया है। तुम यह कर सकते हो!',
        },
    },
};

// ─── Default content ──────────────────────────────────────────────────────────

const NUMERACY_DEFAULT = `# 📦 Numeracy Test – Documentation

## Overview
The Numeracy Test is an academic assessment module that evaluates a child's mathematical ability across four progressive categories.

---

## Categories & Questions

| # | Category | Questions | Scoring | Min Correct |
|---|---|---|---|---|
| 1 | Single Number | Q1–Q10 | Manual (oral) | 4 |
| 2 | Double Number | Q11–Q20 | Manual (oral) | 4 |
| 3 | Subtraction | Q21–Q24 | Auto (written) | 2 |
| 4 | Division | Q25–Q26 | Auto (written) | 1 |

**Total Questions: 26**

---

## Stop Rules
1. **3 Consecutive Wrong Answers** → Test stops immediately.
2. **Category Minimum Not Met** → If a child doesn't meet the minimum correct answers by the end of a category, the test stops.

---

## Game Flow
1. **Splash Screen** – Background audio plays; Start Now button activates after audio ends.
2. **Game Screen** – Questions presented one at a time with per-question timer.
3. **Manual Questions (Cat 1 & 2)** – Assessor marks Correct / Incorrect based on verbal response.
4. **Auto Questions (Cat 3 & 4)** – Child enters answer on-screen via number pad; system auto-scores.
5. **Score Screen** – Final results, performance grid, and behavioral assessment form.

---

## Scoring Logic

### Manual Scoring (Single / Double)
\`\`\`
Assessor clicks [✓ Correct] → score = 1
Assessor clicks [✗ Incorrect] → score = 0
\`\`\`

### Auto Scoring – Subtraction
\`\`\`
if (userAnswer === correctAnswer) → score = 1
else → score = 0
\`\`\`

### Auto Scoring – Division
\`\`\`
if (userQuotient === correctAnswer && userRemainder === correctRemainder) → score = 1
else → score = 0
\`\`\`

---

## Pause & Resume
- **Pause & Save** – Saves current question index, scores, and timer state to the server.
- **Quit & End** – Ends the session permanently.

---

*Last updated by system on first load.*
`;

const LITERACY_DEFAULT = `# 📖 Padh ke batao – Documentation

## Overview
The Padh ke batao test evaluates reading and language skills across progressive categories.

---

## Categories & Questions

| # | Category | Questions | Scoring | Min Correct |
|---|---|---|---|---|
| 1 | Single Letter | Q1–Q10 | Manual (oral) | 4 |
| 2 | Double Letter | Q11–Q18 | Manual (oral) | 4 |
| 3 | Sentence      | Q19–Q20 | Manual (oral) | - |
| 4 | Story         | Q21     | Assessor Modal | - |
| 5 | Paragraph     | Q22     | Assessor Modal | - |

**Total Questions: 22**

---

## Stop Rules
1. **Category 1 Minimum Not Met** → Less than 4 correct on Single Letters → test drops.
2. **Category 2 Minimum Not Met** → Less than 4 correct on Double Letters → test drops.
3. **Assessment Drop** → Score 0 on mid-test reading assessment → test stops.

---

## Pause & Resume
- **Pause** – Game resumes from same point on next visit.
- **Quit** – Session ends; next start begins from scratch.

---

*Last updated by system on first load.*
`;

// ─── Score Logic template (from real NumberSkillGame.jsx CONFIG & processScoring) ──

const makeScoreLogicTemplate = (game) => `# 🏆 ${game.title} — Score Logic

---

## 1. Overview

This document explains how the scoring system works for **${game.title}** — what actions earn a score, how scores are recorded per question, and how the final score is calculated. It is written for SSL teams, researchers, assessors, QA testers, and developers.

---

## 2. Score Unit

Each question in **${game.title}** is scored as a **binary value**:

\`\`\`
Correct response   → score = 1
Incorrect response → score = 0
\`\`\`

There is **no partial credit**, negative marking, or bonus scoring. Every question is worth exactly 1 point.

---

## 3. Scoring Methods

### Manual Scoring (Assessor-Controlled)
Used when the child responds verbally. The assessor observes the response and clicks the appropriate button:

\`\`\`
Assessor clicks [✓ Correct]   → score = 1
Assessor clicks [✗ Incorrect] → score = 0
\`\`\`

The score is immediately recorded with the time taken for that question.

### Automatic Scoring (System-Controlled)
Used when the child types a numeric answer using the on-screen number pad:

\`\`\`
Standard answer:
  if (childAnswer === correctAnswer) → score = 1
  else → score = 0

Division answer (quotient + remainder):
  if (childQuotient === correctQuotient AND childRemainder === correctRemainder) → score = 1
  else → score = 0
\`\`\`

---

## 4. Per-Question Score Record

Every answered question produces a score record containing:

\`\`\`json
{
  "qId": 1,
  "questionNumber": 1,
  "score": 1,
  "timeTaken": 4
}
\`\`\`

| Field | Description |
|---|---|
| \`qId\` | Question identifier |
| \`questionNumber\` | Sequential position in the game |
| \`score\` | 1 = correct, 0 = incorrect |
| \`timeTaken\` | Seconds taken to respond |

All records are stored in the session's \`saved_state.allScores\` array.

---

## 5. Final Score Calculation

\`\`\`
Total Score = count of all records where score === 1
\`\`\`

This is updated after every question and saved to the \`game_sessions.score\` column.

**Example:**

| Question | Score |
|---|---|
| Q1 | 1 |
| Q2 | 0 |
| Q3 | 1 |
| Q4 | 1 |
| Q5 | 0 |
| **Total** | **3** |

---

## 6. Score Display

On the final score screen, the system displays:

| Metric | Calculation |
|---|---|
| Total Score | correct answers |
| Incorrect | attempted − correct |
| Percentage | (correct ÷ total questions) × 100 |
| Total Time | sum of all \`timeTaken\` values |
| Average Time per Question | total time ÷ questions attempted |

---

## 7. Score and Stop Rules Interaction

The score after each question is also checked against stop rules. If a stop condition is triggered, the game ends and the current total is saved as the final score.

See the **Cutoff Calculation** section for stop rule details.

---

## 8. Score Persistence

Score is saved to the server:
- After every question during active play (\`status: 'in_progress'\`)
- At game end (\`status: 'completed'\`, \`'quit'\`, or \`'dropped'\`)

The score column in \`game_sessions\` always reflects the most recent saved value.

---

## 9. What Does NOT Affect Score

- Time taken (no speed bonus or time penalty)
- Number of pauses
- Replay count of audio/instructions
- Whether the game was resumed from a saved state

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Cutoff Calculation template (from CONFIG.MIN_CORRECT and processScoring stop rules) ──

const makeCutoffTemplate = (game) => `# 📊 ${game.title} — Cutoff Calculation

---

## 1. What Is a Cutoff?

A **cutoff** is the minimum number of correct answers a child must achieve in a specific category or stage of the game to continue to the next section. If the child's performance falls below the cutoff, the game stops automatically.

Cutoffs exist to protect assessment validity — continuing with advanced questions when foundational categories are not passed would produce meaningless results.

---

## 2. Cutoff Types

**${game.title}** uses two types of stop rules:

### Type 1 — Consecutive Wrong Answer Rule

\`\`\`
If the child gives 3 incorrect answers in a row (back-to-back),
the game stops immediately regardless of category.

Consecutive wrong count resets to 0 after any correct answer.
\`\`\`

### Type 2 — Category Minimum Rule

At the end of each category, the system checks whether the child met the minimum correct answers for that category:

\`\`\`
If correct answers in category < minimum required
→ Game stops (status = 'dropped')
\`\`\`

---

## 3. Category Structure and Cutoff Values

*[Fill in the exact category structure and cutoff values for ${game.title} here based on game config]*

Example format (update with actual values):

| Category | Questions | Min Correct | Max Wrong | Stop Trigger |
|---|---|---|---|---|
| Category 1 | Q1–Q10 | 4 | 3 consecutive | End of category OR 3 consecutive wrong |
| Category 2 | Q11–Q20 | 4 | 3 consecutive | End of category OR 3 consecutive wrong |
| Category 3 | Q21–Q24 | 2 | 3 consecutive | End of category OR 3 consecutive wrong |
| Category 4 | Q25–Q26 | 1 | 3 consecutive | End of category OR 3 consecutive wrong |

---

## 4. How Cutoff Is Checked (Logic Flow)

\`\`\`
After each question is scored:

Step 1 — Count consecutive wrong answers (from the end of allScores)
  If consecutive >= 3 → STOP (3 Consecutive Wrong)

Step 2 — Check if this question is the last in a category
  If yes → Count correct answers in that category
    If correct < minimum → STOP (Category Minimum Not Met)

Step 3 — If no stop condition triggered → Move to next question
\`\`\`

---

## 5. What Happens When a Cutoff Is Triggered

\`\`\`
Stop condition triggered
       ↓
Game transitions to Score Screen
       ↓
Session updated with status = 'completed'
(even though not all questions were attempted)
       ↓
Scores up to that point are saved
       ↓
Assessment form appears for assessor to complete
       ↓
PDF report generated
\`\`\`

The stop reason is **not** stored in \`quit_reason\` — it is implied by the \`progress_level\` (question reached) being less than the total question count.

---

## 6. Impact on Reports

In the admin Reports section, a dropped session will show:
- \`status = 'completed'\`
- \`attempted_questions < total_questions\`
- \`score\` reflecting only the questions that were answered

This is expected behavior — the child simply did not reach the remaining questions.

---

## 7. Why These Cutoffs?

The cutoff values are designed based on:
- The assessment framework established in the original SANGIAN 2013 platform
- Cognitive progression logic (foundational skills must be demonstrated before advanced skills)
- Statistical validity — a child passing by chance should not proceed

Any changes to cutoff values require updating both the frontend game config AND this documentation.

---

## 8. Cutoff vs. Quit

| Condition | Status | Who triggers |
|---|---|---|
| Cutoff rule met | \`completed\` | System automatic |
| Assessor ends early | \`quit\` | Assessor manual |
| Resume → abandoned | \`paused\` | Assessor decision |

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Assessment Behavior template (from SessionAssessmentForm.jsx actual values) ──

const makeAssessmentTemplate = (game) => `# 🧪 ${game.title} — Assessment Behavior

---

## 1. Overview

This document explains how **${game.title}** measures and records behavioral observations during and after the assessment session. It covers what cognitive behaviors are tracked, how the assessor records observations, how the data is stored, and how it contributes to the final assessment report.

---

## 2. What Is Being Measured

**${game.title}** is not just a game — it is a structured cognitive assessment tool. Beyond the question scores, the system tracks:

- **Accuracy** — whether the child gives correct responses
- **Speed** — how long the child takes to respond (per question)
- **Consistency** — whether the child maintains performance across categories
- **Behavioral observations** — assessor-recorded qualitative observations about how the child engaged

---

## 3. Behavioral Assessment Form

After every game session (whether completed, quit, or dropped), the assessor fills in a structured **Session Details Form** before the assessment is finalized.

### Assessment Questions

| # | Question | Response Options |
|---|---|---|
| Q1 | Did the child enjoy playing the game? | Yes, a lot / A little / Not much |
| Q2 | How did the game feel for the child? | Yes, a lot / A little / Not much |
| Q3 | Did the child feel tired while playing? | Yes, a lot / A little / Not much |
| Q4 | Would the child like to play the game again? | Yes, a lot / A little / Not much |

All 4 questions are **required** — the form cannot be submitted without selecting a response for each.

### Behavioral Observation Checkboxes (Q5)

The assessor selects all behaviors observed during the session:

\`\`\`
☐ Difficulty sustaining attention
☐ Impulsive or random responding
☐ Negative reaction to correction
☐ Hesitation in responding
☐ High focus or persistence
☐ Verbalisation of a memory strategy (e.g., naming aloud, grouping)
☐ Needed frequent reassurance
☐ Calm and engaged throughout
\`\`\`

Multiple behaviors can be selected. None is required.

### Additional Notes

A free-text field where the assessor can dictate or type any additional qualitative observations not covered by the checkboxes.

**Voice input** is supported — the assessor can use the microphone button to dictate notes directly.

---

## 4. Validation Rules

\`\`\`
Q1, Q2, Q3, Q4 → Required (must be selected before submission)
Q5 behaviors   → Optional (can submit with 0 selected)
Additional notes → Optional (can be empty)
\`\`\`

If any required field is missing, the form highlights the missing field and prevents submission.

---

## 5. Assessment Submission Flow

\`\`\`
Assessor fills in Q1–Q4 (required)
Assessor optionally checks behavioral observations
Assessor optionally adds notes
Assessor clicks "Submit Assessment"
       ↓
Client validates all required fields
       ↓
POST /api/games/assessments
       ↓
Data stored in game_assessments table
       ↓
Dashboard PDF auto-generated and uploaded
       ↓
"Retest" and "Home" buttons appear
\`\`\`

---

## 6. Database Storage

\`\`\`
Table: game_assessments

session_id        → Links to the game session
child_id          → Child who was assessed
q1_enjoyment      → Q1 response
q2_feeling        → Q2 response
q3_tiredness      → Q3 response
q4_play_again     → Q4 response
q5_behaviors      → JSON array of selected behavior strings
additional_notes  → Free text notes
created_at        → When the assessment was submitted
\`\`\`

---

## 7. Pending Assessment Detection

If the child completes or quits a game but the assessor does not submit the form before navigating away, the system detects this on the next visit.

\`\`\`
System checks: sessions with status IN ('completed', 'quit', 'dropped')
               where NO assessment record exists

If found → Shows a prompt to the assessor to complete the form
\`\`\`

This ensures no session is left without a behavioral assessment.

---

## 8. Assessment in Reports

In the Admin Reports panel, every session record shows the assessment responses alongside the question scores. The reports include:

- Q1–Q4 responses
- Q5 behavioral observations (comma-separated)
- Additional notes
- Whether the assessment was submitted or is pending

---

## 9. Assessment Integrity

- The assessment form is **disabled** after submission — responses cannot be changed
- The session status does not change when the assessment is submitted (score/status are independent)
- Assessment data is linked to the session by \`session_id\` and \`child_id\`

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Data Flow template (from saveToServer, generateAndUploadPDF, full API sequence) ──

const makeDataFlowTemplate = (game) => `# 🗄️ ${game.title} — Data Flow

---

## 1. Overview

This document explains how data moves through the **${game.title}** system — from the moment the child starts the game to the moment the administrator views the final report. It is written in simple language for all teams, with technical detail available in expandable sections.

---

## 2. Complete Data Journey

\`\`\`
Child Logs In (Device)
       ↓
Game Loads → Browser checks for saved session
       ↓
Session Created on Server → Database record written
       ↓
Child Answers Questions → Score saved after each answer
       ↓
Game Ends → Final session status written
       ↓
Assessor Submits Form → Behavioral data saved
       ↓
PDF Generated → Dashboard exported and uploaded
       ↓
Admin Views Report → Data read from all three tables
\`\`\`

---

## 3. Stage-by-Stage Breakdown

### Stage 1 — Game Load (Resume Check)

When the game screen opens, the first action is a resume check:

\`\`\`
GET /api/games/sessions/resume/:childId/${game.key}

Purpose: Check if the child has an unfinished session
Result:
  → Session found (status: paused) → Show "Resume" popup
  → No session found              → Show Splash screen
\`\`\`

**Data involved:** child_id, game_name, saved_state (if resuming)

---

### Stage 2 — Session Start

When the child clicks "Start Now":

\`\`\`
POST /api/games/sessions/start

Sends: child_id, game_name, total_questions
Receives: sessionId, attempt_no

Database: New row written in game_sessions
  status = 'in_progress'
  start_time = NOW()
  score = 0
\`\`\`

If an active session already exists, the server returns the existing session ID (no duplicate created).

---

### Stage 3 — During Gameplay (Auto-Save)

After every question is answered, the complete game state is synced to the server:

\`\`\`
PUT /api/games/sessions/update/:sessionId

Sends:
  score         → correct answers so far
  progress_level → current question number
  status        → 'in_progress'
  saved_state   → full JSON snapshot:
    {
      questionIndex: 7,
      allScores: [
        { qId: 1, score: 1, timeTaken: 4 },
        { qId: 2, score: 0, timeTaken: 8 },
        ...
      ],
      timerSeconds: 124,
      pauses: []
    }
\`\`\`

This ensures that if the device loses connectivity or the browser closes, the session can be resumed from the last saved question.

---

### Stage 4 — Pause / Quit

If the assessor pauses or quits the session:

\`\`\`
Pause:
  PUT /api/games/sessions/update/:sessionId
  status = 'paused'
  saved_state includes pause event with timestamp

Quit:
  PUT /api/games/sessions/update/:sessionId
  status = 'quit'
  quit_reason = assessor-entered reason
  end_time = NOW()
\`\`\`

---

### Stage 5 — Game End (Stop Rule or Completion)

When the game ends (all questions done or stop rule triggered):

\`\`\`
PUT /api/games/sessions/update/:sessionId
  status = 'completed'
  score = final correct answer count
  progress_level = last question reached
  end_time = NOW()
  saved_state = final snapshot
\`\`\`

**Terminal status guard**: Once \`quit\` or \`dropped\`, the server will never overwrite to \`completed\`.

---

### Stage 6 — Behavioral Assessment Submission

After the score screen appears, the assessor fills in the observation form:

\`\`\`
POST /api/games/assessments

Sends:
  session_id, child_id
  q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again
  q5_behaviors (JSON array)
  additional_notes

Database: New row in game_assessments linked to session
\`\`\`

---

### Stage 7 — PDF Generation and Upload

Immediately after assessment submission (or game end), the system generates a PDF of the score dashboard:

\`\`\`
1. Score screen is rendered to a canvas (html2canvas)
2. Canvas is converted to a JPEG image
3. Image is embedded in an A4 PDF (jsPDF)
4. PDF blob is uploaded:

POST /api/games/pdfs/upload
  Sends: PDF file, child_id, session_id, game_name
  Database: New row in game_dashboard_pdfs with file path
\`\`\`

PDF filename format:
\`\`\`
[ChildName]_${game.title}_SES[sessionId]_[timestamp].pdf
\`\`\`

---

### Stage 8 — Admin Report View

When the administrator opens the Reports module:

\`\`\`
GET /api/games/reports/detail/${game.key}

Server joins data from:
  game_sessions       → score, status, timing, saved_state
  children            → child_name
  game_assessments    → behavioral observations
  game_dashboard_pdfs → PDF download link

Parses saved_state JSON to extract per-question scores
Returns enriched session records with:
  correct_count, attempted_questions, actual_game_time,
  total_session_time, question_scores, assessment, pdf_url
\`\`\`

---

## 4. Database Tables in This Flow

| Table | Written At | Contains |
|---|---|---|
| \`game_sessions\` | Stage 2, 3, 4, 5 | Session lifecycle, scores, saved state |
| \`game_assessments\` | Stage 6 | Behavioral form responses |
| \`game_dashboard_pdfs\` | Stage 7 | PDF file paths |

---

## 5. Data Security

- Child game routes: session-based (child must be logged in)
- Admin report routes: JWT Bearer token required (role: admin)
- PDFs stored server-side in \`/dashboard_pdfs/\` — not publicly accessible
- All data transmission via HTTPS

---

## 6. Offline Behavior

If the internet connection drops during gameplay:
- The game continues running locally in the browser
- API save calls fail silently (error logged to console)
- On next successful question, the save is attempted again with accumulated state
- At game end, the final update is retried before showing the score screen

---

## 7. Data Lifecycle Summary

\`\`\`
Game Start    → game_sessions row created
During Play   → game_sessions updated (score + saved_state)
Game End      → game_sessions finalized (status + end_time)
Assessment    → game_assessments row created
PDF Export    → game_dashboard_pdfs row created
Admin Report  → All three tables joined and returned
\`\`\`

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Technical Documentation (Dynamic) template — master game reference ─────────

const makeTechDocTemplate = (game) => `# ⚙️ ${game.title} — Technical Documentation

> **Dynamic Technical Documentation** — This document covers the complete technical architecture of **${game.title}**: screen flow, gameplay mechanics, session management, scoring, stop rules, assessment, PDF generation, audio system, and API integration.

---

## 1. Game Identity

| Property | Value |
|---|---|
| Internal Key | \`${game.key}\` |
| Display Title | ${game.title} |
| Assessment Type | Cognitive / Academic |
| Platform | SANGIAN Web Application (2026) |
| Technology | React.js (Frontend) · Node.js + MySQL (Backend) |

---

## 2. Screen Architecture

The game has three main screens that the user moves through sequentially:

\`\`\`
[Splash Screen]
  Audio plays automatically on load
  "Start Now" button activates only after audio completes
  "Replay Audio" button available
       ↓
[Game Screen]
  Questions displayed one at a time
  Per-question timer runs
  Manual or Auto scoring based on question type
  Pause/Quit button always accessible
       ↓
[Score Screen]
  Final score displayed
  Per-question results table
  Behavioral assessment form
  Retest / Home options
\`\`\`

---

## 3. Game Configuration

Core game constants are defined in a \`CONFIG\` object at the top of the game file:

\`\`\`
MAX_CONSECUTIVE_WRONG  — How many wrong answers in a row trigger a game stop
MIN_CORRECT            — Minimum correct answers required per category
QUESTION_COUNT         — Number of questions per category
CATEGORY               — Category ID mapping
\`\`\`

*[Refer to the game source file for exact numeric values specific to ${game.title}.]*

See **Score Logic** and **Cutoff Calculation** sections for how these values are applied.

---

## 4. Gameplay Mechanics

### Question Delivery
- Questions are stored in a static \`QUESTIONS\` array in the frontend
- Each question has: \`qid\`, \`questionCategory\`, \`text\`, \`correctAnswer\`, \`type\`
- Questions are served one at a time via \`questionIndex\` state
- Moving to the next question resets the per-question timer

### Scoring Types

**Manual Scoring** (assessor-controlled):
\`\`\`
Assessor observes child's verbal response
Assessor clicks [✓ Correct] or [✗ Incorrect]
Score recorded: 1 or 0
\`\`\`

**Automatic Scoring** (system-controlled):
\`\`\`
Child types answer on on-screen number pad
System compares input to correctAnswer
Score recorded: 1 (match) or 0 (no match)
Division questions require both quotient AND remainder to match
\`\`\`

### Timers
- **Global timer** (\`timerSeconds\`): counts total session seconds during active play
- **Per-question timer** (\`qTimer\`): resets to 0 on each new question; value saved with each score record
- Both timers pause when the Quit modal is open
- Both timers are included in \`saved_state\` for resume

---

## 5. Session State Management

### Resume Flow
\`\`\`
On game load:
  GET /api/games/sessions/resume/:childId/${game.key}

  If paused session found → Show "Resume" modal with options:
    [Resume]         → Restore questionIndex, allScores, timers from saved_state
    [Start Fresh]    → Reset all state, create new session

  If no session found → Show Splash screen normally
\`\`\`

### State Saved to Server
The complete game state saved after every question:
\`\`\`json
{
  "questionIndex": 7,
  "allScores": [
    { "qId": 1, "score": 1, "timeTaken": 4 },
    { "qId": 2, "score": 0, "timeTaken": 8 }
  ],
  "timerSeconds": 124,
  "qTimer": 0,
  "pauses": [
    {
      "questionNumber": 5,
      "reason": "Child requested break",
      "timestamp": "2026-03-15T10:22:00Z"
    }
  ]
}
\`\`\`

### Pause and Quit
\`\`\`
Pause → status = 'paused', pause event appended to pauses array, navigate to home
Quit  → status = 'quit', quit_reason saved, show Score screen
\`\`\`
The Quit modal requires a reason to be entered before confirming. Voice dictation is supported for the reason field.

---

## 6. Stop Rules (Drop Logic)

After every question is scored, two stop conditions are checked:

**Rule 1 — 3 Consecutive Wrong Answers**
\`\`\`
Count backwards through allScores
If last 3 scores are all 0 → STOP
\`\`\`

**Rule 2 — Category Minimum Not Met**
\`\`\`
Checked only at the end of each category
If correct_in_category < MIN_CORRECT[category] → STOP
\`\`\`

When either rule triggers:
- Screen transitions to Score Screen
- Session status set to \`'completed'\`
- The score at the point of stopping is the final score

---

## 7. Score Calculation

\`\`\`
After each question:
  newScoreRecord = { qId, questionNumber, score, timeTaken }
  allScores = [...previousScores, newScoreRecord]

Final score = allScores.filter(s => s.score === 1).length

Saved to server immediately via:
  PUT /api/games/sessions/update/:sessionId
  { score: totalCorrect, progress_level: questionIndex + 1, ... }
\`\`\`

See **Score Logic** section for full detail.

---

## 8. Assessment Form Integration

After the score screen appears, the \`SessionAssessmentForm\` component renders:

\`\`\`
4 required observation questions (radio buttons — required)
1 behavioral checklist (8 checkboxes — optional)
1 additional notes field with voice input support
\`\`\`

Submission calls:
\`\`\`
POST /api/games/assessments
{ session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness,
  q4_play_again, q5_behaviors[], additional_notes }
\`\`\`

The form is **disabled** after submission. Form validation prevents submission if any required question is empty.

See **Assessment Behavior** section for full behavior checklist and storage details.

---

## 9. PDF Dashboard Generation

After assessment submission (or at game end if quit), the system auto-generates a PDF:

\`\`\`
1. Force score table to render (showGrid = true)
2. Wait 500ms for DOM render
3. Capture .ns-main element with html2canvas (scale: 1.5)
4. Convert canvas to JPEG
5. Embed in A4 PDF via jsPDF
6. Upload to server:
   POST /api/games/pdfs/upload
   { pdf file, child_id, session_id, game_name }
\`\`\`

PDF filename:
\`\`\`
[ChildName]_${game.title}_SES[sessionId]_[timestamp].pdf
\`\`\`

---

## 10. Audio System

\`\`\`
Audio element: <audio ref={audioRef} src="/assets/audios/[game]/splash.wav" />

Behavior:
  - Plays automatically on splash screen load (if not checking session)
  - onEnded → sets audioFinished = true → enables Start Now button
  - onError → sets audioFinished = true (fail-safe, button still enabled)
  - "Replay Audio" button resets currentTime to 0 and replays
  - Audio does not play during game or score screen
\`\`\`

The "Start Now" button is **disabled** until audio finishes. This ensures the child hears the instructions before beginning.

---

## 11. API Integration Map

| Action | Method | Endpoint |
|---|---|---|
| Resume check | GET | \`/api/games/sessions/resume/:childId/${game.key}\` |
| Start session | POST | \`/api/games/sessions/start\` |
| Auto-save progress | PUT | \`/api/games/sessions/update/:sessionId\` |
| Submit assessment | POST | \`/api/games/assessments\` |
| Upload PDF | POST | \`/api/games/pdfs/upload\` |
| Fetch activity summary | GET | \`/api/games/sessions/summaries/:childId\` |

See **API / Backend Logic** section for full request/response structures.

---

## 12. Frontend State Variables

| State | Type | Purpose |
|---|---|---|
| \`screen\` | string | Current view: splash / game / score |
| \`questionIndex\` | number | Current question position |
| \`allScores\` | array | All scored question records |
| \`timerSeconds\` | number | Total session seconds elapsed |
| \`qTimer\` | number | Seconds on current question |
| \`gameSessionId\` | number | Server session ID |
| \`attemptNo\` | number | This child's attempt number |
| \`pauses\` | array | Pause events with timestamps |
| \`audioFinished\` | boolean | Controls Start Now button availability |
| \`showResumeModal\` | boolean | Resume prompt display |
| \`showQuitModal\` | boolean | Pause/Quit modal display |
| \`assessment\` | object | Behavioral form responses |

---

## 13. Error Handling

\`\`\`
Resume check fail    → Session check skipped, splash shown normally
Session start fail   → Alert shown, game proceeds locally (no server sync)
Progress save fail   → Error logged silently, game continues
Assessment fail      → Alert shown, assessor can retry
PDF upload fail      → Error logged, gameplay not affected
\`\`\`

All API errors are caught with try/catch. Gameplay is never blocked by a failed API call — the game always continues locally.

---

## 14. Speech-to-Text (Voice Input)

The game supports browser-native Speech Recognition in two places:
- **Quit reason** field in the Pause/Quit modal
- **Additional notes** field in the Assessment form

\`\`\`
Uses: window.SpeechRecognition || window.webkitSpeechRecognition
Language: en-US
Mode: continuous, interimResults: true
Fallback: Alert shown if browser does not support Speech Recognition
\`\`\`

---

## 15. Technical Notes

- The \`isStoppedRef\` kill-switch (if present) terminates the game engine from outside React state
- Audio autoplay is blocked by some browsers — the \`onError\` handler ensures the Start button is never permanently locked
- The game session deduplication check prevents ghost sessions when the child navigates back and forward
- PDF generation uses \`scale: 1.5\` for retina quality; the element captured is \`.ns-main\` (full score screen)
- All timestamps in \`saved_state\` are ISO 8601 strings

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── API & Backend Logic template (pre-populated with real SANGIAN API data) ──

const makeApiTemplate = (game) => `# 🔗 ${game.title} — API & Backend Logic

---

## 1. Game Overview

### Purpose
${game.title} is a cognitive assessment module within the SANGIAN platform. The backend is responsible for creating and managing every game session, capturing gameplay events, calculating scores, storing assessment observations, and generating reports for researchers and administrators.

### What the Backend Does
- Creates and tracks unique game sessions per child
- Saves gameplay progress and question-level scores in real time
- Applies terminal-status protection to prevent data corruption
- Stores assessor behavioral observations after each session
- Serves structured reports to the admin panel

---

## 2. Backend Workflow

### Simplified Flow (For All Users)

\`\`\`
Child Logs In
      ↓
Game Loads → Backend checks for a resumable session
      ↓
Session Created (or reused) → game_sessions table
      ↓
Gameplay Begins → Score and progress saved during play
      ↓
Game Ends → Final status written (completed / quit / dropped)
      ↓
Assessment Form → Assessor submits behavioral observations
      ↓
Reports Available → Admin views full session data & downloads PDF
\`\`\`

### What Happens at Each Step

1. **Game Load** — The system checks whether the child has a paused session from a previous visit. If found, a resume prompt appears.
2. **Session Start** — A unique session ID is created in the database. If an active session already exists, it is reused to prevent duplicates.
3. **During Play** — Score and the full game state (question results, timings, pause events) are periodically saved to the server.
4. **Game End** — The final status (\`completed\`, \`quit\`, or \`dropped\`) is recorded along with the end time.
5. **Assessment** — The assessor fills in a behavioral observation form. The data is linked to the session.
6. **Report** — Administrators can view the full session, per-question scores, assessment data, and download a PDF summary.

---

## 3. API Overview

### Why APIs Are Used
Every action in the game — starting a session, saving a score, submitting an assessment — communicates with the server through APIs. This ensures that no data is lost between the browser and the database.

### Base URL
\`\`\`
/api/games/
\`\`\`

### Authentication
| Route Type | Method |
|---|---|
| Child game routes | Session-based (child must be logged in) |
| Admin report routes | JWT Bearer token required (role: admin) |

---

## 4. API Reference List

| API Name | Method | Endpoint | Purpose | Triggered When |
|---|---|---|---|---|
| Start Session | POST | \`/api/games/sessions/start\` | Creates a new game session | Child clicks "Start Now" |
| Update Session | PUT | \`/api/games/sessions/update/:sessionId\` | Updates score, status, saved state | During gameplay / on game end |
| Resume Check | GET | \`/api/games/sessions/resume/:childId/:gameName\` | Finds the latest session to resume | On game load |
| Game History | GET | \`/api/games/sessions/history/:childId\` | Returns all sessions for a child | Child history panel |
| Game Summaries | GET | \`/api/games/sessions/summaries/:childId\` | Returns per-game summary | Home screen game list |
| Pending Assessment | GET | \`/api/games/sessions/pending-assessment/:childId\` | Finds sessions without an assessment | After game completion |
| Submit Assessment | POST | \`/api/games/assessments\` | Saves behavioral assessment form | Assessor submits form |
| Upload PDF | POST | \`/api/games/pdfs/upload\` | Stores dashboard PDF file | Dashboard export |
| Report Overview | GET | \`/api/games/reports/overview\` | KPI stats for all games (admin only) | Admin opens Reports tab |
| Report Detail | GET | \`/api/games/reports/detail/:gameName\` | Detailed session list for one game | Admin views game report |

---

## 5. Backend Logic (Simplified)

### Session Lifecycle

\`\`\`
A new session is created when the child starts the game.

If an active 'in_progress' session already exists for the same
child and game, the server returns the existing session ID
instead of creating a duplicate record.

During gameplay, the session is updated with:
  - Current score
  - Progress level (question number reached)
  - Saved state (full JSON snapshot of game data)

When the game ends:
  - Status → completed / quit / dropped
  - End time is recorded
  - Saved state is finalized
\`\`\`

### Terminal Status Protection

\`\`\`
Once a session is marked as 'quit' or 'dropped', the server
will never allow it to be overwritten as 'completed'.

This is a server-side safety guard against client-side bugs
that might accidentally send a 'completed' update after the
session has already been terminated.

Response: HTTP 200 with message 'Session already finalized — status preserved.'
\`\`\`

### Deduplication Logic

\`\`\`
If the child starts the same game while an 'in_progress'
session already exists, the server returns:
  - HTTP 200 (not 201)
  - The existing sessionId
  - The existing attempt_no
This prevents ghost sessions from accumulating in reports.
\`\`\`

---

## 6. Technical API Details

### Start Game Session

**Endpoint:** \`POST /api/games/sessions/start\`

**Request Body:**
\`\`\`json
{
  "child_id": "C001",
  "game_name": "${game.key}",
  "total_questions": 0
}
\`\`\`

**Response — New Session (HTTP 201):**
\`\`\`json
{
  "success": true,
  "message": "Game session started",
  "sessionId": 142,
  "attempt_no": 3
}
\`\`\`

**Response — Session Reused (HTTP 200):**
\`\`\`json
{
  "success": true,
  "message": "Active session reused",
  "sessionId": 138,
  "attempt_no": 3
}
\`\`\`

---

### Update Game Session

**Endpoint:** \`PUT /api/games/sessions/update/:sessionId\`

**Request Body:**
\`\`\`json
{
  "score": 8,
  "progress_level": 10,
  "status": "in_progress",
  "saved_state": {
    "allScores": [
      { "qId": 1, "score": 1, "timeTaken": 4.2 },
      { "qId": 2, "score": 0, "timeTaken": 8.1 }
    ],
    "pauses": [],
    "timerSeconds": 124
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Game session updated"
}
\`\`\`

**Supported Status Values:**
\`\`\`
in_progress  — Game is actively being played
paused       — Game is paused (resume popup will show on next visit)
completed    — Game finished normally (all questions done)
quit         — Assessor ended the session early
dropped      — Stop rules triggered automatically
\`\`\`

---

### Submit Assessment

**Endpoint:** \`POST /api/games/assessments\`

**Request Body:**
\`\`\`json
{
  "session_id": 142,
  "child_id": "C001",
  "q1_enjoyment": "Yes, a lot",
  "q2_feeling": "A little",
  "q3_tiredness": "Not much",
  "q4_play_again": "Yes, a lot",
  "q5_behaviors": [
    "High focus or persistence",
    "Calm and engaged throughout"
  ],
  "additional_notes": "Child completed all sections without assistance."
}
\`\`\`

---

### Resume Check

**Endpoint:** \`GET /api/games/sessions/resume/:childId/${game.key}\`

**Response (session found):**
\`\`\`json
{
  "success": true,
  "sessionInfo": {
    "id": 138,
    "child_id": "C001",
    "game_name": "${game.key}",
    "status": "paused",
    "score": 6,
    "progress_level": 8,
    "saved_state": { "allScores": [...], "pauses": [...] },
    "attempt_no": 2
  }
}
\`\`\`

**Response (no session):**
\`\`\`json
{
  "success": true,
  "sessionInfo": null
}
\`\`\`

---

## 7. Database Workflow

### Tables Used

| Table | Purpose |
|---|---|
| \`game_sessions\` | Every game attempt — score, status, saved state, timing |
| \`game_assessments\` | Behavioral observations submitted by the assessor |
| \`game_dashboard_pdfs\` | PDF files generated at end of session |

### game_sessions Schema

\`\`\`
id              INT      — Unique session identifier (auto-increment)
child_id        VARCHAR  — Links to the child who played
game_name       VARCHAR  — Internal game key (e.g. ${game.key})
start_time      DATETIME — When the session began
end_time        DATETIME — When the session ended (NULL if active)
score           INT      — Correct answers count
total_questions INT      — Total questions in this game
progress_level  INT      — Current question number reached
status          ENUM     — in_progress / completed / quit / paused / dropped
quit_reason     VARCHAR  — Reason for early termination (if any)
saved_state     JSON     — Full snapshot: allScores, pauses, timings
\`\`\`

### saved_state JSON Structure

\`\`\`json
{
  "allScores": [
    {
      "qId": 1,
      "score": 1,
      "timeTaken": 4.2,
      "moves": 1,
      "replayCount": 0
    }
  ],
  "pauses": [
    { "pausedAt": "2026-03-15T10:22:00Z", "resumedAt": "2026-03-15T10:24:00Z" }
  ],
  "timerSeconds": 312
}
\`\`\`

### Data Flow

\`\`\`
Session Starts  → Record written: status = 'in_progress'
       ↓
Questions Answered → saved_state JSON updated with each result
       ↓
Game Ends Normally → status = 'completed', end_time recorded
Game Quit Early    → status = 'quit', quit_reason saved
Drop Rule Hit      → status = 'dropped'
       ↓
Assessment Submitted → Record written in game_assessments table
       ↓
PDF Exported         → File path stored in game_dashboard_pdfs
       ↓
Admin Views Reports  → Data joined from all three tables
\`\`\`

---

## 8. Score Calculation

### How Scores Are Stored
The \`score\` column in \`game_sessions\` holds the total number of correct answers at the time of last update.

Each individual question result is stored in \`saved_state.allScores\` with:
- \`qId\` — Question number
- \`score\` — 1 = correct, 0 = incorrect
- \`timeTaken\` — Seconds taken to respond
- \`moves\` — Number of interactions (where applicable)

### Report Score Aggregation

The Reports Detail API (\`GET /reports/detail/:gameName\`) reads the \`saved_state\` JSON and calculates:

\`\`\`
correct_count     = allScores.filter(s => s.score > 0).length
attempted_questions = allScores.length
actual_game_time  = sum of all timeTaken values
total_moves       = sum of all moves values
total_session_time = end_time - start_time (in seconds)
\`\`\`

---

## 9. Assessment Logic

### Behavioral Assessment Questions
After each session, the assessor completes a structured observation form:

| Question | Type |
|---|---|
| Q1 — Did the child enjoy the game? | Single choice |
| Q2 — How did the game feel? | Single choice |
| Q3 — Did the child feel tired? | Single choice |
| Q4 — Would the child play again? | Single choice |
| Q5 — Observed behaviors | Multi-select checkboxes |
| Additional Notes | Free text |

### Assessment Storage
Responses are stored in the \`game_assessments\` table linked to \`session_id\`. The \`q5_behaviors\` field is stored as a JSON array.

### Pending Assessment Detection
The backend detects sessions where \`status IN ('completed', 'quit', 'dropped')\` but no corresponding record exists in \`game_assessments\`. A prompt is shown to the assessor to complete the form before navigating away.

---

## 10. Error Handling

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 201 | New session created successfully |
| 200 | Request successful (or session reused / status preserved) |
| 400 | Bad Request — required fields missing |
| 401 | Unauthorized — invalid or missing admin token |
| 403 | Forbidden — token valid but role is not 'admin' |
| 404 | Not Found — session ID does not exist |
| 500 | Internal Server Error — database or processing failure |

### Terminal Status Guard
\`\`\`
If a 'completed' update is sent for a session already in
'quit' or 'dropped' state, the server responds HTTP 200
with 'Session already finalized — status preserved.'
No data is changed.
\`\`\`

### Client-Side Resilience
- Game continues running locally if a save API call fails
- Session ID is stored in React state for the duration of gameplay
- Final session update is always attempted before displaying score screen

---

## 11. Security & Validation

### Admin Route Protection
All report routes require a JWT Bearer token with \`role: admin\`.

**Token Check:**
\`\`\`
Authorization: Bearer <JWT_TOKEN>

Validates:
  ✓ Token is a valid JWT (signed with server secret)
  ✓ Token is not expired
  ✓ Token role === 'admin'

Failure responses:
  401 — No token provided
  401 — Token expired
  403 — Role is not admin
\`\`\`

### Input Validation
- \`child_id\` + \`game_name\` required for session start
- \`session_id\` + \`child_id\` required for assessment submission
- Status transitions enforced server-side (terminal state guard)

---

## 12. Visual Workflow

*Diagrams will be added in a future update.*

**Planned:**
- Complete session lifecycle diagram
- API sequence diagram (Client → Server → Database)
- Score processing pipeline
- Assessment submission flow

---

## 13. Developer Notes

### Game Name Normalization
Several games have legacy name aliases that are normalized server-side:

\`\`\`
'Chalo Mela Chale' / 'chalo_mela_chale' → 'rover_mela'
'chor_machaye_shor'                      → 'cognitive_flex_chor'
'reading_skill'                          → 'literacy_reading_skill'
'Ankganit'                               → 'numeracy_number_skill'
\`\`\`

### saved_state Schema Flexibility
The JSON schema of \`saved_state\` varies by game. The Reports Detail API handles multiple formats:
- \`allScores\` array (standard games)
- \`itemResults\` array (Chor Machaye Shor)
- \`questionDetails\` map (games with mid-test assessments)

### Attempt Number Calculation
Attempt numbers are not stored as a column — they are calculated dynamically at query time by counting sessions for the same \`child_id\` + \`game_name\` ordered by \`start_time\`.

---

## 14. Future Scalability

- **New games**: Follow the same session lifecycle — only \`game_name\` changes, no new tables needed
- **New question metrics**: \`saved_state\` JSON schema can be extended without database migrations
- **Reporting expansion**: The Reports Detail API dynamically reads column keys from \`saved_state\`, adapting automatically to any game structure
- **API versioning**: Base path \`/api/games/\` supports future versioned sub-routes

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });

const fmtDt = (d) => d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const renderMarkdown = (text) => {
    if (!text) return '';
    return text
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:10px;overflow-x:auto;font-size:0.82rem;line-height:1.6;"><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;color:#4f46e5;padding:2px 6px;border-radius:5px;font-size:0.85em;">$1</code>')
        .replace(/^# (.+)$/gm,  '<h1 style="font-size:1.5rem;font-weight:800;color:#0f172a;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin:0 0 14px;letter-spacing:-0.02em;">$1</h1>')
        .replace(/^## (.+)$/gm, '<h2 style="font-size:1.1rem;font-weight:700;color:#1e293b;margin:18px 0 9px;">$1</h2>')
        .replace(/^### (.+)$/gm,'<h3 style="font-size:0.95rem;font-weight:700;color:#374151;margin:14px 0 7px;">$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,   '<em>$1</em>')
        .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:18px 0;">')
        .replace(/^\|(.+)\|$/gm, (match) => {
            if (match.replace(/[|\-\s:]/g, '') === '') return '';
            const cells = match.slice(1,-1).split('|').map(c => `<td style="padding:9px 12px;border:1px solid #e5e7eb;font-size:0.87rem;">${c.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
        })
        .replace(/((<tr>.*<\/tr>\n?)+)/g, '<table style="width:100%;border-collapse:collapse;margin:12px 0;border-radius:8px;overflow:hidden;">$1</table>')
        .replace(/^[-*] (.+)$/gm, '<li style="margin:5px 0;padding-left:4px;color:#374151;">$1</li>')
        .replace(/((<li.*<\/li>\n?)+)/g, '<ul style="padding-left:22px;margin:8px 0;">$1</ul>')
        .replace(/^\d+\. (.+)$/gm, '<li style="margin:5px 0;padding-left:4px;color:#374151;">$1</li>')
        .replace(/\n\n/g, '</p><p style="margin:8px 0;">')
        .replace(/>\n/g, '>')
        .replace(/\n/g, '<br/>');
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const Sidebar = ({ expandedGame, selectedGame, selectedSection, onHome, onGameClick, onSectionClick }) => {
    const gameRowRef = useRef({});

    const handleGameClick = (game) => {
        onGameClick(game);
        setTimeout(() => {
            gameRowRef.current[game.key]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 300);
    };

    return (
        <div style={{
            width: '260px', minWidth: '260px',
            background: T.white,
            borderRight: `1px solid ${T.border}`,
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto', overflowX: 'hidden',
            fontFamily: T.font,
        }}>
            {/* Hub button */}
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.borderSoft}` }}>
                <button
                    onClick={onHome}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '9px 14px',
                        background: T.accentBg, border: `1px solid ${T.accentBd}`,
                        borderRadius: '10px', cursor: 'pointer',
                        color: T.accent, fontSize: '0.82rem', fontWeight: 700,
                        transition: 'all 0.15s', fontFamily: T.font,
                    }}
                >
                    <span style={{ fontSize: '0.92rem' }}>🏠</span>
                    Documentation Hub
                </button>
            </div>

            {/* Section label */}
            <div style={{ padding: '12px 16px 6px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.faint }}>
                Game Modules
            </div>

            {/* Accordion list */}
            {GAME_CATALOG.map(game => {
                const isExpanded  = expandedGame === game.key;
                const isActiveGame = selectedGame?.key === game.key;
                return (
                    <div key={game.key} ref={el => { gameRowRef.current[game.key] = el; }}>
                        {/* Game row */}
                        <button
                            onClick={() => handleGameClick(game)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', padding: '9px 14px',
                                background: (isActiveGame && !selectedSection) ? T.accentBg : 'transparent',
                                borderLeft: `3px solid ${isActiveGame ? game.color : 'transparent'}`,
                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                transition: 'background 0.15s, border-color 0.15s',
                                fontFamily: T.font,
                            }}
                            onMouseEnter={e => { if (!isActiveGame || selectedSection) e.currentTarget.style.background = 'rgba(15,23,42,0.03)'; }}
                            onMouseLeave={e => { if (!isActiveGame || selectedSection) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', overflow: 'hidden' }}>
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{game.icon}</span>
                                <span style={{
                                    fontSize: '0.83rem', fontWeight: isActiveGame ? 700 : 500,
                                    color: isActiveGame ? game.color : T.text,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {game.title}
                                </span>
                            </div>
                            <span style={{
                                fontSize: '0.58rem', color: isExpanded ? T.accent : T.faint,
                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                                transition: 'transform 0.22s ease, color 0.15s',
                                display: 'inline-block', flexShrink: 0, marginLeft: '4px',
                            }}>
                                ▶
                            </span>
                        </button>

                        {/* Sub-sections accordion */}
                        <div style={{
                            maxHeight: isExpanded ? `${GAME_SECTIONS.length * SEC_H}px` : '0',
                            overflow: 'hidden',
                            transition: 'max-height 0.28s ease',
                            background: 'rgba(248,250,252,0.8)',
                            borderBottom: isExpanded ? `1px solid ${T.borderSoft}` : 'none',
                        }}>
                            {GAME_SECTIONS.map(sec => {
                                const isSel = isActiveGame && selectedSection?.key === sec.key;
                                return (
                                    <button
                                        key={sec.key}
                                        onClick={() => onSectionClick(game, sec)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '7px',
                                            width: '100%', height: `${SEC_H}px`, padding: '0 12px 0 36px',
                                            background: isSel ? T.accentBg : 'transparent',
                                            borderLeft: `3px solid ${isSel ? game.color : 'transparent'}`,
                                            border: 'none', cursor: 'pointer', textAlign: 'left',
                                            transition: 'background 0.15s, border-color 0.15s',
                                            boxSizing: 'border-box', fontFamily: T.font,
                                        }}
                                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(15,23,42,0.03)'; }}
                                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span style={{ fontSize: '0.78rem', flexShrink: 0, opacity: isSel ? 1 : 0.6 }}>{sec.icon}</span>
                                        <span style={{
                                            fontSize: '0.76rem', fontWeight: isSel ? 700 : 400,
                                            color: isSel ? T.accentText : T.muted,
                                            flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                            {sec.label}
                                        </span>
                                        {sec.available && (
                                            <span style={{
                                                fontSize: '0.5rem', fontWeight: 700, padding: '1px 6px',
                                                borderRadius: '999px', flexShrink: 0, letterSpacing: '0.04em',
                                                ...(sec.legacy
                                                    ? { background: 'rgba(245,158,11,0.1)', color: '#92400e', border: '1px solid rgba(245,158,11,0.3)' }
                                                    : { background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }
                                                ),
                                            }}>
                                                {sec.legacy ? '2013' : 'LIVE'}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
            <div style={{ height: '20px', flexShrink: 0 }} />
        </div>
    );
};

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

const Breadcrumb = ({ selectedGame, selectedSection, onHome, onGameSelect }) => (
    <div style={{
        padding: '9px 22px', background: T.white,
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
        fontFamily: T.font,
    }}>
        <button onClick={onHome} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.accent, fontSize: '0.78rem', fontWeight: 600, padding: 0 }}>
            Documentation
        </button>
        {selectedGame && (
            <>
                <span style={{ color: T.faint, fontSize: '0.78rem' }}>/</span>
                <button onClick={onGameSelect} style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedSection ? T.accent : T.text, fontSize: '0.78rem', fontWeight: 600, padding: 0 }}>
                    {selectedGame.icon} {selectedGame.title}
                </button>
            </>
        )}
        {selectedSection && (
            <>
                <span style={{ color: T.faint, fontSize: '0.78rem' }}>/</span>
                <span style={{ color: T.text, fontSize: '0.78rem', fontWeight: 600 }}>
                    {selectedSection.icon} {selectedSection.label}
                </span>
            </>
        )}
    </div>
);

// ─── Landing Page ─────────────────────────────────────────────────────────────

const OBJECTIVE_CARDS = [
    { icon: '📊', title: 'Legacy Analysis Reports',  color: '#f59e0b', desc: 'Store and manage historical gameplay analysis reports and behavioral assessment references from the original SANGIAN platform developed in 2013.' },
    { icon: '⚙️', title: 'Technical Documentation', color: '#4f46e5', desc: 'Maintain detailed technical and workflow documentation for the upgraded 2026 SANGIAN platform — game logic, score flow, APIs, system architecture, and assessment behavior.' },
    { icon: '🖼️', title: 'Screenshot Library',       color: '#0891b2', desc: 'Centralized visual repository for all game screens, dashboards, assessment pages, scene references, and workflow screenshots.' },
    { icon: '📋', title: 'Gameplay Manuals',         color: '#8b5cf6', desc: 'Game-wise operational manuals — gameplay instructions, scene flow, scoring methods, cutoff references, sound behavior, animations, and assessment logic.' },
];

const LandingPage = ({ onGameClick }) => {
    const [hoveredGame, setHoveredGame]   = useState(null);
    const [hoveredObj, setHoveredObj]     = useState(null);
    const gameSectionRef = useRef(null);
    const scrollToGames = () => gameSectionRef.current?.scrollIntoView({ behavior: 'smooth' });

    return (
        <div style={{ background: T.bg, fontFamily: T.font, color: T.text, overflowY: 'auto', minHeight: '100%' }}>
            <div style={{ maxWidth: '960px', margin: '0 auto', padding: '28px 24px 60px' }}>

                {/* Page heading */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accent }}>
                            SANGIAN Documentation Center
                        </span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 9px', borderRadius: '999px', background: T.accentBg, border: `1px solid ${T.accentBd}`, color: T.accentText, fontWeight: 700 }}>
                            v2026
                        </span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(1.4rem,2.5vw,2rem)', fontWeight: 900, color: T.text, margin: '0 0 6px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                        Centralized Documentation Hub
                    </h1>
                    <p style={{ fontSize: '0.88rem', color: T.muted, margin: 0, lineHeight: 1.65 }}>
                        Game-centric knowledge workspace for technical documentation, gameplay analysis, manuals, and visual assets.
                    </p>
                </div>

                {/* Hero card */}
                <div style={{
                    background: 'linear-gradient(135deg, #ffffff 55%, #eef2ff 100%)',
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius, boxShadow: T.shadowMd,
                    padding: '32px 28px', marginBottom: '32px',
                    display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap',
                }}>
                    <div style={{ flex: '1 1 300px', minWidth: '260px' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accent, marginBottom: '8px' }}>
                            Welcome
                        </div>
                        <h2 style={{ fontSize: 'clamp(1.1rem,2vw,1.5rem)', fontWeight: 800, color: T.text, margin: '0 0 12px', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                            Welcome to the SANGIAN<br />Documentation Center
                        </h2>
                        <p style={{ color: T.muted, fontSize: '0.86rem', lineHeight: 1.7, margin: '0 0 20px' }}>
                            This module organizes all technical, functional, analytical, and visual documentation
                            for the SANGIAN assessment ecosystem — from legacy 2013 platform reports to the
                            fully upgraded 2026 architecture. Navigate game-wise using the left sidebar.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {[
                                { label: '📂 Browse Game Docs', primary: true, action: scrollToGames },
                                { label: '📋 Open Manuals',     primary: false, action: scrollToGames },
                                { label: '🖼️ View Screenshots', primary: false, action: scrollToGames },
                                { label: '📊 Technical Reports',primary: false, action: scrollToGames },
                            ].map(btn => (
                                <LandingBtn key={btn.label} primary={btn.primary} onClick={btn.action}>{btn.label}</LandingBtn>
                            ))}
                        </div>
                    </div>
                    {/* Right visual */}
                    <div style={{ flex: '0 1 240px', minWidth: '200px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                            {[
                                ['🖼️','Screenshots','#0891b2'],['📐','Diagrams','#4f46e5'],['📋','Manuals','#8b5cf6'],
                                ['📊','Reports','#f59e0b'],    ['🔊','Audio','#059669'],  ['🎮','Gameplay','#dc2626'],
                            ].map(([ico,lbl,c]) => (
                                <div key={lbl} style={{ background: T.white, border: `1px solid ${T.border}`, borderTop: `3px solid ${c}`, borderRadius: '10px', padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', boxShadow: T.shadow }}>
                                    <span style={{ fontSize: '1.3rem' }}>{ico}</span>
                                    <span style={{ fontSize: '0.6rem', color: T.muted, fontWeight: 600 }}>{lbl}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.72rem', color: T.faint }}>
                            Asset library — coming soon
                        </div>
                    </div>
                </div>

                {/* Objectives */}
                <LandingSectionHead label="Module Objectives" title="What this module covers" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: '14px', marginBottom: '32px' }}>
                    {OBJECTIVE_CARDS.map((card, i) => (
                        <div
                            key={i}
                            onMouseEnter={() => setHoveredObj(i)}
                            onMouseLeave={() => setHoveredObj(null)}
                            style={{
                                background: T.white, border: `1px solid ${T.border}`,
                                borderTop: `3px solid ${card.color}`,
                                borderRadius: T.radius, padding: '20px 18px',
                                boxShadow: hoveredObj === i ? T.shadowLg : T.shadow,
                                transform: hoveredObj === i ? 'translateY(-2px)' : 'none',
                                transition: 'all 0.18s',
                            }}
                        >
                            <div style={{ fontSize: '1.4rem', marginBottom: '12px' }}>{card.icon}</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: T.text, marginBottom: '8px' }}>{card.title}</div>
                            <div style={{ fontSize: '0.78rem', color: T.muted, lineHeight: 1.65 }}>{card.desc}</div>
                        </div>
                    ))}
                </div>

                {/* Game-wise navigation */}
                <div ref={gameSectionRef}>
                    <LandingSectionHead
                        label="Navigation Architecture"
                        title="Organized Game-Wise Navigation"
                        sub="Select any game to instantly access all its related documentation — technical docs, manuals, workflow diagrams, screenshots, score logic, and assessment flows."
                    />

                    <div style={{
                        background: T.white, border: `1px solid ${T.border}`,
                        borderRadius: T.radius, padding: '24px 22px',
                        boxShadow: T.shadow, marginBottom: '24px',
                    }}>
                        <p style={{ fontSize: '0.85rem', color: T.muted, lineHeight: 1.7, margin: '0 0 20px' }}>
                            The SANGIAN Documentation Center is organized game-wise to provide quick and structured access to all related documentation for each game.
                            Users can directly navigate to technical documents, manuals, workflow diagrams, screenshots, score logic, audio references,
                            and assessment flows from the selected game section in the left sidebar — without searching or losing navigation context.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '14px' }}>
                            {GAME_CATALOG.map(game => {
                                const hov = hoveredGame === game.key;
                                return (
                                    <button
                                        key={game.key}
                                        onClick={() => onGameClick(game)}
                                        onMouseEnter={() => setHoveredGame(game.key)}
                                        onMouseLeave={() => setHoveredGame(null)}
                                        style={{
                                            background: T.white,
                                            border: `1px solid ${hov ? game.color + '55' : T.border}`,
                                            borderRadius: '12px', padding: 0,
                                            cursor: 'pointer', textAlign: 'left',
                                            boxShadow: hov ? T.shadowLg : T.shadow,
                                            transform: hov ? 'translateY(-3px)' : 'none',
                                            transition: 'all 0.18s', fontFamily: T.font,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {/* Game image banner */}
                                        <div style={{ position: 'relative', width: '100%', height: '110px', overflow: 'hidden', background: `${game.color}10` }}>
                                            <img
                                                src={game.image}
                                                alt={game.title}
                                                style={{
                                                    width: '100%', height: '100%',
                                                    objectFit: 'cover',
                                                    transform: hov ? 'scale(1.06)' : 'scale(1)',
                                                    transition: 'transform 0.35s ease',
                                                    display: 'block',
                                                }}
                                            />
                                            {/* Bottom gradient fade for legibility */}
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0, height: '36px',
                                                background: 'linear-gradient(transparent, rgba(0,0,0,0.22))',
                                                pointerEvents: 'none',
                                            }} />
                                        </div>

                                        {/* Card body */}
                                        <div style={{ padding: '12px 13px 11px', borderTop: `3px solid ${game.color}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
                                                <span style={{ fontSize: '1rem' }}>{game.icon}</span>
                                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: hov ? game.color : T.text }}>{game.title}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: hov ? '7px' : '0' }}>
                                                {GAME_SECTIONS.slice(0, 5).map(s => (
                                                    <span key={s.key} style={{ fontSize: '0.58rem', background: T.bg, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '1px 5px', color: T.faint }}>{s.icon}</span>
                                                ))}
                                                <span style={{ fontSize: '0.58rem', background: T.bg, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '1px 5px', color: T.faint }}>+{GAME_SECTIONS.length - 5}</span>
                                            </div>
                                            {hov && (
                                                <div style={{ fontSize: '0.72rem', color: game.color, fontWeight: 700 }}>Open documentation →</div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section coverage */}
                    <div style={{
                        background: T.white, border: `1px solid ${T.border}`,
                        borderRadius: T.radius, padding: '20px 22px', boxShadow: T.shadow,
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            Available Documentation Sections per Game
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {GAME_SECTIONS.map(sec => (
                                <span key={sec.key} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    background: sec.available ? 'rgba(5,150,105,0.06)' : '#f8fafc',
                                    border: `1px solid ${sec.available ? 'rgba(5,150,105,0.25)' : T.border}`,
                                    borderRadius: '8px', padding: '6px 11px',
                                    fontSize: '0.76rem', color: sec.available ? '#065f46' : T.muted,
                                    fontWeight: sec.available ? 600 : 400,
                                }}>
                                    {sec.icon} {sec.label}
                                    {sec.available && (
                                        <span style={{ fontSize: '0.58rem', background: 'rgba(5,150,105,0.1)', color: '#059669', padding: '0 5px', borderRadius: '4px', fontWeight: 700 }}>LIVE</span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LandingBtn = ({ onClick, primary, children }) => {
    const [hov, setHov] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                padding: '8px 16px', borderRadius: '999px', fontFamily: T.font,
                border: primary ? 'none' : `1.5px solid ${T.accentBd}`,
                background: primary ? (hov ? '#4338ca' : T.accent) : (hov ? T.accentBg : 'white'),
                color: primary ? '#fff' : T.accent,
                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                transition: 'all 0.15s',
                boxShadow: primary ? (hov ? '0 4px 14px rgba(79,70,229,0.35)' : '0 2px 8px rgba(79,70,229,0.2)') : 'none',
                transform: hov ? 'translateY(-1px)' : 'none',
            }}
        >
            {children}
        </button>
    );
};

const LandingSectionHead = ({ label, title, sub }) => (
    <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accent, marginBottom: '4px' }}>{label}</div>
        <h2 style={{ fontSize: 'clamp(1rem,2vw,1.25rem)', fontWeight: 800, color: T.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>{title}</h2>
        {sub && <p style={{ fontSize: '0.82rem', color: T.muted, margin: 0, lineHeight: 1.6 }}>{sub}</p>}
    </div>
);

// ─── Game Dashboard ───────────────────────────────────────────────────────────

const GameDashboard = ({ game, onSectionClick }) => {
    const [hovered, setHovered] = useState(null);
    const available = GAME_SECTIONS.filter(s => s.available).length;

    return (
        <div style={{ background: T.bg, fontFamily: T.font, color: T.text, overflowY: 'auto', minHeight: '100%' }}>
            {/* Game hero */}
            {/* Image banner hero */}
            <div style={{ position: 'relative', width: '100%', height: '160px', overflow: 'hidden', background: `${game.color}15`, flexShrink: 0 }}>
                <img
                    src={game.image}
                    alt={game.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Dark scrim left-to-right for text legibility */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)' }} />
                {/* Text overlay */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, padding: '18px 24px' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                        Game Documentation
                    </div>
                    <h1 style={{ fontSize: 'clamp(1.2rem,2.5vw,1.8rem)', fontWeight: 900, color: '#ffffff', margin: '0 0 4px', letterSpacing: '-0.02em', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                        {game.icon} {game.title}
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                        {available} section{available !== 1 ? 's' : ''} currently live · {GAME_SECTIONS.length - available} coming soon
                    </p>
                </div>
            </div>

            {/* Sections grid */}
            <div style={{ padding: '24px 28px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.faint, marginBottom: '14px' }}>
                    Documentation Sections
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: '12px' }}>
                    {GAME_SECTIONS.map(sec => {
                        const isHov = hovered === sec.key;
                        return (
                            <button
                                key={sec.key}
                                onMouseEnter={() => setHovered(sec.key)}
                                onMouseLeave={() => setHovered(null)}
                                onClick={() => onSectionClick(game, sec)}
                                style={{
                                    background: T.white,
                                    border: `1px solid ${isHov ? (sec.available ? `${game.color}50` : T.accentBd) : T.border}`,
                                    borderTop: `3px solid ${sec.available ? game.color : T.faint}`,
                                    borderRadius: T.radius, padding: '18px 16px',
                                    cursor: 'pointer', textAlign: 'left',
                                    boxShadow: isHov ? T.shadowLg : T.shadow,
                                    transform: isHov ? 'translateY(-2px)' : 'none',
                                    transition: 'all 0.15s', fontFamily: T.font,
                                    display: 'flex', flexDirection: 'column', gap: '10px',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{sec.icon}</span>
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px',
                                        ...(sec.legacy
                                            ? { background: 'rgba(245,158,11,0.08)', color: '#92400e', border: '1px solid rgba(245,158,11,0.25)' }
                                            : sec.available
                                                ? { background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }
                                                : { background: 'rgba(15,23,42,0.04)', color: T.faint, border: `1px solid ${T.border}` }
                                        ),
                                    }}>
                                        {sec.legacy ? 'Archive 2013' : sec.available ? 'Available' : 'Coming Soon'}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: isHov ? T.text : T.muted }}>
                                    {sec.label}
                                </div>
                                {isHov && (
                                    <div style={{ fontSize: '0.73rem', color: sec.available ? game.color : T.faint, fontWeight: 600 }}>
                                        {sec.available ? 'Open →' : 'Under development'}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── Coming Soon ──────────────────────────────────────────────────────────────

const ComingSoonSection = ({ game, section }) => (
    <div style={{ background: T.bg, minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', fontFamily: T.font }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
            <div style={{
                width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 20px',
                background: `${game.color}10`, border: `1.5px solid ${game.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
            }}>
                {section.icon}
            </div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: game.color, marginBottom: '8px' }}>
                {game.title}
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.text, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
                {section.label}
            </h2>
            <p style={{ fontSize: '0.85rem', color: T.muted, lineHeight: 1.7, margin: '0 0 20px' }}>
                This documentation section is under active development and will be integrated
                progressively as content becomes available for <strong style={{ color: T.text }}>{game.title}</strong>.
            </p>
            <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: T.accentBg, border: `1px solid ${T.accentBd}`,
                borderRadius: '999px', padding: '7px 18px',
                fontSize: '0.76rem', fontWeight: 700, color: T.accentText,
            }}>
                ⏳ Coming Soon — Documentation Under Integration
            </div>
        </div>
    </div>
);

// ─── Technical Docs Editor ────────────────────────────────────────────────────

const btnSm = (bg, color, border) => ({
    padding: '6px 14px', borderRadius: '999px', border: border || 'none',
    background: bg, color, fontWeight: 700, fontSize: '0.79rem', cursor: 'pointer',
    transition: 'all 0.15s', fontFamily: T.font,
});

// Generic editor — works for any section with its own docKey in game_documents table
const DocSectionEditor = ({ game, section, docKey, defaultContent }) => {
    const [content, setContent]           = useState('');
    const [editContent, setEditContent]   = useState('');
    const [isEditing, setIsEditing]       = useState(false);
    const [isSaving, setIsSaving]         = useState(false);
    const [isLoading, setIsLoading]       = useState(false);
    const [saveMsg, setSaveMsg]           = useState('');
    const [versions, setVersions]         = useState([]);
    const [showVersions, setShowVersions] = useState(false);
    const [viewingVersion, setViewingVersion] = useState(null);
    const [updatedAt, setUpdatedAt]       = useState(null);
    const [updatedBy, setUpdatedBy]       = useState(null);

    const loadDoc = useCallback(async () => {
        setIsLoading(true); setIsEditing(false); setViewingVersion(null); setShowVersions(false);
        try {
            const res = await axios.get(`${API_URL}/docs/${docKey}`, authHeader());
            if (res.data.doc) {
                setContent(res.data.doc.content);
                setUpdatedAt(res.data.doc.updated_at);
                setUpdatedBy(res.data.doc.updated_by);
            } else {
                setContent(defaultContent); setUpdatedAt(null); setUpdatedBy(null);
            }
        } catch { setContent('⚠️ Failed to load documentation. Please try again.'); }
        finally { setIsLoading(false); }
    }, [docKey, defaultContent]);

    useEffect(() => { loadDoc(); }, [loadDoc]);

    const loadVersions = async () => {
        try { const r = await axios.get(`${API_URL}/docs/${docKey}/versions`, authHeader()); setVersions(r.data.versions || []); }
        catch { setVersions([]); }
    };

    const handleSave = async () => {
        setIsSaving(true); setSaveMsg('');
        const savedBy = (() => { try { return JSON.parse(localStorage.getItem('adminUser')).name; } catch { return 'admin'; } })();
        try {
            await axios.put(`${API_URL}/docs/${docKey}`, { content: editContent, saved_by: savedBy }, authHeader());
            setContent(editContent); setIsEditing(false);
            setUpdatedAt(new Date().toISOString()); setUpdatedBy(savedBy);
            setSaveMsg('✅ Saved successfully!'); setTimeout(() => setSaveMsg(''), 3000);
        } catch { setSaveMsg('❌ Failed to save. Please try again.'); }
        finally { setIsSaving(false); }
    };

    const handleViewVersion = async (ver) => {
        try { const r = await axios.get(`${API_URL}/docs/version/${ver.id}`, authHeader()); setViewingVersion({ ...ver, content: r.data.version.content }); setIsEditing(false); }
        catch {}
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: T.font }}>
            {/* Toolbar */}
            <div style={{
                padding: '12px 22px', background: T.white, borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: T.text }}>{section.icon} {section.label}</div>
                    <div style={{ fontSize: '0.72rem', color: T.faint, marginTop: '1px' }}>
                        {updatedAt ? `Last updated ${fmtDt(updatedAt)} · by ${updatedBy}` : 'No saved version yet'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {saveMsg && <span style={{ fontSize: '0.78rem', color: saveMsg.includes('✅') ? '#059669' : '#dc2626', fontWeight: 600 }}>{saveMsg}</span>}
                    {viewingVersion && (
                        <>
                            <span style={{ fontSize: '0.72rem', background: '#fffbeb', color: '#92400e', padding: '3px 10px', borderRadius: '999px', fontWeight: 600, border: '1px solid rgba(245,158,11,0.25)' }}>
                                Viewing v{viewingVersion.id}
                            </span>
                            <button onClick={() => { setEditContent(viewingVersion.content); setViewingVersion(null); setIsEditing(true); }} style={btnSm('#fef9c3','#92400e','1px solid rgba(245,158,11,0.3)')}>↩ Restore</button>
                            <button onClick={() => setViewingVersion(null)} style={btnSm('rgba(15,23,42,0.04)',T.text,'1px solid rgba(15,23,42,0.08)')}>✕ Close</button>
                        </>
                    )}
                    {!viewingVersion && !isEditing && (
                        <>
                            <button onClick={() => setShowVersions(v => { const n = !v; if (n) loadVersions(); return n; })} style={btnSm('rgba(15,23,42,0.04)',T.text,'1px solid rgba(15,23,42,0.08)')}>
                                🕓 History {showVersions ? '▲' : '▼'}
                            </button>
                            <button onClick={() => { setEditContent(content); setIsEditing(true); setViewingVersion(null); }} style={btnSm(game.color,'#fff')}>✏️ Edit</button>
                        </>
                    )}
                    {isEditing && (
                        <>
                            <button onClick={() => { setIsEditing(false); setViewingVersion(null); }} style={btnSm('rgba(15,23,42,0.04)',T.text,'1px solid rgba(15,23,42,0.08)')}>Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} style={btnSm(game.color,'#fff')}>{isSaving ? 'Saving…' : '💾 Save'}</button>
                        </>
                    )}
                </div>
            </div>

            {/* Version history panel */}
            {showVersions && !isEditing && (
                <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '10px 22px', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: T.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Version History</div>
                    {versions.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: T.faint, fontStyle: 'italic' }}>No prior versions found.</div>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {versions.map(ver => (
                                <button key={ver.id} onClick={() => handleViewVersion(ver)} style={{
                                    padding: '4px 11px', borderRadius: '6px',
                                    border: `1px solid ${T.border}`,
                                    background: viewingVersion?.id === ver.id ? T.accentBg : '#f8fafc',
                                    cursor: 'pointer', fontSize: '0.76rem', color: T.text, fontFamily: T.font,
                                }}>
                                    v{ver.id} · {fmtDt(ver.saved_at)} · {ver.saved_by}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: T.faint, fontSize: '0.88rem' }}>Loading documentation…</div>
                ) : isEditing ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '0.73rem', color: T.faint }}>📝 Editing in Markdown — **bold**, ## headings, - lists, `code`, tables</div>
                        <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            style={{
                                flex: 1, minHeight: '460px', width: '100%', padding: '16px',
                                border: `2px solid ${game.color}`, borderRadius: '10px',
                                fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: '1.7',
                                background: T.white, color: T.text, resize: 'vertical',
                                boxSizing: 'border-box', outline: 'none', fontFamily: T.font,
                            }}
                        />
                    </div>
                ) : (
                    <div
                        style={{
                            background: T.white, borderRadius: T.radius, padding: '28px',
                            boxShadow: T.shadow, lineHeight: '1.75', color: '#374151',
                            fontSize: '0.9rem', border: `1px solid ${T.border}`,
                        }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(viewingVersion ? viewingVersion.content : content) }}
                    />
                )}
            </div>
        </div>
    );
};

// ─── Audio Logic — live audio intelligence viewer ────────────────────────────

const AUDIO_FOLDERS = {
    atlantis_bagiya:        'bagiya',
    number_recall_lottery:  'lottery_ka_ticket',
    number_recall_lottery_v2:  'lottery_ka_ticket',
    rover_mela:             'chalo_mela_chale',
    auditory_dhyan:         'dhyan_kahan_hai',
    working_memory_herpher: 'her_pher',
    numeracy_number_skill:  'number_skill',
    literacy_reading_skill: 'reading_skill',
    cognitive_flex_chor:    'chor_machaye_shor',
    triangle_rachna:        'rachna',
};

const AUDIO_TYPES = {
    instruction: { label: 'Instruction',  color: '#4f46e5', bg: 'rgba(79,70,229,0.08)'   },
    question:    { label: 'Question Audio',color: '#0891b2', bg: 'rgba(8,145,178,0.08)'   },
    feedback_ok: { label: 'Feedback ✓',   color: '#059669', bg: 'rgba(5,150,105,0.08)'   },
    feedback_no: { label: 'Feedback ✗',   color: '#dc2626', bg: 'rgba(220,38,38,0.08)'   },
    alert:       { label: 'Alert',         color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
    transition:  { label: 'Transition',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)'  },
    completion:  { label: 'Completion',    color: '#10b981', bg: 'rgba(16,185,129,0.08)'  },
    sequence:    { label: 'Digit Sequence',color: '#7c3aed', bg: 'rgba(124,58,237,0.08)'  },
};

const AUDIO_CATALOG = {
    numeracy_number_skill: [
        { group: 'Splash & Instruction', groupIcon: '🎵', items: [
            { file: 'splash.wav', label: 'Splash Screen Audio', type: 'instruction', objective: 'Delivers gameplay instructions before the assessment starts. "Start Now" button is disabled until this audio finishes — ensuring the child hears instructions before beginning.', trigger: 'Automatically on Splash screen load', screen: 'Splash Screen', behavior: 'Sequential lock — gates gameplay start until audio completion. Replay available via "Replay Audio" button.' },
        ]},
    ],
    literacy_reading_skill: [
        { group: 'Splash & Instruction', groupIcon: '🎵', items: [
            { file: 'splash.wav', label: 'Splash Screen Audio', type: 'instruction', objective: 'Delivers reading test instructions. "Start Now" button is disabled until this audio finishes.', trigger: 'Automatically on Splash screen load', screen: 'Splash Screen', behavior: 'Sequential lock — gates gameplay start until audio completion.' },
        ]},
    ],
    triangle_rachna: [
        { group: 'Splash & Instruction', groupIcon: '🎵', items: [
            { file: 'splash.wav', label: 'Splash Screen Audio', type: 'instruction', objective: 'Delivers construction task instructions. "Start Now" button is disabled until this audio finishes.', trigger: 'Automatically on Splash screen load', screen: 'Splash Screen', behavior: 'Sequential lock — gates gameplay start until audio completion.' },
        ]},
    ],
    working_memory_herpher: [
        { group: 'Splash & Instruction', groupIcon: '🎵', items: [
            { file: 'splash.wav', label: 'Splash Screen Audio', type: 'instruction', objective: 'Delivers working memory game instructions. "Start Now" button disabled until audio ends.', trigger: 'Automatically on Splash screen load', screen: 'Splash Screen', behavior: 'Sequential lock — gates gameplay start until audio completion.' },
        ]},
        { group: 'Interaction Feedback', groupIcon: '🔔', items: [
            { file: 'touch.wav', label: 'Touch Interaction Sound', type: 'feedback_ok', objective: 'Provides immediate auditory feedback when the child selects/touches an item on screen. Reinforces the interaction and confirms the tap was registered.', trigger: 'Child taps/selects any item', screen: 'Game Screen — item selection', behavior: 'Instant micro-feedback — plays immediately on touch. New Audio() instantiated fresh each time (fire-and-forget pattern).' },
            { file: 'screen_change.wav', label: 'Screen Transition Sound', type: 'transition', objective: 'Signals the transition between practice and main assessment screens, and between game phases. Helps the child orient to the change in game context.', trigger: 'Screen phase transition (practice → test, between rounds)', screen: 'Practice → Main Assessment transition', behavior: 'New Audio() instantiated on each phase change — fire-and-forget.' },
        ]},
    ],
    cognitive_flex_chor: [
        { group: 'Feedback & Outcome Sounds', groupIcon: '🎯', items: [
            { file: 'cm_appalause.wav', label: 'Applause — Success', type: 'completion', objective: 'Played when the child successfully identifies the thief or completes a challenge. Positive reinforcement that encourages continued engagement and celebrates correct performance.', trigger: 'Correct identification / successful item completion', screen: 'Game Screen — success state', behavior: 'Reward reinforcement audio — plays on task completion.' },
            { file: 'cm_neglect.wav', label: 'Neglect — Miss Sound', type: 'feedback_no', objective: 'Played when the child misses the target or fails to respond in time. Gently signals that the response was not optimal without being discouraging.', trigger: 'Missed target or incorrect selection', screen: 'Game Screen — incorrect/miss state', behavior: 'Soft negative feedback — non-punitive behavioral signal.' },
            { file: 'cm_thief_caught.wav', label: 'Thief Caught', type: 'feedback_ok', objective: 'Specific success sound when the thief character is caught. More dramatic positive reinforcement for the key assessment task.', trigger: 'Thief identified/caught successfully', screen: 'Game Screen — thief caught state', behavior: 'Primary success sound — most important feedback in this game.' },
        ]},
    ],
    atlantis_bagiya: [
        { group: 'Splash & Instruction', groupIcon: '🎵', items: [
            { file: 'splash.wav', label: 'Splash Screen Audio', type: 'instruction', objective: 'Delivers Bagiya game instructions. Gates Start Now button until completion.', trigger: 'Automatically on Splash screen load', screen: 'Splash Screen', behavior: 'Sequential lock — gates gameplay start.' },
        ]},
        { group: 'Creature Name Audio', groupIcon: '🦋', items: [
            { file: 'bird_ba.wav',         label: 'Bird "BA" — Name',    type: 'question', objective: 'Pronunciation of the creature name "BA". Played when showing this creature to the child so they hear its correct name.', trigger: 'Creature card displayed', screen: 'Game Screen — question display', behavior: 'Question delivery audio — child hears creature name before responding.' },
            { file: 'bird_deem.wav',       label: 'Bird "DEEM" — Name',  type: 'question', objective: 'Pronunciation of creature name "DEEM".', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'bird_jul.wav',        label: 'Bird "JUL" — Name',   type: 'question', objective: 'Pronunciation of creature name "JUL".', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'bird_hoop.wav',       label: 'Bird "HOOP" — Name',  type: 'question', objective: 'Pronunciation of creature name "HOOP".', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'flower_shibagu.wav',  label: 'Flower "SHIBAGU"',    type: 'question', objective: 'Flower name pronunciation for memory assessment.', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'flower_mulpaki.wav',  label: 'Flower "MULPAKI"',    type: 'question', objective: 'Flower name pronunciation for memory assessment.', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'flower_pegeto.wav',   label: 'Flower "PEGETO"',     type: 'question', objective: 'Flower name pronunciation for memory assessment.', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'flower_dhulkoma.wav', label: 'Flower "DHULKOMA"',   type: 'question', objective: 'Flower name pronunciation for memory assessment.', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'insect_ghesa.wav',    label: 'Insect "GHESA"',      type: 'question', objective: 'Insect name pronunciation for memory assessment.', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'insect_mogju.wav',    label: 'Insect "MOGJU"',      type: 'question', objective: 'Insect name pronunciation for memory assessment.', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'insect_baigul.wav',   label: 'Insect "BAIGUL"',     type: 'question', objective: 'Insect name pronunciation for memory assessment.', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
            { file: 'insect_thooli.wav',   label: 'Insect "THOOLI"',     type: 'question', objective: 'Insect name pronunciation for memory assessment.', trigger: 'Creature card displayed', screen: 'Game Screen', behavior: 'Question delivery audio.' },
        ]},
        { group: '"Kha Hai" — Consumed Audio', groupIcon: '🍃', items: [
            { file: 'bird_ba_kha_hai.wav',         label: '"BA kha hai"',         type: 'question', objective: 'Audio narration "BA has eaten [item]" — the question delivery audio for checking what the creature consumed. Core assessment audio for memory recall.', trigger: 'Question sub-audio — what did the creature eat?', screen: 'Game Screen — memory question', behavior: 'Second-phase question audio — plays after creature intro to ask what it consumed.' },
            { file: 'bird_deem_kha_hai.wav',       label: '"DEEM kha hai"',       type: 'question', objective: 'Memory recall question: "DEEM has eaten what?"', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'bird_jul_kha_hai.wav',        label: '"JUL kha hai"',        type: 'question', objective: 'Memory recall question for JUL.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'bird_hoop_kha_hai.wav',       label: '"HOOP kha hai"',       type: 'question', objective: 'Memory recall question for HOOP.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'no_name_kha_hai.wav',         label: '"No name kha hai"',    type: 'question', objective: 'Fallback "kha hai" audio for unnamed creatures (Bird 2, Bird 4, Bird 5, Flower 4, Insect 4).', trigger: 'Question sub-audio — unnamed creature', screen: 'Game Screen', behavior: 'Fallback delivery audio for unnamed creatures.' },
            { file: 'flower_shibagu_kha_hai.wav',  label: '"SHIBAGU kha hai"',   type: 'question', objective: 'Memory recall question for SHIBAGU.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'flower_mulpaki_kha_hai.wav',  label: '"MULPAKI kha hai"',   type: 'question', objective: 'Memory recall question for MULPAKI.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'flower_dhulkoma_kha_hai.wav', label: '"DHULKOMA kha hai"',  type: 'question', objective: 'Memory recall question for DHULKOMA.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'flower_pegeto_kha_hai.wav',   label: '"PEGETO kha hai"',    type: 'question', objective: 'Memory recall question for PEGETO.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'insect_ghesa_kha_hai.wav',    label: '"GHESA kha hai"',     type: 'question', objective: 'Memory recall question for GHESA.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'insect_mogju_kha_hai.wav',    label: '"MOGJU kha hai"',     type: 'question', objective: 'Memory recall question for MOGJU.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'insect_baigul_kha_hai.wav',   label: '"BAIGUL kha hai"',    type: 'question', objective: 'Memory recall question for BAIGUL.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
            { file: 'insect_thooli_kha_hai.wav',   label: '"THOOLI kha hai"',    type: 'question', objective: 'Memory recall question for THOOLI.', trigger: 'Question sub-audio', screen: 'Game Screen', behavior: 'Assessment question delivery.' },
        ]},
    ],
    rover_mela: [
        { group: 'Splash & Background', groupIcon: '🎵', items: [
            { file: 'SB_splash.wav',  label: 'Splash Background 1', type: 'instruction', objective: 'Primary background audio for splash screen. Creates the fair/mela atmosphere before game starts.', trigger: 'Splash screen load', screen: 'Splash Screen', behavior: 'Background immersion audio.' },
            { file: 'SB_splash2.wav', label: 'Splash Background 2', type: 'instruction', objective: 'Secondary background audio variation for splash screen.', trigger: 'Splash screen load (variation)', screen: 'Splash Screen', behavior: 'Background immersion audio (variant).' },
            { file: 'SB_path1.wav',   label: 'Path 1 Background',   type: 'instruction', objective: 'Background audio for the first route/path selection screen.', trigger: 'Path 1 question display', screen: 'Game Screen — Path 1', behavior: 'Context background audio for route selection.' },
            { file: 'SB_path2.wav',   label: 'Path 2 Background',   type: 'instruction', objective: 'Background audio for the second route/path question.', trigger: 'Path 2 question display', screen: 'Game Screen — Path 2', behavior: 'Context background audio.' },
        ]},
        { group: 'Question & Path Audio', groupIcon: '🗺️', items: [
            { file: 'path1.wav', label: 'Path 1 Question Audio', type: 'question', objective: 'Oral question narration for route 1 — reads the spatial navigation challenge to the child.', trigger: 'Path 1 question begins', screen: 'Game Screen — Route 1', behavior: 'Question delivery — gates answer UI until audio completes.' },
            { file: 'path2.wav', label: 'Path 2 Question Audio', type: 'question', objective: 'Oral question narration for route 2.', trigger: 'Path 2 question begins', screen: 'Game Screen — Route 2', behavior: 'Question delivery.' },
            { file: 'path3.wav', label: 'Path 3 Question Audio', type: 'question', objective: 'Oral question narration for route 3.', trigger: 'Path 3 question begins', screen: 'Game Screen — Route 3', behavior: 'Question delivery.' },
            { file: 'path1_result.wav', label: 'Path 1 Result',   type: 'feedback_ok', objective: 'Result feedback audio for path 1 outcome — announces the correct route answer.', trigger: 'After path 1 answer submitted', screen: 'Game Screen — result', behavior: 'Result/feedback delivery.' },
            { file: 'path2_result.wav', label: 'Path 2 Result',   type: 'feedback_ok', objective: 'Result feedback audio for path 2 outcome.', trigger: 'After path 2 answer submitted', screen: 'Game Screen — result', behavior: 'Result/feedback delivery.' },
            { file: 'path3_result.wav', label: 'Path 3 Result',   type: 'feedback_ok', objective: 'Result feedback audio for path 3 outcome.', trigger: 'After path 3 answer submitted', screen: 'Game Screen — result', behavior: 'Result/feedback delivery.' },
        ]},
        { group: 'Feedback & Alert Sounds', groupIcon: '⚡', items: [
            { file: 'success.wav',       label: 'Success Sound',     type: 'completion', objective: 'Celebration sound on successful route completion. Positive reinforcement for correct spatial reasoning.', trigger: 'Correct route selected / game success', screen: 'Game Screen — success', behavior: 'Reward reinforcement.' },
            { file: 'timer_warning.wav', label: 'Timer Warning',     type: 'alert',      objective: 'Warning alert played when the timer reaches 6 seconds remaining. Signals urgency without causing panic — a behavioral cue for time awareness.', trigger: 'Timer countdown reaches 6 seconds (timeRemaining === 6)', screen: 'Game Screen — timer area', behavior: 'Urgency signal — triggers at exact 6-second mark in countdown logic.' },
            { file: 'wrong_move.wav',    label: 'Wrong Move Sound',  type: 'feedback_no', objective: 'Gentle audio signal when an incorrect route or move is attempted. Provides immediate corrective feedback without audio punishment.', trigger: 'Incorrect move/selection', screen: 'Game Screen — error state', behavior: 'Soft corrective feedback.' },
        ]},
    ],
    auditory_dhyan: [
        { group: 'Splash & Instructions', groupIcon: '🎵', items: [
            { file: 'splash.wav',         label: 'Splash Screen Audio',     type: 'instruction', objective: 'Delivers auditory attention test instructions on splash screen. Gates Start Now button.', trigger: 'Splash screen load', screen: 'Splash Screen', behavior: 'Sequential lock — core instruction delivery.' },
            { file: 'aa_instruction.wav', label: 'Assessment Instruction',  type: 'instruction', objective: 'Verbal instruction narration for the auditory attention task — explains what the child must listen for and how to respond.', trigger: 'Before first question begins', screen: 'Pre-game instruction phase', behavior: 'Pre-assessment instruction — critical for correct task understanding.' },
            { file: 'suno.wav',           label: '"Suno" — Listen Cue',     type: 'instruction', objective: '"Listen carefully" verbal cue. Prepares the child to attend to the upcoming audio stimulus.', trigger: 'Before each question audio', screen: 'Game Screen — attention cue', behavior: 'Attention primer — precedes question delivery.' },
            { file: 'dena.wav',           label: '"Dena" — Give/Response',  type: 'instruction', objective: '"Give/respond now" instruction cue — signals the child that it is time to provide their response.', trigger: 'After stimulus audio, prompting response', screen: 'Game Screen — response prompt', behavior: 'Response trigger cue.' },
            { file: 'lao.wav',            label: '"Lao" — Bring Cue',       type: 'instruction', objective: '"Bring/select" instruction — directs the child to pick the correct item from options.', trigger: 'Selection prompt during questions', screen: 'Game Screen — selection prompt', behavior: 'Action instruction audio.' },
        ]},
        { group: 'Question Sequence Audio', groupIcon: '🔊', items: [
            { file: 'question1.wav', label: 'Question 1 Audio', type: 'question', objective: 'Full audio sequence for question 1 of the auditory attention task.', trigger: 'Question 1 begins', screen: 'Game Screen — Q1', behavior: 'Core question delivery — child must listen and identify.' },
            { file: 'question2.wav', label: 'Question 2 Audio', type: 'question', objective: 'Full audio sequence for question 2.', trigger: 'Question 2 begins', screen: 'Game Screen — Q2', behavior: 'Core question delivery.' },
            { file: 'question3.wav', label: 'Question 3 Audio', type: 'question', objective: 'Full audio sequence for question 3.', trigger: 'Question 3 begins', screen: 'Game Screen — Q3', behavior: 'Core question delivery.' },
            { file: 'question4.wav', label: 'Question 4 Audio', type: 'question', objective: 'Full audio sequence for question 4.', trigger: 'Question 4 begins', screen: 'Game Screen — Q4', behavior: 'Core question delivery.' },
        ]},
        { group: 'Object Name Audio', groupIcon: '📢', items: [
            { file: 'badal.wav',  label: '"Badal" (Cloud)',     type: 'question', objective: 'Pronunciation of the sky object "Badal" (cloud). Used in auditory matching tasks.', trigger: 'Object audio stimulus', screen: 'Game Screen', behavior: 'Stimulus audio for attention task.' },
            { file: 'chand.wav',  label: '"Chand" (Moon)',      type: 'question', objective: 'Pronunciation of "Chand" (moon).', trigger: 'Object audio stimulus', screen: 'Game Screen', behavior: 'Stimulus audio.' },
            { file: 'suraj.wav',  label: '"Suraj" (Sun)',       type: 'question', objective: 'Pronunciation of "Suraj" (sun).', trigger: 'Object audio stimulus', screen: 'Game Screen', behavior: 'Stimulus audio.' },
            { file: 'tara.wav',   label: '"Tara" (Star)',       type: 'question', objective: 'Pronunciation of "Tara" (star).', trigger: 'Object audio stimulus', screen: 'Game Screen', behavior: 'Stimulus audio.' },
            { file: 'gola.wav',   label: '"Gola" (Circle)',     type: 'question', objective: 'Pronunciation of "Gola" (circle/ball).', trigger: 'Object audio stimulus', screen: 'Game Screen', behavior: 'Stimulus audio.' },
            { file: 'khali.wav',  label: '"Khali" (Empty)',     type: 'question', objective: 'Pronunciation of "Khali" (empty).', trigger: 'Response option audio', screen: 'Game Screen', behavior: 'Option label audio.' },
            { file: 'poora.wav',  label: '"Poora" (Full)',      type: 'question', objective: 'Pronunciation of "Poora" (full).', trigger: 'Response option audio', screen: 'Game Screen', behavior: 'Option label audio.' },
            { file: 'raat.wav',   label: '"Raat" (Night)',      type: 'question', objective: 'Time context audio — "Raat" (night).', trigger: 'Context stimulus', screen: 'Game Screen', behavior: 'Context audio.' },
            { file: 'pani.wav',   label: '"Pani" (Water)',      type: 'question', objective: 'Object audio — "Pani" (water).', trigger: 'Object stimulus', screen: 'Game Screen', behavior: 'Stimulus audio.' },
            { file: 'theek.wav',  label: '"Theek" (Correct)',   type: 'feedback_ok', objective: 'Verbal "correct/okay" feedback audio.', trigger: 'Correct response', screen: 'Game Screen', behavior: 'Positive feedback.' },
            { file: 'nahi.wav',   label: '"Nahi" (No)',         type: 'feedback_no', objective: 'Verbal "no" feedback — gently signals incorrect response.', trigger: 'Incorrect response', screen: 'Game Screen', behavior: 'Soft corrective feedback.' },
        ]},
    ],
    number_recall_lottery: [
        { group: 'Splash Audio', groupIcon: '🎵', items: [
            { file: 'splash1.m4a', label: 'Splash Audio 1 (Primary)',   type: 'instruction', objective: 'Primary splash screen instruction audio for the Lottery Ka Ticket memory game.', trigger: 'Splash screen load', screen: 'Splash Screen', behavior: 'Sequential lock — gates Start Now.' },
            { file: 'splash2.m4a', label: 'Splash Audio 2 (Secondary)', type: 'instruction', objective: 'Secondary instruction audio variant for the lottery game splash screen.', trigger: 'Splash screen (secondary/practice)', screen: 'Splash Screen', behavior: 'Instruction delivery.' },
        ]},
        { group: 'Practice Question Audio', groupIcon: '🧪', items: [
            { file: '4_6_teaching_audio.m4a', label: 'Teaching Audio: 4-6',       type: 'instruction', objective: 'Practice/teaching question sequence "4, 6" — demonstrates how to listen and recall digit sequences before the real assessment.', trigger: 'Teaching/practice round', screen: 'Practice Screen', behavior: 'Demonstration sequence — no score taken.' },
            { file: '9_4_teaching_audio.m4a', label: 'Teaching Audio: 9-4',       type: 'instruction', objective: 'Second teaching sequence "9, 4" for practice.', trigger: 'Teaching/practice round 2', screen: 'Practice Screen', behavior: 'Demonstration sequence.' },
        ]},
        { group: 'Question Sequence Audio (2-digit)', groupIcon: '🎟️', items: [
            { file: '2_8.m4a',      label: 'Sequence: 2, 8',         type: 'sequence', objective: 'Digit recall audio: child hears "2, 8" and must recall the sequence in order.', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Working memory assessment stimulus.' },
            { file: '8_9.m4a',      label: 'Sequence: 8, 9',         type: 'sequence', objective: 'Digit recall audio: "8, 9".', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Working memory stimulus.' },
            { file: '4_6.m4a',      label: 'Sequence: 4, 6',         type: 'sequence', objective: 'Digit recall: "4, 6".', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Working memory stimulus.' },
            { file: '9_4.m4a',      label: 'Sequence: 9, 4',         type: 'sequence', objective: 'Digit recall: "9, 4".', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Working memory stimulus.' },
        ]},
        { group: 'Question Sequence Audio (3–9 digits)', groupIcon: '🔢', items: [
            { file: '10_5_3.m4a',               label: 'Sequence: 10, 5, 3',             type: 'sequence', objective: '3-digit span sequence.', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Working memory span assessment.' },
            { file: '4_9_5.m4a',                label: 'Sequence: 4, 9, 5',              type: 'sequence', objective: '3-digit span.', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Working memory span.' },
            { file: '9_1_6.m4a',                label: 'Sequence: 9, 1, 6',              type: 'sequence', objective: '3-digit span.', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Working memory span.' },
            { file: '2_3_6_10_5.m4a',           label: 'Sequence: 2, 3, 6, 10, 5',      type: 'sequence', objective: '5-digit span sequence.', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Extended working memory span.' },
            { file: '10_2_4_9_1_6.m4a',         label: 'Sequence: 10, 2, 4, 9, 1, 6',  type: 'sequence', objective: '6-digit span.', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Extended span.' },
            { file: '9_1_2_6_4_3_8_5_10.m4a',   label: 'Sequence: 9, 1, 2, 6… (9 digits)', type: 'sequence', objective: 'Maximum 9-digit span sequence — highest difficulty level.', trigger: 'Question delivery', screen: 'Game Screen', behavior: 'Peak working memory demand.' },
        ]},
    ],
};

// Fallback for games not in catalog
const getAudioCatalog = (gameKey) => {
    if (AUDIO_CATALOG[gameKey]) return AUDIO_CATALOG[gameKey];
    const folder = AUDIO_FOLDERS[gameKey] || gameKey;
    return [{
        group: 'Splash & Instruction',
        groupIcon: '🎵',
        items: [{
            file: 'splash.wav',
            label: 'Splash Screen Audio',
            type: 'instruction',
            objective: 'Delivers gameplay instructions before assessment starts. "Start Now" button is disabled until this audio completes.',
            trigger: 'Automatically on Splash screen load',
            screen: 'Splash Screen',
            behavior: 'Sequential lock — gates gameplay start until audio completion. Replay available.',
        }],
    }];
};

// ── Audio Player Card ─────────────────────────────────────────────────────────

const AudioCard = ({ item, folder }) => {
    const [playing, setPlaying]   = useState(false);
    const [duration, setDuration] = useState(null);
    const [progress, setProgress] = useState(0);
    const [loaded, setLoaded]     = useState(false);
    const [error, setError]       = useState(false);
    const audioRef                = useRef(null);
    const src = `/assets/audios/${folder}/${item.file}`;
    const meta = AUDIO_TYPES[item.type] || AUDIO_TYPES.instruction;

    const toggle = () => {
        if (!audioRef.current || error) return;
        if (playing) { audioRef.current.pause(); setPlaying(false); }
        else { audioRef.current.play().then(() => setPlaying(true)).catch(() => { setError(true); setPlaying(false); }); }
    };

    const stop = () => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        setPlaying(false); setProgress(0);
    };

    const fmtDur = (s) => s ? `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}` : '--:--';
    const [hov, setHov] = useState(false);

    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? meta.bg : T.white,
                border: `1px solid ${hov ? meta.color + '50' : T.border}`,
                borderLeft: `4px solid ${meta.color}`,
                borderRadius: '12px', padding: '16px 18px',
                boxShadow: hov ? T.shadowMd : T.shadow,
                transform: hov ? 'translateY(-1px)' : 'none',
                transition: 'all 0.18s',
            }}
        >
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onLoadedMetadata={e => { setDuration(e.target.duration); setLoaded(true); }}
                onTimeUpdate={e => setProgress(duration ? (e.target.currentTime / duration) * 100 : 0)}
                onEnded={() => { setPlaying(false); setProgress(0); }}
                onError={() => { setError(true); setLoaded(false); }}
            />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: T.text }}>{item.label}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}>
                            {meta.label}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: T.faint, fontFamily: 'monospace' }}>{item.file}</div>
                </div>
                {/* Player controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {playing && (
                        <button onClick={stop} style={{ width: '28px', height: '28px', borderRadius: '50%', border: `1px solid ${T.border}`, background: T.bg, cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted }}>
                            ⏹
                        </button>
                    )}
                    <button
                        onClick={toggle}
                        disabled={error}
                        style={{
                            width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                            background: error ? '#f1f5f9' : (playing ? meta.color : meta.color),
                            cursor: error ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: error ? T.faint : '#fff',
                            boxShadow: playing ? `0 0 12px ${meta.color}60` : T.shadow,
                            transition: 'all 0.15s',
                        }}
                        title={error ? 'Audio file not found' : playing ? 'Pause' : 'Play'}
                    >
                        {error ? '✕' : playing ? '⏸' : '▶'}
                    </button>
                </div>
            </div>
            {/* Progress bar */}
            <div style={{ height: '3px', background: '#e9ecf0', borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: meta.color, borderRadius: '2px', transition: 'width 0.1s linear' }} />
            </div>
            {/* Duration */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: T.faint }}>Duration: {loaded ? fmtDur(duration) : error ? 'Not found' : 'Loading…'}</span>
                {loaded && <span style={{ fontSize: '0.7rem', color: T.faint }}>{fmtDur(audioRef.current?.currentTime)} / {fmtDur(duration)}</span>}
            </div>
            {/* Metadata */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {[
                    { label: 'Objective',    value: item.objective  },
                    { label: 'Trigger',      value: item.trigger    },
                    { label: 'Screen',       value: item.screen     },
                    { label: 'Behavior',     value: item.behavior   },
                ].map(row => (
                    <div key={row.label} style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: T.faint, minWidth: '58px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{row.label}</span>
                        <span style={{ fontSize: '0.77rem', color: T.muted, lineHeight: 1.5, flex: 1 }}>{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Audio Logic Viewer ────────────────────────────────────────────────────────

// ── Smart type detection from filename ───────────────────────────────────────
const detectAudioType = (filename) => {
    const f = filename.toLowerCase().replace(/[\s]/g, '_');
    if (/splash|intro|instruction|teaching|aa_instruction/.test(f)) return 'instruction';
    if (/^sb_/.test(f)) return 'instruction';
    if (/suno|dena|lao/.test(f)) return 'instruction';
    if (/bilkul|sahi|theek|appalause|success|thief_caught/.test(f)) return 'feedback_ok';
    if (/nahi|neglect|wrong_move|wrong|dubara/.test(f)) return 'feedback_no';
    if (/timer_warning|warning/.test(f)) return 'alert';
    if (/screen_change|touch/.test(f)) return 'transition';
    if (/result|complete|finish/.test(f)) return 'completion';
    if (/kha_hai/.test(f)) return 'question';
    if (/^[0-9_]+\.(wav|m4a|mp3)$/.test(f) || /^[0-9]+_/.test(f)) return 'sequence';
    if (/question\d*/.test(f)) return 'question';
    return 'question';
};

const AUDIO_GROUP_DEFS = [
    { key: 'splash',    label: 'Splash & Instruction',      icon: '🎵', types: ['instruction'] },
    { key: 'question',  label: 'Question & Assessment Audio', icon: '🔊', types: ['question', 'sequence'] },
    { key: 'feedback',  label: 'Feedback & Outcome',         icon: '💬', types: ['feedback_ok', 'feedback_no', 'completion'] },
    { key: 'alerts',    label: 'Alerts & Transitions',       icon: '⚡', types: ['alert', 'transition'] },
];

// Build auto metadata for a file when no catalog entry exists
const autoAudioMeta = (filename, gameTitle) => {
    const type = detectAudioType(filename);
    const name = filename.replace(/\.(wav|mp3|m4a|ogg|aac)$/i, '').replace(/[_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const typeObjectives = {
        instruction: `Instruction or splash audio for ${gameTitle}. Plays at game load and gates the "Start Now" button until playback completes.`,
        question:    `Question delivery audio — plays when presenting this content to the child during assessment.`,
        sequence:    `Digit sequence audio for working memory assessment — the child hears this sequence and must recall it in order.`,
        feedback_ok: `Positive feedback audio — reinforces correct responses and maintains engagement during gameplay.`,
        feedback_no: `Corrective feedback audio — gently signals an incorrect or missed response without being discouraging.`,
        alert:       `Alert or warning sound — signals time pressure or an important game event to the child.`,
        transition:  `Transition sound — signals a change between game phases, screens, or practice and main assessment.`,
        completion:  `Completion or result audio — plays when a game section or the full assessment concludes.`,
    };
    const typeTriggers = {
        instruction: 'Automatically on Splash screen load',
        question:    'Question/stimulus delivery during gameplay',
        sequence:    'Sequence question delivery — child listens then responds',
        feedback_ok: 'Correct response / successful task completion',
        feedback_no: 'Incorrect response / missed target',
        alert:       'Timer or game-state event threshold reached',
        transition:  'Screen or phase transition event',
        completion:  'Game or section completion',
    };
    return {
        file: filename, label: name, type,
        objective: typeObjectives[type] || 'Game audio asset.',
        trigger: typeTriggers[type] || 'Game event',
        screen: type === 'instruction' ? 'Splash Screen' : 'Game Screen',
        behavior: 'Auto-detected from game asset folder. See game source file for precise trigger conditions.',
    };
};

// Group raw file list into labeled sections, enriched with catalog metadata
const buildAudioGroups = (files, gameKey) => {
    // Build catalog lookup map for rich metadata override
    const catalogMap = {};
    (AUDIO_CATALOG[gameKey] || []).forEach(g => g.items.forEach(item => { catalogMap[item.file] = item; }));

    // Assign each file a type
    const byType = {};
    files.forEach(f => {
        const t = detectAudioType(f);
        if (!byType[t]) byType[t] = [];
        byType[t].push(f);
    });

    return AUDIO_GROUP_DEFS
        .map(gd => {
            const groupFiles = gd.types.flatMap(t => byType[t] || []);
            if (!groupFiles.length) return null;
            return {
                group: gd.label,
                groupIcon: gd.icon,
                items: groupFiles.map(f => catalogMap[f] || autoAudioMeta(f, GAME_DISPLAY[gameKey] || gameKey)),
            };
        })
        .filter(Boolean);
};

const AudioLogicViewer = ({ game }) => {
    const [loading, setLoading]       = useState(true);
    const [groups, setGroups]         = useState([]);
    const [totalFiles, setTotalFiles] = useState(0);
    const [activeGroup, setActiveGroup] = useState(null);
    const [syncedAt]                  = useState(new Date());
    const folder   = AUDIO_FOLDERS[game.key] || game.key;
    const modules  = getConnectedModules(game);
    const typeColor = { Frontend:'#4f46e5', Component:'#8b5cf6', Backend:'#059669', Routes:'#0891b2', Database:'#f59e0b' };
    const fmtSync  = (d) => d.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

    const loadFiles = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/docs/audio-assets/${folder}`, authHeader());
            const files = (res.data.files || []).filter(f => !/^\./.test(f));
            const built = buildAudioGroups(files, game.key);
            setGroups(built);
            setTotalFiles(files.length);
            if (built.length) setActiveGroup(built[0].group);
        } catch {
            // Fallback to static catalog
            const fallback = getAudioCatalog(game.key);
            setGroups(fallback);
            setTotalFiles(fallback.reduce((a, g) => a + g.items.length, 0));
            if (fallback.length) setActiveGroup(fallback[0].group);
        } finally { setLoading(false); }
    }, [game.key, folder]);

    useEffect(() => { loadFiles(); }, [loadFiles]);

    const currentGroup = groups.find(g => g.group === activeGroup) || groups[0];

    return (
        <div style={{ display:'flex', flexDirection:'column', height:'100%', background:T.bg, fontFamily:T.font, overflow:'hidden' }}>

            {/* Status banner */}
            <div style={{ background:'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)', borderBottom:`1px solid ${T.accentBd}`, padding:'12px 22px', flexShrink:0 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'8px',marginBottom:'8px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>
                        <div style={{ width:'34px',height:'34px',borderRadius:'9px',background:T.accentBg,border:`1px solid ${T.accentBd}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem' }}>🔊</div>
                        <div>
                            <div style={{ fontSize:'0.88rem',fontWeight:700,color:T.accentText }}>Audio & Sound Logic — {game.title}</div>
                            <div style={{ fontSize:'0.72rem',color:T.muted }}>
                                {loading ? 'Scanning audio folder…' : `${totalFiles} audio files auto-discovered · ${fmtSync(syncedAt)}`}
                            </div>
                        </div>
                    </div>
                    <div style={{ display:'flex',gap:'6px',flexWrap:'wrap' }}>
                        {[{dot:'#10b981',label:'Live Synced'},{dot:'#4f46e5',label:'All Files Connected'},{dot:'#8b5cf6',label:'Interactive Players'}].map(s=>(
                            <span key={s.label} style={{ display:'inline-flex',alignItems:'center',gap:'5px',background:T.white,border:`1px solid ${T.border}`,borderRadius:'999px',padding:'3px 10px',fontSize:'0.72rem',fontWeight:600,color:T.text,boxShadow:T.shadow }}>
                                <span style={{ width:'7px',height:'7px',borderRadius:'50%',background:s.dot,boxShadow:`0 0 5px ${s.dot}80`,display:'inline-block' }}/>{s.label}
                            </span>
                        ))}
                    </div>
                </div>
                <div style={{ background:T.white,border:`1px solid ${T.border}`,borderRadius:'8px',padding:'8px 12px',fontSize:'0.76rem',color:T.muted,marginBottom:'8px' }}>
                    <span style={{ fontWeight:700,color:T.accentText }}>⚡ Dynamic Audio Discovery — </span>
                    All audio files are auto-discovered from the live game asset folder via the backend API. Every file is shown with its behavioral purpose, trigger condition, and an embedded play button.
                    Rich descriptions come from the audio catalog; all other files are auto-documented by filename analysis.
                </div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:'5px' }}>
                    {modules.map(m=>(
                        <span key={m.file} style={{ display:'inline-flex',alignItems:'center',gap:'4px',background:T.white,border:`1px solid ${T.border}`,borderRadius:'6px',padding:'2px 8px',fontSize:'0.67rem',color:T.muted,boxShadow:T.shadow }}>
                            <span style={{ fontSize:'0.75rem' }}>{m.icon}</span>
                            <span style={{ fontSize:'0.55rem',fontWeight:700,padding:'1px 4px',borderRadius:'3px',background:`${typeColor[m.type]||'#64748b'}15`,color:typeColor[m.type]||T.muted }}>{m.type}</span>
                            {m.file}
                        </span>
                    ))}
                </div>
            </div>

            {loading ? (
                <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'12px' }}>
                    <div style={{ width:'36px',height:'36px',borderRadius:'50%',border:`3px solid ${T.border}`,borderTopColor:T.accent,animation:'spin 0.8s linear infinite' }} />
                    <div style={{ fontSize:'0.85rem',color:T.muted }}>Scanning audio assets…</div>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
            ) : groups.length === 0 ? (
                <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px',textAlign:'center' }}>
                    <div>
                        <div style={{ fontSize:'2rem',marginBottom:'12px' }}>🔇</div>
                        <div style={{ fontSize:'0.9rem',fontWeight:700,color:T.text,marginBottom:'8px' }}>No audio files found</div>
                        <div style={{ fontSize:'0.8rem',color:T.muted }}>
                            No audio files were found in <code style={{ background:T.bg,padding:'1px 5px',borderRadius:'4px' }}>/assets/audios/{folder}/</code>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Group tabs */}
                    <div style={{ background:T.white,borderBottom:`1px solid ${T.border}`,padding:'10px 22px',flexShrink:0 }}>
                        <div style={{ display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center' }}>
                            <span style={{ fontSize:'0.72rem',fontWeight:700,color:T.faint,marginRight:'4px' }}>GROUPS:</span>
                            {groups.map(g => (
                                <button key={g.group} onClick={() => setActiveGroup(g.group)} style={{
                                    display:'flex',alignItems:'center',gap:'5px',padding:'5px 12px',
                                    borderRadius:'8px',cursor:'pointer',fontFamily:T.font,
                                    border:`1px solid ${activeGroup===g.group ? T.accent : T.border}`,
                                    background:activeGroup===g.group ? T.accentBg : '#fafafa',
                                    color:activeGroup===g.group ? T.accentText : T.text,
                                    fontSize:'0.78rem',fontWeight:activeGroup===g.group ? 700 : 500,
                                    transition:'all 0.15s',
                                }}>
                                    {g.groupIcon} {g.group}
                                    <span style={{ fontSize:'0.65rem',background:T.bg,border:`1px solid ${T.border}`,borderRadius:'999px',padding:'0 6px',color:T.faint,fontWeight:500 }}>{g.items.length}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cards */}
                    <div style={{ flex:1,overflowY:'auto',padding:'22px' }}>
                        {currentGroup && (
                            <div>
                                <div style={{ marginBottom:'16px' }}>
                                    <h2 style={{ fontSize:'1.1rem',fontWeight:800,color:T.text,margin:'0 0 4px',letterSpacing:'-0.02em' }}>
                                        {currentGroup.groupIcon} {currentGroup.group}
                                    </h2>
                                    <p style={{ fontSize:'0.8rem',color:T.muted,margin:0 }}>
                                        {currentGroup.items.length} audio file{currentGroup.items.length!==1?'s':''} · Click ▶ on any card to preview
                                    </p>
                                </div>
                                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:'14px' }}>
                                    {currentGroup.items.map(item => (
                                        <AudioCard key={item.file} item={item} folder={folder} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// ─── Reports & Analysis — live assessment evidence viewer ────────────────────

const SERVER_BASE = API_URL.replace(/\/api(\/.*)?$/, '');

const STATUS_META = {
    completed: { color: '#059669', bg: '#ecfdf5', border: 'rgba(5,150,105,0.2)',  label: 'Completed' },
    quit:      { color: '#dc2626', bg: '#fef2f2', border: 'rgba(220,38,38,0.2)',  label: 'Quit'      },
    dropped:   { color: '#64748b', bg: '#f8fafc',  border: 'rgba(100,116,139,0.2)',label: 'Dropped'   },
    paused:    { color: '#f59e0b', bg: '#fffbeb',  border: 'rgba(245,158,11,0.2)', label: 'Paused'    },
};

const GAME_DISPLAY = {
    numeracy_number_skill:  'Ankganit',
    literacy_reading_skill: 'Padh ke batao',
    number_recall_lottery:  'Lottery Ka Ticket',
    number_recall_lottery_v2:  'Lottery Ka Ticket - Version 2',
    atlantis_bagiya:        'Bagiya',
    working_memory_herpher: 'Her Pher',
    auditory_dhyan:         'Dhyan Kahan Hai',
    triangle_rachna:        'Rachna',
    rover_mela:             'Chalo Mela Chalen',
    cognitive_flex_chor:    'Chor Machaye Shor',
};

const fmtReportDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtReportTime = (s) => !s && s !== 0 ? '—' : `${Math.floor(s / 60)}m ${s % 60}s`;

const ReportsAnalysisViewer = ({ game, section }) => {
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState(null);
    const [pdfRecord, setPdfRecord]   = useState(null);
    const [tableRows, setTableRows]   = useState([]);
    const [qColumns, setQColumns]     = useState([]);
    const [pdfFullscreen, setPdfFullscreen] = useState(false);
    const [syncedAt]                  = useState(new Date());

    const loadData = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await axios.get(`${API_URL}/games/reports/detail/${game.key}`, authHeader());
            const all  = res.data.data  || [];
            const cols = res.data.columns || [];

            const completed = all.filter(r => r.status === 'completed' || r.status === 'quit' || r.status === 'dropped');

            // Pick one PDF record (prefer completed + has pdf)
            const withPdf = completed.filter(r => r.pdf_url);
            const pdfRec  = withPdf.length
                ? withPdf[Math.floor(Math.random() * withPdf.length)]
                : null;

            // 5 rows for table (include pdf record if exists)
            const pool    = [...completed].sort(() => Math.random() - 0.5);
            let rows = pool.slice(0, 5);
            if (pdfRec && !rows.find(r => r.session_id === pdfRec.session_id)) {
                rows = [pdfRec, ...pool.slice(0, 4)];
            }

            setPdfRecord(pdfRec);
            setTableRows(rows);
            setQColumns(cols.slice(0, 26)); // cap question cols at 26 for display
        } catch {
            setError('Could not load report data. Please check the admin API connection.');
        } finally {
            setLoading(false);
        }
    }, [game.key]);

    useEffect(() => { loadData(); }, [loadData]);

    const modules   = getConnectedModules(game);
    const typeColor = { Frontend: '#4f46e5', Component: '#8b5cf6', Backend: '#059669', Routes: '#0891b2', Database: '#f59e0b' };
    const fmtSync   = (d) => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const pdfUrl = pdfRecord?.pdf_url ? `${SERVER_BASE}${pdfRecord.pdf_url}` : null;

    // ── Status banner shared element ──────────────────────────────────────────
    const Banner = () => (
        <div style={{ background: 'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)', borderBottom: `1px solid ${T.accentBd}`, padding: '12px 22px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: T.accentBg, border: `1px solid ${T.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>📈</div>
                    <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: T.accentText }}>Reports & Analysis — {game.title}</div>
                        <div style={{ fontSize: '0.72rem', color: T.muted }}>Live Assessment Evidence Layer · {fmtSync(syncedAt)}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[{ dot:'#10b981',label:'Live Data'},{ dot:'#4f46e5',label:'Real Assessments'},{ dot:'#059669',label:'Auto-Selected'}].map(s=>(
                        <span key={s.label} style={{ display:'inline-flex',alignItems:'center',gap:'5px',background:T.white,border:`1px solid ${T.border}`,borderRadius:'999px',padding:'3px 10px',fontSize:'0.72rem',fontWeight:600,color:T.text,boxShadow:T.shadow }}>
                            <span style={{ width:'7px',height:'7px',borderRadius:'50%',background:s.dot,display:'inline-block',boxShadow:`0 0 5px ${s.dot}80` }}/>{s.label}
                        </span>
                    ))}
                </div>
            </div>
            <div style={{ background:T.white,border:`1px solid ${T.border}`,borderRadius:'8px',padding:'8px 12px',fontSize:'0.76rem',color:T.muted,marginBottom:'8px' }}>
                <span style={{ fontWeight:700,color:T.accentText }}>⚡ Live Assessment Evidence — </span>
                Reports are automatically selected from real completed assessments in the database. PDF and Excel data reflect actual game sessions — no static samples.
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:'5px' }}>
                {modules.map(m=>(
                    <span key={m.file} style={{ display:'inline-flex',alignItems:'center',gap:'4px',background:T.white,border:`1px solid ${T.border}`,borderRadius:'6px',padding:'2px 8px',fontSize:'0.67rem',color:T.muted,boxShadow:T.shadow }}>
                        <span style={{ fontSize:'0.75rem' }}>{m.icon}</span>
                        <span style={{ fontSize:'0.55rem',fontWeight:700,padding:'1px 4px',borderRadius:'3px',background:`${typeColor[m.type]||'#64748b'}15`,color:typeColor[m.type]||T.muted }}>{m.type}</span>
                        {m.file}
                    </span>
                ))}
            </div>
        </div>
    );

    if (loading) return (
        <div style={{ display:'flex',flexDirection:'column',height:'100%',background:T.bg,fontFamily:T.font,overflow:'hidden' }}>
            <Banner />
            <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'12px' }}>
                <div style={{ width:'40px',height:'40px',borderRadius:'50%',border:`3px solid ${T.border}`,borderTopColor:T.accent,animation:'spin 0.8s linear infinite' }} />
                <div style={{ fontSize:'0.88rem',color:T.muted }}>Loading assessment reports…</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error) return (
        <div style={{ display:'flex',flexDirection:'column',height:'100%',background:T.bg,fontFamily:T.font,overflow:'hidden' }}>
            <Banner />
            <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px',textAlign:'center' }}>
                <div>
                    <div style={{ fontSize:'2rem',marginBottom:'12px' }}>⚠️</div>
                    <div style={{ fontSize:'0.92rem',fontWeight:700,color:T.text,marginBottom:'8px' }}>Could not load reports</div>
                    <div style={{ fontSize:'0.82rem',color:T.muted,marginBottom:'18px' }}>{error}</div>
                    <button onClick={loadData} style={{ padding:'8px 20px',borderRadius:'999px',border:'none',background:T.accent,color:'#fff',fontWeight:700,fontSize:'0.82rem',cursor:'pointer',fontFamily:T.font }}>Retry</button>
                </div>
            </div>
        </div>
    );

    if (tableRows.length === 0) return (
        <div style={{ display:'flex',flexDirection:'column',height:'100%',background:T.bg,fontFamily:T.font,overflow:'hidden' }}>
            <Banner />
            <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px',textAlign:'center' }}>
                <div>
                    <div style={{ fontSize:'2.5rem',marginBottom:'14px' }}>📋</div>
                    <div style={{ fontSize:'1rem',fontWeight:700,color:T.text,marginBottom:'8px' }}>No completed assessments yet</div>
                    <div style={{ fontSize:'0.83rem',color:T.muted,maxWidth:'340px' }}>
                        Complete at least one <strong>{game.title}</strong> assessment session to see live reports here.
                        Reports will appear automatically once sessions are finished.
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ display:'flex',flexDirection:'column',height:'100%',background:T.bg,fontFamily:T.font,overflow:'hidden' }}>
            <Banner />

            <div style={{ flex:1,overflowY:'auto',padding:'22px' }}>
                <div style={{ maxWidth:'1100px',margin:'0 auto',display:'flex',flexDirection:'column',gap:'22px' }}>

                    {/* ── Section 1: PDF Assessment Report ── */}
                    <div>
                        <div style={{ fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.accent,marginBottom:'6px' }}>Live PDF Assessment Report</div>

                        {pdfRecord ? (
                            <div style={{ background:T.white,border:`1px solid ${T.border}`,borderRadius:T.radius,boxShadow:T.shadow,overflow:'hidden' }}>
                                {/* Metadata bar */}
                                <div style={{ padding:'16px 20px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'10px' }}>
                                    <div style={{ display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap' }}>
                                        {[
                                            { label:'Game',   value: GAME_DISPLAY[pdfRecord.game_name] || game.title },
                                            { label:'Child',  value: pdfRecord.child_name || pdfRecord.child_id },
                                            { label:'Score',  value: `${pdfRecord.score} / ${pdfRecord.total_questions}` },
                                            { label:'Date',   value: fmtReportDate(pdfRecord.end_time || pdfRecord.start_time) },
                                            { label:'Duration', value: fmtReportTime(pdfRecord.total_session_time) },
                                        ].map(item => (
                                            <div key={item.label} style={{ display:'flex',flexDirection:'column',gap:'1px' }}>
                                                <span style={{ fontSize:'0.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:T.faint }}>{item.label}</span>
                                                <span style={{ fontSize:'0.84rem',fontWeight:600,color:T.text }}>{item.value}</span>
                                            </div>
                                        ))}
                                        <div>
                                            <span style={{ fontSize:'0.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:T.faint,display:'block',marginBottom:'1px' }}>Status</span>
                                            <span style={{ fontSize:'0.75rem',fontWeight:700,padding:'2px 9px',borderRadius:'999px',background:(STATUS_META[pdfRecord.status]||STATUS_META.completed).bg,color:(STATUS_META[pdfRecord.status]||STATUS_META.completed).color,border:`1px solid ${(STATUS_META[pdfRecord.status]||STATUS_META.completed).border}` }}>
                                                {(STATUS_META[pdfRecord.status]||STATUS_META.completed).label}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display:'flex',gap:'8px' }}>
                                        <button onClick={() => window.open(pdfUrl,'_blank')} style={{ display:'flex',alignItems:'center',gap:'5px',padding:'7px 14px',borderRadius:'999px',border:`1.5px solid ${T.accentBd}`,background:T.accentBg,color:T.accentText,fontWeight:700,fontSize:'0.78rem',cursor:'pointer',fontFamily:T.font }}>
                                            🔍 Full View
                                        </button>
                                        <a href={pdfUrl} download style={{ display:'inline-flex',alignItems:'center',gap:'5px',padding:'7px 14px',borderRadius:'999px',border:'none',background:T.accent,color:'#fff',fontWeight:700,fontSize:'0.78rem',cursor:'pointer',textDecoration:'none',fontFamily:T.font }}>
                                            ⬇ Download PDF
                                        </a>
                                    </div>
                                </div>
                                {/* PDF embed */}
                                <div style={{ background:'#f1f5f9',padding:'0' }}>
                                    <iframe
                                        src={pdfUrl}
                                        title="Assessment Dashboard PDF"
                                        style={{ width:'100%',height:'520px',border:'none',display:'block' }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div style={{ background:T.white,border:`1px dashed ${T.border}`,borderRadius:T.radius,padding:'32px',textAlign:'center',color:T.faint }}>
                                <div style={{ fontSize:'1.8rem',marginBottom:'10px' }}>📄</div>
                                <div style={{ fontSize:'0.85rem',fontWeight:600,color:T.muted,marginBottom:'6px' }}>No PDF reports available yet</div>
                                <div style={{ fontSize:'0.78rem',color:T.faint }}>PDF dashboards are generated automatically when an assessor completes and submits a session.</div>
                            </div>
                        )}
                    </div>

                    {/* ── Section 2: Excel Assessment Data ── */}
                    <div>
                        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px',flexWrap:'wrap',gap:'8px' }}>
                            <div>
                                <div style={{ fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:T.accent,marginBottom:'2px' }}>Excel Assessment Data Preview</div>
                                <div style={{ fontSize:'0.78rem',color:T.muted }}>
                                    {tableRows.length} randomly selected completed sessions · Spreadsheet view
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    const rows = tableRows.map(r => ({
                                        'Session ID':   r.session_id,
                                        'Child ID':     r.child_id,
                                        'Child Name':   r.child_name || '—',
                                        'Score':        r.score,
                                        'Attempted':    r.attempted_questions,
                                        'Total Qs':     r.total_questions,
                                        'Status':       r.status,
                                        'Date':         fmtReportDate(r.start_time),
                                        'Session Time': fmtReportTime(r.total_session_time),
                                        ...Object.fromEntries(qColumns.map(q => [q.toUpperCase(), r.question_scores?.[q] ?? '—'])),
                                        'Enjoy':        r.assessment?.q1_enjoyment  || '—',
                                        'Feeling':      r.assessment?.q2_feeling    || '—',
                                        'Tired':        r.assessment?.q3_tiredness  || '—',
                                        'Again':        r.assessment?.q4_play_again || '—',
                                    }));
                                    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
                                    const blob = new Blob([csv], { type:'text/csv' });
                                    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                                    a.download = `${game.key}_assessment_preview.csv`; a.click();
                                }}
                                style={{ display:'flex',alignItems:'center',gap:'5px',padding:'7px 14px',borderRadius:'999px',border:'none',background:'#059669',color:'#fff',fontWeight:700,fontSize:'0.78rem',cursor:'pointer',fontFamily:T.font }}
                            >
                                ⬇ Download CSV
                            </button>
                        </div>

                        {/* Excel-style grid */}
                        <div style={{ background:T.white,border:`1px solid ${T.border}`,borderRadius:T.radius,boxShadow:T.shadow,overflow:'hidden' }}>
                            {/* Excel toolbar */}
                            <div style={{ padding:'8px 14px',borderBottom:`1px solid ${T.border}`,background:'#f8fafc',display:'flex',alignItems:'center',gap:'10px' }}>
                                <span style={{ fontSize:'0.7rem',fontWeight:700,color:T.muted,letterSpacing:'0.06em',textTransform:'uppercase' }}>Assessment Records</span>
                                <span style={{ fontSize:'0.7rem',background:T.accentBg,color:T.accentText,border:`1px solid ${T.accentBd}`,borderRadius:'999px',padding:'1px 8px',fontWeight:700 }}>
                                    {tableRows.length} rows · {4 + qColumns.length + 4} columns
                                </span>
                                <span style={{ marginLeft:'auto',fontSize:'0.7rem',color:T.faint }}>Scroll horizontally to see all question scores →</span>
                            </div>

                            {/* Spreadsheet */}
                            <div style={{ overflowX:'auto' }}>
                                <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'0.78rem',fontFamily:'"Segoe UI",Inter,sans-serif',whiteSpace:'nowrap',tableLayout:'auto',minWidth:'900px' }}>
                                    {/* Column headers */}
                                    <thead>
                                        {/* Row 1: group headers */}
                                        <tr style={{ background:'#e8ecf4' }}>
                                            <th colSpan={1} style={thStyle}></th>
                                            <th colSpan={4} style={{ ...thStyle,borderLeft:'2px solid #c7d2e8',color:'#3730a3',background:'#eef2ff' }}>Child Info</th>
                                            <th colSpan={3} style={{ ...thStyle,borderLeft:'2px solid #c7d2e8',color:'#065f46',background:'#ecfdf5' }}>Session</th>
                                            <th colSpan={qColumns.length} style={{ ...thStyle,borderLeft:'2px solid #c7d2e8',color:'#0e7490',background:'#ecfeff' }}>Question Scores (1=✓ 0=✗)</th>
                                            <th colSpan={4} style={{ ...thStyle,borderLeft:'2px solid #c7d2e8',color:'#5b21b6',background:'#f5f3ff' }}>Assessment Observations</th>
                                        </tr>
                                        {/* Row 2: column names */}
                                        <tr style={{ background:'#f1f5f9' }}>
                                            <th style={{ ...thStyle,width:'36px',color:'#94a3b8',fontWeight:500 }}>#</th>
                                            {['Child ID','Child Name','Score','Status'].map(c=>(
                                                <th key={c} style={{ ...thStyle,borderLeft:c==='Child ID'?'2px solid #c7d2e8':'none' }}>{c}</th>
                                            ))}
                                            {['Date','Attempted','Time'].map(c=>(
                                                <th key={c} style={{ ...thStyle,borderLeft:c==='Date'?'2px solid #c7d2e8':'none' }}>{c}</th>
                                            ))}
                                            {qColumns.map((q,i)=>(
                                                <th key={q} style={{ ...thStyle,textAlign:'center',width:'36px',borderLeft:i===0?'2px solid #c7d2e8':'none',fontFamily:'monospace' }}>
                                                    {q.replace('q','Q')}
                                                </th>
                                            ))}
                                            {['Enjoy','Feeling','Tired','Play Again'].map((c,i)=>(
                                                <th key={c} style={{ ...thStyle,borderLeft:i===0?'2px solid #c7d2e8':'none' }}>{c}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map((row, ri) => {
                                            const sm = STATUS_META[row.status] || STATUS_META.completed;
                                            return (
                                                <tr key={row.session_id} style={{ background: ri % 2 === 0 ? '#ffffff' : '#fafbfc', borderBottom: `1px solid ${T.border}` }}>
                                                    {/* Row number */}
                                                    <td style={{ ...tdStyle,color:T.faint,textAlign:'center',background:'#f8fafc',borderRight:`1px solid ${T.border}`,fontFamily:'monospace',fontSize:'0.7rem' }}>{ri+1}</td>
                                                    {/* Child info */}
                                                    <td style={{ ...tdStyle,borderLeft:'2px solid #c7d2e8',fontFamily:'monospace',fontSize:'0.75rem',color:'#334155' }}>{row.child_id}</td>
                                                    <td style={{ ...tdStyle,fontWeight:600,color:T.text }}>{row.child_name || '—'}</td>
                                                    <td style={{ ...tdStyle,textAlign:'center',fontWeight:700,color:'#4f46e5' }}>{row.score}<span style={{ color:T.faint,fontWeight:400 }}>/{row.total_questions}</span></td>
                                                    <td style={{ ...tdStyle }}>
                                                        <span style={{ display:'inline-block',padding:'2px 8px',borderRadius:'999px',fontSize:'0.7rem',fontWeight:700,background:sm.bg,color:sm.color,border:`1px solid ${sm.border}` }}>{sm.label}</span>
                                                    </td>
                                                    {/* Session info */}
                                                    <td style={{ ...tdStyle,borderLeft:'2px solid #c7d2e8',color:T.muted,fontSize:'0.73rem' }}>{fmtReportDate(row.start_time)}</td>
                                                    <td style={{ ...tdStyle,textAlign:'center',color:T.muted }}>{row.attempted_questions ?? '—'}</td>
                                                    <td style={{ ...tdStyle,color:T.muted }}>{fmtReportTime(row.total_session_time)}</td>
                                                    {/* Question scores */}
                                                    {qColumns.map((q,i) => {
                                                        const val = row.question_scores?.[q];
                                                        return (
                                                            <td key={q} style={{ ...tdStyle,textAlign:'center',padding:'5px 4px',borderLeft:i===0?'2px solid #c7d2e8':'none',
                                                                background: val === 1 ? '#f0fdf4' : val === 0 ? '#fef2f2' : 'transparent' }}>
                                                                {val === 1 ? <span style={{ color:'#059669',fontWeight:700,fontSize:'0.8rem' }}>✓</span>
                                                                 : val === 0 ? <span style={{ color:'#dc2626',fontWeight:700,fontSize:'0.8rem' }}>✗</span>
                                                                 : <span style={{ color:'#cbd5e1',fontSize:'0.7rem' }}>—</span>}
                                                            </td>
                                                        );
                                                    })}
                                                    {/* Assessment */}
                                                    {[row.assessment?.q1_enjoyment, row.assessment?.q2_feeling, row.assessment?.q3_tiredness, row.assessment?.q4_play_again].map((v,i)=>(
                                                        <td key={i} style={{ ...tdStyle,borderLeft:i===0?'2px solid #c7d2e8':'none',color:T.muted,fontSize:'0.73rem' }}>{v||'—'}</td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div style={{ padding:'8px 14px',borderTop:`1px solid ${T.border}`,background:'#f8fafc',display:'flex',alignItems:'center',gap:'16px' }}>
                                <span style={{ fontSize:'0.7rem',color:T.faint }}>
                                    Showing {tableRows.length} of all completed {game.title} assessments · Data auto-selected from live database
                                </span>
                                <span style={{ marginLeft:'auto',fontSize:'0.7rem',color:T.faint }}>
                                    ✓ = Correct &nbsp;·&nbsp; ✗ = Incorrect &nbsp;·&nbsp; — = Not reached
                                </span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

const thStyle = {
    padding: '7px 10px', fontWeight: 700, fontSize: '0.72rem', color: '#475569',
    textAlign: 'left', border: `1px solid #d1d9e6`, whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
};
const tdStyle = {
    padding: '7px 10px', fontSize: '0.78rem', color: '#374151',
    border: `1px solid #e9ecf0`, verticalAlign: 'middle',
};

// ─── Workflow Diagram — node styles, data, and viewer ────────────────────────

const NODE_META = {
    start:    { border: '#10b981', lightBg: '#ecfdf5',  iconBg: '#d1fae5', badge: 'START',    badgeColor: '#059669', badgeBg: 'rgba(5,150,105,0.1)'   },
    process:  { border: '#4f46e5', lightBg: '#eef2ff',  iconBg: '#e0e7ff', badge: 'PROCESS',  badgeColor: '#3730a3', badgeBg: 'rgba(79,70,229,0.09)'   },
    decision: { border: '#f59e0b', lightBg: '#fffbeb',  iconBg: '#fef3c7', badge: 'DECISION', badgeColor: '#92400e', badgeBg: 'rgba(245,158,11,0.1)'   },
    api:      { border: '#0891b2', lightBg: '#ecfeff',  iconBg: '#cffafe', badge: 'API',      badgeColor: '#0e7490', badgeBg: 'rgba(8,145,178,0.1)'    },
    database: { border: '#7c3aed', lightBg: '#f5f3ff',  iconBg: '#ede9fe', badge: 'DATABASE', badgeColor: '#5b21b6', badgeBg: 'rgba(124,58,237,0.09)'  },
    stop:     { border: '#dc2626', lightBg: '#fef2f2',  iconBg: '#fee2e2', badge: 'STOP',     badgeColor: '#991b1b', badgeBg: 'rgba(220,38,38,0.09)'   },
    success:  { border: '#059669', lightBg: '#ecfdf5',  iconBg: '#d1fae5', badge: 'COMPLETE', badgeColor: '#065f46', badgeBg: 'rgba(5,150,105,0.1)'   },
};

// makeWorkflowFlows — generates the 5-section workflow from real game code
const makeWorkflowFlows = (game) => ({
    journey: [
        { type: 'start',    icon: '📱', title: 'Game Load',
            simple:   'The child opens the game on their device.',
            detailed: 'React component mounts. Child data is read from localStorage. If no child is logged in, user is redirected to login.',
            technical:'useEffect → reads localStorage("currentChild") → if null, navigate("/login") → calls checkResume(childId) + fetchActivity(childId)' },
        { type: 'api',      icon: '🔍', title: 'Resume Check',
            simple:   'The system checks if the child has a previous unfinished session.',
            detailed: 'The backend queries the latest session for this child and game. If it has status "paused", a resume popup is shown.',
            technical:`GET /api/games/sessions/resume/:childId/${game.key}\nReturns: sessionInfo (saved_state, questionIndex, allScores, timers) or null` },
        { type: 'decision', icon: '❓', title: 'Saved Session Found?',
            simple:   'If a previous session is found, the child can choose to continue or start fresh.',
            detailed: 'Resume popup shows with two options: Resume (restores exact question, scores, timers) or Start Fresh (creates new session).',
            technical:'sessionInfo.status === "paused" → showResumeModal = true\nResume → restores questionIndex, allScores, timerSeconds, qTimer, pauses from saved_state',
            branches: [{ label: 'Yes → Resume Prompt', color: '#f59e0b' }, { label: 'No → Splash Screen', color: '#10b981' }] },
        { type: 'process',  icon: '🎵', title: 'Splash Screen',
            simple:   'Game instructions are displayed and audio plays automatically.',
            detailed: 'Background audio plays as soon as the splash screen loads. The "Start Now" button remains disabled until audio finishes.',
            technical:'<audio ref={audioRef} src="/assets/audios/[game]/splash.wav" />\naudioRef.current.play() → onEnded: setAudioFinished(true) → enables Start Now\nonError: setAudioFinished(true) as fail-safe' },
        { type: 'decision', icon: '🔊', title: 'Audio Completed?',
            simple:   'Start Now becomes active only after the child has heard the full instructions.',
            detailed: 'The button is disabled (opacity 0.6, cursor: not-allowed) while audio plays. The assessor can replay audio at any time.',
            technical:'button disabled={!audioFinished} → onChange: onEnded/onError → setAudioFinished(true)',
            branches: [{ label: 'Audio ends → Start Now active', color: '#10b981' }, { label: 'Audio error → Start Now active (fail-safe)', color: '#f59e0b' }] },
        { type: 'api',      icon: '▶️', title: 'Session Created on Server',
            simple:   'A unique session ID is created to track this child\'s game attempt.',
            detailed: 'The server creates a new record in the database. If an active session already exists (deduplication guard), the existing ID is returned.',
            technical:`POST /api/games/sessions/start\nBody: { child_id, game_name: "${game.key}", total_questions }\nResponse: { sessionId, attempt_no }\nDB: INSERT INTO game_sessions (child_id, game_name, status="in_progress", score=0)` },
        { type: 'process',  icon: '❓', title: 'Questions Begin',
            simple:   'The assessment starts. Questions are shown one at a time.',
            detailed: 'Questions are served from a static array in the frontend. questionIndex starts at 0 and advances after each response. Per-question timer resets on every new question.',
            technical:'setScreen("game") → currentQuestion = QUESTIONS[questionIndex]\nsetQTimer(0) on each new question → qTimer counts seconds via setInterval(1000)' },
        { type: 'process',  icon: '🔁', title: 'Question Loop',
            simple:   'For each question: the child responds, the score is recorded, stop rules are checked.',
            detailed: 'See "Question Flow" section for the detailed per-question lifecycle.',
            technical:'processScoring() → checkStopRules() → questionIndex++ or setScreen("score")',
            isRef: true, refLabel: 'See Question Flow →' },
        { type: 'process',  icon: '📊', title: 'Score Screen',
            simple:   'The final score and all question results are displayed.',
            detailed: 'Score screen shows: total score, correct/incorrect counts, percentage, total time, average time per question, and a per-question results table.',
            technical:'setScreen("score") → getTotalScore() = allScores.filter(s=>s.score===1).length\nScore table rendered from allScores array' },
        { type: 'process',  icon: '📋', title: 'Assessment Form',
            simple:   'The assessor fills in behavioral observations about the child\'s session.',
            detailed: 'Four required questions (radio buttons) + eight optional behavioral checkboxes + free-text notes with voice dictation support.',
            technical:'<SessionAssessmentForm /> component renders\nQ1–Q4 required, validation prevents submit if empty\nq5_behaviors stored as JSON array' },
        { type: 'api',      icon: '💾', title: 'Assessment Saved',
            simple:   'The assessor\'s observations are saved to the system.',
            detailed: 'Assessment data is stored in a separate table linked to the session ID.',
            technical:'POST /api/games/assessments\nBody: { session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again, q5_behaviors[], additional_notes }\nDB: INSERT INTO game_assessments' },
        { type: 'process',  icon: '📄', title: 'PDF Dashboard Generated',
            simple:   'A PDF summary of the session is automatically created and saved.',
            detailed: 'The score screen is captured as a high-resolution image and embedded in an A4 PDF. The file is uploaded to the server and linked to the session.',
            technical:'html2canvas(.ns-main, scale:1.5) → jsPDF(A4) → POST /api/games/pdfs/upload\nFilename: [ChildName]_[Game]_SES[id]_[timestamp].pdf' },
        { type: 'success',  icon: '✅', title: 'Session Complete',
            simple:   'The assessment is finished. The admin can now view the full report.',
            detailed: 'Session status is "completed". All data is saved: scores, timers, assessment, PDF. Admin can view the full session in the Reports module.',
            technical:'game_sessions.status = "completed", end_time = NOW()\ngame_assessments record created\ngame_dashboard_pdfs record created\nReport available: GET /api/games/reports/detail/:gameName' },
    ],

    question: [
        { type: 'start',    icon: '❓', title: 'Question Displayed',
            simple:   'A question appears on screen.',
            detailed: 'One question is shown at a time. The per-question timer starts immediately. Question text, answer options, and scoring method depend on the question category.',
            technical:'QUESTIONS[questionIndex] rendered → setQTimer(0) → qTimer++ per second via setInterval' },
        { type: 'decision', icon: '📝', title: 'Question Type?',
            simple:   'Some questions need the assessor to judge the response; others are scored automatically.',
            detailed: 'Manual questions require the assessor to listen to the child\'s verbal answer and mark it Correct or Incorrect. Automatic questions require the child to type an answer.',
            technical:'q.type === "manual" → show [✓ Correct] [✗ Incorrect] buttons\nq.type === "auto" → show numpad input + Submit button',
            branches: [{ label: 'Manual → Assessor scores', color: '#8b5cf6' }, { label: 'Auto → Child types answer', color: '#0891b2' }] },
        { type: 'process',  icon: '✋', title: 'Response Captured',
            simple:   'The child\'s answer is recorded.',
            detailed: 'Manual: assessor clicks Correct/Incorrect. Auto: child uses on-screen numpad, clicks Submit. Division questions require both quotient and remainder.',
            technical:'handleManualScoring(true/false) → processScoring(1 or 0)\nhandleAutoScoring() → compares answerVal/quotientVal+remainderVal to correctAnswer → processScoring(0 or 1)' },
        { type: 'process',  icon: '📊', title: 'Score Recorded',
            simple:   'The score (1 for correct, 0 for incorrect) is saved with the response time.',
            detailed: 'A score record is added to the allScores array: { qId, questionNumber, score, timeTaken }.',
            technical:'newScoreRec = { qId: q.qid, questionNumber: questionIndex+1, score: 0|1, timeTaken: qTimer }\nsetAllScores([...allScores, newScoreRec])' },
        { type: 'api',      icon: '💾', title: 'Progress Auto-Saved',
            simple:   'The progress is automatically sent to the server after every question.',
            detailed: 'Every time the question index advances, the current state is saved to the server. This allows the game to be resumed if interrupted.',
            technical:'useEffect([questionIndex]) → saveToServer("in_progress")\nPUT /api/games/sessions/update/:sessionId\nBody: { score, progress_level, status, saved_state: { questionIndex, allScores, timerSeconds, qTimer, pauses } }' },
        { type: 'decision', icon: '⚠️', title: '3 Consecutive Wrong?',
            simple:   'If the child gets 3 wrong answers in a row, the game stops.',
            detailed: 'The system counts backwards through the score history. If the last 3 scores are all 0, the consecutive wrong threshold is reached.',
            technical:'let consecutive = 0; for i from end: if score===0 consecutive++ else break\nif consecutive >= CONFIG.MAX_CONSECUTIVE_WRONG (3) → shouldStop = true',
            branches: [{ label: 'Yes → Game Stops', color: '#dc2626' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'decision', icon: '📏', title: 'Category Minimum Met?',
            simple:   'At the end of each category, the child must have enough correct answers to continue.',
            detailed: 'This check only runs at the boundary question of each category. If the child didn\'t meet the minimum, the game stops.',
            technical:'at qLen === c1End: getCatCorrect(0, c1End) < MIN_CORRECT.SINGLE_NUMBER → stop\nat qLen === c2End: getCatCorrect(c1End, ...) < MIN_CORRECT.DOUBLE_NUMBER → stop\netc.',
            branches: [{ label: 'Below minimum → Game Stops', color: '#dc2626' }, { label: 'Met minimum → Continue', color: '#10b981' }] },
        { type: 'decision', icon: '🏁', title: 'All Questions Done?',
            simple:   'If all questions have been answered, the game ends normally.',
            detailed: 'After the last question, the game transitions to the score screen regardless of stop rules.',
            technical:'questionIndex + 1 >= QUESTIONS.length → shouldStop = true (natural completion)',
            branches: [{ label: 'Yes → Score Screen', color: '#10b981' }, { label: 'No → Next Question', color: '#4f46e5' }] },
        { type: 'stop',     icon: '🛑', title: 'Stop Rule Triggered',
            simple:   'The game stops early because a performance threshold was reached.',
            detailed: 'Status is set to "completed" (not "dropped") — the child simply did not reach the remaining questions. Scores up to this point are saved.',
            technical:'setScreen("score") → axios.put update: { status:"completed", score, saved_state }\nthen setTimeout(generateAndUploadPDF, 1500)' },
        { type: 'success',  icon: '➡️', title: 'Advance to Next Question',
            simple:   'The next question is shown.',
            detailed: 'The question timer resets to 0. The question index advances by 1.',
            technical:'setQuestionIndex(i => i + 1) → setQTimer(0) → next question rendered from QUESTIONS[questionIndex]' },
    ],

    score: [
        { type: 'start',    icon: '🎯', title: 'Response Received',
            simple:   'The child gives an answer.',
            detailed: 'Whether manual (assessor-clicked) or automatic (child-typed), the system receives the response and begins scoring.',
            technical:'handleManualScoring(bool) or handleAutoScoring() → calls processScoring(score, customValues)' },
        { type: 'process',  icon: '⚖️', title: 'Binary Score Applied',
            simple:   'Every answer is scored as either correct (1) or incorrect (0). No partial points.',
            detailed: 'Auto questions: exact match required. Division: both quotient and remainder must match. Manual: assessor judgment.',
            technical:'score = (answer === correct) ? 1 : 0\nDivision: score = (cQuot===correctAnswer && cRem===remainder) ? 1 : 0\nRecord: { qId, questionNumber, score, timeTaken: qTimer }' },
        { type: 'process',  icon: '📈', title: 'Running Score Updated',
            simple:   'The score display in the header updates after each question.',
            detailed: 'The total score is always calculated live as the count of correct answers in the allScores array.',
            technical:'getTotalScore() = allScores.filter(s => s.score === 1).length\nDisplayed in header: <span>{getTotalScore()}</span>' },
        { type: 'decision', icon: '🔢', title: 'Consecutive Wrong Check',
            simple:   '3 wrong answers in a row stops the game.',
            detailed: 'The system scans backward through allScores. If the last 3 entries are all score=0, the test stops.',
            technical:'for i = upScores.length-1 to 0: if score===0 consecutive++ else break\nif consecutive >= 3: shouldStop=true, stopMsg="3 Consecutive Wrong"',
            branches: [{ label: '≥ 3 wrong → STOP', color: '#dc2626' }, { label: '< 3 wrong → Continue', color: '#10b981' }] },
        { type: 'decision', icon: '📊', title: 'Category Cutoff Check',
            simple:   'At the end of each difficulty group, minimum marks must be achieved.',
            detailed: 'The system checks at the last question of each category whether the minimum correct count was met.',
            technical:'getCatCorrect = (start, len) => upScores.slice(start, start+len).filter(s=>s.score===1).length\nCat1@Q10: < MIN_CORRECT.SINGLE_NUMBER → stop\nCat2@Q20: < MIN_CORRECT.DOUBLE_NUMBER → stop\nCat3@Q24: < MIN_CORRECT.SUBTRACTION → stop',
            branches: [{ label: 'Below cutoff → STOP', color: '#dc2626' }, { label: 'Above cutoff → Next category', color: '#10b981' }] },
        { type: 'process',  icon: '🏆', title: 'Final Score Calculated',
            simple:   'The total number of correct answers becomes the final score.',
            detailed: 'Score = count of all score records where score === 1. This is saved to the game_sessions.score column.',
            technical:'finalScore = upScores.filter(s=>s.score===1).length\nPUT /sessions/update: { score: finalScore, status:"completed" }' },
        { type: 'process',  icon: '📋', title: 'Score Metrics Generated',
            simple:   'The score screen shows several performance metrics.',
            detailed: 'Metrics include: Total Score, Correct Count, Incorrect Count, Percentage, Total Time, Average Time per Question.',
            technical:'Correct: getTotalScore()\nTotal time: allScores.reduce((acc,s)=>acc+(s.timeTaken||0),0)\nAvg time: totalTime / (allScores.length || 1)\nPercentage: (correct / QUESTIONS.length * 100).toFixed(1)' },
        { type: 'success',  icon: '✅', title: 'Score Complete',
            simple:   'Assessment scoring is done. Assessment form follows.',
            detailed: 'All per-question results are displayed in a table. The behavioral assessment form then appears for the assessor to complete.',
            technical:'screen = "score" → SessionAssessmentForm renders\nassessmentSubmitted controls which buttons appear after form submit' },
    ],

    api: [
        { type: 'start',    icon: '📱', title: 'Client-Side Event',
            simple:   'Something happens in the game — a button click, a question answer, or the game ending.',
            detailed: 'Every significant game action (start, score, pause, quit, submit assessment) triggers an API call to the backend server.',
            technical:'React state change or user interaction → async axios call → awaits server response' },
        { type: 'api',      icon: '🔍', title: 'Resume Check',
            simple:   'Check if the child can continue a previous session.',
            detailed: 'Called once when the game loads. Returns the latest session for this child/game.',
            technical:`GET /api/games/sessions/resume/:childId/${game.key}\nAuth: child session\nResponse: { success, sessionInfo: { id, status, saved_state, attempt_no } | null }` },
        { type: 'api',      icon: '▶️', title: 'Start Session',
            simple:   'Create a new session record when the child starts.',
            detailed: 'Returns a session ID used for all subsequent updates. Deduplication prevents duplicate sessions.',
            technical:`POST /api/games/sessions/start\nBody: { child_id, game_name:"${game.key}", total_questions }\nResponse: { success, sessionId, attempt_no }\nHTTP 201 (new) or 200 (reused)` },
        { type: 'api',      icon: '💾', title: 'Progress Update (Repeated)',
            simple:   'After every question, the progress is saved to the server.',
            detailed: 'Called after each question and also on pause/quit. Carries the full game snapshot so sessions can be resumed.',
            technical:`PUT /api/games/sessions/update/:sessionId\nBody: { score, progress_level, status, saved_state: { questionIndex, allScores, timerSeconds, qTimer, pauses } }\nStatus values: "in_progress" | "paused" | "quit" | "completed" | "dropped"` },
        { type: 'decision', icon: '🛡️', title: 'Terminal Status Guard',
            simple:   'Once a session is ended, it cannot be accidentally marked as completed.',
            detailed: 'The server checks: if the current status is "quit" or "dropped", it will never overwrite it with "completed". This prevents client bugs from corrupting data.',
            technical:`if (status==="completed" && (currentStatus==="quit" || currentStatus==="dropped"))\n  return res.status(200).json({ message:"Session already finalized" })\n// No DB update performed`,
            branches: [{ label: 'Terminal → Reject (200, preserved)', color: '#f59e0b' }, { label: 'Valid transition → Update DB', color: '#10b981' }] },
        { type: 'api',      icon: '📋', title: 'Assessment Submission',
            simple:   'Assessor observations are sent to the server.',
            detailed: 'Saves behavioral data to a separate table linked by session_id.',
            technical:`POST /api/games/assessments\nBody: { session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again, q5_behaviors:[], additional_notes }\nDB: INSERT INTO game_assessments` },
        { type: 'api',      icon: '📄', title: 'PDF Upload',
            simple:   'The session dashboard is saved as a PDF file.',
            detailed: 'Score screen is captured with html2canvas, converted to PDF via jsPDF, then uploaded as a file.',
            technical:`POST /api/games/pdfs/upload (multipart/form-data)\nFields: pdf (file), child_id, session_id, game_name\nDB: INSERT INTO game_dashboard_pdfs (file_path)\nFile: /dashboard_pdfs/[name].pdf` },
        { type: 'api',      icon: '📈', title: 'Admin Report',
            simple:   'The administrator views the complete session data.',
            detailed: 'Admin-only endpoint. Returns session records with per-question scores, behavioral assessment, and PDF link.',
            technical:`GET /api/games/reports/detail/${game.key}\nAuth: Admin JWT Bearer token\nReturns: { columns, data: [{ session_id, score, question_scores, assessment, pdf_url }] }` },
        { type: 'success',  icon: '✅', title: 'Data Cycle Complete',
            simple:   'All game data is safely stored and accessible to administrators.',
            detailed: 'Three tables contain the full session record: game_sessions, game_assessments, game_dashboard_pdfs.',
            technical:'game_sessions: status="completed", end_time, saved_state\ngame_assessments: q1–q4, behaviors[], notes\ngame_dashboard_pdfs: file_path\nAll joined in /reports/detail response' },
    ],

    session: [
        { type: 'start',    icon: '🟢', title: 'Status: in_progress',
            simple:   'The session is active — the child is playing.',
            detailed: 'Set when the session is created. Updated with score and saved_state on every question advance.',
            technical:`game_sessions.status = "in_progress"\nCreated by: POST /sessions/start\nUpdated by: PUT /sessions/update after each question` },
        { type: 'decision', icon: '⏸️', title: 'Assessor Pauses?',
            simple:   'The assessor can pause the session at any time.',
            detailed: 'Pause saves the full game state to the server. A pause event (with timestamp and reason) is appended to the pauses array in saved_state.',
            technical:`PUT /sessions/update: { status:"paused", quit_reason: reason, saved_state: { ...state, pauses: [...pauses, { questionNumber, reason, timestamp }] } }\nThen: navigate("/")`,
            branches: [{ label: 'Yes → Pause & Save', color: '#f59e0b' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🟡', title: 'Status: paused',
            simple:   'The game is saved and the child can resume later.',
            detailed: 'On next visit, the resume check returns this session. The assessor can choose to resume or start fresh.',
            technical:'game_sessions.status = "paused"\nResume: GET /sessions/resume → sessionInfo.saved_state contains full snapshot\nResume: setQuestionIndex, setAllScores, setTimerSeconds from saved_state' },
        { type: 'decision', icon: '🚪', title: 'Assessor Quits?',
            simple:   'The assessor can end the session early for any reason.',
            detailed: 'Quit requires a reason to be entered. The game transitions to the score screen.',
            technical:`PUT /sessions/update: { status:"quit", quit_reason: reason, end_time:NOW() }\nsetScreen("score") → setTimeout(generateAndUploadPDF, 1500)`,
            branches: [{ label: 'Yes → Quit', color: '#dc2626' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🔴', title: 'Status: quit',
            simple:   'The session was ended early by the assessor.',
            detailed: 'Score screen shows "Assessment Terminated" with the quit reason. Assessment form still appears for behavioral data.',
            technical:'game_sessions.status = "quit"\nquit_reason saved\nend_time = NOW()\nScore screen: quitReason ? "Assessment Terminated" : "Assessment Complete"' },
        { type: 'decision', icon: '📏', title: 'Stop Rule Triggered?',
            simple:   'The system may stop the game automatically based on performance rules.',
            detailed: '3 consecutive wrong answers, or category minimum not met — both trigger automatic game stop.',
            technical:'processScoring() → shouldStop = consecutive>=3 OR catCorrect<minCorrect\nif shouldStop: setScreen("score"), PUT update: { status:"completed" }',
            branches: [{ label: 'Yes → Automatic Stop', color: '#dc2626' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🟢', title: 'Status: completed',
            simple:   'The session ended normally — either all questions done or a stop rule triggered.',
            detailed: 'This status is used for both natural completion and automatic stops. The score reflects how far the child reached.',
            technical:'game_sessions.status = "completed"\nend_time = NOW()\nNote: stop-rule sessions show attempted_questions < total_questions in reports' },
        { type: 'process',  icon: '🛡️', title: 'Terminal Status Guard',
            simple:   'Once ended, a session status cannot be changed.',
            detailed: 'The server enforces that "quit" or "dropped" sessions can never be overwritten as "completed". This is a hard server-side rule.',
            technical:'Backend guard: if (newStatus==="completed" && (current==="quit"||current==="dropped"))\n→ return 200 { message:"Session already finalized" }\n→ No DB write performed' },
        { type: 'success',  icon: '📊', title: 'Report Available',
            simple:   'The administrator can view the complete session in the Reports panel.',
            detailed: 'All data — session, assessment, PDF — is linked by session_id and visible in the admin Reports module.',
            technical:'GET /api/games/reports/detail/:gameName (admin JWT required)\nJOINs: game_sessions + children + game_assessments + game_dashboard_pdfs' },
    ],
});

const FLOW_SECTIONS = [
    { key: 'journey',  icon: '🎮', label: 'Game Journey'      },
    { key: 'question', icon: '❓', label: 'Question Flow'     },
    { key: 'score',    icon: '🏆', label: 'Score & Cutoff'    },
    { key: 'api',      icon: '🔗', label: 'API Flow'          },
    { key: 'session',  icon: '🗄️', label: 'Session States'   },
];

const FlowNode = ({ node, layer, isLast }) => {
    const [hov, setHov] = useState(false);
    const meta = NODE_META[node.type] || NODE_META.process;
    const desc = layer === 'simple' ? node.simple
               : layer === 'detailed' ? (node.detailed || node.simple)
               : (node.technical || node.detailed || node.simple);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            {/* Node card */}
            <div
                onMouseEnter={() => setHov(true)}
                onMouseLeave={() => setHov(false)}
                style={{
                    width: '100%', maxWidth: '680px',
                    background: hov ? meta.lightBg : T.white,
                    border: `1px solid ${hov ? meta.border : T.border}`,
                    borderLeft: `5px solid ${meta.border}`,
                    borderRadius: '12px', padding: '16px 18px',
                    boxShadow: hov ? `0 6px 20px rgba(0,0,0,0.08), 0 0 0 1px ${meta.border}30` : T.shadow,
                    transition: 'all 0.18s',
                }}
            >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: meta.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                        {node.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: T.text }}>{node.title}</span>
                            <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: meta.badgeBg, color: meta.badgeColor, letterSpacing: '0.06em' }}>
                                {meta.badge}
                            </span>
                            {node.isRef && (
                                <span style={{ fontSize: '0.7rem', color: T.accent, fontWeight: 600 }}>{node.refLabel}</span>
                            )}
                        </div>
                    </div>
                </div>
                {/* Description */}
                <div style={{ fontSize: layer === 'technical' ? '0.78rem' : '0.84rem', color: T.muted, lineHeight: 1.65, whiteSpace: layer === 'technical' ? 'pre-wrap' : 'normal', fontFamily: layer === 'technical' ? 'monospace' : T.font }}>
                    {desc}
                </div>
                {/* Branches for decision nodes */}
                {node.branches && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {node.branches.map(b => (
                            <span key={b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: `${b.color}12`, border: `1px solid ${b.color}40`, borderRadius: '7px', padding: '4px 11px', fontSize: '0.76rem', fontWeight: 600, color: b.color }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                                {b.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            {/* Arrow connector */}
            {!isLast && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
                    <div style={{ width: '2px', height: '16px', background: `linear-gradient(to bottom, ${T.border}, ${T.faint})` }} />
                    <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `8px solid ${T.faint}` }} />
                </div>
            )}
        </div>
    );
};

const WorkflowDiagramViewer = ({ game, section }) => {
    const [layer, setLayer]           = useState('simple');
    const [activeFlow, setActiveFlow] = useState('journey');
    const [syncedAt]                  = useState(new Date());

    const modules = getConnectedModules(game);
    const flows   = makeWorkflowFlows(game);
    const nodes   = flows[activeFlow] || [];
    const fmtSync = (d) => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const typeColor = { Frontend: '#4f46e5', Component: '#8b5cf6', Backend: '#059669', Routes: '#0891b2', Database: '#f59e0b' };

    const layerMeta = [
        { key: 'simple',   icon: '👥', label: 'Simple',   sub: 'For all teams' },
        { key: 'detailed', icon: '🔍', label: 'Detailed', sub: 'For researchers, QA' },
        { key: 'technical',icon: '💻', label: 'Technical',sub: 'For developers' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: T.font, overflow: 'hidden' }}>

            {/* Status banner */}
            <div style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)', borderBottom: `1px solid ${T.accentBd}`, padding: '12px 22px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: T.accentBg, border: `1px solid ${T.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🔀</div>
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: T.accentText }}>Workflow Diagram — {game.title}</div>
                            <div style={{ fontSize: '0.72rem', color: T.muted }}>Dynamic Visual Workflow Engine · {fmtSync(syncedAt)}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[{ dot:'#10b981',label:'Live Synced'},{ dot:'#4f46e5',label:'Game Logic Connected'},{ dot:'#059669',label:'Auto Generated'}].map(s=>(
                            <span key={s.label} style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:T.white, border:`1px solid ${T.border}`, borderRadius:'999px', padding:'3px 10px', fontSize:'0.72rem', fontWeight:600, color:T.text, boxShadow:T.shadow }}>
                                <span style={{ width:'7px',height:'7px',borderRadius:'50%',background:s.dot,display:'inline-block',boxShadow:`0 0 5px ${s.dot}80` }} />{s.label}
                            </span>
                        ))}
                    </div>
                </div>
                <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '0.76rem', color: T.muted, marginBottom: '8px' }}>
                    <span style={{ fontWeight: 700, color: T.accentText }}>⚡ Dynamic Workflow — </span>
                    Visual workflows are generated from live frontend and backend game logic. All decision flows, API calls, stop rules, and session states are automatically derived from the actual running game system.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {modules.map(m => (
                        <span key={m.file} style={{ display:'inline-flex', alignItems:'center', gap:'4px', background:T.white, border:`1px solid ${T.border}`, borderRadius:'6px', padding:'2px 8px', fontSize:'0.67rem', color:T.muted, boxShadow:T.shadow }}>
                            <span style={{ fontSize:'0.75rem' }}>{m.icon}</span>
                            <span style={{ fontSize:'0.55rem', fontWeight:700, padding:'1px 4px', borderRadius:'3px', background:`${typeColor[m.type]||'#64748b'}15`, color:typeColor[m.type]||T.muted }}>{m.type}</span>
                            {m.file}
                        </span>
                    ))}
                </div>
            </div>

            {/* Controls bar */}
            <div style={{ background: T.white, borderBottom: `1px solid ${T.border}`, padding: '12px 22px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Layer selector */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.faint, alignSelf: 'center', marginRight: '4px' }}>AUDIENCE:</span>
                    {layerMeta.map(lm => (
                        <button key={lm.key} onClick={() => setLayer(lm.key)} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                            border: `1.5px solid ${layer === lm.key ? T.accent : T.border}`,
                            background: layer === lm.key ? T.accentBg : T.white,
                            color: layer === lm.key ? T.accentText : T.muted,
                            fontSize: '0.8rem', fontWeight: 700,
                            transition: 'all 0.15s', fontFamily: T.font,
                        }}>
                            <span>{lm.icon}</span> {lm.label}
                            <span style={{ fontSize: '0.65rem', fontWeight: 400, color: layer === lm.key ? T.accent : T.faint }}>({lm.sub})</span>
                        </button>
                    ))}
                </div>
                {/* Flow section tabs */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.faint, alignSelf: 'center', marginRight: '4px' }}>FLOW:</span>
                    {FLOW_SECTIONS.map(fs => (
                        <button key={fs.key} onClick={() => setActiveFlow(fs.key)} style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
                            border: `1px solid ${activeFlow === fs.key ? T.accent : T.border}`,
                            background: activeFlow === fs.key ? T.accentBg : '#fafafa',
                            color: activeFlow === fs.key ? T.accentText : T.text,
                            fontSize: '0.78rem', fontWeight: activeFlow === fs.key ? 700 : 500,
                            transition: 'all 0.15s', fontFamily: T.font,
                        }}>
                            {fs.icon} {fs.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Workflow canvas */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                    {/* Section header */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.accent, marginBottom: '4px' }}>
                            {game.title} · {FLOW_SECTIONS.find(f=>f.key===activeFlow)?.label}
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: T.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                            {FLOW_SECTIONS.find(f=>f.key===activeFlow)?.icon} {FLOW_SECTIONS.find(f=>f.key===activeFlow)?.label} Diagram
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: T.muted, margin: 0 }}>
                            {layer === 'simple'    ? 'Plain language explanation for assessors, trainers, and SSL teams.' :
                             layer === 'detailed'  ? 'Technical workflow for researchers, QA, and functional reviewers.' :
                                                    'Full implementation detail for developers and system architects.'}
                        </p>
                    </div>
                    {/* Node flow */}
                    {nodes.map((node, idx) => (
                        <FlowNode key={node.title} node={node} layer={layer} isLast={idx === nodes.length - 1} />
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Connected-modules metadata per game ─────────────────────────────────────

const GAME_FILE_MAP = {
    atlantis_bagiya:        'AtlantisBagiyaGame.jsx',
    number_recall_lottery:  'NumberRecallGame.jsx',
    number_recall_lottery_v2:  'NumberRecallGameV2.jsx',
    rover_mela:             'ChaloMelaChaleGame.jsx',
    auditory_dhyan:         'AuditoryAttentionGame.jsx',
    working_memory_herpher: 'HerPherGame.jsx',
    numeracy_number_skill:  'NumberSkillGame.jsx',
    literacy_reading_skill: 'ReadingSkillGame.jsx',
    cognitive_flex_chor:    'ChorMachayeShorGame.jsx',
    triangle_rachna:        'TriangleRachnaGame.jsx',
};

const getConnectedModules = (game) => [
    { file: GAME_FILE_MAP[game.key] || `${game.title}Game.jsx`, type: 'Frontend',  icon: '⚛️',  desc: 'Screen flow, game logic, timers, scoring, session state' },
    { file: 'SessionAssessmentForm.jsx',                         type: 'Component', icon: '🧩',  desc: 'Behavioral assessment form — all observation fields' },
    { file: 'gameController.js',                                 type: 'Backend',   icon: '🖥️',  desc: 'Session lifecycle, score processing, report generation' },
    { file: 'gameRoutes.js',                                     type: 'Routes',    icon: '🔀',  desc: 'REST API endpoint definitions and middleware' },
    { file: 'db.js → game_sessions',                             type: 'Database',  icon: '🗄️',  desc: 'Session storage — score, saved state, status, timing' },
    { file: 'db.js → game_assessments',                          type: 'Database',  icon: '🗄️',  desc: 'Behavioral assessment form data storage' },
    { file: 'db.js → game_dashboard_pdfs',                       type: 'Database',  icon: '🗄️',  desc: 'PDF export file path storage' },
];

// ─── Dynamic Doc Viewer (read-only — no edit/save/history) ────────────────────

const DynamicDocViewer = ({ game, section, docKey, defaultContent }) => {
    const [content, setContent]   = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [syncedAt]              = useState(new Date());

    const loadDoc = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${API_URL}/docs/${docKey}`, authHeader());
            setContent(res.data.doc ? res.data.doc.content : defaultContent);
        } catch {
            setContent(defaultContent);
        } finally {
            setIsLoading(false);
        }
    }, [docKey, defaultContent]);

    useEffect(() => { loadDoc(); }, [loadDoc]);

    const modules = getConnectedModules(game);
    const fmtSync = (d) => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const typeColor = { Frontend: '#4f46e5', Component: '#8b5cf6', Backend: '#059669', Routes: '#0891b2', Database: '#f59e0b' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: T.font, overflow: 'hidden' }}>

            {/* System Status Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
                borderBottom: `1px solid ${T.accentBd}`,
                padding: '14px 22px', flexShrink: 0,
            }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: T.accentBg, border: `1px solid ${T.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                            ⚙️
                        </div>
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: T.accentText }}>
                                {section.label} — {game.title}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: T.muted }}>
                                Dynamic Intelligence Layer · Last synced {fmtSync(syncedAt)}
                            </div>
                        </div>
                    </div>
                    {/* Status pills */}
                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                        {[
                            { dot: '#10b981', label: 'Live Synced' },
                            { dot: '#4f46e5', label: 'Game Logic Connected' },
                            { dot: '#059669', label: 'Auto Updated' },
                        ].map(s => (
                            <span key={s.label} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                background: T.white, border: `1px solid ${T.border}`,
                                borderRadius: '999px', padding: '3px 10px',
                                fontSize: '0.72rem', fontWeight: 600, color: T.text,
                                boxShadow: T.shadow,
                            }}>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.dot, display: 'inline-block', boxShadow: `0 0 5px ${s.dot}80` }} />
                                {s.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Info message */}
                <div style={{
                    background: T.white, border: `1px solid ${T.border}`,
                    borderRadius: '9px', padding: '10px 14px',
                    fontSize: '0.78rem', color: T.muted, lineHeight: 1.6, marginBottom: '10px',
                }}>
                    <span style={{ fontWeight: 700, color: T.accentText }}>⚡ Dynamic Documentation — </span>
                    This document is directly connected with the live SANGIAN game system.
                    All workflows, APIs, score logic, cutoff calculations, assessment behavior, and data flow
                    are automatically synchronized with the latest frontend and backend game logic.
                    <span style={{ fontWeight: 600, color: T.text }}> No manual editing is required or available.</span>
                </div>

                {/* Connected modules */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {modules.map(m => (
                        <span key={m.file} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            background: T.white, border: `1px solid ${T.border}`,
                            borderRadius: '7px', padding: '3px 9px',
                            fontSize: '0.69rem', color: T.muted,
                            boxShadow: T.shadow,
                        }}>
                            <span style={{ fontSize: '0.8rem' }}>{m.icon}</span>
                            <span style={{
                                fontSize: '0.58rem', fontWeight: 700, padding: '1px 5px',
                                borderRadius: '4px', background: `${typeColor[m.type] || '#64748b'}15`,
                                color: typeColor[m.type] || T.muted,
                            }}>
                                {m.type}
                            </span>
                            <span style={{ fontWeight: 500 }}>{m.file}</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Read-only content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: T.faint, fontSize: '0.88rem' }}>
                        Synchronizing documentation…
                    </div>
                ) : (
                    <div
                        style={{
                            background: T.white, borderRadius: T.radius, padding: '28px',
                            boxShadow: T.shadow, lineHeight: '1.75', color: '#374151',
                            fontSize: '0.9rem', border: `1px solid ${T.border}`,
                        }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                    />
                )}
            </div>
        </div>
    );
};

// ─── Screenshot Library Viewer ────────────────────────────────────────────────

const SCREEN_TYPES_SS = [
    { value: 'intro',        label: 'Intro / Splash',   icon: '🎬' },
    { value: 'instructions', label: 'Instructions',     icon: '📋' },
    { value: 'gameplay',     label: 'Gameplay',         icon: '▶️' },
    { value: 'result',       label: 'Result / Score',   icon: '📊' },
    { value: 'assessment',   label: 'Assessment Form',  icon: '📝' },
    { value: 'other',        label: 'Other',            icon: '📌' },
];

const SERVER_BASE_SS = (() => {
    try { return API_URL.replace(/\/api$/, ''); } catch { return ''; }
})();

const DOCS_LANGUAGES = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'hi', label: '🇮🇳 Hindi' },
    { code: 'mr', label: '🇮🇳 Marathi' },
    { code: 'te', label: '🇮🇳 Telugu' },
    { code: 'kn', label: '🇮🇳 Kannada' },
];
const docsLangLabel = (code) => DOCS_LANGUAGES.find(l => l.code === code)?.label || code;

const ScreenshotLibraryViewer = ({ game }) => {
    const [lang,         setLang]        = useState('en');
    const [screenshots,  setScreenshots] = useState([]);
    const [loading,      setLoading]     = useState(false);
    const [showUpload,   setShowUpload]  = useState(false);
    const [editTarget,   setEditTarget]  = useState(null);
    const [form,         setForm]        = useState({ title: '', description: '', screen_type: 'gameplay', sort_order: 0 });
    const [imageFile,    setImageFile]   = useState(null);
    const [imgPreview,   setImgPreview]  = useState(null);
    const [saving,       setSaving]      = useState(false);
    const [toast,        setToast]       = useState(null);
    const [lightbox,     setLightbox]    = useState(null);
    const [manualStatus, setManualStatus]= useState(null);
    const [dragOver,     setDragOver]    = useState(false);
    const fileRef = useRef();

    const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3200); };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [ssRes, stRes] = await Promise.all([
                axios.get(`${API_URL}/screenshots?game_key=${game.key}&language=${lang}`, authHeader()),
                axios.get(`${API_URL}/screenshots/manual-status`, authHeader()),
            ]);
            setScreenshots(ssRes.data.screenshots || []);
            const statuses = stRes.data.statuses || [];
            setManualStatus(statuses.find(s => s.game_key === game.key && s.language === lang) || null);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [game.key, lang]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const handler = (e) => {
            if (!lightbox) return;
            if (e.key === 'ArrowLeft')  setLightbox(lb => ({ ...lb, i: (lb.i - 1 + lb.list.length) % lb.list.length }));
            if (e.key === 'ArrowRight') setLightbox(lb => ({ ...lb, i: (lb.i + 1) % lb.list.length }));
            if (e.key === 'Escape')     setLightbox(null);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [lightbox]);

    const handleFileSelect = (file) => {
        if (!file) return;
        setImageFile(file);
        const r = new FileReader(); r.onload = e => setImgPreview(e.target.result); r.readAsDataURL(file);
    };

    const openUpload = () => { setEditTarget(null); setForm({ title: '', description: '', screen_type: 'gameplay', sort_order: 0 }); setImageFile(null); setImgPreview(null); setShowUpload(true); };
    const openEdit   = (ss) => { setEditTarget(ss); setForm({ title: ss.title, description: ss.description || '', screen_type: ss.screen_type, sort_order: ss.sort_order }); setImageFile(null); setImgPreview(`${SERVER_BASE_SS}${ss.image_path}`); setShowUpload(true); };

    const handleSave = async () => {
        if (!form.title.trim()) return showToast('Title is required', false);
        if (!editTarget && !imageFile) return showToast('Select an image', false);
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('game_key', game.key); fd.append('language', lang);
            fd.append('screen_type', form.screen_type); fd.append('title', form.title.trim());
            fd.append('description', form.description.trim()); fd.append('sort_order', form.sort_order);
            if (imageFile) fd.append('image', imageFile);
            if (editTarget) { await axios.put(`${API_URL}/screenshots/${editTarget.id}`, fd, authHeader()); showToast('Screenshot updated'); }
            else            { await axios.post(`${API_URL}/screenshots/upload`, fd, authHeader()); showToast('Screenshot uploaded'); }
            setShowUpload(false); load();
        } catch (e) { showToast(e?.response?.data?.message || 'Save failed', false); }
        finally { setSaving(false); }
    };

    const handleDelete = async (ss) => {
        if (!window.confirm(`Delete "${ss.title}"?`)) return;
        try { await axios.delete(`${API_URL}/screenshots/${ss.id}`, authHeader()); showToast('Deleted'); load(); }
        catch { showToast('Delete failed', false); }
    };

    const handlePublish = async () => {
        if (screenshots.length === 0) return showToast('No screenshots to publish', false);
        if (!window.confirm(`Publish all ${screenshots.length} screenshot(s) for ${game.title} (${lang.toUpperCase()}) and generate the Gameplay Manual?`)) return;
        try {
            const res = await axios.post(`${API_URL}/screenshots/publish`, { game_key: game.key, language: lang }, authHeader());
            showToast(`✓ Manual published — ${res.data.screenshot_count} screenshot(s)`); load();
        } catch { showToast('Publish failed', false); }
    };

    const publishBadge = () => {
        if (!manualStatus) return { label: '● Not Published', bg: '#f1f5f9', color: '#64748b', bd: T.border };
        if (manualStatus.needs_republish) return { label: '⚠ Needs Republish', bg: '#fffbeb', color: '#92400e', bd: '#fde68a' };
        const dt = manualStatus.published_at ? new Date(manualStatus.published_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
        return { label: `✓ Published${dt ? ' · ' + dt : ''}`, bg: '#f0fdf4', color: '#166534', bd: '#bbf7d0' };
    };

    const badge = publishBadge();
    const btnStyle = { padding: '7px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: T.font, overflow: 'hidden' }}>

            {/* Banner */}
            <div style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom: `1px solid ${T.accentBd}`, padding: '12px 22px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: T.accentBg, border: `1px solid ${T.accentBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🖼️</div>
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: T.accentText }}>Screenshot Library — {game.title}</div>
                            <div style={{ fontSize: '0.72rem', color: T.muted }}>Upload, organise, and publish screenshots to auto-generate the Gameplay Manual</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Publish status */}
                        <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: badge.bg, color: badge.color, border: `1px solid ${badge.bd}` }}>{badge.label}</span>
                        {/* Language toggle */}
                        <div style={{ display: 'flex', background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
                            {DOCS_LANGUAGES.map(({code:l,label:lbl}) => (
                                <button key={l} onClick={() => setLang(l)} style={{ ...btnStyle, background: lang===l ? T.accent : 'transparent', color: lang===l ? '#fff' : T.muted, borderRadius: 0, padding: '5px 14px' }}>{lbl}</button>
                            ))}
                        </div>
                        <button onClick={openUpload} style={{ ...btnStyle, background: T.accent, color: '#fff' }}>+ Upload</button>
                        <button onClick={handlePublish} disabled={screenshots.length === 0} style={{ ...btnStyle, background: screenshots.length ? '#059669' : '#e2e8f0', color: screenshots.length ? '#fff' : T.faint }}>🚀 Publish Manual</button>
                    </div>
                </div>
            </div>

            {/* Gallery */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
                {loading && <div style={{ textAlign: 'center', padding: '60px', color: T.faint }}>Loading…</div>}
                {!loading && screenshots.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '70px 40px', color: T.faint }}>
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>📸</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: T.muted, marginBottom: 6 }}>
                            {lang === 'hi' ? 'अभी तक कोई स्क्रीनशॉट नहीं' : 'No screenshots yet'}
                        </div>
                        <div style={{ fontSize: '0.82rem', marginBottom: 18 }}>
                            {lang === 'hi'
                                ? <><strong>{game.title}</strong> के लिए हिंदी में स्क्रीनशॉट अपलोड करें।</>
                                : <>Upload screenshots for <strong>{game.title}</strong> in English to get started.</>}
                        </div>
                        <button onClick={openUpload} style={{ ...btnStyle, background: T.accent, color: '#fff' }}>
                            {lang === 'hi' ? '+ पहला स्क्रीनशॉट अपलोड करें' : '+ Upload First Screenshot'}
                        </button>
                    </div>
                )}
                {!loading && screenshots.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
                        {screenshots.map((ss, idx) => (
                            <div key={ss.id} style={{ background: T.white, border: `1px solid ${ss.publish_status === 'published' ? '#86efac' : T.border}`, borderLeft: `4px solid ${ss.publish_status === 'published' ? '#10b981' : '#f59e0b'}`, borderRadius: 12, overflow: 'hidden', boxShadow: T.shadow, transition: 'box-shadow 0.18s' }}>
                                {/* Thumbnail */}
                                <div style={{ position: 'relative', height: 145, background: '#f8fafc', cursor: 'zoom-in', overflow: 'hidden' }} onClick={() => setLightbox({ list: screenshots, i: idx })}>
                                    <img src={`${SERVER_BASE_SS}${ss.image_path}`} alt={ss.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <span style={{ position: 'absolute', top: 7, right: 7, fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: ss.publish_status === 'published' ? 'rgba(16,185,129,0.85)' : 'rgba(245,158,11,0.85)', color: ss.publish_status === 'published' ? '#022c22' : '#1c1917', textTransform: 'uppercase' }}>
                                        {ss.publish_status === 'published' ? '✓ Published' : '✏ Draft'}
                                    </span>
                                    <span style={{ position: 'absolute', top: 7, left: 7, fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(79,70,229,0.85)', color: '#fff', textTransform: 'capitalize' }}>
                                        {SCREEN_TYPES_SS.find(t => t.value === ss.screen_type)?.icon} {ss.screen_type}
                                    </span>
                                </div>
                                {/* Body */}
                                <div style={{ padding: '10px 13px' }}>
                                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: T.text, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ss.title}</div>
                                    {ss.description && <div style={{ fontSize: '0.74rem', color: T.muted, marginBottom: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ss.description}</div>}
                                    <div style={{ fontSize: '0.68rem', color: T.faint, marginBottom: 9 }}>Order: {ss.sort_order} · {new Date(ss.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {[{ label: '✏ Edit', fn: () => openEdit(ss), color: T.accent }, { label: '🔍 View', fn: () => setLightbox({ list: screenshots, i: idx }), color: '#0891b2' }, { label: '🗑', fn: () => handleDelete(ss), color: '#dc2626' }].map(b => (
                                            <button key={b.label} onClick={b.fn} style={{ flex: b.label === '🗑' ? 'none' : 1, padding: '4px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', background: 'transparent', border: `1px solid ${b.color}20`, color: b.color, transition: 'all 0.15s' }}>{b.label}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload/Edit Modal */}
            {showUpload && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }} onClick={() => setShowUpload(false)}>
                    <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: T.shadowLg }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 800, color: T.text }}>{editTarget ? '✏ Edit Screenshot' : '📤 Upload Screenshot'}</h2>
                        {/* Drop zone */}
                        <div style={{ border: `2px dashed ${dragOver ? T.accent : T.border}`, borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', background: dragOver ? T.accentBg : '#f8fafc', marginBottom: 16, transition: 'all 0.2s' }}
                            onClick={() => fileRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}>
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
                            {imgPreview ? <img src={imgPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'contain' }} />
                                : <><div style={{ fontSize: '2rem', marginBottom: 6 }}>🖼</div><div style={{ fontSize: '0.82rem', color: T.muted }}>Click or drag & drop an image (PNG, JPG, WebP · max 10MB)</div></>}
                        </div>
                        {/* Fields */}
                        {[{ label: 'Title *', key: 'title', type: 'input', ph: 'e.g. Splash Screen — Welcome' }, { label: 'Description (shown in manual)', key: 'description', type: 'textarea', ph: 'Describe what this screen shows…' }].map(f => (
                            <div key={f.key} style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: T.muted, marginBottom: 5 }}>{f.label}</label>
                                {f.type === 'input'
                                    ? <input value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} placeholder={f.ph} style={{ width: '100%', padding: '8px 11px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: '0.85rem', color: T.text, boxSizing: 'border-box', background: T.bg }} />
                                    : <textarea value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} placeholder={f.ph} rows={3} style={{ width: '100%', padding: '8px 11px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: '0.85rem', color: T.text, boxSizing: 'border-box', background: T.bg, resize: 'vertical' }} />}
                            </div>
                        ))}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: T.muted, marginBottom: 5 }}>Screen Type</label>
                                <select value={form.screen_type} onChange={e => setForm(p => ({...p, screen_type: e.target.value}))} style={{ width: '100%', padding: '8px 11px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: '0.82rem', color: T.text, background: T.bg }}>
                                    {SCREEN_TYPES_SS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: T.muted, marginBottom: 5 }}>Sort Order</label>
                                <input type="number" value={form.sort_order} onChange={e => setForm(p => ({...p, sort_order: parseInt(e.target.value)||0}))} style={{ width: '100%', padding: '8px 11px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: '0.85rem', color: T.text, background: T.bg, boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: T.faint, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
                            Game: <strong style={{ color: T.text }}>{game.title}</strong> · Language: <strong style={{ color: T.text }}>{lang === 'en' ? '🇬🇧 English' : '🇮🇳 Hindi'}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowUpload(false)} style={{ ...btnStyle, background: T.bg, color: T.muted, border: `1px solid ${T.border}` }}>Cancel</button>
                            <button onClick={handleSave} disabled={saving} style={{ ...btnStyle, background: T.accent, color: '#fff', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : editTarget ? '✓ Update' : '📤 Upload'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }} onClick={() => setLightbox(null)}>
                    <button onClick={() => setLightbox(null)} style={{ position: 'fixed', top: 18, right: 22, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '50%', width: 38, height: 38, fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    <img src={`${SERVER_BASE_SS}${lightbox.list[lightbox.i].image_path}`} alt={lightbox.list[lightbox.i].title} style={{ maxWidth: '88vw', maxHeight: '76vh', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>
                        <strong style={{ color: '#e2e8f0' }}>{lightbox.list[lightbox.i].title}</strong>
                        {lightbox.list[lightbox.i].description && <div style={{ marginTop: 3 }}>{lightbox.list[lightbox.i].description}</div>}
                        <div style={{ marginTop: 5, color: '#475569', fontSize: '0.72rem' }}>{lightbox.i + 1} / {lightbox.list.length}</div>
                    </div>
                    {lightbox.list.length > 1 && (
                        <div style={{ display: 'flex', gap: 10 }} onClick={e => e.stopPropagation()}>
                            {[['← Prev', () => setLightbox(lb => ({ ...lb, i: (lb.i-1+lb.list.length)%lb.list.length }))],
                              ['Next →', () => setLightbox(lb => ({ ...lb, i: (lb.i+1)%lb.list.length }))]].map(([lbl,fn]) => (
                                <button key={lbl} onClick={fn} style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8, padding: '7px 18px', cursor: 'pointer', fontSize: '0.82rem' }}>{lbl}</button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 9999, padding: '11px 18px', borderRadius: 10, fontSize: '0.83rem', fontWeight: 600, background: toast.ok ? '#f0fdf4' : '#fef2f2', color: toast.ok ? '#166534' : '#991b1b', border: `1px solid ${toast.ok ? '#86efac' : '#fca5a5'}`, boxShadow: T.shadowMd, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {toast.ok ? '✓' : '✕'} {toast.msg}
                </div>
            )}
        </div>
    );
};

// ─── Gameplay Manual Viewer ────────────────────────────────────────────────────

const MANUAL_SECTIONS_DEF = [
    { type: 'intro',        title: 'Game Introduction',  icon: '🎬', desc: 'Splash screen and welcome — how the game starts.' },
    { type: 'instructions', title: 'Instructions',       icon: '📋', desc: 'Tutorial screens, teaching questions, and practice rounds.' },
    { type: 'gameplay',     title: 'Main Gameplay',      icon: '▶️', desc: 'Core question screens and child interaction flow.' },
    { type: 'result',       title: 'Score & Results',    icon: '📊', desc: 'Score display, metrics, and performance feedback.' },
    { type: 'assessment',   title: 'Assessment Form',    icon: '📝', desc: 'Post-session behavioral assessment completed by the assessor.' },
    { type: 'other',        title: 'Additional Screens', icon: '📌', desc: 'Other notable screens and edge-case flows.' },
];

const GameplayManualViewer = ({ game }) => {
    const [lang,        setLang]       = useState('en');
    const [screenshots, setScreenshots]= useState([]);
    const [loading,     setLoading]    = useState(false);
    const [status,      setStatus]     = useState(null);
    const [lightbox,    setLightbox]   = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [ssRes, stRes] = await Promise.all([
                axios.get(`${API_URL}/screenshots?game_key=${game.key}&language=${lang}&publish_status=published`, authHeader()),
                axios.get(`${API_URL}/screenshots/manual-status`, authHeader()),
            ]);
            setScreenshots(ssRes.data.screenshots || []);
            const st = (stRes.data.statuses || []).find(s => s.game_key === game.key && s.language === lang);
            setStatus(st || null);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [game.key, lang]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const handler = (e) => {
            if (!lightbox) return;
            if (e.key === 'ArrowLeft')  setLightbox(lb => ({ ...lb, i: (lb.i-1+lb.list.length)%lb.list.length }));
            if (e.key === 'ArrowRight') setLightbox(lb => ({ ...lb, i: (lb.i+1)%lb.list.length }));
            if (e.key === 'Escape')     setLightbox(null);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [lightbox]);

    const handleDownloadPDF = async () => {
        const el = document.getElementById('manual-pdf-area');
        if (!el) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');
            const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
            const pdf = new jsPDF('p','mm',[210,(canvas.height*210)/canvas.width]);
            pdf.addImage(canvas.toDataURL('image/jpeg',0.9),'JPEG',0,0,210,(canvas.height*210)/canvas.width);
            pdf.save(`${game.title}_manual_${lang}.pdf`);
        } catch (e) { console.error(e); }
    };

    const btnStyle = { padding: '6px 15px', borderRadius: 8, fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' };
    const pubDate  = status?.published_at ? new Date(status.published_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: T.font, overflow: 'hidden' }}>

            {/* Banner */}
            <div style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)', borderBottom:`1px solid ${T.accentBd}`, padding:'12px 22px', flexShrink: 0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:9, background:T.accentBg, border:`1px solid ${T.accentBd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>📋</div>
                        <div>
                            <div style={{ fontSize:'0.88rem', fontWeight:700, color:T.accentText }}>Gameplay Manual — {game.title}</div>
                            <div style={{ fontSize:'0.72rem', color:T.muted }}>Auto-generated from published screenshots · {status ? `Published ${pubDate}` : 'Not yet published — go to Screenshot Library first'}</div>
                        </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        {pubDate && <span style={{ padding:'4px 12px', borderRadius:20, fontSize:'0.73rem', fontWeight:700, background:'#f0fdf4', color:'#166534', border:'1px solid #bbf7d0' }}>✓ Published · {pubDate}</span>}
                        <span style={{ padding:'4px 11px', borderRadius:20, fontSize:'0.73rem', fontWeight:700, background:T.accentBg, color:T.accentText, border:`1px solid ${T.accentBd}` }}>{docsLangLabel(lang)} · {screenshots.length} screens</span>
                        {/* Language toggle */}
                        <div style={{ display:'flex', background:T.white, border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
                            {DOCS_LANGUAGES.map(({code:l,label:lbl})=>(
                                <button key={l} onClick={()=>setLang(l)} style={{ ...btnStyle, background:lang===l?T.accent:'transparent', color:lang===l?'#fff':T.muted, borderRadius:0, padding:'5px 13px' }}>{lbl}</button>
                            ))}
                        </div>
                        {screenshots.length > 0 && <button onClick={handleDownloadPDF} style={{ ...btnStyle, background:'#0891b2', color:'#fff' }}>⬇ Download PDF</button>}
                    </div>
                </div>
            </div>

            {/* Manual body */}
            <div style={{ flex:1, overflowY:'auto', padding:'22px 28px' }}>
                {loading && <div style={{ textAlign:'center', padding:'60px', color:T.faint }}>Loading…</div>}

                {!loading && screenshots.length === 0 && (
                    <div style={{ textAlign:'center', padding:'70px 40px', color:T.faint }}>
                        <div style={{ fontSize:'3rem', marginBottom:12 }}>📖</div>
                        <div style={{ fontSize:'1rem', fontWeight:700, color:T.muted, marginBottom:6 }}>Manual not yet published</div>
                        <div style={{ fontSize:'0.82rem', lineHeight:1.7 }}>Upload screenshots in the <strong style={{color:T.text}}>Screenshot Library</strong> section, then click <strong style={{color:T.text}}>Publish Manual</strong> to auto-generate this document.</div>
                    </div>
                )}

                {!loading && screenshots.length > 0 && (
                    <div id="manual-pdf-area">
                        {/* Manual header card */}
                        <div style={{ background:T.white, border:`1px solid ${T.border}`, borderRadius:14, padding:'24px 28px', marginBottom:24, boxShadow:T.shadow }}>
                            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                                <div style={{ width:52, height:52, borderRadius:12, background:T.accentBg, border:`1px solid ${T.accentBd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem' }}>{game.icon}</div>
                                <div>
                                    <h2 style={{ margin:0, fontSize:'1.4rem', fontWeight:800, color:T.text }}>{game.title} — Gameplay Manual</h2>
                                    <div style={{ fontSize:'0.78rem', color:T.muted, marginTop:3 }}>
                                        {docsLangLabel(lang)} · {screenshots.length} published screenshot{screenshots.length!==1?'s':''} · SANGIAN Documentation System
                                        {pubDate && ` · Published ${pubDate}`}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sections */}
                        {MANUAL_SECTIONS_DEF.map(sec => {
                            const items = screenshots.filter(s => s.screen_type === sec.type);
                            if (!items.length) return null;
                            return (
                                <div key={sec.type} style={{ background:T.white, border:`1px solid ${T.border}`, borderRadius:14, overflow:'hidden', marginBottom:20, boxShadow:T.shadow }}>
                                    {/* Section header */}
                                    <div style={{ padding:'14px 22px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', gap:10, background:'linear-gradient(90deg,#f8faff,#fff)' }}>
                                        <span style={{ fontSize:'1.15rem' }}>{sec.icon}</span>
                                        <div>
                                            <div style={{ fontSize:'0.92rem', fontWeight:800, color:T.text }}>{sec.title}</div>
                                            <div style={{ fontSize:'0.72rem', color:T.muted }}>{sec.desc}</div>
                                        </div>
                                        <span style={{ marginLeft:'auto', fontSize:'0.72rem', fontWeight:700, padding:'3px 10px', borderRadius:20, background:T.accentBg, color:T.accentText, border:`1px solid ${T.accentBd}` }}>{items.length} screen{items.length!==1?'s':''}</span>
                                    </div>
                                    {/* Steps */}
                                    <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:22 }}>
                                        {items.map((ss, idx) => (
                                            <div key={ss.id} style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                                                <div style={{ width:30, height:30, minWidth:30, borderRadius:'50%', background:T.accentBg, color:T.accentText, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', fontWeight:800, border:`1px solid ${T.accentBd}` }}>{idx+1}</div>
                                                <div style={{ flex:1 }}>
                                                    <img src={`${SERVER_BASE_SS}${ss.image_path}`} alt={ss.title}
                                                        style={{ width:'100%', maxWidth:520, borderRadius:10, border:`1px solid ${T.border}`, marginBottom:9, cursor:'zoom-in', transition:'transform 0.2s' }}
                                                        onClick={() => setLightbox({ list: items, i: idx })}
                                                    />
                                                    <div style={{ fontSize:'0.88rem', fontWeight:700, color:T.text, marginBottom:3 }}>{ss.title}</div>
                                                    {ss.description && <p style={{ margin:0, fontSize:'0.8rem', color:T.muted, lineHeight:1.65 }}>{ss.description}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:2000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:20 }} onClick={()=>setLightbox(null)}>
                    <button onClick={()=>setLightbox(null)} style={{ position:'fixed', top:18, right:22, background:'#1e293b', border:'1px solid #334155', color:'#e2e8f0', borderRadius:'50%', width:38, height:38, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                    <img src={`${SERVER_BASE_SS}${lightbox.list[lightbox.i].image_path}`} alt={lightbox.list[lightbox.i].title} style={{ maxWidth:'88vw', maxHeight:'76vh', objectFit:'contain', borderRadius:8 }} onClick={e=>e.stopPropagation()} />
                    <div style={{ textAlign:'center', color:'#94a3b8', fontSize:'0.84rem' }}>
                        <strong style={{ color:'#e2e8f0' }}>{lightbox.list[lightbox.i].title}</strong>
                        {lightbox.list[lightbox.i].description && <div style={{ marginTop:3 }}>{lightbox.list[lightbox.i].description}</div>}
                        <div style={{ marginTop:5, color:'#475569', fontSize:'0.72rem' }}>{lightbox.i+1} / {lightbox.list.length}</div>
                    </div>
                    {lightbox.list.length > 1 && (
                        <div style={{ display:'flex', gap:10 }} onClick={e=>e.stopPropagation()}>
                            {[['← Prev', ()=>setLightbox(lb=>({...lb,i:(lb.i-1+lb.list.length)%lb.list.length}))],
                              ['Next →', ()=>setLightbox(lb=>({...lb,i:(lb.i+1)%lb.list.length}))]].map(([lbl,fn])=>(
                                <button key={lbl} onClick={fn} style={{ background:'#1e293b', border:'1px solid #334155', color:'#e2e8f0', borderRadius:8, padding:'7px 18px', cursor:'pointer', fontSize:'0.82rem' }}>{lbl}</button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Introduction Viewer ─────────────────────────────────────────────────────

const INTRO_FIELD_DEFS = [
    { key: 'objective',   label: 'Test Objective',  labelHi: 'परीक्षण उद्देश्य',          icon: '🎯', rows: 4 },
    { key: 'description', label: 'About this Game', labelHi: 'इस खेल के बारे में',         icon: '📘', rows: 5 },
    { key: 'skill',       label: 'Cognitive Skill', labelHi: 'संज्ञानात्मक कौशल',         icon: '🧠', rows: 1 },
    { key: 'guidance',    label: 'Child Guidance',  labelHi: 'बच्चों के लिए मार्गदर्शन', icon: '💡', rows: 2 },
];

const IntroCard = ({ icon, title, titleHi, game, accent, children }) => (
    <div style={{
        background: accent
            ? `linear-gradient(135deg, ${game.color}12 0%, ${game.color}06 100%)`
            : T.white,
        border: `1px solid ${accent ? game.color + '35' : T.border}`,
        borderRadius: '12px', overflow: 'hidden', boxShadow: T.shadow,
    }}>
        <div style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${accent ? game.color + '22' : T.border}`,
            background: accent ? 'transparent' : 'linear-gradient(90deg, #f8faff, #fff)',
            display: 'flex', alignItems: 'center', gap: '8px',
        }}>
            <span style={{ fontSize: '1rem' }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: T.text }}>{title}</span>
            <span style={{ fontSize: '0.72rem', color: T.muted, fontStyle: 'italic', fontFamily: HINDI_FONT }}>/ {titleHi}</span>
        </div>
        <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
);

const BilingualBlock = ({ en, hi, fieldKey, expanded, onToggle }) => {
    const LIMIT = 220;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {[
                { lang: 'en', label: '🇬🇧 English', text: en, ff: T.font,    accent: '#1d4ed8' },
                { lang: 'hi', label: '🇮🇳 हिंदी',   text: hi, ff: HINDI_FONT, accent: '#7c3aed' },
            ].map(({ lang, label, text, ff, accent }) => {
                const key   = `${fieldKey}_${lang}`;
                const isLong = (text || '').length > LIMIT;
                const isExp  = expanded[key];
                const shown  = isLong && !isExp ? text.slice(0, LIMIT) + '…' : (text || '');
                return (
                    <div key={lang} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: `1px solid ${T.border}` }}>
                        <div style={{ fontSize: '0.67rem', fontWeight: 700, color: accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
                            {label}
                        </div>
                        <p style={{ margin: 0, fontSize: lang === 'hi' ? '0.97rem' : '0.88rem', lineHeight: 1.8, color: '#374151', fontFamily: ff }}>
                            {shown || '—'}
                        </p>
                        {isLong && (
                            <button
                                onClick={() => onToggle(key)}
                                style={{ marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: accent, padding: 0, fontFamily: ff }}
                            >
                                {isExp ? '▲ Read Less' : '▼ Read More'}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const IntroductionViewer = ({ game }) => {
    const docKey      = `${game.key}__intro`;
    const defaultData = GAME_INTRO_DEFAULTS[game.key] || { en: {}, hi: {} };

    const [data,      setData]      = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData,  setEditData]  = useState(null);
    const [isSaving,  setIsSaving]  = useState(false);
    const [saveMsg,   setSaveMsg]   = useState('');
    const [updatedAt, setUpdatedAt] = useState(null);
    const [updatedBy, setUpdatedBy] = useState(null);
    const [expanded,  setExpanded]  = useState({});

    const loadIntro = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/docs/${docKey}`, authHeader());
            if (res.data.doc?.content) {
                try { setData(JSON.parse(res.data.doc.content)); } catch { setData(defaultData); }
                setUpdatedAt(res.data.doc.updated_at);
                setUpdatedBy(res.data.doc.updated_by);
            } else {
                setData(defaultData); setUpdatedAt(null); setUpdatedBy(null);
            }
        } catch { setData(defaultData); }
        finally  { setLoading(false); }
    }, [docKey]);

    useEffect(() => { loadIntro(); }, [loadIntro]);

    const handleEdit = () => { setEditData(JSON.parse(JSON.stringify(data))); setIsEditing(true); };

    const handleSave = async () => {
        setIsSaving(true); setSaveMsg('');
        const savedBy = (() => { try { return JSON.parse(localStorage.getItem('adminUser')).name; } catch { return 'admin'; } })();
        try {
            await axios.put(`${API_URL}/docs/${docKey}`, { content: JSON.stringify(editData, null, 2), saved_by: savedBy }, authHeader());
            setData(editData); setIsEditing(false);
            setUpdatedAt(new Date().toISOString()); setUpdatedBy(savedBy);
            setSaveMsg('✅ Saved!'); setTimeout(() => setSaveMsg(''), 3000);
        } catch { setSaveMsg('❌ Save failed'); }
        finally { setIsSaving(false); }
    };

    const updateField = (lang, key, val) =>
        setEditData(prev => ({ ...prev, [lang]: { ...prev[lang], [key]: val } }));

    const toggleExpand = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

    const d = data || defaultData;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: T.font }}>

            {/* Toolbar */}
            <div style={{
                padding: '12px 22px', background: T.white, borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '8px', flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: T.text }}>📖 Introduction</div>
                    <div style={{ fontSize: '0.72rem', color: T.faint, marginTop: '1px' }}>
                        {updatedAt
                            ? `Last updated ${fmtDt(updatedAt)} · by ${updatedBy}`
                            : 'Default content — click Edit to customise'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {saveMsg && (
                        <span style={{ fontSize: '0.78rem', color: saveMsg.includes('✅') ? '#059669' : '#dc2626', fontWeight: 600 }}>
                            {saveMsg}
                        </span>
                    )}
                    {!isEditing ? (
                        <button onClick={handleEdit} style={btnSm(game.color, '#fff')}>✏️ Edit</button>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(false)} style={btnSm('rgba(15,23,42,0.04)', T.text, '1px solid rgba(15,23,42,0.08)')}>Cancel</button>
                            <button onClick={handleSave} disabled={isSaving} style={btnSm(game.color, '#fff')}>
                                {isSaving ? 'Saving…' : '💾 Save'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: T.faint, fontSize: '0.88rem' }}>
                        Loading introduction…
                    </div>
                ) : isEditing ? (

                    /* ── Edit Mode ── */
                    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{
                            background: T.accentBg, border: `1px solid ${T.accentBd}`,
                            borderRadius: '10px', padding: '12px 16px',
                            fontSize: '0.8rem', color: T.accentText, fontWeight: 600,
                        }}>
                            📝 Edit the bilingual introduction content for <strong>{game.title}</strong>.
                            Content is stored as structured JSON in the database and loaded dynamically.
                        </div>

                        {INTRO_FIELD_DEFS.map(field => (
                            <div key={field.key} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden', boxShadow: T.shadow }}>
                                <div style={{
                                    padding: '11px 18px', borderBottom: `1px solid ${T.border}`,
                                    background: 'linear-gradient(90deg, #f8faff, #fff)',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}>
                                    <span>{field.icon}</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: T.text }}>{field.label}</span>
                                    <span style={{ fontSize: '0.7rem', color: T.faint, fontStyle: 'italic', fontFamily: HINDI_FONT }}>/ {field.labelHi}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                                    {[
                                        ['en', '🇬🇧 English', T.font,    '#1d4ed8', false],
                                        ['hi', '🇮🇳 हिंदी',   HINDI_FONT, '#7c3aed', true],
                                    ].map(([lang, label, ff, accent, borderRight]) => (
                                        <div key={lang} style={{ padding: '14px 18px', borderLeft: borderRight ? `1px solid ${T.border}` : 'none' }}>
                                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: accent, marginBottom: '6px', letterSpacing: '0.04em' }}>
                                                {label}
                                            </label>
                                            <textarea
                                                value={editData[lang]?.[field.key] || ''}
                                                onChange={e => updateField(lang, field.key, e.target.value)}
                                                rows={field.rows}
                                                style={{
                                                    width: '100%', boxSizing: 'border-box',
                                                    padding: '10px 12px', border: `1.5px solid ${T.border}`,
                                                    borderRadius: '8px',
                                                    fontSize: lang === 'hi' ? '0.95rem' : '0.85rem',
                                                    fontFamily: ff, lineHeight: 1.65,
                                                    color: T.text, background: T.bg,
                                                    resize: 'vertical', outline: 'none',
                                                    transition: 'border-color 0.15s',
                                                }}
                                                onFocus={e  => { e.target.style.borderColor = game.color; }}
                                                onBlur={e   => { e.target.style.borderColor = T.border; }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                ) : (

                    /* ── View Mode ── */
                    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                        {/* Hero header card */}
                        <div style={{
                            background: `linear-gradient(135deg, ${game.color}18 0%, ${game.color}08 100%)`,
                            border: `1.5px solid ${game.color}30`, borderRadius: '14px',
                            padding: '22px 24px', boxShadow: T.shadow,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                <div style={{
                                    width: 52, height: 52, borderRadius: '13px', flexShrink: 0,
                                    background: game.color + '22', border: `1.5px solid ${game.color}44`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem',
                                }}>
                                    {game.icon}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h2 style={{ margin: '0 0 3px', fontSize: 'clamp(1rem,2vw,1.3rem)', fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>
                                        {game.title}
                                    </h2>
                                    <div style={{ fontSize: '0.82rem', color: T.muted, fontFamily: HINDI_FONT, lineHeight: 1.5 }}>
                                        {d.hi?.skill || ''}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    fontSize: '0.75rem', fontWeight: 700, padding: '5px 14px',
                                    borderRadius: '999px', background: game.color, color: '#fff',
                                    boxShadow: `0 2px 8px ${game.color}45`,
                                }}>
                                    🧠 {d.en?.skill || 'Cognitive Assessment'}
                                </span>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    fontSize: '0.75rem', fontWeight: 600, padding: '5px 14px',
                                    borderRadius: '999px', background: 'rgba(255,255,255,0.85)',
                                    border: `1px solid ${game.color}35`, color: game.color,
                                }}>
                                    📊 SANGIAN Assessment
                                </span>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    fontSize: '0.75rem', fontWeight: 600, padding: '5px 14px',
                                    borderRadius: '999px', background: 'rgba(255,255,255,0.85)',
                                    border: `1px solid ${game.color}35`, color: game.color,
                                }}>
                                    🌐 EN + हिंदी
                                </span>
                            </div>
                        </div>

                        {/* Objective */}
                        <IntroCard icon="🎯" title="Test Objective" titleHi="परीक्षण उद्देश्य" game={game}>
                            <BilingualBlock
                                en={d.en?.objective} hi={d.hi?.objective}
                                fieldKey="objective" expanded={expanded} onToggle={toggleExpand}
                            />
                        </IntroCard>

                        {/* About this Game */}
                        <IntroCard icon="📘" title="About this Game" titleHi="इस खेल के बारे में" game={game}>
                            <BilingualBlock
                                en={d.en?.description} hi={d.hi?.description}
                                fieldKey="description" expanded={expanded} onToggle={toggleExpand}
                            />
                        </IntroCard>

                        {/* Before You Start */}
                        <IntroCard icon="💡" title="Before You Start" titleHi="शुरू करने से पहले" game={game} accent>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                                {[
                                    { lang: 'en', label: '🇬🇧 English', ff: T.font,    accent: '#1d4ed8', text: d.en?.guidance },
                                    { lang: 'hi', label: '🇮🇳 हिंदी',   ff: HINDI_FONT, accent: '#7c3aed', text: d.hi?.guidance },
                                ].map(({ lang, label, ff, accent, text }) => (
                                    <div key={lang} style={{
                                        background: 'rgba(255,255,255,0.75)', borderRadius: '10px',
                                        padding: '14px 16px', border: `1px solid ${game.color}22`,
                                    }}>
                                        <div style={{ fontSize: '0.67rem', fontWeight: 700, color: accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
                                            {label}
                                        </div>
                                        <p style={{
                                            margin: 0, fontStyle: 'italic',
                                            fontSize: lang === 'hi' ? '0.97rem' : '0.87rem',
                                            lineHeight: 1.75, color: T.text, fontFamily: ff,
                                        }}>
                                            "{text || '—'}"
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </IntroCard>

                        {/* Skill tag footer */}
                        <div style={{
                            background: T.white, border: `1px solid ${T.border}`, borderRadius: '10px',
                            padding: '14px 20px', boxShadow: T.shadow,
                            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                        }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.faint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Cognitive Skill Measured
                            </span>
                            <span style={{
                                fontSize: '0.8rem', fontWeight: 700, padding: '4px 14px',
                                borderRadius: '999px', background: game.color + '12',
                                border: `1px solid ${game.color}35`, color: game.color,
                            }}>
                                🧠 {d.en?.skill || '—'}
                            </span>
                            <span style={{
                                fontSize: '0.88rem', fontFamily: HINDI_FONT, fontWeight: 600, padding: '4px 14px',
                                borderRadius: '999px', background: 'rgba(124,58,237,0.07)',
                                border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed',
                            }}>
                                🧠 {d.hi?.skill || '—'}
                            </span>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

const AdminDocs = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const gameParam = searchParams.get('game');
    const sectionParam = searchParams.get('section');

    const selectedGame = gameParam ? GAME_CATALOG.find(g => g.key === gameParam) || null : null;
    const expandedGame = selectedGame ? selectedGame.key : null;
    const selectedSection = (selectedGame && sectionParam) 
        ? GAME_SECTIONS.find(s => s.key === sectionParam) || null 
        : null;

    const handleHome = () => { 
        setSearchParams({}); 
    };

    const handleGameClick = (game) => {
        if (expandedGame === game.key && !selectedSection) {
            setSearchParams({});
        } else {
            setSearchParams({ game: game.key });
        }
    };

    const handleSectionClick = (game, section) => {
        setSearchParams({ game: game.key, section: section.key });
    };

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 120px)', fontFamily: T.font, overflow: 'hidden' }}>
            <Sidebar
                expandedGame={expandedGame}
                selectedGame={selectedGame}
                selectedSection={selectedSection}
                onHome={handleHome}
                onGameClick={handleGameClick}
                onSectionClick={handleSectionClick}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                {selectedGame && (
                    <Breadcrumb
                        selectedGame={selectedGame}
                        selectedSection={selectedSection}
                        onHome={handleHome}
                        onGameSelect={() => setSearchParams({ game: selectedGame.key })}
                    />
                )}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {!selectedGame ? (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <LandingPage onGameClick={handleGameClick} />
                        </div>
                    ) : !selectedSection ? (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <GameDashboard game={selectedGame} onSectionClick={handleSectionClick} />
                        </div>
                    ) : selectedSection.available && selectedSection.key === 'technical_docs_2013' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={selectedGame.key}
                            defaultContent={
                                selectedGame.key === 'numeracy_number_skill'  ? NUMERACY_DEFAULT :
                                selectedGame.key === 'literacy_reading_skill' ? LITERACY_DEFAULT  :
                                selectedGame.key === 'number_recall_lottery_v2' ? '' :
                                `# ${selectedGame.title} — Technical Documentation 2013\n\nLegacy documentation for **${selectedGame.title}**.\n\nClick **Edit** to add historical documentation.`
                            }
                        />
                    ) : selectedSection.available && selectedSection.key === 'technical_docs' ? (
                        <DynamicDocViewer
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__tech`}
                            defaultContent={makeTechDocTemplate(selectedGame)}
                        />
                    ) : selectedSection.available && selectedSection.key === 'api_integration' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__api`}
                            defaultContent={makeApiTemplate(selectedGame)}
                        />
                    ) : selectedSection.available && selectedSection.key === 'score_logic' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__score`}
                            defaultContent={makeScoreLogicTemplate(selectedGame)}
                        />
                    ) : selectedSection.available && selectedSection.key === 'cutoff_calc' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__cutoff`}
                            defaultContent={makeCutoffTemplate(selectedGame)}
                        />
                    ) : selectedSection.available && selectedSection.key === 'assessment' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__assessment`}
                            defaultContent={makeAssessmentTemplate(selectedGame)}
                        />
                    ) : selectedSection.available && selectedSection.key === 'audio_logic' ? (
                        <AudioLogicViewer
                            game={selectedGame}
                            section={selectedSection}
                        />
                    ) : selectedSection.available && selectedSection.key === 'workflow_diagram' ? (
                        <WorkflowDiagramViewer
                            game={selectedGame}
                            section={selectedSection}
                        />
                    ) : selectedSection.available && selectedSection.key === 'database_flow' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__dataflow`}
                            defaultContent={makeDataFlowTemplate(selectedGame)}
                        />
                    ) : selectedSection.available && selectedSection.key === 'reports' ? (
                        <ReportsAnalysisViewer
                            game={selectedGame}
                            section={selectedSection}
                        />
                    ) : selectedSection.available && selectedSection.key === 'screenshots' ? (
                        <ScreenshotLibraryViewer
                            game={selectedGame}
                            section={selectedSection}
                        />
                    ) : selectedSection.available && selectedSection.key === 'introduction' ? (
                        <IntroductionViewer
                            game={selectedGame}
                        />
                    ) : selectedSection.available && selectedSection.key === 'gameplay_manual' ? (
                        <GameplayManualViewer
                            game={selectedGame}
                            section={selectedSection}
                        />
                    ) : (
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <ComingSoonSection game={selectedGame} section={selectedSection} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDocs;
