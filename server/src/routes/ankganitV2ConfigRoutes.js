const express = require('express');
const adminRouter = express.Router();
const publicRouter = express.Router();

const { getFullConfig, updateCategory, updateQuestion } = require('../controllers/ankganitV2ConfigController');
const adminAuth = require('../middleware/adminAuth');

adminRouter.get('/', adminAuth, getFullConfig);
adminRouter.put('/categories/:id', adminAuth, updateCategory);
adminRouter.put('/questions/:id', adminAuth, updateQuestion);

publicRouter.get('/', getFullConfig);

module.exports = { adminRouter, publicRouter };
