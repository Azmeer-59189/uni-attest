process.env.JWT_SECRET = 'test-access-secret-that-is-not-used-in-production';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-not-used-in-production';
process.env.UNIVERSITY_NAME = 'Test University';
process.env.LOG_LEVEL = 'error';
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
jest.mock('../src/services/pdf', () => ({
  generateCertificate: jest.fn(async () => '/test.pdf'),
  getCertificateUrl: hash => `/uploads/certificates/certificate-${hash}.pdf`
}));
const app = require('../src/app');
const User = require('../src/models/User');
const Application = require('../src/models/Application');
const Degree = require('../src/models/Degree');
const Document = require('../src/models/Document');
const blockchain = require('../src/services/blockchain');
const pdf = require('../src/services/pdf');
const hash = require('../src/services/hash');
jest.setTimeout(30000);
let mongo, student, other, admin, passwordHash;
const password = 'A-long-test-password-123';
const token = user => jwt.sign({ userId: user._id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '15m' });
const authorized = (method, url, user = admin) => request(app)[method](url).set('Authorization', `Bearer ${token(user)}`);
const makeApplication = async (status = 'approved') => {
  const application = await Application.create({ student: student._id, programName: 'BS Computing', department: 'Computing', graduationYear: 2026, cgpa: 0, status });
  if (['approved', 'under_review', 'issuing'].includes(status)) {
    const document = await Document.create({ application: application._id, fileName: 'fixture-transcript.pdf', originalName: 'transcript.pdf', fileType: 'application/pdf' });
    application.documents.push(document._id);
    await application.save();
  }
  return application;
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Application.init(), Degree.init(), Document.init()]);
  passwordHash = await require('bcryptjs').hash(password, 12);
}, 240000);
beforeEach(async () => {
  app.locals.rateLimiter.resetKey('::ffff:127.0.0.1');
  app.locals.rateLimiter.resetKey('127.0.0.1');
  await Promise.all([User.deleteMany({}), Application.deleteMany({}), Degree.deleteMany({}), Document.deleteMany({})]);
  [student, other, admin] = await User.insertMany([
    { email: 'student@example.com', passwordHash, fullName: 'Original Student', studentId: 'ST-1', role: 'student' },
    { email: 'other@example.com', passwordHash, fullName: 'Other Student', studentId: 'ST-2', role: 'student' },
    { email: 'admin@example.com', passwordHash, fullName: 'Admin', role: 'admin' }
  ]);
  blockchain.initialized = false;
  blockchain.networkName = 'polygon_amoy';
  blockchain.chainId = 80002;
  blockchain.contractAddress = null;
  delete process.env.BLOCKCHAIN_REQUIRED;
  delete process.env.BLOCKCHAIN_NETWORK;
  delete process.env.BLOCKCHAIN_RPC_URL;
  delete process.env.CONTRACT_ADDRESS;
  delete process.env.PRIVATE_KEY;
  pdf.generateCertificate.mockReset().mockResolvedValue('/test.pdf');
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

const draftUpload = async () => {
  const application = await makeApplication('draft');
  const base = `/api/student/applications/${application._id}`;
  const response = await authorized('post', `${base}/documents`, student).attach('documents', Buffer.from('%PDF-test'), 'original.pdf');
  expect(response.status).toBe(201);
  return { application, base, document: response.body.documents[0] };
};
const removeTestFile = document => fs.promises.unlink(path.join(__dirname, '../uploads', document.fileName)).catch(error => { if (error.code !== 'ENOENT') throw error; });

test('draft replacement validates the new file, preserves failed originals, and revokes old downloads', async () => {
  const { application, base, document } = await draftUpload();
  let replacement;
  const url = `${base}/documents/${document._id}`;
  try {
    expect((await authorized('put', url, other).attach('document', Buffer.from('%PDF-test'), 'stolen.pdf')).status).toBe(404);
    expect((await authorized('put', url, student).attach('document', Buffer.from('<html>'), 'spoof.pdf')).status).toBe(400);
    expect((await authorized('get', `/api/files/documents/${document._id}`, student)).status).toBe(200);
    expect((await Application.findById(application._id)).documents.map(String)).toEqual([document._id]);
    const response = await authorized('put', url, student).attach('document', Buffer.from('%PDF-updated'), 'corrected.pdf');
    expect(response.status).toBe(200);
    [replacement] = response.body.documents;
    expect(replacement.originalName).toBe('corrected.pdf');
    expect((await authorized('get', `/api/files/documents/${document._id}`, student)).status).toBe(404);
    expect((await authorized('get', `/api/files/documents/${replacement._id}`, student)).status).toBe(200);
    expect(fs.existsSync(path.join(__dirname, '../uploads', document.fileName))).toBe(false);
    const record = await Application.findById(application._id);
    expect(record.history.map(event => event.action)).toEqual(['documents_added', 'document_replaced']);
    expect(record.history[1].details).toBe('original.pdf → corrected.pdf');
    expect(await Document.countDocuments({ application: application._id })).toBe(1);
  } finally { await removeTestFile(document); if (replacement) await removeTestFile(replacement); }
});

test('removing the final draft document prevents submission and detached files stay private even if cleanup fails', async () => {
  const { application, base, document } = await draftUpload();
  try {
    expect((await authorized('delete', `${base}/documents/${document._id}`, other)).status).toBe(404);
    const cleanup = jest.spyOn(require('../src/services/documentFiles'), 'discard').mockResolvedValueOnce();
    const removed = await authorized('delete', `${base}/documents/${document._id}`, student);
    expect(removed.status).toBe(200);
    expect(removed.body.documents).toEqual([]);
    expect((await authorized('post', `${base}/submit`, student)).status).toBe(409);
    expect(await Document.findById(document._id)).toBeTruthy();
    expect((await authorized('get', `/api/files/documents/${document._id}`, student)).status).toBe(404);
    expect((await authorized('get', `/api/files/documents/${document._id}`, admin)).status).toBe(404);
    cleanup.mockRestore();
    const record = await Application.findById(application._id);
    expect(record.history.at(-1).action).toBe('document_removed');
    expect(record.history.at(-1).actorName).toBe(student.fullName);
  } finally { await removeTestFile(document); }
});

test('submitted documents cannot be replaced or removed, and rejected replacements leave no files', async () => {
  const { base, document } = await draftUpload();
  try {
    expect((await authorized('post', `${base}/submit`, student)).status).toBe(200);
    const before = fs.readdirSync(path.join(__dirname, '../uploads')).sort();
    expect((await authorized('put', `${base}/documents/${document._id}`, student).attach('document', Buffer.from('%PDF-new'), 'locked.pdf')).status).toBe(409);
    expect((await authorized('delete', `${base}/documents/${document._id}`, student)).status).toBe(409);
    expect(fs.readdirSync(path.join(__dirname, '../uploads')).sort()).toEqual(before);
    expect((await authorized('get', `/api/files/documents/${document._id}`, student)).status).toBe(200);
  } finally { await removeTestFile(document); }
});

test('concurrent replacement attaches one new file and cleans the losing upload', async () => {
  const { application, base, document } = await draftUpload();
  const results = await Promise.all(['first.pdf', 'second.pdf'].map(name => authorized('put', `${base}/documents/${document._id}`, student).attach('document', Buffer.from('%PDF-new'), name)));
  try {
    expect(results.filter(result => result.status === 200)).toHaveLength(1);
    expect([404, 409]).toContain(results.find(result => result.status !== 200).status);
    const record = await Application.findById(application._id).populate('documents');
    expect(record.documents).toHaveLength(1);
    expect(await Document.countDocuments({ application: application._id })).toBe(1);
    expect(record.history.filter(event => event.action === 'document_replaced')).toHaveLength(1);
  } finally {
    await removeTestFile(document);
    for (const result of results) for (const doc of result.body.documents || []) await removeTestFile(doc);
  }
});

test('submission racing removal never leaves a submitted application with no documents', async () => {
  const { application, base, document } = await draftUpload();
  try {
    const results = await Promise.all([authorized('post', `${base}/submit`, student), authorized('delete', `${base}/documents/${document._id}`, student)]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const record = await Application.findById(application._id);
    expect(record.status === 'pending' ? record.documents.length === 1 : record.status === 'draft' && record.documents.length === 0).toBe(true);
    expect(record.history).toHaveLength(2);
  } finally { await removeTestFile(document); }
});

test('admin views separate the active queue from completed records and sort the queue oldest first', async () => {
  const students = await User.insertMany(Array.from({ length: 4 }, (_, index) => ({ fullName: `Queue ${index}`, email: `queue${index}@example.com`, passwordHash, studentId: `Q-${index}` })));
  await Application.insertMany(students.map((user, index) => ({ student: user._id, programName: `Queue program ${index}`, department: 'CS', graduationYear: 2026, status: ['pending', 'under_review', 'approved', 'issuing'][index], submittedAt: new Date(Date.now() - index * 1000) })));
  await Application.insertMany(['issued', 'rejected', 'withdrawn'].map(status => ({ student: student._id, programName: 'Closed program', department: 'CS', graduationYear: 2026, status })));
  await makeApplication('draft');
  const queue = await authorized('get', '/api/admin/applications?view=active&limit=2');
  expect(queue.body.pagination).toMatchObject({ total: 4, pages: 2 });
  expect(queue.body.applications.map(record => record.status)).toEqual(['issuing', 'approved']);
  expect(queue.body.applications[0]).not.toHaveProperty('history');
  const completed = await authorized('get', '/api/admin/applications?view=history');
  expect(completed.body.pagination.total).toBe(3);
  expect(completed.body.applications.every(record => ['issued', 'rejected', 'withdrawn'].includes(record.status))).toBe(true);
  expect((await authorized('get', '/api/admin/applications?view=active&status=issued')).status).toBe(400);
  expect((await authorized('get', '/api/admin/applications?view=invalid')).status).toBe(400);
  const dashboard = await authorized('get', '/api/admin/dashboard');
  expect(dashboard.body.stats).toMatchObject({ total: 7, issuing: 1, withdrawn: 1 });
});

test('private uploads require authentication, ownership, or an admin role', async () => {
  const application = await makeApplication();
  const document = await Document.create({ application: application._id, fileName: 'integration-private.pdf', originalName: 'private.pdf', fileType: 'application/pdf' });
  await Application.updateOne({ _id: application._id }, { $push: { documents: document._id } });
  const file = path.join(__dirname, '../uploads', document.fileName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '%PDF-private');
  try {
    expect((await request(app).get(`/uploads/${document.fileName}`)).status).toBe(404);
    expect((await request(app).get('/uploads/photos/someone.jpg')).status).toBe(404);
    expect((await request(app).get(`/api/files/documents/${document._id}`)).status).toBe(401);
    expect((await authorized('get', `/api/files/documents/${document._id}`, other)).status).toBe(404);
    expect((await authorized('get', `/api/files/documents/${document._id}`, student)).status).toBe(200);
    expect((await authorized('get', `/api/files/documents/${document._id}`)).headers['content-disposition']).toContain('attachment');
  } finally { fs.unlinkSync(file); }
});

test('verification uses the saved snapshot, preserves zero CGPA, and detects tampering', async () => {
  const application = await makeApplication();
  const issued = await authorized('post', `/api/admin/applications/${application._id}/issue`);
  expect(issued.status).toBe(200);
  expect(issued.body.degree.snapshot.cgpa).toBe(0);
  await User.updateOne({ _id: student._id }, { $set: { fullName: 'Changed Profile' } });
  await Application.updateOne({ _id: application._id }, { $set: { programName: 'Changed Program' } });
  let verified = await request(app).get(`/api/verify/${issued.body.degree.hash}`);
  expect(verified.body.verified).toBe(true);
  expect(verified.body.verificationLevel).toBe('local_integrity');
  expect(verified.body.degree.studentName).toBe('Original Student');
  expect(verified.body.degree.program).toBe('BS Computing');
  await Degree.collection.updateOne({ _id: new mongoose.Types.ObjectId(issued.body.degree._id) }, { $set: { 'snapshot.studentName': 'Tampered' } });
  verified = await request(app).get(`/api/verify/${issued.body.degree.hash}`);
  expect(verified.body.verified).toBe(false);
  expect(verified.body.status).toBe('integrity_failed');
});

test('legacy records and malformed hashes do not receive a verification guarantee', async () => {
  const application = await makeApplication('issued');
  await Degree.create({ application: application._id, student: student._id, hash: 'a'.repeat(64) });
  expect((await request(app).get(`/api/verify/${'a'.repeat(64)}`)).body.status).toBe('legacy_unverified');
  expect((await request(app).get('/api/verify/not-a-hash')).status).toBe(400);
});

test('public certificate downloads require a completed snapshot and never expose photos', async () => {
  const application = await makeApplication();
  const response = await authorized('post', `/api/admin/applications/${application._id}/issue`);
  const degree = response.body.degree;
  const file = path.join(__dirname, '..', degree.pdfUrl);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '%PDF-public-certificate');
  const photo = path.join(__dirname, '../uploads/photos', 'test-private.jpg');
  fs.mkdirSync(path.dirname(photo), { recursive: true });
  fs.writeFileSync(photo, 'private-selfie');
  await User.updateOne({ _id: student._id }, { $set: { photoUrl: '/uploads/photos/test-private.jpg' } });
  try {
    expect((await request(app).get(degree.pdfUrl)).status).toBe(200);
    expect((await request(app).get('/uploads/photos/test-private.jpg')).status).toBe(404);
    expect((await authorized('get', `/api/files/photos/${student._id}`, other)).status).toBe(404);
    expect((await authorized('get', `/api/files/photos/${student._id}`, student)).status).toBe(200);
    await Degree.updateOne({ _id: degree._id }, { $set: { issuanceStatus: 'pending' } });
    expect((await request(app).get(degree.pdfUrl)).status).toBe(404);
  } finally { fs.unlinkSync(file); fs.unlinkSync(photo); }
});

test('concurrent issuance produces one record and one external submission', async () => {
  blockchain.initialized = true;
  jest.spyOn(blockchain, 'verifyDegree').mockResolvedValue({ verified: false });
  const submit = jest.spyOn(blockchain, 'issueDegree').mockImplementation(async (_, onSubmitted) => {
    await onSubmitted(`0x${'b'.repeat(64)}`);
    return { transactionHash: `0x${'b'.repeat(64)}` };
  });
  const application = await makeApplication();
  const url = `/api/admin/applications/${application._id}/issue`;
  const results = await Promise.all([authorized('post', url), authorized('post', url)]);
  expect(results.some(result => result.status === 200)).toBe(true);
  expect(results.every(result => [200, 409].includes(result.status))).toBe(true);
  expect(await Degree.countDocuments()).toBe(1);
  expect(submit).toHaveBeenCalledTimes(1);
  const again = await authorized('post', url);
  expect(again.status).toBe(200);
  expect(submit).toHaveBeenCalledTimes(1);
});

test('PDF failure can be retried with the same hash and without a second chain submission', async () => {
  blockchain.initialized = true;
  jest.spyOn(blockchain, 'verifyDegree').mockResolvedValue({ verified: false });
  const submit = jest.spyOn(blockchain, 'issueDegree').mockImplementation(async (_, onSubmitted) => {
    await onSubmitted(`0x${'c'.repeat(64)}`);
    return { transactionHash: `0x${'c'.repeat(64)}` };
  });
  pdf.generateCertificate.mockRejectedValueOnce(new Error('Simulated disk failure'));
  const application = await makeApplication();
  const url = `/api/admin/applications/${application._id}/issue`;
  expect((await authorized('post', url)).status).toBe(500);
  const pending = await Degree.findOne({ application: application._id });
  expect(pending.issuanceStatus).toBe('pending');
  expect((await request(app).get(`/api/verify/${pending.hash}`)).body.verified).toBe(false);
  expect((await authorized('patch', `/api/admin/applications/${application._id}/reject`).send({ reason: 'Too late' })).status).toBe(409);
  const retried = await authorized('post', url);
  expect(retried.status).toBe(200);
  expect(retried.body.degree.hash).toBe(pending.hash);
  expect(submit).toHaveBeenCalledTimes(1);
  const audit = (await Application.findById(application._id)).history;
  expect(audit.map(event => event.action)).toEqual(['issuance_attempted', 'issuance_failed', 'issuance_attempted', 'degree_issued']);
  expect(audit.every(event => event.actor.equals(admin._id))).toBe(true);
});

test('an expired worker lease recovers the existing hash and reconciles a successful chain transaction', async () => {
  process.env.BLOCKCHAIN_REQUIRED = 'true';
  const application = await makeApplication();
  const url = `/api/admin/applications/${application._id}/issue`;
  expect((await authorized('post', url)).status).toBe(503);
  const pending = await Degree.findOne({ application: application._id });
  await Application.updateOne({ _id: application._id }, { $set: { issuanceToken: 'crashed-worker', issuanceLeaseUntil: new Date(Date.now() - 1000) } });
  blockchain.initialized = true;
  jest.spyOn(blockchain, 'verifyDegree').mockResolvedValue({ verified: true });
  const submit = jest.spyOn(blockchain, 'issueDegree');
  const response = await authorized('post', url);
  expect(response.status).toBe(200);
  expect(response.body.degree.hash).toBe(pending.hash);
  expect(response.body.degree.blockchainStatus).toBe('confirmed');
  expect(submit).not.toHaveBeenCalled();
  expect((await request(app).get(`/api/verify/${pending.hash}`)).body.verificationLevel).toBe('blockchain');
});

test('required blockchain failures do not fall back to local issuance or successful verification', async () => {
  process.env.BLOCKCHAIN_REQUIRED = 'true';
  const application = await makeApplication();
  expect((await authorized('post', `/api/admin/applications/${application._id}/issue`)).status).toBe(503);
  const pending = await Degree.findOne({ application: application._id });
  expect(pending.blockchainRequired).toBe(true);
  await Degree.updateOne({ _id: pending._id }, { $set: { issuanceStatus: 'issued' } });
  const verified = await request(app).get(`/api/verify/${pending.hash}`);
  expect(verified.body.localIntegrityVerified).toBe(true);
  expect(verified.body.verified).toBe(false);
  expect(verified.body.status).toBe('blockchain_unverified');
});

test('issued and withdrawn applications cannot be reviewed, approved, or rejected', async () => {
  for (const status of ['issued', 'withdrawn']) {
    const application = await makeApplication(status);
    for (const action of ['review', 'approve', 'reject']) {
      const response = await authorized('patch', `/api/admin/applications/${application._id}/${action}`).send({ reason: 'Invalid transition' });
      expect(response.status).toBe(409);
    }
    expect((await Application.findById(application._id)).status).toBe(status);
  }
});

test('application validators reject invalid input and preserve zero CGPA', async () => {
  expect((await authorized('post', '/api/student/applications', student).send({ programName: '', department: 'X', graduationYear: 2026 })).status).toBe(400);
  const response = await authorized('post', '/api/student/applications', student).send({ programName: 'BS', department: 'Computing', graduationYear: 2026, cgpa: 0 });
  expect(response.status).toBe(201);
  expect(response.body.application.cgpa).toBe(0);
});

test('document uploads reject spoofed content and clean up files on authorization failure', async () => {
  const application = await makeApplication('pending');
  const url = `/api/student/applications/${application._id}/documents`;
  const uploads = path.join(__dirname, '../uploads');
  const before = fs.readdirSync(uploads).sort();
  expect((await authorized('post', url, other).attach('documents', Buffer.from('%PDF-test'), 'private.pdf')).status).toBe(404);
  expect((await authorized('post', url, student).attach('documents', Buffer.from('<html>spoof</html>'), { filename: 'fake.pdf', contentType: 'application/pdf' })).status).toBe(400);
  expect(fs.readdirSync(uploads).sort()).toEqual(before);
  const response = await authorized('post', url, student).attach('documents', Buffer.from('%PDF-test'), 'real.pdf');
  expect(response.status).toBe(201);
  try {
    expect((await Application.findById(application._id)).documents).toHaveLength(1);
    expect((await authorized('get', `/api/files/documents/${response.body.documents[0]._id}`, student)).status).toBe(200);
  } finally { fs.unlinkSync(path.join(uploads, response.body.documents[0].fileName)); }
});

test('refresh tokens rotate, cannot be replayed, and logout invalidates access and refresh tokens', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: student.email, password });
  expect(login.status).toBe(200);
  const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
  expect(refreshed.status).toBe(200);
  expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
  expect((await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })).status).toBe(401);
  expect((await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${refreshed.body.accessToken}`)).status).toBe(200);
  expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${refreshed.body.accessToken}`)).status).toBe(401);
  expect((await request(app).post('/api/auth/refresh').send({ refreshToken: refreshed.body.refreshToken })).status).toBe(401);
});

test('password changes invalidate sessions and hash passwords beginning with a bcrypt prefix', async () => {
  const nextPassword = '$2-not-a-prehashed-password';
  expect((await authorized('post', '/api/auth/change-password', student).send({ currentPassword: 'wrong', newPassword: nextPassword })).status).toBe(400);
  expect((await authorized('post', '/api/auth/change-password', student).send({ currentPassword: password, newPassword: nextPassword })).status).toBe(200);
  expect((await authorized('get', '/api/auth/me', student)).status).toBe(401);
  expect((await request(app).post('/api/auth/login').send({ email: student.email, password })).status).toBe(401);
  expect((await request(app).post('/api/auth/login').send({ email: student.email, password: nextPassword })).status).toBe(200);
});

test('legacy users without a stored tokenVersion can refresh after signing in', async () => {
  await User.collection.updateOne({ _id: student._id }, { $unset: { tokenVersion: '' } });
  const login = await request(app).post('/api/auth/login').send({ email: student.email, password });
  expect(login.status).toBe(200);
  expect((await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })).status).toBe(200);
});

test('admin deactivation revokes tokens permanently and cannot target students', async () => {
  const superAdmin = await User.create({ email: 'super@example.com', passwordHash: password, fullName: 'Super Admin', role: 'super_admin' });
  const login = await request(app).post('/api/auth/login').send({ email: admin.email, password });
  expect((await authorized('patch', `/api/admin/admins/${student._id}/toggle`, superAdmin)).status).toBe(403);
  expect((await authorized('patch', `/api/admin/admins/${admin._id}/toggle`, superAdmin)).status).toBe(200);
  expect((await authorized('patch', `/api/admin/admins/${admin._id}/toggle`, superAdmin)).status).toBe(200);
  expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`)).status).toBe(401);
  expect((await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })).status).toBe(401);
});

test('hashes are deterministic for fixed issuance data and include zero CGPA', () => {
  const data = { studentName: 'Student', studentId: 'ST-1', program: 'BS', department: 'CS', graduationYear: 2026, issuedAt: '2026-10-26T00:00:00.000Z', cgpa: 0 };
  expect(hash.generateDegreeHash(data)).toBe(hash.generateDegreeHash({ ...data }));
  expect(hash.generateDegreeHash(data)).not.toBe(hash.generateDegreeHash({ ...data, cgpa: undefined }));
});

test('a draft resumes with its documents, submits once, and follows the full review-to-issuance flow', async () => {
  const fields = { programName: 'BS Computing', department: 'Computing', graduationYear: 2026, cgpa: '' };
  const saved = await authorized('post', '/api/student/applications', student).send(fields);
  expect(saved.status).toBe(201);
  const id = saved.body.application._id;
  expect(saved.body.application.status).toBe('draft');
  expect((await authorized('get', '/api/admin/applications')).body.pagination.total).toBe(0);
  expect((await authorized('get', '/api/admin/dashboard')).body.stats.total).toBe(0);
  expect((await authorized('get', `/api/admin/applications/${id}`)).status).toBe(404);
  expect((await authorized('patch', `/api/admin/applications/${id}/review`)).status).toBe(409);
  expect((await authorized('post', `/api/student/applications/${id}/submit`, student)).status).toBe(409);
  const uploaded = await authorized('post', `/api/student/applications/${id}/documents`, student).attach('documents', Buffer.from('%PDF-test'), 'transcript.pdf');
  expect(uploaded.status).toBe(201);
  const file = path.join(__dirname, '../uploads', uploaded.body.documents[0].fileName);
  try {
    const resumed = await authorized('get', `/api/student/applications/${id}`, student);
    expect(resumed.body.application.status).toBe('draft');
    expect(resumed.body.application.documents[0].originalName).toBe('transcript.pdf');
    expect((await authorized('patch', `/api/student/applications/${id}`, student).send({ ...fields, programName: 'Updated Program' })).status).toBe(200);
    const submitted = await authorized('post', `/api/student/applications/${id}/submit`, student);
    expect(submitted.status).toBe(200);
    expect(submitted.body.application.status).toBe('pending');
    expect(submitted.body.application.submittedAt).toBeTruthy();
    expect((await authorized('post', `/api/student/applications/${id}/submit`, student)).status).toBe(200);
    expect((await authorized('patch', `/api/student/applications/${id}`, student).send(fields)).status).toBe(409);
    expect((await authorized('post', `/api/student/applications/${id}/documents`, student).attach('documents', Buffer.from('%PDF-extra'), 'extra.pdf')).status).toBe(409);
    expect((await authorized('patch', `/api/admin/applications/${id}/review`)).status).toBe(200);
    expect((await authorized('patch', `/api/admin/applications/${id}/approve`)).status).toBe(200);
    const issued = await authorized('post', `/api/admin/applications/${id}/issue`);
    expect(issued.status).toBe(200);
    expect((await request(app).get(`/api/verify/${issued.body.degree.hash}`)).body.degree.program).toBe('Updated Program');
    const record = (await authorized('get', `/api/student/applications/${id}`, student)).body.application;
    expect(record.history.map(event => event.action)).toEqual(['draft_created', 'documents_added', 'draft_updated', 'submitted', 'review_started', 'approved', 'issuance_attempted', 'degree_issued']);
    expect(record.history.slice(0, 4).every(event => event.actor === String(student._id) && event.actorName === student.fullName && event.actorRole === 'student')).toBe(true);
    expect(record.history.slice(4).every(event => event.actor === String(admin._id) && event.actorName === admin.fullName && event.actorRole === 'admin')).toBe(true);
    expect(record.history.every(event => Number.isFinite(Date.parse(event.at)))).toBe(true);
    expect((await authorized('post', `/api/admin/applications/${id}/issue`)).status).toBe(200);
    expect((await Application.findById(id)).history).toHaveLength(8);
    expect((await authorized('get', `/api/student/applications/${id}`, other)).status).toBe(404);
  } finally { fs.unlinkSync(file); }
});

test('concurrent draft creation allows only one active application, and withdrawal permits a new one', async () => {
  const fields = { programName: 'BS', department: 'CS', graduationYear: 2026 };
  const responses = await Promise.all([authorized('post', '/api/student/applications', student).send(fields), authorized('post', '/api/student/applications', student).send(fields)]);
  expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
  expect(await Application.countDocuments({ student: student._id })).toBe(1);
  const id = responses.find(response => response.status === 201).body.application._id;
  expect((await authorized('post', `/api/student/applications/${id}/submit`, other)).status).toBe(404);
  expect((await authorized('patch', `/api/student/applications/${id}/withdraw`, student)).status).toBe(200);
  expect((await authorized('post', '/api/student/applications', student).send(fields)).status).toBe(201);
});

test('legacy pending applications need documents before review and remain completable', async () => {
  const application = await makeApplication('pending');
  expect((await authorized('patch', `/api/admin/applications/${application._id}/review`)).status).toBe(409);
  const uploaded = await authorized('post', `/api/student/applications/${application._id}/documents`, student).attach('documents', Buffer.from('%PDF-legacy'), 'legacy.pdf');
  expect(uploaded.status).toBe(201);
  try {
    expect((await authorized('post', `/api/student/applications/${application._id}/submit`, student)).status).toBe(200);
    expect((await authorized('patch', `/api/admin/applications/${application._id}/review`)).status).toBe(200);
  } finally { fs.unlinkSync(path.join(__dirname, '../uploads', uploaded.body.documents[0].fileName)); }
});

test('admin search and pagination reach records beyond the first page and hide drafts', async () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ student: student._id, programName: index === 0 ? 'Needle [special]' : `Program ${index}`, department: 'CS', graduationYear: 2026, status: 'rejected', createdAt: new Date(Date.now() - (25 - index) * 1000) }));
  await Application.insertMany(rows);
  await makeApplication('draft');
  const secondPage = await authorized('get', '/api/admin/applications?page=2&limit=20');
  expect(secondPage.body.applications).toHaveLength(5);
  expect(secondPage.body.pagination.total).toBe(25);
  const search = await authorized('get', '/api/admin/applications').query({ search: 'Needle [special]' });
  expect(search.body.applications).toHaveLength(1);
  expect(search.body.applications[0].programName).toBe('Needle [special]');
  expect((await authorized('get', '/api/admin/applications').query({ search: student.fullName })).body.pagination.total).toBe(25);
  expect((await authorized('get', '/api/admin/applications?limit=0')).status).toBe(400);
  expect((await authorized('get', '/api/admin/applications?status=draft')).status).toBe(400);
});

test('local-chain proof is labeled separately and never creates an Amoy explorer link', async () => {
  blockchain.initialized = true;
  blockchain.networkName = 'hardhat_local';
  blockchain.chainId = 1337;
  blockchain.contractAddress = '0x1111111111111111111111111111111111111111';
  jest.spyOn(blockchain, 'verifyDegree').mockResolvedValue({ verified: true });
  const application = await makeApplication();
  const issued = await authorized('post', `/api/admin/applications/${application._id}/issue`);
  expect(issued.status).toBe(200);
  const response = await request(app).get(`/api/verify/${issued.body.degree.hash}`);
  expect(response.body.verified).toBe(true);
  expect(response.body.verificationLevel).toBe('local_blockchain');
  expect(response.body.degree.blockchainChainId).toBe(1337);
  expect(response.body.degree.polygonScanUrl).toBeNull();
  blockchain.networkName = 'polygon_amoy';
  blockchain.chainId = 80002;
  const wrongNetwork = await request(app).get(`/api/verify/${issued.body.degree.hash}`);
  expect(wrongNetwork.body.verified).toBe(false);
  expect(wrongNetwork.body.error).toContain('original contract');
  blockchain.networkName = 'hardhat_local';
  blockchain.chainId = 1337;
  blockchain.contractAddress = '0x2222222222222222222222222222222222222222';
  expect((await request(app).get(`/api/verify/${issued.body.degree.hash}`)).body.verified).toBe(false);
});

test('a pending issuance cannot be retried against a different contract', async () => {
  blockchain.initialized = true;
  blockchain.contractAddress = '0x1111111111111111111111111111111111111111';
  jest.spyOn(blockchain, 'verifyDegree').mockResolvedValue({ verified: true });
  pdf.generateCertificate.mockRejectedValueOnce(new Error('Simulated disk failure'));
  const application = await makeApplication();
  expect((await authorized('post', `/api/admin/applications/${application._id}/issue`)).status).toBe(500);
  blockchain.contractAddress = '0x2222222222222222222222222222222222222222';
  const retry = await authorized('post', `/api/admin/applications/${application._id}/issue`);
  expect(retry.status).toBe(409);
  expect(retry.body.error).toContain('different blockchain or contract');
});

test('password reset emails a single-use link, answers alike for unknown emails, and ends existing sessions', async () => {
  const notify = require('../src/services/notify');
  notify._setTransport(null);
  expect((await request(app).post('/api/auth/forgot-password').send({ email: student.email })).status).toBe(503);
  const sendMail = jest.fn(async () => {});
  notify._setTransport({ sendMail });
  try {
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'Student@Example.com' });
    expect([unknown.status, known.status]).toEqual([200, 200]);
    expect(known.body).toEqual(unknown.body);
    await new Promise(resolve => setImmediate(resolve));
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe(student.email);
    const resetToken = /#token=([a-f0-9]{64})/.exec(sendMail.mock.calls[0][0].text)[1];
    const stored = await User.findById(student._id).select('+passwordResetHash');
    expect(stored.passwordResetHash).not.toBe(resetToken);

    const oldSession = token(student);
    expect((await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: 'short' })).status).toBe(400);
    const reset = await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: 'A-brand-new-password-456' });
    expect(reset.status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: 'Another-new-password-789' })).status).toBe(400);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldSession}`)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: student.email, password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: student.email, password: 'A-brand-new-password-456' })).status).toBe(200);

    await request(app).post('/api/auth/forgot-password').send({ email: other.email });
    await new Promise(resolve => setImmediate(resolve));
    const expiredToken = /#token=([a-f0-9]{64})/.exec(sendMail.mock.calls[1][0].text)[1];
    await User.updateOne({ _id: other._id }, { $set: { passwordResetExpires: new Date(Date.now() - 1000) } });
    expect((await request(app).post('/api/auth/reset-password').send({ token: expiredToken, newPassword: 'A-brand-new-password-456' })).status).toBe(400);
  } finally {
    notify._setTransport(null);
  }
});
