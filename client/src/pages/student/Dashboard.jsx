import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiError } from '../../utils/apiError'
import { AlertTriangle, Copy, RefreshCw, Download, ArrowRight, ArrowUpRight } from 'lucide-react'
import { OPEN_STATUSES, formatPKR, requestTypeLabels } from '../../utils/workflow'

import { ApplicationProgress, SectionHeading } from '../../components/UI'
import { StatusBadge, formatDate } from '../../components/ApplicationRecord'

const statuses = {
  draft: { label: 'Draft – not submitted', phrase: 'saved as a draft', next: 'Finish your details, documents, and fee payment, then submit.' },
  scrutiny: { label: 'Document scrutiny', phrase: 'in document scrutiny', next: 'The attestation cell is checking your documents and fee payment.' },
  objection: { label: 'Objection – action needed', phrase: 'waiting for your correction', next: 'The university has asked for a correction. Fix it and resubmit to continue.' },
  records_verification: { label: 'Records verification', phrase: 'being verified', next: 'The examination branch is checking your particulars against university records.' },
  registrar_approval: { label: 'Registrar approval', phrase: 'with the registrar', next: 'Your request is waiting for the registrar’s final approval.' },
  issuing: { label: 'Issuing', phrase: 'being issued', next: 'The registrar has approved your request. The certificate will appear here shortly.' },
  issued: { label: 'Attested', next: 'Your certificate is available below.' },
  rejected: { label: 'Rejected', next: 'Read the reason before starting a new request.' },
  withdrawn: { label: 'Withdrawn', next: 'This request is closed. You can start a new one.' }
}

export default function StudentDashboard() {
  const { user, api } = useAuth()
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
  const active = applications.find(application => OPEN_STATUSES.includes(application.status))
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
          <h1 id="record-title" className="page-title">{active ? <>Your request is <em className={`italic ${active.status === 'objection' ? 'text-amber-800' : 'text-navy'}`}>{statuses[active.status].phrase}</em>.</> : latestDegree ? <>Your {latestDegree.snapshot?.program || latestDegree.application?.programName || 'degree'} has been <em className="italic text-navy">attested</em>.</> : 'Get your degree attested.'}</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">{active ? statuses[active.status].next : latestDegree ? 'Your certificate is below. Download a copy or share its public verification page with an employer or institution.' : 'Choose what to attest, enter your particulars, pay the fee by bank challan, and upload your documents. Your draft is saved as you go.'}</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            {active ? <>
              {active.status === 'draft' ? <Link to="/student/apply" className="button-primary">Continue your request<ArrowRight className="h-4 w-4" /></Link> : active.status === 'objection' ? <Link to="/student/apply" className="button-primary">Correct and resubmit<ArrowRight className="h-4 w-4" /></Link> : <Link to={`/student/applications/${active._id}`} className="button-primary">Track your request<ArrowRight className="h-4 w-4" /></Link>}
              {active.status !== 'draft' && active.status !== 'objection' ? null : <Link to={`/student/applications/${active._id}`} className="text-link text-sm">View details</Link>}
            </> : <Link to="/student/apply" className="button-primary">{degrees.length ? 'Request another attestation' : 'Request attestation'}<ArrowRight className="h-4 w-4" /></Link>}
          </div>
        </div>
        {active && <dl className="meta-list content-start border-t border-rule pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-1">
          <dt>Application</dt><dd className="font-mono text-[13px]">{active.applicationNumber}</dd>
          <dt>Request</dt><dd>{requestTypeLabels[active.requestType]?.replace(' attestation', '')}{active.processing === 'urgent' ? ', urgent' : ''}</dd>
          <dt>{active.status === 'draft' ? 'Saved' : 'Submitted'}</dt><dd>{formatDate(active.submittedAt || active.updatedAt || active.createdAt)}</dd>
          <dt>Fee</dt><dd>{formatPKR(active.fee?.amount)}{active.fee?.verified ? ' · verified' : active.fee?.paidOn ? ' · paid' : ''}</dd>
        </dl>}
      </div>}
      {active?.status === 'objection' && active.objection?.reason && <div className="mt-10 border-l-2 border-amber-600 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-amber-950"><AlertTriangle className="h-4 w-4" />What needs correcting</p><p className="mt-1 whitespace-pre-wrap text-sm text-amber-950">{active.objection.reason}</p></div>}
      {active && active.status !== 'draft' && <ApplicationProgress status={active.status} objectionStage={active.objection?.stage} className="mt-12" />}
    </section>

    {loaded && degrees.length > 0 && <section aria-labelledby="certificates-title" className="space-y-8">
      <SectionHeading id="certificates-title" title="Certificates" aside={`${degrees.length} issued`} />
      {degrees.map(degree => <article key={degree._id} className="certificate-sheet">
        <p className="page-kicker text-center">{degree.attestationNumber ? <span className="font-mono tracking-normal">{degree.attestationNumber}</span> : 'Certificate of attestation'}</p>
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
      <SectionHeading id="applications-title" title="Requests" aside={`${applications.length} on record`} />
      {!applications.length && <p className="py-10 text-ink-soft">You have no requests yet. <Link to="/student/apply" className="text-link">Request attestation</Link></p>}
      <ol>{applications.map(application => {
        const status = statuses[application.status] || { label: application.status, next: '' }
        return <li key={application._id} className="grid gap-x-8 gap-y-3 border-b border-rule py-7 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div className="min-w-0">
            <h3 className="display text-2xl leading-snug"><Link to={`/student/applications/${application._id}`} className="hover:underline decoration-1 underline-offset-4">{application.programName}</Link></h3>
            <p className="mt-1 text-sm text-ink-faint"><span className="font-mono">{application.applicationNumber}</span> · {requestTypeLabels[application.requestType] || 'Degree attestation'} · {application.graduationYear}</p>
            <p className="mt-3 text-sm text-ink-soft">{status.next}</p>
            {application.rejectionReason && <p className="mt-3 border-l-2 border-red-700 pl-3 text-sm text-red-800"><strong className="font-medium">Reason for rejection:</strong> {application.rejectionReason}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {['draft', 'objection'].includes(application.status) && <Link to="/student/apply" className="text-link">{application.status === 'objection' ? 'Correct and resubmit' : 'Continue request'}</Link>}
              <Link to={`/student/applications/${application._id}`} className="text-link">Details & history</Link>
            </div>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-end sm:text-right">
            <StatusBadge status={application.status} label={status.label} />
            <p className="font-mono text-[11px] text-ink-faint">{application.status === 'draft' ? 'Saved' : 'Submitted'} {formatDate(application.submittedAt || application.createdAt)}</p>
          </div>
        </li>
      })}</ol>
    </section>}
  </div>
}
