const Application = require('../models/Application');
const Degree = require('../models/Degree');
const User = require('../models/User');
const hashService = require('../services/hash');
const blockchainService = require('../services/blockchain');
const pdfService = require('../services/pdf');
const logger = require('../utils/logger');

exports.getDashboard = async (req, res, next) => {
  try {
    const stats = await Promise.all([
      Application.countDocuments(),
      Application.countDocuments({ status: 'pending' }),
      Application.countDocuments({ status: 'under_review' }),
      Application.countDocuments({ status: 'approved' }),
      Application.countDocuments({ status: 'issued' }),
      Application.countDocuments({ status: 'rejected' }),
      Degree.countDocuments()
    ]);

    const recentApplications = await Application.find()
      .limit(10)
      .sort({ createdAt: -1 })
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
        totalDegrees: stats[6]
      },
      recentApplications
    });
  } catch (error) {
    next(error);
  }
};

exports.getApplications = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};

    const applications = await Application.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
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

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    res.json({ application });
  } catch (error) {
    next(error);
  }
};

exports.startReview = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Application is not pending.' });
    }

    application.status = 'under_review';
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    logger.info(`Application ${application._id} moved to under_review`);
    res.json({ message: 'Application moved to under review', application });
  } catch (error) {
    next(error);
  }
};

exports.approveApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (application.status !== 'under_review') {
      return res.status(400).json({ error: 'Application must be under review to approve.' });
    }

    application.status = 'approved';
    application.adminComments = req.body.comments || 'Application approved';
    await application.save();

    logger.info(`Application ${application._id} approved`);
    res.json({ message: 'Application approved', application });
  } catch (error) {
    next(error);
  }
};

exports.rejectApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    application.status = 'rejected';
    application.rejectionReason = req.body.reason;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    logger.info(`Application ${application._id} rejected`);
    res.json({ message: 'Application rejected', application });
  } catch (error) {
    next(error);
  }
};

exports.issueDegree = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('student');

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (application.status !== 'approved') {
      return res.status(400).json({ error: 'Application must be approved first.' });
    }

    const existingDegree = await Degree.findOne({ application: application._id });
    if (existingDegree) {
      return res.status(409).json({ error: 'Degree already issued.' });
    }

    const issuedAt = new Date();

    const degreeData = {
      studentName: application.student.fullName,
      studentId: application.student.studentId,
      program: application.programName,
      department: application.department,
      graduationYear: application.graduationYear,
      cgpa: application.cgpa,
      university: process.env.UNIVERSITY_NAME || 'University',
      issuedAt
    };

    // Generate the canonical hash used by local verification and the blockchain contract.
    const degreeHash = hashService.generateDegreeHash(degreeData);

    // Store the canonical hash on-chain and keep the transaction hash as proof metadata.
    let blockchainTx = null;

    try {
      if (blockchainService.initialized) {
        const result = await blockchainService.issueDegree(degreeHash);
        blockchainTx = result.transactionHash;
        logger.info(`Degree hash stored on blockchain: ${degreeHash} (${blockchainTx})`);
      }
    } catch (err) {
      logger.warn('Blockchain storage failed, continuing without it:', err.message);
    }

    // Generate the certificate using the canonical verification hash.
    let pdfUrl = null;
    try {
      await pdfService.generateCertificate(
        { ...degreeData, hash: degreeHash, blockchainTx },
        process.env.CLIENT_URL
      );
      pdfUrl = pdfService.getCertificateUrl(degreeHash);
      logger.info(`PDF certificate generated: ${pdfUrl}`);
    } catch (err) {
      logger.warn('PDF generation failed, continuing without it:', err.message);
    }

    const degree = new Degree({
      application: application._id,
      student: application.student._id,
      hash: degreeHash,
      blockchainTx,
      pdfUrl,
      issuedBy: req.user._id,
      createdAt: issuedAt
    });
    await degree.save();

    application.status = 'issued';
    application.degree = degree._id;
    await application.save();

    res.json({
      message: 'Degree issued successfully',
      degree: {
        ...degree.toObject(),
        pdfUrl,
        verificationUrl: `${process.env.CLIENT_URL}/verify/${degreeHash}`,
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getDegrees = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const degrees = await Degree.find()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .populate('student', 'fullName email studentId')
      .populate('application', 'programName department graduationYear');

    const count = await Degree.countDocuments();

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
      .select('-passwordHash').sort({ createdAt: -1 })
    res.json({ admins })
  } catch (error) { next(error) }
}

exports.createAdmin = async (req, res, next) => {
  try {
    const { fullName, email, password, department } = req.body
    if (!fullName || !email || !password)
      return res.status(400).json({ error: 'Full name, email, and password are required.' })
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
    if (admin.role === 'super_admin')
      return res.status(403).json({ error: 'Cannot deactivate a super admin.' })
    admin.isActive = !admin.isActive
    await admin.save()
    res.json({ message: `Admin ${admin.isActive ? 'reactivated' : 'deactivated'}.` })
  } catch (error) { next(error) }
}
