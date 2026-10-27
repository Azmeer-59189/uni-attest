import { PageHeader } from '../../components/UI'
import ConfirmationDialog from '../../components/ConfirmationDialog'
import { apiError } from '../../utils/apiError'
import { formatDate } from '../../components/ApplicationRecord'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Plus, Eye, EyeOff, RefreshCw } from 'lucide-react'

const emptyForm = { fullName: '', email: '', password: '', department: '' }
const inputClass = 'w-full h-11 px-3 border border-rule-strong rounded-md focus:border-ink text-sm font-normal'

const AdminManagement = () => {
  const { api, user } = useAuth()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  // Outcome messages stay until the next action, so nobody has to read them within a time limit.
  const [message, setMessage] = useState(null)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  const fetchAdmins = useCallback(async () => {
    setLoadError('')
    try {
      const res = await api.get('/admin/admins')
      setAdmins(res.data.admins)
    } catch (err) {
      setLoadError(apiError(err, 'Could not load admin accounts.'))
    } finally {
      setLoading(false)
    }
  }, [api])
  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  const closeForm = () => { setShowForm(false); setFormError(''); setShowPassword(false) }

  const handleCreateAdmin = async (e) => {
    e.preventDefault()
    setFormError('')
    if (form.password.length < 12) { setFormError('Password must be at least 12 characters.'); return }
    setActionLoading('create')
    try {
      await api.post('/admin/admins', form)
      await fetchAdmins()
      setMessage({ type: 'success', text: `Admin account created for ${form.fullName}.` })
      closeForm()
      setForm(emptyForm)
    } catch (err) {
      setFormError(apiError(err, 'Failed to create admin.'))
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
      setMessage({ type: 'success', text: `${confirmToggle.fullName} ${confirmToggle.isActive ? 'was deactivated' : 'was reactivated'}.` })
    } catch (err) {
      setMessage({ type: 'error', text: apiError(err, 'Action failed.') })
    } finally {
      setConfirmToggle(null)
      setActionLoading(null)
    }
  }

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  if (loading) return <p role="status" className="py-24 text-center text-ink-faint">Loading admin accounts…</p>

  return (
    <div className="max-w-4xl space-y-10">
      <PageHeader eyebrow="Staff access" title="Your administration team." description="The people who review applications and issue credentials. Student registration only ever creates student accounts; staff accounts are created here. Deactivated admins lose access immediately, and their review history is kept." actions={<button onClick={() => { setMessage(null); setShowForm(true) }} className="button-primary"><Plus className="h-4 w-4" />Add admin</button>} />

      <div aria-live="polite">{message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`flex flex-wrap items-center justify-between gap-3 border-l-2 p-3 text-sm ${message.type === 'error' ? 'border-red-700 bg-red-50 text-red-800' : 'border-emerald-700 bg-emerald-50 text-emerald-900'}`}>{message.text}<button onClick={() => setMessage(null)} className="text-xs underline">Dismiss</button></p>}</div>

      <section aria-labelledby="admins-title">
        <h2 id="admins-title" className="rule-heading"><span>Admin accounts</span>{!loadError && <span className="normal-case tracking-normal text-xs font-normal text-ink-faint">{admins.length} total</span>}</h2>
        {loadError ? <div role="alert" className="py-10"><p className="text-red-800">{loadError}</p><button onClick={() => { setLoading(true); fetchAdmins() }} className="button-secondary mt-4"><RefreshCw className="h-4 w-4" />Retry</button></div>
        : admins.length === 0 ? <p className="py-10 text-ink-soft">No admin accounts yet. Use “Add admin” to create the first one.</p>
        : <ul className="divide-y divide-rule">
          {admins.map(admin => (
            <li key={admin._id} className="grid gap-x-6 gap-y-2 py-5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-medium text-ink break-words">{admin.fullName}{admin._id === user?._id && <span className="ml-2 text-xs font-normal text-ink-faint">(you)</span>}</p>
                <p className="text-sm text-ink-soft break-words">{admin.email}{admin.department && <span className="text-ink-faint"> · {admin.department}</span>}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                <span className="status-pill"><span aria-hidden="true" className={`status-dot ${!admin.isActive ? 'bg-stone-400' : admin.role === 'super_admin' ? 'bg-navy' : 'bg-emerald-600'}`} />{!admin.isActive ? 'Deactivated' : admin.role === 'super_admin' ? 'Super admin' : 'Active'}</span>
                <span className="font-mono text-[11px] text-ink-faint">Added {formatDate(admin.createdAt)}</span>
              </div>
              <div className="sm:justify-self-end">
                {admin._id !== user?._id && admin.role !== 'super_admin' && (
                  <button
                    onClick={() => { setMessage(null); setConfirmToggle(admin) }}
                    disabled={actionLoading === admin._id}
                    aria-label={`${admin.isActive ? 'Deactivate' : 'Reactivate'} ${admin.fullName}`}
                    className={`button-secondary !min-h-10 !py-1.5 !text-xs ${admin.isActive ? '!text-red-800 hover:!border-red-800' : ''}`}>
                    {admin.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>}
      </section>

      {showForm && (
        <ConfirmationDialog title="Add an admin" busy={actionLoading === 'create'} onClose={closeForm} formId="create-admin-form" confirmLabel="Create admin account">
          <p>They’ll sign in with this email and the temporary password, and should change it after their first sign-in.</p>
          {formError && <p role="alert" className="mt-4 border-l-2 border-red-700 bg-red-50 p-3 text-red-800">{formError}</p>}
          <form id="create-admin-form" onSubmit={handleCreateAdmin} className="mt-5 space-y-4">
            <label className="field-label">Full name<input type="text" required autoComplete="off" placeholder="e.g. Dr. Imran Khan" className={`${inputClass} mt-1.5`} value={form.fullName} onChange={update('fullName')} /></label>
            <label className="field-label">University email<input type="email" required autoComplete="off" placeholder="e.g. i.khan@university.edu.pk" className={`${inputClass} mt-1.5`} value={form.email} onChange={update('email')} /></label>
            <label className="field-label">Department <span className="font-normal text-ink-faint">(optional)</span><input type="text" placeholder="e.g. Registrar’s Office" className={`${inputClass} mt-1.5`} value={form.department} onChange={update('department')} /></label>
            <div>
              <label htmlFor="admin-password" className="field-label">Temporary password</label>
              <div className="relative mt-1.5">
                <input id="admin-password" type={showPassword ? 'text' : 'password'} required minLength={12} maxLength={72} autoComplete="new-password" aria-describedby="admin-password-hint"
                  className={`${inputClass} pr-12`} value={form.password} onChange={update('password')} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center text-ink-faint hover:text-ink">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p id="admin-password-hint" className="mt-1.5 text-xs text-ink-faint">At least 12 characters. Share it with them privately.</p>
            </div>
          </form>
        </ConfirmationDialog>
      )}

      {confirmToggle && (
        <ConfirmationDialog title={confirmToggle.isActive ? 'Deactivate this admin?' : 'Reactivate this admin?'} busy={actionLoading === confirmToggle._id} danger={confirmToggle.isActive} onClose={() => setConfirmToggle(null)} onConfirm={handleToggle} confirmLabel={confirmToggle.isActive ? 'Deactivate' : 'Reactivate'}>
          <p className="break-words">{confirmToggle.isActive ? `${confirmToggle.fullName} will lose access to the admin portal immediately. Their past reviews stay on record.` : `${confirmToggle.fullName} will be able to sign in to the admin portal again.`}</p>
        </ConfirmationDialog>
      )}
    </div>
  )
}

export default AdminManagement
