const express = require('express');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Application = require('../models/Application');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const root = path.join(__dirname, '../../uploads');
const { isStaff } = require('../services/workflow');
const allowed = (user, owner) => isStaff(user) || String(user._id) === String(owner);
router.use(authenticate);
router.get('/documents/:id', async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    const application = document && await Application.findById(document.application);
    if (!application || !application.documents.some(id => id.equals(document._id)) || !allowed(req.user, application.student)) return res.status(404).json({ error: 'Document not found.' });
    const file = path.join(root, path.basename(document.fileName));
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Document not found.' });
    res.set('Cache-Control', 'private, no-store');
    res.download(file, document.originalName || 'document', (error) => { if (error) next(error); });
  } catch (error) { next(error); }
});
router.get('/photos/:id', async (req, res, next) => {
  try {
    if (!allowed(req.user, req.params.id)) return res.status(404).json({ error: 'Photo not found.' });
    const user = await User.findById(req.params.id);
    const name = user?.photoUrl && path.basename(user.photoUrl);
    const file = name && path.join(root, 'photos', name);
    if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'Photo not found.' });
    res.set('Cache-Control', 'private, no-store');
    res.sendFile(file, (error) => { if (error) next(error); });
  } catch (error) { next(error); }
});
module.exports = router;
