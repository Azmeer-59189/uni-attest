import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from './Navbar'

export default function AppLayout({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  // The staff queue is a full-bleed console; everything else is a centred reading column.
  const fullBleed = user && user.role !== 'student' && pathname === '/admin/dashboard'
  return <div className="app-shell min-h-screen flex flex-col">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-white focus:p-3">Skip to content</a>
    <Navbar />
    <main id="main-content" className={fullBleed ? 'flex-1' : 'w-full flex-1 max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-16 page-enter'}>{children}</main>
    {!fullBleed && <footer className="w-full max-w-6xl mx-auto px-4 sm:px-8"><div className="border-t border-rule py-6 flex flex-wrap justify-between gap-2 text-xs text-ink-faint"><span><span className="font-serif text-sm text-ink-soft">UniAttest</span> · Academic credentials, reviewed by the university and verifiable by anyone.</span><Link to="/verify" className="hover:text-ink">Verify a certificate</Link></div></footer>}
  </div>
}
