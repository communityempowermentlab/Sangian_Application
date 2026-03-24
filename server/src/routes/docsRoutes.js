const express = require('express');
const router = express.Router();
const docsController = require('../controllers/docsController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get current document for a game
router.get('/:gameKey', docsController.getDoc);

// Save (create or update) a document
router.put('/:gameKey', docsController.saveDoc);

// Get version history list for a game
router.get('/:gameKey/versions', docsController.getVersions);

// Get a specific historical version
router.get('/version/:versionId', docsController.getVersion);

module.exports = router;
