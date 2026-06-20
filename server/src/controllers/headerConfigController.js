const headerConfigService = require('../services/headerConfigService');

// @desc    Get the global test header configuration
// @route   GET /api/admin/header-config
// @access  Private (admin)
const getConfig = (req, res) => {
    try {
        res.json(headerConfigService.getConfig());
    } catch (error) {
        console.error('getConfig error:', error);
        res.status(500).json({ message: 'Failed to load header configuration.' });
    }
};

// @desc    Update the global test header configuration (partial updates allowed)
// @route   PUT /api/admin/header-config
// @body    { showChildId?, showTimer?, showScore? }
// @access  Private (admin)
const updateConfig = (req, res) => {
    try {
        const { showChildId, showTimer, showScore } = req.body;
        const current = headerConfigService.getConfig();
        const next = {
            showChildId: showChildId !== undefined ? Boolean(showChildId) : current.showChildId,
            showTimer:   showTimer   !== undefined ? Boolean(showTimer)   : current.showTimer,
            showScore:   showScore   !== undefined ? Boolean(showScore)   : current.showScore,
        };
        const saved = headerConfigService.saveConfig(next);
        res.json({ success: true, config: saved });
    } catch (error) {
        console.error('updateConfig error:', error);
        res.status(500).json({ message: 'Failed to save header configuration.' });
    }
};

// @desc    Get the global test header configuration (consumed by the front-end)
// @route   GET /api/public/header-config
// @access  Public
const getPublicConfig = (req, res) => {
    try {
        res.json(headerConfigService.getConfig());
    } catch (error) {
        console.error('getPublicConfig error:', error);
        res.status(500).json({ message: 'Failed to load header configuration.' });
    }
};

module.exports = { getConfig, updateConfig, getPublicConfig };
