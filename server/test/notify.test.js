const nodemailer = require('nodemailer');
const notify = require('../src/services/notify');

const student = { email: 'student@example.com', fullName: 'Test Student' };
const application = { _id: 'app123', applicationNumber: 'UA-2026-000007', programName: 'BS Computing', graduationYear: 2026, student };
const flush = () => new Promise(resolve => setImmediate(resolve));

beforeAll(() => { process.env.CLIENT_URL = 'https://attest.example/'; process.env.UNIVERSITY_NAME = 'Test University'; });
afterEach(() => notify._setTransport(undefined));

test('each status email links to the right page and names the request', () => {
  const degree = { hash: '0xabc', attestationNumber: 'ATT-2026-000007' };
  const cases = [
    ['submitted', /received/, 'https://attest.example/student/applications/app123'],
    ['resubmitted', /Corrections received/, 'https://attest.example/student/applications/app123'],
    ['objection', /Action needed/, 'https://attest.example/student/applications/app123'],
    ['rejected', /not approved/, 'https://attest.example/student/applications/app123'],
    ['issued', /attestation is ready/, 'https://attest.example/verify/0xabc']
  ];
  for (const [event, subject, link] of cases) {
    const mail = notify.compose(event, { application: { ...application, rejectionReason: 'Missing stamp', objection: { reason: 'Transcript unclear' } }, degree }, student);
    expect(mail.subject).toContain('UA-2026-000007');
    expect(mail.to).toBe('student@example.com');
    expect(mail.subject).toMatch(subject);
    expect(mail.subject).toContain('BS Computing');
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(`href="${link}"`);
    expect(mail.text).toContain('Dear Test Student');
  }
});

test('rejection email includes the reason, and student-supplied text is escaped in HTML', () => {
  const mail = notify.compose('rejected', { application: { ...application, programName: '<b>BS</b>', rejectionReason: 'Transcript <script>alert(1)</script> unstamped' } }, student);
  expect(mail.text).toContain('Reason: Transcript <script>alert(1)</script> unstamped');
  expect(mail.html).not.toContain('<script>');
  expect(mail.html).toContain('&lt;script&gt;');
  expect(mail.html).not.toContain('<b>BS</b>');
});

test('the verification hash is shown in monospace in HTML and plainly in text', () => {
  const mail = notify.compose('issued', { application, degree: { hash: '0xabc<def' } }, student);
  expect(mail.text).toContain('Verification hash: 0xabc<def');
  expect(mail.html).toMatch(/<code style="font-family:Consolas[^"]*">0xabc&lt;def<\/code>/);
});

test('objection email tells the student what to correct, and the issued email gives the attestation number', () => {
  const objection = notify.compose('objection', { application: { ...application, objection: { reason: 'Upload a clearer transcript' } } }, student);
  expect(objection.text).toContain('What needs correcting: Upload a clearer transcript');
  const issued = notify.compose('issued', { application, degree: { hash: '0xabc', attestationNumber: 'ATT-2026-000007' } }, student);
  expect(issued.text).toContain('Attestation number: ATT-2026-000007');
});

test('sends through the configured transport without the caller awaiting it', async () => {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const sent = jest.spyOn(transport, 'sendMail');
  notify._setTransport(transport);
  expect(notify.notify('submitted', { application })).toBeUndefined();
  await flush();
  expect(sent).toHaveBeenCalledTimes(1);
  expect(sent.mock.calls[0][0]).toMatchObject({ to: 'student@example.com', from: { name: 'Test University' } });
});

test('a mail failure is logged, never thrown into the request', async () => {
  notify._setTransport({ sendMail: () => Promise.reject(new Error('SMTP down')) });
  expect(() => notify.notify('submitted', { application })).not.toThrow();
  await flush();
});

test('does nothing when SMTP is not configured', () => {
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) delete process.env[key];
  notify._setTransport(undefined);
  expect(notify.notify('submitted', { application })).toBeUndefined();
});
