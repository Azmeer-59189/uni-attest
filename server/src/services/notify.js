const nodemailer = require('nodemailer');
const User = require('../models/User');
const logger = require('../utils/logger');

// Status emails to students. Off unless SMTP is configured, and never allowed to fail or slow a request.
let transport;
const transporter = () => {
  if (transport !== undefined) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(SMTP_PORT) || 587;
  transport = SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
    : null;
  if (!transport) logger.info('Email notifications are off: set SMTP_HOST, SMTP_USER and SMTP_PASS to enable them.');
  return transport;
};

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
const university = () => process.env.UNIVERSITY_NAME || 'the university';

// Each template returns a subject, paragraphs, and one call to action. Paragraphs are plain text and escaped on render;
// a { label, code } paragraph shows an identifier in monospace so long hashes stay legible.
const label = application => `${application.applicationNumber ? `${application.applicationNumber} · ` : ''}${application.programName}`;
const requestLink = application => `${clientUrl()}/student/applications/${application._id}`;

const templates = {
  submitted: ({ application }) => ({
    subject: `Request received: ${label(application)}`,
    paragraphs: [
      `Your attestation request for ${application.programName} (${application.graduationYear}) has been received by ${university()}.`,
      'It now goes through document scrutiny, verification against university records, and registrar approval. If anything needs correcting, we’ll email you.'
    ],
    action: ['Track your request', requestLink(application)]
  }),
  resubmitted: ({ application }) => ({
    subject: `Corrections received: ${label(application)}`,
    paragraphs: [
      'Thank you for answering the objection. Your corrected request is back in document scrutiny.',
      'We’ll email you when it is attested, or if anything else is needed.'
    ],
    action: ['Track your request', requestLink(application)]
  }),
  objection: ({ application }) => ({
    subject: `Action needed on your request: ${label(application)}`,
    paragraphs: [
      `${university()} has raised an objection on your attestation request. It is paused until you respond.`,
      `What needs correcting: ${application.objection?.reason}`,
      'Open your request, make the correction or upload the requested documents, then resubmit it.'
    ],
    action: ['Correct and resubmit', requestLink(application)]
  }),
  rejected: ({ application }) => ({
    subject: `Your request was not approved: ${label(application)}`,
    paragraphs: [
      `${university()} could not attest your request for ${application.programName}.`,
      `Reason: ${application.rejectionReason}`,
      'If you believe this is a mistake, contact the registrar’s office and quote your application number.'
    ],
    action: ['View the decision', requestLink(application)]
  }),
  issued: ({ application, degree }) => ({
    subject: `Your attestation is ready: ${label(application)}`,
    paragraphs: [
      `Your ${application.programName} has been attested by ${university()}.`,
      'Download the attestation certificate from your account. Anyone can confirm it is genuine on the public verification page, so you can share that link with employers or institutions.',
      degree.attestationNumber ? { label: 'Attestation number', code: degree.attestationNumber } : null,
      { label: 'Verification hash', code: degree.hash }
    ],
    action: ['Open the verification page', `${clientUrl()}/verify/${degree.hash}`]
  }),
  passwordReset: ({ link }) => ({
    subject: 'Reset your UniAttest password',
    paragraphs: [
      'We received a request to reset the password for your account. The link below works once and expires in 30 minutes.',
      'If you didn’t ask for this, you can ignore this email; your password stays the same.'
    ],
    action: ['Choose a new password', link]
  })
};

const render = ({ subject, paragraphs, action }, name) => {
  const lines = [`Dear ${name},`, ...paragraphs.filter(Boolean)];
  const [label, href] = action;
  const asText = line => typeof line === 'string' ? line : `${line.label}: ${line.code}`;
  const asHtml = line => typeof line === 'string'
    ? `<p>${escape(line)}</p>`
    : `<p>${escape(line.label)}:<br><code style="font-family:Consolas,'Courier New',monospace;font-size:13px;word-break:break-all">${escape(line.code)}</code></p>`;
  return {
    subject,
    text: `${lines.map(asText).join('\n\n')}\n\n${label}: ${href}\n\n— ${university()}`,
    html: `<div style="font-family:Georgia,serif;max-width:560px;color:#1d2025;line-height:1.6">${lines.map(asHtml).join('')}<p><a href="${escape(href)}" style="color:#1f3a5f">${escape(label)}</a></p><p style="color:#6a6f77;font-size:13px">— ${escape(university())}</p></div>`
  };
};

// Exposed for tests: builds the message without sending it.
exports.compose = (event, context, student) => {
  const template = templates[event];
  if (!template) throw new Error(`Unknown notification: ${event}`);
  return { to: student.email, ...render(template(context), student.fullName) };
};

const send = async (event, context) => {
  const mail = transporter();
  if (!mail) return;
  const { student } = context.application;
  const recipient = student?.email ? student : await User.findById(student).select('email fullName').lean();
  if (!recipient?.email) return;
  const message = exports.compose(event, context, recipient);
  await mail.sendMail({ from: { name: process.env.UNIVERSITY_NAME || 'UniAttest', address: process.env.MAIL_FROM || process.env.SMTP_USER }, ...message });
  logger.info('Notification sent: %s for application %s', event, String(context.application._id));
};

exports.enabled = () => Boolean(transporter());

// Password reset links go to any role. Fire and forget, so response timing doesn't reveal which emails exist.
exports.sendPasswordReset = (user, token) => {
  const mail = transporter();
  if (!mail) return;
  const message = exports.compose('passwordReset', { link: `${clientUrl()}/reset-password#token=${token}` }, user);
  mail.sendMail({ from: { name: process.env.UNIVERSITY_NAME || 'UniAttest', address: process.env.MAIL_FROM || process.env.SMTP_USER }, ...message })
    .then(() => logger.info('Password reset email sent to user %s', String(user._id)))
    .catch(error => logger.warn('Password reset email failed for user %s: %s', String(user._id), error.message));
};

// Fire and forget. Callers don't await this; errors are logged, never thrown.
exports.notify = (event, context) => {
  if (!transporter()) return;
  send(event, context).catch(error => logger.warn('Notification failed: %s for application %s: %s', event, String(context.application?._id), error.message));
};

exports._setTransport = value => { transport = value; };
