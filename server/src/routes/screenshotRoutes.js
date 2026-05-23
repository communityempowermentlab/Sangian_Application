const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const adminAuth = require('../middleware/adminAuth');
const ctrl     = require('../controllers/screenshotController');

const SCREENSHOT_DIR = path.join(__dirname, '../../uploads/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SCREENSHOT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `ss_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/',              adminAuth, ctrl.getScreenshots);
router.post('/upload',       adminAuth, upload.single('image'), ctrl.uploadScreenshot);
router.put('/reorder',       adminAuth, ctrl.reorderScreenshots);
router.put('/:id',           adminAuth, upload.single('image'), ctrl.updateScreenshot);
router.delete('/:id',        adminAuth, ctrl.deleteScreenshot);
router.post('/publish',      adminAuth, ctrl.publishManual);
router.get('/manual-status', adminAuth, ctrl.getManualStatus);

module.exports = router;
