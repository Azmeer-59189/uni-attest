const express = require('express');
const { body } = require('express-validator');
const studentController = require('../controllers/student');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { REQUEST_TYPES, PROCESSING } = require('../services/workflow');

const router = express.Router();

router.use(authenticate, authorize('student'));

const optional = field => body(field).if(value => value !== '' && value != null);
const text = (field, max, label) => optional(field).isString().trim().isLength({ min: 1, max }).withMessage(`${label} must be at most ${max} characters.`);
// Drafts may be incomplete; submission checks that everything required is present.
const detailValidation = [
  optional('requestType').isIn(Object.keys(REQUEST_TYPES)).withMessage('Choose a valid request type.'),
  optional('processing').isIn(Object.keys(PROCESSING)).withMessage('Choose normal or urgent processing.'),
  text('fatherName', 100, 'Father’s name'),
  optional('cnic').matches(/^\d{5}-\d{7}-\d$/).withMessage('Enter the CNIC as 00000-0000000-0.'),
  optional('dateOfBirth').isISO8601().withMessage('Enter a valid date of birth.').custom(value => new Date(value) < new Date()).withMessage('Date of birth must be in the past.'),
  text('session', 20, 'Session'),
  text('registrationNumber', 40, 'Registration number'),
  text('rollNumber', 40, 'Roll number'),
  optional('cgpa').isFloat({ min: 0, max: 4 }).withMessage('CGPA must be between 0 and 4.')
];
const createValidation = [
  body('programName').isString().trim().notEmpty().isLength({ max: 150 }).withMessage('Enter the degree title, up to 150 characters.'),
  body('department').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Enter a department, up to 100 characters.'),
  body('graduationYear').isInt({ min: 1950, max: new Date().getFullYear() }).withMessage('Enter the year you passed.'),
  ...detailValidation
];
const updateValidation = [
  optional('programName').isString().trim().notEmpty().isLength({ max: 150 }).withMessage('Enter the degree title, up to 150 characters.'),
  optional('department').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Enter a department, up to 100 characters.'),
  optional('graduationYear').isInt({ min: 1950, max: new Date().getFullYear() }).withMessage('Enter the year you passed.'),
  ...detailValidation
];
const paymentValidation = [
  body('paidOn').isISO8601().withMessage('Enter the date you paid.').custom(value => new Date(value) <= new Date()).withMessage('The payment date cannot be in the future.'),
  body('bankReference').isString().trim().isLength({ min: 3, max: 40 }).withMessage('Enter the bank transaction or scroll number from your paid challan.')
];

router.get('/applications', studentController.getApplications);
router.post('/applications', createValidation, studentController.createApplication);
router.get('/applications/:id', studentController.getApplication);
router.patch('/applications/:id', updateValidation, studentController.updateApplication);
router.patch('/applications/:id/payment', paymentValidation, studentController.recordPayment);
router.post('/applications/:id/submit', studentController.submitApplication);
router.patch('/applications/:id/withdraw', studentController.withdrawApplication);
router.post('/applications/:id/documents', upload.single('document'), studentController.uploadDocument);
router.delete('/applications/:id/documents/:documentId', studentController.removeDocument);
router.get('/degrees', studentController.getDegrees);

module.exports = router;
