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
const analyticsRoutes      = require('./src/routes/analyticsRoutes');
const crashAnalyticsRoutes = require('./src/routes/crashAnalyticsRoutes');
const crashLogRoutes       = require('./src/routes/crashLogRoutes');
const testingRoutes        = require('./src/routes/testingRoutes');
const screenshotRoutes     = require('./src/routes/screenshotRoutes');
const analysisRoutes       = require('./src/routes/analysisRoutes');
const { adminRouter: cmsAdminRoutes, publicRouter: cmsPublicRoutes } = require('./src/routes/cmsRoutes');
const { adminRouter: translationsAdminRoutes, publicRouter: translationsPublicRoutes } = require('./src/routes/translationsRoutes');
const { adminRouter: testConfigAdminRoutes, publicRouter: testConfigPublicRoutes } = require('./src/routes/testConfigRoutes');
const { adminRouter: headerConfigAdminRoutes, publicRouter: headerConfigPublicRoutes } = require('./src/routes/headerConfigRoutes');
const { adminRouter: responseMatchingAdminRoutes, publicRouter: responseMatchingPublicRoutes } = require('./src/routes/responseMatchingRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const ticketRoutes      = require('./src/routes/ticketRoutes');
const helpContentRoutes = require('./src/routes/helpContentRoutes');
const { adminRouter: elementsAdminRoutes, publicRouter: elementsPublicRoutes } = require('./src/routes/elementsRoutes');
const { adminRouter: elementPositionAdminRoutes, publicRouter: elementPositionPublicRoutes } = require('./src/routes/elementPositionRoutes');
const { adminRouter: ankganitV2AdminRoutes, publicRouter: ankganitV2PublicRoutes } = require('./src/routes/ankganitV2ConfigRoutes');
const numberRecallV2ConfigRoutes = require('./src/routes/numberRecallV2ConfigRoutes');

const helmet  = require('helmet');
const app = express();

// Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src":  ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                            "https://accounts.google.com",
                            "https://www.googletagmanager.com",
                            "https://www.google-analytics.com"],
            "style-src":   ["'self'", "'unsafe-inline'",
                            "https://fonts.googleapis.com",
                            "https://accounts.google.com"],
            "font-src":    ["'self'", "https://fonts.gstatic.com", "data:"],
            "img-src":     ["'self'", "data:", "blob:",
                            "https://www.google-analytics.com",
                            "https://www.googletagmanager.com",
                            "https://*.googleusercontent.com"],
            "connect-src": ["'self'",
                            "http://localhost:3002",
                            "https://sangian.celworld.org",
                            "https://sangianapi.celworld.org",
                            "https://accounts.google.com",
                            "https://oauth2.googleapis.com",
                            "https://analyticsdata.googleapis.com",
                            "https://www.google-analytics.com",
                            "https://www.googletagmanager.com",
                            "https://firebasecrashlytics.googleapis.com",
                            "https://firebase.googleapis.com"],
            "media-src":   ["'self'", "data:", "blob:"],
            "frame-src":   ["https://accounts.google.com", "https://www.google.com"],
            "object-src":  ["'none'"]
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

// Serve uploaded files publicly — override CORP header set by Helmet so that
// pages at localhost:3000 (or any frontend origin) can load these static assets.
const allowCrossOrigin = (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
};
app.use('/uploads',        allowCrossOrigin, express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/tickets', allowCrossOrigin, express.static(path.join(__dirname, 'uploads/tickets')));
app.use('/uploads/admin',   allowCrossOrigin, express.static(path.join(__dirname, 'uploads/admin')));
app.use('/dashboard_pdfs', allowCrossOrigin, express.static(path.join(__dirname, 'dashboard_pdfs')));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/children', childRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/analytics',       analyticsRoutes);
app.use('/api/crash-analytics', crashAnalyticsRoutes);
app.use('/api/errors',          crashLogRoutes);
app.use('/api/testing',         testingRoutes);
app.use('/api/screenshots',     screenshotRoutes);
app.use('/api/analysis',        analysisRoutes);
app.use('/api/cms',             cmsAdminRoutes);
app.use('/api/public/cms',      cmsPublicRoutes);
app.use('/api/admin/translations', translationsAdminRoutes);
app.use('/api/public/translations', translationsPublicRoutes);
app.use('/api/admin/test-config', testConfigAdminRoutes);
app.use('/api/public/test-config', testConfigPublicRoutes);
app.use('/api/admin/header-config', headerConfigAdminRoutes);
app.use('/api/public/header-config', headerConfigPublicRoutes);
app.use('/api/admin/response-matching-config', responseMatchingAdminRoutes);
app.use('/api/public/response-matching-config', responseMatchingPublicRoutes);
app.use('/api/contact',         contactRoutes);
app.use('/api/tickets',         ticketRoutes);
app.use('/api/help-content',    helpContentRoutes);
app.use('/api/admin/elements',  elementsAdminRoutes);
app.use('/api/public/elements', elementsPublicRoutes);
app.use('/api/admin/element-positions',  elementPositionAdminRoutes);
app.use('/api/public/element-positions', elementPositionPublicRoutes);
app.use('/api/admin/ankganit-v2', ankganitV2AdminRoutes);
app.use('/api/public/ankganit-v2', ankganitV2PublicRoutes);
app.use('/api', numberRecallV2ConfigRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.send('Sangian Backend API is running');
});

module.exports = app;
