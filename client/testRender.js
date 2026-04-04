const fs = require('fs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react']
});

try {
  // Mock contexts and router
  const { MemoryRouter } = require('react-router-dom');
  
  // mock window and speech
  global.window = { SpeechRecognition: null };
  
  const AuditoryAttentionGame = require('./src/pages/AuditoryAttentionGame.jsx').default;
  
  const html = ReactDOMServer.renderToString(
    React.createElement(MemoryRouter, null, 
      React.createElement(AuditoryAttentionGame)
    )
  );
  console.log("RENDER_SUCCESS", html.substring(0, 50));
} catch(e) {
  console.log("RENDER_ERROR: " + e.message);
}
