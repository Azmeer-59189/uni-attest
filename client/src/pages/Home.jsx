import { Link, useNavigate } from 'react-router-dom'
import { Shield, Globe, QrCode, GraduationCap, Settings, ArrowRight, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const Home = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  // If already logged in, send them straight to their dashboard
  const handleStudentClick = () => {
    if (user?.role === 'student') navigate('/student/dashboard')
    else navigate('/register')
  }

  const handleAdminClick = () => {
    if (user?.role === 'admin' || user?.role === 'super_admin') navigate('/admin/dashboard')
    else navigate('/login?role=admin')
  }

  return (
    <div className="space-y-16">

      {/* Hero */}
      <section className="text-center py-16">
        <div className="inline-flex items-center gap-2 bg-gold/10 text-yellow-700 border border-gold/30 rounded-full px-4 py-1.5 text-xs font-medium mb-6">
          <Shield className="h-3.5 w-3.5" />
          Blockchain-powered degree verification
        </div>
        <h1 className="text-5xl font-serif font-medium text-navy mb-6 leading-tight">
          Your degree,{' '}
          <em className="text-gold italic">verified forever.</em>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
          Secure, immutable, and instantly verifiable academic credentials.
          Students apply, universities attest, employers verify — all on blockchain.
        </p>

        {/* Portal selector cards */}
        <div className="grid md:grid-cols-2 gap-5 max-w-2xl mx-auto mb-8">

          {/* Student portal */}
          <div
            onClick={handleStudentClick}
            className="group bg-navy text-left rounded-2xl p-7 cursor-pointer hover:bg-navy-light transition-all shadow-sm hover:shadow-md"
          >
            <div className="w-12 h-12 border border-gold/40 rounded-xl flex items-center justify-center mb-5">
              <GraduationCap className="h-6 w-6 text-gold" />
            </div>
            <h2 className="text-white font-serif text-xl font-medium mb-2">Student Portal</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">
              Register, submit your attestation request, upload documents, and download your blockchain-verified certificate.
            </p>
            <div className="flex items-center gap-2 text-gold text-sm font-medium group-hover:gap-3 transition-all">
              {user?.role === 'student' ? 'Go to dashboard' : 'Register or sign in'}
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Admin portal */}
          <div
            onClick={handleAdminClick}
            className="group bg-white text-left rounded-2xl p-7 cursor-pointer hover:border-navy border border-gray-100 transition-all shadow-sm hover:shadow-md"
          >
            <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center mb-5">
              <Settings className="h-6 w-6 text-navy" />
            </div>
            <h2 className="text-navy font-serif text-xl font-medium mb-2">Admin Portal</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">
              Review applications, approve or reject requests, issue blockchain-attested degrees, and manage the attestation pipeline.
            </p>
            <div className="flex items-center gap-2 text-navy text-sm font-medium group-hover:gap-3 transition-all">
              {(user?.role === 'admin' || user?.role === 'super_admin') ? 'Go to dashboard' : 'Admin sign in'}
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Verify link */}
        <p className="text-gray-400 text-sm">
          Have a degree hash?{' '}
          <Link to="/verify" className="text-navy font-medium hover:underline">
            Verify a degree →
          </Link>
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-serif font-medium text-navy text-center mb-10">How it works</h2>
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-100 md:left-1/2"></div>
          {[
            { step: '01', title: 'Student applies', desc: 'Submit your degree details and upload supporting documents through the student portal.', side: 'left' },
            { step: '02', title: 'University reviews', desc: 'The administration verifies your documents and approves or rejects the application.', side: 'right' },
            { step: '03', title: 'Degree is issued', desc: 'A SHA-256 hash of your degree data is generated and stored permanently on the blockchain.', side: 'left' },
            { step: '04', title: 'Share & verify', desc: 'You receive a hash and QR code. Anyone can verify your degree instantly — no login needed.', side: 'right' },
          ].map(({ step, title, desc, side }) => (
            <div key={step} className={`relative flex items-start gap-4 mb-8 md:w-1/2 ${side === 'right' ? 'md:ml-auto md:pl-10' : 'md:pr-10'} pl-14 md:pl-10`}>
              <div className="absolute left-0 md:left-auto md:-right-5 w-10 h-10 bg-navy rounded-full flex items-center justify-center text-gold text-xs font-medium z-10 flex-shrink-0">
                {step}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5 flex-1">
                <h3 className="font-medium text-navy mb-1 text-sm">{title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid md:grid-cols-3 gap-5 pb-8">
        {[
          { Icon: Shield, title: 'Tamper-Proof', desc: 'Every degree is hashed and stored on the blockchain — impossible to forge or alter.' },
          { Icon: Globe, title: 'Instant Verification', desc: 'Employers verify degrees instantly from anywhere using the unique hash or QR code.' },
          { Icon: QrCode, title: 'QR Code Ready', desc: 'Each degree comes with a QR code that links directly to the verification page.' },
        ].map(({ Icon, title, desc }) => (
          <div key={title} className="bg-white p-7 rounded-xl border border-gray-100">
            <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center mb-4">
              <Icon className="h-5 w-5 text-gold" />
            </div>
            <h3 className="text-base font-serif font-medium text-navy mb-2">{title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

    </div>
  )
}

export default Home