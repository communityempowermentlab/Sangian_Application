const analysisSettingsService = require('../services/analysisSettingsService');

// @desc    Get the Analysis dashboard's feature-toggle settings
// @route   GET /api/admin/analysis-settings
// @access  Private (admin)
const getConfig = (req, res) => {
    try {
        res.json(analysisSettingsService.getConfig());
    } catch (error) {
        console.error('getConfig error:', error);
        res.status(500).json({ message: 'Failed to load analysis settings.' });
    }
};

// @desc    Update the Analysis dashboard's feature-toggle settings (partial updates allowed)
// @route   PUT /api/admin/analysis-settings
// @body    { topChildrenExcelExport? }
// @access  Private (admin)
const updateConfig = (req, res) => {
    try {
        const { topChildrenExcelExport } = req.body;
        const current = analysisSettingsService.getConfig();
        const next = {
            topChildrenExcelExport: topChildrenExcelExport !== undefined ? Boolean(topChildrenExcelExport) : current.topChildrenExcelExport,
        };
        const saved = analysisSettingsService.saveConfig(next);
        res.json({ success: true, config: saved });
    } catch (error) {
        console.error('updateConfig error:', error);
        res.status(500).json({ message: 'Failed to save analysis settings.' });
    }
};

module.exports = { getConfig, updateConfig };
