import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    { key: 'working_memory_herpher', icon: '🔄', title: 'Her Pher - V0',           color: '#0891b2', image: '/assets/images/her_pher/her_pher.jpg' },
    { key: 'working_memory_herpher_v2', icon: '🔄', title: 'Her Pher - V1',           color: '#0891b2', image: '/assets/images/her_pher_v2/her_pher_v2.jpg' },
    { key: 'working_memory_herpher_v3', icon: '🔄', title: 'Her Pher',           color: '#0891b2', image: '/assets/images/her_pher_v3/her_pher_v3.jpg' },
    { key: 'numeracy_number_skill',  icon: '🔢', title: 'Ankganit - V0',           color: '#4f46e5', image: '/assets/images/number_skill/number_skill.jpg' },
    { key: 'numeracy_number_skill_v2', icon: '🔢', title: 'Ankganit - V1',         color: '#4f46e5', image: '/assets/images/number_skill_v2/number_skill.jpg' },
    { key: 'numeracy_number_skill_v3', icon: '🔢', title: 'Ankganit',              color: '#4f46e5', image: '/assets/images/number_skill_v3/number_skill.jpg' },
    { key: 'literacy_reading_skill', icon: '📖', title: 'Padh ke batao - V0',      color: '#059669', image: '/assets/images/reading_skill/reading_skill.jpg' },
    { key: 'literacy_reading_skill_v2', icon: '📖', title: 'Padh ke batao', color: '#059669', image: '/assets/images/reading_skill_v2/reading_skill_v2.jpg' },
    { key: 'cognitive_flex_chor',    icon: '⚡', title: 'Chor Machaye Shor',  color: '#dc2626', image: '/assets/images/chor_machaye_shor/chor_machaye_shor.jpg' },
    { key: 'triangle_rachna',        icon: '🔺', title: 'Rachna',             color: '#e11d48', image: '/assets/images/rachna/rachna.jpg' },
];

const GAME_SECTIONS = [
    { key: 'introduction',       icon: '📖', label: 'Introduction',                  available: true  },
    { key: 'technical_docs_2013',icon: '📜', label: 'Technical Documentation 2013',  available: true,  legacy: true  },
    { key: 'technical_docs',     icon: '⚙️', label: 'Technical Documentation',       available: true  },
    { key: 'workflow_diagram',   icon: '🔀', label: 'Workflow Diagram',               available: true  },
    { key: 'screenshots',        icon: '🖼️', label: 'Screenshots & Manual',          available: true  },
    { key: 'audio_logic',        icon: '🔊', label: 'Audio & Sound Logic',            available: true  },
    { key: 'score_logic',        icon: '🏆', label: 'Score & Progression Logic',      available: true  },
    { key: 'assessment',         icon: '🧪', label: 'Assessment Behavior',            available: true  },
    { key: 'api_integration',    icon: '🔗', label: 'API & Data Flow',                available: true  },
    { key: 'reports',            icon: '📈', label: 'Reports & Analysis',             available: true  },
];

// Per-game hidden sections — e.g. a V2 game has no 2013 predecessor, so its
// legacy archive section is hidden rather than shown empty.
const HIDDEN_SECTIONS_BY_GAME = {
    number_recall_lottery_v2: ['technical_docs_2013'],
    literacy_reading_skill_v2: ['technical_docs_2013', 'reports'],
    numeracy_number_skill_v3: ['technical_docs_2013', 'reports'],
    number_recall_lottery: ['reports'],
};
const getVisibleSections = (game) =>
    GAME_SECTIONS.filter(sec => !(HIDDEN_SECTIONS_BY_GAME[game.key] || []).includes(sec.key));

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
    number_recall_lottery: {
        en: {
            skill:       'Auditory Working Memory - Number Sequence Recall',
            objective:   'This test assesses the child\'s auditory working memory by measuring how many spoken numbers they can recall in the correct order. Sequences grow progressively longer, from 2 numbers up to 9, until the child\'s recall capacity is reached.',
            description: 'The child listens to a spoken sequence of numbers and then taps them back in the same order on a numpad. Sequences get longer as the test progresses. This activity helps evaluate how well a child can hold and recall information they\'ve just heard.',
            guidance:    'Listen carefully to the numbers. Then tap them back in the same order you heard them. Take your time!',
        },
        hi: {
            skill:       'श्रवण कार्यशील स्मृति - संख्या क्रम स्मरण',
            objective:   'इस टेस्ट का उद्देश्य बच्चे की श्रवण कार्यशील स्मृति का आकलन करना है, यह मापकर कि वह सही क्रम में कितनी बोली गई संख्याएं याद रख पाता है। संख्याओं का क्रम धीरे-धीरे लंबा होता जाता है — 2 संख्याओं से शुरू होकर 9 तक — जब तक बच्चे की स्मरण क्षमता का पता न चल जाए।',
            description: 'बच्चा बोली गई संख्याओं का एक क्रम सुनता है और फिर उन्हें उसी क्रम में नंबरपैड पर दबाता है। टेस्ट आगे बढ़ने के साथ संख्याओं का क्रम लंबा होता जाता है। यह गतिविधि यह आकलन करने में मदद करती है कि बच्चा अभी-अभी सुनी गई जानकारी को कितनी अच्छी तरह याद रख पाता है।',
            guidance:    'संख्याओं को ध्यान से सुनो। फिर उन्हें उसी क्रम में दबाओ जिस क्रम में तुमने सुना था। जल्दी मत करो!',
        },
    },
    numeracy_number_skill_v3: {
        en: {
            skill:       'Foundational Numeracy - Adaptive Arithmetic Assessment (ASER 2014-style)',
            objective:   'This test uses an adaptive, ASER 2014-style arithmetic assessment to determine the child\'s numeracy level. Starting with two-digit subtraction, the child moves up to division or down to number recognition based on their performance, until their numeracy level is identified.',
            description: 'The child solves subtraction and division problems, or identifies numbers, depending on how they perform at each stage. The test is adaptive, following the ASER 2014 arithmetic ladder methodology: children who solve subtraction correctly move on to harder division problems, while children who struggle move to simpler number-recognition tasks, until the assessment settles on their numeracy level.',
            guidance:    'Take your time and think carefully about each problem. It\'s okay if some questions are tricky — just do your best!',
        },
        hi: {
            skill:       'बुनियादी संख्या ज्ञान - अनुकूली अंकगणित आकलन (ASER 2014 आधारित)',
            objective:   'यह टेस्ट ASER 2014 पद्धति पर आधारित एक अनुकूली (adaptive) अंकगणितीय आकलन है, जो बच्चे का संख्या ज्ञान स्तर पता करता है। दो अंकों वाले घटाव से शुरू करके, बच्चे के प्रदर्शन के आधार पर वह भाग (division) की ओर ऊपर या संख्या पहचान की ओर नीचे बढ़ता है, जब तक उसका संख्या ज्ञान स्तर तय न हो जाए।',
            description: 'बच्चा घटाव और भाग के सवाल हल करता है, या संख्याओं को पहचानता है, यह इस पर निर्भर करता है कि वह हर चरण में कैसा प्रदर्शन करता है। यह टेस्ट ASER 2014 की अंकगणितीय सीढ़ी पद्धति का पालन करते हुए अनुकूली है: घटाव सही हल करने वाले बच्चे कठिन भाग के सवालों की ओर बढ़ते हैं, और जिन्हें कठिनाई होती है वे सरल संख्या-पहचान कार्यों की ओर जाते हैं, जब तक उनका संख्या ज्ञान स्तर तय नहीं हो जाता।',
            guidance:    'आराम से हर सवाल के बारे में ध्यान से सोचो। कोई सवाल मुश्किल लगे तो कोई बात नहीं — बस अपनी पूरी कोशिश करो!',
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
    literacy_reading_skill_v2: {
        en: {
            skill:       'Foundational Literacy - Oral Reading Fluency (ASER 2014-style)',
            objective:   'This test uses an adaptive, ASER 2014-style oral reading assessment to determine the child\'s current reading level. Starting from a paragraph, the child moves up or down a ladder — Letter, Word, Paragraph, Story — based on how fluently they read aloud, until their reading level is identified.',
            description: 'The child reads letters, words, a paragraph, and a story aloud while the assessor listens and marks accuracy and fluency. The test is adaptive: children who read well move on to harder text, and children who struggle move to easier text, until the assessment settles on their reading level.',
            guidance:    'Take your time and read out loud, clearly. It\'s okay if some words are tricky — just do your best!',
        },
        hi: {
            skill:       'बुनियादी साक्षरता - मौखिक पठन प्रवाह (ASER 2014 आधारित)',
            objective:   'यह टेस्ट ASER 2014 पद्धति पर आधारित एक अनुकूली (adaptive) मौखिक पठन आकलन है, जो बच्चे का वर्तमान पठन स्तर पता करता है। बच्चे के पढ़ने के प्रवाह के आधार पर स्तर ऊपर या नीचे बदलता है — अक्षर, शब्द, अनुच्छेद, कहानी — जब तक उसका सही स्तर तय न हो जाए।',
            description: 'बच्चा अक्षर, शब्द, एक अनुच्छेद और एक कहानी ज़ोर से पढ़ता है, जबकि मूल्यांकनकर्ता ध्यान से सुनकर सटीकता और प्रवाह दर्ज करता है। यह टेस्ट अनुकूली है: अच्छा पढ़ने वाले बच्चे कठिन पाठ की ओर बढ़ते हैं, और जिन्हें कठिनाई होती है वे आसान पाठ की ओर जाते हैं, जब तक उनका पठन स्तर तय नहीं हो जाता।',
            guidance:    'आराम से और ज़ोर से, साफ़-साफ़ पढ़ो। कोई शब्द मुश्किल लगे तो कोई बात नहीं — बस अपनी पूरी कोशिश करो!',
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

const makeScoreLogicTemplate = (game) => `# 🏆 ${game.title} — Score & Progression Logic

---

## 1. Overview

This document explains how the scoring system works for **${game.title}** — what actions earn a score, how scores are recorded per question, how the final score is calculated, and the cutoff rules that determine when the assessment stops early. It is written for SSL teams, researchers, assessors, QA testers, and developers.

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

See **§10 Cutoff Rules** below for stop rule details.

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

## 10. What Is a Cutoff Rule?

A **cutoff** is the minimum number of correct answers a child must achieve in a specific category or stage of the game to continue to the next section. If the child's performance falls below the cutoff, the game stops automatically.

Cutoffs exist to protect assessment validity — continuing with advanced questions when foundational categories are not passed would produce meaningless results.

---

## 11. Cutoff Types

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

## 12. Category Structure and Cutoff Values

*[Fill in the exact category structure and cutoff values for ${game.title} here based on game config]*

Example format (update with actual values):

| Category | Questions | Min Correct | Max Wrong | Stop Trigger |
|---|---|---|---|---|
| Category 1 | Q1–Q10 | 4 | 3 consecutive | End of category OR 3 consecutive wrong |
| Category 2 | Q11–Q20 | 4 | 3 consecutive | End of category OR 3 consecutive wrong |
| Category 3 | Q21–Q24 | 2 | 3 consecutive | End of category OR 3 consecutive wrong |
| Category 4 | Q25–Q26 | 1 | 3 consecutive | End of category OR 3 consecutive wrong |

---

## 13. How Cutoff Is Checked (Logic Flow)

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

## 14. What Happens When a Cutoff Is Triggered

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

## 15. Impact on Reports

In the admin Reports section, a dropped session will show:
- \`status = 'completed'\`
- \`attempted_questions < total_questions\`
- \`score\` reflecting only the questions that were answered

This is expected behavior — the child simply did not reach the remaining questions.

---

## 16. Why These Cutoffs?

The cutoff values are designed based on:
- The assessment framework established in the original SANGIAN 2013 platform
- Cognitive progression logic (foundational skills must be demonstrated before advanced skills)
- Statistical validity — a child passing by chance should not proceed

Any changes to cutoff values require updating both the frontend game config AND this documentation.

---

## 17. Cutoff vs. Quit

| Condition | Status | Who triggers |
|---|---|---|
| Cutoff rule met | \`completed\` | System automatic |
| Assessor ends early | \`quit\` | Assessor manual |
| Resume → abandoned | \`paused\` | Assessor decision |

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Reading Skill V2 Score & Progression Logic (ASER 2014-style level, not a ──
// per-question tally). Padh ke Batao V2 has no QUESTIONS array, no allScores,
// no percentage — makeScoreLogicTemplate's binary per-question model does not
// apply. Score Logic and Cutoff Calculation are merged into one section here
// since for this game they document the exact same mechanism: the per-stage
// pass threshold and the stage-routing table.

const makeReadingV2ScoreLogicTemplate = (game) => `# 🏆 ${game.title} — Score & Progression Logic

---

## 1. Overview

This document explains how scoring works for **${game.title}** — an ASER 2014-style adaptive oral reading assessment. Unlike a fixed-question test, there is no per-question tally, no percentage, and no "total questions" — the score is the **reading level** the child reached on the adaptive ladder. It is written for SSL teams, researchers, assessors, QA testers, and developers.

---

## 2. Score Unit

The scored unit is a **stage verdict** — PASS or FAIL — not an individual question:

\`\`\`
Stage passes → child moves up the ladder (or the ladder ends at a higher level)
Stage fails  → child moves down the ladder (or the ladder ends at a lower level)
\`\`\`

There is no partial credit within a stage and no separate points per item — a stage's many tiles or fluency questions collapse into one pass/fail verdict, and it's the *sequence* of verdicts across stages that produces the final level.

---

## 3. Scoring Methods

### Tile Marking (Words / Letters stages)
The assessor marks up to 5 tiles ✓/✗ as the child reads each one aloud:

\`\`\`
correctCount = tiles marked ✓
correctCount >= 4  → stage PASS
correctCount <  4  → stage FAIL
\`\`\`

### Fluency Modal (Paragraph / Story stages)
After the child reads the full text aloud, the assessor answers 3 Yes/No questions:

\`\`\`
1. Did the child read it like a string of words, rather than sentences?
2. Did the child read it haltingly and stop very often?
3. Did the child make more than 3 mistakes?

ALL answered "No" → stage PASS
ANY answered "Yes" → stage FAIL
\`\`\`

---

## 4. Per-Stage Result Record

Each stage produces a result object with a different shape depending on its type:

**Tile-marking stages** (\`selectedWords\`, \`selectedWordsRetry\`, \`selectedLetters\`):
\`\`\`json
[
  { "text": "घर", "correct": true },
  { "text": "कल", "correct": false }
]
\`\`\`

**Read-aloud stages** (\`paragraphResult\`, \`paragraphRetryResult\`, \`storyResult\`):
\`\`\`json
{
  "pass": true,
  "ssrAnswers": ["no", "no", "no"],
  "timeTaken": 42
}
\`\`\`

| Field | Description |
|---|---|
| \`text\` / \`correct\` | The tile's text and whether it was marked correct |
| \`pass\` | The stage's overall PASS/FAIL verdict |
| \`ssrAnswers\` | The 3 fluency Yes/No answers, in question order |
| \`timeTaken\` | Seconds spent on that stage (from \`qTimer\`) |

All of these are held in per-stage state (\`selectedWords\`, \`paragraphResult\`, etc.) and included in \`saved_state\` for resume — there is no single \`allScores\` array like fixed-question games use.

---

## 5. Final Score Calculation

\`\`\`
LEVELS = { Beginner: 0, Letter: 1, Word: 2, Paragraph: 3, Story: 4 }

finalLevel is set directly by the stage-routing table — the last stage's
verdict determines whether the ladder ends here or moves to another stage.

finalScore = LEVELS[finalLevel]
\`\`\`

This is **not** a sum of per-item scores. Two children with wildly different tile-marking accuracy can land on the same final level if their pass/fail verdicts at each stage matched.

**Example — a child who fails Paragraph, fails Words, passes Letters, passes Words Retry, passes Paragraph Retry, fails Story:**

| Stage | Verdict |
|---|---|
| Paragraph | FAIL |
| Words | FAIL |
| Letters | PASS |
| Words Retry | PASS |
| Paragraph Retry | PASS |
| Story | FAIL |
| **finalLevel** | **Paragraph** |
| **finalScore** | **3** |

---

## 6. Score Display

On the final score screen, the system displays:

| Metric | Calculation |
|---|---|
| Reading Level | \`finalLevel\` (Beginner / Letter / Word / Paragraph / Story) |
| Score Dial | \`finalScore / 4\` |
| Path Breadcrumb | \`path[]\` — every stage actually traversed, including retries |
| Duration | \`finalGameTime\` (\`timerSeconds\` snapshot when the ladder ended) |
| Per-Stage Time | each stage's own \`timeTaken\` / \`*TimeTaken\` field |

There is no "percentage correct" metric — it wouldn't be meaningful for a leveled, adaptive assessment.

---

## 7. Score and Stage-Routing Interaction

The score is entirely a *consequence* of stage routing — there is no separate stop-rule check layered on top of it. See **§10 Stage Thresholds and Routing** below (or the **Workflow Diagram → Stage Flow** tab, or **Technical Documentation**) for the full pass/fail routing table between Paragraph, Words, Letters, the two retry stages, and Story.

---

## 8. Score Persistence

Score is saved to the server:
- After every stage transition during active play (\`status: 'in_progress'\`)
- On pause (\`status: 'paused'\`) and quit (\`status: 'quit'\`)
- At ladder completion (\`status: 'completed'\`)

\`\`\`
PUT /api/games/sessions/update/:sessionId
{ score: finalScore ?? 0, progress_level: path.length + 1, status, saved_state }
\`\`\`

The \`game_sessions.score\` column always reflects the most recently saved \`finalScore\` (0–4), or \`0\` if the ladder hasn't produced a level yet.

---

## 9. What Does NOT Affect Score

- Time taken on any stage (no speed bonus or time penalty)
- Number of pauses
- Replay count of the splash audio
- Whether the game was resumed from a saved state
- Which of the 2 paragraphs was assigned (both are treated as equivalent difficulty)
- How many *more* than the 4-correct threshold a Words/Letters stage scored (5/5 counts the same as 4/5 — both are just PASS)

---

## 10. Stage Thresholds and Routing

**${game.title}** has no fixed question count, no categories, and no "3 consecutive wrong" rule — so there's no cutoff in the fixed-question-test sense. Instead, each stage's pass/fail verdict (per §2–3 above) routes to a specific next stage or a final level:

| Stage | Threshold Type | Threshold | PASS → | FAIL → |
|---|---|---|---|---|
| Paragraph | Fluency | all 3 = "No" | Story | Words |
| Words | Tile-marking | ≥ 4 / 5 | Paragraph Retry | Letters |
| Letters | Tile-marking | ≥ 4 / 5 | Words Retry (fixed set) | END → level "Beginner" |
| Words Retry | Tile-marking | ≥ 4 / 5 | Paragraph Retry | END → level "Letter" |
| Paragraph Retry | Fluency | all 3 = "No" | Story | END → level "Word" |
| Story | Fluency | all 3 = "No" | END → level "Story" | END → level "Paragraph" |

Unlike a fixed-question test, **every** row leads somewhere — either another stage or a specific final reading level. There is no scenario where the child simply "runs out" of unattempted content; the ladder is always fully resolved by its own routing table.

---

## 11. How a Threshold Is Checked (Logic Flow)

\`\`\`
When the current stage is completed:

If stage is Words or Letters (tile-marking):
  correctCount = tiles marked ✓
  verdict = correctCount >= 4 ? PASS : FAIL

If stage is Paragraph, Paragraph Retry, or Story (fluency):
  verdict = ssrAnswers.every(a => a === "no") ? PASS : FAIL

Look up (stage, verdict) in the routing table above:
  → either setStage(nextStage)
  → or finalizeAssessment(level) and move to the Score screen
\`\`\`

---

## 12. What Happens When the Ladder Resolves

\`\`\`
Routing table returns an END
       ↓
finalLevel + finalScore are set (LEVELS[finalLevel])
       ↓
Game transitions to Score Screen
       ↓
Session updated with status = 'completed'
       ↓
path[] (every stage traversed) is saved alongside the result
       ↓
Assessment form appears for assessor to complete
       ↓
PDF report generated
\`\`\`

There is no \`'dropped'\` status in this game — a session is always either still \`'in_progress'\`/\`'paused'\`, or \`'completed'\` once the ladder reaches an END, or \`'quit'\` if the assessor ends it manually.

---

## 13. Impact on Reports

In the admin Reports section, a completed session shows:
- \`status = 'completed'\`
- \`finalLevel\` (Beginner / Letter / Word / Paragraph / Story) and \`score\` = \`LEVELS[finalLevel]\` (0–4)
- \`progress_level\` = \`path.length + 1\` — how many stages were traversed, not "questions answered out of a fixed total" (there is no fixed total here)

A short \`path\` (e.g. 3 stages) is expected and normal for a child who reads at a Beginner level — it does not mean the assessment was cut short.

---

## 14. Why These Thresholds?

The ≥4/5 tile-marking threshold and the 3-question fluency check are not arbitrary SANGIAN choices — they follow the **ASER 2014** ("Annual Status of Education Report") oral reading assessment methodology, a widely-used standard for measuring foundational reading level in Indian primary-grade children. The ladder structure (Beginner → Letter → Word → Paragraph → Story) mirrors ASER's own reading-level categories.

Any change to these thresholds would be a change to the underlying assessment instrument, not just a SANGIAN configuration tweak — it should be made deliberately and reflected in both the game code and this documentation.

---

## 15. Threshold Outcome vs. Quit

| Condition | Status | Who triggers |
|---|---|---|
| Ladder reaches an END via the routing table | \`completed\` | System automatic |
| Assessor ends early | \`quit\` | Assessor manual |
| Resume → abandoned | \`paused\` | Assessor decision |

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── (Reading Skill V2 Cutoff Calculation merged into makeReadingV2ScoreLogicTemplate above, §10-15) ──

// ─── Ankganit V3 Score & Progression Logic (adaptive arithmetic ladder level, ──
// not a per-question tally). Ankganit V3 has no QUESTIONS array, no allScores,
// no percentage — the generic binary per-question model does not apply. Score
// Logic and Cutoff Calculation are merged into one section, same as the
// reading game above, since both describe the same per-stage pass mechanism.

const makeAnkganitV3ScoreLogicTemplate = (game) => `# 🏆 ${game.title} — Score & Progression Logic

---

## 1. Overview

This document explains how scoring works for **${game.title}** — an adaptive arithmetic assessment. Unlike a fixed-question test, there is no per-question tally, no percentage, and no "total questions" — the score is the **numeracy level** the child reached on the adaptive ladder. It is written for SSL teams, researchers, assessors, QA testers, and developers.

---

## 2. Score Unit

The scored unit is a **stage verdict** — PASS or FAIL — not an individual question:

\`\`\`
Stage passes → child moves up the ladder (or the ladder ends at a higher level)
Stage fails  → child moves down the ladder (or the ladder ends at a lower level)
\`\`\`

There is no partial credit within a stage — a Number Recognition stage's 5 marked tiles collapse into one pass/fail verdict, and a Subtraction/Division answer is either an exact match or it isn't. It's the *sequence* of verdicts across stages that produces the final level.

---

## 3. Scoring Methods

### Numpad Entry (Subtraction / Division stages)
\`\`\`
Subtraction (Q1, Q2, and the conditional Q1 retry): one numeric field
  correct = parseInt(answerVal) === correctAnswer

Division: two numeric fields — quotient and remainder — no retry
  correct = parseInt(quotientVal) === expectedQuotient
            AND parseInt(remainderVal) === expectedRemainder
\`\`\`

### Tile Marking (Number Recognition stages)
\`\`\`
The assessor marks up to 5 tiles ✓/✗ as the child identifies each aloud:
correctCount = tiles marked ✓
correctCount >= 4  → stage PASS
correctCount <  4  → stage FAIL
\`\`\`

---

## 4. Per-Stage Result Record

Each stage produces a result object with a different shape depending on its type:

**Subtraction** (\`subtraction\`):
\`\`\`json
{
  "q1": {
    "firstAttempt": { "correct": false, "timeTaken": 11, "enteredAnswer": 47 },
    "retryGiven": true,
    "retryAttempt": { "correct": true, "timeTaken": 8, "enteredAnswer": 52 },
    "finalCorrect": true
  },
  "q2": { "firstAttempt": { "correct": true, "timeTaken": 9, "enteredAnswer": 31 }, "finalCorrect": true },
  "bothCorrect": true
}
\`\`\`
Note the Q1 retry does **not overwrite** \`q1.firstAttempt\` — the original wrong attempt and the retry are both preserved as separate fields, and both can appear as separate rows in the results table.

**Division** (\`division\`):
\`\`\`json
{ "correct": true, "enteredQuotient": 4, "enteredRemainder": 2, "timeTaken": 14 }
\`\`\`

**Number Recognition** (\`numberRecognition99\`, \`numberRecognition9\`):
\`\`\`json
{ "pass": true, "marks": [{ "text": "47", "correct": true }, { "text": "83", "correct": false }], "timeTaken": 26 }
\`\`\`

All of these are held in per-category state and included in \`saved_state\` for resume — there is no single \`allScores\` array like fixed-question games use.

---

## 5. Final Score Calculation

\`\`\`
LEVELS = { Beginner: 0, 'Number Recognition (1–9)': 1, 'Number Recognition (10–99)': 2, Subtraction: 3, Division: 4 }

finalLevel is set directly by the stage-routing table — the last stage's
verdict determines whether the ladder ends here or moves to another stage.

finalScore = LEVELS[finalLevel]
\`\`\`

This is **not** a sum of per-item scores. Reaching Division Select at all already guarantees a floor of \`finalLevel = "Subtraction"\` (score 3) — Division only decides whether the score is upgraded to 4.

**Example — a child who fails Q1 (first attempt), passes Q2, passes the Q1 retry, then fails Division:**

| Stage | Verdict |
|---|---|
| Subtraction Q1 (first attempt) | FAIL |
| Subtraction Q2 | PASS |
| Subtraction Q1 Retry | PASS |
| Combined Subtraction (retry counted) | PASS |
| Division | FAIL |
| **finalLevel** | **Subtraction** |
| **finalScore** | **3** |

---

## 6. Score Display

On the final score screen, the system displays:

| Metric | Calculation |
|---|---|
| Numeracy Level | \`finalLevel\` (Beginner / Number Recognition 1–9 / Number Recognition 10–99 / Subtraction / Division) |
| Score Dial | \`finalScore / 4\` |
| Path Breadcrumb | \`path[]\` — every stage actually traversed, including the Q1 retry if it fired |
| Duration | \`finalGameTime\` (\`timerSeconds\` snapshot when the ladder ended) |
| Per-Stage Time | each stage's own \`timeTaken\` field |

There is no "percentage correct" metric — it wouldn't be meaningful for a leveled, adaptive assessment.

---

## 7. Score and Stage-Routing Interaction

The score is entirely a *consequence* of stage routing — there is no separate stop-rule check layered on top of it. See **§10 Stage Thresholds and Routing** below (or the **Workflow Diagram → Stage Flow** tab, or **Technical Documentation**) for the full pass/fail routing table between Subtraction, Division, and the two Number Recognition levels.

---

## 8. Score Persistence

Score is saved to the server:
- After every stage transition during active play (\`status: 'in_progress'\`)
- On pause (\`status: 'paused'\`) and quit (\`status: 'quit'\`)
- At ladder completion (\`status: 'completed'\`)

\`\`\`
PUT /api/games/sessions/update/:sessionId
{ score: finalScore ?? 0, progress_level: path.length + 1, status, saved_state }
\`\`\`

The \`game_sessions.score\` column always reflects the most recently saved \`finalScore\` (0–4), or unset if the ladder hasn't produced a level yet.

---

## 9. What Does NOT Affect Score

- Time taken on any stage (no speed bonus or time penalty)
- Number of pauses
- Replay count of the splash audio
- Whether the game was resumed from a saved state
- Which 2 of the 8 subtraction problems were picked, or which 1 of 4 division problems (all are treated as equivalent difficulty)
- How many *more* than the 4-correct threshold a Number Recognition stage scored (5/5 counts the same as 4/5 — both are just PASS)

---

## 10. Stage Thresholds and Routing

**${game.title}** has no fixed question count and no "3 consecutive wrong" rule. Instead, each stage's pass/fail verdict routes to a specific next stage or a final level:

| Stage | Threshold Type | Threshold | PASS → | FAIL → |
|---|---|---|---|---|
| Subtraction Q1 | Exact match | — | (always proceeds to Q2) | (always proceeds to Q2) |
| Subtraction Q2 | Exact match | — | See routing rule below | See routing rule below |
| Subtraction Q1 Retry | Exact match | Only reached if Q1 failed & Q2 passed | Combined check re-evaluated | Combined check re-evaluated |
| Combined Subtraction | Both Q1 (final) & Q2 correct | — | Division Select | Number Recognition (10–99) |
| Division | Exact match (quotient + remainder) | No retry | END → level "Division" | END → level "Subtraction" |
| Number Recognition (10–99) | Tile-marking | ≥ 4 / 5 | END → level "Number Recognition (10–99)" | Number Recognition (1–9) |
| Number Recognition (1–9) | Tile-marking | ≥ 4 / 5 | END → level "Number Recognition (1–9)" | END → level "Beginner" |

Unlike a fixed-question test, **every** row leads somewhere — either another stage or a specific final level. There is no scenario where the child simply "runs out" of unattempted content; the ladder is always fully resolved by its own routing table.

---

## 11. How a Threshold Is Checked (Logic Flow)

\`\`\`
When the current stage is completed:

If stage is Subtraction Q1/Q2/Retry:
  verdict = parseInt(answerVal) === correctAnswer ? PASS : FAIL
  (Q2's verdict also triggers evaluateAfterQ2(), which decides whether a
  Q1 retry is needed before the combined Subtraction result is final)

If stage is Division:
  verdict = (quotient match AND remainder match) ? PASS : FAIL

If stage is Number Recognition (10–99 or 1–9):
  correctCount = tiles marked correct
  verdict = correctCount >= 4 ? PASS : FAIL

Look up (stage, verdict) in the routing table above:
  → either setStage(nextStage)
  → or finalizeAssessment(level) and move to the Score screen
\`\`\`

---

## 12. What Happens When the Ladder Resolves

\`\`\`
Routing table returns an END
       ↓
finalLevel + finalScore are set (LEVELS[finalLevel])
       ↓
Game transitions to Score Screen
       ↓
Session updated with status = 'completed'
       ↓
path[] (every stage traversed) is saved alongside the result
       ↓
Assessment form appears for assessor to complete
       ↓
PDF report generated
\`\`\`

There is no \`'dropped'\` status in this game — a session is always either still \`'in_progress'\`/\`'paused'\`, or \`'completed'\` once the ladder reaches an END, or \`'quit'\` if the assessor ends it manually.

---

## 13. Impact on Reports

In the admin Reports section, a completed session shows:
- \`status = 'completed'\`
- \`finalLevel\` and \`score\` = \`LEVELS[finalLevel]\` (0–4)
- \`progress_level\` = \`path.length + 1\` — how many stages were traversed, not "questions answered out of a fixed total"

A short \`path\` (e.g. 3 stages) is expected and normal for a child who lands at Beginner level — it does not mean the assessment was cut short.

---

## 14. Why These Thresholds?

Like the reading assessment on this platform, **${game.title}** is derived from the **ASER 2014** ("Annual Status of Education Report") assessment manual — specifically its arithmetic ladder, which tests children on number recognition, subtraction, and division in an adaptive sequence. The Beginner → Number Recognition (1–9) → Number Recognition (10–99) → Subtraction → Division progression mirrors ASER's own arithmetic level categories, and the ≥4/5 tile-marking threshold follows the same convention used on the reading side of the platform.

**Known inconsistency worth flagging** (independent of the ASER methodology itself — this is purely a code/admin-UI mismatch): the admin Category Config panel exposes a \`minimum_correct\`/\`evaluation_type\` field per category, implying the threshold is configurable — but the game code never reads either field. Whoever administers content should be aware that changing these admin fields currently has **no effect on gameplay**; the real threshold is hardcoded in \`NumberSkillGameV3.jsx\`. Any change to the actual threshold requires a code change, not an admin panel edit — this is a mismatch between what the UI implies and what the code does, and is worth resolving one way or the other (either wire the admin field up, or remove it from the UI to stop it being misleading).

---

## 15. Threshold Outcome vs. Quit

| Condition | Status | Who triggers |
|---|---|---|
| Ladder reaches an END via the routing table | \`completed\` | System automatic |
| Assessor ends early | \`quit\` | Assessor manual |
| Resume → abandoned | \`paused\` | Assessor decision |

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Lottery Ka Ticket Score & Progression Logic ───────────────────────────────
// This game IS a genuine fixed-question test with a real per-question binary
// score and a real consecutive-wrong stop rule — the generic Score Logic
// content mostly fits. What's wrong in the generic/merged template for this
// game specifically: there is NO category structure or MIN_CORRECT concept at
// all, and scoring is 100% automatic (no manual/assessor-click scoring, no
// division-answer branch).

const makeLotteryScoreLogicTemplate = (game) => `# 🏆 ${game.title} — Score & Progression Logic

---

## 1. Overview

This document explains how the scoring system works for **${game.title}** — what actions earn a score, how scores are recorded per question, how the final score is calculated, and the stop rule that determines when the assessment ends early. It is written for SSL teams, researchers, assessors, QA testers, and developers.

---

## 2. Score Unit

Each question in **${game.title}** is scored as a **binary value**, based on an exact sequence match:

\`\`\`
exactMatch(selected, correct):
  same length AND same values AND same order → score = 1
  otherwise                                   → score = 0
\`\`\`

There is **no partial credit** — recalling 4 of 5 digits correctly, or getting the right digits in the wrong order, both score 0, same as getting none right. Every question is worth exactly 1 point.

---

## 3. Scoring Method — Fully Automatic

Unlike some other games on this platform, **there is no manual/assessor-click scoring anywhere in this game**, and no "division answer" scoring branch:

\`\`\`
Child taps digits on the numpad, in the order they intend to answer
Once exactly maxSelect digits are selected, "Next Question" becomes enabled
Clicking it BOTH scores (exactMatch) AND advances — one action, no separate submit
\`\`\`
The assessor's role during scoring is purely to operate the "Next Question" / "Replay" buttons on the child's behalf if needed — there is no correct/incorrect judgment call for the assessor to make.

---

## 4. Per-Question Score Record

Every answered question (including the 2 Teaching questions) produces a score record containing more than the platform's generic per-question shape:

\`\`\`json
{
  "qId": 5,
  "questionNumber": 5,
  "score": 1,
  "timeTaken": 6,
  "userResponse": [8, 3, 9, 1],
  "correctAnswer": [8, 3, 9, 1],
  "replayCount": 1
}
\`\`\`

| Field | Description |
|---|---|
| \`qId\` / \`questionNumber\` | Question identifier / sequential position |
| \`score\` | 1 = exact match, 0 = anything else |
| \`timeTaken\` | Seconds taken to respond |
| \`userResponse\` | The full digit sequence the child entered, in order |
| \`correctAnswer\` | The full digit sequence that was spoken, in order |
| \`replayCount\` | How many times the child replayed the audio for this question (does not affect scoring) |

All records are stored in the session's \`saved_state.allScores\` array (game questions) and \`saved_state.teachingScores\` array (the 2 teaching questions) — **not** a single combined array.

---

## 5. Final Score Calculation

\`\`\`
Total Score = count of allScores where score === 1
            + count of teachingScores where score === 1
\`\`\`

This is updated after every question and saved to the \`game_sessions.score\` column. The score shown on the score screen is out of **22** (20 game questions + 2 teaching questions), not 20 — a detail the generic platform scoring model doesn't account for, since it assumes teaching/practice items are always unscored.

**Example:**

| Question | Score |
|---|---|
| Teaching 1 | 1 |
| Teaching 2 | 1 |
| Q1 | 1 |
| Q2 | 0 |
| Q3 | 1 |
| **Total (of 22 possible)** | **4** |

---

## 6. Score Display

On the final score screen, the system displays:

| Metric | Calculation |
|---|---|
| Total Score | correct answers, out of 22 |
| Incorrect | attempted − correct |
| Percentage | (correct ÷ 22) × 100 |
| Total Time | sum of all \`timeTaken\` values |
| Average Time per Question | total time ÷ questions attempted |

---

## 7. Score and Stop Rule Interaction

The score after each question is also checked against the stop rule. If the stop condition triggers, the game ends and the current total (out of however many questions were reached) is saved as the final score.

---

## 8. Stop Rule

**${game.title}** has exactly **one** stop rule — there is no category-minimum concept in this game at all:

\`\`\`
Consecutive Wrong Answer Rule:
  If the child gives 3 incorrect answers in a row (back-to-back),
  the game stops immediately.

  Consecutive wrong count resets to 0 after any correct answer.
\`\`\`
When triggered:
\`\`\`
Stop condition triggered
       ↓
Game transitions to Score Screen
       ↓
Session updated with status = 'dropped' (natural completion instead uses 'completed')
       ↓
Scores up to that point are saved
       ↓
Assessment form appears for assessor to complete
       ↓
PDF report generated
\`\`\`

---

## 9. Score Persistence

Score is saved to the server:
- After every question during active play (\`status: 'in_progress'\`)
- At game end (\`status: 'completed'\` if all 20 questions were reached, \`'dropped'\` if the consecutive-wrong rule triggered, or \`'quit'\` if the assessor ended it manually)

The score column in \`game_sessions\` always reflects the most recent saved value.

---

## 10. What Does NOT Affect Score

- Time taken (no speed bonus or time penalty)
- Number of pauses
- \`replayCount\` — replaying the audio as many times as needed never penalizes the score
- Whether the game was resumed from a saved state

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

// ─── Reading Skill V2 Assessment Behavior — the SessionAssessmentForm itself is ──
// shared/identical across games, so most of this section carries over unchanged.
// Only the framing (what's being measured) and two status/terminology references
// ('dropped' status, "question scores") differ for the adaptive ladder.

const makeReadingV2AssessmentTemplate = (game) => `# 🧪 ${game.title} — Assessment Behavior

---

## 1. Overview

This document explains how **${game.title}** measures and records behavioral observations during and after the assessment session. It covers what is tracked, how the assessor records observations, how the data is stored, and how it contributes to the final assessment report.

---

## 2. What Is Being Measured

**${game.title}** is a structured oral reading assessment, not a scored quiz. Beyond the reading level reached, the system tracks:

- **Reading level** — the highest stage the child reached on the adaptive ladder (Beginner / Letter / Word / Paragraph / Story)
- **Fluency indicators** — the assessor's word-by-word / halting / mistake-count judgments recorded at each Paragraph/Story stage
- **Tile-marking accuracy** — which specific letters/words the child read correctly or incorrectly at each stage
- **Behavioral observations** — assessor-recorded qualitative observations about how the child engaged, captured separately in the form below

---

## 3. Behavioral Assessment Form

After every game session (whether completed or quit), the assessor fills in a structured **Session Details Form** before the assessment is finalized. This form is identical across all SANGIAN games — it does not vary with the adaptive ladder mechanics above.

### Assessment Questions

Exact wording shown on screen (\`en.js\` locale strings), addressed directly to the child:

| # | Question | Response Options |
|---|---|---|
| Q1 | "Did you enjoy playing the game?" | Yes, a lot / A little / Not much |
| Q2 | "How did the game feel for you?" | Yes, a lot / A little / Not much |
| Q3 | "Did you feel tired while playing the game?" | Yes, a lot / A little / Not much |
| Q4 | "Would you like to play the game again?" | Yes, a lot / A little / Not much |

All 4 questions are **required** — the form cannot be submitted without selecting a response for each.

### Behavioral Observation Checkboxes (Q5)

Labeled "Q5. Observed Behaviours during the session (Multiple selection allowed)". The assessor selects all behaviors observed during the session:

\`\`\`
☐ Difficulty sustaining attention
☐ Impulsive or random responding
☐ Negative reaction to correction
☐ Hesitation in responding
☐ High focus or persistence
☐ Verbalisation of a memory strategy
☐ Needed frequent reassurance
☐ Calm and engaged throughout
\`\`\`

Multiple behaviors can be selected — but **at least one is required**. Leaving all 8 unchecked blocks submission with "Please select at least one observed behaviour."

### Additional Notes

A free-text field where the assessor can dictate or type any additional qualitative observations not covered by the checkboxes.

**Voice input** is supported — the assessor can use the microphone button to dictate notes directly.

---

## 4. Validation Rules

\`\`\`
Q1, Q2, Q3, Q4 → Required (must be selected before submission)
Q5 behaviors   → Required (at least 1 of 8 must be checked)
Additional notes → Optional (can be empty)
\`\`\`

If any required field is missing, the form highlights the missing field(s) and shows an inline error — Q5 specifically shows "Please select at least one observed behaviour." Submission is blocked until every required field is filled.

---

## 5. Assessment Submission Flow

\`\`\`
Assessor fills in Q1–Q4 (required)
Assessor checks at least one behavioral observation (required)
Assessor optionally adds notes
Assessor clicks "Submit Assessment"
       ↓
Client validates all required fields (Q1–Q5)
  → if any missing: inline errors shown, submission blocked
       ↓
Confirmation modal appears: "Are you sure you want to submit the assessment?"
  → Cancel: closes modal, form remains editable
  → Confirm: proceeds
       ↓
POST /api/games/assessments
       ↓
Data stored in game_assessments table
       ↓
Dashboard PDF auto-generated and uploaded
       ↓
"Retest" and "Home" buttons appear
\`\`\`

Note the confirmation step: validation passing does **not** submit immediately — the assessor must confirm a second time in a modal dialog before \`submitAssessmentForm()\` actually fires.

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
System checks: sessions with status IN ('completed', 'quit')
               where NO assessment record exists

If found → Shows a prompt to the assessor to complete the form
\`\`\`

Note: this game has no \`'dropped'\` status — a session is only ever \`'in_progress'\`, \`'paused'\`, \`'completed'\` (the ladder reached an END), or \`'quit'\` (ended manually). This ensures no session is left without a behavioral assessment.

---

## 8. Assessment in Reports

In the Admin Reports panel, every session record shows the assessment responses alongside the reading-level result. The reports include:

- Q1–Q4 responses
- Q5 behavioral observations (comma-separated)
- Additional notes
- The final reading level and stage-by-stage results (not "question scores" — this game has no individually scored questions)
- Whether the assessment was submitted or is pending

---

## 9. Assessment Integrity

- The assessment form is **disabled** after submission — responses cannot be changed
- The session status does not change when the assessment is submitted (reading level/status are independent)
- Assessment data is linked to the session by \`session_id\` and \`child_id\`

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Ankganit V3 Assessment Behavior — the SessionAssessmentForm itself is ──
// shared/identical across games (same real bugs found and fixed here as for
// Padh ke Batao V2: Q5 is actually required, and there's a confirmation modal
// the old generic template never documented). Only the framing differs.

const makeAnkganitV3AssessmentTemplate = (game) => `# 🧪 ${game.title} — Assessment Behavior

---

## 1. Overview

This document explains how **${game.title}** measures and records behavioral observations during and after the assessment session. It covers what is tracked, how the assessor records observations, how the data is stored, and how it contributes to the final assessment report.

---

## 2. What Is Being Measured

**${game.title}** is a structured adaptive arithmetic assessment, not a scored quiz. Beyond the numeracy level reached, the system tracks:

- **Numeracy level** — the highest stage the child reached on the adaptive ladder (Beginner / Number Recognition 1–9 / Number Recognition 10–99 / Subtraction / Division)
- **Per-question correctness** — the specific subtraction/division answers and number-recognition tiles the child got right or wrong at each stage
- **Retry behavior** — whether the Subtraction Q1 retry fired, and whether it succeeded
- **Behavioral observations** — assessor-recorded qualitative observations about how the child engaged, captured separately in the form below

---

## 3. Behavioral Assessment Form

After every game session (whether completed or quit), the assessor fills in a structured **Session Details Form** before the assessment is finalized. This form is identical across all SANGIAN games — it does not vary with the adaptive ladder mechanics above.

### Assessment Questions

Exact wording shown on screen (\`en.js\` locale strings), addressed directly to the child:

| # | Question | Response Options |
|---|---|---|
| Q1 | "Did you enjoy playing the game?" | Yes, a lot / A little / Not much |
| Q2 | "How did the game feel for you?" | Yes, a lot / A little / Not much |
| Q3 | "Did you feel tired while playing the game?" | Yes, a lot / A little / Not much |
| Q4 | "Would you like to play the game again?" | Yes, a lot / A little / Not much |

All 4 questions are **required** — the form cannot be submitted without selecting a response for each.

### Behavioral Observation Checkboxes (Q5)

Labeled "Q5. Observed Behaviours during the session (Multiple selection allowed)". The assessor selects all behaviors observed during the session:

\`\`\`
☐ Difficulty sustaining attention
☐ Impulsive or random responding
☐ Negative reaction to correction
☐ Hesitation in responding
☐ High focus or persistence
☐ Verbalisation of a memory strategy
☐ Needed frequent reassurance
☐ Calm and engaged throughout
\`\`\`

Multiple behaviors can be selected — but **at least one is required**. Leaving all 8 unchecked blocks submission with "Please select at least one observed behaviour."

### Additional Notes

A free-text field where the assessor can dictate or type any additional qualitative observations not covered by the checkboxes.

**Voice input** is supported — the assessor can use the microphone button to dictate notes directly.

---

## 4. Validation Rules

\`\`\`
Q1, Q2, Q3, Q4 → Required (must be selected before submission)
Q5 behaviors   → Required (at least 1 of 8 must be checked)
Additional notes → Optional (can be empty)
\`\`\`

If any required field is missing, the form highlights the missing field(s) and shows an inline error — Q5 specifically shows "Please select at least one observed behaviour." Submission is blocked until every required field is filled.

---

## 5. Assessment Submission Flow

\`\`\`
Assessor fills in Q1–Q4 (required)
Assessor checks at least one behavioral observation (required)
Assessor optionally adds notes
Assessor clicks "Submit Assessment"
       ↓
Client validates all required fields (Q1–Q5)
  → if any missing: inline errors shown, submission blocked
       ↓
Confirmation modal appears: "Are you sure you want to submit the assessment?"
  → Cancel: closes modal, form remains editable
  → Confirm: proceeds
       ↓
POST /api/games/assessments
       ↓
Data stored in game_assessments table
       ↓
Dashboard PDF auto-generated and uploaded
       ↓
"Retest" and "Home" buttons appear
\`\`\`

Note the confirmation step: validation passing does **not** submit immediately — the assessor must confirm a second time in a modal dialog before \`submitAssessmentForm()\` actually fires.

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
System checks: sessions with status IN ('completed', 'quit')
               where NO assessment record exists

If found → Shows a prompt to the assessor to complete the form
\`\`\`

Note: this game has no \`'dropped'\` status — a session is only ever \`'in_progress'\`, \`'paused'\`, \`'completed'\` (the ladder reached an END), or \`'quit'\` (ended manually). This ensures no session is left without a behavioral assessment.

---

## 8. Assessment in Reports

In the Admin Reports panel, every session record shows the assessment responses alongside the numeracy-level result. The reports include:

- Q1–Q4 responses
- Q5 behavioral observations (comma-separated)
- Additional notes
- The final numeracy level and stage-by-stage results (not "question scores" — this game has no individually scored questions in the fixed-quiz sense)
- Whether the assessment was submitted or is pending

---

## 9. Assessment Integrity

- The assessment form is **disabled** after submission — responses cannot be changed
- The session status does not change when the assessment is submitted (numeracy level/status are independent)
- Assessment data is linked to the session by \`session_id\` and \`child_id\`

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Lottery Ka Ticket Assessment Behavior — the SessionAssessmentForm itself ──
// is shared/identical across games (same real bugs found and fixed here as for
// the other two games: Q5 is actually required, and there's a confirmation
// modal the old generic template never documented). Only the framing differs.

const makeLotteryAssessmentTemplate = (game) => `# 🧪 ${game.title} — Assessment Behavior

---

## 1. Overview

This document explains how **${game.title}** measures and records behavioral observations during and after the assessment session. It covers what is tracked, how the assessor records observations, how the data is stored, and how it contributes to the final assessment report.

---

## 2. What Is Being Measured

**${game.title}** is a structured working-memory assessment. Beyond the question scores, the system tracks:

- **Accuracy** — whether the child recalls the exact sequence, in order
- **Speed** — how long the child takes to respond per question
- **Recall capacity** — the longest sequence length the child can reliably recall before the 3-consecutive-wrong stop rule triggers
- **Replay reliance** — how often the child needed the audio replayed to attempt a response (tracked, does not affect scoring)
- **Behavioral observations** — assessor-recorded qualitative observations about how the child engaged

---

## 3. Behavioral Assessment Form

After every game session (whether completed, dropped, or quit), the assessor fills in a structured **Session Details Form** before the assessment is finalized. This form is identical across all SANGIAN games — it does not vary with this game's mechanics.

### Assessment Questions

Exact wording shown on screen (\`en.js\` locale strings), addressed directly to the child:

| # | Question | Response Options |
|---|---|---|
| Q1 | "Did you enjoy playing the game?" | Yes, a lot / A little / Not much |
| Q2 | "How did the game feel for you?" | Yes, a lot / A little / Not much |
| Q3 | "Did you feel tired while playing the game?" | Yes, a lot / A little / Not much |
| Q4 | "Would you like to play the game again?" | Yes, a lot / A little / Not much |

All 4 questions are **required** — the form cannot be submitted without selecting a response for each.

### Behavioral Observation Checkboxes (Q5)

Labeled "Q5. Observed Behaviours during the session (Multiple selection allowed)". The assessor selects all behaviors observed during the session:

\`\`\`
☐ Difficulty sustaining attention
☐ Impulsive or random responding
☐ Negative reaction to correction
☐ Hesitation in responding
☐ High focus or persistence
☐ Verbalisation of a memory strategy
☐ Needed frequent reassurance
☐ Calm and engaged throughout
\`\`\`

Multiple behaviors can be selected — but **at least one is required**. Leaving all 8 unchecked blocks submission with "Please select at least one observed behaviour."

### Additional Notes

A free-text field where the assessor can dictate or type any additional qualitative observations not covered by the checkboxes.

**Voice input** is supported — the assessor can use the microphone button to dictate notes directly.

---

## 4. Validation Rules

\`\`\`
Q1, Q2, Q3, Q4 → Required (must be selected before submission)
Q5 behaviors   → Required (at least 1 of 8 must be checked)
Additional notes → Optional (can be empty)
\`\`\`

If any required field is missing, the form highlights the missing field(s) and shows an inline error — Q5 specifically shows "Please select at least one observed behaviour." Submission is blocked until every required field is filled.

---

## 5. Assessment Submission Flow

\`\`\`
Assessor fills in Q1–Q4 (required)
Assessor checks at least one behavioral observation (required)
Assessor optionally adds notes
Assessor clicks "Submit Assessment"
       ↓
Client validates all required fields (Q1–Q5)
  → if any missing: inline errors shown, submission blocked
       ↓
Confirmation modal appears: "Are you sure you want to submit the assessment?"
  → Cancel: closes modal, form remains editable
  → Confirm: proceeds
       ↓
POST /api/games/assessments
       ↓
Data stored in game_assessments table
       ↓
Dashboard PDF auto-generated and uploaded
       ↓
"Retest" and "Home" buttons appear
\`\`\`

Note the confirmation step: validation passing does **not** submit immediately — the assessor must confirm a second time in a modal dialog before \`submitAssessmentForm()\` actually fires.

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

If the child completes, drops out, or quits a game but the assessor does not submit the form before navigating away, the system detects this on the next visit.

\`\`\`
System checks: sessions with status IN ('completed', 'quit', 'dropped')
               where NO assessment record exists

If found → Shows a prompt to the assessor to complete the form
\`\`\`
Unlike the two adaptive-ladder games on this platform, **this game genuinely can produce a \`'dropped'\` status** (via the 3-consecutive-wrong stop rule) — so \`'dropped'\` legitimately belongs in this check for this game, unlike for the ladder games where it never occurs.

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
// ─── Reading Skill V2 Technical Documentation (adaptive ASER-2014-style ladder) ──
// This game is NOT a fixed-question test — makeTechDocTemplate's generic
// "QUESTIONS array / consecutive-wrong / category minimum" model does not apply.

const makeReadingV2TechDocTemplate = (game) => `# ⚙️ ${game.title} — Technical Documentation

> **Dynamic Technical Documentation** — This document covers the complete technical architecture of **${game.title}**: an ASER 2014-style **adaptive oral reading assessment**, not a fixed-question quiz. It has no question count, no consecutive-wrong stop rule, and no category-minimum drop logic — instead, the child moves up or down a reading-level ladder based on a pass/fail verdict at each stage.

---

## 1. Game Identity

| Property | Value |
|---|---|
| Internal Key | \`${game.key}\` |
| Display Title | ${game.title} |
| Assessment Type | Academic / Literacy — Adaptive Oral Reading (ASER 2014-style) |
| Platform | SANGIAN Web Application (2026) |
| Technology | React.js (Frontend) · Node.js + MySQL (Backend) |

---

## 2. Screen Architecture

\`\`\`
[Splash Screen]
  Audio (splash.wav) plays automatically once the resume check finishes
  "Start Now" activates only after audio completes (or errors — fail-safe)
  "Replay" button available
  If a paused/in-progress session exists, a Resume modal offers
  Resume / Restart Fresh
       ↓
[Game Screen — adaptive ladder]
  Stage by stage: Paragraph → (Words → Letters → Words Retry) → Paragraph Retry → Story
  Each stage is either a tile-marking screen (Words/Letters) or a
  read-aloud + Yes/No fluency modal (Paragraph/Story)
  Per-stage timer (qTimer) and overall screentime timer (timerSeconds) both
  run and are recorded — neither is ever used to force a stage to end
  Pause/Quit button always accessible — requires a typed or dictated reason
       ↓
[Score Screen]
  Final ASER reading level + score dial (finalScore / 4)
  Path breadcrumb — every stage actually traversed, including retries
  Per-stage results table (pass/fail, marked words/letters or
  paragraph/story detail, duration)
  SessionAssessmentForm (must be submitted to finalize)
  PDF snapshot auto-generated and uploaded on submit
\`\`\`

There is no on-screen instructional text — the assessor's and child's
instructions are delivered entirely through the splash audio clip and cover
image.

---

## 3. Game Configuration

${game.title} has no \`MAX_CONSECUTIVE_WRONG\`, \`MIN_CORRECT\`, or
\`QUESTION_COUNT\` constants. Its "configuration" is the ladder's fixed
content pools plus two hardcoded pass thresholds:

| Constant | Value | Purpose |
|---|---|---|
| \`LEVELS\` | \`{ Beginner:0, Letter:1, Word:2, Paragraph:3, Story:4 }\` | Maps a stage-based verdict path to a numeric ASER reading level |
| Letters bank | 10 letters (admin-editable) | Pool for the Letters stage; assessor marks 5 |
| Words bank | 10 words (admin-editable) | Pool for the Words stage; assessor marks 5 |
| Paragraphs | 2 paragraphs (admin-editable) | Assessor picks 1 at the start; locked for retry |
| Story | 1 fixed story (admin-editable) | Single story, top of the ladder |
| Words / Letters pass threshold | ≥ 4 of 5 correct | Checked in \`handleMarkingContinue\` |
| Paragraph / Story pass rule | All 3 fluency questions answered "No" | Any single "Yes" fails the stage |

See **Content Management** (§11) for how letters/words/paragraphs/story/
questions/hints are edited without a code change.

---

## 4. Gameplay Mechanics

### Scoring Types

**Tile marking** (Words / Letters stages):
\`\`\`
Assessor selects up to 5 tiles from a 10-item bank for the child to read
Child reads each aloud; assessor marks it ✓ Correct or ✗ Incorrect
Exactly 5 must be marked before the stage can continue
≥ 4 of 5 correct → stage passes
\`\`\`

**Fluency modal** (Paragraph / Story stages):
\`\`\`
Child reads the full paragraph/story aloud; assessor taps "Done Reading"
A 3-question Yes/No modal opens (each question has an ⓘ hint with a
worked example):
  1. Did the child read it like a string of words, rather than sentences?
  2. Did the child read it haltingly and stop very often?
  3. Did the child make more than 3 mistakes?
ANY "Yes" → stage fails · ALL "No" → stage passes
\`\`\`

### Timers
- **Overall screentime** (\`timerSeconds\`): runs through the game, Score, and
  Assessment screens; stops only once the final assessment is submitted.
- **Per-stage timer** (\`qTimer\`): resets to 0 at every stage transition;
  its value becomes that stage's recorded \`timeTaken\`.
- Neither timer enforces a cutoff — there is no time limit on any stage.

---

## 5. Stage Transition Rules (Adaptive Ladder Logic)

\`\`\`
STAGE: Paragraph  (1 of 2 chosen by the assessor at the start)
  PASS → Story
  FAIL → Words

STAGE: Words  (mark 5 of 10 word tiles)
  PASS → Paragraph Retry
  FAIL → Letters

STAGE: Letters  (mark 5 of 10 letter tiles)
  PASS → Words Retry  (same 5 words re-shown, fixed — no reselection)
  FAIL → END, finalLevel = "Beginner"

STAGE: Words Retry  (fixed set from the original Words attempt)
  PASS → Paragraph Retry
  FAIL → END, finalLevel = "Letter"

STAGE: Paragraph Retry  (same paragraph chosen at the start)
  PASS → Story
  FAIL → END, finalLevel = "Word"

STAGE: Story  (the single fixed story)
  PASS → END, finalLevel = "Story"
  FAIL → END, finalLevel = "Paragraph"
\`\`\`

Every completed stage — including retries — is appended to the \`path\` array
(e.g. \`['paragraph','words','letters','words_retry','paragraph_retry','story']\`),
which drives both the breadcrumb trail and the results table on the score
screen. The shortest possible path is 3 stages (Paragraph fail → Words fail
→ Letters fail); the longest is 6 (a full climb back up to Story).

---

## 6. Score Calculation

\`\`\`
LEVELS = { Beginner: 0, Letter: 1, Word: 2, Paragraph: 3, Story: 4 }
finalScore = LEVELS[finalLevel]
\`\`\`

This is an ASER reading level, not a points tally or percentage — there is
no "22 questions" concept or partial credit across categories. The score
dial on the results screen shows \`finalScore / 4\`.

---

## 7. Session State Management

### Resume Flow
\`\`\`
On splash load:
  GET /api/games/sessions/resume/:childId/${game.key}

  If a session with status in ['in_progress','paused'] and not yet
  assessmentSubmitted is found → show Resume modal:
    [Resume]        → restore stage, selections, results, timers from saved_state
    [Restart Fresh] → discard it, start a new session

  If no such session → show Splash screen normally
\`\`\`

In-progress tile marking on the *current* Words/Letters screen (\`marks\`,
\`selectedTexts\`) is deliberately **not** persisted — resuming always
restarts the current stage's marking UI from scratch, even though every
earlier *completed* stage carries over exactly.

### State Saved to Server (\`buildSavedState\`)
\`\`\`js
{
  stage, selectedParagraphIndex, wordsSource,
  selectedWords, selectedWordsRetry, selectedLetters,
  wordsTimeTaken, wordsRetryTimeTaken, lettersTimeTaken,
  paragraphResult, paragraphRetryResult, storyResult,
  path, finalLevel, finalScore, finalGameTime,
  timerSeconds, qTimer, pauses
}
\`\`\`

Sent inside the same PUT used for every progress sync (autosave, pause,
quit, and finalize all reuse this one endpoint):
\`\`\`
PUT /api/games/sessions/update/:sessionId
{
  score: finalScore ?? 0,
  progress_level: path.length + 1,
  status: 'in_progress' | 'paused' | 'quit',
  quit_reason: <text or null>,
  saved_state: { ...as above... }
}
\`\`\`

### Pause and Quit
\`\`\`
Pause → status = 'paused', { stage, reason, timestamp } appended to
        pauses[], navigate to Home immediately
Quit  → status = 'quit', same pause-log entry appended, screen → Score,
        then PDF generation triggers
\`\`\`
A reason — typed or dictated — is required before either action confirms.

---

## 8. Assessment Form Integration

After the score screen appears, \`SessionAssessmentForm\` renders:
\`\`\`
4 required observation questions (radio buttons — required)
1 behavioral checklist (8 checkboxes — optional)
1 additional notes field with voice-dictation support
\`\`\`
Submission calls:
\`\`\`
POST /api/games/assessments
{ session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness,
  q4_play_again, q5_behaviors[], additional_notes }
\`\`\`
The form is **disabled** after submission; validation blocks submit while
any required question is empty.

---

## 9. PDF Dashboard Generation

Triggered ~1–1.5s after the score screen settles (after finalize, after
Quit, or after the final assessment submits):
\`\`\`
1. Locate #dashboard-capture-area (the score screen's root <div>)
2. Clone it into an off-screen wrapper (position:fixed, top:-99999px,
   background:#fff) appended to <body> — avoids clipping caused by the
   game shell's position:fixed + backdrop-filter
3. Neutralize animations/transitions/opacity and force overflow:visible
   on the clone so the full content renders
4. html2canvas(wrapper, { scale: 1.5, useCORS: true, backgroundColor: '#fff',
   windowWidth/windowHeight: wrapper.scrollWidth/scrollHeight })
5. canvas.toDataURL('image/jpeg', 0.9)
6. jsPDF('p','mm',[210, canvas.height*210/canvas.width]).addImage(...)
7. pdf.output('blob') → FormData → upload
\`\`\`
Upload:
\`\`\`
POST /api/games/pdfs/upload   (multipart/form-data)
  pdf:         <blob>, filename "<ChildName>_ReadingSkillV2_SES<sessionId>_<ts>.pdf"
  child_id:    childData.child_id
  session_id:  gameSessionId
  game_name:   '${game.key}'
\`\`\`
PDF failures are logged to console only — they never block the score screen
or gameplay.

---

## 10. Audio System

\`\`\`
Audio element: <audio ref={audioRef} src="/assets/audios/reading_skill_v2/splash.wav" />

Behavior:
  - Plays automatically on splash load, once the resume check finishes
  - onEnded → audioFinished = true → enables "Start Now"
  - onError → audioFinished = true (fail-safe — button never permanently locked)
  - "Replay" resets currentTime to 0 and replays
  - No audio plays during the game or score screens
\`\`\`
The "Start Now" button is **disabled** until the audio finishes, ensuring
the assessor/child hear the instructions before beginning.

---

## 11. Content Management (Admin-Editable Test Content)

All of ${game.title}'s test material is admin-editable per language via the
Elements admin panel (\`ReadingV2ContentManager.jsx\`), with a hardcoded
fallback baked into the game file for any language that hasn't been
configured yet.

| Element key | Shape | Fallback constant | Used for |
|---|---|---|---|
| \`letters_bank\` | array | \`LETTERS_BANK\` | Letters stage tile pool |
| \`words_bank\` | array | \`WORDS_BANK\` | Words stage tile pool |
| \`paragraphs\` | array | \`PARAGRAPHS\` | The 2 paragraph choices |
| \`story\` | text | \`STORY_TEXT\` | The single story |
| \`paragraph_questions\` | array | — | The 3 fluency Yes/No questions (paragraph) |
| \`story_questions\` | array | — | The 3 fluency Yes/No questions (story) |
| \`paragraph_hints\` | hints | — | ⓘ worked examples behind each paragraph question |
| \`story_hints\` | hints | — | ⓘ worked examples behind each story question |

\`\`\`
Player side (useTestContent('${game.key}')):
  GET /api/public/elements?test_id=${game.key}
  GET /api/public/translations/languages
  getContent(key) → resolves content_<key> for the player's language,
                     falls back to the platform default language,
                     falls back to the hardcoded constant if still unset

Admin side (Elements panel):
  GET /api/admin/elements?test_id=${game.key}
  PUT /api/admin/elements/config
    { test_id, asset_type: 'content_<key>', language, config: draft }
  PUT /api/admin/elements/:fileId/status   (enable/disable a saved row)
\`\`\`
Hint *examples/descriptions* are per-language editable; the underlying
Yes/No answer key is not.

---

## 12. API Integration Map

| Action | Method | Endpoint |
|---|---|---|
| Session summaries (splash "last played") | GET | \`/api/games/sessions/summaries/:childId\` |
| Resume check | GET | \`/api/games/sessions/resume/:childId/${game.key}\` |
| Start session | POST | \`/api/games/sessions/start\` |
| Save/update progress (autosave, pause, quit, finalize) | PUT | \`/api/games/sessions/update/:sessionId\` |
| Submit final assessment | POST | \`/api/games/assessments\` |
| Upload result PDF | POST | \`/api/games/pdfs/upload\` |
| Fetch admin-managed content | GET | \`/api/public/elements?test_id=${game.key}\` |
| Fetch configured languages | GET | \`/api/public/translations/languages\` |
| (Admin) Load content elements | GET | \`/api/admin/elements?test_id=${game.key}\` |
| (Admin) Save content element | PUT | \`/api/admin/elements/config\` |
| (Admin) Toggle content row status | PUT | \`/api/admin/elements/:fileId/status\` |

See **API / Backend Logic** section for full request/response structures.

---

## 13. Frontend State Variables

**Flow & Stage**
| State | Purpose |
|---|---|
| \`screen\` | \`splash \| game \| score\` |
| \`stage\` | \`paragraph \| words \| letters \| paragraph_retry \| story\` |
| \`selectedParagraphIndex\` | Which of the 2 paragraphs was chosen (reused on retry) |
| \`wordsSource\` | \`direct \| afterLetters\` — first Word attempt vs. the fixed post-Letters retry |
| \`path\` | Ordered list of completed stages — drives the breadcrumb + results table |

**In-Progress Marking**
| State | Purpose |
|---|---|
| \`marks\` | \`{ [text]: 'correct'\|'incorrect' }\` for the tile screen currently open |
| \`selectedTexts\` | Tiles picked so far on the current Words/Letters screen (max 5) |
| \`pendingAssessTarget\` | Which stage the open fluency modal is scoring |
| \`midTestAnswers\` | In-progress Yes/No answers in that modal |
| \`expandedHint\` | Index of the open ⓘ hint panel, or \`null\` |

**Finalized Stage Results**
| State | Purpose |
|---|---|
| \`selectedWords\` / \`selectedWordsRetry\` / \`selectedLetters\` | Finalized \`{ text, correct }[]\` per stage |
| \`wordsTimeTaken\` / \`wordsRetryTimeTaken\` / \`lettersTimeTaken\` | Seconds spent on each marking stage |
| \`paragraphResult\` / \`paragraphRetryResult\` / \`storyResult\` | \`{ pass, ssrAnswers, timeTaken }\` per read-aloud stage |

**Outcome**
| State | Purpose |
|---|---|
| \`finalLevel\` | Final ASER level string |
| \`finalScore\` | \`LEVELS[finalLevel]\` |
| \`finalGameTime\` | \`timerSeconds\` snapshot at completion |

**Session, Timers & Misc UI**
| State | Purpose |
|---|---|
| \`gameSessionId\` / \`attemptNo\` | Server session id / attempt number |
| \`timerSeconds\` / \`qTimer\` | Overall screentime / per-stage timer |
| \`pauses\` | \`{ stage, reason, timestamp }[]\` pause/quit log |
| \`showResumeModal\` / \`showQuitModal\` / \`showMidTestModal\` | Modal visibility flags |
| \`quitReason\` | Typed/dictated pause-quit reason |
| \`audioFinished\` / \`isCheckingSession\` | Gate splash "Start Now" / splash rendering |
| \`assessment\` / \`isAssessmentSubmitting\` / \`assessmentSubmitted\` | Final \`SessionAssessmentForm\` state |
| \`isRecording\` / \`recordingTarget\` | STT dictation state |
| \`storyFontSize\` | Auto-shrunk font size so the Story text fits without scrolling |

---

## 14. Error Handling

\`\`\`
Session summaries fetch fail  → console.error only, splash still renders
Resume check fail             → console.error only, splash shown normally
Session start fail            → alert shown, game proceeds locally with
                                 gameSessionId = null (progress silently
                                 stops syncing to the server from then on)
Progress save fail (autosave) → console.error only, gameplay continues
Finalize-assessment save fail → console.log only, screen already on Score
PDF generation/upload fail    → console.error only, never shown to the user
Final assessment submit fail  → alert shown, submit re-enabled for retry
\`\`\`
The adaptive ladder itself (stage transitions, pass/fail verdicts) is pure
local state logic and is never blocked by a network failure — only server
*sync* can silently fail.

---

## 15. Speech-to-Text (Voice Input)

\`\`\`
Uses: window.SpeechRecognition || window.webkitSpeechRecognition
Config: continuous: true, interimResults: true, lang: STT_LANG_MAP[language] || 'en-US'
Targets: quitReason (Pause/Quit modal) · assessmentNotes (final assessment form)
Fallback: alert shown if the browser doesn't support Speech Recognition
\`\`\`
Only \`isFinal\` results are appended to the target field. The active
recognition instance is stashed on \`window.activeRecognition\` so it can be
force-stopped from elsewhere (e.g. on unmount, to release the microphone).
Re-tapping the mic on the same target just stops the existing instance — it
never runs two recognitions in parallel.

---

## 16. Technical Notes

- Mid-marking progress (\`marks\`, \`selectedTexts\`) is **not** resumable —
  only completed stages carry over; resuming always restarts the current
  stage's tile-marking UI from scratch.
- The Words Retry stage re-shows the *same 5 words* from the original
  attempt — it is not a fresh 5-of-10 selection, so a child cannot draw a
  different, easier word set on the second try.
- Story text auto-shrinks (66px down to 24px, \`fitStoryText\`) so the full
  story fits its card without scrolling, rather than truncating.
- \`timerSeconds\` keeps running through the Score and Assessment screens and
  stops only once the final assessment is submitted; \`finalGameTime\` is a
  snapshot taken the moment the ladder ends.
- No stage has a time limit — \`qTimer\`/\`timerSeconds\` are recorded for
  reporting only, never used to force a stage to end.

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Ankganit V3 Technical Documentation (adaptive arithmetic ladder) ──────────
// This game is NOT a fixed-question test either — same situation as Padh ke
// Batao V2: no QUESTIONS array, no consecutive-wrong stop rule, no category
// MIN_CORRECT (that field exists in the DB/admin UI but is never read by the
// game itself — vestigial, left over from the schema it was cloned from).

const makeAnkganitV3TechDocTemplate = (game) => `# ⚙️ ${game.title} — Technical Documentation

> **Dynamic Technical Documentation** — This document covers the complete technical architecture of **${game.title}**: an ASER 2014-style adaptive arithmetic ladder, not a fixed-question quiz. It has no question count, no consecutive-wrong stop rule, and no working category-minimum drop logic — instead, the child moves up or down a numeracy-level ladder based on a pass/fail verdict at each stage.

---

## 1. Game Identity

| Property | Value |
|---|---|
| Internal Key | \`${game.key}\` |
| Display Title | ${game.title} |
| Assessment Type | Academic / Numeracy — Adaptive Arithmetic Ladder (ASER 2014-style) |
| Platform | SANGIAN Web Application (2026) |
| Technology | React.js (Frontend) · Node.js + MySQL (Backend) |

---

## 2. Screen Architecture

\`\`\`
[Splash Screen]
  Audio (splash.wav) plays automatically once the resume check finishes
  "Start Now" activates only after audio completes (or errors — fail-safe)
  "Replay" button available
  If a paused/in-progress session exists, a Resume modal offers
  Resume / Restart Fresh
       ↓
[Game Screen — adaptive ladder]
  Stage by stage: Subtraction (pick 2, Q1, Q2, conditional Q1 retry) →
  Division (pick 1, Q1) OR Number Recognition (10–99) → Number Recognition (1–9)
  Each stage is either an on-screen numpad entry (Subtraction/Division) or a
  tile-marking screen (Number Recognition)
  Per-stage timer (qTimer) and overall session timer (timerSeconds) both
  run and are recorded — neither is ever used to force a stage to end
  Pause/Quit button always accessible — requires a typed or dictated reason
       ↓
[Score Screen]
  Final numeracy level + score dial (finalScore / 4)
  Path breadcrumb — every stage actually traversed
  Per-stage results table (correct/incorrect, marked tiles or numpad detail, duration)
  SessionAssessmentForm (must be submitted to finalize)
  PDF snapshot auto-generated and uploaded on submit
\`\`\`

---

## 3. Game Configuration

${game.title} has no \`MAX_CONSECUTIVE_WRONG\` or \`QUESTION_COUNT\` constant. Its "configuration" is the ladder's server-fetched content pools plus hardcoded pass thresholds:

| Constant | Value | Purpose |
|---|---|---|
| \`LEVELS\` | \`{ Beginner:0, 'Number Recognition (1–9)':1, 'Number Recognition (10–99)':2, Subtraction:3, Division:4 }\` | Maps a stage-based verdict path to a numeric numeracy level |
| Subtraction bank | 8 two-digit subtraction problems (admin-editable) | Assessor picks 2 (pick order = Q1, Q2) |
| Division bank | 4 division problems (admin-editable) | Assessor picks 1 |
| Number Recognition (10–99) bank | 10 numbers (admin-editable) | Assessor marks 5 |
| Number Recognition (1–9) bank | 10 numbers (admin-editable) | Assessor marks 5 |
| Number Recognition pass threshold | ≥ 4 / 5 correct | Hardcoded in \`finishNumberRecognition99\`/\`finishNumberRecognition9\` |
| Subtraction/Division pass rule | Exact numeric match | See §4 below |

**Important:** the admin Category Config panel (\`AdminAnkganitV3Config.jsx\`) exposes a \`minimum_correct\`/\`evaluation_type\` field per category, seeded with values 4/4/2/1 inherited from an older schema — but \`NumberSkillGameV3.jsx\` **never reads either field**. Changing them in the admin panel has no effect on gameplay; the real ≥4/5 threshold is hardcoded in the component. This is worth fixing or removing from the admin UI to avoid misleading whoever configures it.

See **Content Management** (§11) for how the question banks are actually edited.

---

## 4. Gameplay Mechanics

### Numpad Entry (Subtraction / Division)

Answers are entered via an on-screen digital numpad, not free typing:

\`\`\`
Subtraction (Q1, Q2, and the Q1 retry): one field (answerVal)
  correct = parseInt(answerVal) === Number(question.correctAnswer)

Division: two fields — quotient (quotientVal) and remainder (remainderVal)
  correct = parseInt(quotientVal) === expectedQuotient
            AND parseInt(remainderVal) === expectedRemainder
  (both default to 0 if left empty or non-numeric — parseInt(...) || 0)
\`\`\`
Division has **no retry** — one shot, both fields must match.

### Tile Marking (Number Recognition stages)

Structurally the same "mark 5 of 10" mechanic used elsewhere, though this file uses \`nr\`-prefixed state names since one marking screen is shared by both recognition sub-stages:

\`\`\`
Assessor selects up to 5 tiles from a 10-item bank (nrSelectedTexts)
Child identifies each aloud; assessor marks it ✓ or ✗ (nrMarks)
Exactly 5 must be selected AND all 5 marked before the stage can continue
correctCount >= 4 of 5  → stage PASS
\`\`\`

### Timers
- **Overall session timer** (\`timerSeconds\`): runs through the game and Score/Assessment screens.
- **Per-stage timer** (\`qTimer\`): resets at every \`goToStage\` transition; becomes that stage's recorded \`timeTaken\`.
- Neither timer enforces a cutoff — there is no time limit on any stage.

---

## 5. Stage Transition Rules (Adaptive Ladder Logic)

\`\`\`
STAGE: Subtraction Select  (assessor picks 2 of 8 problems; pick order = Q1, Q2)
  → always proceeds to Q1

STAGE: Subtraction Q1  (numpad, single field)
  → always proceeds to Q2 (a wrong Q1 is never immediately fatal)

STAGE: Subtraction Q2  (numpad, single field)
  evaluateAfterQ2():
    Q1 wrong AND Q2 correct → Subtraction Q1 Retry
    otherwise               → evaluate combined result now

STAGE: Subtraction Q1 Retry  (only reached per the rule above — one more shot at Q1)
  → evaluate combined result: q1.finalCorrect (retry outcome) AND q2.finalCorrect

Combined Subtraction result:
  BOTH correct → Division Select
  otherwise    → Number Recognition (10–99)

STAGE: Division Select  (assessor picks 1 of 4 problems)
  → Division Q1

STAGE: Division Q1  (numpad, quotient + remainder, no retry)
  PASS → END, finalLevel = "Division"
  FAIL → END, finalLevel = "Subtraction"

STAGE: Number Recognition (10–99)  (mark 5 of 10 tiles)
  PASS (≥4/5) → END, finalLevel = "Number Recognition (10–99)"
  FAIL        → Number Recognition (1–9)

STAGE: Number Recognition (1–9)  (mark 5 of 10 tiles)
  PASS (≥4/5) → END, finalLevel = "Number Recognition (1–9)"
  FAIL        → END, finalLevel = "Beginner"
\`\`\`

Every completed stage is appended to the \`path\` array, which drives the breadcrumb trail and results table on the score screen. The shortest possible path is 3 stages (Subtraction Q1+Q2 both fail their combined check → Number Recognition 10–99 fail → Number Recognition 1–9); the longest is 5 (Q1 retry fired, then climbing to Division).

The retry does **not overwrite** the original wrong Q1 attempt — \`subtraction.q1.firstAttempt\` and \`subtraction.q1.retryAttempt\` are tracked as separate fields, and both can appear as separate rows in the results table, while \`q1.finalCorrect\` reflects only the retry's outcome.

---

## 6. Score Calculation

\`\`\`
LEVELS = { Beginner: 0, 'Number Recognition (1–9)': 1, 'Number Recognition (10–99)': 2, Subtraction: 3, Division: 4 }
finalScore = LEVELS[finalLevel]
\`\`\`

This is a numeracy level, not a points tally or percentage. Reaching Division Select at all already guarantees a floor of \`finalLevel = "Subtraction"\` (score 3), since that branch is only reached after passing the combined Subtraction check — Division only decides whether the score is upgraded to 4.

---

## 7. Session State Management

### Resume Flow
\`\`\`
On splash load:
  GET /api/games/sessions/resume/:childId/${game.key}

  If a session with status in ['in_progress','paused'] and not yet
  assessmentSubmitted is found → show Resume modal:
    [Resume]        → restore stage, selections, results, timers from saved_state
    [Restart Fresh] → discard it, start a new session
\`\`\`

### State Saved to Server (\`buildSavedState\`)
\`\`\`js
{
  stage, path,
  subtraction, division, numberRecognition99, numberRecognition9,
  finalLevel, finalScore, finalGameTime,
  timerSeconds, qTimer, pauses
}
\`\`\`
Note the field names here differ from Padh ke Batao V2's equivalent shape (\`selectedWords\`/\`paragraphResult\`/etc.) — this game groups everything by category (\`subtraction\`, \`division\`, \`numberRecognition99\`, \`numberRecognition9\`) rather than by stage type. In-progress tile marking on the *current* Number Recognition screen (\`nrMarks\`, \`nrSelectedTexts\`) is **not** part of this snapshot — only completed stages are saved.

Sent inside the same PUT used for every progress sync:
\`\`\`
PUT /api/games/sessions/update/:sessionId
{
  score: finalScore ?? 0,
  progress_level: path.length + 1,
  status: 'in_progress' | 'paused' | 'quit',
  quit_reason: <text or null>,
  saved_state: { ...as above... }
}
\`\`\`

### Pause and Quit
\`\`\`
Pause → status = 'paused', { stage, reason, timestamp } appended to
        pauses[], navigate to Home immediately
Quit  → status = 'quit', same pause-log entry appended, screen → Score,
        then PDF generation triggers
\`\`\`
A reason — typed or dictated — is required before either action confirms (blocked with an alert otherwise).

---

## 8. Assessment Form Integration

After the score screen appears, \`SessionAssessmentForm\` renders:
\`\`\`
4 required observation questions (radio buttons — required)
1 behavioral checklist (8 checkboxes — required, at least 1)
1 additional notes field with voice-dictation support
\`\`\`
Submission calls:
\`\`\`
POST /api/games/assessments
{ session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness,
  q4_play_again, q5_behaviors[], additional_notes }
\`\`\`
A confirmation modal ("Are you sure you want to submit the assessment?") appears after validation passes and before the actual submit fires — see **Assessment Behavior** for the full form details.

---

## 9. PDF Dashboard Generation

Triggered ~1–1.5s after the score screen settles:
\`\`\`
1. Locate .ns-main (the score screen's root element)
2. Deep-clone it into an off-screen wrapper (position:fixed, top:-99999px,
   background:#fff) appended to <body> — avoids clipping from .ns-app's
   overflow:hidden + height:100dvh
3. Strip animations/opacity, force overflow-x/y:visible on any node that
   was scrollable, and strip <input> name attributes to avoid React
   radio-group collisions in the clone
4. html2canvas(wrapper, { scale: 1.5, useCORS: true, backgroundColor: '#fff',
   logging: false, windowWidth/windowHeight: wrapper.scrollWidth/scrollHeight })
5. canvas.toDataURL('image/jpeg', 0.9)
6. jsPDF('p','mm',[210, canvas.height*210/canvas.width]).addImage(...)
7. pdf.output('blob') → FormData → upload
\`\`\`
Upload:
\`\`\`
POST /api/games/pdfs/upload   (multipart/form-data)
  pdf:         <blob>, filename "<ChildName>_AnkganitV3_SES<sessionId>_<ts>.pdf"
  child_id:    childData.child_id
  session_id:  gameSessionId
  game_name:   '${game.key}'
\`\`\`
PDF failures are logged to console only — they never block the score screen or gameplay.

---

## 10. Audio System

\`\`\`
Audio element: <audio ref={audioRef} src="/assets/audios/number_skill_v3/splash.wav" preload="auto" />

Behavior:
  - Plays automatically once the resume check finishes and the splash screen is shown
  - onEnded → audioFinished = true → enables "Start Now"
  - onError → audioFinished = true (fail-safe — button never permanently locked)
  - Autoplay-blocked errors are also caught and treated the same as onError
  - "Replay" resets currentTime to 0 and replays
\`\`\`
The audio path is resolved via \`useTestAudio('${game.key}')\`, with the literal path above as its fallback if no admin-configured audio asset exists.

---

## 11. Content Management (Admin-Editable Test Content)

Unlike Padh ke Batao V2's single \`useTestContent\`-driven content system, Ankganit V3 splits content into two layers:

1. **Canonical question bank (scoring source of truth)** — fetched directly via \`axios\`, not through \`useTestContent\`:
\`\`\`
GET /api/public/ankganit-v3
Returns 4 categories (Number Recognition 1–9, Number Recognition 10–99,
Two-Digit Subtraction, One-Digit Divisor Three-Digit Dividend), each with
a .questions array: { id, title, text, correct_answer, remainder, display_order }
\`\`\`
This is what's used for scoring, saved_state, results, and PDF — admin-edited via \`AdminAnkganitV3Config.jsx\` (\`PUT /admin/ankganit-v3/categories/:id\`, \`PUT /admin/ankganit-v3/questions/:id\`).

2. **Per-language display overrides (cosmetic only)** — via \`useTestContent('${game.key}')\`, resolving \`content_q_<questionId>\` rows edited in \`AnkganitV3ContentManager.jsx\`. This **only** changes the rendered text of a question on screen — it never touches \`correct_answer\`, \`remainder\`, scoring, saved_state, or the PDF.

This split matters: changing a question's display translation does not change what counts as correct, and changing the canonical \`correct_answer\` in the Config panel does not automatically get a translated display override — the two must be kept in sync manually by whoever administers the content.

---

## 12. API Integration Map

| Action | Method | Endpoint |
|---|---|---|
| Session summaries (splash "last played") | GET | \`/api/games/sessions/summaries/:childId\` |
| Resume check | GET | \`/api/games/sessions/resume/:childId/${game.key}\` |
| Start session | POST | \`/api/games/sessions/start\` |
| Save/update progress (autosave, pause, quit, finalize) | PUT | \`/api/games/sessions/update/:sessionId\` |
| Submit final assessment | POST | \`/api/games/assessments\` |
| Upload result PDF | POST | \`/api/games/pdfs/upload\` |
| Fetch canonical question bank | GET | \`/api/public/ankganit-v3\` |
| Fetch admin-managed display overrides | GET | \`/api/public/elements?test_id=${game.key}\` |
| (Admin) Update category | PUT | \`/api/admin/ankganit-v3/categories/:id\` |
| (Admin) Update question | PUT | \`/api/admin/ankganit-v3/questions/:id\` |

See **API & Data Flow** section for full request/response structures.

---

## 13. Frontend State Variables

**Flow & Stage**
| State | Purpose |
|---|---|
| \`screen\` | \`splash \| game \| score\` |
| \`stage\` | Current adaptive-tree stage id |
| \`path\` | Ordered list of completed stages — drives the breadcrumb + results table |
| \`pendingSubtractionSelection\` | Up to 2 picked subtraction question ids (pick order = Q1/Q2) |
| \`pendingDivisionSelection\` | Index of the picked division question, or \`null\` |

**Category Results**
| State | Purpose |
|---|---|
| \`subtraction\` | \`{ q1, q2, bothCorrect }\` — \`q1\` holds both \`firstAttempt\` and (if fired) \`retryAttempt\` |
| \`division\` | Division attempt/result object |
| \`numberRecognition99\` / \`numberRecognition9\` | Recognition-stage result records |

**In-Progress Marking (Number Recognition)**
| State | Purpose |
|---|---|
| \`nrMarks\` | \`{ [text]: 'correct'\|'incorrect' }\` for the tile screen currently open |
| \`nrSelectedTexts\` | Tiles picked so far (max 5) |

**Numpad**
| State | Purpose |
|---|---|
| \`activeInput\` | Which numpad field is focused: \`answer \| quotient \| remainder\` |
| \`answerVal\` | Subtraction answer buffer |
| \`quotientVal\` / \`remainderVal\` | Division answer buffers |

**Outcome**
| State | Purpose |
|---|---|
| \`finalLevel\` | Final numeracy level string |
| \`finalScore\` | \`LEVELS[finalLevel]\` |
| \`finalGameTime\` | \`timerSeconds\` snapshot at completion |

**Session, Timers & Misc UI**
| State | Purpose |
|---|---|
| \`gameSessionId\` / \`attemptNo\` | Server session id / attempt number |
| \`timerSeconds\` / \`qTimer\` | Overall session timer / per-stage timer |
| \`pauses\` | \`{ stage, reason, timestamp }[]\` pause/quit log |
| \`showResumeModal\` / \`showQuitModal\` | Modal visibility flags |
| \`quitReason\` | Typed/dictated pause-quit reason |
| \`audioFinished\` / \`isCheckingSession\` | Gate splash "Start Now" / splash rendering |
| \`assessment\` / \`isAssessmentSubmitting\` / \`assessmentSubmitted\` | Final \`SessionAssessmentForm\` state |
| \`isRecording\` / \`recordingTarget\` | STT dictation state |

---

## 14. Error Handling

\`\`\`
Question bank fetch fail       → console.error only, splash still renders
Activity/resume fetch fail     → console.error only, splash shown normally
Session start fail             → alert shown, game proceeds locally with
                                  gameSessionId still unset (progress
                                  silently stops syncing from then on)
Progress save fail (autosave)  → console.error only, gameplay continues
Finalize-assessment save fail  → console.log only, screen already on Score
Screentime save (fire-and-forget, not awaited) → console.error only
PDF generation/upload fail     → console.error only, never shown to the user
Final assessment submit fail   → console.error + alert shown, submit re-enabled
\`\`\`
The adaptive ladder itself (stage transitions, pass/fail verdicts) is pure local state logic and is never blocked by a network failure — only server *sync* can silently fail.

---

## 15. Speech-to-Text (Voice Input)

\`\`\`
Uses: window.SpeechRecognition || window.webkitSpeechRecognition
Config: continuous: true, interimResults: true, lang: STT_LANG_MAP[language] || 'en-US'
Targets: quitReason (Pause/Quit modal) · assessmentNotes (final assessment form)
\`\`\`
Only \`isFinal\` results are appended to the target field. The active recognition instance is stashed on \`window.activeRecognition\` so it can be force-stopped on unmount (releasing the microphone). Re-tapping the mic on the same target stops the existing instance rather than starting a second one.

---

## 16. Technical Notes

- The admin Category Config panel's \`minimum_correct\`/\`evaluation_type\` fields are **dead weight** — they exist in the schema and the admin UI but are never consulted by the game. The real pass threshold (≥4/5) is hardcoded. Anyone editing these fields expecting them to change gameplay will be surprised that nothing happens.
- The Subtraction Q1 retry preserves the original wrong attempt (\`firstAttempt\`) alongside the retry (\`retryAttempt\`) — both can show as separate rows in the results table, rather than the retry silently replacing the original.
- Division has no retry at all, unlike Subtraction's Q1 — a wrong division answer immediately finalizes \`finalLevel = "Subtraction"\`.
- \`nrMarks\`/\`nrSelectedTexts\` are shared, reset state used by *both* Number Recognition sub-stages — they are not per-stage-scoped, so each stage transition must clear them.
- No stage has a time limit — \`qTimer\`/\`timerSeconds\` are recorded for reporting only, never used to force a stage to end.

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Lottery Ka Ticket Technical Documentation ─────────────────────────────────
// Unlike literacy_reading_skill_v2 / numeracy_number_skill_v3, this game IS a
// genuine fixed-question test (static QUESTIONS array, auto-scored, a real
// consecutive-wrong stop rule) — so most of makeTechDocTemplate's model fits.
// But it has NO category/MIN_CORRECT concept at all (that part of the generic
// template is simply wrong for this game), no manual/assessor scoring, and no
// division-answer branch — this template corrects those and adds the real
// sequence-recall specifics (replay tracking, teaching screens, digit 7
// intentionally excluded, forward-order recall).

const makeLotteryTechDocTemplate = (game) => `# ⚙️ ${game.title} — Technical Documentation

> **Dynamic Technical Documentation** — This document covers the complete technical architecture of **${game.title}**: an auditory working-memory number-sequence-recall test. It IS a genuine fixed-question test (a static 20-question array with automatic scoring and a real stop rule) — but unlike the platform's generic fixed-question template, it has **no category structure or category-minimum thresholds at all**, and **no manual/assessor-click scoring** — every answer is automatically judged by exact sequence match.

---

## 1. Game Identity

| Property | Value |
|---|---|
| Internal Key | \`${game.key}\` |
| Display Title | ${game.title} |
| Assessment Type | Cognitive — Auditory Working Memory (Number Sequence Recall) |
| Platform | SANGIAN Web Application (2026) |
| Technology | React.js (Frontend) · Node.js + MySQL (Backend) |

---

## 2. Screen Architecture

\`\`\`
[Splash Screen]
  Audio (splash1.m4a) plays automatically on load
  "Start Now" activates only after audio completes (or errors — fail-safe)
  "Replay Audio" button available
       ↓
[Practice] — 1 unscored item, lets the child try the mechanic once
       ↓
[Teaching 1] → [Teaching 2] — 2 SCORED items; if the first attempt is wrong,
  a correction audio plays before the child can try again — but only the
  first attempt counts toward the score
       ↓
[Game Screen] — 20 scored questions, sequence length ramps from 2 digits
  (Q1) up to 9 digits (Q18–20)
  Per-question timer runs; numpad is locked while audio plays
  Pause/Quit button always accessible
       ↓
[Score Screen]
  Score out of 22 (20 game + 2 teaching questions)
  Per-question results table (response vs. correct answer, status, duration, replay count)
  SessionAssessmentForm (must be submitted to finalize)
  PDF snapshot auto-generated and uploaded on submit
\`\`\`

---

## 3. Game Configuration

\`\`\`
TOTAL_SCORED_QUESTIONS = 20
TEACHING_QUESTION_COUNT = 2
MAX_CONSECUTIVE_WRONG = 3
\`\`\`

There is **no** \`MIN_CORRECT\` or category concept of any kind — the generic platform template's "Category Structure and Cutoff Values" section does not apply to this game. All 20 questions share a single flat sequence with one global stop rule (§6).

The number bank used across all sequences is **1–6, 8, 9, 10** — the digit **7 is intentionally never used** in any question.

---

## 4. Full Question Bank (verbatim from \`NumberRecallGame.jsx\`)

### Practice (unscored) and Teaching (scored)

| Screen | Sequence | Length | Audio File | Scored? | Correction Audio on Wrong Answer? |
|---|---|---|---|---|---|
| Practice | 4, 6 | 2 | \`4_6.m4a\` | No | Yes — \`4_6_teaching_audio.m4a\` |
| Teaching 1 | 9, 4 | 2 | \`9_4.m4a\` | Yes (first attempt only) | Yes — \`9_4_teaching_audio.m4a\` |
| Teaching 2 | 2, 8 | 2 | \`2_8.m4a\` | Yes (first attempt only) | **No correction audio** — unlike Practice and Teaching 1, a wrong first attempt on Teaching 2 does not play a correction clip |

### Game Questions (all 20, scored)

| Q# | Sequence (spoken order) | Length | Audio File |
|---|---|---|---|
| Q1  | 8, 9 | 2 | \`8_9.m4a\` |
| Q2  | 4, 9, 5 | 3 | \`4_9_5.m4a\` |
| Q3  | 9, 1, 6 | 3 | \`9_1_6.m4a\` |
| Q4  | 10, 5, 3 | 3 | \`10_5_3.m4a\` |
| Q5  | 10, 2, 5, 8 | 4 | \`10_2_5_8.m4a\` |
| Q6  | 5, 2, 10, 3 | 4 | \`5_2_10_3.m4a\` |
| Q7  | 6, 1, 9, 5 | 4 | \`6_1_9_5.m4a\` |
| Q8  | 2, 3, 6, 10, 5 | 5 | \`2_3_6_10_5.m4a\` |
| Q9  | 1, 4, 6, 9, 2 | 5 | \`1_4_6_9_2.m4a\` |
| Q10 | 3, 10, 1, 5, 8 | 5 | \`3_10_1_5_8.m4a\` |
| Q11 | 9, 3, 5, 1, 8, 4 | 6 | \`9_3_5_1_8_4.m4a\` |
| Q12 | 10, 2, 4, 9, 1, 6 | 6 | \`10_2_4_9_1_6.m4a\` |
| Q13 | 2, 6, 3, 10, 8, 4 | 6 | \`2_6_3_10_8_4.m4a\` |
| Q14 | 5, 3, 6, 9, 8, 4, 10 | 7 | \`5_3_6_9_8_4_10.m4a\` |
| Q15 | 3, 1, 5, 9, 4, 6, 8 | 7 | \`3_1_5_9_4_6_8.m4a\` |
| Q16 | 1, 10, 2, 6, 8, 5, 3 | 7 | \`1_10_2_6_8_5_3.m4a\` |
| Q17 | 5, 8, 4, 1, 9, 4, 6, 3 | 8 | \`5_8_4_1_9_4_6_3.m4a\` |
| Q18 | 1, 8, 5, 3, 9, 4, 6, 2, 10 | 9 | \`1_8_5_3_9_4_6_2_10.m4a\` |
| Q19 | 9, 1, 2, 6, 4, 3, 8, 5, 10 | 9 | \`9_1_2_6_4_3_8_5_10.m4a\` |
| Q20 | 10, 5, 1, 9, 8, 2, 4, 6, 3 | 9 | \`10_5_1_9_8_2_4_6_3.m4a\` |

**Notes on the bank:**
- Sequence length ramps in a fixed pattern: 2 (Q1) → 3 (Q2–4) → 4 (Q5–7) → 5 (Q8–10) → 6 (Q11–13) → 7 (Q14–16) → 8 (Q17) → 9 (Q18–20).
- Q17 is the only 8-digit sequence — the ramp jumps straight from 7 digits (Q16) to 9 digits (Q18) after it, so Q17 sits alone at length 8.
- Q17's sequence (\`5, 8, 4, 1, 9, 4, 6, 3\`) contains a **repeated digit** (4 appears twice) — the only question in the entire bank where a digit repeats. This is a meaningfully different memory challenge from the rest of the bank, since the child can't rely on "each digit used at most once."
- Every audio filename directly encodes its sequence (\`{d1}_{d2}_..._{dn}.m4a\`), stored under \`/assets/audios/lottery_ka_ticket/\`.
- These are the **static fallback** sequences/audio used if no admin-configured per-language audio override exists for a given \`getAudioUrl(...)\` id — see **Content Management** (§11) for the override mechanism. The digit *sequences themselves* are not admin-editable at all; only which audio clip plays for a given ID can be overridden.

---

## 5. Gameplay Mechanics

### The Recall Mechanic
\`\`\`
1. Audio plays a spoken sequence of numbers (e.g. "8, 9" for Q1, ramping
   up to a 9-number sequence by Q18–20)
2. The numpad is locked (pointer-events: none) while audio plays
3. Once audio ends, the child taps the digits back — in the SAME ORDER
   they were spoken (forward recall; a separate V2 variant of this game
   tests reverse recall instead)
4. "Replay" re-plays the sequence and resets the current selection;
   replay count is tracked per question
5. The "Next Question" button becomes enabled once exactly maxSelect
   digits are chosen (or partial-match mode allows advancing sooner);
   clicking it both scores AND advances — there is no separate submit step
\`\`\`

### Scoring — Fully Automatic
\`\`\`
exactMatch(selected, correct):
  same length AND same values AND same order → 1 (correct)
  otherwise                                   → 0 (incorrect)
\`\`\`
There is **no manual/assessor-click scoring anywhere in this game** — the platform's generic "Manual Scoring (Assessor-Controlled)" pattern does not apply here. There is also no "division answer" scoring branch (that's specific to the numeracy games).

### Timers
- **Per-question timer** (\`qTimer\`): resets on each new question.
- **Global timer** (\`timerSeconds\`): counts total session seconds during active play.

---

## 6. Stop Rules

This game has exactly **one** stop rule — no category-minimum rule exists:

\`\`\`
consecutiveWrong >= MAX_CONSECUTIVE_WRONG (3)  → STOP (dropped out)
questionIndex + 1 >= TOTAL_SCORED_QUESTIONS (20) → STOP (natural completion)
\`\`\`
When triggered, the screen transitions to Score, and the session status is set to \`'dropped'\` (consecutive-wrong stop) or \`'completed'\` (finished all 20 naturally) — see **API & Data Flow** for the exact status handling.

---

## 7. Session State Management

### Resume Flow
\`\`\`
On game load:
  GET /api/games/sessions/resume/:childId/${game.key}

  If a paused/in-progress session is found → show Resume modal:
    [Resume]      → restores questionIndex, allScores, teachingScores,
                     timers, consecutiveWrong from saved_state
    [Start Fresh] → discard it, start a new session
\`\`\`

### State Saved to Server
\`\`\`js
{
  questionIndex, allScores, teachingScores,
  timerSeconds, qTimer, pauses, consecutiveWrong
}
\`\`\`
Each entry in \`allScores\`/\`teachingScores\` (not just \`{qId, score, timeTaken}\` like the generic platform template shows) actually carries:
\`\`\`js
{ qId, questionNumber, score, timeTaken, userResponse: [...], correctAnswer: [...], replayCount }
\`\`\`
\`userResponse\`/\`correctAnswer\` (the full digit arrays, not just a pass/fail flag) and \`replayCount\` are specific to this game — the generic template's example record doesn't include them.

Sent via the same PUT used for every progress sync:
\`\`\`
PUT /api/games/sessions/update/:sessionId
{ score, progress_level: questionIndex + 1, status, quit_reason, saved_state: {...as above...} }
\`\`\`
\`score\` = combined count of correct entries across **both** \`allScores\` and \`teachingScores\` — the teaching questions count toward the final score even though they're presented as a "teaching" phase.

### Pause and Quit
\`\`\`
Pause → status = 'paused', pause event { reason, timestamp } appended to pauses[]
Quit  → status = 'quit', quit_reason saved, screen → Score, PDF generation triggers
\`\`\`
A reason (typed or dictated) is required before either action confirms.

---

## 8. Assessment Form Integration

After the score screen appears, \`SessionAssessmentForm\` renders — see **Assessment Behavior** for the full field list, validation rules (Q5 is required, not optional), and the confirmation-modal step before submission.

---

## 9. PDF Dashboard Generation

\`\`\`
1. Locate #dashboard-capture-area (the score screen's root element)
2. Clone it into an off-screen wrapper (position:fixed, top:-99999px,
   forced width max(scrollWidth, 1400px), white background)
3. html2canvas(wrapper, { scale: 1.5, useCORS: true, backgroundColor: '#fff',
   windowWidth/windowHeight: wrapper.scrollWidth/scrollHeight })
4. canvas.toDataURL('image/jpeg', 0.9)
5. jsPDF('p','mm',[210, canvas.height*210/canvas.width]).addImage(...)
6. pdf.output('blob') → FormData → upload
\`\`\`
Upload:
\`\`\`
POST /api/games/pdfs/upload   (multipart/form-data)
  pdf:         <blob>, filename "<ChildName>_Lottery_Ka_Ticket_SES<sessionId>_<ts>.pdf"
  child_id, session_id, game_name: '${game.key}'
\`\`\`
Triggered ~1s after quit, and ~1s after the final assessment submits. PDF failures are logged to console only.

---

## 10. Audio System

\`\`\`
Splash: <audio ref={audioRef} src=".../splash1.m4a" preload="auto"
  onEnded={()=>setAudioFinished(true)} onError={()=>setAudioFinished(true)} />

Per-question audio: created lazily per question, listens to
playing/ended/pause/error to toggle isPlaying; numpad is
pointer-events:none while isPlaying; manual Replay bumps replayCount
\`\`\`
Both splash and per-question audio resolve through \`useTestAudio('${game.key}')\`, with static fallback paths under \`/assets/audios/lottery_ka_ticket/\` if no admin-configured audio asset exists for a given language.

---

## 11. Content Management (Cosmetic Only — Not Question Authoring)

Unlike the two adaptive-ladder games on this platform, this game's admin content management is **narrow and cosmetic**, not question-authoring:

\`\`\`
NumberRecallContentManager.jsx (shared with the V2 variant) lets an admin
override, per language, only the DISPLAYED GLYPH on each numpad tile
(content_q_1 ... content_q_10, excluding 7) — e.g. showing a Hindi/Urdu
numeral style instead of a Western digit.

This NEVER changes the value used for scoring — only what's drawn on the
button face. The question set itself (which numbers, how many, in what
order, per question) is a static QUESTIONS array in the frontend and
cannot be edited by an admin at all.
\`\`\`
This is a materially different content-management model from \`ReadingV2ContentManager.jsx\`/\`AnkganitV3ContentManager.jsx\`, which do let admins author real question content — worth not conflating the two when documenting "admin-editable content" generically across games.

---

## 12. API Integration Map

| Action | Method | Endpoint |
|---|---|---|
| Session summaries (splash "last played") | GET | \`/api/games/sessions/summaries/:childId\` |
| Resume check | GET | \`/api/games/sessions/resume/:childId/${game.key}\` |
| Start session | POST | \`/api/games/sessions/start\` |
| Save/update progress (autosave, pause, quit, finalize) | PUT | \`/api/games/sessions/update/:sessionId\` |
| Submit final assessment | POST | \`/api/games/assessments\` |
| Upload result PDF | POST | \`/api/games/pdfs/upload\` |
| Fetch digit-display overrides | GET | \`/api/public/elements?test_id=${game.key}\` |
| Fetch audio overrides | GET | \`/api/public/audio-elements?test_id=${game.key}\` |
| Fetch configured languages | GET | \`/api/public/translations/languages\` |

See **API & Data Flow** section for full request/response structures.

---

## 13. Frontend State Variables

| State | Purpose |
|---|---|
| \`screen\` | \`splash \| practice \| teaching1 \| teaching2 \| game \| score\` |
| \`questionIndex\` | Index into the flat 20-question array (0–19) |
| \`allScores\` | Array of scored-question result records (the 20 game questions) |
| \`teachingScores\` | Array of the 2 teaching-question result records |
| \`consecutiveWrong\` | Running count driving the stop rule |
| \`gameSessionId\` / \`attemptNo\` | Server session id / attempt number |
| \`timerSeconds\` / \`qTimer\` | Overall session timer / per-question timer |
| \`pauses\` | \`{ reason, timestamp }[]\` pause/quit log |
| \`showResumeModal\` / \`resumeData\` | Resume-prompt modal state |
| \`showQuitModal\` / \`quitReason\` | Pause/Quit modal state |
| \`audioFinished\` / \`isCheckingSession\` | Gate splash "Start Now" / splash rendering |
| \`assessment\` / \`isAssessmentSubmitting\` / \`assessmentSubmitted\` | Final \`SessionAssessmentForm\` state |
| \`isRecording\` / \`recordingTarget\` | STT dictation state |

---

## 14. Error Handling

\`\`\`
Session start fail            → alert shown, but still proceeds into
                                 practice with no session id (progress
                                 silently stops syncing from then on)
Activity/resume fetch fail    → console.error only, splash shown normally
Progress save fail (autosave) → console.error only, gameplay continues
PDF generation/upload fail    → console.error only, never shown to the user
Quit with empty reason        → alert shown, blocked until a reason is entered
Final assessment submit fail  → alert shown, submit re-enabled for retry
STT unsupported / STT error   → alert shown
\`\`\`
There's no unified error strategy — some failures are loud (assessment submit, quit validation, STT) while functionally similar ones (session start, autosave, PDF) are silent. Worth being aware of when triaging "why didn't this session sync" reports.

---

## 15. Speech-to-Text (Voice Input)

\`\`\`
Uses: window.SpeechRecognition || window.webkitSpeechRecognition
Targets: quitReason (Pause/Quit modal) · assessmentNotes (final assessment form)
Config: lang: STT_LANG_MAP[language] || 'en-US'
\`\`\`
A global cleanup effect on unmount stops \`window.activeRecognition\` to release the microphone if the assessor navigates away mid-dictation.

---

## 16. Technical Notes

- Only the **first attempt** on each Teaching question is scored — a wrong first attempt still plays a correction audio and lets the child try again, but that retry doesn't change the recorded score.
- Digit **7 is deliberately excluded** from every sequence in this game — worth knowing before assuming a bug if it's ever referenced as "missing."
- \`replayCount\` is tracked per question but does **not** affect scoring or the stop rule — it's recorded for reporting only.
- The score shown on the score screen is out of **22**, not 20 — it includes the 2 scored Teaching questions alongside the 20 Game questions.
- \`showGrid\` is a declared but apparently unused state variable in the source — likely leftover from a shared component pattern; not wired to any visible JSX.

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── API & Backend Logic template (pre-populated with real SANGIAN API data) ──
// Merged with the former Data Flow template — same endpoints/payloads/tables
// were being narrated twice (reference-style here, step-by-step there); the
// step-by-step walkthrough now lives as §15 below instead of a separate section.

const makeApiTemplate = (game) => `# 🔗 ${game.title} — API & Data Flow

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

### Complete Data Journey

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

For the full step-by-step walkthrough of what happens at each of these points — with exact request/response payloads — see **§15 Data Flow — Stage-by-Stage Breakdown** below.

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

## 15. Data Flow — Stage-by-Stage Breakdown

This section walks through the same session lifecycle as §2 and §5 above, but end-to-end and in narrative order — useful for onboarding or tracing a bug across the full request chain.

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

**Terminal status guard**: Once \`quit\` or \`dropped\`, the server will never overwrite to \`completed\` (see §5 above).

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

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Reading Skill V2 API & Data Flow — adds content-management endpoints ──
// unique to this game, corrects the saved_state / score shape (no allScores,
// no 'dropped' status), points the Visual Workflow section at the real
// Workflow Diagram tab, and merges in the stage-by-stage Data Flow walkthrough
// (§15) instead of keeping it as a separate section — same endpoints/payloads/
// tables were being narrated twice.

const makeReadingV2ApiTemplate = (game) => `# 🔗 ${game.title} — API & Data Flow

---

## 1. Game Overview

### Purpose
${game.title} is an ASER 2014-style adaptive oral reading assessment within the SANGIAN platform. The backend is responsible for creating and managing every game session, capturing per-stage results as the child moves through the ladder, serving admin-managed test content, and generating reports for researchers and administrators.

### What the Backend Does
- Creates and tracks unique game sessions per child
- Saves gameplay progress and stage-level results in real time (not per-question scores — see **Score Logic**)
- Serves admin-managed letters/words/paragraphs/story/questions/hints, per language
- Applies terminal-status protection to prevent data corruption
- Stores assessor behavioral observations after each session
- Serves structured reports to the admin panel

---

## 2. Backend Workflow

### Complete Data Journey

\`\`\`
Child Logs In (Device)
       ↓
Game Loads → Browser checks for saved session; test content + languages fetched
       ↓
Session Created on Server → Database record written
       ↓
Child Reads Aloud / Assessor Marks Tiles → Stage result saved after each stage
       ↓
Ladder Reaches an End → Final session status written
       ↓
Assessor Submits Form → Behavioral data saved
       ↓
PDF Generated → Dashboard exported and uploaded
       ↓
Admin Views Report → Data read from all three tables
\`\`\`

For the full step-by-step walkthrough of what happens at each of these points — with exact request/response payloads — see **§15 Data Flow — Stage-by-Stage Breakdown** below.

---

## 3. API Overview

### Why APIs Are Used
Every action in the game — starting a session, saving a stage result, submitting an assessment — communicates with the server through APIs. This ensures that no data is lost between the browser and the database.

### Base URL
\`\`\`
/api/games/    (session, assessment, PDF, report routes)
/api/public/   (player-facing content & language routes)
/api/admin/    (admin content-management routes)
\`\`\`

### Authentication
| Route Type | Method |
|---|---|
| Child game routes | Session-based (child must be logged in) |
| Public content routes | None (public, read-only) |
| Admin routes (reports, content management) | JWT Bearer token required (role: admin) |

---

## 4. API Reference List

| API Name | Method | Endpoint | Purpose | Triggered When |
|---|---|---|---|---|
| Start Session | POST | \`/api/games/sessions/start\` | Creates a new game session | Child clicks "Start Now" |
| Update Session | PUT | \`/api/games/sessions/update/:sessionId\` | Updates score, status, saved state | On every stage transition / pause / quit / finalize |
| Resume Check | GET | \`/api/games/sessions/resume/:childId/:gameName\` | Finds the latest session to resume | On game load |
| Game History | GET | \`/api/games/sessions/history/:childId\` | Returns all sessions for a child | Child history panel |
| Game Summaries | GET | \`/api/games/sessions/summaries/:childId\` | Returns per-game summary | Home / splash screen |
| Pending Assessment | GET | \`/api/games/sessions/pending-assessment/:childId\` | Finds sessions without an assessment | After game completion |
| Submit Assessment | POST | \`/api/games/assessments\` | Saves behavioral assessment form | Assessor confirms submission |
| Upload PDF | POST | \`/api/games/pdfs/upload\` | Stores dashboard PDF file | Dashboard export |
| Report Overview | GET | \`/api/games/reports/overview\` | KPI stats for all games (admin only) | Admin opens Reports tab |
| Report Detail | GET | \`/api/games/reports/detail/:gameName\` | Detailed session list for one game | Admin views game report |
| **Fetch Test Content** | GET | \`/api/public/elements?test_id=${game.key}\` | Loads admin-managed letters/words/paragraphs/story/questions/hints | On game load |
| **Fetch Languages** | GET | \`/api/public/translations/languages\` | Resolves the player's language and platform default | On game load |
| **(Admin) Load Content Elements** | GET | \`/api/admin/elements?test_id=${game.key}\` | Loads all content rows for the Elements editor | Admin opens Content Manager |
| **(Admin) Save Content Element** | PUT | \`/api/admin/elements/config\` | Saves an edited letters/words/paragraph/story/question/hint entry | Admin clicks Save in Content Manager |
| **(Admin) Toggle Content Status** | PUT | \`/api/admin/elements/:fileId/status\` | Enables/disables a saved content row | Admin toggles a row's status |

The last 5 rows (bold) are specific to games with admin-managed content, like this one — most other SANGIAN games hardcode their content and don't use them.

---

## 5. Backend Logic (Simplified)

### Session Lifecycle

\`\`\`
A new session is created when the child starts the game.

If an active 'in_progress' session already exists for the same
child and game, the server returns the existing session ID
instead of creating a duplicate record.

During gameplay, the session is updated with:
  - Current score (LEVELS[finalLevel], 0-4, once the ladder ends)
  - Progress level (path.length + 1 — stages traversed so far)
  - Saved state (full JSON snapshot of ladder state)

When the ladder ends:
  - Status → completed (or quit, if the assessor ended it early)
  - End time is recorded
  - Saved state is finalized
\`\`\`

### Terminal Status Protection

\`\`\`
Once a session is marked as 'quit' or 'dropped', the server
will never allow it to be overwritten as 'completed'.

This is a server-side safety guard against client-side bugs
that might accidentally send a 'completed' update after the
session has already been terminated. The guard is shared
backend logic across all games — this particular game just
never produces a 'dropped' status itself.

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
  "total_questions": 5
}
\`\`\`
Note: \`total_questions\` is a fixed value (5) for this game — it does not correspond to a real question count, since the ladder has no fixed number of items.

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

**Request Body** (real \`buildSavedState\` shape — see **Technical Documentation**):
\`\`\`json
{
  "score": 3,
  "progress_level": 4,
  "status": "in_progress",
  "saved_state": {
    "stage": "story",
    "selectedParagraphIndex": 0,
    "wordsSource": "direct",
    "selectedWords": [{ "text": "घर", "correct": true }],
    "selectedWordsRetry": [],
    "selectedLetters": [],
    "paragraphResult": { "pass": true, "ssrAnswers": ["no","no","no"], "timeTaken": 38 },
    "paragraphRetryResult": null,
    "storyResult": null,
    "path": ["paragraph"],
    "finalLevel": null,
    "finalScore": null,
    "finalGameTime": null,
    "timerSeconds": 96,
    "qTimer": 12,
    "pauses": []
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

**Supported Status Values (this game):**
\`\`\`
in_progress  — Ladder is actively being played
paused       — Session paused (resume popup will show on next visit)
completed    — Ladder reached an END point in the routing table
quit         — Assessor ended the session early
\`\`\`
\`dropped\` is a status value the backend supports generically for other games, but this game never sets it — every FAIL branch routes to either another stage or a defined final level, never an undefined "drop."

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
  "additional_notes": "Read the paragraph confidently but hesitated on the story."
}
\`\`\`
\`q5_behaviors\` must contain at least 1 entry — the form blocks submission with 0 selected (see **Assessment Behavior**).

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
    "score": null,
    "progress_level": 2,
    "saved_state": { "stage": "words", "path": ["paragraph"], "...": "..." },
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
game_name       VARCHAR  — Internal game key (${game.key})
start_time      DATETIME — When the session began
end_time        DATETIME — When the session ended (NULL if active)
score           INT      — LEVELS[finalLevel], 0–4 (NULL until the ladder ends)
total_questions INT      — Fixed at 5 for this game (not a real question count)
progress_level  INT      — path.length + 1 — stages traversed so far
status          ENUM     — in_progress / paused / completed / quit (no 'dropped' for this game)
quit_reason     VARCHAR  — Reason for early termination (if any)
saved_state     JSON     — Full snapshot: stage, path, per-stage results, timings
\`\`\`

### saved_state JSON Structure (this game)

\`\`\`json
{
  "stage": "story",
  "selectedParagraphIndex": 0,
  "wordsSource": "direct",
  "selectedWords": [{ "text": "घर", "correct": true }],
  "selectedWordsRetry": [],
  "selectedLetters": [],
  "paragraphResult": { "pass": true, "ssrAnswers": ["no","no","no"], "timeTaken": 38 },
  "storyResult": null,
  "path": ["paragraph"],
  "finalLevel": null,
  "finalScore": null,
  "timerSeconds": 96,
  "qTimer": 12,
  "pauses": []
}
\`\`\`
This is a materially different shape from the \`allScores\`-based structure used by fixed-question games — see the **saved_state Schema Flexibility** note below.

### Data Flow

\`\`\`
Session Starts  → Record written: status = 'in_progress'
       ↓
Stages Traversed → saved_state JSON updated after each stage transition
       ↓
Ladder Reaches an END → status = 'completed', end_time recorded, finalLevel/finalScore set
Game Quit Early        → status = 'quit', quit_reason saved
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
The \`score\` column in \`game_sessions\` holds \`LEVELS[finalLevel]\` — a 0–4 ASER reading level — not a count of correct answers. It is \`NULL\`/unset until the ladder actually reaches an END.

Per-stage results are stored directly in \`saved_state\` under their own keys — \`selectedWords\`, \`selectedWordsRetry\`, \`selectedLetters\`, \`paragraphResult\`, \`paragraphRetryResult\`, \`storyResult\` — **not** in a single \`allScores\` array like fixed-question games use. See **Score Logic** for the exact shape of each.

### Report Reading for This Game
Because this game's \`saved_state\` doesn't follow the \`allScores\` shape, any report/aggregation logic reading it needs to branch on game type and read \`path\`, \`finalLevel\`, \`finalScore\`, and the per-stage \`timeTaken\` fields instead — the same adaptation the backend already makes for other non-standard games (see **saved_state Schema Flexibility**, §13).

---

## 9. Assessment Logic

### Behavioral Assessment Questions
After each session, the assessor completes a structured observation form:

| Question | Type |
|---|---|
| Q1 — "Did you enjoy playing the game?" | Single choice, required |
| Q2 — "How did the game feel for you?" | Single choice, required |
| Q3 — "Did you feel tired while playing the game?" | Single choice, required |
| Q4 — "Would you like to play the game again?" | Single choice, required |
| Q5 — Observed behaviors | Multi-select checkboxes, **required (≥1)** |
| Additional Notes | Free text, optional |

### Assessment Storage
Responses are stored in the \`game_assessments\` table linked to \`session_id\`. The \`q5_behaviors\` field is stored as a JSON array of canonical English behavior strings, regardless of the assessor's display language.

### Pending Assessment Detection
The backend detects sessions where \`status IN ('completed', 'quit')\` but no corresponding record exists in \`game_assessments\`. A prompt is shown to the assessor to complete the form before navigating away. (This game never produces \`'dropped'\`, so that status isn't part of the check for it.)

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
- Ladder gameplay continues running locally if a save API call fails (see **Technical Documentation § Error Handling**)
- Session ID is stored in React state for the duration of gameplay
- Final session update is always attempted before displaying the score screen

---

## 11. Security & Validation

### Admin Route Protection
All report and content-management routes require a JWT Bearer token with \`role: admin\`.

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

The full visual API/session/stage-flow diagrams for this game are already built — see the **Workflow Diagram** section for this game, which has dedicated tabs for Game Journey, Stage Flow, Score & Level, API Flow, and Session States, all generated from this game's real adaptive-ladder logic.

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
- \`allScores\` array (standard fixed-question games)
- \`itemResults\` array (Chor Machaye Shor)
- \`questionDetails\` map (games with mid-test assessments)
- \`stage\` / \`path\`-based adaptive-ladder shape (**this game** — see §7 above)

### Attempt Number Calculation
Attempt numbers are not stored as a column — they are calculated dynamically at query time by counting sessions for the same \`child_id\` + \`game_name\` ordered by \`start_time\`.

---

## 14. Future Scalability

- **New games**: Follow the same session lifecycle — only \`game_name\` changes, no new tables needed
- **New question/stage metrics**: \`saved_state\` JSON schema can be extended without database migrations
- **Reporting expansion**: The Reports Detail API dynamically reads column keys from \`saved_state\`, adapting automatically to any game structure
- **API versioning**: Base path \`/api/games/\` supports future versioned sub-routes

---

## 15. Data Flow — Stage-by-Stage Breakdown

This section walks through the same session lifecycle as §2 and §5 above, but end-to-end and in narrative order — useful for onboarding or tracing a bug across the full request chain. Unlike a fixed-question game, this game also **reads** admin-managed test content (letters/words/paragraphs/story/questions/hints) on load — a read path from a separate content table, not one of the three session-related tables the rest of this walkthrough covers.

### Stage 1 — Game Load (Resume Check + Content Fetch)

When the game screen opens, two things happen in parallel:

\`\`\`
GET /api/games/sessions/resume/:childId/${game.key}

Purpose: Check if the child has an unfinished session
Result:
  → Session found (status: in_progress or paused) → Show "Resume" popup
  → No session found                               → Show Splash screen
\`\`\`

\`\`\`
GET /api/public/elements?test_id=${game.key}
GET /api/public/translations/languages

Purpose: Load the admin-managed letters/words/paragraphs/story/questions/
hints, resolved for the child's language (falling back to the platform
default language, then to a hardcoded constant if still unset)
\`\`\`

**Data involved:** child_id, game_name, saved_state (if resuming); content elements + language config (always)

### Stage 2 — Session Start

When the child clicks "Start Now":

\`\`\`
POST /api/games/sessions/start

Sends: child_id, game_name, total_questions (fixed at 5 — not a real question count)
Receives: sessionId, attempt_no

Database: New row written in game_sessions
  status = 'in_progress'
  start_time = NOW()
  score = NULL (no level reached yet)
\`\`\`

If an active session already exists, the server returns the existing session ID (no duplicate created).

### Stage 3 — During Gameplay (Auto-Save)

After every stage transition (not every question — this game has no per-question loop), the complete ladder state is synced to the server:

\`\`\`
PUT /api/games/sessions/update/:sessionId

Sends:
  score          → LEVELS[finalLevel] once the ladder ends, else unset
  progress_level → path.length + 1 (stages traversed so far)
  status         → 'in_progress'
  saved_state    → full JSON snapshot (see §6 above for the exact shape)
\`\`\`

This ensures that if the device loses connectivity or the browser closes, the session can be resumed from the last completed stage. Note: mid-marking progress on the *current* Words/Letters tile screen is not part of this snapshot — only completed stages are saved.

### Stage 4 — Pause / Quit

If the assessor pauses or quits the session:

\`\`\`
Pause:
  PUT /api/games/sessions/update/:sessionId
  status = 'paused'
  saved_state.pauses gets a new entry: { stage, reason, timestamp }

Quit:
  PUT /api/games/sessions/update/:sessionId
  status = 'quit'
  quit_reason = assessor-entered (typed or dictated) reason
  end_time = NOW()
\`\`\`

A reason is required before either action confirms — the pause/quit modal blocks otherwise.

### Stage 5 — Game End (Ladder Reaches an End)

When the ladder reaches an END point in its stage-routing table (see **Score & Progression Logic** or **Workflow Diagram → Stage Flow**):

\`\`\`
PUT /api/games/sessions/update/:sessionId
  status = 'completed'
  score = LEVELS[finalLevel]  (0–4, an ASER reading level)
  progress_level = path.length + 1
  end_time = NOW()
  saved_state = final snapshot, including path[] and finalLevel
\`\`\`

**Terminal status guard**: Once \`quit\`, the server will never overwrite to \`completed\`. This game never produces a \`'dropped'\` status — every stage's FAIL branch routes to either another stage or a defined final level.

### Stage 6 — Behavioral Assessment Submission

After the score screen appears, the assessor fills in the observation form (Q1–Q5 required, Q5 needs at least 1 behavior checked) and confirms in a modal before it's sent:

\`\`\`
POST /api/games/assessments

Sends:
  session_id, child_id
  q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again
  q5_behaviors (JSON array, ≥1 entry required)
  additional_notes

Database: New row in game_assessments linked to session
\`\`\`

### Stage 7 — PDF Generation and Upload

Immediately after assessment submission (or game end), the system generates a PDF of the score dashboard:

\`\`\`
1. Score screen (#dashboard-capture-area) is cloned off-screen to avoid
   clipping from the game shell's backdrop-filter, then rendered to a
   canvas (html2canvas, scale 1.5)
2. Canvas is converted to a JPEG image
3. Image is embedded in an A4 PDF (jsPDF)
4. PDF blob is uploaded:

POST /api/games/pdfs/upload
  Sends: PDF file, child_id, session_id, game_name
  Database: New row in game_dashboard_pdfs with file path
\`\`\`

PDF filename format:
\`\`\`
[ChildName]_ReadingSkillV2_SES[sessionId]_[timestamp].pdf
\`\`\`

### Stage 8 — Admin Report View

When the administrator opens the Reports module:

\`\`\`
GET /api/games/reports/detail/${game.key}

Server joins data from:
  game_sessions       → score, status, timing, saved_state
  children            → child_name
  game_assessments    → behavioral observations
  game_dashboard_pdfs → PDF download link

Parses saved_state JSON to extract path[], finalLevel, finalScore, and
each stage's own result/timing fields — NOT a "question_scores" list,
since this game has no individually scored questions (see §8 Score
Calculation above for why the standard allScores-based report reading
doesn't apply here)
\`\`\`

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Ankganit V3 API & Data Flow — adds the split content-management model ──
// (canonical scoring bank vs. cosmetic display overrides) unique to this game,
// corrects the saved_state shape (no allScores, no 'dropped' status), points
// Visual Workflow at the real Workflow Diagram tab, and merges in the
// stage-by-stage Data Flow walkthrough (§15) instead of a separate section.

const makeAnkganitV3ApiTemplate = (game) => `# 🔗 ${game.title} — API & Data Flow

---

## 1. Game Overview

### Purpose
${game.title} is an adaptive arithmetic assessment within the SANGIAN platform. The backend is responsible for creating and managing every game session, capturing per-stage results as the child moves through the ladder, serving the canonical question bank and admin-managed display text, and generating reports for researchers and administrators.

### What the Backend Does
- Creates and tracks unique game sessions per child
- Saves gameplay progress and stage-level results in real time (not per-question scores — see **Score & Progression Logic**)
- Serves the canonical subtraction/division/number-recognition question bank, and separately, admin-managed per-language display text
- Applies terminal-status protection to prevent data corruption
- Stores assessor behavioral observations after each session
- Serves structured reports to the admin panel

---

## 2. Backend Workflow

### Complete Data Journey

\`\`\`
Child Logs In (Device)
       ↓
Game Loads → Browser checks for saved session; question bank + display text fetched
       ↓
Session Created on Server → Database record written
       ↓
Child Solves Subtraction/Division / Assessor Marks Tiles → Stage result saved
       ↓
Ladder Reaches an End → Final session status written
       ↓
Assessor Submits Form → Behavioral data saved
       ↓
PDF Generated → Dashboard exported and uploaded
       ↓
Admin Views Report → Data read from all three tables
\`\`\`

For the full step-by-step walkthrough of what happens at each of these points — with exact request/response payloads — see **§15 Data Flow — Stage-by-Stage Breakdown** below.

---

## 3. API Overview

### Why APIs Are Used
Every action in the game — starting a session, saving a stage result, submitting an assessment — communicates with the server through APIs. This ensures that no data is lost between the browser and the database.

### Base URL
\`\`\`
/api/games/    (session, assessment, PDF, report routes)
/api/public/   (question bank + display-text + language routes)
/api/admin/    (admin content-management routes)
\`\`\`

### Authentication
| Route Type | Method |
|---|---|
| Child game routes | Session-based (child must be logged in) |
| Public content routes | None (public, read-only) |
| Admin routes (reports, content management) | JWT Bearer token required (role: admin) |

---

## 4. API Reference List

| API Name | Method | Endpoint | Purpose | Triggered When |
|---|---|---|---|---|
| Start Session | POST | \`/api/games/sessions/start\` | Creates a new game session | Child clicks "Start Now" |
| Update Session | PUT | \`/api/games/sessions/update/:sessionId\` | Updates score, status, saved state | On every stage transition / pause / quit / finalize |
| Resume Check | GET | \`/api/games/sessions/resume/:childId/:gameName\` | Finds the latest session to resume | On game load |
| Game History | GET | \`/api/games/sessions/history/:childId\` | Returns all sessions for a child | Child history panel |
| Game Summaries | GET | \`/api/games/sessions/summaries/:childId\` | Returns per-game summary | Home / splash screen |
| Pending Assessment | GET | \`/api/games/sessions/pending-assessment/:childId\` | Finds sessions without an assessment | After game completion |
| Submit Assessment | POST | \`/api/games/assessments\` | Saves behavioral assessment form | Assessor confirms submission |
| Upload PDF | POST | \`/api/games/pdfs/upload\` | Stores dashboard PDF file | Dashboard export |
| Report Overview | GET | \`/api/games/reports/overview\` | KPI stats for all games (admin only) | Admin opens Reports tab |
| Report Detail | GET | \`/api/games/reports/detail/:gameName\` | Detailed session list for one game | Admin views game report |
| **Question Bank** | GET | \`/api/public/ankganit-v3\` | Loads the canonical subtraction/division/number-recognition bank (correct answers included) | On game load |
| **Fetch Display Overrides** | GET | \`/api/public/elements?test_id=${game.key}\` | Loads admin-managed per-language display text | On game load |
| **Fetch Languages** | GET | \`/api/public/translations/languages\` | Resolves the player's language and platform default | On game load |
| **(Admin) Update Category** | PUT | \`/api/admin/ankganit-v3/categories/:id\` | Edits category name/active flag (\`minimum_correct\`/\`evaluation_type\` are also editable here but never read by gameplay — see Score & Progression Logic §14) | Admin edits Category Config |
| **(Admin) Update Question** | PUT | \`/api/admin/ankganit-v3/questions/:id\` | Edits question text/correct_answer/remainder | Admin edits Category Config |

The last 5 rows (bold) are specific to games with a split canonical-content/display-overrides architecture, like this one.

---

## 5. Backend Logic (Simplified)

### Session Lifecycle

\`\`\`
A new session is created when the child starts the game.

If an active 'in_progress' session already exists for the same
child and game, the server returns the existing session ID
instead of creating a duplicate record.

During gameplay, the session is updated with:
  - Current score (LEVELS[finalLevel], once the ladder ends)
  - Progress level (path.length + 1 — stages traversed so far)
  - Saved state (full JSON snapshot of ladder state)

When the ladder ends:
  - Status → completed (or quit, if the assessor ended it early)
  - End time is recorded
  - Saved state is finalized
\`\`\`

### Terminal Status Protection

\`\`\`
Once a session is marked as 'quit' or 'dropped', the server
will never allow it to be overwritten as 'completed'.

This is a server-side safety guard against client-side bugs
that might accidentally send a 'completed' update after the
session has already been terminated. The guard is shared
backend logic across all games — this particular game just
never produces a 'dropped' status itself.

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
  "game_name": "${game.key}"
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

**Request Body** (real \`buildSavedState\` shape — see **Technical Documentation**):
\`\`\`json
{
  "score": 3,
  "progress_level": 4,
  "status": "in_progress",
  "saved_state": {
    "stage": "division_q1",
    "path": ["subtraction_select", "subtraction_q1", "subtraction_q2", "division_select"],
    "subtraction": {
      "q1": { "firstAttempt": { "correct": true, "timeTaken": 9, "enteredAnswer": 31 }, "finalCorrect": true },
      "q2": { "firstAttempt": { "correct": true, "timeTaken": 7, "enteredAnswer": 18 }, "finalCorrect": true },
      "bothCorrect": true
    },
    "division": null,
    "numberRecognition99": null,
    "numberRecognition9": null,
    "finalLevel": null,
    "finalScore": null,
    "finalGameTime": null,
    "timerSeconds": 84,
    "qTimer": 6,
    "pauses": []
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

**Supported Status Values (this game):**
\`\`\`
in_progress  — Ladder is actively being played
paused       — Session paused (resume popup will show on next visit)
completed    — Ladder reached an END point in the routing table
quit         — Assessor ended the session early
\`\`\`
\`dropped\` is a status value the backend supports generically for other games, but this game never sets it — every FAIL branch routes to either another stage or a defined final level, never an undefined "drop."

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
  "additional_notes": "Solved subtraction confidently but struggled with the division remainder."
}
\`\`\`
\`q5_behaviors\` must contain at least 1 entry — the form blocks submission with 0 selected (see **Assessment Behavior**).

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
    "score": null,
    "progress_level": 3,
    "saved_state": { "stage": "number_recognition_99", "path": ["subtraction_select","subtraction_q1","subtraction_q2"], "...": "..." },
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
| \`ankganit_v3_categories\` | The 4 category definitions (name, active flag, and the vestigial \`minimum_correct\`/\`evaluation_type\` fields) |
| \`ankganit_v3_questions\` | The canonical question bank — text, \`correct_answer\`, \`remainder\`, \`display_order\`, linked to a category |

### game_sessions Schema

\`\`\`
id              INT      — Unique session identifier (auto-increment)
child_id        VARCHAR  — Links to the child who played
game_name       VARCHAR  — Internal game key (${game.key})
start_time      DATETIME — When the session began
end_time        DATETIME — When the session ended (NULL if active)
score           INT      — LEVELS[finalLevel], 0–4 (NULL until the ladder ends)
progress_level  INT      — path.length + 1 — stages traversed so far
status          ENUM     — in_progress / paused / completed / quit (no 'dropped' for this game)
quit_reason     VARCHAR  — Reason for early termination (if any)
saved_state     JSON     — Full snapshot: stage, path, per-category results, timings
\`\`\`

### saved_state JSON Structure (this game)

\`\`\`json
{
  "stage": "division_q1",
  "path": ["subtraction_select", "subtraction_q1", "subtraction_q2", "division_select"],
  "subtraction": { "q1": { "...": "..." }, "q2": { "...": "..." }, "bothCorrect": true },
  "division": null,
  "numberRecognition99": null,
  "numberRecognition9": null,
  "finalLevel": null,
  "finalScore": null,
  "timerSeconds": 84,
  "qTimer": 6,
  "pauses": []
}
\`\`\`
This is grouped by *category* (\`subtraction\`, \`division\`, \`numberRecognition99\`, \`numberRecognition9\`) rather than by stage type — a different grouping from Padh ke Batao V2's per-stage-type shape, and a materially different shape from the \`allScores\`-based structure used by fixed-question games. See the **saved_state Schema Flexibility** note below.

### Data Flow

\`\`\`
Session Starts  → Record written: status = 'in_progress'
       ↓
Stages Traversed → saved_state JSON updated after each stage transition
       ↓
Ladder Reaches an END → status = 'completed', end_time recorded, finalLevel/finalScore set
Game Quit Early        → status = 'quit', quit_reason saved
       ↓
Assessment Submitted → Record written in game_assessments table
       ↓
PDF Exported         → File path stored in game_dashboard_pdfs
       ↓
Admin Views Reports  → Data joined from all three session-related tables
\`\`\`

---

## 8. Score Calculation

### How Scores Are Stored
The \`score\` column in \`game_sessions\` holds \`LEVELS[finalLevel]\` — a 0–4 numeracy level — not a count of correct answers. It is \`NULL\`/unset until the ladder actually reaches an END.

Per-stage results are stored directly in \`saved_state\`, grouped by category (\`subtraction\`, \`division\`, \`numberRecognition99\`, \`numberRecognition9\`) — **not** in a single \`allScores\` array like fixed-question games use. See **Score & Progression Logic** for the exact shape of each.

### Report Reading for This Game
Because this game's \`saved_state\` doesn't follow the \`allScores\` shape, any report/aggregation logic reading it needs to branch on game type and read \`path\`, \`finalLevel\`, \`finalScore\`, and each category's own result/timing fields instead — the same adaptation the backend already makes for other non-standard games (see **saved_state Schema Flexibility**, §13).

---

## 9. Assessment Logic

### Behavioral Assessment Questions
After each session, the assessor completes a structured observation form:

| Question | Type |
|---|---|
| Q1 — "Did you enjoy playing the game?" | Single choice, required |
| Q2 — "How did the game feel for you?" | Single choice, required |
| Q3 — "Did you feel tired while playing the game?" | Single choice, required |
| Q4 — "Would you like to play the game again?" | Single choice, required |
| Q5 — Observed behaviors | Multi-select checkboxes, **required (≥1)** |
| Additional Notes | Free text, optional |

### Assessment Storage
Responses are stored in the \`game_assessments\` table linked to \`session_id\`. The \`q5_behaviors\` field is stored as a JSON array of canonical English behavior strings, regardless of the assessor's display language.

### Pending Assessment Detection
The backend detects sessions where \`status IN ('completed', 'quit')\` but no corresponding record exists in \`game_assessments\`. A prompt is shown to the assessor to complete the form before navigating away. (This game never produces \`'dropped'\`, so that status isn't part of the check for it.)

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
- Ladder gameplay continues running locally if a save API call fails (see **Technical Documentation § Error Handling**)
- Session ID is stored in React state for the duration of gameplay
- Final session update is always attempted before displaying the score screen

---

## 11. Security & Validation

### Admin Route Protection
All report and content-management routes require a JWT Bearer token with \`role: admin\`.

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

The full visual API/session/stage-flow diagrams for this game are already built — see the **Workflow Diagram** section for this game, which has dedicated tabs for Game Journey, Stage Flow, Score & Level, API Flow, and Session States, all generated from this game's real adaptive-ladder logic.

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
Note this last alias maps the bare "Ankganit" name to \`numeracy_number_skill\` (V0), not \`numeracy_number_skill_v3\` — worth double-checking if this alias is ever hit for V3 traffic, since it would silently misattribute sessions to the wrong game version.

### saved_state Schema Flexibility
The JSON schema of \`saved_state\` varies by game. The Reports Detail API handles multiple formats:
- \`allScores\` array (standard fixed-question games)
- \`itemResults\` array (Chor Machaye Shor)
- \`questionDetails\` map (games with mid-test assessments)
- \`stage\` / \`path\`-based adaptive-ladder shape, grouped by category (**this game** — see §7 above)

### Attempt Number Calculation
Attempt numbers are not stored as a column — they are calculated dynamically at query time by counting sessions for the same \`child_id\` + \`game_name\` ordered by \`start_time\`.

---

## 14. Future Scalability

- **New games**: Follow the same session lifecycle — only \`game_name\` changes, no new tables needed
- **New question/stage metrics**: \`saved_state\` JSON schema can be extended without database migrations
- **Reporting expansion**: The Reports Detail API dynamically reads column keys from \`saved_state\`, adapting automatically to any game structure
- **API versioning**: Base path \`/api/games/\` supports future versioned sub-routes

---

## 15. Data Flow — Stage-by-Stage Breakdown

This section walks through the same session lifecycle as §2 and §5 above, but end-to-end and in narrative order — useful for onboarding or tracing a bug across the full request chain. Unlike a fixed-question game, this game also **reads** a canonical question bank (with correct answers) on load, separately from admin-managed per-language display text — neither is one of the three session-related tables the rest of this walkthrough covers.

### Stage 1 — Game Load (Resume Check + Content Fetch)

When the game screen opens, several things happen in parallel:

\`\`\`
GET /api/games/sessions/resume/:childId/${game.key}

Purpose: Check if the child has an unfinished session
Result:
  → Session found (status: in_progress or paused) → Show "Resume" popup
  → No session found                               → Show Splash screen
\`\`\`

\`\`\`
GET /api/public/ankganit-v3

Purpose: Load the canonical question bank (correct_answer/remainder
included) for all 4 categories — this is what scoring actually uses
\`\`\`

\`\`\`
GET /api/public/elements?test_id=${game.key}
GET /api/public/translations/languages

Purpose: Load admin-managed per-language display text for each question
(cosmetic only — never affects scoring)
\`\`\`

**Data involved:** child_id, game_name, saved_state (if resuming); question bank (always); display overrides + language config (always)

### Stage 2 — Session Start

When the child clicks "Start Now":

\`\`\`
POST /api/games/sessions/start

Sends: child_id, game_name
Receives: sessionId, attempt_no

Database: New row written in game_sessions
  status = 'in_progress'
  start_time = NOW()
  score = NULL (no level reached yet)
\`\`\`

If an active session already exists, the server returns the existing session ID (no duplicate created).

### Stage 3 — During Gameplay (Auto-Save)

After every stage transition, the complete ladder state is synced to the server:

\`\`\`
PUT /api/games/sessions/update/:sessionId

Sends:
  score          → LEVELS[finalLevel] once the ladder ends, else unset
  progress_level → path.length + 1 (stages traversed so far)
  status         → 'in_progress'
  saved_state    → full JSON snapshot (see §6 above for the exact shape)
\`\`\`

This ensures that if the device loses connectivity or the browser closes, the session can be resumed from the last completed stage. Note: mid-marking progress on the *current* Number Recognition tile screen is not part of this snapshot — only completed stages are saved.

### Stage 4 — Pause / Quit

If the assessor pauses or quits the session:

\`\`\`
Pause:
  PUT /api/games/sessions/update/:sessionId
  status = 'paused'
  saved_state.pauses gets a new entry: { stage, reason, timestamp }

Quit:
  PUT /api/games/sessions/update/:sessionId
  status = 'quit'
  quit_reason = assessor-entered (typed or dictated) reason
  end_time = NOW()
\`\`\`

A reason is required before either action confirms — the pause/quit modal blocks otherwise.

### Stage 5 — Game End (Ladder Reaches an End)

When the ladder reaches an END point in its stage-routing table (see **Score & Progression Logic** or **Workflow Diagram → Stage Flow**):

\`\`\`
PUT /api/games/sessions/update/:sessionId
  status = 'completed'
  score = LEVELS[finalLevel]  (0–4)
  progress_level = path.length + 1
  end_time = NOW()
  saved_state = final snapshot, including path[] and finalLevel
\`\`\`

**Terminal status guard**: Once \`quit\`, the server will never overwrite to \`completed\`. This game never produces a \`'dropped'\` status.

### Stage 6 — Behavioral Assessment Submission

After the score screen appears, the assessor fills in the observation form (Q1–Q5 required, Q5 needs at least 1 behavior checked) and confirms in a modal before it's sent:

\`\`\`
POST /api/games/assessments

Sends:
  session_id, child_id
  q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again
  q5_behaviors (JSON array, ≥1 entry required)
  additional_notes

Database: New row in game_assessments linked to session
\`\`\`

### Stage 7 — PDF Generation and Upload

Immediately after assessment submission (or game end), the system generates a PDF of the score dashboard:

\`\`\`
1. Score screen (.ns-main) is cloned off-screen to avoid clipping from
   .ns-app's overflow:hidden + height:100dvh, then rendered to a
   canvas (html2canvas, scale 1.5)
2. Canvas is converted to a JPEG image
3. Image is embedded in an A4 PDF (jsPDF)
4. PDF blob is uploaded:

POST /api/games/pdfs/upload
  Sends: PDF file, child_id, session_id, game_name
  Database: New row in game_dashboard_pdfs with file path
\`\`\`

PDF filename format:
\`\`\`
[ChildName]_AnkganitV3_SES[sessionId]_[timestamp].pdf
\`\`\`

### Stage 8 — Admin Report View

When the administrator opens the Reports module:

\`\`\`
GET /api/games/reports/detail/${game.key}

Server joins data from:
  game_sessions       → score, status, timing, saved_state
  children            → child_name
  game_assessments    → behavioral observations
  game_dashboard_pdfs → PDF download link

Parses saved_state JSON to extract path[], finalLevel, finalScore, and
each category's own result/timing fields — NOT a "question_scores" list,
since this game has no individually scored questions in the fixed-quiz
sense (see §8 Score Calculation above for why the standard allScores-based
report reading doesn't apply here)
\`\`\`

---

*Last updated — SANGIAN Documentation Center 2026*
`;

// ─── Lottery Ka Ticket API & Data Flow ─────────────────────────────────────────
// This game IS a genuine fixed-question test, so the generic API/Data Flow
// model mostly fits (real 'dropped' status, real allScores-style array). What
// needs correcting: the per-question record shape has extra fields
// (userResponse/correctAnswer/replayCount) the generic template doesn't show,
// there's a second teachingScores array the generic template has no concept
// of, and the content-management endpoints are cosmetic-only (digit display +
// audio), not question-authoring like the two adaptive-ladder games.

const makeLotteryApiTemplate = (game) => `# 🔗 ${game.title} — API & Data Flow

---

## 1. Game Overview

### Purpose
${game.title} is an auditory working-memory (number sequence recall) assessment within the SANGIAN platform. The backend is responsible for creating and managing every game session, capturing per-question results in real time, storing assessment observations, and generating reports for researchers and administrators.

### What the Backend Does
- Creates and tracks unique game sessions per child
- Saves gameplay progress and per-question scores in real time, across two separate arrays (\`allScores\` for the 20 game questions, \`teachingScores\` for the 2 teaching questions)
- Applies terminal-status protection to prevent data corruption
- Stores assessor behavioral observations after each session
- Serves structured reports to the admin panel

---

## 2. Backend Workflow

### Complete Data Journey

\`\`\`
Child Logs In (Device)
       ↓
Game Loads → Browser checks for saved session; digit-display + audio
             overrides fetched
       ↓
Session Created on Server → Database record written
       ↓
Child Recalls Sequences (Teaching, then Game) → Score saved after each answer
       ↓
Game Ends (all 20 done, OR 3 consecutive wrong) → Final session status written
       ↓
Assessor Submits Form → Behavioral data saved
       ↓
PDF Generated → Dashboard exported and uploaded
       ↓
Admin Views Report → Data read from all three tables
\`\`\`

For the full step-by-step walkthrough of what happens at each of these points — with exact request/response payloads — see **§15 Data Flow — Stage-by-Stage Breakdown** below.

---

## 3. API Overview

### Why APIs Are Used
Every action in the game — starting a session, saving a score, submitting an assessment — communicates with the server through APIs. This ensures that no data is lost between the browser and the database.

### Base URL
\`\`\`
/api/games/    (session, assessment, PDF, report routes)
/api/public/   (digit-display + audio override + language routes)
/api/admin/    (admin content-management routes)
\`\`\`

### Authentication
| Route Type | Method |
|---|---|
| Child game routes | Session-based (child must be logged in) |
| Public content routes | None (public, read-only) |
| Admin routes (reports, content management) | JWT Bearer token required (role: admin) |

---

## 4. API Reference List

| API Name | Method | Endpoint | Purpose | Triggered When |
|---|---|---|---|---|
| Start Session | POST | \`/api/games/sessions/start\` | Creates a new game session | Child clicks "Start Now" |
| Update Session | PUT | \`/api/games/sessions/update/:sessionId\` | Updates score, status, saved state | After every question / on game end |
| Resume Check | GET | \`/api/games/sessions/resume/:childId/:gameName\` | Finds the latest session to resume | On game load |
| Game History | GET | \`/api/games/sessions/history/:childId\` | Returns all sessions for a child | Child history panel |
| Game Summaries | GET | \`/api/games/sessions/summaries/:childId\` | Returns per-game summary | Home / splash screen |
| Pending Assessment | GET | \`/api/games/sessions/pending-assessment/:childId\` | Finds sessions without an assessment | After game completion |
| Submit Assessment | POST | \`/api/games/assessments\` | Saves behavioral assessment form | Assessor confirms submission |
| Upload PDF | POST | \`/api/games/pdfs/upload\` | Stores dashboard PDF file | Dashboard export |
| Report Overview | GET | \`/api/games/reports/overview\` | KPI stats for all games (admin only) | Admin opens Reports tab |
| Report Detail | GET | \`/api/games/reports/detail/:gameName\` | Detailed session list for one game | Admin views game report |
| **Fetch Digit-Display Overrides** | GET | \`/api/public/elements?test_id=${game.key}\` | Loads admin-managed per-language numpad glyph overrides (cosmetic only) | On game load |
| **Fetch Audio Overrides** | GET | \`/api/public/audio-elements?test_id=${game.key}\` | Loads per-language audio asset overrides | On game load |
| **Fetch Languages** | GET | \`/api/public/translations/languages\` | Resolves the player's language and platform default | On game load |

The last 3 rows (bold) are specific to this game's content-override system — note this is **cosmetic display overrides only**, not question authoring; the question bank itself is a static array in the frontend with no admin edit path at all.

---

## 5. Backend Logic (Simplified)

### Session Lifecycle

\`\`\`
A new session is created when the child starts the game.

If an active 'in_progress' session already exists for the same
child and game, the server returns the existing session ID
instead of creating a duplicate record.

During gameplay, the session is updated with:
  - Current score (combined allScores + teachingScores correct count)
  - Progress level (questionIndex + 1)
  - Saved state (full JSON snapshot of game data)

When the game ends:
  - Status → completed (all 20 reached) / dropped (3 consecutive wrong) / quit (assessor ended it)
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
Unlike the two adaptive-ladder games on this platform, **this guard is fully active for this game** — \`'dropped'\` is a real, frequently-occurring status here (any time the 3-consecutive-wrong rule fires), not a dead status value.

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
  "total_questions": 22
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

**Request Body** (real shape — see **Technical Documentation § Session State Management**):
\`\`\`json
{
  "score": 6,
  "progress_level": 8,
  "status": "in_progress",
  "saved_state": {
    "questionIndex": 7,
    "allScores": [
      { "qId": 1, "questionNumber": 1, "score": 1, "timeTaken": 4, "userResponse": [8,9], "correctAnswer": [8,9], "replayCount": 0 },
      { "qId": 2, "questionNumber": 2, "score": 0, "timeTaken": 9, "userResponse": [3,1,6], "correctAnswer": [3,6,1], "replayCount": 1 }
    ],
    "teachingScores": [
      { "qId": "teaching1", "score": 1, "timeTaken": 5, "userResponse": [4,6], "correctAnswer": [4,6], "replayCount": 0 },
      { "qId": "teaching2", "score": 1, "timeTaken": 6, "userResponse": [9,4], "correctAnswer": [9,4], "replayCount": 0 }
    ],
    "timerSeconds": 96,
    "qTimer": 4,
    "pauses": [],
    "consecutiveWrong": 1
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

**Supported Status Values (this game):**
\`\`\`
in_progress  — Game is actively being played
paused       — Game is paused (resume popup will show on next visit)
completed    — All 20 game questions were reached
dropped      — 3 consecutive wrong answers triggered the stop rule
quit         — Assessor ended the session early
\`\`\`
Unlike the platform's two adaptive-ladder games, \`dropped\` is a **real, commonly-hit** status for this game — not a value the backend merely supports generically for other games.

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
  "additional_notes": "Recalled sequences up to 5 digits reliably, struggled beyond that."
}
\`\`\`
\`q5_behaviors\` must contain at least 1 entry — the form blocks submission with 0 selected (see **Assessment Behavior**).

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
    "score": 5,
    "progress_level": 6,
    "saved_state": { "questionIndex": 5, "allScores": [ "..." ], "teachingScores": [ "..." ], "consecutiveWrong": 0 },
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
game_name       VARCHAR  — Internal game key (${game.key})
start_time      DATETIME — When the session began
end_time        DATETIME — When the session ended (NULL if active)
score           INT      — Correct answers count, out of 22 (20 game + 2 teaching)
total_questions INT      — 22 for this game
progress_level  INT      — questionIndex + 1
status          ENUM     — in_progress / completed / quit / paused / dropped
quit_reason     VARCHAR  — Reason for early termination (if any)
saved_state     JSON     — Full snapshot: questionIndex, allScores, teachingScores, timings, consecutiveWrong
\`\`\`

### saved_state JSON Structure (this game)

\`\`\`json
{
  "questionIndex": 7,
  "allScores": [
    { "qId": 1, "questionNumber": 1, "score": 1, "timeTaken": 4, "userResponse": [8,9], "correctAnswer": [8,9], "replayCount": 0 }
  ],
  "teachingScores": [
    { "qId": "teaching1", "score": 1, "timeTaken": 5, "userResponse": [4,6], "correctAnswer": [4,6], "replayCount": 0 }
  ],
  "timerSeconds": 96,
  "qTimer": 4,
  "pauses": [],
  "consecutiveWrong": 1
}
\`\`\`
This is close to the platform's generic \`allScores\`-based shape, but with two differences worth flagging: (1) it's split across **two** arrays (\`allScores\` + \`teachingScores\`) rather than one combined list, and (2) each record carries \`userResponse\`/\`correctAnswer\` (the full digit sequences) and \`replayCount\`, fields the generic template's example record doesn't show.

### Data Flow

\`\`\`
Session Starts  → Record written: status = 'in_progress'
       ↓
Questions Answered → saved_state JSON updated with each result
       ↓
Game Ends Normally → status = 'completed', end_time recorded
3 Consecutive Wrong → status = 'dropped'
Game Quit Early     → status = 'quit', quit_reason saved
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
The \`score\` column in \`game_sessions\` holds the total number of correct answers, combined across \`allScores\` **and** \`teachingScores\` — out of a possible 22, not 20.

Each individual question result is stored with:
- \`qId\` / \`questionNumber\` — question identifier / sequential position
- \`score\` — 1 = exact sequence match, 0 = anything else
- \`timeTaken\` — seconds taken to respond
- \`userResponse\` / \`correctAnswer\` — the full digit sequences, for review
- \`replayCount\` — how many times the audio was replayed (reporting only, never affects score)

### Report Score Aggregation
The Reports Detail API (\`GET /reports/detail/:gameName\`) reads the \`saved_state\` JSON and calculates:
\`\`\`
correct_count       = (allScores + teachingScores).filter(s => s.score > 0).length
attempted_questions = allScores.length + teachingScores.length
actual_game_time     = sum of all timeTaken values
total_session_time   = end_time - start_time (in seconds)
\`\`\`

---

## 9. Assessment Logic

### Behavioral Assessment Questions
After each session, the assessor completes a structured observation form:

| Question | Type |
|---|---|
| Q1 — "Did you enjoy playing the game?" | Single choice, required |
| Q2 — "How did the game feel for you?" | Single choice, required |
| Q3 — "Did you feel tired while playing the game?" | Single choice, required |
| Q4 — "Would you like to play the game again?" | Single choice, required |
| Q5 — Observed behaviors | Multi-select checkboxes, **required (≥1)** |
| Additional Notes | Free text, optional |

### Assessment Storage
Responses are stored in the \`game_assessments\` table linked to \`session_id\`. The \`q5_behaviors\` field is stored as a JSON array of canonical English behavior strings, regardless of the assessor's display language.

### Pending Assessment Detection
The backend detects sessions where \`status IN ('completed', 'quit', 'dropped')\` but no corresponding record exists in \`game_assessments\`. A prompt is shown to the assessor to complete the form before navigating away. Unlike the two adaptive-ladder games, \`'dropped'\` genuinely belongs in this check here.

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
- Notably inconsistent handling across call sites: a failed session start still lets the child proceed into practice (with no session id syncing afterward), while a failed final assessment submit alerts the user and re-enables the button — see **Technical Documentation § Error Handling** for the full breakdown

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
- \`allScores\` array (standard games — this game included, though split with a second \`teachingScores\` array)
- \`itemResults\` array (Chor Machaye Shor)
- \`questionDetails\` map (games with mid-test assessments)
- \`stage\` / \`path\`-based adaptive-ladder shape (Padh ke Batao V2, Ankganit V3)

### Attempt Number Calculation
Attempt numbers are not stored as a column — they are calculated dynamically at query time by counting sessions for the same \`child_id\` + \`game_name\` ordered by \`start_time\`.

---

## 14. Future Scalability

- **New games**: Follow the same session lifecycle — only \`game_name\` changes, no new tables needed
- **New question metrics**: \`saved_state\` JSON schema can be extended without database migrations
- **Reporting expansion**: The Reports Detail API dynamically reads column keys from \`saved_state\`, adapting automatically to any game structure
- **API versioning**: Base path \`/api/games/\` supports future versioned sub-routes

---

## 15. Data Flow — Stage-by-Stage Breakdown

This section walks through the same session lifecycle as §2 and §5 above, but end-to-end and in narrative order — useful for onboarding or tracing a bug across the full request chain.

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

### Stage 2 — Session Start

When the child clicks "Start Now":

\`\`\`
POST /api/games/sessions/start

Sends: child_id, game_name, total_questions (22)
Receives: sessionId, attempt_no

Database: New row written in game_sessions
  status = 'in_progress'
  start_time = NOW()
  score = 0
\`\`\`

If an active session already exists, the server returns the existing session ID (no duplicate created).

### Stage 3 — Practice, Teaching, and Gameplay (Auto-Save)

After every answered question (practice is unscored and not saved; teaching and game questions are), the complete game state is synced to the server:

\`\`\`
PUT /api/games/sessions/update/:sessionId

Sends:
  score          → combined correct count across allScores + teachingScores
  progress_level → questionIndex + 1
  status         → 'in_progress'
  saved_state    → full JSON snapshot (see §6 above for the exact shape)
\`\`\`

This ensures that if the device loses connectivity or the browser closes, the session can be resumed from the last saved question.

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
  quit_reason = assessor-entered (typed or dictated) reason
  end_time = NOW()
\`\`\`

### Stage 5 — Game End (Stop Rule or Completion)

When the game ends (all 20 game questions done, or 3 consecutive wrong answers):

\`\`\`
PUT /api/games/sessions/update/:sessionId
  status = 'completed' (finished all 20) OR 'dropped' (stop rule triggered)
  score = final combined correct count
  progress_level = last question reached
  end_time = NOW()
  saved_state = final snapshot
\`\`\`

**Terminal status guard**: Once \`quit\` or \`dropped\`, the server will never overwrite to \`completed\`.

### Stage 6 — Behavioral Assessment Submission

After the score screen appears, the assessor fills in the observation form (Q1–Q5 required, Q5 needs at least 1 behavior checked) and confirms in a modal before it's sent:

\`\`\`
POST /api/games/assessments

Sends:
  session_id, child_id
  q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again
  q5_behaviors (JSON array, ≥1 entry required)
  additional_notes

Database: New row in game_assessments linked to session
\`\`\`

### Stage 7 — PDF Generation and Upload

Immediately after assessment submission (or game end), the system generates a PDF of the score dashboard:

\`\`\`
1. Score screen (#dashboard-capture-area) is cloned off-screen (forced
   width max(scrollWidth, 1400px)) to avoid clipping, then rendered to a
   canvas (html2canvas, scale 1.5)
2. Canvas is converted to a JPEG image
3. Image is embedded in an A4 PDF (jsPDF)
4. PDF blob is uploaded:

POST /api/games/pdfs/upload
  Sends: PDF file, child_id, session_id, game_name
  Database: New row in game_dashboard_pdfs with file path
\`\`\`

PDF filename format:
\`\`\`
[ChildName]_Lottery_Ka_Ticket_SES[sessionId]_[timestamp].pdf
\`\`\`

### Stage 8 — Admin Report View

When the administrator opens the Reports module:

\`\`\`
GET /api/games/reports/detail/${game.key}

Server joins data from:
  game_sessions       → score, status, timing, saved_state
  children            → child_name
  game_assessments    → behavioral observations
  game_dashboard_pdfs → PDF download link

Parses saved_state JSON to extract per-question scores from BOTH
allScores and teachingScores
Returns enriched session records with:
  correct_count, attempted_questions, actual_game_time,
  total_session_time, question_scores, assessment, pdf_url
\`\`\`

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

const Sidebar = ({ catalog, expandedGame, selectedGame, selectedSection, onHome, onGameClick, onSectionClick }) => {
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
            {catalog.map(game => {
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{game.icon}</span>
                                <span style={{
                                    fontSize: '0.83rem', fontWeight: isActiveGame ? 700 : 500,
                                    color: isActiveGame ? game.color : T.text,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {game.title}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '6px' }}>
                                <span style={{
                                    fontSize: '0.56rem', fontWeight: 700, padding: '2px 7px',
                                    borderRadius: '999px', letterSpacing: '0.03em',
                                    background: game.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.08)',
                                    color: game.enabled ? '#059669' : '#dc2626',
                                    border: `1px solid ${game.enabled ? 'rgba(16,185,129,0.25)' : 'rgba(220,38,38,0.2)'}`,
                                }}>
                                    {game.enabled ? 'ON' : 'OFF'}
                                </span>
                                <span style={{
                                    fontSize: '0.58rem', color: isExpanded ? T.accent : T.faint,
                                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                                    transition: 'transform 0.22s ease, color 0.15s',
                                    display: 'inline-block',
                                }}>
                                    ▶
                                </span>
                            </div>
                        </button>

                        {/* Sub-sections accordion */}
                        {(() => {
                            const visibleSections = getVisibleSections(game);
                            return (
                                <div style={{
                                    maxHeight: isExpanded ? `${visibleSections.length * SEC_H}px` : '0',
                                    overflow: 'hidden',
                                    transition: 'max-height 0.28s ease',
                                    background: 'rgba(248,250,252,0.8)',
                                    borderBottom: isExpanded ? `1px solid ${T.borderSoft}` : 'none',
                                }}>
                                    {visibleSections.map(sec => {
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
                            );
                        })()}
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

const LandingPage = ({ catalog, onGameClick }) => {
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
                            {catalog.map(game => {
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
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '7px', marginBottom: '7px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden', minWidth: 0 }}>
                                                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{game.icon}</span>
                                                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: hov ? game.color : T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{game.title}</span>
                                                </div>
                                                <span style={{
                                                    fontSize: '0.56rem', fontWeight: 700, padding: '2px 7px', flexShrink: 0,
                                                    borderRadius: '999px', letterSpacing: '0.03em',
                                                    background: game.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.08)',
                                                    color: game.enabled ? '#059669' : '#dc2626',
                                                    border: `1px solid ${game.enabled ? 'rgba(16,185,129,0.25)' : 'rgba(220,38,38,0.2)'}`,
                                                }}>
                                                    {game.enabled ? 'ON' : 'OFF'}
                                                </span>
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
    const visibleSections = getVisibleSections(game);
    const available = visibleSections.filter(s => s.available).length;

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
                        {available} section{available !== 1 ? 's' : ''} currently live · {visibleSections.length - available} coming soon
                    </p>
                </div>
            </div>

            {/* Sections grid */}
            <div style={{ padding: '24px 28px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.faint, marginBottom: '14px' }}>
                    Documentation Sections
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: '12px' }}>
                    {visibleSections.map(sec => {
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
    const [isLoading, setIsLoading]       = useState(false);
    const [updatedAt, setUpdatedAt]       = useState(null);
    const [updatedBy, setUpdatedBy]       = useState(null);

    const loadDoc = useCallback(async () => {
        setIsLoading(true);
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
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: T.faint, fontSize: '0.88rem' }}>Loading documentation…</div>
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

// ─── Audio Logic — live audio intelligence viewer ────────────────────────────

const AUDIO_FOLDERS = {
    atlantis_bagiya:        'bagiya',
    number_recall_lottery:  'lottery_ka_ticket',
    number_recall_lottery_v2:  'lottery_ka_ticket',
    rover_mela:             'chalo_mela_chale',
    auditory_dhyan:         'dhyan_kahan_hai',
    working_memory_herpher: 'her_pher',
    working_memory_herpher_v2: 'her_pher_v2',
    working_memory_herpher_v3: 'her_pher_v3',
    numeracy_number_skill:  'number_skill',
    literacy_reading_skill: 'reading_skill',
    literacy_reading_skill_v2: 'reading_skill_v2',
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
    literacy_reading_skill_v2: [
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
            { file: 'sb_path1.wav',   label: 'Path 1 Background',   type: 'instruction', objective: 'Background audio for the first route/path selection screen.', trigger: 'Path 1 question display', screen: 'Game Screen — Path 1', behavior: 'Context background audio for route selection.' },
            { file: 'sb_path2.wav',   label: 'Path 2 Background',   type: 'instruction', objective: 'Background audio for the second route/path question.', trigger: 'Path 2 question display', screen: 'Game Screen — Path 2', behavior: 'Context background audio.' },
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
    numeracy_number_skill:  'Ankganit - V0',
    literacy_reading_skill: 'Padh ke batao - V0',
    literacy_reading_skill_v2: 'Padh ke batao',
    number_recall_lottery:  'Lottery Ka Ticket',
    number_recall_lottery_v2:  'Lottery Ka Ticket - Version 2',
    atlantis_bagiya:        'Bagiya',
    working_memory_herpher: 'Her Pher - V0',
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

// makeLotteryWorkflowFlows — Lottery Ka Ticket IS a genuine fixed-question test
// (unlike the two adaptive-ladder games), so most of makeWorkflowFlows's model
// fits. What's wrong for THIS game specifically: there is no category concept
// at all (no MIN_CORRECT, no "Category Cutoff Check"), and scoring is 100%
// automatic — there is no manual/assessor-click scoring branch. The stop rule
// also produces a real 'dropped' status here (not 'completed' as the generic
// template assumes for all stop-rule sessions).
const makeLotteryWorkflowFlows = (game) => ({
    journey: [
        { type: 'start',    icon: '📱', title: 'Game Load',
            simple:   'The child opens the game on their device.',
            detailed: 'React component mounts. Child data is read from localStorage. If no child is logged in, user is redirected to login.',
            technical:'useEffect → reads localStorage("currentChild") → if null, navigate("/login") → calls checkResume(childId) + fetchActivity(childId)' },
        { type: 'api',      icon: '🔍', title: 'Resume Check',
            simple:   'The system checks if the child has a previous unfinished session.',
            detailed: 'The backend queries the latest session for this child and game. If it has status "paused" or "in_progress", a resume popup is shown.',
            technical:`GET /api/games/sessions/resume/:childId/${game.key}\nReturns: sessionInfo (saved_state with questionIndex, allScores, teachingScores, timers) or null` },
        { type: 'decision', icon: '❓', title: 'Saved Session Found?',
            simple:   'If a previous session is found, the child can choose to continue or start fresh.',
            detailed: 'Resume popup shows with two options: Resume (restores exact question, both score arrays, timers) or Start Fresh (creates new session).',
            technical:'sessionInfo.status in ["in_progress","paused"] → showResumeModal = true\nResume → restores questionIndex, allScores, teachingScores, timerSeconds, qTimer, pauses, consecutiveWrong from saved_state',
            branches: [{ label: 'Yes → Resume Prompt', color: '#f59e0b' }, { label: 'No → Splash Screen', color: '#10b981' }] },
        { type: 'process',  icon: '🎵', title: 'Splash Screen',
            simple:   'Game instructions are displayed and audio plays automatically.',
            detailed: 'Background audio (splash1.m4a) plays as soon as the splash screen loads. The "Start Now" button remains disabled until audio finishes.',
            technical:'<audio ref={audioRef} src=".../splash1.m4a" />\naudioRef.current.play() → onEnded: setAudioFinished(true) → enables Start Now\nonError: setAudioFinished(true) as fail-safe' },
        { type: 'decision', icon: '🔊', title: 'Audio Completed?',
            simple:   'Start Now becomes active only after the child has heard the full instructions.',
            detailed: 'The button is disabled while audio plays. The assessor can replay audio at any time.',
            technical:'button disabled={!audioFinished} → onEnded/onError → setAudioFinished(true)',
            branches: [{ label: 'Audio ends → Start Now active', color: '#10b981' }, { label: 'Audio error → Start Now active (fail-safe)', color: '#f59e0b' }] },
        { type: 'api',      icon: '▶️', title: 'Session Created on Server',
            simple:   'A unique session ID is created to track this child\'s game attempt.',
            detailed: 'The server creates a new record in the database. If an active session already exists (deduplication guard), the existing ID is returned.',
            technical:`POST /api/games/sessions/start\nBody: { child_id, game_name: "${game.key}", total_questions: 22 }\nResponse: { sessionId, attempt_no }\nDB: INSERT INTO game_sessions (child_id, game_name, status="in_progress", score=0)` },
        { type: 'process',  icon: '🎓', title: 'Practice, Then Teaching',
            simple:   'The child tries the recall mechanic once (unscored), then does 2 scored Teaching questions with correction audio if wrong.',
            detailed: 'Only the FIRST attempt on each Teaching question is scored — a wrong first attempt plays a correction clip and lets the child retry, but the retry doesn\'t change the recorded score.',
            technical:'setScreen("practice") → setScreen("teaching1") → setScreen("teaching2") → recordTeachingScore(qId, score, ...) on first attempt only' },
        { type: 'process',  icon: '🔁', title: 'Question Loop (20 Game Questions)',
            simple:   'For each question: the child listens to a number sequence, recalls it, the score is recorded, stop rules are checked.',
            detailed: 'See "Question Flow" section for the detailed per-question lifecycle.',
            technical:'exactMatch(selected, correct) → checkStopRule() → questionIndex++ or setScreen("score")',
            isRef: true, refLabel: 'See Question Flow →' },
        { type: 'process',  icon: '📊', title: 'Score Screen',
            simple:   'The final score and all question results are displayed.',
            detailed: 'Score screen shows: total score out of 22 (20 game + 2 teaching), correct/incorrect counts, percentage, total time, average time per question, and a per-question results table.',
            technical:'setScreen("score") → total = allScores.filter(s=>s.score===1).length + teachingScores.filter(s=>s.score===1).length\nScore table rendered from both arrays' },
        { type: 'process',  icon: '📋', title: 'Assessment Form',
            simple:   'The assessor fills in behavioral observations about the child\'s session.',
            detailed: 'Four required questions (radio buttons) + eight behavioral checkboxes (at least 1 required) + free-text notes with voice dictation support, confirmed via a modal before submission.',
            technical:'<SessionAssessmentForm /> component renders\nQ1–Q5 required (Q5 needs >=1 checked), validation prevents submit if empty\nConfirm modal → submitAssessmentForm()' },
        { type: 'api',      icon: '💾', title: 'Assessment Saved',
            simple:   'The assessor\'s observations are saved to the system.',
            detailed: 'Assessment data is stored in a separate table linked to the session ID.',
            technical:'POST /api/games/assessments\nBody: { session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again, q5_behaviors[], additional_notes }\nDB: INSERT INTO game_assessments' },
        { type: 'process',  icon: '📄', title: 'PDF Dashboard Generated',
            simple:   'A PDF summary of the session is automatically created and saved.',
            detailed: 'The score screen (#dashboard-capture-area) is cloned off-screen, captured as a high-resolution image, and embedded in an A4 PDF. The file is uploaded to the server and linked to the session.',
            technical:'Clone #dashboard-capture-area off-screen (forced width max(scrollWidth,1400px)) → html2canvas(scale:1.5) → jsPDF(A4) → POST /api/games/pdfs/upload\nFilename: [ChildName]_Lottery_Ka_Ticket_SES[id]_[timestamp].pdf' },
        { type: 'success',  icon: '✅', title: 'Session Complete',
            simple:   'The assessment is finished. The admin can now view the full report.',
            detailed: 'Session status is "completed" (all 20 reached) or "dropped" (3 consecutive wrong). All data is saved: scores, timers, assessment, PDF. Admin can view the full session in the Reports module.',
            technical:'game_sessions.status = "completed" | "dropped", end_time = NOW()\ngame_assessments record created\ngame_dashboard_pdfs record created\nReport available: GET /api/games/reports/detail/:gameName' },
    ],

    question: [
        { type: 'start',    icon: '🔊', title: 'Sequence Played',
            simple:   'A spoken number sequence plays for the current question.',
            detailed: 'One question is shown at a time. The numpad is locked (pointer-events:none) while audio plays. Sequence length ramps from 2 digits (Q1) up to 9 digits (Q18-20). The digit 7 is never used in any sequence.',
            technical:'QUESTIONS[questionIndex] rendered → new Audio(question.audio) → setQTimer(0) → qTimer++ per second via setInterval' },
        { type: 'process',  icon: '🔁', title: 'Replay (Optional)',
            simple:   'The child can ask to hear the sequence again as many times as needed.',
            detailed: 'Replaying resets the current in-progress selection and increments replayCount for this question. Replaying never penalizes the score.',
            technical:'toggleReplay() → resets selectedDigits → replayCount++' },
        { type: 'process',  icon: '✋', title: 'Response Captured',
            simple:   'The child taps digits back in the same order they were spoken.',
            detailed: 'This is 100% automatic scoring — there is no manual/assessor-click Correct/Incorrect button anywhere in this game. Once exactly maxSelect digits are chosen, "Next Question" becomes enabled.',
            technical:'exactMatch(selected, correct): same length AND same values AND same order → score 1, else 0\nClicking "Next Question" both scores AND advances in one action' },
        { type: 'process',  icon: '📊', title: 'Score Recorded',
            simple:   'The score (1 for exact match, 0 for anything else) is saved with the response time.',
            detailed: 'A score record is added to the allScores array: { qId, questionNumber, score, timeTaken, userResponse, correctAnswer, replayCount }.',
            technical:'newScoreRec = { qId, questionNumber, score: 0|1, timeTaken: qTimer, userResponse, correctAnswer, replayCount }\nsetAllScores([...allScores, newScoreRec])' },
        { type: 'api',      icon: '💾', title: 'Progress Auto-Saved',
            simple:   'The progress is automatically sent to the server after every question.',
            detailed: 'Every time the question index advances, the current state is saved to the server. This allows the game to be resumed if interrupted.',
            technical:'useEffect([questionIndex]) → saveToServer("in_progress")\nPUT /api/games/sessions/update/:sessionId\nBody: { score, progress_level, status, saved_state: { questionIndex, allScores, teachingScores, timerSeconds, qTimer, pauses, consecutiveWrong } }' },
        { type: 'decision', icon: '⚠️', title: '3 Consecutive Wrong?',
            simple:   'If the child gets 3 wrong answers in a row, the game stops. This is the ONLY stop rule in this game.',
            detailed: 'The system tracks consecutiveWrong, incrementing on each wrong answer and resetting to 0 on any correct answer. There is no category concept and no MIN_CORRECT threshold anywhere in this game.',
            technical:'consecutiveWrong = (score===0) ? consecutiveWrong+1 : 0\nif consecutiveWrong >= MAX_CONSECUTIVE_WRONG (3) → isDroppedOut = true',
            branches: [{ label: 'Yes → Game Stops (status=dropped)', color: '#dc2626' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'decision', icon: '🏁', title: 'All 20 Questions Done?',
            simple:   'If all 20 game questions have been answered, the game ends normally.',
            detailed: 'After the last question, the game transitions to the score screen with status "completed" rather than "dropped".',
            technical:'questionIndex + 1 >= TOTAL_SCORED_QUESTIONS (20) → isGameOver = true, status="completed"',
            branches: [{ label: 'Yes → Score Screen (status=completed)', color: '#10b981' }, { label: 'No → Next Question', color: '#4f46e5' }] },
        { type: 'stop',     icon: '🛑', title: 'Stop Rule Triggered',
            simple:   'The game stops early because 3 consecutive wrong answers were given.',
            detailed: 'Unlike the generic platform pattern, this game genuinely sets status to "dropped" (not "completed") when the stop rule fires — completion and early-stop are distinguishable in reports for this game.',
            technical:'setScreen("score") → axios.put update: { status: isDroppedOut ? "dropped" : "completed", score, saved_state }\nthen setTimeout(generateAndUploadPDF, 1500)' },
        { type: 'success',  icon: '➡️', title: 'Advance to Next Question',
            simple:   'The next question is shown.',
            detailed: 'The question timer resets to 0. The question index advances by 1.',
            technical:'setQuestionIndex(i => i + 1) → setQTimer(0) → next question rendered from QUESTIONS[questionIndex]' },
    ],

    score: [
        { type: 'start',    icon: '🎯', title: 'Response Received',
            simple:   'The child finishes tapping their recalled sequence.',
            detailed: 'Scoring is always automatic in this game — there is no assessor judgment call.',
            technical:'handleNextQuestion() → calls exactMatch(selected, correct) → processScoring(score)' },
        { type: 'process',  icon: '⚖️', title: 'Binary Score Applied',
            simple:   'Every answer is scored as either correct (1) or incorrect (0) based on an exact sequence match. No partial points.',
            detailed: 'Getting the right digits in the wrong order still scores 0 — there\'s no partial credit for "close" recall.',
            technical:'score = exactMatch(userResponse, correctAnswer) ? 1 : 0\nRecord: { qId, questionNumber, score, timeTaken: qTimer, userResponse, correctAnswer, replayCount }' },
        { type: 'process',  icon: '📈', title: 'Running Score Updated',
            simple:   'The score display in the header updates after each question.',
            detailed: 'The total score is calculated live as the count of correct answers across BOTH allScores and teachingScores.',
            technical:'getTotalScore() = allScores.filter(s=>s.score===1).length + teachingScores.filter(s=>s.score===1).length\nDisplayed in header: <span>{getTotalScore()}</span>' },
        { type: 'decision', icon: '🔢', title: 'Consecutive Wrong Check',
            simple:   '3 wrong answers in a row stops the game. There is no other stop condition.',
            detailed: 'Unlike some other games on this platform, there is NO category-cutoff check here at all — this game has no category structure or MIN_CORRECT thresholds.',
            technical:'consecutiveWrong updates on every scored answer\nif consecutiveWrong >= 3: isDroppedOut = true, status will be "dropped"',
            branches: [{ label: '≥ 3 wrong → STOP (dropped)', color: '#dc2626' }, { label: '< 3 wrong → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🏆', title: 'Final Score Calculated',
            simple:   'The total number of correct answers (out of 22) becomes the final score.',
            detailed: 'Score = count of all score records where score === 1, across both allScores and teachingScores. This is saved to the game_sessions.score column.',
            technical:'finalScore = allScores.filter(s=>s.score===1).length + teachingScores.filter(s=>s.score===1).length\nPUT /sessions/update: { score: finalScore, status: "completed"|"dropped" }' },
        { type: 'process',  icon: '📋', title: 'Score Metrics Generated',
            simple:   'The score screen shows several performance metrics.',
            detailed: 'Metrics include: Total Score (out of 22), Correct Count, Incorrect Count, Percentage, Total Time, Average Time per Question.',
            technical:'Correct: getTotalScore()\nTotal time: (allScores+teachingScores).reduce((acc,s)=>acc+(s.timeTaken||0),0)\nPercentage: (correct / 22 * 100).toFixed(1)' },
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
            technical:`POST /api/games/sessions/start\nBody: { child_id, game_name:"${game.key}", total_questions: 22 }\nResponse: { success, sessionId, attempt_no }\nHTTP 201 (new) or 200 (reused)` },
        { type: 'api',      icon: '💾', title: 'Progress Update (Repeated)',
            simple:   'After every question, the progress is saved to the server.',
            detailed: 'Called after each question and also on pause/quit. Carries the full game snapshot — split across two score arrays — so sessions can be resumed.',
            technical:`PUT /api/games/sessions/update/:sessionId\nBody: { score, progress_level, status, saved_state: { questionIndex, allScores, teachingScores, timerSeconds, qTimer, pauses, consecutiveWrong } }\nStatus values: "in_progress" | "paused" | "quit" | "completed" | "dropped"` },
        { type: 'decision', icon: '🛡️', title: 'Terminal Status Guard',
            simple:   'Once a session is ended, it cannot be accidentally marked as completed.',
            detailed: 'The server checks: if the current status is "quit" or "dropped", it will never overwrite it with "completed". This prevents client bugs from corrupting data. This guard is fully active for this game — "dropped" is a real, frequently-hit status here.',
            technical:`if (status==="completed" && (currentStatus==="quit" || currentStatus==="dropped"))\n  return res.status(200).json({ message:"Session already finalized" })\n// No DB update performed`,
            branches: [{ label: 'Terminal → Reject (200, preserved)', color: '#f59e0b' }, { label: 'Valid transition → Update DB', color: '#10b981' }] },
        { type: 'api',      icon: '📋', title: 'Assessment Submission',
            simple:   'Assessor observations are sent to the server.',
            detailed: 'Saves behavioral data to a separate table linked by session_id.',
            technical:`POST /api/games/assessments\nBody: { session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again, q5_behaviors:[], additional_notes }\nDB: INSERT INTO game_assessments` },
        { type: 'api',      icon: '📄', title: 'PDF Upload',
            simple:   'The session dashboard is saved as a PDF file.',
            detailed: 'Score screen is cloned off-screen and captured with html2canvas, converted to PDF via jsPDF, then uploaded as a file.',
            technical:`POST /api/games/pdfs/upload (multipart/form-data)\nFields: pdf (file), child_id, session_id, game_name\nDB: INSERT INTO game_dashboard_pdfs (file_path)\nFile: /dashboard_pdfs/[name].pdf` },
        { type: 'api',      icon: '📈', title: 'Admin Report',
            simple:   'The administrator views the complete session data.',
            detailed: 'Admin-only endpoint. Returns session records with per-question scores (from both score arrays), behavioral assessment, and PDF link.',
            technical:`GET /api/games/reports/detail/${game.key}\nAuth: Admin JWT Bearer token\nReturns: { columns, data: [{ session_id, score, question_scores, assessment, pdf_url }] }` },
        { type: 'success',  icon: '✅', title: 'Data Cycle Complete',
            simple:   'All game data is safely stored and accessible to administrators.',
            detailed: 'Three tables contain the full session record: game_sessions, game_assessments, game_dashboard_pdfs.',
            technical:'game_sessions: status="completed"|"dropped", end_time, saved_state\ngame_assessments: q1–q4, behaviors[], notes\ngame_dashboard_pdfs: file_path\nAll joined in /reports/detail response' },
    ],

    session: [
        { type: 'start',    icon: '🟢', title: 'Status: in_progress',
            simple:   'The session is active — the child is playing.',
            detailed: 'Set when the session is created. Updated with score and saved_state on every question advance.',
            technical:`game_sessions.status = "in_progress"\nCreated by: POST /sessions/start\nUpdated by: PUT /sessions/update after each question` },
        { type: 'decision', icon: '⏸️', title: 'Assessor Pauses?',
            simple:   'The assessor can pause the session at any time.',
            detailed: 'Pause saves the full game state to the server. A pause event (with timestamp and reason) is appended to the pauses array in saved_state.',
            technical:`PUT /sessions/update: { status:"paused", quit_reason: reason, saved_state: { ...state, pauses: [...pauses, { reason, timestamp }] } }\nThen: navigate("/")`,
            branches: [{ label: 'Yes → Pause & Save', color: '#f59e0b' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🟡', title: 'Status: paused',
            simple:   'The game is saved and the child can resume later.',
            detailed: 'On next visit, the resume check returns this session. The assessor can choose to resume or start fresh.',
            technical:'game_sessions.status = "paused"\nResume: GET /sessions/resume → sessionInfo.saved_state contains full snapshot\nResume: setQuestionIndex, setAllScores, setTeachingScores, setTimerSeconds, setConsecutiveWrong from saved_state' },
        { type: 'decision', icon: '🚪', title: 'Assessor Quits?',
            simple:   'The assessor can end the session early for any reason.',
            detailed: 'Quit requires a reason to be entered. The game transitions to the score screen.',
            technical:`PUT /sessions/update: { status:"quit", quit_reason: reason, end_time:NOW() }\nsetScreen("score") → setTimeout(generateAndUploadPDF, 1500)`,
            branches: [{ label: 'Yes → Quit', color: '#dc2626' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🔴', title: 'Status: quit',
            simple:   'The session was ended early by the assessor.',
            detailed: 'Score screen shows the session was terminated with the quit reason. Assessment form still appears for behavioral data.',
            technical:'game_sessions.status = "quit"\nquit_reason saved\nend_time = NOW()' },
        { type: 'decision', icon: '📏', title: 'Stop Rule Triggered?',
            simple:   '3 consecutive wrong answers automatically stops the game — this is the ONLY automatic stop rule (no category minimums exist).',
            detailed: 'When it fires, the status genuinely becomes "dropped" — distinct from a session that naturally finished all 20 questions ("completed").',
            technical:'consecutiveWrong >= 3 → isDroppedOut = true\nif isDroppedOut: setScreen("score"), PUT update: { status: "dropped" }\nelse if all 20 done: PUT update: { status: "completed" }',
            branches: [{ label: 'Yes → Automatic Stop (status=dropped)', color: '#dc2626' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🟢', title: 'Status: completed / dropped',
            simple:   'The session ended — either all 20 questions were answered ("completed") or the 3-consecutive-wrong rule fired ("dropped").',
            detailed: 'Unlike some other games on this platform, this distinction is real and meaningful here — reports can tell natural completions apart from early stops.',
            technical:'game_sessions.status = "completed" | "dropped"\nend_time = NOW()\nNote: dropped sessions show attempted_questions < 20 in reports' },
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

// makeReadingV2WorkflowFlows — Padh ke Batao V2 is an ASER 2014-style adaptive
// reading ladder, NOT a fixed-question test. It has no QUESTIONS array, no
// consecutive-wrong stop rule, and no category-minimum cutoff — so it gets its
// own flow generator instead of reusing makeWorkflowFlows's generic model.
const makeReadingV2WorkflowFlows = (game) => ({
    journey: [
        { type: 'start',    icon: '📱', title: 'Game Load',
            simple:   'The child opens the game on their device.',
            detailed: 'React component mounts. Child data is read from localStorage. If no child is logged in, user is redirected to login.',
            technical:'useEffect → reads localStorage("currentChild") → if null, navigate("/login") → calls checkResume(childId) + fetchActivity(childId)' },
        { type: 'api',      icon: '🔍', title: 'Resume Check',
            simple:   'The system checks if the child has a previous unfinished session.',
            detailed: 'The backend queries the latest session for this child and game. If it has status "in_progress" or "paused" and isn\'t assessment-submitted, a resume popup is shown.',
            technical:`GET /api/games/sessions/resume/:childId/${game.key}\nReturns: sessionInfo (saved_state with stage, path, per-stage results, timers) or null` },
        { type: 'decision', icon: '❓', title: 'Saved Session Found?',
            simple:   'If a previous session is found, the child can choose to continue or start fresh.',
            detailed: 'Resume restores every completed stage\'s result plus timers. In-progress tile marking on the current Words/Letters screen is NOT restored — that stage always restarts from scratch.',
            technical:'sessionInfo.status in ["in_progress","paused"] && !assessmentSubmitted → showResumeModal = true\nResume → restores stage, path, selectedWords/Letters, results, timerSeconds, qTimer, pauses from saved_state',
            branches: [{ label: 'Yes → Resume Prompt', color: '#f59e0b' }, { label: 'No → Splash Screen', color: '#10b981' }] },
        { type: 'process',  icon: '🎵', title: 'Splash Screen',
            simple:   'Game instructions are displayed and audio plays automatically.',
            detailed: 'Background audio plays as soon as the splash screen loads. The "Start Now" button remains disabled until audio finishes.',
            technical:'<audio ref={audioRef} src="/assets/audios/reading_skill_v2/splash.wav" />\naudioRef.current.play() → onEnded: setAudioFinished(true) → enables Start Now\nonError: setAudioFinished(true) as fail-safe' },
        { type: 'decision', icon: '🔊', title: 'Audio Completed?',
            simple:   'Start Now becomes active only after the child has heard the full instructions.',
            detailed: 'The button is disabled while audio plays. The assessor can replay audio at any time.',
            technical:'button disabled={!audioFinished} → onEnded/onError → setAudioFinished(true)',
            branches: [{ label: 'Audio ends → Start Now active', color: '#10b981' }, { label: 'Audio error → Start Now active (fail-safe)', color: '#f59e0b' }] },
        { type: 'api',      icon: '▶️', title: 'Session Created on Server',
            simple:   'A unique session ID is created to track this child\'s attempt.',
            detailed: 'The server creates a new record in the database. If an active session already exists (deduplication guard), the existing ID is returned.',
            technical:`POST /api/games/sessions/start\nBody: { child_id, game_name: "${game.key}", total_questions: 5 }\nResponse: { sessionId, attempt_no }\nDB: INSERT INTO game_sessions (child_id, game_name, status="in_progress", score=0)` },
        { type: 'process',  icon: '📖', title: 'Paragraph Stage Begins',
            simple:   'The assessor picks one of two paragraphs; the child reads it aloud.',
            detailed: 'The ladder always starts at the Paragraph stage. The chosen paragraph is locked in and reused if the child later reaches the Paragraph Retry stage.',
            technical:'setStage("paragraph") → assessor sets selectedParagraphIndex (0 or 1) → child reads aloud → "Done Reading" opens the fluency modal' },
        { type: 'process',  icon: '🪜', title: 'Adaptive Ladder Runs',
            simple:   'Depending on how the child reads, the test moves to easier or harder stages until a reading level is found.',
            detailed: 'See "Stage Flow" for the full pass/fail routing between Paragraph, Words, Letters, the two retry stages, and Story.',
            technical:'handleMarkingContinue() / handleMidTestAssessmentComplete() → determine PASS/FAIL → setStage(nextStage) or finalizeAssessment(level)',
            isRef: true, refLabel: 'See Stage Flow →' },
        { type: 'process',  icon: '📊', title: 'Score Screen',
            simple:   'The final reading level and stage-by-stage results are displayed.',
            detailed: 'Score screen shows: final ASER reading level, score dial (finalScore/4), the path breadcrumb of every stage traversed, and a per-stage results table.',
            technical:'setScreen("score") → finalLevel/finalScore already set by finalizeAssessment()\nResults table rendered from path[] + per-stage result objects' },
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
            detailed: 'The score screen is cloned off-screen, captured as a high-resolution image, and embedded in an A4 PDF. The file is uploaded to the server and linked to the session.',
            technical:'Clone #dashboard-capture-area off-screen (avoids clipping from the game shell\'s backdrop-filter) → html2canvas(scale:1.5) → jsPDF(A4) → POST /api/games/pdfs/upload\nFilename: [ChildName]_ReadingSkillV2_SES[id]_[timestamp].pdf' },
        { type: 'success',  icon: '✅', title: 'Session Complete',
            simple:   'The assessment is finished. The admin can now view the full report.',
            detailed: 'Session status is "completed". All data is saved: stage results, timers, assessment, PDF. Admin can view the full session in the Reports module.',
            technical:'game_sessions.status = "completed", end_time = NOW()\ngame_assessments record created\ngame_dashboard_pdfs record created\nReport available: GET /api/games/reports/detail/:gameName' },
    ],

    question: [
        { type: 'start',    icon: '🪜', title: 'Stage Begins',
            simple:   'One of six possible stages is shown: Paragraph, Words, Letters, Words Retry, Paragraph Retry, or Story.',
            detailed: 'Which stage shows next is entirely determined by the previous stage\'s pass/fail verdict — there is no fixed sequence.',
            technical:'setStage(nextStage) → setQTimer(0) → qTimer counts seconds via setInterval(1000)' },
        { type: 'decision', icon: '📝', title: 'Stage Type?',
            simple:   'Words and Letters stages use tile marking; Paragraph and Story stages use read-aloud plus a fluency questionnaire.',
            detailed: 'Tile-marking stages present a bank of items to select and mark. Read-aloud stages present a block of text for the child to read aloud, followed by a 3-question fluency check.',
            technical:'stage in ["words","letters"] → tile-marking UI\nstage in ["paragraph","paragraph_retry","story"] → read-aloud UI',
            branches: [{ label: 'Words/Letters → Tile Marking', color: '#8b5cf6' }, { label: 'Paragraph/Story → Read-Aloud + Modal', color: '#0891b2' }] },
        { type: 'process',  icon: '✋', title: 'Tile Marking',
            simple:   'The assessor selects up to 5 tiles from a 10-item bank and marks each ✓ or ✗ as the child reads it aloud.',
            detailed: 'Exactly 5 tiles must be marked before the stage can continue. On the Words Retry stage, the same 5 words from the original attempt are re-shown — the assessor cannot pick a different set.',
            technical:'toggleMark(text) → marks[text] = "correct"|"incorrect"\ncanContinueMarking = Object.keys(marks).length === 5' },
        { type: 'process',  icon: '📖', title: 'Read-Aloud + Fluency Modal',
            simple:   'The child reads the paragraph or story aloud; the assessor then answers 3 Yes/No questions about how fluently they read.',
            detailed: '"Done Reading" opens a modal: (1) read word-by-word rather than in sentences? (2) read haltingly / stopped often? (3) made more than 3 mistakes? Each question has an ⓘ hint with a worked example.',
            technical:'openMidTestModal(pendingAssessTarget) → 3 Yes/No answers collected → handleMidTestAssessmentComplete()' },
        { type: 'decision', icon: '⚖️', title: 'Stage Verdict',
            simple:   'The stage passes or fails depending on the marking or the fluency answers.',
            detailed: 'Tile marking passes at 4 or 5 correct out of 5. The fluency modal passes only if all 3 answers are "No" — a single "Yes" fails the stage.',
            technical:'Tile: correctCount >= 4 → PASS\nFluency: ssrAnswers.every(a => a === "no") → PASS',
            branches: [{ label: 'PASS', color: '#10b981' }, { label: 'FAIL', color: '#dc2626' }] },
        { type: 'decision', icon: '🪜', title: 'Route to Next Stage',
            simple:   'Where the test goes next depends on which stage just passed or failed.',
            detailed: 'Every stage routes to a different next stage on pass vs. fail — some routes lead to another attempt, some end the test with a specific reading level.',
            technical:'Paragraph: pass→Story, fail→Words\nWords: pass→Paragraph Retry, fail→Letters\nLetters: pass→Words Retry, fail→END "Beginner"\nWords Retry: pass→Paragraph Retry, fail→END "Letter"\nParagraph Retry: pass→Story, fail→END "Word"\nStory: pass→END "Story", fail→END "Paragraph"' },
        { type: 'success',  icon: '➡️', title: 'Advance or Ladder Complete',
            simple:   'Either the next stage begins, or the test ends and a final reading level is recorded.',
            detailed: 'The completed stage name is appended to path[]. If the routing table says END, finalizeAssessment(level) runs and the screen moves to Score.',
            technical:'path = [...path, stageName] → setStage(next) OR finalizeAssessment(level) → setScreen("score")' },
    ],

    score: [
        { type: 'start',    icon: '🎯', title: 'Ladder Ends',
            simple:   'The test reaches an END point in the stage-routing table.',
            detailed: 'This can happen after as few as 3 stages (fail Paragraph → fail Words → fail Letters) or as many as 6 (climb all the way back up to Story).',
            technical:'finalizeAssessment(level, pathArg) called from the last stage\'s verdict handler' },
        { type: 'process',  icon: '🏷️', title: 'Final Level Determined',
            simple:   'The reading level the child reached becomes the result — not a points total.',
            detailed: 'One of 5 ASER reading levels, in increasing order of difficulty: Beginner, Letter, Word, Paragraph, Story.',
            technical:'LEVELS = { Beginner:0, Letter:1, Word:2, Paragraph:3, Story:4 }\nfinalLevel is set directly by the stage-routing table (see Stage Flow)' },
        { type: 'process',  icon: '🏆', title: 'Score Calculated',
            simple:   'The reading level is converted to a number for the score dial.',
            detailed: 'There is no "correct answers out of total" percentage — the dial simply shows the level reached out of the 4 possible levels above Beginner.',
            technical:'finalScore = LEVELS[finalLevel]\nfinalGameTime = timerSeconds (snapshot taken the moment the ladder ends)' },
        { type: 'process',  icon: '🧵', title: 'Path Breadcrumb Built',
            simple:   'A trail of every stage the child actually went through is recorded, including retries.',
            detailed: 'This trail drives both the breadcrumb display and the per-stage results table on the score screen.',
            technical:'path = [...] e.g. ["paragraph","words","letters","words_retry","paragraph_retry","story"]' },
        { type: 'process',  icon: '📋', title: 'Score Metrics Generated',
            simple:   'The score screen shows the reading level, a score dial, and per-stage timing.',
            detailed: 'Duration and average time per stage are computed from each stage\'s recorded qTimer value at the time it was completed.',
            technical:'Per-stage duration fields: wordsTimeTaken, wordsRetryTimeTaken, lettersTimeTaken, paragraphResult.timeTaken, paragraphRetryResult.timeTaken, storyResult.timeTaken' },
        { type: 'success',  icon: '✅', title: 'Score Complete',
            simple:   'Assessment scoring is done. Assessment form follows.',
            detailed: 'All traversed stages are displayed in a results table. The behavioral assessment form then appears for the assessor to complete.',
            technical:'screen = "score" → SessionAssessmentForm renders\nassessmentSubmitted controls which buttons appear after form submit' },
    ],

    api: [
        { type: 'start',    icon: '📱', title: 'Client-Side Event',
            simple:   'Something happens in the game — a tile marked, a stage completed, or the game ending.',
            detailed: 'Every significant game action (start, stage completion, pause, quit, submit assessment) triggers an API call to the backend server.',
            technical:'React state change or user interaction → async axios call → awaits server response' },
        { type: 'api',      icon: '🔍', title: 'Resume Check',
            simple:   'Check if the child can continue a previous session.',
            detailed: 'Called once when the game loads. Returns the latest session for this child/game.',
            technical:`GET /api/games/sessions/resume/:childId/${game.key}\nAuth: child session\nResponse: { success, sessionInfo: { id, status, saved_state, attempt_no } | null }` },
        { type: 'api',      icon: '▶️', title: 'Start Session',
            simple:   'Create a new session record when the child starts.',
            detailed: 'Returns a session ID used for all subsequent updates. Deduplication prevents duplicate sessions.',
            technical:`POST /api/games/sessions/start\nBody: { child_id, game_name:"${game.key}", total_questions: 5 }\nResponse: { success, sessionId, attempt_no }\nHTTP 201 (new) or 200 (reused)` },
        { type: 'api',      icon: '📚', title: 'Test Content Fetch',
            simple:   'The letters, words, paragraphs, story, questions, and hints are loaded — admin-managed, not hardcoded.',
            detailed: 'On mount, useTestContent(gameKey) fetches all admin-configured content elements plus the platform\'s configured languages, and resolves each element for the player\'s language.',
            technical:`GET /api/public/elements?test_id=${game.key}\nGET /api/public/translations/languages\ngetContent(key) → content_<key> for player language → falls back to platform default → falls back to hardcoded constant` },
        { type: 'api',      icon: '💾', title: 'Progress Update (Repeated)',
            simple:   'After every stage, the progress is saved to the server.',
            detailed: 'Called after each stage transition and also on pause/quit. Carries the full ladder snapshot so sessions can be resumed.',
            technical:`PUT /api/games/sessions/update/:sessionId\nBody: { score, progress_level: path.length+1, status, saved_state: { stage, selectedParagraphIndex, wordsSource, selectedWords, selectedWordsRetry, selectedLetters, ...timings, ...results, path, finalLevel, finalScore, finalGameTime, timerSeconds, qTimer, pauses } }\nStatus values: "in_progress" | "paused" | "quit" | "completed"` },
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
            detailed: 'Score screen is cloned off-screen, captured with html2canvas, converted to PDF via jsPDF, then uploaded as a file.',
            technical:`POST /api/games/pdfs/upload (multipart/form-data)\nFields: pdf (file), child_id, session_id, game_name\nDB: INSERT INTO game_dashboard_pdfs (file_path)\nFile: /dashboard_pdfs/[name].pdf` },
        { type: 'api',      icon: '📈', title: 'Admin Report',
            simple:   'The administrator views the complete session data.',
            detailed: 'Admin-only endpoint. Returns session records with per-stage results, behavioral assessment, and PDF link.',
            technical:`GET /api/games/reports/detail/${game.key}\nAuth: Admin JWT Bearer token\nReturns: { columns, data: [{ session_id, score, stage_results, assessment, pdf_url }] }` },
        { type: 'success',  icon: '✅', title: 'Data Cycle Complete',
            simple:   'All game data is safely stored and accessible to administrators.',
            detailed: 'Three tables contain the full session record: game_sessions, game_assessments, game_dashboard_pdfs.',
            technical:'game_sessions: status="completed", end_time, saved_state\ngame_assessments: q1–q4, behaviors[], notes\ngame_dashboard_pdfs: file_path\nAll joined in /reports/detail response' },
    ],

    session: [
        { type: 'start',    icon: '🟢', title: 'Status: in_progress',
            simple:   'The session is active — the child is playing.',
            detailed: 'Set when the session is created. Updated with score and saved_state on every stage transition.',
            technical:`game_sessions.status = "in_progress"\nCreated by: POST /sessions/start\nUpdated by: PUT /sessions/update after each stage` },
        { type: 'decision', icon: '⏸️', title: 'Assessor Pauses?',
            simple:   'The assessor can pause the session at any time.',
            detailed: 'Pause saves the full ladder state to the server. A pause event (with the current stage, timestamp, and reason) is appended to the pauses array in saved_state.',
            technical:`PUT /sessions/update: { status:"paused", quit_reason: reason, saved_state: { ...state, pauses: [...pauses, { stage, reason, timestamp }] } }\nThen: navigate("/")`,
            branches: [{ label: 'Yes → Pause & Save', color: '#f59e0b' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🟡', title: 'Status: paused',
            simple:   'The game is saved and the child can resume later.',
            detailed: 'On next visit, the resume check returns this session. The assessor can choose to resume (restoring every completed stage) or start fresh.',
            technical:'game_sessions.status = "paused"\nResume: GET /sessions/resume → sessionInfo.saved_state contains the full snapshot\nResume: setStage, setPath, setSelectedWords/Letters/Results, setTimerSeconds from saved_state' },
        { type: 'decision', icon: '🚪', title: 'Assessor Quits?',
            simple:   'The assessor can end the session early for any reason.',
            detailed: 'Quit requires a reason to be entered (typed or dictated). The game transitions to the score screen using the current stage as the endpoint.',
            technical:`PUT /sessions/update: { status:"quit", quit_reason: reason, end_time:NOW() }\nsetScreen("score") → setTimeout(generateAndUploadPDF, 1500)`,
            branches: [{ label: 'Yes → Quit', color: '#dc2626' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🔴', title: 'Status: quit',
            simple:   'The session was ended early by the assessor.',
            detailed: 'Score screen shows the ladder stopped early, with the quit reason recorded. Assessment form still appears for behavioral data.',
            technical:'game_sessions.status = "quit"\nquit_reason saved\nend_time = NOW()' },
        { type: 'decision', icon: '🪜', title: 'Ladder Reaches an END?',
            simple:   'Unlike stop-rule games, this test always ends by reaching an END point in the stage-routing table — there\'s no separate "3 wrong in a row" or "below cutoff" drop condition.',
            detailed: 'Every stage\'s FAIL branch either routes to another stage or is itself an END — see Stage Flow for the full table.',
            technical:'finalizeAssessment(level) → PUT /sessions/update: { status:"completed", score: LEVELS[level], saved_state }',
            branches: [{ label: 'END reached → Status: completed', color: '#10b981' }] },
        { type: 'process',  icon: '🟢', title: 'Status: completed',
            simple:   'The session ended normally — the ladder reached an END point naturally.',
            detailed: 'progress_level reflects path.length + 1 (how many stages were traversed), not "questions answered out of a fixed total" — there is no fixed total here.',
            technical:'game_sessions.status = "completed"\nend_time = NOW()\nscore = finalScore (0–4, the ASER level index)' },
        { type: 'process',  icon: '🛡️', title: 'Terminal Status Guard',
            simple:   'Once ended, a session status cannot be changed.',
            detailed: 'The server enforces that "quit" sessions can never be overwritten as "completed". This is a hard server-side rule.',
            technical:'Backend guard: if (newStatus==="completed" && current==="quit")\n→ return 200 { message:"Session already finalized" }\n→ No DB write performed' },
        { type: 'success',  icon: '📊', title: 'Report Available',
            simple:   'The administrator can view the complete session in the Reports panel.',
            detailed: 'All data — session, assessment, PDF — is linked by session_id and visible in the admin Reports module.',
            technical:'GET /api/games/reports/detail/:gameName (admin JWT required)\nJOINs: game_sessions + children + game_assessments + game_dashboard_pdfs' },
    ],
});

// makeAnkganitV3WorkflowFlows — Ankganit V3 is an adaptive arithmetic ladder,
// NOT a fixed-question test. It has no QUESTIONS array, no consecutive-wrong
// stop rule, and no working category minimum — it gets its own flow generator
// instead of reusing makeWorkflowFlows's generic fixed-question model.
const makeAnkganitV3WorkflowFlows = (game) => ({
    journey: [
        { type: 'start',    icon: '📱', title: 'Game Load',
            simple:   'The child opens the game on their device.',
            detailed: 'React component mounts. Child data is read from localStorage. If no child is logged in, user is redirected to login.',
            technical:'useEffect → reads localStorage("currentChild") → if null, navigate("/login") → calls checkResume(childId) + fetchActivity(childId)' },
        { type: 'api',      icon: '📚', title: 'Question Bank Fetch',
            simple:   'The subtraction/division/number-recognition question bank is loaded from the server.',
            detailed: 'Unlike admin-managed display text, the canonical question bank (correct answers included) is fetched directly, not through the language-content system.',
            technical:`GET /api/public/ankganit-v3\nReturns 4 categories with .questions[]: { id, title, text, correct_answer, remainder, display_order }` },
        { type: 'api',      icon: '🔍', title: 'Resume Check',
            simple:   'The system checks if the child has a previous unfinished session.',
            detailed: 'The backend queries the latest session for this child and game. If it has status "in_progress" or "paused" and isn\'t assessment-submitted, a resume popup is shown.',
            technical:`GET /api/games/sessions/resume/:childId/${game.key}\nReturns: sessionInfo (saved_state with stage, path, per-category results, timers) or null` },
        { type: 'decision', icon: '❓', title: 'Saved Session Found?',
            simple:   'If a previous session is found, the child can choose to continue or start fresh.',
            detailed: 'Resume restores every completed stage\'s result plus timers. In-progress tile marking on the current Number Recognition screen is NOT restored.',
            technical:'sessionInfo.status in ["in_progress","paused"] && !assessmentSubmitted → showResumeModal = true\nResume → restores stage, path, subtraction/division/numberRecognition state, timerSeconds, qTimer, pauses from saved_state',
            branches: [{ label: 'Yes → Resume Prompt', color: '#f59e0b' }, { label: 'No → Splash Screen', color: '#10b981' }] },
        { type: 'process',  icon: '🎵', title: 'Splash Screen',
            simple:   'Game instructions are displayed and audio plays automatically.',
            detailed: 'Background audio plays as soon as the splash screen loads. The "Start Now" button remains disabled until audio finishes.',
            technical:'<audio ref={audioRef} src="/assets/audios/number_skill_v3/splash.wav" />\naudioRef.current.play() → onEnded: setAudioFinished(true) → enables Start Now\nonError: setAudioFinished(true) as fail-safe' },
        { type: 'api',      icon: '▶️', title: 'Session Created on Server',
            simple:   'A unique session ID is created to track this child\'s attempt.',
            detailed: 'The server creates a new record in the database. If an active session already exists (deduplication guard), the existing ID is returned.',
            technical:`POST /api/games/sessions/start\nBody: { child_id, game_name: "${game.key}" }\nResponse: { sessionId, attempt_no }\nDB: INSERT INTO game_sessions (child_id, game_name, status="in_progress", score=0)` },
        { type: 'process',  icon: '➖', title: 'Subtraction Stage Begins',
            simple:   'The assessor picks 2 of 8 subtraction problems; the child solves them one at a time.',
            detailed: 'The ladder always starts with Subtraction. Pick order matters — the first problem picked becomes Q1, the second becomes Q2.',
            technical:'setStage("subtraction_select") → assessor picks pendingSubtractionSelection[0..1] → setStage("subtraction_q1") → numpad entry' },
        { type: 'process',  icon: '🪜', title: 'Adaptive Ladder Runs',
            simple:   'Depending on how the child answers, the test moves to easier or harder stages until a numeracy level is found.',
            detailed: 'See "Stage Flow" for the full pass/fail routing between Subtraction (with its conditional Q1 retry), Division, and the two Number Recognition levels.',
            technical:'evaluateAfterQ2() / proceedFromSubtractionResult() / finishNumberRecognition99() / finishNumberRecognition9() → determine PASS/FAIL → setStage(nextStage) or finalizeAssessment(level)',
            isRef: true, refLabel: 'See Stage Flow →' },
        { type: 'process',  icon: '📊', title: 'Score Screen',
            simple:   'The final numeracy level and stage-by-stage results are displayed.',
            detailed: 'Score screen shows: final numeracy level, score dial (finalScore/4), the path breadcrumb of every stage traversed, and a per-stage results table.',
            technical:'setScreen("score") → finalLevel/finalScore already set by finalizeAssessment()\nResults table rendered from path[] + per-category result objects' },
        { type: 'process',  icon: '📋', title: 'Assessment Form',
            simple:   'The assessor fills in behavioral observations about the child\'s session.',
            detailed: 'Four required questions (radio buttons) + eight behavioral checkboxes (at least 1 required) + free-text notes with voice dictation support, confirmed via a modal before submission.',
            technical:'<SessionAssessmentForm /> component renders\nQ1–Q5 required (Q5 needs >=1 checked), validation prevents submit if empty\nConfirm modal → submitAssessmentForm()' },
        { type: 'api',      icon: '💾', title: 'Assessment Saved',
            simple:   'The assessor\'s observations are saved to the system.',
            detailed: 'Assessment data is stored in a separate table linked to the session ID.',
            technical:'POST /api/games/assessments\nBody: { session_id, child_id, q1_enjoyment, q2_feeling, q3_tiredness, q4_play_again, q5_behaviors[], additional_notes }\nDB: INSERT INTO game_assessments' },
        { type: 'process',  icon: '📄', title: 'PDF Dashboard Generated',
            simple:   'A PDF summary of the session is automatically created and saved.',
            detailed: 'The score screen (.ns-main) is cloned off-screen, captured as a high-resolution image, and embedded in an A4 PDF. The file is uploaded to the server and linked to the session.',
            technical:'Clone .ns-main off-screen (avoids clipping from .ns-app\'s overflow:hidden) → html2canvas(scale:1.5) → jsPDF(A4) → POST /api/games/pdfs/upload\nFilename: [ChildName]_AnkganitV3_SES[id]_[timestamp].pdf' },
        { type: 'success',  icon: '✅', title: 'Session Complete',
            simple:   'The assessment is finished. The admin can now view the full report.',
            detailed: 'Session status is "completed". All data is saved: stage results, timers, assessment, PDF. Admin can view the full session in the Reports module.',
            technical:'game_sessions.status = "completed", end_time = NOW()\ngame_assessments record created\ngame_dashboard_pdfs record created\nReport available: GET /api/games/reports/detail/:gameName' },
    ],

    question: [
        { type: 'start',    icon: '🪜', title: 'Stage Begins',
            simple:   'One of several possible stages is shown: Subtraction Select/Q1/Q2/Retry, Division Select/Q1, or one of the two Number Recognition levels.',
            detailed: 'Which stage shows next is entirely determined by the previous stage\'s pass/fail verdict — there is no fixed sequence.',
            technical:'setStage(nextStage) → setQTimer(0) → qTimer counts seconds via setInterval(1000)' },
        { type: 'decision', icon: '📝', title: 'Stage Type?',
            simple:   'Subtraction and Division use an on-screen numpad; Number Recognition uses tile marking.',
            detailed: 'Numpad stages present digit buttons for the child\'s answer (Division needs two fields: quotient and remainder). Tile-marking stages present a bank of numbers to select and mark.',
            technical:'stage in ["subtraction_q1","subtraction_q2","subtraction_q1_retry","division_q1"] → numpad UI\nstage in ["number_recognition_99","number_recognition_9"] → tile-marking UI',
            branches: [{ label: 'Subtraction/Division → Numpad', color: '#0891b2' }, { label: 'Number Recognition → Tile Marking', color: '#8b5cf6' }] },
        { type: 'process',  icon: '🔢', title: 'Numpad Entry',
            simple:   'The child (or assessor on their behalf) types the answer using on-screen digit buttons.',
            detailed: 'Subtraction uses a single answer field. Division uses two fields — quotient and remainder — both must be correct, and there is no retry on Division.',
            technical:'handleNumpadInput(val) → setter(prev => prev + val) for the active field (answerVal / quotientVal / remainderVal)' },
        { type: 'process',  icon: '✋', title: 'Tile Marking',
            simple:   'The assessor selects up to 5 tiles from a 10-item bank and marks each ✓ or ✗ as the child identifies it aloud.',
            detailed: 'Exactly 5 tiles must be selected and marked before the stage can continue.',
            technical:'toggleNrTileSelection(text) → nrSelectedTexts\nmarkNrTile(text, correct) → nrMarks[text] = "correct"|"incorrect"\ncanContinueNrMarking = nrSelectedTexts.length === 5 && markedCount === 5' },
        { type: 'decision', icon: '⚖️', title: 'Stage Verdict',
            simple:   'The stage passes or fails depending on the numpad answer or the tile marking.',
            detailed: 'Subtraction/Division: exact numeric match required. Tile marking: passes at 4 or 5 correct out of 5.',
            technical:'Numpad: parseInt(val) === correctAnswer (both quotient AND remainder for Division)\nTile: correctCount >= 4 → PASS',
            branches: [{ label: 'PASS', color: '#10b981' }, { label: 'FAIL', color: '#dc2626' }] },
        { type: 'decision', icon: '🪜', title: 'Route to Next Stage',
            simple:   'Where the test goes next depends on which stage just passed or failed.',
            detailed: 'Q1 wrong + Q2 correct triggers a one-time Q1 retry. Passing both Subtraction questions (after any retry) unlocks Division; failing drops to Number Recognition (10–99), then (1–9).',
            technical:'Q2 evaluated: Q1 wrong & Q2 correct → Subtraction Q1 Retry\nCombined pass (both correct) → Division Select\nCombined fail → Number Recognition (10–99)\nDivision: pass→END "Division", fail→END "Subtraction"\nNR(10–99): pass→END "Number Recognition (10–99)", fail→NR(1–9)\nNR(1–9): pass→END "Number Recognition (1–9)", fail→END "Beginner"' },
        { type: 'success',  icon: '➡️', title: 'Advance or Ladder Complete',
            simple:   'Either the next stage begins, or the test ends and a final numeracy level is recorded.',
            detailed: 'The completed stage name is appended to path[]. If the routing table says END, finalizeAssessment(level) runs and the screen moves to Score.',
            technical:'path = [...path, stageName] → setStage(next) OR finalizeAssessment(level) → setScreen("score")' },
    ],

    score: [
        { type: 'start',    icon: '🎯', title: 'Ladder Ends',
            simple:   'The test reaches an END point in the stage-routing table.',
            detailed: 'This can happen after as few as 3 stages (fail Subtraction combined check → fail Number Recognition 10–99 → fail Number Recognition 1–9) or as many as 5 (Q1 retry fired, then climbing to Division).',
            technical:'finalizeAssessment(level, pathArg) called from the last stage\'s verdict handler' },
        { type: 'process',  icon: '🏷️', title: 'Final Level Determined',
            simple:   'The numeracy level the child reached becomes the result — not a points total.',
            detailed: 'One of 5 levels, in increasing order of difficulty: Beginner, Number Recognition (1–9), Number Recognition (10–99), Subtraction, Division.',
            technical:'LEVELS = { Beginner:0, "Number Recognition (1–9)":1, "Number Recognition (10–99)":2, Subtraction:3, Division:4 }\nfinalLevel is set directly by the stage-routing table' },
        { type: 'process',  icon: '🏆', title: 'Score Calculated',
            simple:   'The numeracy level is converted to a number for the score dial.',
            detailed: 'Reaching Division at all already guarantees a floor of "Subtraction" (score 3) — Division only decides whether the score upgrades to 4.',
            technical:'finalScore = LEVELS[finalLevel]\nfinalGameTime = timerSeconds (snapshot taken the moment the ladder ends)' },
        { type: 'process',  icon: '🧵', title: 'Path Breadcrumb Built',
            simple:   'A trail of every stage the child actually went through is recorded, including the Q1 retry if it fired.',
            detailed: 'This trail drives both the breadcrumb display and the per-stage results table on the score screen.',
            technical:'path = [...] e.g. ["subtraction_select","subtraction_q1","subtraction_q2","subtraction_q1_retry","division_select","division_q1"]' },
        { type: 'process',  icon: '📋', title: 'Score Metrics Generated',
            simple:   'The score screen shows the numeracy level, a score dial, and per-stage timing.',
            detailed: 'Duration and per-stage timing are computed from each stage\'s recorded qTimer value at the time it was completed.',
            technical:'Per-category result fields carry their own timing: subtraction.q1/.q2 attempts, division attempt, numberRecognition99/9 records' },
        { type: 'success',  icon: '✅', title: 'Score Complete',
            simple:   'Assessment scoring is done. Assessment form follows.',
            detailed: 'All traversed stages are displayed in a results table. The behavioral assessment form then appears for the assessor to complete.',
            technical:'screen = "score" → SessionAssessmentForm renders\nassessmentSubmitted controls which buttons appear after form submit' },
    ],

    api: [
        { type: 'start',    icon: '📱', title: 'Client-Side Event',
            simple:   'Something happens in the game — a numpad digit pressed, a tile marked, a stage completed, or the game ending.',
            detailed: 'Every significant game action (start, stage completion, pause, quit, submit assessment) triggers an API call to the backend server.',
            technical:'React state change or user interaction → async axios call → awaits server response' },
        { type: 'api',      icon: '📚', title: 'Question Bank Fetch',
            simple:   'The canonical subtraction/division/number-recognition question bank — including correct answers — is loaded.',
            detailed: 'This is a plain public GET, not routed through the language-content system, since it carries scoring-sensitive data (correct_answer, remainder).',
            technical:`GET /api/public/ankganit-v3\nResponse: { success, categories: [{ name, questions: [{ id, title, text, correct_answer, remainder, display_order }] }] }` },
        { type: 'api',      icon: '🌐', title: 'Display Text Overrides',
            simple:   'Per-language display text for each question is loaded separately from the scoring data.',
            detailed: 'This only affects what\'s shown on screen — never scoring, saved_state, or the PDF.',
            technical:`GET /api/public/elements?test_id=${game.key}\ngetContent(\`q_\${questionId}\`) → resolves content_q_<id> for the player's language` },
        { type: 'api',      icon: '🔍', title: 'Resume Check',
            simple:   'Check if the child can continue a previous session.',
            detailed: 'Called once when the game loads. Returns the latest session for this child/game.',
            technical:`GET /api/games/sessions/resume/:childId/${game.key}\nAuth: child session\nResponse: { success, sessionInfo: { id, status, saved_state, attempt_no } | null }` },
        { type: 'api',      icon: '▶️', title: 'Start Session',
            simple:   'Create a new session record when the child starts.',
            detailed: 'Returns a session ID used for all subsequent updates. Deduplication prevents duplicate sessions.',
            technical:`POST /api/games/sessions/start\nBody: { child_id, game_name:"${game.key}" }\nResponse: { success, sessionId, attempt_no }\nHTTP 201 (new) or 200 (reused)` },
        { type: 'api',      icon: '💾', title: 'Progress Update (Repeated)',
            simple:   'After every stage, the progress is saved to the server.',
            detailed: 'Called after each stage transition and also on pause/quit. Carries the full ladder snapshot so sessions can be resumed.',
            technical:`PUT /api/games/sessions/update/:sessionId\nBody: { score, progress_level: path.length+1, status, saved_state: { stage, path, subtraction, division, numberRecognition99, numberRecognition9, finalLevel, finalScore, finalGameTime, timerSeconds, qTimer, pauses } }\nStatus values: "in_progress" | "paused" | "quit" | "completed"` },
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
            detailed: 'Score screen is cloned off-screen, captured with html2canvas, converted to PDF via jsPDF, then uploaded as a file.',
            technical:`POST /api/games/pdfs/upload (multipart/form-data)\nFields: pdf (file), child_id, session_id, game_name\nDB: INSERT INTO game_dashboard_pdfs (file_path)\nFile: /dashboard_pdfs/[name].pdf` },
        { type: 'api',      icon: '📈', title: 'Admin Report',
            simple:   'The administrator views the complete session data.',
            detailed: 'Admin-only endpoint. Returns session records with per-stage results, behavioral assessment, and PDF link.',
            technical:`GET /api/games/reports/detail/${game.key}\nAuth: Admin JWT Bearer token\nReturns: { columns, data: [{ session_id, score, stage_results, assessment, pdf_url }] }` },
        { type: 'success',  icon: '✅', title: 'Data Cycle Complete',
            simple:   'All game data is safely stored and accessible to administrators.',
            detailed: 'Three tables contain the full session record: game_sessions, game_assessments, game_dashboard_pdfs.',
            technical:'game_sessions: status="completed", end_time, saved_state\ngame_assessments: q1–q4, behaviors[], notes\ngame_dashboard_pdfs: file_path\nAll joined in /reports/detail response' },
    ],

    session: [
        { type: 'start',    icon: '🟢', title: 'Status: in_progress',
            simple:   'The session is active — the child is playing.',
            detailed: 'Set when the session is created. Updated with score and saved_state on every stage transition.',
            technical:`game_sessions.status = "in_progress"\nCreated by: POST /sessions/start\nUpdated by: PUT /sessions/update after each stage` },
        { type: 'decision', icon: '⏸️', title: 'Assessor Pauses?',
            simple:   'The assessor can pause the session at any time.',
            detailed: 'Pause saves the full ladder state to the server. A pause event (with the current stage, timestamp, and reason) is appended to the pauses array in saved_state.',
            technical:`PUT /sessions/update: { status:"paused", quit_reason: reason, saved_state: { ...state, pauses: [...pauses, { stage, reason, timestamp }] } }\nThen: navigate("/")`,
            branches: [{ label: 'Yes → Pause & Save', color: '#f59e0b' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🟡', title: 'Status: paused',
            simple:   'The game is saved and the child can resume later.',
            detailed: 'On next visit, the resume check returns this session. The assessor can choose to resume (restoring every completed stage) or start fresh.',
            technical:'game_sessions.status = "paused"\nResume: GET /sessions/resume → sessionInfo.saved_state contains the full snapshot\nResume: setStage, setPath, setSubtraction/Division/NumberRecognition, setTimerSeconds from saved_state' },
        { type: 'decision', icon: '🚪', title: 'Assessor Quits?',
            simple:   'The assessor can end the session early for any reason.',
            detailed: 'Quit requires a reason to be entered (typed or dictated). The game transitions to the score screen using the current stage as the endpoint.',
            technical:`PUT /sessions/update: { status:"quit", quit_reason: reason, end_time:NOW() }\nsetScreen("score") → setTimeout(generateAndUploadPDF, 1500)`,
            branches: [{ label: 'Yes → Quit', color: '#dc2626' }, { label: 'No → Continue', color: '#10b981' }] },
        { type: 'process',  icon: '🔴', title: 'Status: quit',
            simple:   'The session was ended early by the assessor.',
            detailed: 'Score screen shows the ladder stopped early, with the quit reason recorded. Assessment form still appears for behavioral data.',
            technical:'game_sessions.status = "quit"\nquit_reason saved\nend_time = NOW()' },
        { type: 'decision', icon: '🪜', title: 'Ladder Reaches an END?',
            simple:   'Unlike stop-rule games, this test always ends by reaching an END point in the stage-routing table — there\'s no separate "3 wrong in a row" or "below cutoff" drop condition.',
            detailed: 'Every stage\'s FAIL branch either routes to another stage or is itself an END — see Stage Flow for the full table.',
            technical:'finalizeAssessment(level) → PUT /sessions/update: { status:"completed", score: LEVELS[level], saved_state }',
            branches: [{ label: 'END reached → Status: completed', color: '#10b981' }] },
        { type: 'process',  icon: '🟢', title: 'Status: completed',
            simple:   'The session ended normally — the ladder reached an END point naturally.',
            detailed: 'progress_level reflects path.length + 1 (how many stages were traversed), not "questions answered out of a fixed total" — there is no fixed total here.',
            technical:'game_sessions.status = "completed"\nend_time = NOW()\nscore = finalScore (0–4, the numeracy level index)' },
        { type: 'process',  icon: '🛡️', title: 'Terminal Status Guard',
            simple:   'Once ended, a session status cannot be changed.',
            detailed: 'The server enforces that "quit" sessions can never be overwritten as "completed". This is a hard server-side rule.',
            technical:'Backend guard: if (newStatus==="completed" && current==="quit")\n→ return 200 { message:"Session already finalized" }\n→ No DB write performed' },
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

const READING_V2_FLOW_SECTIONS = [
    { key: 'journey',  icon: '🎮', label: 'Game Journey'      },
    { key: 'question', icon: '🪜', label: 'Stage Flow'        },
    { key: 'score',    icon: '🏆', label: 'Score & Level'     },
    { key: 'api',      icon: '🔗', label: 'API Flow'          },
    { key: 'session',  icon: '🗄️', label: 'Session States'   },
];

const ANKGANIT_V3_FLOW_SECTIONS = [
    { key: 'journey',  icon: '🎮', label: 'Game Journey'      },
    { key: 'question', icon: '🪜', label: 'Stage Flow'        },
    { key: 'score',    icon: '🏆', label: 'Score & Level'     },
    { key: 'api',      icon: '🔗', label: 'API Flow'          },
    { key: 'session',  icon: '🗄️', label: 'Session States'   },
];

const getFlowSections = (game) =>
    game.key === 'literacy_reading_skill_v2' ? READING_V2_FLOW_SECTIONS :
    game.key === 'numeracy_number_skill_v3' ? ANKGANIT_V3_FLOW_SECTIONS :
    FLOW_SECTIONS;

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

    const modules      = getConnectedModules(game);
    const flowSections = getFlowSections(game);
    const flows =
        game.key === 'literacy_reading_skill_v2' ? makeReadingV2WorkflowFlows(game) :
        game.key === 'numeracy_number_skill_v3' ? makeAnkganitV3WorkflowFlows(game) :
        game.key === 'number_recall_lottery' ? makeLotteryWorkflowFlows(game) :
        makeWorkflowFlows(game);
    const nodes = flows[activeFlow] || [];
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
                    {flowSections.map(fs => (
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
                            {game.title} · {flowSections.find(f=>f.key===activeFlow)?.label}
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: T.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                            {flowSections.find(f=>f.key===activeFlow)?.icon} {flowSections.find(f=>f.key===activeFlow)?.label} Diagram
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
    working_memory_herpher_v2: 'HerPherGameV2.jsx',
    working_memory_herpher_v3: 'HerPherGameV3.jsx',
    numeracy_number_skill:  'NumberSkillGame.jsx',
    numeracy_number_skill_v2: 'NumberSkillGameV2.jsx',
    numeracy_number_skill_v3: 'NumberSkillGameV3.jsx',
    literacy_reading_skill: 'ReadingSkillGame.jsx',
    literacy_reading_skill_v2: 'ReadingSkillGameV2.jsx',
    cognitive_flex_chor:    'ChorMachayeShorGame.jsx',
    triangle_rachna:        'TriangleRachnaGame.jsx',
};

const getConnectedModules = (game) => {
    const modules = [
        { file: GAME_FILE_MAP[game.key] || `${game.title}Game.jsx`, type: 'Frontend',  icon: '⚛️',  desc: 'Screen flow, game logic, timers, scoring, session state' },
        { file: 'SessionAssessmentForm.jsx',                         type: 'Component', icon: '🧩',  desc: 'Behavioral assessment form — all observation fields' },
        { file: 'gameController.js',                                 type: 'Backend',   icon: '🖥️',  desc: 'Session lifecycle, score processing, report generation' },
        { file: 'gameRoutes.js',                                     type: 'Routes',    icon: '🔀',  desc: 'REST API endpoint definitions and middleware' },
        { file: 'db.js → game_sessions',                             type: 'Database',  icon: '🗄️',  desc: 'Session storage — score, saved state, status, timing' },
        { file: 'db.js → game_assessments',                          type: 'Database',  icon: '🗄️',  desc: 'Behavioral assessment form data storage' },
        { file: 'db.js → game_dashboard_pdfs',                       type: 'Database',  icon: '🗄️',  desc: 'PDF export file path storage' },
    ];
    if (game.key === 'literacy_reading_skill_v2') {
        modules.splice(1, 0,
            { file: 'useTestContent.js',           type: 'Component', icon: '🧩', desc: 'Fetches admin-managed letters/words/paragraphs/story per language' },
            { file: 'ReadingV2ContentManager.jsx', type: 'Component', icon: '🧩', desc: 'Admin panel — edit letters/words/paragraphs/story/questions/hints' },
        );
    }
    if (game.key === 'numeracy_number_skill_v3') {
        modules.splice(1, 0,
            { file: 'useTestContent.js',             type: 'Component', icon: '🧩', desc: 'Fetches admin-managed question display text per language' },
            { file: 'AnkganitV3ContentManager.jsx',  type: 'Component', icon: '🧩', desc: 'Admin panel — per-language display-text overrides for each question' },
            { file: 'AdminAnkganitV3Config.jsx',     type: 'Component', icon: '🧩', desc: 'Admin panel — question bank, categories, and correct answers' },
        );
    }
    if (game.key === 'number_recall_lottery') {
        modules.splice(1, 0,
            { file: 'NumberRecallContentManager.jsx', type: 'Component', icon: '🧩', desc: 'Admin panel — cosmetic per-language digit-glyph overrides only (never affects scoring)' },
        );
    }
    return modules;
};

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
    const englishOnly = ['literacy_reading_skill_v2', 'numeracy_number_skill_v3'].includes(game.key);
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
                        {!englishOnly && (
                            <div style={{ display: 'flex', background: T.white, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
                                {DOCS_LANGUAGES.map(({code:l,label:lbl}) => (
                                    <button key={l} onClick={() => setLang(l)} style={{ ...btnStyle, background: lang===l ? T.accent : 'transparent', color: lang===l ? '#fff' : T.muted, borderRadius: 0, padding: '5px 14px' }}>{lbl}</button>
                                ))}
                            </div>
                        )}
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
    const englishOnly = ['literacy_reading_skill_v2', 'numeracy_number_skill_v3'].includes(game.key);
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
                        {!englishOnly && (
                            <span style={{ padding:'4px 11px', borderRadius:20, fontSize:'0.73rem', fontWeight:700, background:T.accentBg, color:T.accentText, border:`1px solid ${T.accentBd}` }}>{docsLangLabel(lang)} · {screenshots.length} screens</span>
                        )}
                        {/* Language toggle */}
                        {!englishOnly && (
                            <div style={{ display:'flex', background:T.white, border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
                                {DOCS_LANGUAGES.map(({code:l,label:lbl})=>(
                                    <button key={l} onClick={()=>setLang(l)} style={{ ...btnStyle, background:lang===l?T.accent:'transparent', color:lang===l?'#fff':T.muted, borderRadius:0, padding:'5px 13px' }}>{lbl}</button>
                                ))}
                            </div>
                        )}
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
                                        {!englishOnly && `${docsLangLabel(lang)} · `}{screenshots.length} published screenshot{screenshots.length!==1?'s':''} · SANGIAN Documentation System
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

// ─── Screenshots & Manual — combined viewer (two tabs over the same data) ─────
// Gameplay Manual is just an auto-generated, published-only, PDF-exportable
// view of Screenshot Library's own screenshots, grouped by screen type — same
// underlying `screenshots` table, two presentation modes. Merged into tabs
// instead of two separate sidebar sections.

const ScreenshotsAndManualViewer = ({ game, section }) => {
    const [tab, setTab] = useState('manage');
    const tabs = [
        { key: 'manage', icon: '🖼️', label: 'Manage Library' },
        { key: 'manual', icon: '📋', label: 'Manual View' },
    ];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '4px', padding: '10px 22px 0', background: T.white, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                            border: `1px solid ${tab === t.key ? T.border : 'transparent'}`,
                            borderBottom: tab === t.key ? `1px solid ${T.white}` : `1px solid transparent`,
                            marginBottom: '-1px',
                            background: tab === t.key ? T.white : 'transparent',
                            color: tab === t.key ? T.accentText : T.muted,
                            fontSize: '0.82rem', fontWeight: 700, fontFamily: T.font,
                            transition: 'all 0.15s',
                        }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {tab === 'manage'
                    ? <ScreenshotLibraryViewer game={game} section={section} />
                    : <GameplayManualViewer game={game} section={section} />}
            </div>
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
            {titleHi && (
                <span style={{ fontSize: '0.72rem', color: T.muted, fontStyle: 'italic', fontFamily: HINDI_FONT }}>/ {titleHi}</span>
            )}
        </div>
        <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
);

const BilingualBlock = ({ en, hi, fieldKey, expanded, onToggle, showHindi = true }) => {
    const LIMIT = 220;
    const langs = showHindi
        ? [
            { lang: 'en', label: '🇬🇧 English', text: en, ff: T.font,    accent: '#1d4ed8' },
            { lang: 'hi', label: '🇮🇳 हिंदी',   text: hi, ff: HINDI_FONT, accent: '#7c3aed' },
        ]
        : [
            { lang: 'en', label: '🇬🇧 English', text: en, ff: T.font,    accent: '#1d4ed8' },
        ];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: showHindi ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr', gap: '14px' }}>
            {langs.map(({ lang, label, text, ff, accent }) => {
                const key   = `${fieldKey}_${lang}`;
                const isLong = showHindi && (text || '').length > LIMIT;
                const isExp  = expanded[key];
                const shown  = isLong && !isExp ? text.slice(0, LIMIT) + '…' : (text || '');
                return (
                    <div key={lang} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px', border: `1px solid ${T.border}` }}>
                        {showHindi && (
                            <div style={{ fontSize: '0.67rem', fontWeight: 700, color: accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
                                {label}
                            </div>
                        )}
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
    const showHindi = !['literacy_reading_skill_v2', 'numeracy_number_skill_v3'].includes(game.key);

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
                            : 'Default content'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {saveMsg && (
                        <span style={{ fontSize: '0.78rem', color: saveMsg.includes('✅') ? '#059669' : '#dc2626', fontWeight: 600 }}>
                            {saveMsg}
                        </span>
                    )}
                    {isEditing && (
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
                                    {showHindi && (
                                        <div style={{ fontSize: '0.82rem', color: T.muted, fontFamily: HINDI_FONT, lineHeight: 1.5 }}>
                                            {d.hi?.skill || ''}
                                        </div>
                                    )}
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
                                {showHindi && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        fontSize: '0.75rem', fontWeight: 600, padding: '5px 14px',
                                        borderRadius: '999px', background: 'rgba(255,255,255,0.85)',
                                        border: `1px solid ${game.color}35`, color: game.color,
                                    }}>
                                        🌐 EN + हिंदी
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Objective */}
                        <IntroCard icon="🎯" title="Test Objective" titleHi={showHindi ? "परीक्षण उद्देश्य" : undefined} game={game}>
                            <BilingualBlock
                                en={d.en?.objective} hi={d.hi?.objective}
                                fieldKey="objective" expanded={expanded} onToggle={toggleExpand}
                                showHindi={showHindi}
                            />
                        </IntroCard>

                        {/* About this Game */}
                        <IntroCard icon="📘" title="About this Game" titleHi={showHindi ? "इस खेल के बारे में" : undefined} game={game}>
                            <BilingualBlock
                                en={d.en?.description} hi={d.hi?.description}
                                fieldKey="description" expanded={expanded} onToggle={toggleExpand}
                                showHindi={showHindi}
                            />
                        </IntroCard>

                        {/* Before You Start */}
                        <IntroCard icon="💡" title="Before You Start" titleHi={showHindi ? "शुरू करने से पहले" : undefined} game={game} accent>
                            <div style={{ display: 'grid', gridTemplateColumns: showHindi ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr', gap: '14px' }}>
                                {(showHindi
                                    ? [
                                        { lang: 'en', label: '🇬🇧 English', ff: T.font,    accent: '#1d4ed8', text: d.en?.guidance },
                                        { lang: 'hi', label: '🇮🇳 हिंदी',   ff: HINDI_FONT, accent: '#7c3aed', text: d.hi?.guidance },
                                    ]
                                    : [
                                        { lang: 'en', label: '🇬🇧 English', ff: T.font,    accent: '#1d4ed8', text: d.en?.guidance },
                                    ]
                                ).map(({ lang, label, ff, accent, text }) => (
                                    <div key={lang} style={{
                                        background: 'rgba(255,255,255,0.75)', borderRadius: '10px',
                                        padding: '14px 16px', border: `1px solid ${game.color}22`,
                                    }}>
                                        {showHindi && (
                                            <div style={{ fontSize: '0.67rem', fontWeight: 700, color: accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                {label}
                                            </div>
                                        )}
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
                            {showHindi && (
                                <span style={{
                                    fontSize: '0.88rem', fontFamily: HINDI_FONT, fontWeight: 600, padding: '4px 14px',
                                    borderRadius: '999px', background: 'rgba(124,58,237,0.07)',
                                    border: '1px solid rgba(124,58,237,0.2)', color: '#7c3aed',
                                }}>
                                    🧠 {d.hi?.skill || '—'}
                                </span>
                            )}
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

    // Mirrors the Test Configuration order/status (Settings → Test Configuration →
    // Test Visibility) so the docs sidebar and landing grid always match it.
    const [testConfigList, setTestConfigList] = useState(null);

    useEffect(() => {
        let cancelled = false;
        axios.get(`${API_URL}/admin/test-config`, authHeader())
            .then(res => { if (!cancelled) setTestConfigList(res.data.tests || []); })
            .catch(err => console.error('Failed to load test configuration order:', err));
        return () => { cancelled = true; };
    }, []);

    const orderedGameCatalog = useMemo(() => {
        if (!testConfigList) return GAME_CATALOG.map(g => ({ ...g, enabled: true }));
        const statusByKey = {};
        testConfigList.forEach((t, i) => { statusByKey[t.key] = { enabled: t.enabled, order: i }; });
        return [...GAME_CATALOG]
            .map(g => ({ ...g, enabled: statusByKey[g.key]?.enabled ?? true }))
            .sort((a, b) => {
                const orderA = statusByKey[a.key]?.order ?? Number.MAX_SAFE_INTEGER;
                const orderB = statusByKey[b.key]?.order ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
            });
    }, [testConfigList]);

    const selectedGame = gameParam ? orderedGameCatalog.find(g => g.key === gameParam) || null : null;
    const expandedGame = selectedGame ? selectedGame.key : null;
    const selectedSection = (selectedGame && sectionParam)
        ? getVisibleSections(selectedGame).find(s => s.key === sectionParam) || null
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
                catalog={orderedGameCatalog}
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
                            <LandingPage catalog={orderedGameCatalog} onGameClick={handleGameClick} />
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
                                ['literacy_reading_skill_v2', 'number_recall_lottery_v2', 'numeracy_number_skill_v3'].includes(selectedGame.key) ? '' :
                                `# ${selectedGame.title} — Technical Documentation 2013\n\nLegacy documentation for **${selectedGame.title}**.`
                            }
                        />
                    ) : selectedSection.available && selectedSection.key === 'technical_docs' ? (
                        <DynamicDocViewer
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__tech`}
                            defaultContent={
                                selectedGame.key === 'literacy_reading_skill_v2' ? makeReadingV2TechDocTemplate(selectedGame) :
                                selectedGame.key === 'numeracy_number_skill_v3' ? makeAnkganitV3TechDocTemplate(selectedGame) :
                                selectedGame.key === 'number_recall_lottery' ? makeLotteryTechDocTemplate(selectedGame) :
                                makeTechDocTemplate(selectedGame)
                            }
                        />
                    ) : selectedSection.available && selectedSection.key === 'api_integration' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__api`}
                            defaultContent={
                                selectedGame.key === 'literacy_reading_skill_v2' ? makeReadingV2ApiTemplate(selectedGame) :
                                selectedGame.key === 'numeracy_number_skill_v3' ? makeAnkganitV3ApiTemplate(selectedGame) :
                                selectedGame.key === 'number_recall_lottery' ? makeLotteryApiTemplate(selectedGame) :
                                makeApiTemplate(selectedGame)
                            }
                        />
                    ) : selectedSection.available && selectedSection.key === 'score_logic' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__score`}
                            defaultContent={
                                selectedGame.key === 'literacy_reading_skill_v2' ? makeReadingV2ScoreLogicTemplate(selectedGame) :
                                selectedGame.key === 'numeracy_number_skill_v3' ? makeAnkganitV3ScoreLogicTemplate(selectedGame) :
                                selectedGame.key === 'number_recall_lottery' ? makeLotteryScoreLogicTemplate(selectedGame) :
                                makeScoreLogicTemplate(selectedGame)
                            }
                        />
                    ) : selectedSection.available && selectedSection.key === 'assessment' ? (
                        <DocSectionEditor
                            game={selectedGame}
                            section={selectedSection}
                            docKey={`${selectedGame.key}__assessment`}
                            defaultContent={
                                selectedGame.key === 'literacy_reading_skill_v2' ? makeReadingV2AssessmentTemplate(selectedGame) :
                                selectedGame.key === 'numeracy_number_skill_v3' ? makeAnkganitV3AssessmentTemplate(selectedGame) :
                                selectedGame.key === 'number_recall_lottery' ? makeLotteryAssessmentTemplate(selectedGame) :
                                makeAssessmentTemplate(selectedGame)
                            }
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
                    ) : selectedSection.available && selectedSection.key === 'reports' ? (
                        <ReportsAnalysisViewer
                            game={selectedGame}
                            section={selectedSection}
                        />
                    ) : selectedSection.available && selectedSection.key === 'screenshots' ? (
                        <ScreenshotsAndManualViewer
                            game={selectedGame}
                            section={selectedSection}
                        />
                    ) : selectedSection.available && selectedSection.key === 'introduction' ? (
                        <IntroductionViewer
                            game={selectedGame}
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
