import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, GraduationCap, Settings } from 'lucide-react'

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
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
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">

        {/* Portal indicator */}
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium mb-6 ${
          isAdminLogin
            ? 'bg-navy/5 text-navy border border-navy/10'
            : 'bg-gold/10 text-yellow-700 border border-gold/20'
        }`}>
          {isAdminLogin
            ? <><Settings className="h-3.5 w-3.5" /> Admin Portal</>
            : <><GraduationCap className="h-3.5 w-3.5" /> Student Portal</>
          }
        </div>

        <div className="w-8 h-1 bg-gold rounded mb-5"></div>
        <h1 className="text-3xl font-serif font-medium text-navy mb-2">Welcome back</h1>
        <p className="text-gray-400 text-sm mb-8">
          {isAdminLogin
            ? 'Sign in with your administrator credentials.'
            : 'Sign in to your student portal to track your application.'
          }
        </p>

        {/* Admin hint */}
        {isAdminLogin && (
          <div className="bg-navy/3 border border-navy/10 rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-medium text-navy">Default admin credentials:</span><br />
              Email: <span className="font-mono">admin@university.edu</span><br />
              Password: <span className="font-mono">admin123</span>
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">
              Email address
            </label>
            <input
              type="email" required
              placeholder={isAdminLogin ? 'admin@university.edu' : 'you@university.edu'}
              className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:border-navy focus:outline-none text-sm"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} required
                placeholder="Enter your password"
                className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:border-navy focus:outline-none pr-12 text-sm"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full h-11 bg-navy text-white rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50 text-sm font-medium mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between text-sm text-gray-400">
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