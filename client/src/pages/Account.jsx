import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Account() {
  const { changePassword } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async event => {
    event.preventDefault()
    if (password !== confirmation) { setError('New passwords do not match.'); return }
    setSaving(true); setError('')
    try { await changePassword(current, password); navigate('/login', { state: { message: 'Password changed. Please sign in again.' } }) }
    catch (err) { setError(err.response?.data?.error || 'Password change failed.') }
    finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="max-w-lg mx-auto panel p-6 sm:p-9 space-y-5">
    <h1 className="text-xl font-semibold text-navy">Change password</h1>
    <p className="text-sm text-gray-600">Changing your password signs out all sessions.</p>
    <label className="block">Current password<input className="block border border-slate-200 rounded-xl mt-2 px-3 py-3 text-sm w-full" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label>
    <label className="block">New password<input className="block border border-slate-200 rounded-xl mt-2 px-3 py-3 text-sm w-full" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /></label>
    <label className="block">Confirm new password<input className="block border border-slate-200 rounded-xl mt-2 px-3 py-3 text-sm w-full" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <button disabled={saving} className="button-primary">{saving ? 'Saving…' : 'Change password'}</button>
  </form>
}
