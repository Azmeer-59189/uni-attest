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
  return <form onSubmit={submit} className="max-w-lg space-y-5">
    <p className="page-kicker">Account</p><h1 className="page-title">Change your password.</h1>
    <p className="text-sm text-ink-soft">Changing your password signs out all sessions.</p>
    <label className="field-label">Current password<input className="block border border-rule-strong rounded-md mt-1.5 px-3 py-3 text-sm font-normal w-full" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label>
    <label className="field-label">New password<input aria-describedby="account-password-hint" className="block border border-rule-strong rounded-md mt-1.5 px-3 py-3 text-sm font-normal w-full" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /><span id="account-password-hint" className="mt-1.5 block text-xs font-normal text-ink-faint">At least 12 characters, different from your current password.</span></label>
    <label className="field-label">Confirm new password<input className="block border border-rule-strong rounded-md mt-1.5 px-3 py-3 text-sm font-normal w-full" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
    {error && <p role="alert" className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button disabled={saving} className="button-primary">{saving ? 'Saving…' : 'Change password'}</button>
  </form>
}
