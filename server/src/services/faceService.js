const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const FACE_SERVICE_URL = () => process.env.FACE_SERVICE_URL || 'http://127.0.0.1:5001';
const failure = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// Compares the portrait on an identity document with a photograph, using the Python face service.
exports.compare = async (identity, photograph) => {
  const form = new FormData();
  form.append('id_photo', fs.createReadStream(identity.path), { filename: identity.name || 'id.jpg', contentType: identity.type });
  form.append('selfie', fs.createReadStream(photograph.path), { filename: photograph.name || 'photo.jpg', contentType: photograph.type });
  try {
    const { data } = await axios.post(`${FACE_SERVICE_URL()}/verify-face`, form, { headers: form.getHeaders(), timeout: 90000 });
    return { match: Boolean(data.match), confidence: data.confidence, distance: data.distance, threshold: data.threshold };
  } catch (error) {
    if (error.code === 'ECONNREFUSED') throw failure(503, 'The face comparison service is not running. Start it with: python face_service.py');
    // The service rejected the images (no face, several faces, too dark): report its reason.
    if (error.response && error.response.status < 500) return { match: false, error: error.response.data?.error || 'These images could not be compared.' };
    throw failure(502, 'Face comparison failed. Try again.');
  }
};
