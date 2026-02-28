const fs = require('fs');
const path = require('path');

const directory = './client/src';
// We're looking for the exact bad string we injected: process.env.REACT_APP_API_URL || 'http://localhost:5000/api'

function walkAndFix(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkAndFix(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // If it's the messed up api.js, let's just reset it entirely to be the single source of truth.
      if (file === 'api.js' && fullPath.includes('services')) {
          const apiJsContent = `// Utility for getting the base API URL
// Checks both Vite and Create-React-App environment variables, falling back to localhost.
export const API_URL = import.meta?.env?.VITE_API_BASE_URL || process.env.REACT_APP_API_URL || process.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
`;
          fs.writeFileSync(fullPath, apiJsContent, 'utf8');
          console.log('Reset api.js');
          continue;
      }

      let changed = false;

      // Bad string 1: `process.env.REACT_APP_API_URL || 'http://localhost:5000/api'/...` missing quotes
      // Let's replace: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' + '/
      if (content.includes("process.env.REACT_APP_API_URL || 'http://localhost:5000/api' + '")) {
          content = content.replace(/process\.env\.REACT_APP_API_URL \|\| 'http:\/\/localhost:5000\/api' \+ '/g, "API_URL + '");
          changed = true;
      }

      // Bad string 2: `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/
      if (content.includes("${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/")) {
          content = content.replace(/\$\{process\.env\.REACT_APP_API_URL \|\| 'http:\/\/localhost:5000\/api'\}\//g, "${API_URL}/");
          changed = true;
      }
      
      if (content.includes("process.env.REACT_APP_API_URL || 'http://localhost:5000/api'")) {
          content = content.replace(/process\.env\.REACT_APP_API_URL \|\| 'http:\/\/localhost:5000\/api'/g, "API_URL");
          changed = true;
      }

      if (changed) {
        // Ensure import is there
        if (!content.includes("import { API_URL }")) {
            // How deep are we?
            const depth = fullPath.split(path.sep).length - 3; // client/src = 2. if client/src/pages = 3 -> depth 1
            const relativePath = depth === 0 ? './services/api' : '../'.repeat(depth) + 'services/api';
            content = `import { API_URL } from '${relativePath}';\n` + content;
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Fixed', fullPath);
      }
    }
  }
}

walkAndFix(directory);
