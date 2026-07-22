const fs = require('fs');
const code = fs.readFileSync('client/src/pages/NumberSkillGameV2.jsx', 'utf8');
const renderFuncStr = code.substring(code.indexOf('const renderMathQuestion'), code.indexOf('const currentQuestion'));
console.log(renderFuncStr);
