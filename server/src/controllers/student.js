const Application = require('../models/Application');
const Document = require('../models/Document');
const Degree = require('../models/Degree');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const fs = require('fs').promises;
const activity = require('../services/activity');
const documentFiles = require('../services/documentFiles');
const { notify } = require('../services/notify');

exports.getApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ student: req.user._id })
      .populate('documents')
      .populate('degree')
      .sort({ createdAt: -1 });
    res.json({ applications });
  } catch (error) {
    next(error);
  }
};

exports.createApplication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { programName, department, graduationYear, cgpa } = req.body;

const existingApp = await Application.findOne({
  student: req.user._id,
  status: { $in: ['draft', 'pending', 'under_review', 'approved', 'issuing'] }
});

if (existingApp) {
  return res.status(409).json({
    error: 'You already have an active application. Please wait for it to be processed.'
  });
}

    const application = new Application({
      student: req.user._id,
      programName,
      department,
      graduationYear,
      cgpa: cgpa === '' ? undefined : cgpa,
      history: [activity(req.user, 'draft_created')]
    });
    await application.save();

    logger.info(`New application created: ${application._id} by student ${req.user._id}`);

    res.status(201).json({
      message: 'Draft saved. Upload documents and submit it for review when ready.',
      application
    });
  } catch (error) {
    next(error);
  }
};

exports.getApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      student: req.user._id
    }).populate('documents').populate('degree');

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    res.json({ application });
  } catch (error) {
    next(error);
  }
};

exports.updateApplication = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { programName, department, graduationYear, cgpa } = req.body;
    const application = await Application.findOneAndUpdate({ _id: req.params.id, student: req.user._id, status: 'draft' }, {
      $set: { programName, department, graduationYear, ...(cgpa !== '' && cgpa != null ? { cgpa } : {}) },
      $push: { history: activity(req.user, 'draft_updated') },
      ...(cgpa === '' || cgpa == null ? { $unset: { cgpa: '' } } : {})
    }, { new: true, runValidators: true });
    if (!application) return res.status(409).json({ error: 'Only your saved draft can be edited.' });
    res.json({ message: 'Draft updated.', application });
  } catch (error) { next(error); }
};

exports.submitApplication = async (req, res, next) => {
  try {
    const application = await Application.findOneAndUpdate({
      _id: req.params.id, student: req.user._id, status: 'draft', 'documents.0': { $exists: true }
    }, { $set: { status: 'pending', submittedAt: new Date() }, $push: { history: activity(req.user, 'submitted') } }, { new: true, runValidators: true });
    if (application) {
      notify('submitted', { application });
      return res.json({ message: 'Application submitted for review.', application });
    }
    const existing = await Application.findOne({ _id: req.params.id, student: req.user._id });
    if (!existing) return res.status(404).json({ error: 'Application not found.' });
    if (existing.status === 'pending' && existing.documents.length) return res.json({ message: 'Application already submitted.', application: existing });
    return res.status(409).json({ error: existing.status === 'draft' ? 'Upload at least one supporting document before submitting.' : 'This application cannot be submitted in its current state.' });
  } catch (error) { next(error); }
};

exports.uploadDocuments = async (req, res, next) => {
  const files = req.files || [];
  let linked = false;
  const cleanup = async () => {
    if (!linked && files.length) {
      await Document.deleteMany({ fileName: { $in: files.map(file => file.filename) } }).catch(() => {});
      await Promise.all(files.map(file => fs.unlink(file.path).catch(() => {})));
    }
  };
  const reject = async (status, error) => { await cleanup(); return res.status(status).json({ error }); };
  try {
    const editable = { _id: req.params.id, student: req.user._id, $or: [{ status: 'draft' }, { status: 'pending', submittedAt: { $exists: false } }] };
    const application = await Application.findOne({ _id: req.params.id, student: req.user._id });
    if (!application) return await reject(404, 'Application not found.');
    if (application.status !== 'draft' && !(application.status === 'pending' && !application.submittedAt)) return await reject(409, 'Documents can only be added before submission.');
    if (!files.length) return await reject(400, 'Choose at least one document.');
    for (const file of files) {
      if (!await documentFiles.validFile(file)) return await reject(400, 'Document content does not match its declared file type.');
    }
    const documents = await Document.insertMany(files.map(file => ({
      application: application._id, fileName: file.filename, fileType: file.mimetype,
      fileSize: file.size, originalName: file.originalname
    })));
    const updated = await Application.updateOne(editable, {
      $addToSet: { documents: { $each: documents.map(document => document._id) } },
      $push: { history: activity(req.user, 'documents_added', documents.map(doc => doc.originalName).join(', ')) }
    });
    if (!updated.matchedCount) return await reject(409, 'Application status changed. Documents were not attached.');
    linked = true;
    res.status(201).json({ message: 'Documents uploaded successfully', documents });
  } catch (error) { await cleanup(); next(error); }
};

exports.getDegrees = async (req, res, next) => {
  try {
    const degrees = await Degree.find({ student: req.user._id, issuanceStatus: 'issued' })
      .populate('application', 'programName department graduationYear')
      .sort({ createdAt: -1 });
    res.json({ degrees });
  } catch (error) {
    next(error);
  }
};

exports.withdrawApplication = async (req, res, next) => {
  try {
    const app = await Application.findOneAndUpdate({
      _id: req.params.id, student: req.user._id, status: { $in: ['draft', 'pending'] }
    }, { $set: { status: 'withdrawn' }, $push: { history: activity(req.user, 'withdrawn') } }, { new: true })
    if (!app) return res.status(404).json({ error: 'Application not found or cannot be withdrawn' })
    res.json({ message: 'Application withdrawn successfully' })
  } catch (err) { next(err) }
}

// The draft condition and original document membership are checked in the same
// write as the change. Submission and concurrent replacements cannot bypass it.
exports.removeDocument = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, student: req.user._id });
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (application.status !== 'draft') return res.status(409).json({ error: 'Only draft documents can be changed.' });
    const document = await Document.findOne({ _id: req.params.documentId, application: application._id });
    if (!document || !application.documents.some(id => id.equals(document._id))) return res.status(404).json({ error: 'Document not found.' });
    const updated = await Application.findOneAndUpdate({ _id: application._id, student: req.user._id, status: 'draft', documents: document._id }, {
      $pull: { documents: document._id },
      $push: { history: activity(req.user, 'document_removed', document.originalName) }
    }, { new: true }).populate('documents');
    if (!updated) return res.status(409).json({ error: 'Application changed. Reload before editing documents.' });
    await documentFiles.discard(document);
    res.json({ message: 'Document removed.', documents: updated.documents });
  } catch (error) { next(error); }
};

exports.replaceDocument = async (req, res, next) => {
  let replacement;
  let linked = false;
  try {
    const application = await Application.findOne({ _id: req.params.id, student: req.user._id });
    const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
    if (!application) fail(404, 'Application not found.');
    if (application.status !== 'draft') fail(409, 'Only draft documents can be changed.');
    const original = await Document.findOne({ _id: req.params.documentId, application: application._id });
    if (!original || !application.documents.some(id => id.equals(original._id))) fail(404, 'Document not found.');
    if (!req.file) fail(400, 'Choose a replacement document.');
    if (!await documentFiles.validFile(req.file)) fail(400, 'Document content does not match its declared file type.');
    replacement = await Document.create(documentFiles.metadata(req.file, application._id));
    const updated = await Application.findOneAndUpdate({ _id: application._id, student: req.user._id, status: 'draft', documents: original._id }, {
      $set: { 'documents.$': replacement._id },
      $push: { history: activity(req.user, 'document_replaced', `${original.originalName} → ${replacement.originalName}`) }
    }, { new: true }).populate('documents');
    if (!updated) fail(409, 'Application changed. Reload before editing documents.');
    linked = true;
    await documentFiles.discard(original);
    res.json({ message: 'Document replaced.', documents: updated.documents });
  } catch (error) {
    if (!linked && req.file) await documentFiles.discard(replacement || { fileName: req.file.filename });
    next(error);
  }
};
