const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().isLength({ min: 12, max: 72 }).custom(value => Buffer.byteLength(value) <= 72).withMessage('Password must be at least 12 characters and at most 72 bytes'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('studentId').trim().notEmpty().withMessage('Registration number is required'),
  body('fatherName').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Father’s name is required'),
  body('cnic').isString().trim().matches(/^\d{5}-\d{7}-\d$/).withMessage('Enter your CNIC as 00000-0000000-0'),
  body('department').trim().notEmpty().withMessage('Department is required')
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Each request can send an email, so allow far fewer than the global limit.
// Slows password guessing: only failed sign-ins count, so normal use never reaches it.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many failed sign-in attempts. Wait 15 minutes, or reset your password.' } });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Too many reset requests. Try again in 15 minutes.' } });

router.post('/register', registerValidation, authController.register);
router.post('/login', loginLimiter, loginValidation, authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/forgot-password', resetLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.loginLimiter = loginLimiter;
module.exports = router;
