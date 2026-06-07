const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number
  },
  ipfsHash: {
    type: String
  },
  originalName: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Document', documentSchema);