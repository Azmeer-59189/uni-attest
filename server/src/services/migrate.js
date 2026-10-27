const Application = require('../models/Application');
const Document = require('../models/Document');
const Counter = require('../models/Counter');
const workflow = require('./workflow');
const logger = require('../utils/logger');

// Moves records created before the staged workflow onto it. Safe to run on every start.
exports.run = async () => {
  const moved = await Promise.all([
    Application.updateMany({ status: { $in: ['pending', 'under_review'] } }, { $set: { status: 'scrutiny' } }),
    Application.updateMany({ status: 'approved' }, { $set: { status: 'registrar_approval' } }),
    Application.updateMany({ requestType: { $exists: false } }, { $set: { requestType: 'degree', processing: 'normal' } }),
    Document.updateMany({ kind: { $exists: false } }, { $set: { kind: 'other' } })
  ]);
  for (const application of await Application.find({ applicationNumber: { $exists: false } }).select('createdAt requestType processing')) {
    const year = (application.createdAt || new Date()).getFullYear();
    const seq = await Counter.next(`application-${year}`);
    await Application.updateOne({ _id: application._id, applicationNumber: { $exists: false } }, { $set: {
      applicationNumber: workflow.yearNumber('UA', year, seq),
      'fee.challanNumber': workflow.yearNumber('CH', year, seq),
      'fee.amount': workflow.fee(application.requestType || 'degree', application.processing || 'normal')
    } });
  }
  // Replaces the earlier one-active-application index, whose status list predates the staged workflow.
  await Application.syncIndexes();
  const changed = moved.reduce((total, result) => total + result.modifiedCount, 0);
  if (changed) logger.info(`Workflow migration updated ${changed} records.`);
};
