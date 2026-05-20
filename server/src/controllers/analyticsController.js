const axios = require('axios');

const GA4_BASE = 'https://analyticsdata.googleapis.com/v1beta';

// POST /api/analytics/report
// Body: { accessToken, propertyId, startDate, endDate }
const getReport = async (req, res) => {
    const { accessToken, propertyId, startDate = '30daysAgo', endDate = 'today' } = req.body;

    if (!accessToken || !propertyId) {
        return res.status(400).json({ error: 'accessToken and propertyId are required' });
    }

    try {
        const response = await axios.post(
            `${GA4_BASE}/properties/${propertyId}:runReport`,
            {
                dateRanges: [{ startDate, endDate }],
                metrics: [
                    { name: 'totalUsers' },
                    { name: 'sessions' },
                    { name: 'newUsers' },
                    { name: 'screenPageViews' },
                    { name: 'bounceRate' },
                    { name: 'averageSessionDuration' },
                ],
            },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        res.json({ data: response.data });
    } catch (err) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.error?.message || err.message;
        res.status(status).json({ error: message });
    }
};

// POST /api/analytics/top-pages
// Body: { accessToken, propertyId, startDate, endDate }
const getTopPages = async (req, res) => {
    const { accessToken, propertyId, startDate = '30daysAgo', endDate = 'today' } = req.body;

    if (!accessToken || !propertyId) {
        return res.status(400).json({ error: 'accessToken and propertyId are required' });
    }

    try {
        const response = await axios.post(
            `${GA4_BASE}/properties/${propertyId}:runReport`,
            {
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
                metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
                orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
                limit: 10,
            },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        res.json({ data: response.data });
    } catch (err) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.error?.message || err.message;
        res.status(status).json({ error: message });
    }
};

// POST /api/analytics/realtime
// Body: { accessToken, propertyId }
const getRealtime = async (req, res) => {
    const { accessToken, propertyId } = req.body;

    if (!accessToken || !propertyId) {
        return res.status(400).json({ error: 'accessToken and propertyId are required' });
    }

    try {
        const response = await axios.post(
            `${GA4_BASE}/properties/${propertyId}:runRealtimeReport`,
            {
                metrics: [{ name: 'activeUsers' }],
            },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const rows = response.data.rows || [];
        const activeUsers = rows.length > 0 ? rows[0].metricValues[0].value : '0';

        res.json({ activeUsers });
    } catch (err) {
        const status = err.response?.status || 500;
        const message = err.response?.data?.error?.message || err.message;
        res.status(status).json({ error: message });
    }
};

module.exports = { getReport, getTopPages, getRealtime };
