const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'AuditoryAttentionGame.jsx',
    'HerPherGame.jsx',
    'ReadingSkillGame.jsx',
    'NumberRecallGame.jsx',
    'AtlantisBagiyaGame.jsx',
    'TriangleRachnaGame.jsx',
    'NumberSkillGame.jsx',
    'NumberRecallGameV2.jsx',
    'NumberSkillGameV2.jsx',
    'ChorMachayeShorGame.jsx',
    'ChaloMelaChaleGame.jsx'
];

const dir = '/Users/mohammad/Documents/sangian/client/src/pages/';

filesToUpdate.forEach(file => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
        console.log('Skipped ' + file);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');

    // Add STT_LANG_MAP to LanguageContext import
    if (content.includes("import { useLanguage } from '../contexts/LanguageContext';")) {
        content = content.replace(
            "import { useLanguage } from '../contexts/LanguageContext';",
            "import { useLanguage, STT_LANG_MAP } from '../contexts/LanguageContext';"
        );
    } else if (!content.includes("STT_LANG_MAP")) {
        // If they had a different import, just add a new one
        content = "import { STT_LANG_MAP } from '../contexts/LanguageContext';\n" + content;
    }

    // Replace the hardcoded langMap definition
    const langMapRegex = /const langMap = \{[^\}]+\};\s*/g;
    content = content.replace(langMapRegex, '');

    // Replace langMap[language] with STT_LANG_MAP[language]
    content = content.replace(/langMap\[language\]/g, 'STT_LANG_MAP[language]');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + file);
});
