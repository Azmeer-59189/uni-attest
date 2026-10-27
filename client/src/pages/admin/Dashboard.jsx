import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileText, RefreshCw, Search, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { PageHeader } from '../../components/UI'
import { StatusBadge, statusLabels, formatDate } from '../../components/ApplicationRecord'

const views = { active: 'Needs attention', history: 'Completed', all: 'All records' }
const activeStatuses = ['pending', 'under_review', 'approved', 'issuing']
const closedStatuses = ['issued', 'rejected', 'withdrawn']

export default function AdminDashboard() {
  const { user, api } = useAuth()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const view = Object.hasOwn(views, params.get('view')) ? params.get('view') : 'active'
  const statuses = view === 'active' ? activeStatuses : view === 'history' ? closedStatuses : [...activeStatuses, ...closedStatuses]
  const status = statuses.includes(params.get('status')) ? params.get('status') : ''
  const search = (params.get('search') || '').slice(0, 100)
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1)
  const limit = [10, 20, 50].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 10
  const [stats, setStats] = useState({})
  const [applications, setApplications] = useState([])
  const [pagination, setPagination] = useState({ total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const sequence = useRef(0)
  const change = (values) => setParams(previous => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(values)) value ? next.set(key, String(value)) : next.delete(key)
    return next
  }, { replace: true })

  useEffect(() => {
    const request = ++sequence.current
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const [dashboard, records] = await Promise.all([
          api.get('/admin/dashboard', { signal: controller.signal }),
          api.get('/admin/applications', { params: { view, status: status || undefined, search, page, limit }, signal: controller.signal })
        ])
        if (request !== sequence.current) return
        setStats(dashboard.data.stats)
        setApplications(records.data.applications)
        setPagination(records.data.pagination)
        setLoaded(true)
        const last = Math.max(1, records.data.pagination.pages)
        if (page > last) setParams(previous => { const next = new URLSearchParams(previous); next.set('page', last); return next }, { replace: true })
      } catch (err) {
        if (!controller.signal.aborted) setError('Could not load applications. Please retry.')
      } finally {
        if (request === sequence.current) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort(); sequence.current += 1 }
  }, [api, view, status, search, page, limit, revision, setParams])

  const activeCount = (stats.pending || 0) + (stats.underReview || 0) + (stats.approved || 0) + (stats.issuing || 0)
  const completedCount = (stats.issued || 0) + (stats.rejected || 0) + (stats.withdrawn || 0)
  const counts = { active: activeCount, history: completedCount, all: stats.total || 0 }
  const from = pagination.total ? (page - 1) * limit + 1 : 0
  const refresh = () => setRevision(value => value + 1)

  return <div className="staff-register space-y-6 max-w-6xl mx-auto">
    <div className="staff-masthead">
      <p className="staff-office">UNIVERSITY SERVICES <span aria-hidden="true">/</span> ACADEMIC RECORDS</p>
      <PageHeader eyebrow="Degree attestation" title="Application inbox." description="A clear queue for your next review. Open a record to see its documents, history, and actions." actions={<>
        {user?.role === 'super_admin' && <Link to="/admin/manage-admins" className="button-secondary"><Users className="h-4 w-4" />Manage admins</Link>}
        <button disabled={loading} onClick={refresh} className="button-secondary"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </>} />
    </div>
    <section className="inbox-summary" aria-label="Application totals">
      {[["Waiting for review", stats.pending], ['In review', stats.underReview], ['Ready to issue', (stats.approved || 0) + (stats.issuing || 0)], ['Certificates issued', stats.issued]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{loaded ? value : '—'}</strong></div>)}
    </section>
    <section className="inbox-panel" aria-label="Application register">
      <div className="inbox-views" role="group" aria-label="Application views">
        {Object.entries(views).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => change({ view: key, status: '', page: '' })}>{label}<span>{loaded ? counts[key] : '—'}</span></button>)}
      </div>
      <div className="inbox-toolbar">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Search applications</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input type="search" className="inbox-input w-full pl-10" placeholder="Name, student ID, program, or department" value={search} maxLength={100} onChange={event => change({ search: event.target.value, page: '' })} /></label>
        <label className="flex items-center gap-2 text-xs text-slate-600">Status<select className="inbox-input" value={status} onChange={event => change({ status: event.target.value, page: '' })}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap justify-between gap-2 px-4 sm:px-5 pb-4 text-xs text-slate-500"><p>{view === 'active' ? 'Oldest submissions first' : 'Newest records first'} · {loaded ? `${pagination.total} matching records` : 'Loading records…'}</p>{(search || status) && <button className="text-navy underline" onClick={() => change({ search: '', status: '', page: '' })}>Clear filters</button>}</div>
      {error && <div role="alert" className="m-4 p-4 rounded-lg bg-red-50 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={refresh}>Retry</button></div>}
      <div aria-busy={loading} className={`inbox-results ${loading ? 'opacity-60' : ''}`}>
        <table className="inbox-table">
          <caption className="sr-only">{views[view]} applications</caption>
          <thead><tr><th scope="col">Student</th><th scope="col">Application</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Open record</span></th></tr></thead>
          <tbody>{applications.map(application => <tr key={application._id}>
            <td><span className="block font-semibold text-navy break-words">{application.student?.fullName || 'Student unavailable'}</span><span className="text-xs text-slate-500">{application.student?.studentId || '—'}</span></td>
            <td><span className="block font-medium break-words">{application.programName}</span><span className="text-xs text-slate-500 break-words">{application.department} · {application.graduationYear}</span></td>
            <td className="inbox-date"><time dateTime={application.submittedAt || application.createdAt}>{formatDate(application.submittedAt || application.createdAt)}</time></td>
            <td><StatusBadge status={application.status} /></td>
            <td><Link to={`/admin/applications/${application._id}`} state={{ returnTo: location.pathname + location.search }} className="inbox-open" aria-label={`View application for ${application.student?.fullName || application.programName}`}>View<span className="sr-only"> application</span><ArrowRight className="h-4 w-4" /></Link></td>
          </tr>)}</tbody>
        </table>
        {!applications.length && !error && <div className="py-14 px-5 text-center"><FileText className="h-8 w-8 mx-auto mb-3 text-slate-400" /><p className="font-medium text-navy">{loading ? 'Loading applications…' : search || status ? 'No matching applications' : view === 'active' ? 'The queue is clear' : 'No records here yet'}</p><p className="mt-1 text-sm text-slate-500">{!loading && (search || status ? 'Try another search or clear your filters.' : view === 'active' ? 'New submissions will appear here. Earlier decisions are in Completed.' : 'Applications will appear here as they move through review.')}</p></div>}
      </div>
      <div className="inbox-pagination">
        <label className="flex items-center gap-2">Rows<select aria-label="Rows per page" className="inbox-input" value={limit} onChange={event => change({ limit: event.target.value, page: '' })}>{[10, 20, 50].map(value => <option key={value}>{value}</option>)}</select></label>
        <span role="status">{loading ? 'Updating…' : `${from}–${Math.min(page * limit, pagination.total)} of ${pagination.total}`}</span>
        <div className="flex gap-2"><button disabled={loading || page <= 1} onClick={() => change({ page: page - 1 })} className="button-secondary !min-h-10 !py-2">Previous</button><button disabled={loading || page >= pagination.pages} onClick={() => change({ page: page + 1 })} className="button-secondary !min-h-10 !py-2">Next</button></div>
      </div>
    </section>
  </div>
}
