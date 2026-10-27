import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, Printer, Upload } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ConfirmationDialog from '../../components/ConfirmationDialog'
import { ReviewMark } from '../../components/ApplicationRecord'
import { apiError } from '../../utils/apiError'
import { EDITABLE_STATUSES, OPEN_STATUSES, formatCnic, formatPKR, requiredDocuments, useConfig } from '../../utils/workflow'

const departments = ['Computer Science', 'Software Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Business Administration', 'Economics', 'Mathematics', 'Physics', 'Chemistry', 'English', 'Law', 'Pharmacy', 'Medicine']
const steps = ['Request', 'Details', 'Documents', 'Fee', 'Review & submit']
const inputClass = 'mt-1.5 block w-full rounded-md border border-rule-strong px-3.5 py-3 text-sm font-normal focus:border-ink'
const documentHints = {
  degree: 'Colour scan of your original degree. Include the back if anything is printed there.',
  transcript: 'Every page of your final transcript or detailed marks certificate.',
  cnic_front: 'Clear colour scan of the front of your CNIC. A JPG or PNG lets the office compare it with your photograph.',
  cnic_back: 'Clear colour scan of the back of your CNIC.',
  photograph: 'Recent passport-size photograph on a plain background. JPG or PNG.',
  fee_challan: 'The bank-stamped applicant copy of your paid challan.',
  other: 'Anything else that supports your request, such as a name-change notification.'
}
const emptyForm = { requestType: 'degree', processing: 'normal', fatherName: '', cnic: '', dateOfBirth: '', programName: '', department: '', session: '', registrationNumber: '', rollNumber: '', graduationYear: '', cgpa: '' }
const toForm = (record, user) => ({
  ...emptyForm,
  fatherName: user?.fatherName || '', cnic: user?.cnic || '', registrationNumber: user?.studentId || '',
  ...Object.fromEntries(Object.keys(emptyForm).filter(key => record?.[key] != null).map(key => [key, String(record[key])])),
  dateOfBirth: record?.dateOfBirth ? record.dateOfBirth.slice(0, 10) : ''
})
const today = () => new Date().toISOString().slice(0, 10)

export default function NewApplication() {
  const { api, user, downloadDocument } = useAuth()
  const { config, error: configError } = useConfig()
  const [application, setApplication] = useState(null)
  const [form, setForm] = useState(() => toForm(null, user))
  const [payment, setPayment] = useState({ paidOn: '', bankReference: '' })
  const [declared, setDeclared] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [submitted, setSubmitted] = useState(null)
  const heading = useRef(null)
  const errorRef = useRef(null)
  const firstRender = useRef(true)

  const apply = useCallback(record => {
    setApplication(record)
    setForm(toForm(record, user))
    setPayment({ paidOn: record.fee?.paidOn ? record.fee.paidOn.slice(0, 10) : '', bankReference: record.fee?.bankReference || '' })
  }, [user])
  const load = useCallback(async () => {
    setLoading(true); setLoadFailed(false); setError('')
    try {
      const { data } = await api.get('/student/applications')
      const open = data.applications.find(item => OPEN_STATUSES.includes(item.status))
      if (open) {
        apply(open)
        const flagged = open.documents?.some(document => document.review?.status === 'flagged')
        setStep(open.status === 'objection' ? (flagged ? 2 : 1) : open.documents?.length ? 2 : 1)
      }
    } catch (err) { setLoadFailed(true); setError(apiError(err, 'Could not load your request. Please retry.')) }
    finally { setLoading(false) }
  }, [api, apply])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [error])
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    // A message belongs to the step that produced it.
    setNotice(''); setError('')
    heading.current?.focus({ preventScroll: true }); window.scrollTo(0, 0)
  }, [step, submitted])

  const run = async (label, action, fallback) => {
    setBusy(label); setError(''); setNotice('')
    try { return await action() } catch (err) { setError(apiError(err, fallback)); return null } finally { setBusy('') }
  }
  const update = name => event => setForm(previous => ({ ...previous, [name]: name === 'cnic' ? formatCnic(event.target.value) : event.target.value }))
  const saveDetails = async (event, nextStep) => {
    event?.preventDefault()
    const body = { ...form, graduationYear: form.graduationYear === '' ? '' : Number(form.graduationYear) }
    const saved = await run('details', async () => {
      const { data } = application ? await api.patch(`/student/applications/${application._id}`, body) : await api.post('/student/applications', body)
      apply(data.application)
      return data.application
    }, 'Could not save your details.')
    if (saved && nextStep != null) setStep(nextStep)
  }
  const chooseRequest = event => {
    event.preventDefault()
    if (application) saveDetails(null, 1)
    else setStep(1)
  }
  const uploadDocument = (kind) => async event => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setError('Choose a PDF, JPG, or PNG file of 10MB or less.'); return }
    if (kind === 'photograph' && file.type === 'application/pdf') { setError('Upload your photograph as a JPG or PNG image.'); return }
    const body = new FormData()
    body.append('kind', kind)
    body.append('document', file)
    const result = await run(`upload-${kind}`, async () => (await api.post(`/student/applications/${application._id}/documents`, body)).data, 'Upload failed. Your request is saved; try again.')
    if (result) { setApplication(result.application); setNotice(`${config.documentKinds[kind]} ${result.message === 'Document replaced.' ? 'replaced' : 'uploaded'}.`) }
  }
  const removeDocument = async () => {
    const result = await run('remove', async () => (await api.delete(`/student/applications/${application._id}/documents/${removeTarget._id}`)).data, 'Could not remove the document.')
    setRemoveTarget(null)
    if (result) { setApplication(result.application); setNotice('Document removed.') }
  }
  const savePayment = async event => {
    event.preventDefault()
    const result = await run('payment', async () => (await api.patch(`/student/applications/${application._id}/payment`, payment)).data, 'Could not save the payment details.')
    if (result) { apply(result.application); setNotice('Payment details saved.') }
  }
  const submit = async () => {
    const result = await run('submit', async () => (await api.post(`/student/applications/${application._id}/submit`, { declaration: true })).data, 'Could not submit. Your request is saved; please retry.')
    if (result) setSubmitted(result.application)
  }
  const withdraw = async () => {
    const result = await run('withdraw', async () => (await api.patch(`/student/applications/${application._id}/withdraw`)).data, 'Could not withdraw the request.')
    setConfirmWithdraw(false)
    if (result) { setApplication(null); setForm(toForm(null, user)); setPayment({ paidOn: '', bankReference: '' }); setStep(0); setNotice('Request withdrawn. You can start a new one.') }
  }
  const download = document => downloadDocument(document._id, document.originalName).catch(err => setError(apiError(err, 'Download failed.')))

  if (loading || (!config && !configError)) return <p role="status" className="py-16 text-center text-ink-faint">Loading your request…</p>
  if (configError) return <p role="alert" className="border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800">{configError}</p>
  if (application && !EDITABLE_STATUSES.includes(application.status) && !submitted) return <Navigate to={`/student/applications/${application._id}`} replace />

  const objection = application?.status === 'objection' ? application.objection : null
  const documents = application?.documents || []
  const byKind = kind => documents.filter(document => document.kind === kind)
  const required = requiredDocuments(config, form.requestType)
  const feeAmount = application?.fee?.amount ?? config.requestTypes[form.requestType]?.fees?.[form.processing]
  const problems = [
    !application?.fatherName || !application?.cnic || !application?.dateOfBirth ? ['Identity details are incomplete.', 1] : null,
    !application?.registrationNumber || !application?.session ? ['Registration number and session are required.', 1] : null,
    ...required.filter(kind => !byKind(kind).length).map(kind => [`${config.documentKinds[kind]} is missing.`, kind === 'fee_challan' ? 3 : 2]),
    !application?.fee?.paidOn || !application?.fee?.bankReference ? ['Enter your fee payment details.', 3] : null,
    ...(objection ? documents.filter(document => document.review?.status === 'flagged').map(document => [`Replace the flagged ${config.documentKinds[document.kind].toLowerCase()}.`, document.kind === 'fee_challan' ? 3 : 2]) : [])
  ].filter(Boolean)
  const reachable = index => index === 0 || (application && index <= 4)

  if (submitted) return <div className="max-w-3xl space-y-6">
    <p className="page-kicker">{submitted.applicationNumber}</p>
    <h1 ref={heading} tabIndex={-1} className="page-title focus:outline-none">{objection ? 'Corrections submitted.' : 'Request submitted.'}</h1>
    <p className="flex items-center gap-2 text-emerald-800"><CheckCircle className="h-5 w-5" />Your request is with the attestation cell for document scrutiny.</p>
    <p className="max-w-xl text-ink-soft">Next, the examination branch checks it against university records and the registrar approves it. If anything needs correcting you’ll be notified and can fix it here. Quote <span className="font-mono text-ink">{submitted.applicationNumber}</span> in any enquiry.</p>
    <div className="flex flex-wrap gap-3"><Link to={`/student/applications/${submitted._id}`} className="button-primary">Track your request<ArrowRight className="h-4 w-4" /></Link><Link to="/student/dashboard" className="button-secondary">Go to overview</Link></div>
  </div>

  return <div className="max-w-3xl space-y-8">
    <Link to="/student/dashboard" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to overview</Link>
    <header>
      <p className="page-kicker">{application ? <span className="font-mono tracking-normal normal-case">{application.applicationNumber}</span> : 'Attestation request'}</p>
      <h1 ref={heading} tabIndex={-1} className="page-title mt-3 focus:outline-none">{objection ? 'Correct your request.' : application ? 'Continue your request.' : 'Request attestation.'}</h1>
      {!objection && <p className="mt-3 text-ink-soft">Your progress is saved as you go. Nothing is sent to the university until you submit on the last step.</p>}
    </header>

    {objection && <section aria-labelledby="objection-title" className="border-l-2 border-amber-600 bg-amber-50 p-4 sm:p-5">
      <h2 id="objection-title" className="flex items-center gap-2 text-sm font-semibold text-amber-950"><AlertTriangle className="h-4 w-4" />Objection raised during {config.stages[objection.stage]?.label.toLowerCase() || 'review'}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-amber-950">{objection.reason}</p>
      <p className="mt-3 text-xs text-amber-900">Make the corrections below, then resubmit from the last step. Documents that were accepted stay accepted.</p>
    </section>}

    <ol className="progress-strip" style={{ '--steps': steps.length }} aria-label="Request steps">{steps.map((label, index) => {
      const state = index === step ? 'current' : index < step ? 'done' : 'next'
      return <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
        {reachable(index) && index !== step ? <button type="button" disabled={Boolean(busy)} onClick={() => { setError(''); setNotice(''); setStep(index) }} className="text-left hover:underline underline-offset-4"><span>0{index + 1}</span>{label}</button> : <><span>0{index + 1}</span>{label}</>}
      </li>
    })}</ol>

    <div ref={errorRef} aria-live="assertive">{error && <p role="alert" className="border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800">{error}</p>}</div>
    <div aria-live="polite">{notice && <p role="status" className="border-l-2 border-emerald-700 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}</div>
    {loadFailed && <button onClick={load} className="button-primary">Retry loading</button>}

    {step === 0 && <form onSubmit={chooseRequest} className="space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-ink">What do you need attested?</legend>
        <div className="mt-3 divide-y divide-rule border-y border-rule">{Object.entries(config.requestTypes).map(([key, type]) => <label key={key} className={`flex cursor-pointer items-start gap-3 py-4 ${form.requestType === key ? 'text-ink' : ''}`}>
          <input type="radio" name="requestType" value={key} checked={form.requestType === key} onChange={update('requestType')} disabled={application?.fee?.verified} className="mt-1 accent-navy" />
          <span className="flex-1"><span className="block font-medium text-ink">{type.label}</span><span className="block text-xs text-ink-faint">Requires {type.documents.map(kind => config.documentKinds[kind]).join(', ')}</span></span>
          <span className="font-mono text-xs text-ink-soft">from {formatPKR(type.fees.normal)}</span>
        </label>)}</div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Processing</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(config.processing).map(([key, option]) => <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${form.processing === key ? 'border-ink bg-white' : 'border-rule-strong'}`}>
          <input type="radio" name="processing" value={key} checked={form.processing === key} onChange={update('processing')} disabled={application?.fee?.verified} className="mt-1 accent-navy" />
          <span className="flex-1"><span className="block font-medium text-ink">{option.label}</span><span className="block text-xs text-ink-faint">About {option.days} working days after scrutiny</span></span>
          <span className="font-mono text-sm text-ink">{formatPKR(config.requestTypes[form.requestType].fees[key])}</span>
        </label>)}</div>
        {application?.fee?.verified && <p className="mt-3 text-xs text-ink-faint">Your fee has been verified, so the request type and processing can no longer change.</p>}
      </fieldset>
      <div className="flex justify-end"><button disabled={Boolean(busy)} className="button-primary">{busy === 'details' ? 'Saving…' : 'Continue'}<ArrowRight className="h-4 w-4" /></button></div>
    </form>}

    {step === 1 && <form onSubmit={event => saveDetails(event, 2)} className="space-y-10">
      <fieldset className="space-y-4">
        <legend className="rule-heading w-full"><span>Applicant</span></legend>
        <p className="text-sm text-ink-soft">Name: <span className="font-medium text-ink">{user.fullName}</span> <span className="text-ink-faint">(from your account)</span></p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">Father’s name<input required maxLength={100} autoComplete="off" value={form.fatherName} onChange={update('fatherName')} className={inputClass} /></label>
          <label className="field-label">CNIC<input required inputMode="numeric" placeholder="00000-0000000-0" pattern="\d{5}-\d{7}-\d" title="00000-0000000-0" value={form.cnic} onChange={update('cnic')} className={`${inputClass} font-mono`} /></label>
          <label className="field-label">Date of birth<input required type="date" max={today()} value={form.dateOfBirth} onChange={update('dateOfBirth')} className={inputClass} /></label>
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="rule-heading w-full"><span>Academic record</span></legend>
        <p className="text-sm text-ink-soft">Enter these exactly as they appear on your degree. The examination branch checks them against university records.</p>
        <label className="field-label">Degree title<input required maxLength={150} placeholder="e.g. BS Computer Science" value={form.programName} onChange={update('programName')} className={inputClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">Department<input required maxLength={100} list="departments" value={form.department} onChange={update('department')} className={inputClass} /><datalist id="departments">{departments.map(name => <option key={name} value={name} />)}</datalist></label>
          <label className="field-label">Session<input required maxLength={20} placeholder="e.g. 2018–2022" value={form.session} onChange={update('session')} className={inputClass} /></label>
          <label className="field-label">Registration no.<input required maxLength={40} value={form.registrationNumber} onChange={update('registrationNumber')} className={`${inputClass} font-mono`} /></label>
          <label className="field-label">Roll no. <span className="font-normal text-ink-faint">(optional)</span><input maxLength={40} value={form.rollNumber} onChange={update('rollNumber')} className={`${inputClass} font-mono`} /></label>
          <label className="field-label">Year of passing<input required type="number" min={1950} max={new Date().getFullYear()} value={form.graduationYear} onChange={update('graduationYear')} className={inputClass} /></label>
          <label className="field-label">CGPA <span className="font-normal text-ink-faint">(if on your transcript)</span><input type="number" min={0} max={4} step="0.01" value={form.cgpa} onChange={update('cgpa')} className={inputClass} /></label>
        </div>
      </fieldset>
      <div className="flex flex-wrap justify-between gap-3"><button type="button" onClick={() => setStep(0)} className="button-secondary"><ArrowLeft className="h-4 w-4" />Back</button><button disabled={Boolean(busy)} className="button-primary">{busy === 'details' ? 'Saving…' : application ? 'Save and continue' : 'Save draft and continue'}<ArrowRight className="h-4 w-4" /></button></div>
    </form>}

    {step === 2 && application && <div className="space-y-8">
      <p className="text-sm text-ink-soft">Upload a clear scan of each document. PDF, JPG, or PNG up to 10MB. Uploading again replaces the file.</p>
      <ul className="divide-y divide-rule border-y border-rule">{[...required.filter(kind => kind !== 'fee_challan'), 'other'].map(kind => {
        const files = byKind(kind)
        const optional = kind === 'other'
        return <li key={kind} className="py-5">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <div className="min-w-[14rem] flex-1">
              <p className="font-medium text-ink">{config.documentKinds[kind]}{optional && <span className="ml-2 text-xs font-normal text-ink-faint">Optional</span>}</p>
              <p className="mt-0.5 text-xs text-ink-faint">{documentHints[kind]}</p>
            </div>
            <label className={`button-secondary !min-h-10 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-navy ${busy ? 'pointer-events-none opacity-50' : ''}`}>
              <Upload className="h-4 w-4" />{busy === `upload-${kind}` ? 'Uploading…' : files.length && !optional ? 'Replace' : optional && files.length ? 'Add another' : 'Upload'}
              <input type="file" className="sr-only" accept={kind === 'photograph' ? '.jpg,.jpeg,.png' : '.pdf,.jpg,.jpeg,.png'} disabled={Boolean(busy)} onChange={uploadDocument(kind)} aria-label={`Upload ${config.documentKinds[kind]}`} />
            </label>
          </div>
          {files.map(file => <div key={file._id} className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-700" />
            <button onClick={() => download(file)} className="text-link min-w-0 break-all text-left">{file.originalName}</button>
            {objection && <ReviewMark review={file.review} />}
            {optional && <button disabled={Boolean(busy)} onClick={() => setRemoveTarget(file)} className="text-xs text-red-800 underline">Remove</button>}
            {file.review?.status === 'flagged' && file.review.note && <p className="basis-full border-l-2 border-amber-500 pl-3 text-amber-900">{file.review.note}</p>}
          </div>)}
        </li>
      })}</ul>
      <div className="flex flex-wrap justify-between gap-3"><button onClick={() => setStep(1)} className="button-secondary"><ArrowLeft className="h-4 w-4" />Back</button><button onClick={() => setStep(3)} className="button-primary">Continue to fee<ArrowRight className="h-4 w-4" /></button></div>
    </div>}

    {step === 3 && application && <div className="space-y-8">
      <section aria-labelledby="challan-title" className="certificate-sheet !p-6 sm:!p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="page-kicker">Fee challan</p><h2 id="challan-title" className="mt-2 font-mono text-lg text-ink">{application.fee?.challanNumber}</h2></div>
          <p className="display text-3xl">{formatPKR(feeAmount)}</p>
        </div>
        <dl className="meta-list mt-6">
          <dt>Pay to</dt><dd>{config.bank.accountTitle}</dd>
          <dt>Bank</dt><dd>{config.bank.name}</dd>
          <dt>Account</dt><dd className="font-mono text-[13px]">{config.bank.accountNumber}</dd>
          <dt>For</dt><dd>{config.requestTypes[application.requestType].label} · {config.processing[application.processing].label}</dd>
        </dl>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link to={`/student/applications/${application._id}/challan`} target="_blank" className="button-primary"><Printer className="h-4 w-4" />Print challan</Link>
          <p className="text-xs text-ink-faint">Pay at any {config.bank.name} branch within {config.bank.validDays} days, then enter the details below.</p>
        </div>
      </section>

      {application.fee?.verified ? <p className="flex items-center gap-2 border-l-2 border-emerald-700 bg-emerald-50 p-3 text-sm text-emerald-900"><CheckCircle className="h-4 w-4" />Your payment has been verified by the attestation cell.</p> : <>
        <form onSubmit={savePayment} className="space-y-4">
          <h2 className="rule-heading"><span>After paying</span></h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">Payment date<input required type="date" max={today()} value={payment.paidOn} onChange={event => setPayment({ ...payment, paidOn: event.target.value })} className={inputClass} /></label>
            <label className="field-label">Bank transaction / scroll no.<input required minLength={3} maxLength={40} value={payment.bankReference} onChange={event => setPayment({ ...payment, bankReference: event.target.value })} className={`${inputClass} font-mono`} /></label>
          </div>
          <button disabled={Boolean(busy)} className="button-secondary">{busy === 'payment' ? 'Saving…' : application.fee?.paidOn ? 'Update payment details' : 'Save payment details'}</button>
        </form>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-5">
          <div className="min-w-[14rem] flex-1"><p className="font-medium text-ink">{config.documentKinds.fee_challan}</p><p className="text-xs text-ink-faint">{documentHints.fee_challan}</p>
            {byKind('fee_challan').map(file => <p key={file._id} className="mt-2 flex flex-wrap items-center gap-2 text-sm"><CheckCircle className="h-4 w-4 text-emerald-700" /><button onClick={() => download(file)} className="text-link break-all text-left">{file.originalName}</button>{objection && <ReviewMark review={file.review} />}</p>)}
          </div>
          <label className={`button-secondary !min-h-10 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-navy ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="h-4 w-4" />{busy === 'upload-fee_challan' ? 'Uploading…' : byKind('fee_challan').length ? 'Replace' : 'Upload'}
            <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" disabled={Boolean(busy)} onChange={uploadDocument('fee_challan')} aria-label={`Upload ${config.documentKinds.fee_challan}`} />
          </label>
        </div>
      </>}
      <div className="flex flex-wrap justify-between gap-3"><button onClick={() => setStep(2)} className="button-secondary"><ArrowLeft className="h-4 w-4" />Back</button><button onClick={() => setStep(4)} className="button-primary">Review request<ArrowRight className="h-4 w-4" /></button></div>
    </div>}

    {step === 4 && application && <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="rule-heading"><span>{config.requestTypes[application.requestType].label}</span><span className="normal-case tracking-normal text-xs font-normal text-ink-faint">{config.processing[application.processing].label} · {formatPKR(application.fee?.amount)}</span></h2>
        <dl className="record-fields !mt-2">{[
          ['Name', user.fullName], ['Father’s name', application.fatherName], ['CNIC', application.cnic], ['Date of birth', application.dateOfBirth ? new Date(application.dateOfBirth).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
          ['Degree', application.programName], ['Department', application.department], ['Session', application.session], ['Registration no.', application.registrationNumber],
          ['Roll no.', application.rollNumber], ['Year of passing', application.graduationYear], ['CGPA', application.cgpa], ['Fee paid', application.fee?.paidOn ? `${new Date(application.fee.paidOn).toLocaleDateString('en-PK')} · ${application.fee.bankReference}` : null]
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? <span className="text-ink-faint">Not provided</span>}</dd></div>)}</dl>
        <button onClick={() => setStep(1)} className="text-link text-sm">Edit details</button>
      </section>
      <section className="space-y-2">
        <h2 className="rule-heading"><span>Documents</span><span className="normal-case tracking-normal text-xs font-normal text-ink-faint">{documents.length} attached</span></h2>
        <ul className="text-sm">{required.map(kind => <li key={kind} className="flex items-center gap-2 py-1.5">{byKind(kind).length ? <CheckCircle className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}<span className="text-ink">{config.documentKinds[kind]}</span></li>)}</ul>
      </section>
      {problems.length > 0 ? <section role="alert" className="border-l-2 border-amber-600 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-950">Before you can submit</h2>
        <ul className="mt-2 space-y-1 text-sm text-amber-950">{problems.map(([text, target]) => <li key={text}><button onClick={() => setStep(target)} className="text-left underline underline-offset-2">{text}</button></li>)}</ul>
      </section> : <label className="flex items-start gap-3 rounded-md border border-rule-strong bg-white p-4 text-sm text-ink">
        <input type="checkbox" checked={declared} onChange={event => setDeclared(event.target.checked)} className="mt-1 h-4 w-4 accent-navy" />
        <span>I declare that the information and documents I have provided are true and genuine. I understand that a false declaration will lead to rejection and may result in action under university rules.</span>
      </label>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setStep(3)} className="button-secondary"><ArrowLeft className="h-4 w-4" />Back</button>
        <button disabled={Boolean(busy) || problems.length > 0 || !declared} onClick={submit} className="button-primary">{busy === 'submit' ? 'Submitting…' : objection ? 'Resubmit request' : 'Submit request'}</button>
      </div>
    </div>}

    {application && <p className="border-t border-rule pt-5 text-sm text-ink-faint">Changed your mind? <button disabled={Boolean(busy)} onClick={() => setConfirmWithdraw(true)} className="text-red-800 underline">Withdraw this request</button></p>}

    {confirmWithdraw && <ConfirmationDialog title="Withdraw this request?" busy={busy === 'withdraw'} danger onClose={() => setConfirmWithdraw(false)} onConfirm={withdraw} confirmLabel="Withdraw request"><p>It will be closed and kept on your record as withdrawn. Fees already paid are handled by the registrar’s office under the university’s refund policy.</p></ConfirmationDialog>}
    {removeTarget && <ConfirmationDialog title="Remove document?" busy={busy === 'remove'} danger onClose={() => setRemoveTarget(null)} onConfirm={removeDocument} confirmLabel="Remove"><p className="break-words">Remove {removeTarget.originalName} from your request?</p></ConfirmationDialog>}
  </div>
}
