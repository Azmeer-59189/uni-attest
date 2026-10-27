import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { homeFor } from '../utils/workflow'

export default function Home() {
  const { user } = useAuth()
  const destination = user ? homeFor(user) : '/register'
  return <div className="space-y-24 sm:space-y-32 pb-8">
    <section className="grid gap-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-end pt-2 sm:pt-8">
      <div>
        <p className="page-kicker">Degree attestation</p>
        <h1 className="display mt-6 text-5xl leading-[1.04] sm:text-6xl xl:text-7xl">A degree you can prove, <em className="italic text-navy">anywhere</em> it’s asked for.</h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-soft">Request attestation online, pay by bank challan, and follow your request through scrutiny, records verification, and registrar approval. Employers and institutions can then confirm your certificate for themselves.</p>
        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4"><Link to={destination} className="button-primary">{user ? 'Open your workspace' : 'Apply for attestation'}<ArrowRight className="h-4 w-4" /></Link><Link to="/verify" className="text-link text-sm">Verify a certificate</Link></div>
      </div>
      <figure aria-label="Sample certificate" className="certificate-sheet text-center">
        <p className="page-kicker">Degree attestation certificate</p>
        <p className="display mt-6 text-3xl">BS Computer Science</p>
        <p className="mt-1 font-serif italic text-ink-soft">verified from the record of the university</p>
        <div className="mx-auto my-7 h-px w-16 bg-rule-strong" />
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint">Attestation no.</p>
        <p className="mt-2 font-mono text-sm text-ink">ATT-2026-000128</p>
        <figcaption className="mt-6 text-xs text-ink-faint">Sample shown for illustration</figcaption>
      </figure>
    </section>

    <section aria-labelledby="how-title">
      <h2 id="how-title" className="rule-heading"><span>How it works</span></h2>
      <ol className="grid sm:grid-cols-2 lg:grid-cols-4">{[
        ['Apply and pay', 'Choose degree or transcript attestation, enter your particulars, print the fee challan, and pay at the bank.'],
        ['Upload and submit', 'Upload your degree, CNIC, photograph, and paid challan against a checklist, then submit with a declaration.'],
        ['Scrutiny and verification', 'The attestation cell checks your documents, the examination branch verifies the record, and the registrar approves. Any objection comes back to you to fix.'],
        ['Receive and share', 'Download the attestation certificate. Its number, QR code, and hash let anyone verify it.']
      ].map(([title, description], index) => <li key={title} className="border-b border-rule py-7 sm:pr-8 lg:border-b-0">
        <span className="font-mono text-xs text-ink-faint">0{index + 1}</span>
        <h3 className="display mt-2 text-2xl">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
      </li>)}</ol>
    </section>

    <section aria-labelledby="who-title">
      <h2 id="who-title" className="rule-heading"><span>Who it’s for</span></h2>
      <div className="divide-y divide-rule">{[
        { title: 'Graduates', copy: 'Request attestation, answer any objection online, and download your certificate without visiting the campus.', label: 'Open the student portal', to: user?.role === 'student' ? '/student/dashboard' : '/register' },
        { title: 'University staff', copy: 'Scrutiny officers, the examination branch, and the registrar each work their own queue, with every decision recorded.', label: 'Staff sign in', to: user && user.role !== 'student' ? '/admin/dashboard' : '/login?role=admin' },
        { title: 'Employers', copy: 'Confirm a certificate with its attestation number, hash, or QR code. No account needed.', label: 'Verify a certificate', to: '/verify' }
      ].map(({ title, copy, label, to }) => <Link key={title} to={to} className="group grid gap-2 py-8 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-8">
        <h3 className="display text-3xl group-hover:text-navy">{title}</h3>
        <p className="max-w-xl text-ink-soft">{copy}</p>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-navy">{label}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
      </Link>)}</div>
    </section>
  </div>
}
