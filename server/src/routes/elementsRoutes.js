const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const adminAuth = require('../middleware/adminAuth');
const ctrl     = require('../controllers/elementsController');

const ELEMENTS_DIR = path.join(__dirname, '../../uploads/elements');
if (!fs.existsSync(ELEMENTS_DIR)) fs.mkdirSync(ELEMENTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ELEMENTS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `element_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp3', '.mp4']; // Extensible
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('Invalid file type'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// Admin Routes
const adminRouter = express.Router();
adminRouter.use(adminAuth);
adminRouter.get('/', ctrl.getElements);
adminRouter.post('/upload', upload.single('file'), ctrl.uploadElement);
adminRouter.delete('/:id', ctrl.deleteElement);
adminRouter.put('/:id/status', ctrl.toggleElementStatus);

// Public Routes
const publicRouter = express.Router();
publicRouter.get('/', ctrl.getAllElementsPublic);

module.exports = {
  adminRouter,
  publicRouter
};
