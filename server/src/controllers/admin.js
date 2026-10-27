const path = require('path');
const Application = require('../models/Application');
const Degree = require('../models/Degree');
const Document = require('../models/Document');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const activity = require('../services/activity');
const workflow = require('../services/workflow');
const { notify } = require('../services/notify');

const uploads = path.join(__dirname, '../../uploads');
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const remarks = value => typeof value === 'string' ? value.trim().slice(0, 2000) : '';
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reviewer = user => ({ by: user._id, byName: user.fullName, at: new Date() });

const populated = query => query
  .populate('student', 'fullName email studentId department phone')
  .populate('documents')
  .populate('degree');

// Loads an application the user may act on in its current stage.
const actionable = async (req) => {
  const application = await populated(Application.findById(req.params.id));
  if (!application || application.status === 'draft') throw fail(404, 'Application not found.');
  if (!workflow.canAct(req.user, application.status)) {
    throw fail(403, workflow.STAGES[application.status]
      ? `This application is at ${workflow.STAGES[application.status].label}. Your role cannot act on it.`
      : 'This application is closed or waiting for the applicant.');
  }
  return application;
};

exports.getDashboard = async (req, res, next) => {
  try {
    const grouped = await Application.aggregate([{ $match: { status: { $ne: 'draft' } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const byStatus = Object.fromEntries(grouped.map(({ _id, count }) => [_id, count]));
    const myStages = workflow.stagesFor(req.user);
    res.json({
      stats: {
        byStatus,
        myQueue: myStages.reduce((total, status) => total + (byStatus[status] || 0), 0),
        inProgress: [...workflow.IN_REVIEW_STATUSES, 'objection'].reduce((total, status) => total + (byStatus[status] || 0), 0),
        completed: workflow.CLOSED_STATUSES.reduce((total, status) => total + (byStatus[status] || 0), 0),
        total: Object.values(byStatus).reduce((total, count) => total + count, 0)
      },
      myStages
    });
  } catch (error) { next(error); }
};

const VIEWS = {
  queue: user => workflow.stagesFor(user),
  active: () => [...workflow.IN_REVIEW_STATUSES, 'objection'],
  history: () => workflow.CLOSED_STATUSES,
  all: () => [...workflow.IN_REVIEW_STATUSES, 'objection', ...workflow.CLOSED_STATUSES]
};

exports.getApplications = async (req, res, next) => {
  try {
    const { status, search = '', view = 'queue' } = req.query;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: 'Invalid pagination. Use a positive page and a limit between 1 and 100.' });
    if (!Object.hasOwn(VIEWS, view)) return res.status(400).json({ error: 'Invalid application view.' });
    const statuses = VIEWS[view](req.user);
    if (status && !statuses.includes(status)) return res.status(400).json({ error: 'Status does not belong to this view.' });
    if (typeof search !== 'string' || search.length > 100) return res.status(400).json({ error: 'Search must be at most 100 characters.' });
    const query = { status: status || { $in: statuses } };
    if (search.trim()) {
      const pattern = new RegExp(escapeRegExp(search.trim()), 'i');
      const students = await User.find({ $or: [{ fullName: pattern }, { studentId: pattern }] }).select('_id');
      query.$or = [{ student: { $in: students.map(student => student._id) } }, { applicationNumber: pattern }, { cnic: pattern }, { registrationNumber: pattern }, { programName: pattern }, { department: pattern }];
    }
    const oldestFirst = view === 'queue' || view === 'active';
    const [applications, total] = await Promise.all([
      Application.find(query)
        .sort(oldestFirst ? { submittedAt: 1, createdAt: 1, _id: 1 } : { updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit).limit(limit)
        .select('applicationNumber requestType processing programName department graduationYear status submittedAt createdAt updatedAt student objection.reason degree')
        .populate('student', 'fullName studentId')
        .populate('degree', 'hash attestationNumber'),
      Application.countDocuments(query)
    ]);
    res.json({ applications, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

exports.getApplication = async (req, res, next) => {
  try {
    const application = await populated(Application.findById(req.params.id));
    if (!application || application.status === 'draft') return res.status(404).json({ error: 'Application not found.' });
    res.json({ application, canAct: workflow.canAct(req.user, application.status) });
  } catch (error) { next(error); }
};

// ── Document scrutiny ──

exports.reviewDocument = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'flagged', 'pending'].includes(status)) return res.status(400).json({ error: 'Mark the document as accepted or flagged.' });
    const note = remarks(req.body.note);
    if (status === 'flagged' && !note) return res.status(400).json({ error: 'Explain what is wrong with this document.' });
    const application = await actionable(req);
    if (application.status !== 'scrutiny') throw fail(409, 'Documents are checked during document scrutiny.');
    const document = application.documents.find(item => String(item._id) === req.params.documentId);
    if (!document) throw fail(404, 'Document not found.');
    const updated = await Document.findOneAndUpdate({ _id: document._id, application: application._id }, {
      $set: { review: { status, note: status === 'accepted' ? undefined : note, byName: req.user.fullName, at: new Date() } }
    }, { new: true });
    await Application.updateOne({ _id: application._id }, { $push: { history: activity(req.user, `document_${status}`, `${workflow.DOCUMENT_KINDS[document.kind]}${note ? `: ${note}` : ''}`) } });
    res.json({ message: status === 'accepted' ? 'Document accepted.' : status === 'flagged' ? 'Document flagged.' : 'Document review cleared.', document: updated });
  } catch (error) { next(error); }
};

exports.verifyFee = async (req, res, next) => {
  try {
    const verified = req.body.verified === true;
    const application = await actionable(req);
    if (application.status !== 'scrutiny') throw fail(409, 'The fee is verified during document scrutiny.');
    if (verified && (!application.fee?.paidOn || !application.fee?.bankReference)) throw fail(409, 'The applicant has not entered payment details.');
    const updated = await Application.findOneAndUpdate({ _id: application._id, status: 'scrutiny' }, {
      $set: verified ? { 'fee.verified': true, 'fee.verifiedBy': req.user._id, 'fee.verifiedAt': new Date() } : { 'fee.verified': false },
      ...(verified ? {} : { $unset: { 'fee.verifiedBy': '', 'fee.verifiedAt': '' } }),
      $push: { history: activity(req.user, verified ? 'fee_verified' : 'fee_unverified', `Challan ${application.fee.challanNumber}, PKR ${application.fee.amount}`) }
    }, { new: true });
    if (!updated) throw fail(409, 'The application changed. Reload and try again.');
    res.json({ message: verified ? 'Fee payment verified.' : 'Fee verification removed.', fee: updated.fee });
  } catch (error) { next(error); }
};

// ── Stage decisions ──

exports.forward = async (req, res, next) => {
  try {
    const application = await actionable(req);
    const note = remarks(req.body.remarks);
    let review;
    if (application.status === 'scrutiny') {
      const required = workflow.requiredDocuments(application.requestType);
      const accepted = new Set(application.documents.filter(document => document.review?.status === 'accepted').map(document => document.kind));
      const outstanding = required.filter(kind => !accepted.has(kind));
      if (outstanding.length) throw fail(409, `Accept every required document first: ${outstanding.map(kind => workflow.DOCUMENT_KINDS[kind]).join(', ')}.`);
      if (application.documents.some(document => document.review?.status === 'flagged')) throw fail(409, 'A document is flagged. Raise an objection, or clear the flag.');
      if (!application.fee?.verified) throw fail(409, 'Verify the fee payment first.');
      review = { 'reviews.scrutiny': { ...reviewer(req.user), remarks: note } };
    } else if (application.status === 'records_verification') {
      const recordReference = remarks(req.body.recordReference).slice(0, 120);
      if (!recordReference) throw fail(400, 'Enter the result gazette or tabulation register reference you checked.');
      review = { 'reviews.records': { ...reviewer(req.user), remarks: note, recordReference } };
    } else throw fail(409, 'Use “Approve and issue” at the registrar stage.');
    const nextStatus = workflow.STAGES[application.status].next;
    const updated = await Application.findOneAndUpdate({ _id: application._id, status: application.status }, {
      $set: { status: nextStatus, ...review },
      $push: { history: activity(req.user, `forwarded_to_${nextStatus}`, note) }
    }, { new: true });
    if (!updated) throw fail(409, 'The application changed. Reload and try again.');
    res.json({ message: `Forwarded to ${workflow.STAGES[nextStatus].label.toLowerCase()}.`, application: updated });
  } catch (error) { next(error); }
};

exports.raiseObjection = async (req, res, next) => {
  try {
    const reason = remarks(req.body.reason);
    if (!reason) return res.status(400).json({ error: 'Describe what the applicant needs to correct.' });
    const application = await actionable(req);
    if (application.status === 'issuing') throw fail(409, 'Issuance has started. Complete it, or reject if it must not be issued.');
    const flagged = application.documents.filter(document => document.review?.status === 'flagged').map(document => document._id);
    const updated = await Application.findOneAndUpdate({ _id: application._id, status: application.status }, {
      $set: { status: 'objection', objection: { stage: application.status, reason, documents: flagged, raisedBy: req.user._id, raisedByName: req.user.fullName, raisedAt: new Date() } },
      $inc: { objectionCount: 1 },
      $push: { history: activity(req.user, 'objection_raised', reason) }
    }, { new: true }).populate('student', 'fullName email');
    if (!updated) throw fail(409, 'The application changed. Reload and try again.');
    notify('objection', { application: updated });
    res.json({ message: 'Objection raised. The applicant has been asked to correct the request.', application: updated });
  } catch (error) { next(error); }
};

exports.rejectApplication = async (req, res, next) => {
  try {
    const reason = remarks(req.body.reason);
    if (!reason) return res.status(400).json({ error: 'A rejection reason is required.' });
    const application = await actionable(req);
    if (application.status === 'issuing') throw fail(409, 'Issuance has started and cannot be rejected. Retry issuance to complete it.');
    const updated = await Application.findOneAndUpdate({ _id: application._id, status: application.status }, {
      $set: { status: 'rejected', rejectionReason: reason },
      $push: { history: activity(req.user, 'rejected', reason) }
    }, { new: true }).populate('student', 'fullName email');
    if (!updated) throw fail(409, 'The application changed. Reload and try again.');
    notify('rejected', { application: updated });
    res.json({ message: 'Application rejected.', application: updated });
  } catch (error) { next(error); }
};

exports.issueDegree = async (req, res, next) => {
  try {
    // Repeating the action on an attested application returns its certificate rather than failing.
    const current = await Application.findById(req.params.id).select('status');
    if (current?.status !== 'issued' || !workflow.canAct(req.user, 'registrar_approval')) await actionable(req);
    const degree = await require('../services/issuance').issue(req.params.id, req.user, remarks(req.body.remarks));
    res.json({ message: 'Attestation approved and certificate issued.', degree });
  } catch (error) { next(error); }
};

// ── Staff tools ──

const documentPath = document => path.join(uploads, path.basename(document.fileName));
const normalise = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9.]/g, '');
const similar = (declared, extracted) => {
  const a = normalise(declared); const b = normalise(extracted);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
};

// Reads a degree or transcript with OCR and compares what it says with what the applicant declared.
exports.ocrCheck = async (req, res, next) => {
  try {
    const application = await actionable(req);
    const document = application.documents.find(item => String(item._id) === req.params.documentId);
    if (!document) throw fail(404, 'Document not found.');
    if (!['degree', 'transcript', 'other'].includes(document.kind)) throw fail(400, 'OCR reads degree certificates and transcripts.');
    const { extractFromDocument } = require('../services/ocrService');
    const { fields } = await extractFromDocument(documentPath(document), document.fileType);
    const declared = [
      ['studentName', 'Name', application.student?.fullName],
      ['studentId', 'Registration no.', application.registrationNumber],
      ['program', 'Degree', application.programName],
      ['graduationYear', 'Year', application.graduationYear],
      ['cgpa', 'CGPA', application.cgpa]
    ];
    const comparison = declared.filter(([key]) => fields[key] != null && fields[key] !== '').map(([key, label, value]) => ({
      field: key, label, declared: value == null ? '' : String(value), extracted: String(fields[key]),
      match: key === 'cgpa' ? Math.abs(Number(fields[key]) - Number(value)) < 0.01 : key === 'graduationYear' ? Number(fields[key]) === Number(value) : similar(value, fields[key])
    }));
    const result = { document: document._id, documentName: workflow.DOCUMENT_KINDS[document.kind], at: new Date(), byName: req.user.fullName, fields, comparison };
    await Application.updateOne({ _id: application._id }, {
      $pull: { 'checks.ocr': { document: document._id } },
    });
    await Application.updateOne({ _id: application._id }, {
      $push: { 'checks.ocr': result, history: activity(req.user, 'ocr_checked', `${result.documentName}: ${comparison.filter(item => item.match).length} of ${comparison.length} fields match`) }
    });
    res.json({ message: 'Document read.', result });
  } catch (error) { next(error); }
};

// Compares the applicant's photograph with the portrait on the CNIC.
exports.faceCheck = async (req, res, next) => {
  try {
    const application = await actionable(req);
    const photograph = application.documents.find(document => document.kind === 'photograph');
    const cnic = application.documents.find(document => document.kind === 'cnic_front');
    if (!photograph || !cnic) throw fail(409, 'The application needs both a photograph and the CNIC front.');
    if (cnic.fileType === 'application/pdf' || photograph.fileType === 'application/pdf') throw fail(400, 'Face comparison needs image files. Ask the applicant for JPG or PNG copies.');
    const outcome = await require('../services/faceService').compare(
      { path: documentPath(cnic), name: cnic.originalName, type: cnic.fileType },
      { path: documentPath(photograph), name: photograph.originalName, type: photograph.fileType }
    );
    const face = { ...outcome, at: new Date(), byName: req.user.fullName };
    await Application.updateOne({ _id: application._id }, {
      $set: { 'checks.face': face },
      $push: { history: activity(req.user, 'face_checked', outcome.error || (outcome.match ? `Photograph matches CNIC (${outcome.confidence}% similarity)` : `Photograph does not match CNIC (${outcome.confidence ?? 0}% similarity)`)) }
    });
    res.json({ message: 'Face comparison complete.', face });
  } catch (error) { next(error); }
};

// ── Staff accounts ──

exports.getDegrees = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const [degrees, total] = await Promise.all([
      Degree.find({ issuanceStatus: 'issued' }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('student', 'fullName email studentId').populate('application', 'programName department graduationYear applicationNumber'),
      Degree.countDocuments({ issuanceStatus: 'issued' })
    ]);
    res.json({ degrees, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

exports.getAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: { $in: workflow.STAFF_ROLES } }).select('-passwordHash -tokenVersion').sort({ createdAt: -1 });
    res.json({ admins });
  } catch (error) { next(error); }
};

exports.createAdmin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { fullName, email, password, department, role = 'admin' } = req.body;
    if (!workflow.STAFF_ROLES.includes(role) || role === 'super_admin') return res.status(400).json({ error: 'Choose a staff role.' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: 'An account with this email already exists.' });
    const admin = await new User({ fullName, email: email.toLowerCase(), passwordHash: password, role, department: department || '' }).save();
    const { passwordHash: _, ...adminData } = admin.toObject();
    res.status(201).json({ message: `${workflow.STAFF_ROLE_LABELS[role]} account created.`, admin: adminData });
  } catch (error) { next(error); }
};

exports.toggleAdmin = async (req, res, next) => {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin || !workflow.STAFF_ROLES.includes(admin.role)) return res.status(404).json({ error: 'Staff account not found.' });
    if (admin.role === 'super_admin') return res.status(403).json({ error: 'The super admin account cannot be deactivated here.' });
    admin.isActive = !admin.isActive;
    admin.tokenVersion += 1;
    admin.refreshTokenHash = undefined;
    await admin.save();
    res.json({ message: `${admin.fullName} ${admin.isActive ? 'reactivated' : 'deactivated'}.` });
  } catch (error) { next(error); }
};
