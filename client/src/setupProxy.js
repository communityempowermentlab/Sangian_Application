module.exports = function (app) {
    app.use((req, res, next) => {
        // No HSTS header to ensure local localhost over HTTP remains fully functional.
        
        // Local Content-Security-Policy (Allow local HMR websockets and dev assets)
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*; media-src 'self' data: blob:; frame-src 'none'; object-src 'none';"
        );
        
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        next();
    });
};
