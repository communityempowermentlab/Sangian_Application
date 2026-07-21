const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    // Proxy /uploads and /dashboard_pdfs to the Express backend so images and
    // PDFs load from the same origin as the React dev server (localhost:3000),
    // avoiding Cross-Origin-Resource-Policy and CSP issues in development.
    const backendProxy = createProxyMiddleware({
        target: 'http://localhost:5000',
        changeOrigin: true,
    });
    app.use('/uploads',        backendProxy);
    app.use('/dashboard_pdfs', backendProxy);

    app.use((req, res, next) => {
        // No HSTS header to ensure local localhost over HTTP remains fully functional.

        // Local Content-Security-Policy (Allow local HMR websockets and dev assets)
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: http://localhost:*; connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:* https://accounts.google.com; media-src 'self' data: blob: http://localhost:*; frame-src https://www.google.com https://accounts.google.com; object-src 'none';"
        );

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        next();
    });
};
