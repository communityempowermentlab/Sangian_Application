const elementPositionService = require('../services/elementPositionService');

// @desc    Get all response-screen layouts for one game
// @route   GET /api/admin/element-positions/:gameKey
// @access  Private (admin)
const getAll = (req, res) => {
    try {
        res.json(elementPositionService.getLayouts(req.params.gameKey));
    } catch (error) {
        console.error('getAll element positions error:', error);
        res.status(500).json({ message: 'Failed to load element positions.' });
    }
};

// @desc    Save the layout (item positions) for one response screen
// @route   PUT /api/admin/element-positions/:gameKey/:screenNum
// @body    { positions: [{ leftPct, topPct, sizePct }, ...] }
// @access  Private (admin)
const updateScreen = (req, res) => {
    try {
        const { positions } = req.body;
        if (!Array.isArray(positions)) {
            return res.status(400).json({ message: 'positions must be an array.' });
        }
        const saved = elementPositionService.saveLayout(req.params.gameKey, req.params.screenNum, positions);
        res.json({ success: true, positions: saved });
    } catch (error) {
        console.error('updateScreen element positions error:', error);
        res.status(500).json({ message: 'Failed to save element positions.' });
    }
};

// @desc    Reset one response screen's layout back to its default
// @route   POST /api/admin/element-positions/:gameKey/:screenNum/reset
// @access  Private (admin)
const resetScreen = (req, res) => {
    try {
        const positions = elementPositionService.resetLayout(req.params.gameKey, req.params.screenNum);
        res.json({ success: true, positions });
    } catch (error) {
        console.error('resetScreen element positions error:', error);
        res.status(500).json({ message: 'Failed to reset element positions.' });
    }
};

// @desc    Get all response-screen layouts for one game (consumed by the game client)
// @route   GET /api/public/element-positions/:gameKey
// @access  Public
const getPublicAll = (req, res) => {
    try {
        res.json(elementPositionService.getLayouts(req.params.gameKey));
    } catch (error) {
        console.error('getPublicAll element positions error:', error);
        res.status(500).json({ message: 'Failed to load element positions.' });
    }
};

module.exports = { getAll, updateScreen, resetScreen, getPublicAll };
