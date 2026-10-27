import { useState } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from 'lucide-react'

// Return to the page that asked for sign-in, but only if it belongs to the signed-in role's area.
function destinationFor(user, from) {
  const home = user.role === 'student' ? '/student/dashboard' : '/admin/dashboard'
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return home
  if (from.startsWith('/admin') && user.role === 'student') return home
  if (from.startsWith('/student') && user.role !== 'student') return home
  return from
}

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isAdminLogin = searchParams.get('role') === 'admin'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(formData.email, formData.password)
      navigate(destinationFor(user, location.state?.from), { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Sign-in failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_28rem] gap-12 lg:gap-20 items-start py-2 sm:py-6">
      <div className="max-w-md">
        <p className="page-kicker">{isAdminLogin ? 'Staff sign in' : 'Student sign in'}</p>
        <h1 className="page-title mt-4">Welcome back.</h1>
        <p className="mt-5 text-base leading-relaxed text-ink-soft">{isAdminLogin ? 'Sign in with your university staff account to open the review queue.' : 'Sign in to continue your application, follow its review, and download your certificate.'}</p>
        <p className="mt-8 hidden lg:block text-sm text-ink-faint">{isAdminLogin ? <>Not staff? <Link to="/login" className="text-link">Student sign in</Link></> : <>University staff? <Link to="/login?role=admin" className="text-link">Staff sign in</Link></>}</p>
      </div>

      <div className="auth-card w-full">
        {location.state?.message && <p role="status" className="mb-5 border-l-2 border-emerald-700 bg-emerald-50 p-3 text-sm text-emerald-900">{location.state.message}</p>}
        {location.state?.from && !location.state?.message && <p className="mb-5 text-sm text-ink-soft">Sign in to continue to that page.</p>}
        {error && <p role="alert" id="login-error" className="mb-5 border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? 'login-error' : undefined}>
          <div>
            <label htmlFor="login-email" className="field-label mb-1.5">Email address</label>
            <input
              id="login-email" type="email" autoComplete="username" required
              placeholder={isAdminLogin ? 'name@university.edu' : 'you@university.edu'}
              aria-invalid={Boolean(error)}
              className="w-full h-12 px-4 border border-rule-strong rounded-md focus:border-ink text-sm"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="field-label mb-1.5">Password</label>
            <div className="relative">
              <input
                id="login-password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} required
                aria-invalid={Boolean(error)}
                className="w-full h-12 px-4 border border-rule-strong rounded-md focus:border-ink pr-12 text-sm"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-ink-faint hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="button-primary w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-rule flex flex-wrap items-center justify-between gap-3 text-sm text-ink-faint">
          {isAdminLogin
            ? <Link to="/login" className="hover:text-ink lg:hidden">Student sign in</Link>
            : <span>No account? <Link to="/register" className="text-link">Create one</Link></span>}
          <Link to="/" className="hover:text-ink">Home</Link>
        </div>
      </div>
    </div>
  )
}

export default Login
