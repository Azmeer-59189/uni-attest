// The attestation process in one place: request types, fees, documents, stages, and who may act on each.

const STAFF_ROLES = ['scrutiny', 'examination', 'registrar', 'admin', 'super_admin'];
// Administrators (and the super admin) can act at every stage, for small offices without separate staff.
const ALL_STAGES = ['admin', 'super_admin'];

const STAFF_ROLE_LABELS = {
  scrutiny: 'Scrutiny officer',
  examination: 'Examination officer',
  registrar: 'Registrar',
  admin: 'Administrator',
  super_admin: 'Super admin'
};

const DOCUMENT_KINDS = {
  degree: 'Degree certificate',
  transcript: 'Transcript',
  cnic_front: 'CNIC (front)',
  cnic_back: 'CNIC (back)',
  photograph: 'Passport-size photograph',
  fee_challan: 'Paid fee challan',
  other: 'Other supporting document'
};

const IDENTITY_DOCUMENTS = ['cnic_front', 'cnic_back', 'photograph'];
const REQUEST_TYPES = {
  degree: { label: 'Degree attestation', documents: ['degree', ...IDENTITY_DOCUMENTS] },
  transcript: { label: 'Transcript attestation', documents: ['transcript', ...IDENTITY_DOCUMENTS] },
  degree_transcript: { label: 'Degree and transcript attestation', documents: ['degree', 'transcript', ...IDENTITY_DOCUMENTS] }
};

const PROCESSING = {
  normal: { label: 'Normal', days: 10 },
  urgent: { label: 'Urgent', days: 3 }
};

// Amounts in PKR. Overridable per deployment, e.g. FEE_DEGREE_URGENT=5000.
const DEFAULT_FEES = {
  degree: { normal: 2000, urgent: 4000 },
  transcript: { normal: 1500, urgent: 3000 },
  degree_transcript: { normal: 3000, urgent: 6000 }
};
const fee = (requestType, processing) => {
  const override = Number(process.env[`FEE_${requestType}_${processing}`.toUpperCase()]);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_FEES[requestType]?.[processing];
};

// Stages, in order. `roles` may act while an application sits in that status.
const STAGES = {
  scrutiny: { label: 'Document scrutiny', roles: ['scrutiny', ...ALL_STAGES], next: 'records_verification' },
  records_verification: { label: 'Records verification', roles: ['examination', ...ALL_STAGES], next: 'registrar_approval' },
  registrar_approval: { label: 'Registrar approval', roles: ['registrar', ...ALL_STAGES] },
  issuing: { label: 'Issuance', roles: ['registrar', ...ALL_STAGES] }
};

const STATUS_LABELS = {
  draft: 'Draft',
  scrutiny: 'Document scrutiny',
  objection: 'Objection raised',
  records_verification: 'Records verification',
  registrar_approval: 'Registrar approval',
  issuing: 'Issuing',
  issued: 'Attested',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

// An application is "open" until it is attested, rejected, or withdrawn. One open request per student.
const OPEN_STATUSES = ['draft', 'scrutiny', 'objection', 'records_verification', 'registrar_approval', 'issuing'];
const IN_REVIEW_STATUSES = ['scrutiny', 'records_verification', 'registrar_approval', 'issuing'];
const CLOSED_STATUSES = ['issued', 'rejected', 'withdrawn'];
// The student may edit details and documents only before submission or while answering an objection.
const EDITABLE_STATUSES = ['draft', 'objection'];

const isStaff = user => STAFF_ROLES.includes(user?.role);
const canAct = (user, status) => Boolean(STAGES[status]?.roles.includes(user?.role));
const stagesFor = user => Object.keys(STAGES).filter(status => canAct(user, status));
const requiredDocuments = requestType => [...(REQUEST_TYPES[requestType]?.documents || []), 'fee_challan'];

const yearNumber = (prefix, year, seq) => `${prefix}-${year}-${String(seq).padStart(6, '0')}`;

// Public, non-secret settings the client needs to render forms and the fee challan.
const publicConfig = () => ({
  university: process.env.UNIVERSITY_NAME || 'University',
  requestTypes: Object.fromEntries(Object.entries(REQUEST_TYPES).map(([key, value]) => [key, {
    ...value, fees: Object.fromEntries(Object.keys(PROCESSING).map(speed => [speed, fee(key, speed)]))
  }])),
  processing: PROCESSING,
  documentKinds: DOCUMENT_KINDS,
  stages: Object.fromEntries(Object.entries(STAGES).map(([key, value]) => [key, { label: value.label, roles: value.roles }])),
  statusLabels: STATUS_LABELS,
  staffRoles: STAFF_ROLE_LABELS,
  bank: {
    name: process.env.FEE_BANK_NAME || 'National Bank of Pakistan',
    accountTitle: process.env.FEE_ACCOUNT_TITLE || `${process.env.UNIVERSITY_NAME || 'University'} Attestation Fee`,
    accountNumber: process.env.FEE_ACCOUNT_NUMBER || '0000-0000000000',
    validDays: Number(process.env.FEE_CHALLAN_VALID_DAYS) || 15
  }
});

module.exports = {
  STAFF_ROLES, STAFF_ROLE_LABELS, DOCUMENT_KINDS, REQUEST_TYPES, PROCESSING, STAGES, STATUS_LABELS,
  OPEN_STATUSES, IN_REVIEW_STATUSES, CLOSED_STATUSES, EDITABLE_STATUSES,
  fee, isStaff, canAct, stagesFor, requiredDocuments, yearNumber, publicConfig
};
