import { Link } from 'react-router-dom'
import { GraduationCap, ArrowRight, ArrowUpRight, ShieldCheck, FileCheck2, ScanLine, Check, LockKeyhole, Building2, QrCode } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { user } = useAuth()
  const destination = user ? user.role === 'student' ? '/student/dashboard' : '/admin/dashboard' : '/register'
  return <div className="space-y-16 sm:space-y-24 pb-8">
    <section className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center pt-4 sm:pt-10">
      <div className="max-w-xl"><div className="inline-flex items-center gap-2 rounded-full border border-[#d5e1f0] bg-[#edf3fb] px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[#203c63] uppercase"><span className="h-1.5 w-1.5 bg-[#345f94] rounded-full" />A better way to attest</div>
        <h1 className="mt-6 text-4xl sm:text-5xl xl:text-6xl font-semibold leading-[1.08] text-navy">Your degree.<br />Your next step.<br /><span className="text-[#345f94]">Made simple.</span></h1>
        <p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-500 max-w-lg">From your first application to a shareable certificate. Manage your degree attestation in one clear, connected workspace.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link to={destination} className="button-primary">{user ? 'Open your workspace' : 'Start your application'}<ArrowRight className="h-4 w-4" /></Link><Link to="/verify" className="button-secondary"><ShieldCheck className="h-4 w-4" />Verify a degree</Link></div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 mt-7 text-xs text-slate-500"><span className="inline-flex gap-1.5 items-center"><Check className="h-3.5 w-3.5 text-emerald-600" />Track every step</span><span className="inline-flex gap-1.5 items-center"><Check className="h-3.5 w-3.5 text-emerald-600" />Share with confidence</span></div>
      </div>
      <div className="relative rounded-[2rem] bg-[#edf3fb] p-7 sm:p-12 overflow-hidden">
        <div aria-hidden="true" className="absolute -top-24 -right-24 h-80 w-80 rounded-full border border-white/10" /><div aria-hidden="true" className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full border border-gold/20" />
        <div className="relative bg-[#f8f9fb] rounded-xl p-6 sm:p-8 shadow-sm border border-[#d5e1f0]">
          <div className="border border-[#d5e1f0] p-5 sm:p-7 text-center"><GraduationCap className="h-9 w-9 text-[#345f94] mx-auto" /><p className="mt-3 text-[9px] uppercase tracking-[0.28em] text-slate-500">Academic achievement</p><p className="mt-6 text-[10px] tracking-[0.2em] uppercase text-[#345f94]">Certificate of attestation</p><p className="font-serif text-3xl text-navy mt-4">Your next chapter.</p><p className="mt-4 text-xs text-slate-500 leading-relaxed">A record of the work you put in.<br />A credential you can carry forward.</p><div className="h-px bg-[#d5e1f0] my-7" /><div className="flex justify-between items-center"><div className="text-left"><p className="font-serif italic text-lg text-slate-500">UniAttest</p><p className="mt-1 text-[8px] uppercase tracking-wider text-slate-500">Sample certificate</p></div><QrCode className="h-9 w-9 text-navy/70" aria-hidden="true" /></div></div>
        </div>
        <div className="relative mt-7 flex items-center gap-3 text-navy"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-800"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm font-medium">Credentials with a clear record</p><p className="text-[11px] text-slate-500 mt-1">University review. Public verification.</p></div></div>
      </div>
    </section>
    <section><div className="mb-7 flex flex-wrap justify-between items-end gap-4"><div><p className="page-kicker mb-2">Built around you</p><h2 className="font-serif text-3xl">One portal. Every perspective.</h2></div><p className="text-sm text-slate-500 max-w-sm">A dedicated place for each part of the attestation journey.</p></div>
      <div className="grid md:grid-cols-3 gap-5">{[
        { icon: GraduationCap, title: 'For students', copy: 'Save your application, upload documents, and follow your progress from draft to certificate.', label: 'Student portal', to: user?.role === 'student' ? '/student/dashboard' : '/register' },
        { icon: Building2, title: 'For universities', copy: 'Keep applications organized, review supporting documents, and issue approved credentials.', label: 'Admin sign in', to: user && user.role !== 'student' ? '/admin/dashboard' : '/login?role=admin' },
        { icon: ScanLine, title: 'For verifiers', copy: 'Check issued details and available blockchain proof using a certificate hash or QR link.', label: 'Verify a degree', to: '/verify' }
      ].map(({ icon: Icon, title, copy, label, to }) => <Link key={title} to={to} className="panel group p-6 sm:p-7 hover:border-slate-400 transition-colors"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-navy border border-slate-100"><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-navy" /></div><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-slate-500">{copy}</p><p className="mt-6 text-xs font-semibold text-navy inline-flex items-center gap-2">{label}<ArrowRight className="h-3.5 w-3.5" /></p></Link>)}</div>
    </section>
    <section className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-10"><div className="text-center"><p className="page-kicker mb-3">The attestation journey</p><h2 className="font-serif text-3xl">Four steps. One clear path.</h2></div><div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-7">{[
      ['01', 'Prepare', 'Save your details and add supporting documents.'], ['02', 'Submit', 'Check your application and send it for review.'], ['03', 'Attest', 'University staff review and issue approved degrees.'], ['04', 'Share', 'Download your certificate and share its verification link.']
    ].map(([number, title, description]) => <div key={number}><span className="text-[11px] font-semibold text-[#345f94] border border-[#e9dfc5] rounded-lg h-8 w-9 inline-flex items-center justify-center bg-[#edf3fb]">{number}</span><h3 className="text-sm font-semibold mt-4">{title}</h3><p className="text-xs leading-relaxed text-slate-500 mt-2">{description}</p></div>)}</div></section>
  </div>
}
