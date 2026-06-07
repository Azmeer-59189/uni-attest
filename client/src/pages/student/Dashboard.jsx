import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import { FileText, Clock, CheckCircle, XCircle, Award, Plus, Copy } from 'lucide-react'

const StudentDashboard = () => {
  const [applications, setApplications] = useState([])
  const [degrees, setDegrees] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const { user, api } = useAuth()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [appsRes, degreesRes] = await Promise.all([
        api.get('/student/applications'),
        api.get('/student/degrees')
      ])
      setApplications(appsRes.data.applications)
      setDegrees(degreesRes.data.degrees)
    } catch (error) {
      console.error('Failed to fetch:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':      return { label: 'Pending',      cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200' }
      case 'under_review': return { label: 'Under Review', cls: 'bg-blue-50 text-blue-700 border border-blue-200' }
      case 'approved':     return { label: 'Approved',     cls: 'bg-green-50 text-green-700 border border-green-200' }
      case 'issued':       return { label: 'Issued',       cls: 'bg-purple-50 text-purple-700 border border-purple-200' }
      case 'rejected':     return { label: 'Rejected',     cls: 'bg-red-50 text-red-700 border border-red-200' }
      default:             return { label: status,         cls: 'bg-gray-50 text-gray-700 border border-gray-200' }
    }
  }

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash)
    setCopied(hash)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-medium text-navy">
            Welcome, {user?.fullName}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Student ID: {user?.studentId}</p>
        </div>
        <Link
          to="/student/apply"
          className="flex items-center gap-2 bg-navy text-white px-5 py-2.5 rounded-lg hover:bg-navy-light transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Application
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total</p>
          <p className="text-3xl font-medium text-navy">{applications.length}</p>
          <p className="text-xs text-gray-400 mt-1">Applications</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Active</p>
          <p className="text-3xl font-medium text-blue-600">
            {applications.filter(a => ['pending','under_review','approved'].includes(a.status)).length}
          </p>
          <p className="text-xs text-gray-400 mt-1">In progress</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Issued</p>
          <p className="text-3xl font-medium text-purple-600">{degrees.length}</p>
          <p className="text-xs text-gray-400 mt-1">Certificates</p>
        </div>
      </div>

      {/* Issued Degrees */}
      {degrees.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Your certificates
          </h2>
          <div className="space-y-3">
            {degrees.map(degree => (
              <div key={degree._id} className="bg-navy rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 border border-gold rounded-lg flex items-center justify-center flex-shrink-0">
                  <Award className="h-5 w-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">
                    {degree.application?.programName}
                  </p>
                  <p className="text-gray-400 text-xs mt-0.5 font-mono truncate">
                    {degree.hash}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  <button
                    onClick={() => copyHash(degree.hash)}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-gold text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === degree.hash ? 'Copied!' : 'Copy hash'}
                  </button>
                  <Link
                    to={`/verify/${degree.hash}`}
                    className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-gold text-xs px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Verify
                  </Link>
                  {degree.pdfUrl && (
                    <a
                      href={`http://localhost:5000${degree.pdfUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-gold text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ↓ Certificate
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Applications */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          My applications
        </h2>

        {applications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No applications yet.</p>
            <Link to="/student/apply" className="text-navy text-sm font-medium hover:underline mt-2 inline-block">
              Submit your first application →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map(app => {
              const { label, cls } = getStatusConfig(app.status)
              return (
                <div key={app._id} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-navy text-sm">{app.programName}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {app.department} · {app.graduationYear}
                      {app.cgpa ? ` · CGPA ${app.cgpa}` : ''}
                    </p>
                    <p className="text-gray-300 text-xs mt-1">
                      Submitted {new Date(app.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${cls}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

export default StudentDashboard