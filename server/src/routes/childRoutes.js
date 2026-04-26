const express    = require('express');
const router     = express.Router();
const { registerChild, lookupChild } = require('../controllers/childController');
const { upload } = require('../middleware/upload');

// Photo is optional on public registration
router.post('/register', upload.single('photo'), registerChild);
router.get('/lookup/:childId', lookupChild);

module.exports = router;
