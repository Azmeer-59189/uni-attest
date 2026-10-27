import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { apiError } from '../../utils/apiError'
import { formatPKR, useConfig } from '../../utils/workflow'

const copies = ['Bank copy', 'University copy', 'Applicant copy']
const longDate = value => new Date(value).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })

// Amount in words, as banks expect on a deposit slip.
const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const words = n => {
  if (n < 20) return ones[n]
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? `-${ones[n % 10]}` : ''}`
  if (n < 1000) return `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ` ${words(n % 100)}` : ''}`
  if (n < 100000) return `${words(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${words(n % 1000)}` : ''}`
  return `${words(Math.floor(n / 100000))} lakh${n % 100000 ? ` ${words(n % 100000)}` : ''}`
}
const inWords = amount => `Rupees ${words(Math.round(amount))} only`.replace(/^Rupees (\w)/, (_, letter) => `Rupees ${letter.toUpperCase()}`)

export default function Challan() {
  const { id } = useParams()
  const { api, user } = useAuth()
  const { config, error: configError } = useConfig()
  const [application, setApplication] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.get(`/student/applications/${id}`).then(({ data }) => setApplication(data.application)).catch(err => setError(apiError(err, 'Could not load this challan.')))
  }, [api, id])

  if (error || configError) return <p role="alert" className="border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800">{error || configError}</p>
  if (!application || !config) return <p role="status" className="py-16 text-center text-ink-faint">Preparing your challan…</p>
  const issued = application.fee?.issuedAt || application.createdAt
  const due = new Date(new Date(issued).getTime() + config.bank.validDays * 86400000)
  const amount = application.fee?.amount || 0

  return <div className="space-y-8">
    <div className="no-print flex flex-wrap items-center justify-between gap-3">
      <Link to="/student/apply" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to your request</Link>
      <button onClick={() => window.print()} className="button-primary"><Printer className="h-4 w-4" />Print challan</button>
    </div>
    <p className="no-print max-w-2xl text-sm text-ink-soft">Print this page, pay at any {config.bank.name} branch, and keep the stamped applicant copy. Upload a scan of it with your request.</p>
    <div className="challan">{copies.map(copy => <section key={copy} className="challan-copy" aria-label={copy}>
      <header className="text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{copy}</p>
        <p className="mt-2 font-serif text-lg leading-tight text-ink">{config.university}</p>
        <p className="text-[11px] text-ink-soft">Degree attestation fee</p>
      </header>
      <dl className="challan-fields">
        <div><dt>Challan no.</dt><dd className="font-mono">{application.fee?.challanNumber}</dd></div>
        <div><dt>Application no.</dt><dd className="font-mono">{application.applicationNumber}</dd></div>
        <div><dt>Bank</dt><dd>{config.bank.name}</dd></div>
        <div><dt>Account title</dt><dd>{config.bank.accountTitle}</dd></div>
        <div><dt>Account no.</dt><dd className="font-mono">{config.bank.accountNumber}</dd></div>
        <div><dt>Depositor</dt><dd>{user.fullName}</dd></div>
        <div><dt>CNIC</dt><dd className="font-mono">{application.cnic || '—'}</dd></div>
        <div><dt>Purpose</dt><dd>{config.requestTypes[application.requestType]?.label} ({config.processing[application.processing]?.label.toLowerCase()})</dd></div>
        <div><dt>Issued</dt><dd>{longDate(issued)}</dd></div>
        <div><dt>Pay by</dt><dd>{longDate(due)}</dd></div>
      </dl>
      <div className="challan-amount"><span>Amount</span><strong className="font-mono">{formatPKR(amount)}</strong></div>
      <p className="mt-1 text-[11px] italic text-ink-soft">{inWords(amount)}</p>
      <div className="mt-auto grid grid-cols-2 gap-4 pt-10 text-center text-[10px] text-ink-faint"><p className="border-t border-ink-faint pt-1">Depositor’s signature</p><p className="border-t border-ink-faint pt-1">Bank officer &amp; stamp</p></div>
    </section>)}</div>
  </div>
}
