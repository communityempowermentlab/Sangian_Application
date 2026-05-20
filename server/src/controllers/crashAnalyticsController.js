/**
 * crashAnalyticsController
 *
 * Proxies Firebase Crashlytics REST API calls using a service account.
 * Required env var: FIREBASE_SERVICE_ACCOUNT_KEY (JSON-stringified service account key)
 *
 * The service account must have the role: roles/firebase.viewer (or higher)
 * in the Firebase/Google Cloud project.
 */

const crypto = require('crypto');
const axios  = require('axios');

const CRASHLYTICS_BASE  = 'https://firebasecrashlytics.googleapis.com/v1beta1';
const FIREBASE_MGMT_BASE = 'https://firebase.googleapis.com/v1beta1';
const TOKEN_URL         = 'https://oauth2.googleapis.com/token';
const SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase',
].join(' ');

// ─── Service-account JWT → access token ──────────────────────────────────────

let _cachedToken = null;
let _tokenExpiry = 0;

const getAccessToken = async () => {
    if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');

    const sa  = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);

    const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        iss: sa.client_email,
        sub: sa.client_email,
        scope: SCOPES,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
    })).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(sa.private_key, 'base64url');

    const { data } = await axios.post(
        TOKEN_URL,
        new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion:  `${header}.${payload}.${sig}`,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    _cachedToken = data.access_token;
    _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return _cachedToken;
};

const authHeader = async () => ({ Authorization: `Bearer ${await getAccessToken()}` });

// ─── Helper ───────────────────────────────────────────────────────────────────

const handleErr = (res, err) => {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.error?.message || err.message;
    res.status(status).json({ error: message });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

// GET /api/crash-analytics/status
const getStatus = (req, res) => {
    const configured = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    res.json({ configured });
};

// GET /api/crash-analytics/apps?projectId=xxx
const getApps = async (req, res) => {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    try {
        const headers = await authHeader();

        // Fetch Android, iOS, and Web apps in parallel
        const [android, ios, web] = await Promise.allSettled([
            axios.get(`${FIREBASE_MGMT_BASE}/projects/${projectId}/androidApps`, { headers }),
            axios.get(`${FIREBASE_MGMT_BASE}/projects/${projectId}/iosApps`,     { headers }),
            axios.get(`${FIREBASE_MGMT_BASE}/projects/${projectId}/webApps`,     { headers }),
        ]);

        const apps = [
            ...(android.status === 'fulfilled' ? (android.value.data.apps || []).map(a => ({ ...a, platform: 'Android' })) : []),
            ...(ios.status     === 'fulfilled' ? (ios.value.data.apps     || []).map(a => ({ ...a, platform: 'iOS'     })) : []),
            ...(web.status     === 'fulfilled' ? (web.value.data.apps     || []).map(a => ({ ...a, platform: 'Web'     })) : []),
        ];

        res.json({ apps });
    } catch (err) { handleErr(res, err); }
};

// GET /api/crash-analytics/summary?projectId=xxx&appId=xxx
const getSummary = async (req, res) => {
    const { projectId, appId } = req.query;
    if (!projectId || !appId) return res.status(400).json({ error: 'projectId and appId are required' });

    try {
        const headers = await authHeader();

        // Fetch open error groups (first page, ordered by crash count)
        const { data } = await axios.get(
            `${CRASHLYTICS_BASE}/projects/${projectId}/apps/${appId}/errorGroups`,
            {
                headers,
                params: {
                    pageSize: 100,
                    'errorGroupOrder.direction': 'DESC',
                    'errorGroupOrder.orderBy': 'CRASH_COUNT',
                },
            }
        );

        const groups = data.errorGroups || [];
        const open   = groups.filter(g => g.state !== 'CLOSED');
        const fatal  = groups.filter(g => g.errorGroup?.exception?.type === 'FATAL' || g.subtitle?.toLowerCase().includes('fatal'));

        const totalCrashes    = groups.reduce((s, g) => s + (Number(g.crashCount) || 0), 0);
        const affectedUsers   = groups.reduce((s, g) => s + (Number(g.affectedUsers) || 0), 0);
        const activeCrashes   = open.length;
        const fatalErrors     = fatal.reduce((s, g) => s + (Number(g.crashCount) || 0), 0);
        const nonFatalErrors  = totalCrashes - fatalErrors;

        // Crash-free users estimate: not available directly from REST API
        // We report affected users as a proxy
        res.json({
            summary: {
                totalCrashes,
                activeCrashes,
                fatalErrors,
                nonFatalErrors,
                affectedUsers,
                totalGroups: groups.length,
            },
        });
    } catch (err) { handleErr(res, err); }
};

// GET /api/crash-analytics/crashes?projectId=xxx&appId=xxx&pageSize=25&pageToken=xxx&state=OPEN
const getCrashes = async (req, res) => {
    const { projectId, appId, pageSize = 25, pageToken, state } = req.query;
    if (!projectId || !appId) return res.status(400).json({ error: 'projectId and appId are required' });

    try {
        const headers = await authHeader();
        const params  = {
            pageSize,
            'errorGroupOrder.direction': 'DESC',
            'errorGroupOrder.orderBy': 'LAST_SEEN',
        };
        if (pageToken) params.pageToken = pageToken;
        if (state)     params.state     = state;

        const { data } = await axios.get(
            `${CRASHLYTICS_BASE}/projects/${projectId}/apps/${appId}/errorGroups`,
            { headers, params }
        );

        res.json({
            crashes:       data.errorGroups || [],
            nextPageToken: data.nextPageToken || null,
        });
    } catch (err) { handleErr(res, err); }
};

// GET /api/crash-analytics/crashes/:groupId/events?projectId=xxx&appId=xxx&pageSize=10
const getCrashEvents = async (req, res) => {
    const { groupId } = req.params;
    const { projectId, appId, pageSize = 10 } = req.query;
    if (!projectId || !appId) return res.status(400).json({ error: 'projectId and appId are required' });

    try {
        const headers = await authHeader();
        const { data } = await axios.get(
            `${CRASHLYTICS_BASE}/projects/${projectId}/apps/${appId}/errorGroups/${groupId}/errorEvents`,
            { headers, params: { pageSize } }
        );

        res.json({
            events:        data.errorEvents || [],
            nextPageToken: data.nextPageToken || null,
        });
    } catch (err) { handleErr(res, err); }
};

module.exports = { getStatus, getApps, getSummary, getCrashes, getCrashEvents };
