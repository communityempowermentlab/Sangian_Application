const fs = require('fs');
const path = require('path');

const directory = './client/src';
const searchRegex = /http:\/\/localhost:5000\/api/g;
const replacement = '`${API_URL}`';

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.match(searchRegex)) {
        console.log('Fixing:', fullPath);
        
        // Let's replace simple string literal requests
        content = content.replace(/'http:\/\/localhost:5000\/api/g, 'API_URL + \'');
        content = content.replace(/"http:\/\/localhost:5000\/api/g, 'API_URL + "');
        content = content.replace(/`http:\/\/localhost:5000\/api/g, '`${API_URL}');
        
        // Add import at the top if not present
        if (!content.includes('import { API_URL }')) {
             // Let's handle import path dynamically, 
             // but simpler to just use process.env right in the file for now to be safe.
             content = content.replace(/API_URL/g, "process.env.REACT_APP_API_URL || 'http://localhost:5000/api'");
        }
        
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  }
}

walk(directory);
