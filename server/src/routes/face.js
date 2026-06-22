const express = require('express');
const { upload, verifyFace } = require('../controllers/faceController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/face/verify
// Accepts: id_photo (file) + selfie (file)
router.post(
  '/verify',
  authenticate,
  upload.fields([
    { name: 'id_photo', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  verifyFace
);

module.exports = router;
