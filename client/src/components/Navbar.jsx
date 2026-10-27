import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { staffRoleLabels } from '../utils/workflow'

export function navigationFor(user) {
  if (!user) return [{ to: '/verify', label: 'Verify a degree' }]
  if (user.role === 'student') return [
    { to: '/student/dashboard', label: 'Overview', match: /^\/student\/(dashboard|applications\/)/ },
    { to: '/student/apply', label: 'Request' },
    { to: '/verify', label: 'Verify' },
    { to: '/account', label: 'Account' }
  ]
  return [
    { to: '/admin/dashboard', label: 'Queue', match: /^\/admin\/(dashboard|applications\/)/ },
    ...(user.role === 'super_admin' ? [{ to: '/admin/manage-admins', label: 'Staff' }] : []),
    { to: '/verify', label: 'Verify' },
    { to: '/account', label: 'Account' }
  ]
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const key = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [open])
  const signOut = async () => { try { await logout() } catch (_) {} finally { navigate('/') } }
  const links = navigationFor(user)
  const current = link => link.match ? link.match.test(pathname) : pathname === link.to || pathname.startsWith(`${link.to}/`)
  const staff = user && user.role !== 'student'
  const initials = user?.fullName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  return <header className="topbar">
    <div className={`mx-auto flex h-14 items-center justify-between gap-6 px-4 sm:px-8 ${staff ? '' : 'max-w-6xl'}`}>
      <Link to="/" className="flex items-baseline gap-3 shrink-0"><span className="font-serif text-[1.375rem] leading-none text-ink">UniAttest</span><span className="hidden sm:inline text-[11px] uppercase tracking-[0.16em] text-ink-faint">{staff ? staffRoleLabels[user.role] : user ? 'Student record' : 'Degree attestation'}</span></Link>
      <nav aria-label="Main navigation" className="hidden md:flex items-center gap-7 h-full">
        {links.map(link => <Link key={link.to} to={link.to} className="topbar-link h-full" aria-current={current(link) ? 'page' : undefined}>{link.label}</Link>)}
      </nav>
      <div className="hidden md:flex items-center gap-5 shrink-0">
        {user ? <>
          <Link to="/account" className="flex items-center gap-2.5 text-[13px] text-ink-soft hover:text-ink"><span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full border border-rule-strong text-[10px] font-semibold text-ink">{initials}</span><span className="max-w-40 truncate">{user.fullName}</span></Link>
          <button onClick={signOut} className="topbar-link">Sign out</button>
        </> : <>
          <Link to="/login" className="topbar-link" aria-current={pathname === '/login' ? 'page' : undefined}>Sign in</Link>
          <Link to="/register" className="button-primary !min-h-9 !px-4 !py-1.5 !text-[13px]">Apply for attestation</Link>
        </>}
      </div>
      <button className="md:hidden -mr-2 flex h-11 w-11 items-center justify-center text-ink" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(value => !value)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
    </div>
    {open && <nav id="mobile-menu" aria-label="Main navigation" className="topbar-menu md:hidden border-t border-rule px-4 pb-4">
      {links.map(link => <Link key={link.to} to={link.to} aria-current={current(link) ? 'page' : undefined}>{link.label}</Link>)}
      {user ? <button onClick={signOut}>Sign out <span className="ml-auto text-xs text-ink-faint">{user.fullName}</span></button> : <><Link to="/login">Sign in</Link><Link to="/register">Apply for attestation</Link></>}
    </nav>}
  </header>
}
