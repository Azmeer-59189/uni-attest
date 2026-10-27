const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().isLength({ min: 12, max: 72 }).custom(value => Buffer.byteLength(value) <= 72).withMessage('Password must be at least 12 characters and at most 72 bytes'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('studentId').trim().notEmpty().withMessage('Student ID is required'),
  body('department').trim().notEmpty().withMessage('Department is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;
