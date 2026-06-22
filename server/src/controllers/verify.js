const Degree = require('../models/Degree');
const blockchainService = require('../services/blockchain');

exports.verifyByHash = async (req, res, next) => {
  try {
    const hash = (req.params.hash || '').trim();
    const alternateHash = hash.startsWith('0x') ? hash.slice(2) : `0x${hash}`;

    const degree = await Degree.findOne({
      $or: [
        { hash },
        { hash: alternateHash },
        { blockchainTx: hash },
        { blockchainTx: alternateHash },
      ]
    })
      .populate('student', 'fullName studentId department')
      .populate('application', 'programName department graduationYear cgpa')
      .populate('issuedBy', 'fullName');

    if (!degree) {
      return res.status(404).json({
        verified: false,
        error: 'No degree found with this hash. Please check and try again.'
      });
    }

    degree.verificationCount = (degree.verificationCount || 0) + 1;
    degree.lastVerifiedAt = new Date();
    await degree.save();

    let blockchainVerification = {
      checked: false,
      verified: false,
      error: null
    };

    if (blockchainService.initialized && degree.hash) {
      try {
        const chainResult = await blockchainService.verifyDegree(degree.hash);
        blockchainVerification = {
          checked: true,
          verified: Boolean(chainResult.verified),
          timestamp: chainResult.timestamp,
          issuer: chainResult.issuer,
          universityName: chainResult.universityName
        };
      } catch (err) {
        blockchainVerification = {
          checked: true,
          verified: false,
          error: err.message
        };
      }
    }

    const polygonScanUrl = degree.blockchainTx
      ? `https://amoy.polygonscan.com/tx/${degree.blockchainTx}`
      : null;

    res.json({
      verified: true,
      degree: {
        hash: degree.hash,
        blockchainTx: degree.blockchainTx,
        blockchainVerification,
        polygonScanUrl,
        studentName: degree.student?.fullName,
        studentId: degree.student?.studentId,
        student: {
          fullName: degree.student?.fullName,
          studentId: degree.student?.studentId,
          department: degree.student?.department,
        },
        program: degree.application?.programName,
        department: degree.application?.department,
        graduationYear: degree.application?.graduationYear,
        cgpa: degree.application?.cgpa,
        university: process.env.UNIVERSITY_NAME || 'University',
        issuedAt: degree.createdAt,
        issuedBy: degree.issuedBy?.fullName,
        verificationCount: degree.verificationCount,
        pdfUrl: degree.pdfUrl,
      }
    });
  } catch (error) {
    next(error);
  }
};
