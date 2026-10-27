import { useState } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, GraduationCap, Settings } from 'lucide-react'

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
      if (user.role === 'admin' || user.role === 'super_admin') {
        navigate('/admin/dashboard')
      } else {
        navigate('/student/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-8 lg:gap-14 items-center py-4 sm:py-10">
      <aside className="hidden lg:block lg:col-span-2"><p className="page-kicker mb-5">Your credential workspace</p><h2 className="font-serif text-4xl leading-tight">A clear path to<br /><em className="text-[#345f94] font-normal">what comes next.</em></h2><p className="mt-6 text-sm text-slate-500 leading-relaxed">Manage your applications, follow every update, and keep your academic achievements within reach.</p><div className="mt-8 space-y-4">{['Save and resume your application', 'Follow your attestation progress', 'Download and share your certificate'].map((item, index) => <div key={item} className="flex gap-3 items-center text-xs text-slate-500"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] text-slate-500">0{index + 1}</span>{item}</div>)}</div></aside>
      <div className="auth-card lg:col-span-3 w-full max-w-lg mx-auto">

        {/* Portal indicator */}
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium mb-6 ${
          isAdminLogin
            ? 'bg-navy/5 text-navy border border-navy/10'
            : 'bg-blue-50 text-blue-900 border border-blue-200'
        }`}>
          {isAdminLogin
            ? <><Settings className="h-3.5 w-3.5" /> Admin Portal</>
            : <><GraduationCap className="h-3.5 w-3.5" /> Student Portal</>
          }
        </div>

        <div className="w-8 h-1 bg-gold rounded mb-5"></div>
        <h1 className="text-3xl font-serif font-medium text-navy mb-2">Welcome back</h1>
        <p className="text-gray-500 text-sm mb-8">
          {isAdminLogin
            ? 'Sign in with your administrator credentials.'
            : 'Sign in to your student portal to track your application.'
          }
        </p>

        {location.state?.message && <p role="status" className="text-green-700 text-sm mb-4">{location.state.message}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">
              Email address
            </label>
            <input
              id="login-email" type="email" autoComplete="username" required
              placeholder={isAdminLogin ? 'admin@university.edu' : 'you@university.edu'}
              className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:border-navy focus:outline-none text-sm"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} required
                placeholder="Enter your password"
                className="w-full h-12 px-4 border border-slate-200 rounded-xl focus:border-navy focus:outline-none pr-12 text-sm"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="button-primary w-full mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          {isAdminLogin ? (
            <Link to="/login" className="hover:text-navy transition-colors">← Student login</Link>
          ) : (
            <span>
              No account?{' '}
              <Link to="/register" className="text-navy font-medium hover:underline">Register</Link>
            </span>
          )}
          <Link to="/" className="hover:text-navy transition-colors">← Home</Link>
        </div>
      </div>
    </div>
  )
}

export default Login