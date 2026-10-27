import { Link, NavLink, useNavigate } from 'react-router-dom'
import { GraduationCap, ArrowUpRight, ShieldCheck, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => { try { await logout() } catch (_) {} finally { navigate('/') } }
  const navClass = ({ isActive }) => `rounded-lg px-3 py-2 text-xs sm:text-sm font-medium ${isActive ? 'bg-slate-100 text-navy' : 'text-slate-500 hover:text-navy hover:bg-slate-50'}`
  return <nav aria-label="Main navigation" className="border-b border-slate-200/80 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
      <Link to="/" className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold"><GraduationCap className="h-6 w-6" /></span><span className="text-xl font-semibold tracking-tight text-navy">UniAttest<span className="text-[#345f94]">.</span></span></Link>
      <div className="flex items-center gap-1 sm:gap-3 flex-wrap"><NavLink to="/verify" className={navClass}><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Verify a degree</span></NavLink>
        {user ? <><NavLink to={user.role === 'student' ? '/student/dashboard' : '/admin/dashboard'} className={navClass}>Dashboard</NavLink><button onClick={signOut} className="p-2 text-slate-500 hover:text-navy" aria-label="Logout"><LogOut className="h-4 w-4" /><span className="sr-only">Logout</span></button></> : <><NavLink to="/login" className={navClass}>Sign in</NavLink><Link to="/register" className="inline-flex items-center gap-2 bg-navy text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-navy-light">Get started<ArrowUpRight className="h-3.5 w-3.5" /></Link></>}
      </div>
    </div>
  </nav>
}
