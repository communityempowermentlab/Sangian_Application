const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminChildController = require('../controllers/adminChildController');

router.post('/login', adminController.loginAdmin);
router.post('/logout/:sessionId', adminController.logoutAdmin);

// Admin Children Management Routes
router.get('/children', adminChildController.getAllChildren);
router.post('/children', adminChildController.addChild);
router.get('/children/:childId', adminChildController.getChildById);
router.put('/children/:childId', adminChildController.updateChild);
router.put('/children/:childId/status', adminChildController.toggleStatus);

module.exports = router;
