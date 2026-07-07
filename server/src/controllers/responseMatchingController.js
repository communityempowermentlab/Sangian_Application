const responseMatchingService = require('../services/responseMatchingService');

// @desc    Get the global response matching configuration
// @route   GET /api/admin/response-matching-config
// @access  Private (admin)
const getConfig = (req, res) => {
    try {
        res.json(responseMatchingService.getConfig());
    } catch (error) {
        console.error('getConfig error:', error);
        res.status(500).json({ message: 'Failed to load response matching configuration.' });
    }
};

// @desc    Update the global response matching configuration
// @route   PUT /api/admin/response-matching-config
// @body    { responseMatchingMode: 'exact' | 'partial' }
// @access  Private (admin)
const updateConfig = (req, res) => {
    try {
        const { responseMatchingMode, displayUserInputString } = req.body;
        if (responseMatchingMode !== undefined && !responseMatchingService.VALID_MODES.includes(responseMatchingMode)) {
            return res.status(400).json({ message: `responseMatchingMode must be one of: ${responseMatchingService.VALID_MODES.join(', ')}` });
        }
        const current = responseMatchingService.getConfig();
        const next = {
            responseMatchingMode: responseMatchingMode !== undefined ? responseMatchingMode : current.responseMatchingMode,
            displayUserInputString: displayUserInputString !== undefined ? displayUserInputString : current.displayUserInputString,
        };
        const saved = responseMatchingService.saveConfig(next);
        res.json({ success: true, config: saved });
    } catch (error) {
        console.error('updateConfig error:', error);
        res.status(500).json({ message: 'Failed to save response matching configuration.' });
    }
};

// @desc    Get the global response matching configuration (consumed by the front-end)
// @route   GET /api/public/response-matching-config
// @access  Public
const getPublicConfig = (req, res) => {
    try {
        res.json(responseMatchingService.getConfig());
    } catch (error) {
        console.error('getPublicConfig error:', error);
        res.status(500).json({ message: 'Failed to load response matching configuration.' });
    }
};

module.exports = { getConfig, updateConfig, getPublicConfig };
