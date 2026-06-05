const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const TICKET_UPLOAD_DIR = path.join(__dirname, '../../uploads/tickets');

if (!fs.existsSync(TICKET_UPLOAD_DIR)) {
    fs.mkdirSync(TICKET_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TICKET_UPLOAD_DIR),
    filename:    (_req, file, cb) => {
        const ext       = path.extname(file.originalname).toLowerCase();
        const timestamp = Date.now();
        const random    = Math.random().toString(36).slice(2, 9);
        cb(null, `ticket_${timestamp}_${random}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPG, PNG, and WebP images are allowed.'), false);
    }
};

const ticketUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
    fileFilter,
});

module.exports = { ticketUpload, TICKET_UPLOAD_DIR };
