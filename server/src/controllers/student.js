const Application = require('../models/Application');
const Document = require('../models/Document');
const Degree = require('../models/Degree');
const Counter = require('../models/Counter');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const activity = require('../services/activity');
const documentFiles = require('../services/documentFiles');
const workflow = require('../services/workflow');
const { notify } = require('../services/notify');

const DETAIL_FIELDS = ['requestType', 'processing', 'fatherName', 'cnic', 'dateOfBirth', 'programName', 'department', 'session', 'registrationNumber', 'rollNumber', 'graduationYear', 'cgpa'];
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const editable = { $in: workflow.EDITABLE_STATUSES };

const details = (body) => {
  const set = {}; const unset = {};
  for (const field of DETAIL_FIELDS) {
    if (body[field] === undefined) continue;
    if (body[field] === '' || body[field] === null) unset[field] = '';
    else set[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
  }
  return { set, unset };
};

const load = (req) => Application.findOne({ _id: req.params.id, student: req.user._id }).populate('documents').populate('degree');

exports.getApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ student: req.user._id }).populate('documents').populate('degree').sort({ createdAt: -1 });
    res.json({ applications });
  } catch (error) { next(error); }
};

exports.getApplication = async (req, res, next) => {
  try {
    const application = await load(req);
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    res.json({ application });
  } catch (error) { next(error); }
};

// A new request starts as a draft with its application and challan numbers, so the student can pay while preparing documents.
exports.createApplication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (await Application.exists({ student: req.user._id, status: { $in: workflow.OPEN_STATUSES } })) {
      return res.status(409).json({ error: 'You already have an open request. Continue it, or wait until it is attested or closed.' });
    }
    const { set } = details(req.body);
    const year = new Date().getFullYear();
    const seq = await Counter.next(`application-${year}`);
    const application = new Application({
      ...set,
      student: req.user._id,
      fatherName: set.fatherName || req.user.fatherName,
      cnic: set.cnic || req.user.cnic,
      registrationNumber: set.registrationNumber || req.user.studentId,
      applicationNumber: workflow.yearNumber('UA', year, seq),
      fee: { challanNumber: workflow.yearNumber('CH', year, seq), amount: workflow.fee(set.requestType || 'degree', set.processing || 'normal'), issuedAt: new Date() },
      history: [activity(req.user, 'draft_created')]
    });
    await application.save();
    logger.info(`Attestation request ${application.applicationNumber} created by ${req.user._id}`);
    res.status(201).json({ message: 'Request saved as a draft.', application });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.student) return res.status(409).json({ error: 'You already have an open request.' });
    next(error);
  }
};

exports.updateApplication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const current = await Application.findOne({ _id: req.params.id, student: req.user._id, status: editable });
    if (!current) return res.status(409).json({ error: 'This request can only be edited while it is a draft or answering an objection.' });
    const { set, unset } = details(req.body);
    // The challan amount follows the request; once fee payment is verified it no longer changes.
    const requestType = set.requestType || current.requestType;
    const processing = set.processing || current.processing;
    if (!current.fee?.verified) set['fee.amount'] = workflow.fee(requestType, processing);
    const application = await Application.findOneAndUpdate({ _id: current._id, status: editable }, {
      $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}),
      $push: { history: activity(req.user, 'details_updated') }
    }, { new: true, runValidators: true }).populate('documents');
    if (!application) return res.status(409).json({ error: 'The request changed. Reload and try again.' });
    res.json({ message: 'Details saved.', application });
  } catch (error) { next(error); }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const application = await Application.findOneAndUpdate({ _id: req.params.id, student: req.user._id, status: editable, 'fee.verified': { $ne: true } }, {
      $set: { 'fee.paidOn': new Date(req.body.paidOn), 'fee.bankReference': req.body.bankReference.trim() },
      $push: { history: activity(req.user, 'payment_recorded', `Bank reference ${req.body.bankReference.trim()}`) }
    }, { new: true, runValidators: true }).populate('documents');
    if (!application) return res.status(409).json({ error: 'Payment details can only be changed before the fee is verified.' });
    res.json({ message: 'Payment details saved.', application });
  } catch (error) { next(error); }
};

// Problems that stop a request from being submitted, in the order the student meets them.
const missing = (application) => {
  const problems = [];
  if (!application.cnic || !application.fatherName || !application.dateOfBirth) problems.push('Complete your identity details (father’s name, CNIC, and date of birth).');
  if (!application.registrationNumber || !application.session) problems.push('Complete your academic details (registration number and session).');
  const kinds = new Set(application.documents.map(document => document.kind));
  const absent = workflow.requiredDocuments(application.requestType).filter(kind => !kinds.has(kind));
  if (absent.length) problems.push(`Upload: ${absent.map(kind => workflow.DOCUMENT_KINDS[kind]).join(', ')}.`);
  if (!application.fee?.paidOn || !application.fee?.bankReference) problems.push('Enter the payment date and bank reference from your paid challan.');
  const flagged = application.documents.filter(document => document.review?.status === 'flagged');
  if (application.status === 'objection' && flagged.length) problems.push(`Replace the documents marked in the objection: ${flagged.map(document => workflow.DOCUMENT_KINDS[document.kind]).join(', ')}.`);
  return problems;
};

exports.submitApplication = async (req, res, next) => {
  try {
    const application = await load(req);
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (req.body.declaration !== true) return res.status(400).json({ error: 'Confirm the declaration before submitting.' });
    if (!workflow.EDITABLE_STATUSES.includes(application.status)) {
      if (workflow.IN_REVIEW_STATUSES.includes(application.status)) return res.json({ message: 'Request already submitted.', application });
      return res.status(409).json({ error: 'This request cannot be submitted in its current state.' });
    }
    const problems = missing(application);
    if (problems.length) return res.status(400).json({ error: problems.join(' '), problems });
    const resubmission = application.status === 'objection';
    const updated = await Application.findOneAndUpdate({ _id: application._id, status: application.status, documents: { $all: application.documents.map(document => document._id) } }, {
      $set: { status: 'scrutiny', submittedAt: application.submittedAt || new Date(), declarationAcceptedAt: new Date() },
      $unset: { objection: '' },
      $push: { history: activity(req.user, resubmission ? 'resubmitted' : 'submitted') }
    }, { new: true }).populate('documents').populate('degree');
    if (!updated) return res.status(409).json({ error: 'The request changed while submitting. Reload and try again.' });
    notify(resubmission ? 'resubmitted' : 'submitted', { application: updated });
    res.json({ message: resubmission ? 'Request resubmitted for scrutiny.' : 'Request submitted for scrutiny.', application: updated });
  } catch (error) { next(error); }
};

exports.withdrawApplication = async (req, res, next) => {
  try {
    const application = await Application.findOneAndUpdate({ _id: req.params.id, student: req.user._id, status: { $in: ['draft', 'scrutiny', 'objection'] } },
      { $set: { status: 'withdrawn' }, $unset: { objection: '' }, $push: { history: activity(req.user, 'withdrawn') } }, { new: true });
    if (!application) return res.status(409).json({ error: 'Only a draft, a request awaiting scrutiny, or one with an objection can be withdrawn.' });
    res.json({ message: 'Request withdrawn.', application });
  } catch (error) { next(error); }
};

// One file per required kind: uploading a kind that already exists replaces it. "Other" may hold several files.
exports.uploadDocument = async (req, res, next) => {
  let created; let linked = false;
  try {
    const kind = req.body.kind;
    if (!Object.hasOwn(workflow.DOCUMENT_KINDS, kind)) throw fail(400, 'Choose which document this is.');
    if (!req.file) throw fail(400, 'Choose a file to upload.');
    const application = await Application.findOne({ _id: req.params.id, student: req.user._id }).populate('documents');
    if (!application) throw fail(404, 'Application not found.');
    if (!workflow.EDITABLE_STATUSES.includes(application.status)) throw fail(409, 'Documents can only be changed before submission or while answering an objection.');
    if (kind === 'fee_challan' && application.fee?.verified) throw fail(409, 'The fee has already been verified.');
    if (!await documentFiles.validFile(req.file)) throw fail(400, 'File content does not match its type. Upload a PDF, JPG, or PNG.');
    if (kind === 'photograph' && req.file.mimetype === 'application/pdf') throw fail(400, 'Upload the photograph as a JPG or PNG image.');
    const previous = kind === 'other' ? null : application.documents.find(document => document.kind === kind);
    if (kind === 'other' && application.documents.filter(document => document.kind === 'other').length >= 5) throw fail(400, 'You can attach up to five other documents.');
    created = await Document.create({ ...documentFiles.metadata(req.file, application._id), kind });
    const update = previous
      ? { filter: { documents: previous._id }, change: { $set: { 'documents.$': created._id } } }
      : { filter: {}, change: { $push: { documents: created._id } } };
    const updated = await Application.findOneAndUpdate({ _id: application._id, status: editable, ...update.filter }, {
      ...update.change,
      ...(previous ? { $pull: { 'objection.documents': previous._id } } : {}),
      $push: { ...(update.change.$push || {}), history: activity(req.user, previous ? 'document_replaced' : 'document_added', `${workflow.DOCUMENT_KINDS[kind]}: ${created.originalName}`) }
    }, { new: true }).populate('documents');
    if (!updated) throw fail(409, 'The request changed. Reload before changing documents.');
    linked = true;
    if (previous) await documentFiles.discard(previous);
    res.status(201).json({ message: previous ? 'Document replaced.' : 'Document uploaded.', document: created, application: updated });
  } catch (error) {
    if (!linked && req.file) await documentFiles.discard(created || { fileName: req.file.filename });
    next(error);
  }
};

exports.removeDocument = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, student: req.user._id });
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (!workflow.EDITABLE_STATUSES.includes(application.status)) return res.status(409).json({ error: 'Documents can only be changed before submission or while answering an objection.' });
    const document = await Document.findOne({ _id: req.params.documentId, application: application._id });
    if (!document || !application.documents.some(id => id.equals(document._id))) return res.status(404).json({ error: 'Document not found.' });
    const updated = await Application.findOneAndUpdate({ _id: application._id, status: editable, documents: document._id }, {
      $pull: { documents: document._id, 'objection.documents': document._id },
      $push: { history: activity(req.user, 'document_removed', `${workflow.DOCUMENT_KINDS[document.kind]}: ${document.originalName}`) }
    }, { new: true }).populate('documents');
    if (!updated) return res.status(409).json({ error: 'The request changed. Reload before changing documents.' });
    await documentFiles.discard(document);
    res.json({ message: 'Document removed.', application: updated });
  } catch (error) { next(error); }
};

exports.getDegrees = async (req, res, next) => {
  try {
    const degrees = await Degree.find({ student: req.user._id, issuanceStatus: 'issued' })
      .populate('application', 'programName department graduationYear applicationNumber requestType')
      .sort({ createdAt: -1 });
    res.json({ degrees });
  } catch (error) { next(error); }
};
