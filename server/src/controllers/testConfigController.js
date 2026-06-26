const testConfigService = require('../services/testConfigService');

// @desc    Get the full test configuration list (name, category, status)
// @route   GET /api/admin/test-config
// @access  Private (admin)
const getList = (req, res) => {
    try {
        res.json({ tests: testConfigService.getList() });
    } catch (error) {
        console.error('getList error:', error);
        res.status(500).json({ message: 'Failed to load test configuration.' });
    }
};

// @desc    Enable/disable a single test
// @route   PUT /api/admin/test-config/:key
// @body    { enabled: boolean }
// @access  Private (admin)
const updateStatus = (req, res) => {
    try {
        const { key } = req.params;
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ message: 'enabled (boolean) is required.' });
        }
        testConfigService.setEnabled(key, enabled);
        res.json({ success: true });
    } catch (error) {
        console.error('updateStatus error:', error);
        res.status(400).json({ message: error.message || 'Failed to update test configuration.' });
    }
};

// @desc    Get the enabled/disabled map for all games (consumed by the front-end)
// @route   GET /api/public/test-config
// @access  Public
const getPublicEnabledMap = (req, res) => {
    try {
        res.json(testConfigService.getEnabledMap());
    } catch (error) {
        console.error('getPublicEnabledMap error:', error);
        res.status(500).json({ message: 'Failed to load test configuration.' });
    }
};

// @desc    Update the display order of tests
// @route   PUT /api/admin/test-config/order
// @body    { orderedKeys: [string] }
// @access  Private (admin)
const updateOrder = (req, res) => {
    try {
        const { orderedKeys } = req.body;
        if (!Array.isArray(orderedKeys)) {
            return res.status(400).json({ message: 'orderedKeys array is required.' });
        }
        testConfigService.setOrder(orderedKeys);
        res.json({ success: true });
    } catch (error) {
        console.error('updateOrder error:', error);
        res.status(400).json({ message: error.message || 'Failed to update test order.' });
    }
};

module.exports = { getList, updateStatus, getPublicEnabledMap, updateOrder };
