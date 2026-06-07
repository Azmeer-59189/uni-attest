import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import {
  FileText, Clock, CheckCircle, Award, XCircle,
  Eye, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  Search, RefreshCw, AlertCircle, Users
} from 'lucide-react'

const STATUS_CONFIG = {
  pending:      { label: 'Pending',      cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  under_review: { label: 'Under Review', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved:     { label: 'Approved',     cls: 'bg-green-50 text-green-700 border-green-200' },
  issued:       { label: 'Issued',       cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  rejected:     { label: 'Rejected',     cls: 'bg-red-50 text-red-700 border-red-200' },
}

const AdminDashboard = () => {
  const [stats, setStats] = useState({ total: 0, pending: 0, underReview: 0, approved: 0, issued: 0, rejected: 0 })
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [modal, setModal] = useState(null) // { type: 'reject'|'approve'|'issue', appId }
  const [comment, setComment] = useState('')
  const [toast, setToast] = useState(null)
  const { user, api } = useAuth()

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const [dashRes, appsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/applications')
      ])
      setStats(dashRes.data.stats)
      setApplications(appsRes.data.applications)
    } catch (error) {
      console.error('Failed to fetch:', error)
      showToast('Failed to load data. Is the server running?', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleStartReview = async (appId) => {
    setActionLoading(appId + '_review')
    try {
      await api.patch(`/admin/applications/${appId}/review`)
      await fetchDashboard()
      showToast('Application moved to Under Review.')
    } catch (err) {
      showToast(err.response?.data?.error || 'Action failed.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApprove = async () => {
    if (!modal) return
    setActionLoading(modal.appId + '_approve')
    try {
      await api.patch(`/admin/applications/${modal.appId}/approve`, {
        comments: comment || 'Application approved.'
      })
      await fetchDashboard()
      showToast('Application approved successfully.')
      setModal(null)
      setComment('')
    } catch (err) {
      showToast(err.response?.data?.error || 'Action failed.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!modal || !comment.trim()) return
    setActionLoading(modal.appId + '_reject')
    try {
      await api.patch(`/admin/applications/${modal.appId}/reject`, {
        reason: comment
      })
      await fetchDashboard()
      showToast('Application rejected.')
      setModal(null)
      setComment('')
    } catch (err) {
      showToast(err.response?.data?.error || 'Action failed.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleIssueDegree = async (appId) => {
    setActionLoading(appId + '_issue')
    try {
      const res = await api.post(`/admin/applications/${appId}/issue`)
      await fetchDashboard()
      showToast('Degree issued and hash stored successfully!')
      setExpandedId(appId) // keep expanded so they can see the hash
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to issue degree.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredApps = applications.filter(app => {
    const matchesFilter = filter === 'all' || app.status === filter
    const matchesSearch = !search ||
      app.student?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      app.student?.studentId?.toLowerCase().includes(search.toLowerCase()) ||
      app.programName?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy"></div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-navy text-white border-l-4 border-gold'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-medium text-navy">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome, {user?.fullName}
            {user?.role === 'super_admin' && (
              <span className="ml-2 text-xs bg-gold/10 text-yellow-700 border border-gold/20 px-2 py-0.5 rounded-full">Super Admin</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'super_admin' && (
            <Link to="/admin/manage-admins"
              className="flex items-center gap-2 text-sm text-navy border border-navy/20 bg-navy/5 px-4 py-2 rounded-lg hover:bg-navy/10 transition-colors font-medium">
              <Users className="h-3.5 w-3.5" /> Manage Admins
            </Link>
          )}
          <button onClick={fetchDashboard} className="flex items-center gap-2 text-sm text-gray-500 hover:text-navy border border-gray-200 px-4 py-2 rounded-lg hover:border-navy transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total',       val: stats.total,      color: 'text-navy',        bg: 'bg-white' },
          { label: 'Pending',     val: stats.pending,    color: 'text-yellow-600',  bg: 'bg-white' },
          { label: 'In Review',   val: stats.underReview,color: 'text-blue-600',    bg: 'bg-white' },
          { label: 'Approved',    val: stats.approved,   color: 'text-green-600',   bg: 'bg-white' },
          { label: 'Issued',      val: stats.issued,     color: 'text-purple-600',  bg: 'bg-white' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-100 p-4`}>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-medium ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
          <input
            type="text" placeholder="Search by name, ID, or program…"
            className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-navy"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'under_review', 'approved', 'issued', 'rejected'].map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === f ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-navy hover:text-navy'
              }`}>
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Applications list */}
      <div className="space-y-3">
        {filteredApps.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No applications found.</p>
          </div>
        ) : filteredApps.map(app => {
          const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
          const isExpanded = expandedId === app._id

          return (
            <div key={app._id} className={`bg-white rounded-xl border transition-colors ${isExpanded ? 'border-navy' : 'border-gray-100'}`}>

              {/* Row */}
              <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : app._id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-medium text-navy text-sm">{app.student?.fullName || 'Unknown'}</p>
                    <span className="text-gray-300 text-xs">·</span>
                    <p className="text-gray-400 text-xs">{app.student?.studentId}</p>
                  </div>
                  <p className="text-gray-500 text-xs">{app.programName} — {app.department} · {app.graduationYear}</p>
                  <p className="text-gray-300 text-xs mt-0.5">Submitted {new Date(app.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-5 space-y-4">

                  {/* Details grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['Full Name', app.student?.fullName],
                      ['Student ID', app.student?.studentId],
                      ['Email', app.student?.email],
                      ['Program', app.programName],
                      ['Department', app.department],
                      ['Graduation Year', app.graduationYear],
                      ['CGPA', app.cgpa || '—'],
                      ['Documents', app.documents?.length ? `${app.documents.length} uploaded` : 'None'],
                      ['Applied', new Date(app.createdAt).toLocaleDateString()],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-sm font-medium text-navy truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Admin comments / rejection reason */}
                  {app.adminComments && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-600 mb-1">Admin Comment</p>
                      <p className="text-sm text-blue-800">{app.adminComments}</p>
                    </div>
                  )}
                  {app.rejectionReason && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <p className="text-xs font-medium text-red-600 mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-800">{app.rejectionReason}</p>
                    </div>
                  )}

                  {/* Issued degree hash + PDF */}
                  {app.status === 'issued' && app.degree && (
                    <div className="bg-navy rounded-xl p-4 flex items-center gap-4">
                      <Award className="h-6 w-6 text-gold flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium mb-0.5">Degree issued</p>
                        <p className="text-gray-400 text-xs font-mono truncate">
                          {app.degree?.hash || 'Hash not available'}
                        </p>
                        {app.degree?.blockchainTx && (
                          <p className="text-gray-500 text-xs font-mono truncate mt-0.5">
                            TX: {app.degree.blockchainTx}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => { navigator.clipboard.writeText(app.degree.hash); showToast('Hash copied!') }}
                          className="text-xs bg-white/10 hover:bg-white/20 text-gold px-3 py-1.5 rounded-lg transition-colors">
                          Copy hash
                        </button>
                        {app.degree?.pdfUrl && (
                          <a href={`http://localhost:5000${app.degree.pdfUrl}`} target="_blank" rel="noreferrer"
                            className="text-xs bg-white/10 hover:bg-white/20 text-gold px-3 py-1.5 rounded-lg transition-colors text-center">
                            ↓ Certificate PDF
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    {app.status === 'pending' && (
                      <button
                        onClick={() => handleStartReview(app._id)}
                        disabled={actionLoading === app._id + '_review'}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <Eye className="h-4 w-4" />
                        {actionLoading === app._id + '_review' ? 'Processing…' : 'Start Review'}
                      </button>
                    )}

                    {app.status === 'under_review' && (
                      <>
                        <button
                          onClick={() => { setModal({ type: 'approve', appId: app._id }); setComment('') }}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <ThumbsUp className="h-4 w-4" /> Approve
                        </button>
                        <button
                          onClick={() => { setModal({ type: 'reject', appId: app._id }); setComment('') }}
                          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <ThumbsDown className="h-4 w-4" /> Reject
                        </button>
                      </>
                    )}

                    {app.status === 'approved' && (
                      <button
                        onClick={() => handleIssueDegree(app._id)}
                        disabled={actionLoading === app._id + '_issue'}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <Award className="h-4 w-4" />
                        {actionLoading === app._id + '_issue' ? 'Issuing…' : 'Issue Degree & Store on Blockchain'}
                      </button>
                    )}

                    {(app.status === 'issued' || app.status === 'rejected') && (
                      <span className="text-xs text-gray-400 py-2">
                        {app.status === 'issued' ? '✓ Degree has been issued.' : '✗ Application was rejected.'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Approve Modal */}
      {modal?.type === 'approve' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-navy text-lg">Approve Application</h3>
                <p className="text-gray-400 text-xs">This will move the application to approved status.</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Comment (optional)</label>
              <textarea
                rows={3} placeholder="Add a note for the student…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy resize-none"
                value={comment} onChange={e => setComment(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 h-10 border border-gray-200 rounded-lg text-sm text-gray-500 hover:border-navy transition-colors">Cancel</button>
              <button onClick={handleApprove} disabled={actionLoading} className="flex-1 h-10 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
                {actionLoading ? 'Approving…' : 'Confirm Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {modal?.type === 'reject' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-navy text-lg">Reject Application</h3>
                <p className="text-gray-400 text-xs">The student will see this reason and can reapply.</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Reason for rejection <span className="text-red-400">*</span></label>
              <textarea
                rows={3} placeholder="e.g. Transcript scan is illegible. Please resubmit a clear copy."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy resize-none"
                value={comment} onChange={e => setComment(e.target.value)}
              />
              {!comment.trim() && <p className="text-xs text-red-400 mt-1">A reason is required.</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 h-10 border border-gray-200 rounded-lg text-sm text-gray-500 hover:border-navy transition-colors">Cancel</button>
              <button onClick={handleReject} disabled={actionLoading || !comment.trim()} className="flex-1 h-10 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50">
                {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default AdminDashboard