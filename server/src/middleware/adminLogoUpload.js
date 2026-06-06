const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const LOGO_DIR = path.join(__dirname, '../../uploads/admin');

if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, LOGO_DIR),
    filename:    (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `logo_${Date.now()}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only JPG, PNG, and WebP images are allowed.'), false);
};

const adminLogoUpload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter });

module.exports = { adminLogoUpload };
