const fs = require('fs');

const sourcePath = 'client/src/pages/NumberSkillGame.jsx';
const targetPath = 'client/src/pages/NumberSkillGameV2.jsx';

let content = fs.readFileSync(sourcePath, 'utf8');

// Replace component name
content = content.replace(/NumberSkillGame/g, 'NumberSkillGameV2');

// We will replace the hardcoded CONFIG and QUESTIONS later via replace_file_content or multi_replace.
// For now, just create the base file so we can modify it.
fs.writeFileSync(targetPath, content);
console.log('Created ' + targetPath);
