import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initErrorTracker } from './services/errorTracker';

// Start global error capture before anything else renders
initErrorTracker();

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
