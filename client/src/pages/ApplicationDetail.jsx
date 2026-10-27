import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiError } from '../utils/apiError'
import { PageHeader, ApplicationProgress } from '../components/UI'
import { ActivityTimeline, CertificateLinks, RecordDocuments, StatusBadge, formatDate } from '../components/ApplicationRecord'
import ConfirmationDialog from '../components/ConfirmationDialog'

const instructions = { pending: 'Open the supporting documents, then start the review.', under_review: 'Check the academic record and supporting evidence before making a decision.', approved: 'The review is complete. Issue the certificate when ready.', issuing: 'Issuance has started. If it was interrupted, retry to complete the same certificate.', issued: 'The certificate has been issued. Its verification page is ready to share.', rejected: 'This application is closed. The reason for the decision is recorded below.', withdrawn: 'The student has withdrawn this application.', draft: 'This draft has not been submitted yet. Continue it to update details and documents.' }
const studentInstructions = { pending: 'Your application is waiting for university review.', under_review: 'An admin is checking your academic record and supporting documents.', approved: 'Your application is approved. The university will issue your certificate next.', issuing: 'Your certificate is being prepared. It will appear here once ready.' }

export default function ApplicationDetail() {
  const { id } = useParams()
  const { user, api, downloadDocument } = useAuth()
  const admin = user.role !== 'student'
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
      setNotice(({ review: 'Review started.', approve: 'Application approved.', reject: 'Application rejected.', issue: 'Certificate issued successfully.' })[action])
    } catch (err) { setError(apiError(err, 'Action failed. Please reload the application and try again.')); setModal(null) }
    finally { await load(); setBusy(false) }
  }
  const openModal = type => { setComment(''); setError(''); setModal(type) }

  return <div className="max-w-6xl mx-auto space-y-6">
    <Link to={back} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-navy"><ArrowLeft className="h-4 w-4" />{admin ? 'Back to application inbox' : 'Back to dashboard'}</Link>
    {error && <div role="alert" className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-4 text-sm">{error}<button disabled={loading || busy} className="ml-3 underline" onClick={() => { setError(''); load() }}>Reload</button></div>}
    {notice && <p role="status" className="flex items-center gap-2 bg-emerald-50 text-emerald-800 rounded-xl p-4 text-sm"><CheckCircle className="h-4 w-4 shrink-0" />{notice}</p>}
    {!application && loading && <p role="status" className="py-16 text-center text-slate-500">Loading application…</p>}
    {application && <>
      <PageHeader eyebrow={`Application · ${String(application._id).slice(-8).toUpperCase()}`} title={admin ? application.student?.fullName || 'Application details' : application.programName} description={admin ? `${application.student?.studentId || 'Student ID unavailable'} · ${application.programName}` : `${application.department} · ${application.graduationYear}`} actions={<><StatusBadge status={application.status} /><button disabled={loading || busy} aria-label="Refresh application" onClick={() => { setError(''); load() }} className="button-secondary !px-3"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></>} />
      <div className="record-guidance"><div className="min-w-0"><p className="text-sm font-medium text-navy">{(!admin && studentInstructions[application.status]) || instructions[application.status]}</p>{admin && application.status === 'issuing' && <p className="mt-2 text-xs text-slate-600">If another request is still running, wait for it to finish before retrying.</p>}</div><div className="flex flex-wrap gap-2 shrink-0">
        {admin && application.status === 'pending' && <button disabled={busy || loading} onClick={() => act('review')} className="button-primary">{busy ? 'Processing…' : 'Start review'}</button>}
        {admin && application.status === 'under_review' && <button disabled={busy || loading} onClick={() => openModal('approve')} className="button-primary">Approve</button>}
        {admin && ['approved', 'issuing'].includes(application.status) && <button disabled={busy || loading} onClick={() => openModal('issue')} className="button-primary">{application.status === 'issuing' ? 'Retry issuance' : 'Issue degree'}</button>}
        {admin && ['pending', 'under_review', 'approved'].includes(application.status) && <button disabled={busy || loading} onClick={() => openModal('reject')} className="button-secondary !text-red-700">Reject</button>}
        {!admin && application.status === 'draft' && <Link to="/student/apply" className="button-primary">Continue draft</Link>}
      </div></div>
      <div className="record-layout"><div className="min-w-0 space-y-5">
        <section className="record-section"><h2>Academic record</h2><dl className="record-fields">{[
          ...(admin ? [['Student ID', application.student?.studentId], ['Email', application.student?.email], ['Phone', application.student?.phone]] : []),
          ['Program', application.programName], ['Department', application.department], ['Graduation year', application.graduationYear], ['CGPA', application.cgpa ?? 'Not supplied'], ['Created', formatDate(application.createdAt)], ['Submitted', application.submittedAt ? formatDate(application.submittedAt) : application.status === 'draft' ? 'Not submitted' : 'Date not recorded']
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not supplied'}</dd></div>)}</dl><ApplicationProgress status={application.status} /></section>
        {(application.adminComments || application.rejectionReason) && <section className="record-section"><h2>Review feedback</h2>{application.adminComments && <p className="mt-3 text-sm whitespace-pre-wrap break-words">{application.adminComments}</p>}{application.rejectionReason && <div className="mt-3 p-3 bg-red-50 text-red-800 rounded-lg text-sm whitespace-pre-wrap break-words"><strong>Reason for rejection:</strong> {application.rejectionReason}</div>}</section>}
        <RecordDocuments documents={application.documents} busy={busy} onDownload={async doc => { try { await downloadDocument(doc._id, doc.originalName) } catch (err) { setError(apiError(err, 'Document download failed.')) } }} />
        <CertificateLinks degree={application.degree} />
      </div><ActivityTimeline history={application.history} /></div>
    </>}
    {modal && <ConfirmationDialog title={modal === 'approve' ? 'Approve application' : modal === 'reject' ? 'Reject application' : 'Issue degree certificate'} busy={busy} onClose={() => setModal(null)} onConfirm={() => act(modal)} disabled={modal === 'reject' && !comment.trim()} danger={modal === 'reject'} confirmLabel={modal === 'approve' ? 'Confirm approval' : modal === 'reject' ? 'Confirm rejection' : 'Confirm issuance'}>
      <p>{modal === 'issue' ? 'This creates the certificate from the reviewed academic record. An interrupted attempt will reuse the same certificate when retried.' : modal === 'reject' ? 'Explain the decision so the student knows what needs attention.' : 'Confirm that you have checked the academic record and supporting documents.'}</p>
      {modal !== 'issue' && <label className="block mt-4 font-medium text-navy">{modal === 'reject' ? 'Reason (required)' : 'Comments (optional)'}<textarea autoFocus rows={4} maxLength={2000} disabled={busy} value={comment} onChange={event => setComment(event.target.value)} className="mt-2 w-full border border-slate-300 rounded-lg p-3 text-sm font-normal" /></label>}
    </ConfirmationDialog>}
  </div>
}
