const Application = require('../models/Application');
const Degree = require('../models/Degree');
const User = require('../models/User');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const activity = require('../services/activity');
const ACTIVE_STATUSES = ['pending', 'under_review', 'approved', 'issuing'];
const HISTORY_STATUSES = ['issued', 'rejected', 'withdrawn'];

exports.getDashboard = async (req, res, next) => {
  try {
    const stats = await Promise.all([
      Application.countDocuments({ status: { $ne: 'draft' } }),
      Application.countDocuments({ status: 'pending' }),
      Application.countDocuments({ status: 'under_review' }),
      Application.countDocuments({ status: 'approved' }),
      Application.countDocuments({ status: 'issued' }),
      Application.countDocuments({ status: 'rejected' }),
      Degree.countDocuments({ issuanceStatus: 'issued' }),
      Application.countDocuments({ status: 'issuing' }),
      Application.countDocuments({ status: 'withdrawn' })
    ]);

    const recentApplications = await Application.find({ status: { $ne: 'draft' } })
      .limit(10)
      .sort({ createdAt: -1 })
      .select('-history')
      .populate('student', 'fullName email studentId')
      .populate('degree', 'hash pdfUrl blockchainTx');

    res.json({
      stats: {
        total: stats[0],
        pending: stats[1],
        underReview: stats[2],
        approved: stats[3],
        issued: stats[4],
        rejected: stats[5],
        totalDegrees: stats[6],
        issuing: stats[7],
        withdrawn: stats[8]
      },
      recentApplications
    });
  } catch (error) {
    next(error);
  }
};

exports.getApplications = async (req, res, next) => {
  try {
    const { status, search = '', view = 'all' } = req.query;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: 'Invalid pagination. Use a positive page and a limit between 1 and 100.' });
    if (status && !['pending', 'under_review', 'approved', 'issuing', 'issued', 'rejected', 'withdrawn'].includes(status)) return res.status(400).json({ error: 'Invalid application status.' });
    if (!['active', 'history', 'all'].includes(view)) return res.status(400).json({ error: 'Invalid application view.' });
    const statuses = view === 'active' ? ACTIVE_STATUSES : view === 'history' ? HISTORY_STATUSES : [...ACTIVE_STATUSES, ...HISTORY_STATUSES];
    if (status && !statuses.includes(status)) return res.status(400).json({ error: 'Status does not belong to this view.' });
    if (typeof search !== 'string' || search.length > 100) return res.status(400).json({ error: 'Search must be at most 100 characters.' });
    const query = { status: status || { $in: statuses } };
    if (search.trim()) {
      const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const students = await User.find({ $or: [{ fullName: pattern }, { studentId: pattern }] }).select('_id');
      query.$or = [{ student: { $in: students.map(student => student._id) } }, { programName: pattern }, { department: pattern }];
    }

    const applications = await Application.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(view === 'active' ? { submittedAt: 1, createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 })
      .select('-history')
      .populate('student', 'fullName email studentId department')
      .populate('degree', 'hash pdfUrl blockchainTx createdAt');

    const count = await Application.countDocuments(query);

    res.json({
      applications,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('student', 'fullName email studentId department phone')
      .populate('documents')
      .populate('degree');

    if (!application || application.status === 'draft') {
      return res.status(404).json({ error: 'Application not found.' });
    }

    res.json({ application });
  } catch (error) {
    next(error);
  }
};

const transition = async (req, res, next, from, status, fields) => {
  try {
    const application = await Application.findOneAndUpdate({
      _id: req.params.id, status: { $in: from }, ...(status === 'under_review' || status === 'approved' ? { 'documents.0': { $exists: true } } : {})
    }, { $set: { status, ...fields }, $push: { history: activity(req.user, ({ under_review: 'review_started', approved: 'approved', rejected: 'rejected' })[status], fields.rejectionReason || fields.adminComments || '') } }, { new: true, runValidators: true });
    if (!application) return res.status(409).json({ error: 'Application does not allow this action in its current state.' });
    res.json({ message: `Application ${status}`, application });
  } catch (error) { next(error); }
};

exports.startReview = (req, res, next) => transition(req, res, next, ['pending'], 'under_review', {
  reviewedBy: req.user._id, reviewedAt: new Date()
});
exports.approveApplication = (req, res, next) => transition(req, res, next, ['under_review'], 'approved', {
  adminComments: typeof req.body.comments === 'string' ? req.body.comments.trim().slice(0, 2000) || 'Application approved' : 'Application approved',
  reviewedBy: req.user._id, reviewedAt: new Date()
});
exports.rejectApplication = (req, res, next) => {
  if (typeof req.body.reason !== 'string' || !req.body.reason.trim()) {
    return res.status(400).json({ error: 'A rejection reason is required.' });
  }
  return transition(req, res, next, ['pending', 'under_review', 'approved'], 'rejected', {
    rejectionReason: req.body.reason.trim().slice(0, 2000), reviewedBy: req.user._id, reviewedAt: new Date()
  });
};

exports.issueDegree = async (req, res, next) => {
  try {
    const degree = await require('../services/issuance').issue(req.params.id, req.user._id, req.user);
    res.json({ message: 'Degree issued successfully', degree });
  } catch (error) { next(error); }
};

exports.getDegrees = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const degrees = await Degree.find({ issuanceStatus: 'issued' })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .populate('student', 'fullName email studentId')
      .populate('application', 'programName department graduationYear');

    const count = await Degree.countDocuments({ issuanceStatus: 'issued' });

    res.json({
      degrees,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } })
      .select('-passwordHash -tokenVersion').sort({ createdAt: -1 })
    res.json({ admins })
  } catch (error) { next(error) }
}

exports.createAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { fullName, email, password, department } = req.body
    if (!fullName || !email || typeof password !== 'string' || password.length < 12)
      return res.status(400).json({ error: 'Full name, email, and a password of at least 12 characters are required.' })
    const existing = await User.findOne({ email: email.toLowerCase() })
    if (existing)
      return res.status(409).json({ error: 'An account with this email already exists.' })
    const admin = new User({
      fullName, email: email.toLowerCase(),
      passwordHash: password, role: 'admin',
      department: department || '', studentId: `ADMIN-${Date.now()}`
    })
    await admin.save()
    const { passwordHash: _, ...adminData } = admin.toObject()
    res.status(201).json({ message: 'Admin account created.', admin: adminData })
  } catch (error) { next(error) }
}

exports.toggleAdmin = async (req, res, next) => {
  try {
    const admin = await User.findById(req.params.id)
    if (!admin) return res.status(404).json({ error: 'Admin not found.' })
    if (admin.role !== 'admin')
      return res.status(403).json({ error: 'Only regular admin accounts can be toggled.' })
    admin.isActive = !admin.isActive
    admin.tokenVersion += 1
    admin.refreshTokenHash = undefined
    await admin.save()
    res.json({ message: `Admin ${admin.isActive ? 'reactivated' : 'deactivated'}.` })
  } catch (error) { next(error) }
}
