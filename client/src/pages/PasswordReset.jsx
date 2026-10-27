import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const inputClass = 'w-full h-12 px-4 border border-rule-strong rounded-md focus:border-ink text-sm'

function ResetLayout({ kicker, title, intro, children }) {
  return <div className="grid lg:grid-cols-[minmax(0,1fr)_28rem] gap-12 lg:gap-20 items-start py-2 sm:py-6">
    <div className="max-w-md">
      <p className="page-kicker">{kicker}</p>
      <h1 className="page-title mt-4">{title}</h1>
      <p className="mt-5 text-base leading-relaxed text-ink-soft">{intro}</p>
    </div>
    <div className="auth-card w-full">
      {children}
      <div className="mt-6 pt-5 border-t border-rule flex flex-wrap items-center justify-between gap-3 text-sm text-ink-faint">
        <Link to="/login" className="text-link">Back to sign in</Link>
        <Link to="/" className="hover:text-ink">Home</Link>
      </div>
    </div>
  </div>
}

const ErrorNote = ({ children }) => children ? <p role="alert" className="mb-5 border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">{children}</p> : null

export function ForgotPassword() {
  const { api } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setLoading(true); setError('')
    try { const { data } = await api.post('/auth/forgot-password', { email }); setSent(data.message) }
    catch (err) { setError(err.response?.data?.error || 'Could not send a reset link. Try again shortly.') }
    finally { setLoading(false) }
  }
  return <ResetLayout kicker="Account recovery" title="Forgot your password?" intro="Enter the email you registered with. We’ll send a link to choose a new password.">
    {sent
      ? <p role="status" className="border-l-2 border-emerald-700 bg-emerald-50 p-3 text-sm text-emerald-900">{sent} Check your spam folder if it doesn’t arrive within a few minutes.</p>
      : <>
        <ErrorNote>{error}</ErrorNote>
        <form onSubmit={submit} className="space-y-5">
          <label className="field-label block">Email address<input type="email" autoComplete="username" required className={`${inputClass} mt-1.5 font-normal`} value={email} onChange={e => setEmail(e.target.value)} /></label>
          <button type="submit" disabled={loading} className="button-primary w-full">{loading ? 'Sending…' : 'Send reset link'}</button>
        </form>
      </>}
  </ResetLayout>
}

export function ResetPassword() {
  const { api } = useAuth()
  const navigate = useNavigate()
  // The token arrives in the URL fragment, which browsers never send to servers; drop it from the address bar once read.
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '')
  useEffect(() => { if (token) window.history.replaceState(window.history.state, '', window.location.pathname) }, [token])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault()
    if (password !== confirmation) { setError('The passwords do not match.'); return }
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/reset-password', { token, newPassword: password })
      navigate('/login', { replace: true, state: { message: data.message } })
    } catch (err) { setError(err.response?.data?.error || 'Password reset failed.') }
    finally { setLoading(false) }
  }
  return <ResetLayout kicker="Account recovery" title="Choose a new password." intro="Resetting your password signs you out everywhere. Afterwards, sign in with the new one.">
    {!token
      ? <p role="alert" className="border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">This reset link is incomplete. Open the link from your email again, or <Link to="/forgot-password" className="text-link">request a new one</Link>.</p>
      : <>
        <ErrorNote>{error}</ErrorNote>
        <form onSubmit={submit} className="space-y-5">
          <label className="field-label block">New password<input aria-describedby="reset-password-hint" className={`${inputClass} mt-1.5 font-normal`} type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} /><span id="reset-password-hint" className="mt-1.5 block text-xs font-normal text-ink-faint">At least 12 characters.</span></label>
          <label className="field-label block">Confirm new password<input className={`${inputClass} mt-1.5 font-normal`} type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
          <button type="submit" disabled={loading} className="button-primary w-full">{loading ? 'Saving…' : 'Reset password'}</button>
        </form>
        {error && /expired|invalid/i.test(error) && <p className="mt-4 text-sm"><Link to="/forgot-password" className="text-link">Request a new reset link</Link></p>}
      </>}
  </ResetLayout>
}
