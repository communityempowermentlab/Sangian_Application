const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { getReport, getTopPages, getRealtime } = require('../controllers/analyticsController');

router.post('/report',     adminAuth, getReport);
router.post('/top-pages',  adminAuth, getTopPages);
router.post('/realtime',   adminAuth, getRealtime);

module.exports = router;
