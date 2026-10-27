import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, CheckCircle, Flag, RefreshCw, ScanText, UserCheck, XCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiError } from '../utils/apiError'
import { formatPKR, isStaff, requiredDocuments, useConfig } from '../utils/workflow'
import { ApplicationProgress } from '../components/UI'
import { ActivityTimeline, CertificateLinks, RecordDocuments, StatusBadge, formatDate } from '../components/ApplicationRecord'
import ConfirmationDialog from '../components/ConfirmationDialog'

const studentGuidance = {
  draft: 'This request has not been submitted yet.',
  scrutiny: 'The attestation cell is checking your documents and fee payment.',
  objection: 'The university needs a correction before it can continue. See the objection below.',
  records_verification: 'The examination branch is verifying your details against university records.',
  registrar_approval: 'Your request is with the registrar for final approval.',
  issuing: 'The registrar has approved your request. The certificate is being issued.',
  issued: 'Your attestation is complete. Download the certificate or share its verification page.',
  rejected: 'This request was not approved. The reason is recorded below.',
  withdrawn: 'You withdrew this request.'
}
const staffGuidance = {
  scrutiny: 'Check each document and the fee payment. Accept what is in order, flag anything that is not.',
  objection: 'Waiting for the applicant to correct the request and resubmit.',
  records_verification: 'Compare the declared particulars with the result gazette or tabulation register.',
  registrar_approval: 'Review the scrutiny and records findings, then approve to issue the certificate.',
  issuing: 'Issuance started but did not finish. Retry to complete the same certificate.',
  issued: 'Attested. The certificate and its verification page are available.',
  rejected: 'Closed. The reason for rejection is recorded below.',
  withdrawn: 'The applicant withdrew this request.'
}
const studentHidden = new Set(['ocr_checked', 'face_checked', 'document_pending', 'fee_unverified'])

export default function ApplicationDetail() {
  const { id } = useParams()
  return <ApplicationRecordView id={id} />
}

function Field({ label, children }) {
  return <div><dt>{label}</dt><dd>{children ?? <span className="text-ink-faint">Not provided</span>}</dd></div>
}

// Rendered as a full page, or compact inside the staff console's detail pane.
export function ApplicationRecordView({ id, compact = false, onChange }) {
  const { user, api, downloadDocument } = useAuth()
  const { config } = useConfig()
  const staff = isStaff(user)
  const Title = compact ? 'h2' : 'h1'
  const prefix = staff ? 'admin' : 'student'
  const location = useLocation()
  const suggestedReturn = location.state?.returnTo
  const back = staff && typeof suggestedReturn === 'string' && /^\/admin\/dashboard(?:\?|$)/.test(suggestedReturn) ? suggestedReturn : `/${prefix}/dashboard`
  const [application, setApplication] = useState(null)
  const [canAct, setCanAct] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [text, setText] = useState('')
  const [reference, setReference] = useState('')

  const load = useCallback(async (signal) => {
    setLoading(true)
    try {
      const { data } = await api.get(`/${prefix}/applications/${id}`, { signal })
      setApplication(data.application); setCanAct(Boolean(data.canAct))
    } catch (err) { if (!signal?.aborted) setError(apiError(err, 'Could not load this application.')) }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [api, prefix, id])
  useEffect(() => { setApplication(null); setError(''); setNotice(''); const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])

  const act = async (label, request, success) => {
    setBusy(label); setError(''); setNotice('')
    try {
      const { data } = await request()
      setModal(null); setText(''); setReference('')
      setNotice(data?.message || success)
      onChange?.()
    } catch (err) { setError(apiError(err, 'Action failed. Reload the application and try again.')); setModal(null) }
    finally { await load(); setBusy('') }
  }
  const base = `/admin/applications/${id}`
  const reviewDocument = (document, status, note) => act(`doc-${document._id}`, () => api.patch(`${base}/documents/${document._id}/review`, { status, note }))
  const decisions = {
    forward: () => act('forward', () => api.post(`${base}/forward`, { remarks: text, recordReference: reference })),
    objection: () => act('objection', () => api.post(`${base}/objection`, { reason: text })),
    reject: () => act('reject', () => api.post(`${base}/reject`, { reason: text })),
    issue: () => act('issue', () => api.post(`${base}/issue`, { remarks: text })),
    flag: () => reviewDocument(modal.document, 'flagged', text)
  }
  const open = (type, extra = {}) => { setText(''); setReference(''); setError(''); setModal({ type, ...extra }) }
  const download = async document => { try { await downloadDocument(document._id, document.originalName) } catch (err) { setError(apiError(err, 'Download failed.')) } }

  if (!config || (!application && loading)) return <p role="status" className="py-16 text-center text-ink-faint">Loading application…</p>
  if (!application) return <div role="alert" className="border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800">{error || 'Application not found.'}{!compact && <Link to={back} className="ml-3 underline">Back</Link>}</div>

  const kinds = config.documentKinds
  const status = application.status
  const stage = config.stages[status]
  const documents = application.documents || []
  const required = requiredDocuments(config, application.requestType)
  const accepted = new Set(documents.filter(document => document.review?.status === 'accepted').map(document => document.kind))
  const flagged = documents.filter(document => document.review?.status === 'flagged')
  const outstanding = required.filter(kind => !accepted.has(kind))
  const scrutinyReady = !outstanding.length && !flagged.length && application.fee?.verified
  const history = staff ? application.history : application.history?.filter(event => !studentHidden.has(event.action))
  const ocr = application.checks?.ocr || []
  const face = application.checks?.face
  const scrutinyActions = canAct && status === 'scrutiny'

  const documentActions = scrutinyActions ? document => <div className="flex flex-wrap items-center gap-2">
    {document.review?.status !== 'accepted' && <button disabled={Boolean(busy)} onClick={() => reviewDocument(document, 'accepted')} className="button-secondary !min-h-9 !px-3 !py-1 !text-xs"><Check className="h-3.5 w-3.5" />Accept</button>}
    {document.review?.status !== 'flagged' && <button disabled={Boolean(busy)} onClick={() => open('flag', { document })} className="button-secondary !min-h-9 !px-3 !py-1 !text-xs !text-amber-900"><Flag className="h-3.5 w-3.5" />Flag</button>}
    {document.review?.status && document.review.status !== 'pending' && <button disabled={Boolean(busy)} onClick={() => reviewDocument(document, 'pending')} className="min-h-9 px-2 text-xs text-ink-faint underline">Undo</button>}
    {['degree', 'transcript'].includes(document.kind) && <button disabled={Boolean(busy)} onClick={() => act(`ocr-${document._id}`, () => api.post(`${base}/documents/${document._id}/ocr`))} className="min-h-9 px-2 inline-flex items-center gap-1 text-xs text-navy underline"><ScanText className="h-3.5 w-3.5" />{busy === `ocr-${document._id}` ? 'Reading…' : 'Read with OCR'}</button>}
  </div> : null

  return <div className={compact ? 'record-compact space-y-6' : 'max-w-6xl mx-auto space-y-8'}>
    {!compact && <Link to={back} className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"><ArrowLeft className="h-4 w-4" />{staff ? 'Back to the queue' : 'Back to overview'}</Link>}
    {error && <div role="alert" className="border-l-2 border-red-700 bg-red-50 text-red-800 p-4 text-sm">{error}<button disabled={loading || Boolean(busy)} className="ml-3 underline" onClick={() => { setError(''); load() }}>Reload</button></div>}
    {notice && <p role="status" className="flex items-center gap-2 border-l-2 border-emerald-700 bg-emerald-50 text-emerald-800 p-4 text-sm"><CheckCircle className="h-4 w-4 shrink-0" />{notice}</p>}

    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="page-kicker mb-2"><span className="font-mono tracking-normal normal-case">{application.applicationNumber || String(application._id).slice(-8).toUpperCase()}</span> · {config.requestTypes[application.requestType]?.label}{application.processing === 'urgent' && <span className="ml-2 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">Urgent</span>}</p>
        <Title className={compact ? 'display text-3xl leading-tight' : 'page-title'}>{staff ? application.student?.fullName || 'Applicant' : application.programName}</Title>
        <p className="mt-2 text-sm text-ink-soft">{staff ? <>{application.programName} · <span className="font-mono text-[13px]">{application.registrationNumber || application.student?.studentId}</span></> : `${application.department} · ${application.graduationYear}`}</p>
      </div>
      <div className="flex items-center gap-4"><StatusBadge status={status} /><button disabled={loading || Boolean(busy)} aria-label="Refresh application" onClick={() => { setError(''); load() }} className="button-secondary !min-h-10 !px-3"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
    </header>

    <ApplicationProgress status={status} objectionStage={application.objection?.stage} />

    <div className="record-guidance">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{staff ? staffGuidance[status] : studentGuidance[status]}</p>
        {staff && stage && !canAct && <p className="mt-1 text-xs text-ink-soft">Waiting at {stage.label.toLowerCase()}. Your role can view this record but not act on it.</p>}
        {scrutinyActions && !scrutinyReady && <p className="mt-1 text-xs text-ink-soft">To forward: {[outstanding.length ? `accept ${outstanding.map(kind => kinds[kind].toLowerCase()).join(', ')}` : null, flagged.length ? 'resolve flagged documents' : null, !application.fee?.verified ? 'verify the fee' : null].filter(Boolean).join('; ')}.</p>}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {!staff && ['draft', 'objection'].includes(status) && <Link to="/student/apply" className="button-primary">{status === 'objection' ? 'Correct and resubmit' : 'Continue request'}</Link>}
        {canAct && status === 'scrutiny' && <button disabled={Boolean(busy) || !scrutinyReady} onClick={() => open('forward')} className="button-primary">Forward to examination</button>}
        {canAct && status === 'records_verification' && <button disabled={Boolean(busy)} onClick={() => open('forward')} className="button-primary">Records verified</button>}
        {canAct && ['registrar_approval', 'issuing'].includes(status) && <button disabled={Boolean(busy)} onClick={() => open('issue')} className="button-primary">{status === 'issuing' ? 'Retry issuance' : 'Approve and issue'}</button>}
        {canAct && status !== 'issuing' && <button disabled={Boolean(busy)} onClick={() => open('objection')} className="button-secondary">Raise objection</button>}
        {canAct && status !== 'issuing' && <button disabled={Boolean(busy)} onClick={() => open('reject')} className="button-secondary !text-red-700 hover:!border-red-700">Reject</button>}
      </div>
    </div>

    {status === 'objection' && application.objection?.reason && <section className="border-l-2 border-amber-600 bg-amber-50 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-950"><AlertTriangle className="h-4 w-4" />Objection · {config.stages[application.objection.stage]?.label}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-amber-950">{application.objection.reason}</p>
      <p className="mt-2 text-xs text-amber-900">Raised {formatDate(application.objection.raisedAt)}{staff && application.objection.raisedByName ? ` by ${application.objection.raisedByName}` : ''}{application.objectionCount > 1 ? ` · objection ${application.objectionCount}` : ''}</p>
    </section>}
    {application.rejectionReason && status === 'rejected' && <section className="border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800"><strong className="font-semibold">Reason for rejection:</strong> <span className="whitespace-pre-wrap">{application.rejectionReason}</span></section>}

    <div className="record-layout"><div className="min-w-0 space-y-5">
      <CertificateLinks degree={application.degree} />
      {canAct && status === 'records_verification' && <section className="record-section">
        <h2>Records check</h2>
        <p className="record-caption">Confirm each declared particular against the university’s result records before forwarding.</p>
        <table className="mt-4 w-full text-sm"><tbody>{[['Name', application.student?.fullName], ['Father’s name', application.fatherName], ['Registration no.', application.registrationNumber], ['Roll no.', application.rollNumber], ['Degree', application.programName], ['Session', application.session], ['Year of passing', application.graduationYear], ['CGPA', application.cgpa]].map(([label, value]) => <tr key={label} className="border-b border-rule"><th scope="row" className="py-2 pr-4 text-left text-xs font-normal text-ink-faint w-40">{label}</th><td className="py-2 font-medium text-ink">{value ?? '—'}</td></tr>)}</tbody></table>
        {application.reviews?.scrutiny?.byName && <p className="mt-4 text-xs text-ink-soft">Scrutiny by {application.reviews.scrutiny.byName}, {formatDate(application.reviews.scrutiny.at)}{application.reviews.scrutiny.remarks && <>: “{application.reviews.scrutiny.remarks}”</>}</p>}
      </section>}

      {canAct && ['registrar_approval', 'issuing'].includes(status) && <section className="record-section">
        <h2>Findings</h2>
        <dl className="mt-4 space-y-4 text-sm">
          {[['Document scrutiny', application.reviews?.scrutiny], ['Records verification', application.reviews?.records]].map(([label, review]) => <div key={label} className="flex gap-3"><UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><div><dt className="font-medium text-ink">{label}</dt><dd className="text-ink-soft">{review?.byName ? <>{review.byName}, {formatDate(review.at)}{review.recordReference && <> · checked against <span className="text-ink">{review.recordReference}</span></>}{review.remarks && <span className="block italic">“{review.remarks}”</span>}</> : 'Completed before stage records were kept.'}</dd></div></div>)}
        </dl>
      </section>}

      <section className="record-section"><h2>Particulars</h2><dl className="record-fields">
        <Field label="Name">{application.student?.fullName || (!staff ? user.fullName : null)}</Field>
        <Field label="Father’s name">{application.fatherName}</Field>
        <Field label="CNIC"><span className="font-mono text-[13px]">{application.cnic}</span></Field>
        <Field label="Date of birth">{application.dateOfBirth && formatDate(application.dateOfBirth)}</Field>
        <Field label="Degree">{application.programName}</Field>
        <Field label="Department">{application.department}</Field>
        <Field label="Session">{application.session}</Field>
        <Field label="Registration no."><span className="font-mono text-[13px]">{application.registrationNumber}</span></Field>
        <Field label="Roll no.">{application.rollNumber}</Field>
        <Field label="Year of passing">{application.graduationYear}</Field>
        <Field label="CGPA">{application.cgpa}</Field>
        {staff && <Field label="Contact">{[application.student?.email, application.student?.phone].filter(Boolean).join(' · ')}</Field>}
        <Field label="Submitted">{application.submittedAt ? formatDate(application.submittedAt) : status === 'draft' ? 'Not yet' : null}</Field>
      </dl></section>

      <section className="record-section"><h2>Fee</h2><dl className="record-fields">
        <Field label="Challan no."><span className="font-mono text-[13px]">{application.fee?.challanNumber}</span></Field>
        <Field label="Amount">{formatPKR(application.fee?.amount)}</Field>
        <Field label="Paid on">{application.fee?.paidOn && formatDate(application.fee.paidOn)}</Field>
        <Field label="Bank reference"><span className="font-mono text-[13px]">{application.fee?.bankReference}</span></Field>
      </dl>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {application.fee?.verified ? <span className="status-pill"><span aria-hidden="true" className="status-dot bg-emerald-600" />Payment verified{application.fee.verifiedAt && ` ${formatDate(application.fee.verifiedAt)}`}</span> : <span className="status-pill"><span aria-hidden="true" className="status-dot bg-stone-400" />Payment not yet verified</span>}
          {scrutinyActions && <button disabled={Boolean(busy) || (!application.fee?.verified && !application.fee?.paidOn)} onClick={() => act('fee', () => api.patch(`${base}/fee`, { verified: !application.fee?.verified }))} className="button-secondary !min-h-9 !px-3 !py-1 !text-xs">{application.fee?.verified ? 'Undo verification' : 'Mark fee as verified'}</button>}
        </div>
      </section>

      <RecordDocuments documents={documents} kinds={kinds} busy={Boolean(busy)} onDownload={download} actions={documentActions}
        caption={staff ? (scrutinyActions ? 'Open each document, then accept it or flag what is wrong. Flagged documents go back to the applicant with your note when you raise an objection.' : 'Documents and their scrutiny outcome.') : 'Your uploaded documents and their scrutiny status.'} showReview={staff || status !== 'draft'} />

      {staff && (ocr.length > 0 || face || scrutinyActions) && <section className="record-section">
        <h2>Verification aids</h2>
        <p className="record-caption">Automated readings to support, not replace, the officer’s own check.</p>
        {ocr.map(result => <div key={String(result.document)} className="mt-4">
          <p className="text-sm font-medium text-ink">{result.documentName} read with OCR <span className="font-normal text-ink-faint">· {result.byName}, {formatDate(result.at)}</span></p>
          {result.comparison?.length ? <table className="mt-2 w-full text-xs"><thead><tr className="text-left text-ink-faint"><th className="py-1 font-normal">Field</th><th className="py-1 font-normal">Declared</th><th className="py-1 font-normal">On document</th><th className="py-1 font-normal sr-only">Match</th></tr></thead><tbody>{result.comparison.map(row => <tr key={row.field} className="border-t border-rule"><td className="py-1.5 pr-2 text-ink-soft">{row.label}</td><td className="py-1.5 pr-2 text-ink">{row.declared || '—'}</td><td className="py-1.5 pr-2 text-ink break-all">{row.extracted}</td><td className="py-1.5">{row.match ? <CheckCircle aria-label="Matches" className="h-4 w-4 text-emerald-700" /> : <XCircle aria-label="Differs" className="h-4 w-4 text-amber-600" />}</td></tr>)}</tbody></table> : <p className="mt-1 text-xs text-ink-faint">No recognisable fields were found. Check the document by eye.</p>}
        </div>)}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {face && <p className="text-sm">{face.error ? <span className="text-amber-900">Face comparison: {face.error}</span> : face.match ? <span className="text-emerald-800">Photograph matches the CNIC portrait ({face.confidence}% similarity).</span> : <span className="text-amber-900">Photograph does not match the CNIC portrait ({face.confidence ?? 0}% similarity).</span>} <span className="text-xs text-ink-faint">{face.byName}, {formatDate(face.at)}</span></p>}
          {scrutinyActions && <button disabled={Boolean(busy)} onClick={() => act('face', () => api.post(`${base}/face-check`))} className="button-secondary !min-h-9 !px-3 !py-1 !text-xs"><UserCheck className="h-3.5 w-3.5" />{busy === 'face' ? 'Comparing… (up to 30s)' : face ? 'Compare again' : 'Compare photograph with CNIC'}</button>}
        </div>
      </section>}

    </div><ActivityTimeline history={history} /></div>

    {modal && <ConfirmationDialog
      title={{ forward: status === 'scrutiny' ? 'Forward to examination' : 'Confirm records verified', objection: 'Raise an objection', reject: 'Reject this request', issue: status === 'issuing' ? 'Retry issuance' : 'Approve and issue', flag: `Flag ${kinds[modal.document?.kind]?.toLowerCase()}` }[modal.type]}
      busy={Boolean(busy)} onClose={() => setModal(null)} onConfirm={decisions[modal.type]} danger={modal.type === 'reject'}
      disabled={(['objection', 'reject', 'flag'].includes(modal.type) && !text.trim()) || (modal.type === 'forward' && status === 'records_verification' && !reference.trim())}
      confirmLabel={{ forward: 'Forward', objection: 'Send objection to applicant', reject: 'Reject request', issue: status === 'issuing' ? 'Retry issuance' : 'Approve and issue certificate', flag: 'Flag document' }[modal.type]}>
      <p>{{
        forward: status === 'scrutiny' ? 'All required documents are accepted and the fee is verified. The examination branch will check the record next.' : 'Record where you verified these particulars. The registrar will see your reference.',
        objection: flagged.length ? `The applicant will be asked to correct the request. Flagged documents (${flagged.map(document => kinds[document.kind]).join(', ')}) will be marked for replacement.` : 'The applicant will be asked to correct the request and resubmit it. Be specific about what to change.',
        reject: 'Rejection closes the request permanently. Use an objection instead if the applicant can fix the problem.',
        issue: 'Approving issues the attestation certificate with a new attestation number. It cannot be withdrawn afterwards.',
        flag: 'Your note is shown to the applicant if you raise an objection.'
      }[modal.type]}</p>
      {modal.type === 'forward' && status === 'records_verification' && <label className="mt-4 block font-medium text-ink">Record reference (required)<input autoFocus maxLength={120} placeholder="e.g. Result gazette 2022, p. 41" value={reference} onChange={event => setReference(event.target.value)} className="mt-2 w-full rounded-md border border-rule-strong p-3 text-sm font-normal" /></label>}
      <label className="mt-4 block font-medium text-ink">{['objection', 'reject', 'flag'].includes(modal.type) ? { objection: 'What should the applicant correct? (required)', reject: 'Reason (required)', flag: 'What is wrong with it? (required)' }[modal.type] : 'Remarks (optional)'}
        <textarea autoFocus={!(modal.type === 'forward' && status === 'records_verification')} rows={4} maxLength={2000} disabled={Boolean(busy)} value={text} onChange={event => setText(event.target.value)} className="mt-2 w-full rounded-md border border-rule-strong p-3 text-sm font-normal" />
      </label>
    </ConfirmationDialog>}
  </div>
}
