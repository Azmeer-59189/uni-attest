const express = require('express');
const multer = require('multer');
const os = require('os');
const { extractDocument } = require('../controllers/ocrController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP, and PDF files are supported'), false);
    }
  },
});

router.post('/extract', authenticate, upload.single('document'), extractDocument);

module.exports = router;