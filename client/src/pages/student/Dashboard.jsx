import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiError } from '../../utils/apiError'
import { Copy, RefreshCw, Download, ArrowRight, ArrowUpRight } from 'lucide-react'

import { ApplicationProgress, SectionHeading } from '../../components/UI'
import { StatusBadge, formatDate } from '../../components/ApplicationRecord'

const activeStatuses = ['draft', 'pending', 'under_review', 'approved', 'issuing']
const statuses = {
  draft: { label: 'Draft – not submitted', phrase: 'saved as a draft', next: 'Finish your details and documents, then submit for review.' },
  pending: { label: 'Waiting for review', phrase: 'waiting for review', next: 'Your application is in the review queue.' },
  under_review: { label: 'Under review', phrase: 'under review', next: 'An admin is reviewing your details and documents.' },
  approved: { label: 'Approved', phrase: 'approved', next: 'Your application is approved and waiting for the certificate to be issued.' },
  issuing: { label: 'Issuance in progress', phrase: 'being issued', next: 'The admin is completing your certificate. It will appear here once ready.' },
  issued: { label: 'Issued', next: 'Your certificate is available below.' },
  rejected: { label: 'Rejected', next: 'Read the feedback below before starting a new application.' },
  withdrawn: { label: 'Withdrawn', next: 'This application is closed. You can start a new one.' }
}

export default function StudentDashboard() {
  const { user, api, downloadDocument } = useAuth()
  const [applications, setApplications] = useState([])
  const [degrees, setDegrees] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)
  const fetchData = useCallback(async () => {
    setRefreshing(true); setError('')
    try {
      const [apps, certificates] = await Promise.all([api.get('/student/applications'), api.get('/student/degrees')])
      setApplications(apps.data.applications); setDegrees(certificates.data.degrees); setLoaded(true)
    } catch (err) { setError(apiError(err, 'Could not load your dashboard. Please retry.')) }
    finally { setLoading(false); setRefreshing(false) }
  }, [api])
  useEffect(() => { fetchData() }, [fetchData])
  const active = applications.find(application => activeStatuses.includes(application.status))
  const copyHash = async hash => {
    try { await navigator.clipboard.writeText(hash); setCopied(hash) }
    catch (_) { setError('Could not copy the hash. Select and copy the displayed hash instead.') }
  }
  if (loading) return <p role="status" className="py-24 text-center text-ink-faint">Loading your record…</p>
  const firstName = user?.fullName.split(' ')[0]
  const latestDegree = degrees[0]

  return <div className="max-w-4xl space-y-20">
    <section aria-labelledby="record-title">
      <div className="flex items-center justify-between gap-4"><p className="page-kicker">Student record · {firstName}</p><button disabled={refreshing} onClick={fetchData} className="inline-flex min-h-11 items-center gap-2 text-xs text-ink-faint hover:text-ink" aria-label="Refresh your record"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Refresh</span></button></div>
      {error && <div role="alert" className="mt-6 border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800">{error}<button disabled={refreshing} onClick={fetchData} className="ml-3 underline">Retry</button></div>}
      {loaded && <div className="mt-5 grid gap-10 md:grid-cols-[minmax(0,1fr)_15rem]">
        <div>
          <h1 id="record-title" className="page-title">{active ? <>Your {active.programName} is <em className="italic text-navy">{statuses[active.status].phrase}</em>.</> : latestDegree ? <>Your {latestDegree.snapshot?.program || latestDegree.application?.programName || 'degree'} has been <em className="italic text-navy">attested</em>.</> : 'Get your degree attested.'}</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">{active ? statuses[active.status].next : latestDegree ? 'Your certificate is below. Download a copy or share its public verification page with an employer or institution.' : 'Add your degree details and supporting documents, then submit for university review. You can save a draft and come back whenever you need.'}</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            {active ? <>
              {active.status === 'draft' ? <Link to="/student/apply" className="button-primary">Continue your draft<ArrowRight className="h-4 w-4" /></Link> : <Link to={`/student/applications/${active._id}`} className="button-primary">View application<ArrowRight className="h-4 w-4" /></Link>}
            </> : <Link to="/student/apply" className="button-primary">{degrees.length ? 'Start another application' : 'Start your application'}<ArrowRight className="h-4 w-4" /></Link>}
          </div>
        </div>
        {active && <dl className="meta-list content-start border-t border-rule pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-1">
          <dt>Reference</dt><dd className="font-mono text-[13px]">{String(active._id).slice(-8).toUpperCase()}</dd>
          <dt>{active.status === 'draft' ? 'Saved' : 'Submitted'}</dt><dd>{formatDate(active.submittedAt || active.updatedAt || active.createdAt)}</dd>
          <dt>Documents</dt><dd>{active.documents?.length || 0} attached</dd>
          <dt>Graduated</dt><dd>{active.graduationYear}</dd>
        </dl>}
      </div>}
      {active && active.status !== 'draft' && <ApplicationProgress status={active.status} className="mt-12" />}
    </section>

    {loaded && degrees.length > 0 && <section aria-labelledby="certificates-title" className="space-y-8">
      <SectionHeading id="certificates-title" title="Certificates" aside={`${degrees.length} issued`} />
      {degrees.map(degree => <article key={degree._id} className="certificate-sheet">
        <p className="page-kicker text-center">Certificate of attestation</p>
        <h3 className="display mt-5 text-center text-3xl sm:text-4xl">{degree.snapshot?.program || degree.application?.programName}</h3>
        <p className="mt-3 text-center text-sm text-ink-soft">Awarded to {degree.snapshot?.studentName || user?.fullName}{degree.snapshot?.graduationYear ? `, class of ${degree.snapshot.graduationYear}` : ''}</p>
        <div className="mx-auto mt-8 h-px w-24 bg-rule-strong" />
        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.16em] text-ink-faint">Verification hash</p>
        <p className="mx-auto mt-2 max-w-xl break-all text-center font-mono text-xs text-ink-soft select-all">{degree.hash}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
          {degree.pdfUrl && <a href={degree.pdfUrl} target="_blank" rel="noreferrer" className="button-primary"><Download className="h-4 w-4" />Download certificate</a>}
          <Link to={`/verify/${degree.hash}`} className="button-secondary">Public verification page<ArrowUpRight className="h-4 w-4" /></Link>
          <button onClick={() => copyHash(degree.hash)} className="inline-flex min-h-11 items-center gap-1.5 text-ink-soft hover:text-ink"><Copy className="h-3.5 w-3.5" /><span aria-live="polite">{copied === degree.hash ? 'Copied' : 'Copy hash'}</span></button>
        </div>
      </article>)}
    </section>}

    {loaded && <section aria-labelledby="applications-title">
      <SectionHeading id="applications-title" title="Applications" aside={`${applications.length} on record`} />
      {!applications.length && <p className="py-10 text-ink-soft">You have no applications yet. <Link to="/student/apply" className="text-link">Start your first application</Link></p>}
      <ol>{applications.map(application => {
        const status = statuses[application.status] || { label: application.status, next: '' }
        const unfinishedLegacy = application.status === 'pending' && !application.submittedAt && !application.documents?.length
        return <li key={application._id} className="grid gap-x-8 gap-y-3 border-b border-rule py-7 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div className="min-w-0">
            <h3 className="display text-2xl leading-snug"><Link to={`/student/applications/${application._id}`} className="hover:underline decoration-1 underline-offset-4">{application.programName}</Link></h3>
            <p className="mt-1 text-sm text-ink-faint">{application.department} · {application.graduationYear}{application.cgpa != null ? ` · CGPA ${application.cgpa}` : ''}</p>
            <p className="mt-3 text-sm text-ink-soft">{unfinishedLegacy ? 'Finish uploading your documents so the admin can review your application.' : status.next}</p>
            {application.rejectionReason && <p className="mt-3 border-l-2 border-red-700 pl-3 text-sm text-red-800"><strong className="font-medium">Reason for rejection:</strong> {application.rejectionReason}</p>}
            {application.adminComments && <p className="mt-3 border-l-2 border-rule-strong pl-3 text-sm text-ink-soft"><strong className="font-medium text-ink">Reviewer’s note:</strong> {application.adminComments}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {(application.status === 'draft' || unfinishedLegacy) && <Link to="/student/apply" className="text-link">Continue application</Link>}
              <Link to={`/student/applications/${application._id}`} className="text-link">Details & history</Link>
              {(application.documents || []).map(doc => <button key={doc._id} onClick={() => downloadDocument(doc._id, doc.originalName).catch(err => setError(apiError(err, 'Document download failed.')))} className="inline-flex min-h-8 max-w-full items-center gap-1.5 text-xs text-ink-faint hover:text-ink"><Download className="h-3 w-3 shrink-0" /><span className="truncate">{doc.originalName}</span></button>)}
            </div>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-end sm:text-right">
            <StatusBadge status={unfinishedLegacy ? 'draft' : application.status} label={unfinishedLegacy ? 'Documents needed' : status.label} />
            <p className="font-mono text-[11px] text-ink-faint">{application.status === 'draft' ? 'Saved' : 'Submitted'} {formatDate(application.submittedAt || application.createdAt)}</p>
          </div>
        </li>
      })}</ol>
    </section>}
  </div>
}
