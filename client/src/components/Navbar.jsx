import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GraduationCap, LogOut, User, LayoutDashboard, FileCheck } from 'lucide-react'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-navy border-b border-navy-mid">
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-9 h-9 border border-gold rounded-lg flex items-center justify-center">
              <span className="text-gold font-serif text-lg font-semibold">U</span>
            </div>
            <div>
              <span className="text-white font-medium text-sm">UniAttest</span>
              <span className="block text-xs text-white/40 tracking-wider">DEGREE ATTESTATION</span>
            </div>
          </Link>

          <div className="flex items-center space-x-6">
            <Link to="/verify" className="flex items-center space-x-2 text-white/60 hover:text-gold transition-colors text-sm">
              <FileCheck className="h-4 w-4" />
              <span>Verify</span>
            </Link>

            {user ? (
              <>
                {user.role === 'student' && (
                  <Link to="/student/dashboard" className="flex items-center space-x-2 text-white/60 hover:text-gold transition-colors text-sm">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                )}
                {user.role === 'admin' && (
                  <Link to="/admin/dashboard" className="flex items-center space-x-2 text-white/60 hover:text-gold transition-colors text-sm">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Admin</span>
                  </Link>
                )}
                <div className="flex items-center space-x-2 text-white/60">
                  <User className="h-4 w-4" />
                  <span className="text-sm">{user.fullName}</span>
                </div>
                <button onClick={handleLogout} className="flex items-center space-x-2 text-white/60 hover:text-red-400 transition-colors text-sm">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="text-white/60 hover:text-white text-sm">Sign in</Link>
                <Link to="/register" className="bg-gold text-navy px-4 py-2 rounded-lg text-sm font-medium hover:bg-gold-light transition-colors">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar