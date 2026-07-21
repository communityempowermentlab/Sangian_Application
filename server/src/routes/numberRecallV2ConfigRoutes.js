const express = require('express');
const router = express.Router();
const { getQuestions, updateQuestion } = require('../controllers/numberRecallV2ConfigController');

// Admin Routes (Would normally have admin authentication middleware)
router.get('/admin/number-recall-v2/questions', getQuestions);
router.put('/admin/number-recall-v2/questions/:id', updateQuestion);

// Game Client Routes (Public / Authenticated users)
router.get('/games/number-recall-v2/questions', getQuestions);

module.exports = router;
