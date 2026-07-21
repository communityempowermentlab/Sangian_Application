const fs = require('fs');

const path = 'client/src/pages/NumberSkillGameV2.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove hardcoded CONFIG and QUESTIONS
content = content.replace(/const CONFIG = {[\s\S]*?};\n\nconst QUESTIONS = \[[\s\S]*?\];\n\n/, '');

// 2. Add state inside component
const stateReplacement = `
  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get(\`\${API_URL}/public/ankganit-v2\`);
        if (res.data.success) {
           setCategories(res.data.categories);
           const flatQuestions = [];
           res.data.categories.forEach(cat => {
               cat.questions.forEach(q => {
                   flatQuestions.push({...q, category: cat});
               });
           });
           setQuestions(flatQuestions);
           setConfigLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load Ankganit V2 config', err);
      }
    };
    fetchConfig();
  }, []);
`;
content = content.replace(/const \[childData, setChildData\] = useState\(null\);/, stateReplacement + '\n  const [childData, setChildData] = useState(null);');

// 3. Prevent rendering splash until config is loaded
content = content.replace(/\{screen === 'splash' && \(/, '{screen === \'splash\' && configLoaded && (');

// 4. Update game_name in API calls
content = content.replace(/'numeracy_number_skill'/g, "'numeracy_number_skill_v2'");

// 5. Update QUESTIONS to questions
content = content.replace(/QUESTIONS/g, 'questions');

// 6. Update processScoring logic for dynamic categories
const processScoringRegex = /const c1End = [\s\S]*?Min Failed"; \}\n      \}/;
const processScoringReplacement = `
      // Check if we just completed a category
      const currentQ = questions[questionIndex];
      const nextQ = questions[questionIndex + 1];
      
      // If there is no next question OR the next question is in a different category
      if (!nextQ || nextQ.category_id !== currentQ.category_id) {
          const cat = currentQ.category;
          // Calculate how many were correct in this category
          const catQuestions = questions.filter(q => q.category_id === cat.id);
          const startIndex = questions.findIndex(q => q.id === catQuestions[0].id);
          const catCorrect = getCatCorrect(startIndex, catQuestions.length);
          
          if (catCorrect < cat.minimum_correct) {
              shouldStop = true;
              stopMsg = \`Category \${cat.name} Min Failed (\${catCorrect}/\${cat.minimum_correct})\`;
          }
      }
`;
content = content.replace(processScoringRegex, processScoringReplacement);

// Remove the `CONFIG.MAX_CONSECUTIVE_WRONG` and use hardcoded 3
content = content.replace(/CONFIG.MAX_CONSECUTIVE_WRONG/g, '3');

// 7. Update handleAutoScoring
const autoScoringRegex = /if \(q\.questionCategory === 13\) \{[\s\S]*?\} else \{/;
const autoScoringReplacement = `if (q.category.evaluation_type === 'auto_division') {
      const cQuot = parseInt(quotientVal) || 0;
      const cRem = parseInt(remainderVal) || 0;
      const pass = (cQuot === q.correct_answer && cRem === q.remainder);
      processScoring(pass ? 1 : 0, { uQ: cQuot, uR: cRem });
    } else {`;
content = content.replace(autoScoringRegex, autoScoringReplacement);
content = content.replace(/q\.correctAnswer/g, 'q.correct_answer');

// 8. Update JSX checks for evaluation type
content = content.replace(/QUESTIONS\[questionIndex\]\.type === 'manual'/g, "questions[questionIndex].category.evaluation_type === 'manual'");
content = content.replace(/QUESTIONS\[questionIndex\]\.type !== 'manual'/g, "questions[questionIndex].category.evaluation_type !== 'manual'");
content = content.replace(/QUESTIONS\[questionIndex\]\.questionCategory === 13/g, "questions[questionIndex].category.evaluation_type === 'auto_division'");

// Fix JSX for score table
content = content.replace(/qObj\?\.questionCategory === 13/g, "qObj?.category?.evaluation_type === 'auto_division'");

fs.writeFileSync(path, content);
console.log('Refactored ' + path);
