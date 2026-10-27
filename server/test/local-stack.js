const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { fork } = require('node:child_process');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const apiUrl = 'http://127.0.0.1:15000';
  let mongo, stack, certificate;
  let output = '';
  try {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    const secret = 'isolated-local-blockchain-test-secret';
    stack = fork(path.resolve(__dirname, '../../scripts/start-local.js'), [], {
      cwd: path.resolve(__dirname, '../..'), silent: true,
      env: { ...process.env, LOCAL_API_PORT: '15000', LOCAL_WEB_PORT: '15173', LOCAL_CHAIN_PORT: '18545', MONGODB_URI: mongo.getUri(), JWT_SECRET: secret, REFRESH_TOKEN_SECRET: `${secret}-refresh`, UNIVERSITY_NAME: 'Local Chain Test University', LOG_LEVEL: 'error' }
    });
    stack.stdout.on('data', bytes => { output = (output + bytes.toString()).slice(-12000); });
    stack.stderr.on('data', bytes => { output = (output + bytes.toString()).slice(-12000); });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (stack.exitCode != null) throw new Error(output || 'Local stack exited before startup.');
      try { ready = (await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(1000) })).ok; } catch (_) {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(ready, `Local stack did not become ready: ${output}`);
    await mongoose.connect(mongo.getUri());
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    const Document = require('../src/models/Document');
    const [student, admin] = await User.create([
      { fullName: 'Local Test Student', studentId: 'LOCAL-1', email: 'local-student@example.com', passwordHash: 'Isolated-test-password' },
      { fullName: 'Local Test Admin', email: 'local-admin@example.com', role: 'admin', passwordHash: 'Isolated-test-password' }
    ]);
    const application = await Application.create({ student: student._id, programName: 'BS Computing', department: 'Computing', graduationYear: 2026, applicationNumber: 'UA-2026-900001', status: 'registrar_approval' });
    const document = await Document.create({ application: application._id, fileName: 'local-test-fixture.pdf', fileType: 'application/pdf' });
    application.documents.push(document._id);
    await application.save();
    const token = jwt.sign({ userId: admin._id, tokenVersion: 0 }, secret, { expiresIn: '5m' });
    const issued = await fetch(`${apiUrl}/api/admin/applications/${application._id}/issue`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    });
    const result = await issued.json();
    assert.equal(issued.status, 200, JSON.stringify(result));
    certificate = path.resolve(__dirname, '..', result.degree.pdfUrl.replace(/^\//, ''));
    assert.equal(result.degree.blockchainNetwork, 'hardhat_local');
    assert.equal(result.degree.blockchainChainId, 1337);
    assert(result.degree.blockchainContract);
    assert.match(result.degree.blockchainTx, /^0x[a-f0-9]{64}$/);
    const verification = await (await fetch(`${apiUrl}/api/verify/${result.degree.hash}`)).json();
    assert.equal(verification.verified, true);
    assert.equal(verification.verificationLevel, 'local_blockchain');
    assert.equal(verification.degree.polygonScanUrl, null);
    const pdf = await fetch(`${apiUrl}${result.degree.pdfUrl}`);
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await fetch('http://127.0.0.1:15173')).status, 200);
    console.log('PASS: one-command local startup, real contract deployment, on-chain issuance, verification, PDF download, and frontend. No public-chain funds or private key used.');
  } finally {
    if (stack && stack.exitCode == null) {
      const exit = new Promise(resolve => stack.once('exit', resolve));
      if (stack.connected) stack.send('stop');
      await Promise.race([exit, new Promise(resolve => setTimeout(resolve, 10000))]);
      if (stack.exitCode == null) stack.kill();
    }
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    if (certificate) await fs.unlink(certificate).catch(() => {});
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
