const express = require('express');
const { body } = require('express-validator');
const studentController = require('../controllers/student');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(authenticate, authorize('student'));

router.get('/applications', studentController.getApplications);
const applicationValidation = [
  body('programName').isString().trim().notEmpty().isLength({ max: 150 }).withMessage('Enter a program name up to 150 characters.'),
  body('department').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Enter a department up to 100 characters.'),
  body('graduationYear').isInt({ min: 2000, max: 2030 }),
  body('cgpa').if(value => value !== '' && value != null).isFloat({ min: 0, max: 4 }).withMessage('CGPA must be between 0 and 4.')
];
router.post('/applications', applicationValidation, studentController.createApplication);
router.patch('/applications/:id', applicationValidation, studentController.updateApplication);
router.post('/applications/:id/submit', studentController.submitApplication);
router.get('/applications/:id', studentController.getApplication);
router.post('/applications/:id/documents', upload.array('documents', 5), studentController.uploadDocuments);
router.delete('/applications/:id/documents/:documentId', studentController.removeDocument);
router.put('/applications/:id/documents/:documentId', upload.single('document'), studentController.replaceDocument);
router.patch('/applications/:id/withdraw', authenticate, studentController.withdrawApplication)
router.get('/degrees', studentController.getDegrees);

module.exports = router;
