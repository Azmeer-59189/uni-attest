const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  programName: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  graduationYear: {
    type: Number,
    required: true,
    min: 2000,
    max: 2030
  },
  cgpa: {
    type: Number,
    min: 0,
    max: 4
  },
status: {
  type: String,
  enum: ['draft', 'pending', 'under_review', 'approved', 'issuing', 'rejected', 'issued', 'withdrawn'],
  default: 'draft'
},
  submittedAt: Date,
  history: [{
    action: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: String,
    actorRole: String,
    at: { type: Date, required: true },
    details: String
  }],
  reviewedAt: {
    type: Date
  },
  issuanceToken: String,
  issuanceLeaseUntil: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminComments: {
    type: String
  },
  rejectionReason: {
    type: String
  },

  // ✅ FIX: these two fields were missing — caused populate() to silently fail
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],

  degree: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Degree',
    default: null
  }

}, {
  timestamps: true
});

applicationSchema.index({ student: 1 }, {
  unique: true,
  name: 'one_active_application_per_student',
  partialFilterExpression: { status: { $in: ['draft', 'pending', 'under_review', 'approved', 'issuing'] } }
});

module.exports = mongoose.model('Application', applicationSchema);
