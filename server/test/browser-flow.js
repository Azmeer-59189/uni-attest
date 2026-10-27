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
      { email: 'flow-student@example.com', fullName: 'Flow Test Student', fatherName: 'Flow Test Father', cnic: '35202-7654321-9', studentId: '2020-FLOW-01', department: 'Computing', passwordHash: password },
      { email: 'flow-scrutiny@example.com', fullName: 'Flow Scrutiny Officer', role: 'scrutiny', passwordHash: password },
      { email: 'flow-exam@example.com', fullName: 'Flow Exam Officer', role: 'examination', passwordHash: password },
      { email: 'flow-registrar@example.com', fullName: 'Flow Registrar', role: 'registrar', passwordHash: password }
    ]);
    const flowStudent = await User.findOne({ email: 'flow-student@example.com' });
    const queueStudents = await User.insertMany(Array.from({ length: 18 }, (_, index) => ({ email: `queue-${index}@example.com`, fullName: `Queue Student ${String(index + 1).padStart(2, '0')}`, studentId: `QUEUE-${index}`, passwordHash: flowStudent.passwordHash })));
    await Application.insertMany(queueStudents.map((student, index) => ({ student: student._id, applicationNumber: `UA-2025-${String(index + 1).padStart(6, '0')}`, programName: index === 0 ? 'Bachelor of Computing and Information Systems with Professional Practice' : 'BS Computing', department: 'Computing', graduationYear: 2024, status: 'scrutiny', processing: index % 4 ? 'normal' : 'urgent', submittedAt: new Date(Date.now() - (index + 1) * 60000) })));
    await Application.insertMany(Array.from({ length: 15 }, (_, index) => ({ student: flowStudent._id, programName: `Earlier request ${index + 1}`, department: 'Computing', graduationYear: 2024, status: index % 2 ? 'rejected' : 'withdrawn' })));
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
      await page.waitForFunction(value => [...document.querySelectorAll('button, a')].some(item => item.textContent.trim() === value && !item.disabled), {}, text);
      await page.evaluate(value => [...document.querySelectorAll('button, a')].find(item => item.textContent.trim() === value && !item.disabled).click(), text);
    };
    // Sets a form field by its label text, the way React expects a user edit to arrive.
    const fill = (label, value) => page.evaluate((text, next) => {
      const field = [...document.querySelectorAll('label')].find(item => item.textContent.trim().startsWith(text))?.querySelector('input, textarea, select');
      if (!field) throw new Error(`No field labelled ${text}`);
      const prototype = field.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, next);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }, label, String(value));
    const uploadAs = async (kind, file) => {
      const input = await page.waitForSelector(`input[type="file"][aria-label="Upload ${kind}"]:not([disabled])`);
      await input.uploadFile(file);
    };
    // Clicks a button inside the document row with the given title, e.g. Accept on "Degree certificate".
    const clickInDocument = async (kind, label) => {
      await page.waitForFunction((title, text) => [...document.querySelectorAll('li')].some(row => row.querySelector('p')?.textContent === title && [...row.querySelectorAll('button')].some(button => button.textContent.trim() === text && !button.disabled)), {}, kind, label);
      await page.evaluate((title, text) => [...[...document.querySelectorAll('li')].find(row => row.querySelector('p')?.textContent === title).querySelectorAll('button')].find(button => button.textContent.trim() === text).click(), kind, label);
    };
    // One browser makes far more requests than a person would; keep the per-IP limit from cutting the walkthrough short.
    const resetRateLimit = () => ['127.0.0.1', '::ffff:127.0.0.1'].forEach(key => { app.locals.rateLimiter.resetKey(key); app.locals.loginLimiter.resetKey(key); });
    const login = async email => {
      resetRateLimit();
      await page.evaluate(() => localStorage.clear()).catch(() => {});
      await page.goto(`${origin}/login`);
      await page.waitForSelector('input[type="email"]');
      await page.type('input[type="email"]', email);
      await page.type('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForFunction(() => location.pathname.endsWith('/dashboard'));
    };
    const noOverflow = async where => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${where} overflows horizontally`);

    temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'uniattest-flow-'));
    const pdfFile = async name => { const file = path.join(temporary, name); await fs.writeFile(file, `%PDF-1.4\n${name}`); return file; };
    const pngFile = path.join(temporary, 'photo.png');
    await fs.writeFile(pngFile, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]));

    console.log('Checking the student request...');
    await page.goto(origin);
    await screenshot('home-desktop');
    await login('flow-student@example.com');
    await clickText('Request attestation');
    await waitText('What do you need attested?');
    await screenshot('request-type');
    await clickText('Continue');
    await waitText('Academic record');
    assert.equal(await page.$eval('input[placeholder="00000-0000000-0"]', input => input.value), '35202-7654321-9', 'CNIC should prefill from the account');
    await fill('Date of birth', '2000-02-14');
    await fill('Degree title', 'BS Computer Science');
    await fill('Department', 'Computer Science');
    await fill('Session', '2020–2024');
    await fill('Year of passing', '2024');
    await fill('CGPA', '3.45');
    await clickText('Save draft and continue');
    await waitText('Upload a clear scan of each document');
    const draft = await Application.findOne({ student: flowStudent._id, status: 'draft' });
    assert.match(draft.applicationNumber, /^UA-\d{4}-\d{6}$/);
    await page.reload();
    await waitText('Continue your request.');
    assert.equal(await page.$eval('input[placeholder="e.g. BS Computer Science"]', input => input.value), 'BS Computer Science', 'Saved details should survive a reload');
    await clickText('Save and continue');
    await waitText('Upload a clear scan of each document');
    await uploadAs('Degree certificate', await pdfFile('degree-scan.pdf'));
    await waitText('Degree certificate uploaded.');
    await uploadAs('Degree certificate', await pdfFile('degree-rescan.pdf'));
    await waitText('Degree certificate replaced.');
    await uploadAs('CNIC (front)', pngFile);
    await waitText('CNIC (front) uploaded.');
    await uploadAs('CNIC (back)', await pdfFile('cnic-back.pdf'));
    await waitText('CNIC (back) uploaded.');
    await uploadAs('Passport-size photograph', pngFile);
    await waitText('Passport-size photograph uploaded.');
    await uploadAs('Other supporting document', await pdfFile('extra.pdf'));
    await waitText('extra.pdf');
    await clickText('Remove');
    await page.waitForSelector('dialog[open]');
    await page.evaluate(() => [...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Remove').click());
    await waitText('Document removed.');
    await screenshot('request-documents');
    await clickText('Continue to fee');
    await waitText('Fee challan');
    await screenshot('request-fee');
    await fill('Payment date', new Date().toISOString().slice(0, 10));
    await fill('Bank transaction', 'NBP-20261027-4471');
    await clickText('Save payment details');
    await waitText('Payment details saved.');
    await uploadAs('Paid fee challan', await pdfFile('paid-challan.pdf'));
    await waitText('Paid fee challan uploaded.');
    await clickText('Review request');
    await waitText('I declare that the information');
    assert(await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Submit request').disabled), 'Submission requires the declaration');
    await page.click('input[type="checkbox"]');
    await screenshot('request-review');
    await clickText('Submit request');
    await waitText('Request submitted.');
    assert(mailFor('flow-student@example.com', /^Request received/), 'Submission email was not sent');
    const submitted = await Application.findById(draft._id);
    assert.equal(submitted.status, 'scrutiny');
    await page.goto(`${origin}/student/applications/${submitted._id}/challan`);
    await waitText('Bank copy');
    await screenshot('fee-challan');
    await page.goto(`${origin}/student/dashboard`);
    await waitText('in document scrutiny');
    await screenshot('student-dashboard');

    console.log('Checking scrutiny and the objection...');
    await login('flow-scrutiny@example.com');
    await waitText('Attestation requests');
    await queueSettled(19);
    await screenshot('scrutiny-queue');
    await page.goto(`${origin}/admin/dashboard?limit=10`);
    await queueSettled(10);
    await clickText('Next');
    await queueSettled(9);
    await clickText('Prev');
    await queueSettled(10);
    await page.type('input[type="search"]', submitted.applicationNumber);
    await queueSettled(1);
    const recordRow = `#queue-${submitted._id}`;
    await page.focus(recordRow);
    await page.keyboard.press('Enter');
    await waitText('Verification aids');
    assert.equal(await page.$eval(recordRow, row => row.getAttribute('aria-current')), 'true', 'The open record should be marked in the queue');
    const filteredURL = page.url();
    await clickText('Open as page');
    await waitText('Back to the queue');
    await clickText('Back to the queue');
    await page.waitForSelector(recordRow);
    assert.equal(page.url(), filteredURL, 'Returning from a record page should preserve queue filters');
    await page.click('[aria-label="Open Degree certificate"]');
    await page.waitForSelector('dialog[open] iframe[src^="blob:"]');
    await screenshot('scrutiny-document-preview');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog'));
    await clickInDocument('Degree certificate', 'Flag');
    await page.waitForSelector('dialog[open]');
    assert(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'Dialog should receive focus');
    await page.type('dialog textarea', 'The university stamp is not readable.');
    await clickText('Flag document');
    await waitText('Document flagged.');
    await clickText('Raise objection');
    await page.waitForSelector('dialog[open]');
    await page.type('dialog textarea', 'Please upload a clearer scan of your degree showing the stamp.');
    await screenshot('scrutiny-objection');
    await clickText('Send objection to applicant');
    await waitText('Waiting for the applicant to correct the request');
    const objectionMail = mailFor('flow-student@example.com', /^Action needed on your request/);
    assert(objectionMail && objectionMail.text.includes('clearer scan of your degree'), 'Objection email was not sent with the reason');

    console.log('Checking the student correction...');
    await login('flow-student@example.com');
    await waitText('waiting for your correction');
    await clickText('Correct and resubmit');
    await waitText('Correct your request.');
    await waitText('The university stamp is not readable.');
    await screenshot('student-objection');
    await uploadAs('Degree certificate', await pdfFile('degree-clear.pdf'));
    await waitText('Degree certificate replaced.');
    await clickText('Continue to fee');
    await clickText('Review request');
    await page.waitForSelector('input[type="checkbox"]');
    await page.click('input[type="checkbox"]');
    await clickText('Resubmit request');
    await waitText('Corrections submitted.');
    assert(mailFor('flow-student@example.com', /^Corrections received/), 'Resubmission email was not sent');

    console.log('Checking the staged review and issuance...');
    await login('flow-scrutiny@example.com');
    await page.goto(`${origin}/admin/applications/${submitted._id}`);
    await waitText('Verification aids');
    for (const kind of ['Degree certificate', 'CNIC (front)', 'CNIC (back)', 'Passport-size photograph', 'Paid fee challan']) {
      await clickInDocument(kind, 'Accept');
      await waitText('Document accepted.');
      await page.waitForFunction(title => [...document.querySelectorAll('li')].find(row => row.querySelector('p')?.textContent === title)?.innerText.includes('Accepted'), {}, kind);
    }
    await clickText('Mark fee as verified');
    await waitText('Fee payment verified.');
    await screenshot('scrutiny-ready');
    await clickText('Forward to examination');
    await clickText('Forward');
    await waitText('Forwarded to records verification.');

    await login('flow-exam@example.com');
    await queueSettled(1);
    await page.click(recordRow);
    await waitText('Records check');
    await clickText('Records verified');
    await page.waitForSelector('dialog[open]');
    assert(await page.evaluate(() => [...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Forward').disabled), 'Records verification requires a record reference');
    await page.type('dialog input', 'Result gazette 2024, p. 112');
    await clickText('Forward');
    await waitText('Forwarded to registrar approval.');

    await login('flow-registrar@example.com');
    await queueSettled(1);
    await page.click(recordRow);
    await waitText('Result gazette 2024, p. 112');
    await screenshot('registrar-approval');
    await clickText('Approve and issue');
    await clickText('Approve and issue certificate');
    await waitText('Attestation approved and certificate issued.');
    const degree = await Degree.findOne({ issuanceStatus: 'issued' });
    assert(degree && /^ATT-\d{4}-\d{6}$/.test(degree.attestationNumber), 'Attestation was not issued with a number');
    const issuedMail = mailFor('flow-student@example.com', /^Your attestation is ready/);
    assert(issuedMail && issuedMail.text.includes(`/verify/${degree.hash}`) && issuedMail.text.includes(degree.attestationNumber), 'Issuance email was not sent with the verification details');
    files.push(path.resolve(__dirname, '..', degree.pdfUrl.replace(/^\//, '')));
    await page.goto(`${origin}/verify/${degree.attestationNumber}`);
    // No click: direct links and certificate QR codes should verify automatically.
    await waitText('Issued details verified by the university');
    await waitText('Flow Test Father');
    await waitText('•••••-••••321-9');
    await screenshot('verification-desktop');
    assert.equal((await Application.findById(submitted._id)).status, 'issued');
    const certificate = await fetch(`${origin}${degree.pdfUrl}`);
    assert.equal(certificate.status, 200);
    assert.equal(Buffer.from(await certificate.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');

    console.log('Checking mobile and tablet layouts...');
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'verification-mobile.png'), fullPage: true });
    await noOverflow('Verification page');
    await login('flow-scrutiny@example.com');
    await page.goto(`${origin}/admin/dashboard?limit=10`);
    await queueSettled(10);
    await screenshot('staff-mobile');
    await noOverflow('Staff queue on mobile');
    await page.click('[aria-controls="mobile-menu"]');
    await page.waitForFunction(() => document.querySelector('[aria-controls="mobile-menu"]').getAttribute('aria-expanded') === 'true' && document.getElementById('mobile-menu'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('[aria-controls="mobile-menu"]').getAttribute('aria-expanded') === 'false');
    await page.setViewport({ width: 768, height: 1024 });
    await screenshot('staff-tablet');
    await noOverflow('Staff queue on tablet');
    await page.setViewport({ width: 390, height: 844 });
    await page.click('.queue-row');
    await waitText('Verification aids');
    await clickText('Reject');
    await page.waitForSelector('dialog[open]');
    assert(await page.evaluate(() => [...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Reject request').disabled), 'Rejection requires a reason');
    await page.type('dialog textarea', 'The degree is not recorded in the result gazette.');
    await screenshot('staff-rejection-mobile');
    await clickText('Reject request');
    await waitText('Reason for rejection:');
    const rejection = mailbox.find(mail => /^Your request was not approved/.test(mail.subject));
    assert(rejection && /^queue-\d+@example\.com$/.test(rejection.to) && rejection.text.includes('not recorded in the result gazette'), 'Rejection email was not sent with the reason');
    assert.equal(mailbox.length, 5, `Expected five status emails, got: ${mailbox.map(mail => mail.subject).join(' | ')}`);
    await clickText('Back to queue');
    await page.waitForFunction(() => document.querySelector('.console-queue ul[aria-busy="false"]') && !new URLSearchParams(location.search).get('selected'));
    await page.evaluate(() => [...document.querySelectorAll('.console-tabs button')].find(button => button.textContent.startsWith('Completed')).click());
    await page.waitForSelector(recordRow);
    await page.click(recordRow);
    await waitText('Attestation certificate');
    await screenshot('staff-detail-mobile');
    await noOverflow('Application details on mobile');
    await login('flow-student@example.com');
    await page.goto(`${origin}/student/applications/${submitted._id}`);
    await waitText('Your attestation is complete');
    await screenshot('student-attested-mobile');
    await noOverflow('Student record on mobile');
    await page.goto(`${origin}/student/applications/${submitted._id}/challan`);
    await waitText('Applicant copy');
    await noOverflow('Fee challan on mobile');

    await page.evaluate(() => localStorage.clear());
    await page.goto(`${origin}/login`);
    await clickText('Forgot password?');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'flow-student@example.com');
    await clickText('Send reset link');
    await waitText('reset link is on its way');
    await screenshot('forgot-password-mobile');
    const resetMail = mailFor('flow-student@example.com', /^Reset your UniAttest password/);
    assert(resetMail, 'Password reset email was not sent');
    const resetLink = /(\S+\/reset-password#token=[a-f0-9]{64})/.exec(resetMail.text)[1];
    await page.goto(resetLink.replace(/^https?:\/\/[^/]+/, origin));
    await page.waitForSelector('input[autocomplete="new-password"]');
    assert(!page.url().includes('token='), 'The reset token should be removed from the address bar');
    const newPassword = 'Flow-reset-password-2026';
    const [first, second] = await page.$$('input[autocomplete="new-password"]');
    await first.type(newPassword);
    await second.type(newPassword);
    await clickText('Reset password');
    await page.waitForFunction(() => location.pathname === '/login');
    await waitText('Password reset. Sign in with your new password.');
    await page.type('input[type="email"]', 'flow-student@example.com');
    await page.type('input[type="password"]', newPassword);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => location.pathname.endsWith('/dashboard'));
    files.push(...(await Document.find()).map(document => path.resolve(__dirname, '../uploads', document.fileName)));
    assert.deepEqual(errors, [], 'Browser reported JavaScript errors');
    console.log('PASS: request wizard, draft resume, document checklist and replacement, fee challan, declaration, scrutiny with flagging and objection, student correction and resubmission, fee verification, records verification, registrar issuance, attestation-number verification, stage roles, status emails, document preview, password reset, and desktop/tablet/mobile layouts.');
  } finally {
    if (browser) await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
    if (vite) await vite.close();
    process.chdir(originalDirectory);
    if (apiServer) await new Promise(resolve => apiServer.close(resolve));
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
    await Promise.all(files.map(file => fs.unlink(file).catch(() => {})));
    if (temporary) await fs.rm(temporary, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
