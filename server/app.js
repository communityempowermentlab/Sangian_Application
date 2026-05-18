const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();
const userRoutes = require('./src/routes/userRoutes');
const childRoutes = require('./src/routes/childRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const gameRoutes = require('./src/routes/gameRoutes');
const docsRoutes = require('./src/routes/docsRoutes');

const helmet  = require('helmet');
const app = express();

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
            "img-src": ["'self'", "data:", "blob:"],
            "connect-src": ["'self'", "http://localhost:3002", "https://sangian.celworld.org", "https://sangianapi.celworld.org"],
            "media-src": ["'self'", "data:", "blob:"],
            "frame-src": ["'none'"],
            "object-src": ["'none'"]
        }
    },
    xContentTypeOptions: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Dynamically enable/disable HSTS based on environment
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
        // Only enable HSTS if not on localhost
        skip: (req) => {
            const host = req.headers.host || '';
            return host.includes('localhost') || host.includes('127.0.0.1');
        }
    }
}));

// Permissions-Policy Header Configuration
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded child photos publicly
// __dirname = server/  →  uploads lives at server/uploads/
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/dashboard_pdfs', express.static(path.join(__dirname, 'dashboard_pdfs')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/children', childRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/docs', docsRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.send('Sangian Backend API is running');
});

module.exports = app;
