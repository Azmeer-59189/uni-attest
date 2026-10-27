import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiError } from '../../utils/apiError'
import { FileText, Award, Plus, Copy, RefreshCw, Clock3, ArrowUpRight, Download, ArrowRight } from 'lucide-react'

import { PageHeader, StatCard, ApplicationProgress, SectionHeading } from '../../components/UI'

const activeStatuses = ['draft', 'pending', 'under_review', 'approved', 'issuing']
const statuses = {
  draft: { label: 'Draft - not submitted', color: 'bg-gray-100 text-gray-700', next: 'Finish your details and documents, then submit for review.' },
  pending: { label: 'Waiting for review', color: 'bg-yellow-50 text-yellow-800', next: 'Your application is in the review queue.' },
  under_review: { label: 'Under review', color: 'bg-blue-50 text-blue-700', next: 'An admin is reviewing your details and documents.' },
  approved: { label: 'Approved', color: 'bg-green-50 text-green-700', next: 'Your application is approved and waiting for the certificate to be issued.' },
  issuing: { label: 'Issuance in progress', color: 'bg-yellow-50 text-yellow-800', next: 'The admin is completing your certificate. It will appear here once ready.' },
  issued: { label: 'Issued', color: 'bg-purple-50 text-purple-700', next: 'Your certificate is available below.' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700', next: 'Read the feedback below before starting a new application.' },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-600', next: 'This application is closed. You can start a new one.' }
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
  if (loading) return <p role="status" className="text-center py-16 text-gray-500">Loading your dashboard...</p>
  return <div className="max-w-6xl mx-auto space-y-8">
    <PageHeader eyebrow="Student overview" title="Your application, one step at a time." description={`Welcome back, ${user?.fullName.split(' ')[0]}. Track your applications and keep your credentials in one place.`} actions={<>
      <button disabled={refreshing} onClick={fetchData} className="button-secondary !px-3" aria-label="Refresh dashboard"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
      {loaded && <Link to="/student/apply" className="button-primary"><Plus className="h-4 w-4" />{active ? active.status === 'draft' ? 'Continue draft' : 'View active application' : 'New application'}</Link>}
    </>} />
    {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}<button disabled={refreshing} onClick={fetchData} className="ml-3 underline">Retry</button></div>}
    {loaded && <>
      {active && <Link to="/student/apply" className="flex items-center gap-4 rounded-2xl border border-[#d5e1f0] bg-[#edf3fb] p-5 sm:p-6"><span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#345f94]"><FileText className="h-5 w-5" /></span><div className="flex-1"><p className="text-sm font-semibold text-navy">{active.status === 'draft' ? 'Your next step: finish your application' : 'Your application is moving forward'}</p><p className="text-sm text-[#4b607c] mt-1.5 leading-relaxed">{statuses[active.status]?.next}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-[#345f94]" /></Link>}
      {!active && <div className="rounded-2xl border border-blue-200 bg-[#edf3fb] p-6 sm:p-8"><p className="page-kicker mb-2">Your next step</p><h2 className="text-xl font-semibold text-navy">{degrees.length ? 'Your achievement is ready to share' : 'Get your degree attested'}</h2><p className="mt-2 max-w-xl text-sm text-slate-600">{degrees.length ? 'Find your issued certificates below. Download a copy or open its verification page.' : 'Start with your degree details, add your documents, then submit for university review. Save a draft and return whenever you need.'}</p><Link to="/student/apply" className="button-primary mt-5">{degrees.length ? 'Start another application' : 'Start your application'}<ArrowRight className="h-4 w-4" /></Link></div>}
      <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-4">
        <StatCard label="Total applications" value={applications.length} caption="Your attestation requests" icon={FileText} />
        <StatCard label="In progress" value={applications.filter(item => activeStatuses.includes(item.status)).length} caption="Drafts and active applications" icon={Clock3} accent="text-amber-700 bg-amber-50" />
        <StatCard label="Certificates" value={degrees.length} caption="Issued and ready to share" icon={Award} accent="text-emerald-700 bg-emerald-50" />
      </div>
      <section className="space-y-4"><SectionHeading title="My applications" description="Your requests, documents, and latest updates." aside={<span className="text-xs text-slate-500">{applications.length} total</span>} />
        {!applications.length && <div className="panel p-10 text-center"><FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">You have no applications yet.</p><Link to="/student/apply" className="text-navy underline text-sm mt-2 inline-block">Start your first application</Link></div>}
        {applications.map(application => {
          const status = statuses[application.status] || { label: application.status, color: 'bg-gray-100', next: '' }
          const unfinishedLegacy = application.status === 'pending' && !application.submittedAt && !application.documents?.length
          return <article key={application._id} className="panel p-5 sm:p-6 space-y-3">
            <div className="flex justify-between gap-3 flex-wrap"><div><h3 className="text-base font-semibold text-navy">{application.programName}</h3><p className="text-sm text-gray-500">{application.department} | {application.graduationYear}{application.cgpa != null ? ` | CGPA ${application.cgpa}` : ''}</p></div><span className={`status-pill h-fit ${status.color}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />{unfinishedLegacy ? 'Documents needed' : status.label}</span></div>
            <p className="text-sm text-gray-500">{unfinishedLegacy ? 'Finish uploading your documents so the admin can review your application.' : status.next}</p>
            <p className="text-xs text-gray-500">{application.status === 'draft' ? 'Draft saved' : 'Submitted'} {new Date(application.submittedAt || application.createdAt).toLocaleDateString('en-PK')} | {application.documents?.length || 0} document(s)</p>
            {application.rejectionReason && <p className="bg-red-50 text-red-800 rounded-lg p-3 text-sm"><strong>Reason for rejection:</strong> {application.rejectionReason}</p>}
            {application.adminComments && <p className="bg-gray-50 rounded-lg p-3 text-sm"><strong>Admin feedback:</strong> {application.adminComments}</p>}
            <div className="flex flex-wrap gap-3 text-sm">{(application.status === 'draft' || unfinishedLegacy) && <Link to="/student/apply" className="text-navy underline font-medium">Continue application</Link>}
              <Link to={`/student/applications/${application._id}`} className="text-navy underline font-medium">View details & history</Link>
              {(application.documents || []).map(doc => <button key={doc._id} onClick={() => downloadDocument(doc._id, doc.originalName).catch(err => setError(apiError(err, 'Document download failed.')))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:text-navy hover:border-slate-400"><Download className="h-3 w-3" />{doc.originalName}</button>)}
            </div>
            <ApplicationProgress status={application.status} />
          </article>
        })}
      </section>
      {degrees.length > 0 && <section className="space-y-4"><SectionHeading title="Your certificates" description="A record of your achievement, ready to share." />{degrees.map(degree => <article key={degree._id} className="relative overflow-hidden bg-navy text-white rounded-2xl p-6 sm:p-8 space-y-4 border border-navy-light">
        <div className="flex gap-3 items-center"><Award className="h-6 w-6 text-gold" /><h3 className="font-serif text-xl text-white">{degree.snapshot?.program || degree.application?.programName}</h3></div>
        <p className="font-mono text-xs break-all text-gray-300 select-all">{degree.hash}</p>
        <div className="flex gap-3 flex-wrap text-sm"><button onClick={() => copyHash(degree.hash)} className="inline-flex gap-1 items-center text-gold"><Copy className="h-3 w-3" />{copied === degree.hash ? 'Copied' : 'Copy hash'}</button><Link to={`/verify/${degree.hash}`} className="text-gold underline">Verify certificate</Link>{degree.pdfUrl && <a href={degree.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gold/40 px-3 py-2 text-gold text-xs"><Download className="h-3.5 w-3.5" />Download certificate</a>}</div>
      </article>)}</section>}
    </>}
  </div>
}
