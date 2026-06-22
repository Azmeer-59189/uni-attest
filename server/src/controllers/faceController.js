const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const User = require('../models/User');

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://127.0.0.1:5001';

// Multer for temp storage
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are supported'), false);
  },
});

const verifyFace = async (req, res) => {
  const idPhotoPath = req.files?.id_photo?.[0]?.path;
  const selfiePath = req.files?.selfie?.[0]?.path;

  try {
    if (!idPhotoPath || !selfiePath) {
      return res.status(400).json({ error: 'Both id_photo and selfie are required' });
    }

    // Forward both images to Python microservice
    const form = new FormData();
    form.append('id_photo', fs.createReadStream(idPhotoPath), {
      filename: req.files.id_photo[0].originalname || 'id_photo.jpg',
      contentType: req.files.id_photo[0].mimetype,
    });
    form.append('selfie', fs.createReadStream(selfiePath), {
      filename: req.files.selfie[0].originalname || 'selfie.jpg',
      contentType: req.files.selfie[0].mimetype,
    });

    const response = await axios.post(`${FACE_SERVICE_URL}/verify-face`, form, {
      headers: form.getHeaders(),
      timeout: 60000, // 60 seconds — DeepFace can be slow on first run
    });

    const result = response.data;

    // If matched, save selfie to uploads and update user's photoUrl
    if (result.match) {
      const uploadsDir = path.join(__dirname, '../../uploads/photos');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      const photoFilename = `photo_${req.user._id}_${Date.now()}.jpg`;
      const photoDestPath = path.join(uploadsDir, photoFilename);
      fs.copyFileSync(selfiePath, photoDestPath);

      await User.findByIdAndUpdate(req.user._id, {
        photoUrl: `/uploads/photos/${photoFilename}`,
      });

      result.photoUrl = `/uploads/photos/${photoFilename}`;
    }

    res.json(result);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Face verification service is not running. Please contact support.',
      });
    }
    console.error('Face verification error:', err.message);
    res.status(500).json({ error: 'Face verification failed', details: err.message });
  } finally {
    // Clean up temp files
    [idPhotoPath, selfiePath].forEach((p) => {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    });
  }
};

module.exports = { upload, verifyFace };
