// Run explicitly with npm run test:flow. Uses an isolated database and local browser.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const puppeteer = require('puppeteer');

async function main() {
  const originalDirectory = process.cwd();
  let mongo, apiServer, vite, browser, temporary;
  const files = [];
  try {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_SECRET = 'isolated-browser-test-access-secret';
    process.env.REFRESH_TOKEN_SECRET = 'isolated-browser-test-refresh-secret';
    process.env.UNIVERSITY_NAME = 'Flow Test University';
    process.env.LOG_LEVEL = 'error';
    const app = require('../src/app');
    // Capture status emails instead of sending them.
    const mailbox = [];
    require('../src/services/notify')._setTransport({ sendMail: async message => { mailbox.push(message); } });
    const mailFor = (to, subject) => mailbox.find(mail => mail.to === to && subject.test(mail.subject));
    delete process.env.PRIVATE_KEY;
    delete process.env.CONTRACT_ADDRESS;
    process.env.BLOCKCHAIN_REQUIRED = 'false';
    await mongoose.connect(mongo.getUri());
    const User = require('../src/models/User');
    const Application = require('../src/models/Application');
    const Degree = require('../src/models/Degree');
    const Document = require('../src/models/Document');
    await Promise.all([User.init(), Application.init(), Degree.init(), Document.init()]);
    const password = 'Isolated-browser-password-123';
    await User.create([
      { email: 'flow-student@example.com', fullName: 'Flow Test Student', studentId: 'FLOW-1', department: 'Computing', passwordHash: password },
      { email: 'flow-admin@example.com', fullName: 'Flow Test Admin', role: 'admin', passwordHash: password }
    ]);
    const flowStudent = await User.findOne({ email: 'flow-student@example.com' });
    const queueStudents = await User.insertMany(Array.from({ length: 18 }, (_, index) => ({ email: `queue-${index}@example.com`, fullName: `Queue Student ${String(index + 1).padStart(2, '0')}`, studentId: `QUEUE-${index}`, passwordHash: flowStudent.passwordHash })));
    await Application.insertMany(queueStudents.map((student, index) => ({ student: student._id, programName: index === 0 ? 'Bachelor of Computing and Information Systems with Professional Practice' : 'BS Computing', department: 'Computing', graduationYear: 2026, status: 'pending', submittedAt: new Date(Date.now() - (index + 1) * 60000) })));
    await Application.insertMany(Array.from({ length: 15 }, (_, index) => ({ student: flowStudent._id, programName: `Earlier application ${index + 1}`, department: 'Computing', graduationYear: 2026, status: index % 2 ? 'rejected' : 'withdrawn' })));
    apiServer = app.listen(0, '127.0.0.1');
    await new Promise(resolve => apiServer.once('listening', resolve));
    const target = `http://127.0.0.1:${apiServer.address().port}`;
    const { createServer } = await import(pathToFileURL(path.resolve(__dirname, '../../client/node_modules/vite/dist/node/index.js')).href);
    process.chdir(path.resolve(__dirname, '../../client'));
    vite = await createServer({
      root: path.resolve(__dirname, '../../client'),
      configFile: path.resolve(__dirname, '../../client/vite.config.js'),
      server: { port: 0, host: '127.0.0.1', proxy: { '/api': { target, changeOrigin: true }, '/uploads/certificates': { target, changeOrigin: true } } },
      logLevel: 'error'
    });
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    process.env.CLIENT_URL = origin;
    console.log('Starting isolated browser flow...');
    browser = await puppeteer.launch({ headless: 'new', timeout: 15000 });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const artifacts = path.resolve(__dirname, '../test-artifacts');
    await fs.mkdir(artifacts, { recursive: true });
    const screenshot = async name => {
      await page.waitForFunction(() => !document.querySelector('.page-enter') || Number(getComputedStyle(document.querySelector('.page-enter')).opacity) > 0.99);
      return page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
    };
    const waitText = text => page.waitForFunction(value => document.body.innerText.toLowerCase().includes(value.toLowerCase()), {}, text);
    // The staff queue: a list of row buttons beside the open record.
    const queueSettled = rows => page.waitForFunction(count => document.querySelector('.console-queue ul[aria-busy="false"]') && document.querySelectorAll('.queue-row').length === count, {}, rows);
    const clickText = async text => {
      await waitText(text);
      const clicked = await page.evaluate(value => {
        const element = [...document.querySelectorAll('button, a')].find(item => item.textContent.trim() === value);
        if (!element || element.disabled) return false;
        element.click(); return true;
      }, text);
      assert(clicked, `Could not click: ${text}`);
    };
    const login = async email => {
      await page.goto(`${origin}/login`);
      await page.waitForSelector('input[type="email"]');
      await page.type('input[type="email"]', email);
      await page.type('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForFunction(() => location.pathname.endsWith('/dashboard'));
    };

    console.log('Checking student login and draft...');
    await page.goto(origin);
    await screenshot('home-desktop');
    await login('flow-student@example.com');
    await clickText('Start your application');
    await page.waitForSelector('input[maxlength="150"]');
    await page.type('input[maxlength="150"]', 'BS Computing');
    await page.type('input[list="departments"]', 'Computing');
    // Deliberately leave CGPA blank to cover the optional-field regression.
    await clickText('Save draft & continue');
    await waitText('Skip optional check');
    await page.reload();
    await page.waitForSelector('input[maxlength="150"]');
    assert.equal(await page.$eval('input[maxlength="150"]', input => input.value), 'BS Computing');
    await clickText('Save draft & continue');
    await clickText('Skip optional check');
    await screenshot('application-desktop');
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'uniattest-flow-'));
    const transcript = path.join(temporary, 'transcript.pdf');
    await fs.writeFile(transcript, '%PDF-1.4\nIsolated test upload');
    await page.waitForSelector('input[type="file"][multiple]');
    await (await page.$('input[type="file"][multiple]')).uploadFile(transcript);
    await waitText('transcript.pdf');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Submit application for review' && !button.disabled));
    const stored = await Document.findOne({ originalName: 'transcript.pdf' });
    files.push(path.resolve(__dirname, '../uploads', stored.fileName));
    const corrected = path.join(temporary, 'corrected-transcript.pdf');
    await fs.writeFile(corrected, '%PDF-1.4\nCorrected isolated test upload');
    await (await page.$('[aria-label="Replace transcript.pdf"]')).uploadFile(corrected);
    await waitText('Document replaced.');
    const replacement = await Document.findOne({ originalName: 'corrected-transcript.pdf' });
    files.push(path.resolve(__dirname, '../uploads', replacement.fileName));
    await (await page.$('input[type="file"][multiple]')).uploadFile(transcript);
    await page.waitForSelector('[aria-label="Remove transcript.pdf"]:not([disabled])');
    const extra = await Document.findOne({ originalName: 'transcript.pdf' });
    files.push(path.resolve(__dirname, '../uploads', extra.fileName));
    await page.click('[aria-label="Remove transcript.pdf"]');
    await page.waitForSelector('dialog[open]');
    await clickText('Remove document');
    await page.waitForFunction(() => !document.querySelector('dialog'));
    await waitText('Document removed.');
    assert.equal(await page.$('[aria-label="Remove transcript.pdf"]'), null);
    await clickText('Submit application for review');
    await waitText('Application submitted');
    await clickText('Go to overview');
    assert(mailFor('flow-student@example.com', /^We received your application/), 'Submission email was not sent');
    await waitText('Waiting for review');
    await fs.mkdir(path.resolve(__dirname, '../test-artifacts'), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, '../test-artifacts/student-dashboard.png'), fullPage: true });
    const submittedApplication = await Application.findOne({ student: flowStudent._id, status: 'pending' });
    await page.goto(`${origin}/student/applications/${submittedApplication._id}`);
    await waitText('Activity history');
    await waitText('Document replaced');
    await waitText('Document removed');
    await screenshot('student-history');
    await clickText('Sign out');
    // Sign-out redirects home; let it finish before navigating, or the two navigations race.
    await page.waitForFunction(() => location.pathname === '/' && !document.querySelector('[aria-controls="mobile-menu"]')?.closest('header')?.innerText.includes('Sign out'));

    console.log('Checking admin review and issuance...');
    await login('flow-admin@example.com');
    await waitText('Application queue');
    await queueSettled(19);
    await screenshot('admin-dashboard');
    await page.goto(`${origin}/admin/dashboard?limit=10`);
    await queueSettled(10);
    await clickText('Next');
    await queueSettled(9);
    await clickText('Prev');
    await queueSettled(10);
    await page.type('input[type="search"]', 'Flow Test Student');
    await queueSettled(1);
    const recordRow = `#queue-${submittedApplication._id}`;
    await page.focus(recordRow);
    await page.keyboard.press('Enter');
    await waitText('Supporting documents');
    await page.waitForSelector('[aria-label="Download corrected-transcript.pdf"]');
    assert.equal(await page.$eval(recordRow, row => row.getAttribute('aria-current')), 'true', 'The open record should be marked in the queue');
    const filteredURL = page.url();
    assert(filteredURL.includes('search=Flow') && filteredURL.includes(`selected=${submittedApplication._id}`), 'Opening a record should keep the queue filters');
    await clickText('Open as page');
    await waitText('Back to the queue');
    await clickText('Back to the queue');
    await page.waitForSelector(recordRow);
    assert.equal(page.url(), filteredURL, 'Returning from a record page should preserve queue filters');
    await waitText('Activity history');
    await screenshot('admin-detail');
    await clickText('Start review');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Approve' && !button.disabled));
    await clickText('Approve');
    await page.waitForSelector('dialog[open]');
    assert(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'Dialog should receive focus');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog'));
    await clickText('Approve');
    await clickText('Confirm approval');
    await page.waitForFunction(() => !document.querySelector('dialog'));
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Issue degree' && !button.disabled));
    await clickText('Issue degree');
    await clickText('Confirm issuance');
    await waitText('Certificate issued successfully.');
    assert(mailFor('flow-student@example.com', /^Your application was approved/), 'Approval email was not sent');
    const degree = await Degree.findOne({ issuanceStatus: 'issued' });
    assert(degree, 'Degree was not issued');
    const issuedMail = mailFor('flow-student@example.com', /^Your certificate is ready/);
    assert(issuedMail && issuedMail.text.includes(`/verify/${degree.hash}`), 'Issuance email was not sent with the verification link');
    files.push(path.resolve(__dirname, '..', degree.pdfUrl.replace(/^\//, '')));
    await page.goto(`${origin}/verify/${degree.hash}`);
    // No click: direct links and certificate QR codes should verify automatically.
    await waitText('Issued details verified by the university');
    await waitText('Flow Test Student');
    assert.equal((await Application.findById(submittedApplication._id)).status, 'issued');
    const certificate = await fetch(`${origin}${degree.pdfUrl}`);
    assert.equal(certificate.status, 200);
    assert.equal(Buffer.from(await certificate.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.resolve(__dirname, '../test-artifacts/verification-mobile.png'), fullPage: true });
    const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map(element => ({ tag: element.tagName, className: element.className })));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Verification page overflows on mobile: ${JSON.stringify(overflow)}`);
    await page.goto(`${origin}/admin/dashboard?limit=10`);
    await waitText('Application queue');
    await queueSettled(10);
    await screenshot('admin-mobile');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Admin workspace overflows on mobile');
    await page.click('[aria-controls="mobile-menu"]');
    await page.waitForFunction(() => document.querySelector('[aria-controls="mobile-menu"]').getAttribute('aria-expanded') === 'true' && document.getElementById('mobile-menu'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('[aria-controls="mobile-menu"]').getAttribute('aria-expanded') === 'false');
    await page.setViewport({ width: 768, height: 1024 });
    await screenshot('admin-tablet');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Admin inbox overflows on tablet');
    await page.setViewport({ width: 390, height: 844 });
    await page.click('.queue-row');
    await waitText('Supporting documents');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Reject' && !button.disabled));
    await clickText('Reject');
    await page.waitForSelector('dialog[open]');
    assert(await page.evaluate(() => [...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Confirm rejection').disabled), 'Rejection requires a reason');
    await page.type('dialog textarea', 'Please provide a complete transcript.');
    await screenshot('admin-rejection-mobile');
    await clickText('Confirm rejection');
    await page.waitForFunction(() => !document.querySelector('dialog'));
    await waitText('Reason for rejection:');
    const rejection = mailbox.find(mail => /^Your application needs attention/.test(mail.subject));
    assert(rejection && /^queue-\d+@example\.com$/.test(rejection.to) && rejection.text.includes('Please provide a complete transcript.'), 'Rejection email was not sent with the reason');
    assert.equal(mailbox.length, 4, `Expected exactly four status emails, got: ${mailbox.map(mail => mail.subject).join(' | ')}`);
    await waitText('Application rejected');
    await clickText('Back to queue');
    await page.waitForFunction(() => document.querySelector('.console-queue ul[aria-busy="false"]') && !new URLSearchParams(location.search).get('selected'));
    await page.evaluate(() => [...document.querySelectorAll('.console-tabs button')].find(button => button.textContent.startsWith('Completed')).click());
    await page.waitForSelector(recordRow);
    await page.click(recordRow);
    await waitText('Certificate issued');
    await screenshot('admin-detail-mobile');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Application details overflow on mobile');
    assert.deepEqual(errors, [], 'Browser reported JavaScript errors');
    console.log('PASS: draft resume, document replacement/removal, activity history, queue pagination, preserved filters, split-view record, keyboard navigation, review, approval, real PDF issuance, status emails, automatic verification, and desktop/tablet/mobile layouts.');
  } finally {
    if (browser) await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
    if (vite) await vite.close();
    process.chdir(originalDirectory);
    if (apiServer) await new Promise(resolve => apiServer.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    await Promise.all(files.map(file => fs.unlink(file).catch(() => {})));
    if (temporary) {
      await fs.unlink(path.join(temporary, 'transcript.pdf')).catch(() => {});
      await fs.unlink(path.join(temporary, 'corrected-transcript.pdf')).catch(() => {});
      await fs.rmdir(temporary);
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
