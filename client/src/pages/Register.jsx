import { apiError } from '../utils/apiError'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from 'lucide-react'
import { formatCnic } from '../utils/workflow'

const departments = [
  'Computer Science', 'Engineering', 'Business Administration',
  'Medicine', 'Law', 'Arts', 'Science'
]
const inputClass = 'w-full h-12 px-4 border border-rule-strong rounded-md focus:border-ink text-sm'

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    fatherName: '',
    cnic: '',
    studentId: '',
    department: '',
    phone: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const field = name => ({ id: `register-${name}`, value: formData[name], onChange: e => setFormData({ ...formData, [name]: name === 'cnic' ? formatCnic(e.target.value) : e.target.value }) })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await register(formData)
      navigate('/student/dashboard')
    } catch (err) {
      setError(apiError(err, 'Registration failed.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_28rem] gap-12 lg:gap-20 items-start py-2 sm:py-6">
      <div className="max-w-md">
        <p className="page-kicker">Student account</p>
        <h1 className="page-title mt-4">Create your account.</h1>
        <p className="mt-5 text-base leading-relaxed text-ink-soft">Use your name exactly as it appears on your degree, and the registration number the university gave you. You’ll use this account to request attestation, follow each stage of the review, and download your certificate.</p>
        <p className="mt-8 text-sm text-ink-faint">Staff accounts are created by the university’s registrar, not here.</p>
      </div>

      <div className="auth-card w-full">
        {error && <p role="alert" id="register-error" className="mb-5 border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5" aria-describedby={error ? 'register-error' : undefined}>
          <div>
            <label htmlFor="register-fullName" className="field-label mb-1.5">Full name <span className="font-normal text-ink-faint">(as on your degree)</span></label>
            <input type="text" required autoComplete="name" className={inputClass} {...field('fullName')} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="register-fatherName" className="field-label mb-1.5">Father’s name</label>
              <input type="text" required autoComplete="off" maxLength={100} className={inputClass} {...field('fatherName')} />
            </div>
            <div>
              <label htmlFor="register-cnic" className="field-label mb-1.5">CNIC</label>
              <input type="text" required inputMode="numeric" placeholder="00000-0000000-0" pattern="\d{5}-\d{7}-\d" title="00000-0000000-0" className={`${inputClass} font-mono`} {...field('cnic')} />
            </div>
          </div>

          <div>
            <label htmlFor="register-email" className="field-label mb-1.5">Email</label>
            <input type="email" required autoComplete="email" className={inputClass} {...field('email')} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="register-studentId" className="field-label mb-1.5">Registration no.</label>
              <input type="text" required autoComplete="off" spellCheck={false} className={`${inputClass} font-mono`} {...field('studentId')} />
            </div>
            <div>
              <label htmlFor="register-department" className="field-label mb-1.5">Department</label>
              <select required className={`${inputClass} bg-white`} {...field('department')}>
                <option value="">Select…</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="register-password" className="field-label mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                minLength={12} maxLength={72} aria-describedby="register-password-hint"
                className={`${inputClass} pr-12`} {...field('password')}
              />
              <button
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-ink-faint hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p id="register-password-hint" className="mt-1.5 text-xs text-ink-faint">At least 12 characters.</p>
          </div>

          <button type="submit" disabled={loading} className="button-primary w-full">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 pt-5 border-t border-rule text-sm text-ink-faint">
          Already have an account? <Link to="/login" className="text-link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
