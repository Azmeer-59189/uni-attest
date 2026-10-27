import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiError } from '../utils/apiError'
import { ApplicationProgress } from '../components/UI'
import { ActivityTimeline, CertificateLinks, RecordDocuments, StatusBadge, formatDate } from '../components/ApplicationRecord'
import ConfirmationDialog from '../components/ConfirmationDialog'

const instructions = { pending: 'Open the supporting documents, then start the review.', under_review: 'Check the academic record and supporting evidence before making a decision.', approved: 'The review is complete. Issue the certificate when ready.', issuing: 'Issuance has started. If it was interrupted, retry to complete the same certificate.', issued: 'The certificate has been issued. Its verification page is ready to share.', rejected: 'This application is closed. The reason for the decision is recorded below.', withdrawn: 'The student has withdrawn this application.', draft: 'This draft has not been submitted yet. Continue it to update details and documents.' }
const studentInstructions = { pending: 'Your application is waiting for university review.', under_review: 'An admin is checking your academic record and supporting documents.', approved: 'Your application is approved. The university will issue your certificate next.', issuing: 'Your certificate is being prepared. It will appear here once ready.' }

export default function ApplicationDetail() {
  const { id } = useParams()
  return <ApplicationRecordView id={id} />
}

// Rendered as a full page, or compact inside the staff console's detail pane.
export function ApplicationRecordView({ id, compact = false, onChange }) {
  const { user, api, downloadDocument } = useAuth()
  const admin = user.role !== 'student'
  // Inside the staff console the queue owns the page's h1.
  const Title = compact ? 'h2' : 'h1'
  const prefix = admin ? 'admin' : 'student'
  const location = useLocation()
  const suggestedReturn = location.state?.returnTo
  const back = admin && typeof suggestedReturn === 'string' && /^\/admin\/dashboard(?:\?|$)/.test(suggestedReturn) ? suggestedReturn : `/${prefix}/dashboard`
  const [application, setApplication] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState(null)
  const [comment, setComment] = useState('')
  const load = useCallback(async (signal) => {
    setLoading(true)
    try {
      const { data } = await api.get(`/${prefix}/applications/${id}`, { signal })
      setApplication(data.application)
    } catch (err) { if (!signal?.aborted) setError(apiError(err, 'Could not load this application.')) }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [api, prefix, id])
  useEffect(() => { setApplication(null); setError(''); setNotice(''); const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load])
  const act = async (action) => {
    setBusy(true); setError(''); setNotice('')
    try {
      if (action === 'issue') await api.post(`/admin/applications/${id}/issue`)
      else await api.patch(`/admin/applications/${id}/${action}`, action === 'reject' ? { reason: comment } : action === 'approve' ? { comments: comment } : {})
      setModal(null); setComment('')
      onChange?.()
      setNotice(({ review: 'Review started.', approve: 'Application approved.', reject: 'Application rejected.', issue: 'Certificate issued successfully.' })[action])
    } catch (err) { setError(apiError(err, 'Action failed. Please reload the application and try again.')); setModal(null) }
    finally { await load(); setBusy(false) }
  }
  const openModal = type => { setComment(''); setError(''); setModal(type) }

  return <div className={compact ? 'record-compact space-y-6' : 'max-w-6xl mx-auto space-y-8'}>
    {!compact && <Link to={back} className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"><ArrowLeft className="h-4 w-4" />{admin ? 'Back to the queue' : 'Back to overview'}</Link>}
    {error && <div role="alert" className="border-l-2 border-red-700 bg-red-50 text-red-800 p-4 text-sm">{error}<button disabled={loading || busy} className="ml-3 underline" onClick={() => { setError(''); load() }}>Reload</button></div>}
    {notice && <p role="status" className="flex items-center gap-2 border-l-2 border-emerald-700 bg-emerald-50 text-emerald-800 p-4 text-sm"><CheckCircle className="h-4 w-4 shrink-0" />{notice}</p>}
    {!application && loading && <p role="status" className="py-16 text-center text-ink-faint">Loading application…</p>}
    {application && <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0"><p className="page-kicker mb-2"><span className="font-mono tracking-normal normal-case">{String(application._id).slice(-8).toUpperCase()}</span> · {admin ? 'Application' : 'Your application'}</p><Title className={compact ? 'display text-3xl leading-tight' : 'page-title'}>{admin ? application.student?.fullName || 'Application details' : application.programName}</Title><p className="mt-2 text-sm text-ink-soft">{admin ? <><span className="font-mono text-[13px]">{application.student?.studentId || 'Student ID unavailable'}</span> · {application.programName}</> : `${application.department} · ${application.graduationYear}`}</p></div>
        <div className="flex items-center gap-4"><StatusBadge status={application.status} /><button disabled={loading || busy} aria-label="Refresh application" onClick={() => { setError(''); load() }} className="button-secondary !min-h-10 !px-3"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
      </header>
      <div className="record-guidance"><div className="min-w-0"><p className="text-sm font-medium text-ink">{(!admin && studentInstructions[application.status]) || instructions[application.status]}</p>{admin && application.status === 'issuing' && <p className="mt-2 text-xs text-ink-soft">If another request is still running, wait for it to finish before retrying.</p>}</div><div className="flex flex-wrap gap-2 shrink-0">
        {admin && application.status === 'pending' && <button disabled={busy || loading} onClick={() => act('review')} className="button-primary">{busy ? 'Processing…' : 'Start review'}</button>}
        {admin && application.status === 'under_review' && <button disabled={busy || loading} onClick={() => openModal('approve')} className="button-primary">Approve</button>}
        {admin && ['approved', 'issuing'].includes(application.status) && <button disabled={busy || loading} onClick={() => openModal('issue')} className="button-primary">{application.status === 'issuing' ? 'Retry issuance' : 'Issue degree'}</button>}
        {admin && ['pending', 'under_review', 'approved'].includes(application.status) && <button disabled={busy || loading} onClick={() => openModal('reject')} className="button-secondary !text-red-700 hover:!border-red-700">Reject</button>}
        {!admin && application.status === 'draft' && <Link to="/student/apply" className="button-primary">Continue draft</Link>}
      </div></div>
      <div className="record-layout"><div className="min-w-0 space-y-5">
        <section className="record-section"><h2>Academic record</h2><dl className="record-fields">{[
          ...(admin ? [['Student ID', application.student?.studentId], ['Email', application.student?.email], ['Phone', application.student?.phone]] : []),
          ['Program', application.programName], ['Department', application.department], ['Graduation year', application.graduationYear], ['CGPA', application.cgpa ?? 'Not supplied'], ['Created', formatDate(application.createdAt)], ['Submitted', application.submittedAt ? formatDate(application.submittedAt) : application.status === 'draft' ? 'Not submitted' : 'Date not recorded']
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not supplied'}</dd></div>)}</dl><ApplicationProgress status={application.status} className="mt-8" /></section>
        {(application.adminComments || application.rejectionReason) && <section className="record-section"><h2>Review feedback</h2>{application.adminComments && <p className="mt-3 text-sm text-ink whitespace-pre-wrap break-words">{application.adminComments}</p>}{application.rejectionReason && <div className="mt-3 p-3 border-l-2 border-red-700 bg-red-50 text-red-800 text-sm whitespace-pre-wrap break-words"><strong>Reason for rejection:</strong> {application.rejectionReason}</div>}</section>}
        <RecordDocuments documents={application.documents} busy={busy} onDownload={async doc => { try { await downloadDocument(doc._id, doc.originalName) } catch (err) { setError(apiError(err, 'Document download failed.')) } }} />
        <CertificateLinks degree={application.degree} />
      </div><ActivityTimeline history={application.history} /></div>
    </>}
    {modal && <ConfirmationDialog title={modal === 'approve' ? 'Approve application' : modal === 'reject' ? 'Reject application' : 'Issue degree certificate'} busy={busy} onClose={() => setModal(null)} onConfirm={() => act(modal)} disabled={modal === 'reject' && !comment.trim()} danger={modal === 'reject'} confirmLabel={modal === 'approve' ? 'Confirm approval' : modal === 'reject' ? 'Confirm rejection' : 'Confirm issuance'}>
      <p>{modal === 'issue' ? 'This creates the certificate from the reviewed academic record. An interrupted attempt will reuse the same certificate when retried.' : modal === 'reject' ? 'Explain the decision so the student knows what needs attention.' : 'Confirm that you have checked the academic record and supporting documents.'}</p>
      {modal !== 'issue' && <label className="block mt-4 font-medium text-ink">{modal === 'reject' ? 'Reason (required)' : 'Comments (optional)'}<textarea autoFocus rows={4} maxLength={2000} disabled={busy} value={comment} onChange={event => setComment(event.target.value)} className="mt-2 w-full border border-rule-strong rounded-md p-3 text-sm font-normal" /></label>}
    </ConfirmationDialog>}
  </div>
}
