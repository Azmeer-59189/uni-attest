import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, RefreshCw, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { StatusBadge, statusLabels, formatDate } from '../../components/ApplicationRecord'
import { staffRoleLabels } from '../../utils/workflow'
import { ApplicationRecordView } from '../ApplicationDetail'

const views = { queue: 'My queue', active: 'In progress', history: 'Completed', all: 'All' }
const activeStatuses = ['scrutiny', 'objection', 'records_verification', 'registrar_approval', 'issuing']
const closedStatuses = ['issued', 'rejected', 'withdrawn']
const requestShort = { degree: 'Degree', transcript: 'Transcript', degree_transcript: 'Degree + transcript' }
const day = 86400000
const isTyping = target => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

function age(application) {
  const days = Math.floor((Date.now() - new Date(application.submittedAt || application.createdAt)) / day)
  return { days, label: days < 1 ? 'today' : `${days}d` }
}

export default function AdminDashboard() {
  const { api, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = Object.hasOwn(views, params.get('view')) ? params.get('view') : 'queue'
  const [myStages, setMyStages] = useState([])
  const statuses = view === 'queue' ? myStages : view === 'active' ? activeStatuses : view === 'history' ? closedStatuses : [...activeStatuses, ...closedStatuses]
  const status = statuses.includes(params.get('status')) ? params.get('status') : ''
  const search = (params.get('search') || '').slice(0, 100)
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1)
  const limit = [10, 20, 50].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 20
  const selected = /^[a-f0-9]{24}$/i.test(params.get('selected') || '') ? params.get('selected') : ''
  const [stats, setStats] = useState({})
  const [applications, setApplications] = useState([])
  const [pagination, setPagination] = useState({ total: 0, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const sequence = useRef(0)
  const detail = useRef(null)
  const previousSelection = useRef(selected)
  const change = (values, options = { replace: true }) => setParams(previous => {
    const next = new URLSearchParams(previous)
    for (const [key, value] of Object.entries(values)) value ? next.set(key, String(value)) : next.delete(key)
    return next
  }, options)
  // Opening a record from the list adds a history entry, so the browser's Back returns to the list.
  // Moving between open records replaces it, so Back doesn't step through every record viewed.
  const open = id => change({ selected: id }, selected ? { replace: true, state: location.state } : { state: { fromQueue: true } })
  const closeRecord = () => location.state?.fromQueue ? navigate(-1) : change({ selected: '' })
  const narrow = () => window.matchMedia('(max-width: 1023px)').matches

  useEffect(() => {
    const request = ++sequence.current
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const records = await api.get('/admin/applications', { params: { view, status: status || undefined, search, page, limit }, signal: controller.signal })
        if (request !== sequence.current) return
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

  // Totals don't depend on the search or filters, so they reload only on refresh.
  useEffect(() => {
    const controller = new AbortController()
    api.get('/admin/dashboard', { signal: controller.signal }).then(({ data }) => { setStats(data.stats); setMyStages(data.myStages) }).catch(() => {})
    return () => controller.abort()
  }, [api, revision])

  // On narrow screens the list and the record take turns: move focus with them so it is never left on a hidden row.
  useEffect(() => {
    const previous = previousSelection.current
    previousSelection.current = selected
    if (detail.current) detail.current.scrollTop = 0
    if (!narrow()) return
    if (selected) { window.scrollTo(0, 0); detail.current?.focus({ preventScroll: true }) }
    else if (previous) {
      const row = document.getElementById(`queue-${previous}`)
      row?.scrollIntoView({ block: 'center' }); row?.focus({ preventScroll: true })
    }
  }, [selected])

  // J / K or the arrow keys step through the queue. They work only while focus is in the queue,
  // so single-letter shortcuts can't fire by accident elsewhere (WCAG 2.1.4).
  const queueKeys = event => {
    if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
    const step = { j: 1, arrowdown: 1, k: -1, arrowup: -1 }[event.key.toLowerCase()]
    if (!step || !applications.length) return
    event.preventDefault()
    const index = applications.findIndex(application => application._id === selected)
    const next = applications[Math.min(applications.length - 1, Math.max(0, index < 0 ? 0 : index + step))]
    if (next._id !== selected) open(next._id)
    const row = document.getElementById(`queue-${next._id}`)
    row?.focus({ preventScroll: true }); row?.scrollIntoView({ block: 'nearest' })
  }
  const selectedInView = applications.some(application => application._id === selected)

  const byStatus = stats.byStatus || {}
  const counts = { queue: stats.myQueue || 0, active: stats.inProgress || 0, history: stats.completed || 0, all: stats.total || 0 }
  const from = pagination.total ? (page - 1) * limit + 1 : 0
  const refresh = () => setRevision(value => value + 1)
  const oldestFirst = view === 'queue' || view === 'active'
  const oldest = oldestFirst && page === 1 && applications[0] ? age(applications[0]) : null

  return <div className="console" data-open={selected ? 'true' : 'false'}>
    <section className="console-queue" aria-labelledby="queue-title" onKeyDown={queueKeys}>
      <div className="flex items-start justify-between gap-3 px-4 pt-5 pb-3">
        <div><h1 id="queue-title" className="text-base font-semibold text-ink">Attestation requests</h1><p className="mt-0.5 text-xs text-ink-faint">{oldestFirst ? 'Oldest submissions first' : 'Most recently updated first'}{oldest && oldest.days > 0 && <> · oldest waiting <span className="font-mono">{oldest.label}</span></>}</p></div>
        <button disabled={loading} onClick={refresh} aria-label="Refresh queue" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-white hover:text-ink"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <div className="console-tabs" role="group" aria-label="Application views">
        {Object.entries(views).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => change({ view: key, status: '', page: '' })}>{label}<span>{loaded ? counts[key] : '–'}</span></button>)}
      </div>
      <div className="flex gap-2 px-4 py-3 border-b border-rule">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Search applications</span><Search className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-ink-faint" /><input type="search" className="console-input w-full !pl-8" placeholder="Name, application no., CNIC…" value={search} maxLength={100} onChange={event => change({ search: event.target.value, page: '' })} /></label>
        <label><span className="sr-only">Filter by status</span><select className="console-input max-w-[9.5rem]" value={status} onChange={event => change({ status: event.target.value, page: '' })}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
      </div>
      {(search || status) && <div className="flex justify-between px-4 py-2 text-xs text-ink-faint border-b border-rule"><span>{loaded ? `${pagination.total} matching` : 'Searching…'}</span><button className="text-link" onClick={() => change({ search: '', status: '', page: '' })}>Clear filters</button></div>}
      {error && <div role="alert" className="m-4 border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={refresh}>Retry</button></div>}
      <ul aria-busy={loading} aria-label={`${views[view]} applications`} className={`flex-1 ${loading ? 'opacity-60' : ''}`}>
        {applications.map(application => {
          const waiting = age(application)
          return <li key={application._id}><button id={`queue-${application._id}`} className="queue-row w-full" aria-current={selected === application._id ? 'true' : undefined} onClick={() => open(application._id)}>
            <span className="queue-name">{application.student?.fullName || 'Student unavailable'}</span>
            <time className="queue-age" dateTime={application.submittedAt || application.createdAt} title={formatDate(application.submittedAt || application.createdAt)} data-late={activeStatuses.includes(application.status) && waiting.days >= (application.processing === 'urgent' ? 2 : 5) ? 'true' : undefined}>{waiting.label}</time>
            <span className="queue-sub"><StatusBadge status={application.status} /><span aria-hidden="true">·</span><span className="font-mono shrink-0">{application.applicationNumber}</span><span aria-hidden="true">·</span><span className="truncate">{requestShort[application.requestType] || 'Degree'}{application.processing === 'urgent' ? ' · urgent' : ''}</span></span>
          </button></li>
        })}
      </ul>
      {!applications.length && !error && <div className="px-4 py-12 text-center"><p className="font-medium text-ink">{loading ? 'Loading requests…' : search || status ? 'No matching requests' : view === 'queue' ? 'Your queue is clear' : 'No records here yet'}</p><p className="mt-1 text-sm text-ink-faint">{!loading && (search || status ? 'Try another search or clear your filters.' : view === 'queue' ? 'Requests reaching your stage will appear here.' : 'Requests appear here as they move through the stages.')}</p></div>}
      <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-2 border-t border-rule bg-[#fbfaf7] px-4 py-2.5 text-xs text-ink-faint">
        <span role="status" className="font-mono">{loading ? 'Updating…' : `${from}–${Math.min(page * limit, pagination.total)} / ${pagination.total}`}</span>
        <span className="hidden lg:inline"><kbd>↑</kbd> <kbd>↓</kbd> to move</span>
        <div className="flex items-center gap-1">
          <label><span className="sr-only">Rows per page</span><select className="console-input !min-h-9 !py-1" value={limit} onChange={event => change({ limit: event.target.value, page: '' })}>{[10, 20, 50].map(value => <option key={value}>{value}</option>)}</select></label>
          <button disabled={loading || page <= 1} onClick={() => change({ page: page - 1 })} className="button-secondary !min-h-9 !px-2.5 !py-1 !text-xs">Prev</button>
          <button disabled={loading || page >= pagination.pages} onClick={() => change({ page: page + 1 })} className="button-secondary !min-h-9 !px-2.5 !py-1 !text-xs">Next</button>
        </div>
      </div>
    </section>

    <section ref={detail} tabIndex={-1} className="console-detail focus:outline-none" aria-label="Selected application">
      {selected ? <div className="px-4 py-5 sm:px-8 sm:py-7 max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3 text-sm">
          <button onClick={closeRecord} className="lg:hidden inline-flex min-h-11 items-center gap-2 text-ink-soft hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to queue</button>
          <Link to={`/admin/applications/${selected}`} state={{ returnTo: location.pathname + location.search }} className="ml-auto inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink">Open as page<ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
        {loaded && !loading && !selectedInView && <p role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-2 border-rule-strong bg-paper px-3 py-2 text-xs text-ink-soft">This application isn’t in the current list. Its status may have changed, or a filter is hiding it.<button onClick={() => change({ selected: '' })} className="text-link">Close record</button></p>}
        <ApplicationRecordView key={selected} id={selected} compact onChange={refresh} />
      </div> : <div className="flex h-full flex-col justify-center px-6 py-16 sm:px-12 max-w-3xl">
        <p className="page-kicker">{staffRoleLabels[user.role]} · {myStages.map(key => statusLabels[key]).join(', ') || 'View only'}</p>
        <h2 className="display mt-3 text-4xl leading-tight">{loaded ? counts.queue ? <>{counts.queue} request{counts.queue === 1 ? '' : 's'} waiting for you.</> : 'Nothing is waiting at your stage.' : 'Loading the register…'}</h2>
        <dl className="mt-10 grid grid-cols-2 sm:grid-cols-5 border-t border-ink">
          {[
            ['Scrutiny', byStatus.scrutiny, myStages.includes('scrutiny')],
            ['Records', byStatus.records_verification, myStages.includes('records_verification')],
            ['Registrar', (byStatus.registrar_approval || 0) + (byStatus.issuing || 0), myStages.includes('registrar_approval')],
            ['With applicant', byStatus.objection],
            ['Attested', byStatus.issued]
          ].map(([label, value, mine]) => <div key={label} className="border-b border-rule py-4 pr-4"><dt className={`text-xs ${mine ? 'font-semibold text-navy' : 'text-ink-faint'}`}>{label}{mine && <span className="sr-only"> (your stage)</span>}</dt><dd className="mt-1 font-mono text-2xl text-ink tabular-nums">{loaded ? value || 0 : '–'}</dd></div>)}
        </dl>
        <p className="mt-8 text-sm text-ink-soft">Choose a request from the queue. In the list, <kbd>↑</kbd> <kbd>↓</kbd> or <kbd>J</kbd> <kbd>K</kbd> move between records.</p>
      </div>}
    </section>
  </div>
}
