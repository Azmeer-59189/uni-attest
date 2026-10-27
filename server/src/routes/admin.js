const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/admin');
const { authenticate, authorize } = require('../middleware/auth');
const { STAFF_ROLES } = require('../services/workflow');

const router = express.Router();

// Every staff role can read the register; stage actions check the role against the application's stage.
router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/dashboard', adminController.getDashboard);
router.get('/applications', adminController.getApplications);
router.get('/applications/:id', adminController.getApplication);

router.patch('/applications/:id/documents/:documentId/review', adminController.reviewDocument);
router.post('/applications/:id/documents/:documentId/ocr', adminController.ocrCheck);
router.post('/applications/:id/face-check', adminController.faceCheck);
router.patch('/applications/:id/fee', adminController.verifyFee);

router.post('/applications/:id/forward', adminController.forward);
router.post('/applications/:id/objection', adminController.raiseObjection);
router.post('/applications/:id/reject', adminController.rejectApplication);
router.post('/applications/:id/issue', adminController.issueDegree);
router.get('/degrees', adminController.getDegrees);

// ── Super admin only ──
router.get('/admins', authorize('super_admin'), adminController.getAdmins);
router.post('/admins', authorize('super_admin'), [
  body('email').isEmail().normalizeEmail(),
  body('fullName').isString().trim().notEmpty(),
  body('password').isString().isLength({ min: 12, max: 72 }).custom(value => Buffer.byteLength(value) <= 72).withMessage('Use a temporary password between 12 and 72 bytes.')
], adminController.createAdmin);
router.patch('/admins/:id/toggle', authorize('super_admin'), adminController.toggleAdmin);

module.exports = router;
