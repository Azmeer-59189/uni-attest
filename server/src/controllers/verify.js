const Degree = require('../models/Degree');
const hashService = require('../services/hash');
const blockchainService = require('../services/blockchain');
const logger = require('../utils/logger');

exports.verifyByHash = async (req, res, next) => {
  try {
    const { hash } = req.params;

    if (!hash || hash.length !== 64) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid hash format. Expected 64 character hex string.'
      });
    }

    const degree = await Degree.findOne({ hash })
      .populate('student', 'fullName studentId')
      .populate('application', 'programName department graduationYear cgpa');

    if (!degree) {
      return res.status(404).json({
        verified: false,
        error: 'Degree not found.'
      });
    }

    degree.verificationCount += 1;
    degree.lastVerifiedAt = new Date();
    await degree.save();

    let blockchainVerification = null;
    try {
      if (blockchainService.initialized && degree.blockchainTx) {
        blockchainVerification = await blockchainService.verifyDegree(hash);
      }
    } catch (err) {
      logger.warn('Blockchain verification failed:', err.message);
    }

    const degreeData = {
      studentName: degree.student.fullName,
      studentId: degree.student.studentId,
      program: degree.application.programName,
      department: degree.application.department,
      graduationYear: degree.application.graduationYear,
      cgpa: degree.application.cgpa,
      university: process.env.UNIVERSITY_NAME || 'University',
      issuedAt: degree.createdAt
    };

    const computedHash = hashService.generateDegreeHash(degreeData);
    const hashValid = computedHash === hash;

    res.json({
      verified: true,
      hashValid,
      degree: {
        id: degree._id,
        hash: degree.hash,
        studentName: degree.student.fullName,
        studentId: degree.student.studentId,
        program: degree.application.programName,
        department: degree.application.department,
        graduationYear: degree.application.graduationYear,
        cgpa: degree.application.cgpa,
        issuedAt: degree.createdAt,
        blockchainTx: degree.blockchainTx,
        blockchainNetwork: degree.blockchainNetwork
      },
      blockchainVerification,
      verificationCount: degree.verificationCount
    });
  } catch (error) {
    next(error);
  }
};