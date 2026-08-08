const UAParser = require('ua-parser-js');

// Shared by adminController's login capture and logStaffActivity, so both
// derive browser/OS/device the same way instead of two copies drifting.
function parseUserAgent(userAgent) {
    const parser = new UAParser(userAgent);
    return {
        browser: parser.getBrowser().name || 'Unknown',
        os: parser.getOS().name || 'Unknown',
        deviceType: parser.getDevice().type || 'Desktop',
    };
}

// request-ip's getClientIp already reads X-Forwarded-For (and similar
// proxy headers) before falling back to the raw socket address, so behind
// Apache's ProxyPass (which adds X-Forwarded-For by default) the real
// client IP is already captured correctly in production — verified against
// live admin_login_sessions data. This only cleans up the two forms that
// show up for genuinely-local requests (direct localhost testing, no
// proxy in front): the IPv6 loopback literal, and an IPv4 address
// double-wrapped in its IPv6-mapped form. Same normalization
// adminChildController.js already applies to its own IP capture.
function normalizeIp(ip) {
    if (!ip) return ip;
    if (ip === '::1') return '127.0.0.1';
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
}

module.exports = { parseUserAgent, normalizeIp };
