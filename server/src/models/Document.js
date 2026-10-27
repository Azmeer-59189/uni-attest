const mongoose = require('mongoose');
const { DOCUMENT_KINDS } = require('../services/workflow');

const documentSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  kind: { type: String, enum: Object.keys(DOCUMENT_KINDS), default: 'other' },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: Number,
  originalName: String,
  // Scrutiny outcome for this document. A replaced document starts again at pending.
  review: {
    status: { type: String, enum: ['pending', 'accepted', 'flagged'], default: 'pending' },
    note: String,
    byName: String,
    at: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
