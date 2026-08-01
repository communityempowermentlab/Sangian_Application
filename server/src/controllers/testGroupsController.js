const testGroupsService = require('../services/testGroupsService');

// @desc    List all Test Groups (named presets of game keys)
// @route   GET /api/admin/test-groups
const getList = (req, res) => {
    try {
        res.json({ groups: testGroupsService.getList() });
    } catch (error) {
        console.error('Test groups getList error:', error);
        res.status(500).json({ message: 'Failed to load test groups.' });
    }
};

// @desc    Create a Test Group
// @route   POST /api/admin/test-groups
// @body    { name, gameKeys: [] }
const createGroup = (req, res) => {
    try {
        const group = testGroupsService.createGroup(req.body);
        res.status(201).json({ success: true, group });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Failed to create test group.' });
    }
};

// @desc    Update a Test Group's name and/or test list
// @route   PUT /api/admin/test-groups/:id
// @body    { name?, gameKeys? }
const updateGroup = (req, res) => {
    try {
        const group = testGroupsService.updateGroup(req.params.id, req.body);
        res.json({ success: true, group });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Failed to update test group.' });
    }
};

// @desc    Delete a Test Group
// @route   DELETE /api/admin/test-groups/:id
const deleteGroup = (req, res) => {
    try {
        testGroupsService.deleteGroup(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Failed to delete test group.' });
    }
};

module.exports = { getList, createGroup, updateGroup, deleteGroup };
