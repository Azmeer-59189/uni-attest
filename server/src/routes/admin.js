const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/admin');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication
router.use(authenticate);

// ── Regular admin + super_admin routes ──
router.use(authorize('admin', 'super_admin'));

router.get('/dashboard', adminController.getDashboard);
router.get('/applications', adminController.getApplications);
router.get('/applications/:id', adminController.getApplication);

// Support both PUT and PATCH so old + new frontend both work
router.put('/applications/:id/review', adminController.startReview);
router.patch('/applications/:id/review', adminController.startReview);

router.put('/applications/:id/approve', adminController.approveApplication);
router.patch('/applications/:id/approve', adminController.approveApplication);

router.put('/applications/:id/reject', adminController.rejectApplication);
router.patch('/applications/:id/reject', adminController.rejectApplication);

router.post('/applications/:id/issue', adminController.issueDegree);
router.get('/degrees', adminController.getDegrees);

// ── Super admin only routes ──
router.get('/admins', authorize('super_admin'), adminController.getAdmins);
router.post('/admins', authorize('super_admin'), adminController.createAdmin);
router.patch('/admins/:id/toggle', authorize('super_admin'), adminController.toggleAdmin);

module.exports = router;