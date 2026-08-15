const express  = require('express');
const adminAuth = require('../middleware/adminAuth');
const ctrl     = require('../controllers/audioElementController');

// Admin Routes
const adminRouter = express.Router();
adminRouter.use(adminAuth);
adminRouter.get('/', ctrl.getAudioElements);
adminRouter.post('/', ctrl.addAudioElement);
adminRouter.put('/:id', ctrl.updateAudioElement);
adminRouter.delete('/:id', ctrl.deleteAudioElement);

// Public Routes
const publicRouter = express.Router();
publicRouter.get('/', ctrl.getAudioElementsPublic);

module.exports = {
  adminRouter,
  publicRouter
};
