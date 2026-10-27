const mongoose = require('mongoose');
const { OPEN_STATUSES, REQUEST_TYPES, PROCESSING, STATUS_LABELS } = require('../services/workflow');

const stageReview = new mongoose.Schema({
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName: String,
  at: Date,
  remarks: String,
  // Examination branch: the result gazette or tabulation register entry the record was checked against.
  recordReference: String
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  applicationNumber: { type: String, unique: true, sparse: true },

  // The request
  requestType: { type: String, enum: Object.keys(REQUEST_TYPES), default: 'degree' },
  processing: { type: String, enum: Object.keys(PROCESSING), default: 'normal' },

  // Applicant identity, as declared for this request
  fatherName: { type: String, trim: true },
  cnic: { type: String, trim: true },
  dateOfBirth: Date,

  // Academic record to be attested
  programName: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },
  session: { type: String, trim: true },
  registrationNumber: { type: String, trim: true },
  rollNumber: { type: String, trim: true },
  graduationYear: { type: Number, required: true, min: 1950, max: 2100 },
  cgpa: { type: Number, min: 0, max: 4 },

  // Bank challan: issued by the system, paid by the student, confirmed during scrutiny.
  fee: {
    challanNumber: String,
    amount: Number,
    issuedAt: Date,
    paidOn: Date,
    bankReference: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date
  },

  status: { type: String, enum: Object.keys(STATUS_LABELS).concat(['pending', 'under_review', 'approved']), default: 'draft' },
  submittedAt: Date,
  declarationAcceptedAt: Date,

  // The open objection, while the application waits for the student's correction.
  objection: {
    stage: String,
    reason: String,
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    raisedByName: String,
    raisedAt: Date
  },
  objectionCount: { type: Number, default: 0 },

  reviews: {
    scrutiny: stageReview,
    records: stageReview,
    registrar: stageReview
  },

  // Results of the staff tools, kept as evidence for later stages.
  checks: {
    ocr: [{
      _id: false,
      document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
      documentName: String,
      at: Date,
      byName: String,
      fields: mongoose.Schema.Types.Mixed,
      comparison: [{ _id: false, field: String, label: String, declared: String, extracted: String, match: Boolean }]
    }],
    face: {
      match: Boolean,
      confidence: Number,
      distance: Number,
      threshold: Number,
      at: Date,
      byName: String,
      error: String
    }
  },

  history: [{
    action: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: String,
    actorRole: String,
    at: { type: Date, required: true },
    details: String
  }],
  issuanceToken: String,
  issuanceLeaseUntil: Date,
  rejectionReason: String,
  // Kept for records reviewed before the staged workflow.
  adminComments: String,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,

  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  degree: { type: mongoose.Schema.Types.ObjectId, ref: 'Degree', default: null }
}, { timestamps: true });

applicationSchema.index({ student: 1 }, {
  unique: true,
  name: 'one_open_request_per_student',
  partialFilterExpression: { status: { $in: OPEN_STATUSES } }
});
applicationSchema.index({ status: 1, submittedAt: 1 });

module.exports = mongoose.model('Application', applicationSchema);
