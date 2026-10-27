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
const templates = {
  submitted: ({ application }) => ({
    subject: `We received your application: ${application.programName}`,
    paragraphs: [
      `Your application for ${application.programName} (${application.graduationYear}) has been submitted to ${university()} for review.`,
      'You don’t need to do anything else for now. We’ll email you when a decision is made.'
    ],
    action: ['Follow your application', `${clientUrl()}/student/applications/${application._id}`]
  }),
  approved: ({ application }) => ({
    subject: `Your application was approved: ${application.programName}`,
    paragraphs: [
      `Good news: ${university()} has approved your application for ${application.programName}.`,
      application.adminComments && application.adminComments !== 'Application approved' ? `Reviewer’s note: ${application.adminComments}` : null,
      'Your certificate will be issued next. We’ll email you as soon as it is ready.'
    ],
    action: ['View your application', `${clientUrl()}/student/applications/${application._id}`]
  }),
  rejected: ({ application }) => ({
    subject: `Your application needs attention: ${application.programName}`,
    paragraphs: [
      `${university()} could not approve your application for ${application.programName}.`,
      `Reason: ${application.rejectionReason}`,
      'You can start a new application once you have addressed this.'
    ],
    action: ['Read the full feedback', `${clientUrl()}/student/applications/${application._id}`]
  }),
  issued: ({ application, degree }) => ({
    subject: `Your certificate is ready: ${application.programName}`,
    paragraphs: [
      `Your attested certificate for ${application.programName} has been issued by ${university()}.`,
      'Anyone can confirm it is genuine using its public verification page, so you can share that link with employers or institutions.',
      { label: 'Verification hash', code: degree.hash }
    ],
    action: ['Open the verification page', `${clientUrl()}/verify/${degree.hash}`]
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

// Fire and forget. Callers don't await this; errors are logged, never thrown.
exports.notify = (event, context) => {
  if (!transporter()) return;
  send(event, context).catch(error => logger.warn('Notification failed: %s for application %s: %s', event, String(context.application?._id), error.message));
};

exports._setTransport = value => { transport = value; };
