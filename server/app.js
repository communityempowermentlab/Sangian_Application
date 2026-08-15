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
const { adminRouter: orgTypeAdminRoutes, publicRouter: orgTypePublicRoutes } = require('./src/routes/orgTypeRoutes');
const { adminRouter: responseMatchingAdminRoutes, publicRouter: responseMatchingPublicRoutes } = require('./src/routes/responseMatchingRoutes');
const { adminRouter: analysisSettingsAdminRoutes } = require('./src/routes/analysisSettingsRoutes');
const { adminRouter: testGroupsAdminRoutes } = require('./src/routes/testGroupsRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const ticketRoutes      = require('./src/routes/ticketRoutes');
const helpContentRoutes = require('./src/routes/helpContentRoutes');
const { adminRouter: elementsAdminRoutes, publicRouter: elementsPublicRoutes } = require('./src/routes/elementsRoutes');
const { adminRouter: elementPositionAdminRoutes, publicRouter: elementPositionPublicRoutes } = require('./src/routes/elementPositionRoutes');
const { adminRouter: ankganitV2AdminRoutes, publicRouter: ankganitV2PublicRoutes } = require('./src/routes/ankganitV2ConfigRoutes');
const { adminRouter: ankganitV3AdminRoutes, publicRouter: ankganitV3PublicRoutes } = require('./src/routes/ankganitV3ConfigRoutes');
const numberRecallV2ConfigRoutes = require('./src/routes/numberRecallV2ConfigRoutes');
const staffRoutes = require('./src/routes/staffRoutes');
const requireModuleAccess = require('./src/middleware/requireModuleAccess');
const otpRoutes = require('./src/routes/otpRoutes');
const individualAuthRoutes = require('./src/routes/individualAuthRoutes');
const orgAuthRoutes = require('./src/routes/orgAuthRoutes');
const assessorAuthRoutes = require('./src/routes/assessorAuthRoutes');

const helmet  = require('helmet');
const app = express();

// Trust the first hop (Apache's ProxyPass sits in front of this process in
// production — see /etc/apache2/sites-available/sangian-le-ssl.conf) so
// Express's own req.ip resolves from X-Forwarded-For instead of the proxy's
// loopback address. request-ip (used for session/activity IP capture)
// already reads X-Forwarded-For directly and doesn't depend on this, but a
// couple of other controllers use req.ip as a fallback — this makes that
// correct too, and costs nothing when there's no proxy (local dev).
app.set('trust proxy', true);

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
// staffRoutes gates each route internally (requireModuleAccess('staff') on
// the staff-management endpoints, plain adminAuth on the /me/* self-service
// ones) — not gated again here, since that would block a staff member from
// viewing their own profile if they don't hold the 'staff' menu grant.
app.use('/api/admin/staff', staffRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/docs', requireModuleAccess('docs'), docsRoutes);
app.use('/api/analytics',       analyticsRoutes);
app.use('/api/crash-analytics', crashAnalyticsRoutes);
app.use('/api/errors',          crashLogRoutes);
app.use('/api/testing',         testingRoutes);
app.use('/api/screenshots',     screenshotRoutes);
// Gated per-route inside analysisRoutes.js (requireAdminOrOrgAuth +
// resolveOrgScope) instead of here — requireModuleAccess's adminAuth call
// would reject an 'organization' JWT outright before it ever got a chance
// to authenticate as an org, same reasoning as children/dashboard/assessors.
app.use('/api/analysis',        analysisRoutes);
app.use('/api/cms',             cmsAdminRoutes);
app.use('/api/public/cms',      cmsPublicRoutes);
app.use('/api/admin/translations', requireModuleAccess('multilingual'), translationsAdminRoutes);
app.use('/api/public/translations', translationsPublicRoutes);
app.use('/api/admin/test-config', testConfigAdminRoutes);
app.use('/api/public/test-config', testConfigPublicRoutes);
app.use('/api/admin/header-config', headerConfigAdminRoutes);
app.use('/api/public/header-config', headerConfigPublicRoutes);
app.use('/api/admin/response-matching-config', responseMatchingAdminRoutes);
app.use('/api/public/response-matching-config', responseMatchingPublicRoutes);
app.use('/api/admin/analysis-settings', analysisSettingsAdminRoutes);
app.use('/api/admin/test-groups', testGroupsAdminRoutes);
app.use('/api/contact',         contactRoutes);
app.use('/api/tickets',         ticketRoutes);
app.use('/api/help-content',    helpContentRoutes);
app.use('/api/admin/elements',  requireModuleAccess('elements'), elementsAdminRoutes);
app.use('/api/public/elements', elementsPublicRoutes);
app.use('/api/admin/element-positions',  elementPositionAdminRoutes);
app.use('/api/public/element-positions', elementPositionPublicRoutes);
app.use('/api/admin/ankganit-v2', ankganitV2AdminRoutes);
app.use('/api/public/ankganit-v2', ankganitV2PublicRoutes);
app.use('/api/admin/ankganit-v3', ankganitV3AdminRoutes);
app.use('/api/public/ankganit-v3', ankganitV3PublicRoutes);
app.use('/api', numberRecallV2ConfigRoutes);
app.use('/api/otp',        otpRoutes);
app.use('/api/individual', individualAuthRoutes);
app.use('/api/org',        orgAuthRoutes);
app.use('/api/assessor',   assessorAuthRoutes);
app.use('/api/admin/org-types', orgTypeAdminRoutes);
app.use('/api/public/org-types', orgTypePublicRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.send('Sangian Backend API is running');
});

module.exports = app;
