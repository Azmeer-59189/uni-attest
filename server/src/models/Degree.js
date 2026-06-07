const mongoose = require('mongoose');

const degreeSchema = new mongoose.Schema({
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
    default: 'polygon_amoy'
  },
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

module.exports = mongoose.model('Degree', degreeSchema);