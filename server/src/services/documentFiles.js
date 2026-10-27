const fs = require('fs').promises;
const path = require('path');
const Document = require('../models/Document');
const logger = require('../utils/logger');
const root = path.resolve(__dirname, '../../uploads');

exports.validFile = async (file) => {
  const handle = await fs.open(file.path, 'r');
  const header = Buffer.alloc(8);
  try { await handle.read(header, 0, 8, 0); } finally { await handle.close(); }
  if (file.mimetype === 'application/pdf') return header.subarray(0, 5).toString() === '%PDF-';
  if (file.mimetype === 'image/png') return header.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return ['image/jpeg', 'image/jpg'].includes(file.mimetype) && header[0] === 255 && header[1] === 216 && header[2] === 255;
};

exports.metadata = (file, application) => ({
  application, fileName: file.filename, fileType: file.mimetype,
  fileSize: file.size, originalName: file.originalname
});

// Called only after detaching a document, or for a rejected new upload.
// A failed disk cleanup retains the metadata for later maintenance. Downloads
// also check application membership, so detached files cannot be accessed.
exports.discard = async (document) => {
  const target = path.resolve(root, path.basename(document.fileName));
  if (path.dirname(target) !== root) throw new Error('Invalid document path.');
  try {
    await fs.unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (document._id) await Document.deleteOne({ _id: document._id });
  } catch (error) {
    logger.warn(`Document cleanup deferred: ${document._id || document.fileName}`);
  }
};
