const { randomUUID } = require('crypto');
const Application = require('../models/Application');
const Degree = require('../models/Degree');
const hashService = require('./hash');
const blockchain = require('./blockchain');
const pdf = require('./pdf');
const activity = require('./activity');
const User = require('../models/User');

const failure = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// Claim before any external work. A retry always reuses the persisted snapshot/hash.
exports.issue = async (applicationId, issuerId, actor) => {
  actor = actor || await User.findById(issuerId).select('fullName role');
  if (!actor) throw failure(404, 'Issuer not found.');
  const token = randomUUID();
  const application = await Application.findOneAndUpdate({
    _id: applicationId,
    status: { $in: ['approved', 'issuing'] },
    'documents.0': { $exists: true },
    $or: [{ issuanceLeaseUntil: { $exists: false } }, { issuanceLeaseUntil: { $lte: new Date() } }]
  }, {
    $set: { status: 'issuing', issuanceToken: token, issuanceLeaseUntil: new Date(Date.now() + 10 * 60 * 1000) },
    $push: { history: activity(actor, 'issuance_attempted') }
  }, { new: true }).populate('student');

  if (!application) {
    const existing = await Application.findById(applicationId);
    if (!existing) throw failure(404, 'Application not found.');
    if (existing.status === 'issued') {
      const degree = await Degree.findOne({ application: applicationId, issuanceStatus: 'issued' });
      if (degree) return degree;
    }
    throw failure(409, 'Application must be approved and have no issuance already in progress.');
  }

  let degree;
  try {
    const snapshot = {
      studentName: application.student.fullName, studentId: application.student.studentId,
      program: application.programName, department: application.department,
      graduationYear: application.graduationYear, cgpa: application.cgpa,
      university: process.env.UNIVERSITY_NAME || 'University', issuedAt: new Date()
    };
    const blockchainRequired = blockchain.initialized || process.env.BLOCKCHAIN_REQUIRED === 'true' || Boolean(process.env.CONTRACT_ADDRESS && process.env.PRIVATE_KEY);
    degree = await Degree.findOneAndUpdate({ application: applicationId }, {
      $setOnInsert: {
        application: applicationId, student: application.student._id, issuedBy: issuerId,
        snapshot, hash: hashService.generateDegreeHash(snapshot), issuanceStatus: 'pending',
        blockchainRequired, blockchainStatus: blockchainRequired ? 'pending' : 'disabled',
        blockchainNetwork: blockchain.networkName,
        blockchainChainId: blockchain.chainId,
        blockchainContract: blockchain.contractAddress || undefined
      }
    }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });

    if (!degree.snapshot) throw failure(409, 'This legacy degree needs manual integrity review before retrying issuance.');
    if (degree.blockchainRequired && blockchain.initialized && !blockchain.matchesDegree(degree)) throw failure(409, 'This issuance belongs to a different blockchain or contract. Switch back to its original network to retry.');
    if (degree.blockchainRequired && degree.blockchainStatus !== 'confirmed') {
      if (!blockchain.initialized) throw failure(503, 'Blockchain is unavailable. Retry issuance after restoring the service.');
      // Reconcile a transaction that succeeded before a process/database failure.
      const chain = await blockchain.verifyDegree(degree.hash);
      if (!chain.verified) {
        const result = await blockchain.issueDegree(degree.hash, async (transactionHash) => {
          await Degree.updateOne({ _id: degree._id }, { $set: { blockchainTx: transactionHash } });
          degree.blockchainTx = transactionHash;
        }, degree.blockchainTx);
        degree.blockchainTx = result.transactionHash;
      }
      degree.blockchainStatus = 'confirmed';
      await degree.save();
    }

    await pdf.generateCertificate({ ...degree.snapshot.toObject(), hash: degree.hash, blockchainTx: degree.blockchainTx, blockchainNetwork: degree.blockchainNetwork }, process.env.CLIENT_URL);
    degree.pdfUrl = pdf.getCertificateUrl(degree.hash);
    degree.issuanceStatus = 'issued';
    degree.issuanceError = undefined;
    await degree.save();

    const result = await Application.updateOne({ _id: applicationId, issuanceToken: token }, {
      $set: { status: 'issued', degree: degree._id }, $unset: { issuanceToken: '', issuanceLeaseUntil: '' },
      $push: { history: activity(actor, 'degree_issued') }
    });
    if (!result.matchedCount) throw failure(409, 'Issuance lease changed. Reload the application and retry.');
    return degree;
  } catch (error) {
    if (degree) await Degree.updateOne({ _id: degree._id }, { $set: { issuanceError: 'Issuance incomplete. Retry the issue action.' } }).catch(() => {});
    // Keep issuing status: rejection must never race an already submitted chain transaction.
    await Application.updateOne({ _id: applicationId, issuanceToken: token }, {
      $unset: { issuanceToken: '', issuanceLeaseUntil: '' },
      $push: { history: activity(actor, 'issuance_failed', 'Issuance incomplete. An administrator can retry.') }
    }).catch(() => {});
    throw error;
  }
};
