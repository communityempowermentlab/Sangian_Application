// Force the API URL to production if we are not running on localhost.
// This guarantees the live React build will never send requests to localhost:5000.
// We keep localhost as a fallback ONLY if the browser is currently looking at localhost.

const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

const API_URL = isLocalhost
    ? 'http://localhost:5000/api'
    : 'https://sangianapi.celworld.org/api';

export { API_URL };
export default API_URL;