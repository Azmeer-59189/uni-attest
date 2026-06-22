const Application = require('../models/Application');
const Document = require('../models/Document');
const Degree = require('../models/Degree');
const logger = require('../utils/logger');

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
    const { programName, department, graduationYear, cgpa } = req.body;

const existingApp = await Application.findOne({
  student: req.user._id,
  status: { $in: ['pending', 'under_review', 'approved'] }
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
      cgpa: cgpa || undefined
    });
    await application.save();

    logger.info(`New application created: ${application._id} by student ${req.user._id}`);

    res.status(201).json({
      message: 'Application submitted successfully',
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

exports.uploadDocuments = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      student: req.user._id
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot upload documents. Application is not pending.' });
    }

    const documents = await Promise.all(
      req.files.map(async (file) => {
        const document = new Document({
          application: application._id,
          fileName: file.filename,
          fileType: file.mimetype,
          fileSize: file.size,
          originalName: file.originalname
        });
        await document.save();
        return document;
      })
    );

    // ✅ FIX: link document IDs back to the application
    application.documents.push(...documents.map(d => d._id));
    await application.save();

    logger.info(`${documents.length} document(s) uploaded for application ${application._id}`);

    res.status(201).json({
      message: 'Documents uploaded successfully',
      documents
    });
  } catch (error) {
    next(error);
  }
};

exports.getDegrees = async (req, res, next) => {
  try {
    const degrees = await Degree.find({ student: req.user._id })
      .populate('application', 'programName department graduationYear')
      .sort({ createdAt: -1 });
    res.json({ degrees });
  } catch (error) {
    next(error);
  }
};

exports.withdrawApplication = async (req, res, next) => {
  try {
    const app = await Application.findOne({
      _id: req.params.id,
      student: req.user._id,
      status: 'pending'
    })
    if (!app) return res.status(404).json({ error: 'Application not found or cannot be withdrawn' })
    app.status = 'withdrawn'
    await app.save()
    res.json({ message: 'Application withdrawn successfully' })
  } catch (err) {
    next(err)
  }
}