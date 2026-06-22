const express = require('express');
const { body } = require('express-validator');
const studentController = require('../controllers/student');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(authenticate, authorize('student'));

router.get('/applications', studentController.getApplications);
router.post('/applications', [
  body('programName').trim().notEmpty(),
  body('department').trim().notEmpty(),
  body('graduationYear').isInt({ min: 2000, max: 2030 }),
  body('cgpa').optional().isFloat({ min: 0, max: 4 })
], studentController.createApplication);
router.get('/applications/:id', studentController.getApplication);
router.post('/applications/:id/documents', upload.array('documents', 5), studentController.uploadDocuments);
router.patch('/applications/:id/withdraw', authenticate, studentController.withdrawApplication)
router.get('/degrees', studentController.getDegrees);

module.exports = router;