const scoreBinSettings = require('../services/scoreBinSettingsService');
const testConfigService = require('../services/testConfigService');
const { GAME_META, buildBucketDefs } = require('./analysisController');

const bucketLabels = (gameKey, maxScore, useSetting) =>
    buildBucketDefs(gameKey, maxScore, useSetting).map(b => b.label);

const describeGame = (gameKey, enabledKeys) => {
    const meta = GAME_META[gameKey];
    const setting = scoreBinSettings.getGameSetting(gameKey);
    return {
        key: gameKey,
        title: meta.title,
        maxScore: meta.maxScore,
        enabled: enabledKeys.has(gameKey),
        binWidth: setting ? setting.binWidth : null,
        separateZero: setting ? setting.separateZero : false,
        defaultBins: bucketLabels(gameKey, meta.maxScore, false),
        currentBins: bucketLabels(gameKey, meta.maxScore, true),
    };
};

// @desc    Get every configurable game's Score Distribution bin settings
// @route   GET /api/admin/score-bin-settings
// @access  Private (admin)
const getConfig = (req, res) => {
    try {
        const enabledKeys = new Set(testConfigService.getList().filter(t => t.enabled).map(t => t.key));
        const games = scoreBinSettings.CONFIGURABLE_GAMES
            .filter(key => GAME_META[key])
            .map(key => describeGame(key, enabledKeys));
        res.json({ maxBins: scoreBinSettings.MAX_BINS, games });
    } catch (error) {
        console.error('getConfig error:', error);
        res.status(500).json({ message: 'Failed to load score distribution settings.' });
    }
};

// @desc    Set (or reset) one game's Score Distribution bin width
// @route   PUT /api/admin/score-bin-settings/:gameKey
// @body    { binWidth: integer | null, separateZero?: boolean } — binWidth null resets to the default bins
// @access  Private (admin)
const updateGame = (req, res) => {
    try {
        const { gameKey } = req.params;
        const meta = GAME_META[gameKey];
        if (!scoreBinSettings.CONFIGURABLE_GAMES.includes(gameKey) || !meta) {
            return res.status(400).json({ message: 'Bin width is not configurable for this test.' });
        }

        const { binWidth, separateZero } = req.body;
        if (binWidth === null || binWidth === undefined || binWidth === '') {
            scoreBinSettings.resetGameSetting(gameKey);
        } else {
            const width = Number(binWidth);
            if (!Number.isInteger(width) || width < 1 || width > meta.maxScore) {
                return res.status(400).json({ message: `Bin width must be a whole number from 1 to ${meta.maxScore}.` });
            }
            const binCount = scoreBinSettings.buildWidthBuckets(meta.maxScore, width, !!separateZero).length;
            if (binCount > scoreBinSettings.MAX_BINS) {
                return res.status(400).json({ message: `This width gives ${binCount} bars — the limit is ${scoreBinSettings.MAX_BINS}. Use a larger width.` });
            }
            scoreBinSettings.setGameSetting(gameKey, { binWidth: width, separateZero });
        }

        const enabledKeys = new Set(testConfigService.getList().filter(t => t.enabled).map(t => t.key));
        res.json({ success: true, game: describeGame(gameKey, enabledKeys) });
    } catch (error) {
        console.error('updateGame error:', error);
        res.status(500).json({ message: 'Failed to save score distribution settings.' });
    }
};

module.exports = { getConfig, updateGame };
