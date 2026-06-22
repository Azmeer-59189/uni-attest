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
  enum: ['pending', 'under_review', 'approved', 'rejected', 'issued', 'withdrawn'],
  default: 'pending'
},
  reviewedAt: {
    type: Date
  },
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

module.exports = mongoose.model('Application', applicationSchema);