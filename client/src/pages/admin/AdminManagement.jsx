import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  Users, Plus, Shield, ShieldOff,
  Eye, EyeOff, X, CheckCircle, AlertCircle
} from 'lucide-react'

const AdminManagement = () => {
  const { api, user } = useAuth()   // ✅ use api from AuthContext — sends token automatically
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', department: '' })
  const [formError, setFormError] = useState('')

  useEffect(() => { fetchAdmins() }, [])

  const fetchAdmins = async () => {
    try {
      const res = await api.get('/admin/admins')
      setAdmins(res.data.admins)
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load admins.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleCreateAdmin = async (e) => {
    e.preventDefault()
    setFormError('')
    if (form.password.length < 8) { setFormError('Password must be at least 8 characters.'); return }
    setActionLoading('create')
    try {
      await api.post('/admin/admins', form)
      await fetchAdmins()
      showToast(`Admin account created for ${form.fullName}.`)
      setShowForm(false)
      setForm({ fullName: '', email: '', password: '', department: '' })
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create admin.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggle = async () => {
    if (!confirmToggle) return
    setActionLoading(confirmToggle._id)
    try {
      await api.patch(`/admin/admins/${confirmToggle._id}/toggle`)
      await fetchAdmins()
      showToast(confirmToggle.isActive ? 'Admin deactivated.' : 'Admin reactivated.')
      setConfirmToggle(null)
    } catch (err) {
      showToast(err.response?.data?.error || 'Action failed.', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy"></div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-navy text-white border-l-4 border-gold'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-medium text-navy">Admin Management</h1>
          <p className="text-gray-400 text-sm mt-1">Only super admins can create or deactivate admin accounts.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-navy text-white px-5 py-2.5 rounded-lg hover:bg-navy-light transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" /> Add Admin
        </button>
      </div>

      {/* Info box */}
      <div className="bg-gold/5 border border-gold/20 rounded-xl p-4 flex gap-3">
        <Shield className="h-5 w-5 text-gold flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-navy mb-1">Role-based access control</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Student registration is public but always creates <strong>student accounts only</strong>.
            Admin accounts can only be created here by a super admin.
            Deactivated admins lose access immediately but their history is preserved.
          </p>
        </div>
      </div>

      {/* Admins list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Admin accounts ({admins.length})
          </h2>
        </div>

        {admins.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No admin accounts yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {admins.map(admin => (
              <div key={admin._id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                  admin.role === 'super_admin' ? 'bg-gold/20 text-yellow-700'
                  : admin.isActive ? 'bg-navy/10 text-navy'
                  : 'bg-gray-100 text-gray-400'
                }`}>
                  {admin.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-navy">{admin.fullName}</p>
                    {admin.role === 'super_admin' && (
                      <span className="text-xs bg-gold/10 text-yellow-700 border border-gold/20 px-2 py-0.5 rounded-full">Super Admin</span>
                    )}
                    {!admin.isActive && (
                      <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full">Deactivated</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{admin.email}</p>
                  {admin.department && <p className="text-xs text-gray-300 mt-0.5">{admin.department}</p>}
                </div>

                <p className="text-xs text-gray-300 flex-shrink-0 hidden md:block">
                  Added {new Date(admin.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>

                {/* Actions */}
                {admin._id !== user?._id && admin.role !== 'super_admin' && (
                  <button
                    onClick={() => setConfirmToggle(admin)}
                    disabled={actionLoading === admin._id}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                      admin.isActive
                        ? 'text-red-500 border-red-100 hover:bg-red-50'
                        : 'text-green-600 border-green-100 hover:bg-green-50'
                    }`}>
                    {admin.isActive ? <><ShieldOff className="h-3.5 w-3.5" /> Deactivate</> : <><Shield className="h-3.5 w-3.5" /> Reactivate</>}
                  </button>
                )}
                {admin._id === user?._id && (
                  <span className="text-xs text-gray-300 px-3">You</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create admin modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-serif font-medium text-navy text-lg">Create admin account</h3>
                <p className="text-gray-400 text-xs mt-0.5">The new admin will log in with these credentials.</p>
              </div>
              <button onClick={() => { setShowForm(false); setFormError('') }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 border border-red-100 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{formError}
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Full name <span className="text-gold">*</span></label>
                <input type="text" required placeholder="e.g. Dr. Imran Khan"
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                  value={form.fullName} onChange={update('fullName')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">University email <span className="text-gold">*</span></label>
                <input type="email" required placeholder="e.g. i.khan@university.edu.pk"
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                  value={form.email} onChange={update('email')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Department</label>
                <input type="text" placeholder="e.g. Registrar's Office"
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                  value={form.department} onChange={update('department')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Temporary password <span className="text-gold">*</span></label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required placeholder="Min. 8 characters"
                    className="w-full h-11 px-4 pr-11 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                    value={form.password} onChange={update('password')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Share this with the admin — they should change it after first login.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setFormError('') }}
                  className="flex-1 h-11 border border-gray-200 rounded-lg text-sm text-gray-500 hover:border-navy transition-colors">Cancel</button>
                <button type="submit" disabled={actionLoading === 'create'}
                  className="flex-1 h-11 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy-light transition-colors disabled:opacity-50">
                  {actionLoading === 'create' ? 'Creating…' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm toggle modal */}
      {confirmToggle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmToggle.isActive ? 'bg-red-50' : 'bg-green-50'}`}>
              {confirmToggle.isActive ? <ShieldOff className="h-6 w-6 text-red-500" /> : <Shield className="h-6 w-6 text-green-600" />}
            </div>
            <h3 className="font-serif font-medium text-navy text-center text-lg mb-2">
              {confirmToggle.isActive ? 'Deactivate account?' : 'Reactivate account?'}
            </h3>
            <p className="text-gray-400 text-sm text-center mb-6">
              {confirmToggle.isActive
                ? `${confirmToggle.fullName} will immediately lose access to the admin portal.`
                : `${confirmToggle.fullName} will regain access to the admin portal.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmToggle(null)}
                className="flex-1 h-10 border border-gray-200 rounded-lg text-sm text-gray-500 hover:border-navy transition-colors">Cancel</button>
              <button onClick={handleToggle} disabled={actionLoading === confirmToggle._id}
                className={`flex-1 h-10 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${
                  confirmToggle.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'
                }`}>
                {actionLoading === confirmToggle._id ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default AdminManagement