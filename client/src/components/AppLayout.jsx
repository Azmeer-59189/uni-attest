import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { GraduationCap, LayoutDashboard, FilePlus2, ShieldCheck, Users, Settings2, LogOut, Menu, X, ChevronRight, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'

export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const key = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [open])
  const workspace = user && (/^\/(student|admin)\//.test(location.pathname) || location.pathname === '/account')
  if (!workspace) return <div className="min-h-screen bg-off flex flex-col"><Navbar /><main id="main-content" className="w-full flex-1 max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 page-enter">{children}</main><footer className="max-w-7xl mx-auto border-t border-slate-200 px-6 py-6 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>UniAttest · Academic credentials, with confidence.</span><Link to="/verify" className="hover:text-navy">Verify a certificate</Link></footer></div>
  const admin = user.role !== 'student'
  const dashboard = admin ? '/admin/dashboard' : '/student/dashboard'
  const links = [
    { to: dashboard, label: 'Overview', icon: LayoutDashboard },
    ...(!admin ? [{ to: '/student/apply', label: 'My application', icon: FilePlus2 }] : []),
    ...(user.role === 'super_admin' ? [{ to: '/admin/manage-admins', label: 'Manage admins', icon: Users }] : []),
    { to: '/verify', label: 'Verify a degree', icon: ShieldCheck },
    { to: '/account', label: 'Account settings', icon: Settings2 }
  ]
  const applicationDetail = /^\/(admin|student)\/applications\//.test(location.pathname)
  const current = applicationDetail ? 'Application details' : links.find(link => link.to === location.pathname)?.label || 'Workspace'
  const initials = user.fullName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  const signOut = async () => { try { await logout() } catch (_) {} finally { navigate('/') } }
  return <div className="app-shell min-h-screen">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-white focus:p-3">Skip to content</a>
    {open && <button aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm lg:hidden" />}
    <aside id="workspace-navigation" aria-label="Workspace navigation" className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-[#dce3ec] bg-white px-5 py-7 transition-transform duration-200 ${admin ? 'lg:hidden' : 'lg:translate-x-0 lg:visible'} ${open ? 'visible translate-x-0' : 'invisible -translate-x-full'}`}>
      <div className="flex items-center justify-between"><Link to="/" className="flex items-center gap-3 px-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white"><GraduationCap className="h-6 w-6" /></span><span><span className="block text-lg font-semibold tracking-tight text-navy">UniAttest<span className="text-blue-800">.</span></span><span className="text-[9px] tracking-[0.22em] text-slate-500 uppercase">Credential workspace</span></span></Link><button className="lg:hidden text-slate-500" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div>
      <div className="mt-10 px-3 mb-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">{admin ? 'Administration' : 'Student portal'}</div>
      <nav className="space-y-1.5">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive || (applicationDetail && to === dashboard) ? 'sidebar-link-active' : ''}`}><Icon className="h-[18px] w-[18px]" />{label}</NavLink>)}</nav>
      <div className="mt-auto pt-8"><div className="rounded-2xl border border-blue-100 bg-[#edf3fb] p-4"><ShieldCheck className="h-5 w-5 text-blue-800 mb-3" /><p className="text-xs font-medium text-navy">Your credentials. Your future.</p><p className="mt-2 text-[11px] leading-relaxed text-slate-500">A clear path from application to a verifiable certificate.</p></div><button onClick={signOut} className="sidebar-link mt-5 w-full"><LogOut className="h-[18px] w-[18px]" />Logout</button></div>
    </aside>
    <div className={admin ? "staff-shell" : "lg:pl-64"}>
      {admin && <div className="staff-navigation hidden lg:flex"><Link to="/" className="flex items-center gap-3 text-lg font-semibold text-navy"><GraduationCap className="h-6 w-6" />UniAttest<span className="staff-nav-caption">University administration</span></Link><nav aria-label="Staff navigation" className="flex items-center gap-6">{links.map(({ to, label }) => <NavLink key={to} to={to} className={({ isActive }) => `staff-nav-link ${isActive || (applicationDetail && to === dashboard) ? 'staff-nav-current' : ''}`}>{label === 'Overview' ? 'Application inbox' : label}</NavLink>)}<button onClick={signOut} className="staff-nav-link">Logout</button></nav></div>}
      <header className="flex min-h-20 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3"><button aria-label="Open navigation" aria-expanded={open} aria-controls="workspace-navigation" onClick={() => setOpen(true)} className="rounded-lg border p-2 text-slate-500 lg:hidden"><Menu className="h-5 w-5" /></button><div className="flex items-center gap-2 text-xs text-slate-500"><Link to={dashboard} className="hidden sm:inline hover:text-navy">{admin ? 'Admin workspace' : 'Student workspace'}</Link><ChevronRight className="hidden sm:block h-3 w-3" /><span className="font-medium text-navy">{current}</span></div></div>
        <Link to="/account" className="flex min-w-0 items-center gap-3"><div className="hidden sm:block text-right"><p className="max-w-40 truncate text-xs font-semibold text-navy">{user.fullName}</p><p className="text-[10px] text-slate-500 mt-1 capitalize">{user.role.replace('_', ' ')}</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf3fb] text-xs font-bold text-[#203c63]">{initials}</span></Link>
      </header>
      <main id="main-content" className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8 sm:py-10 lg:px-10 page-enter">{children}</main>
      <footer className="mx-4 sm:mx-8 lg:mx-10 border-t border-slate-200 py-5 text-[10px] text-slate-500 flex justify-between gap-3"><span>UniAttest · Degree attestation portal</span><Link to="/verify" className="inline-flex items-center gap-1 hover:text-navy">Public verification<ArrowUpRight className="h-3 w-3" /></Link></footer>
    </div>
  </div>
}
