const mongoose = require('mongoose');

const degreeSchema = new mongoose.Schema({
  snapshot: { type: new mongoose.Schema({
    studentName: String, studentId: String, fatherName: String, cnic: String,
    registrationNumber: String, session: String, program: String, department: String,
    graduationYear: Number, cgpa: Number, requestType: String, attestationNumber: String,
    university: String, issuedAt: Date
  }, { _id: false }), immutable: true },
  attestationNumber: { type: String, unique: true, sparse: true },
  issuanceStatus: { type: String, enum: ['pending', 'issued'], default: 'issued' },
  blockchainRequired: { type: Boolean, default: false, immutable: true },
  blockchainStatus: { type: String, enum: ['disabled', 'pending', 'confirmed'], default: 'disabled' },
  issuanceError: String,
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hash: {
    type: String,
    required: true,
    unique: true
  },
  blockchainTx: {
    type: String
  },
  blockchainNetwork: {
    type: String,
    default: 'polygon_amoy',
    immutable: true
  },
  blockchainChainId: { type: Number, immutable: true },
  blockchainContract: { type: String, immutable: true },
  ipfsHash: {
    type: String
  },
  pdfUrl: {
    type: String
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationCount: {
    type: Number,
    default: 0
  },
  lastVerifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

degreeSchema.index({ application: 1 }, { unique: true });

module.exports = mongoose.model('Degree', degreeSchema);
