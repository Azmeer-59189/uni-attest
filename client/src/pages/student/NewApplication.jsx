import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import FaceVerification from '../../components/FaceVerification'
import ConfirmationDialog from '../../components/ConfirmationDialog'
import { apiError } from '../../utils/apiError'
import { Upload, ArrowLeft, CheckCircle, Clock, FileText, AlertCircle, Scan } from 'lucide-react'

const departments = ['Computer Science', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Business Administration', 'Mathematics', 'Physics', 'Medicine', 'Law', 'Other']
const labels = { draft: 'Draft', pending: 'Waiting for review', under_review: 'Under review', approved: 'Approved', issuing: 'Issuance in progress', issued: 'Issued', rejected: 'Rejected', withdrawn: 'Withdrawn' }
const activeStatuses = ['draft', 'pending', 'under_review', 'approved', 'issuing']

const OCRUploader = ({ onFieldsExtracted, api }) => {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleFile = (f) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    if (f.size > 10 * 1024 * 1024) { setError('Files must be 10MB or smaller.'); return }
    if (!allowed.includes(f.type)) { setError('Please upload a JPG, PNG, WEBP, or PDF file.'); return }
    setFile(f); setError(''); setResult(null)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const handleExtract = async () => {
    if (!file) return
    setLoading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('document', file)
      const { data } = await api.post('/ocr/extract', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(data.data)
    } catch (err) {
      setError(err.response?.data?.error || 'OCR failed. Please fill manually.')
    } finally {
      setLoading(false)
    }
  }

  const handleUse = () => {
    if (!result) return
    const f = result.fields
    onFieldsExtracted({
      ...(f.program ? { programName: f.program } : {}), ...(f.department ? { department: f.department } : {}),
      ...(f.graduationYear ? { graduationYear: f.graduationYear } : {}), ...(f.cgpa != null ? { cgpa: f.cgpa } : {}),
    })
    setResult(null); setFile(null)
  }

  return (
    <div className="border-y border-rule py-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Scan className="h-4 w-4 text-ink-soft" />
        <p className="text-sm font-medium text-ink">Auto-fill from your transcript</p>
        <span className="text-xs text-ink-faint ml-1">· optional</span>
      </div>
      <p className="text-xs text-ink-faint mb-4">Upload your degree or transcript to extract details automatically.</p>
      <div onClick={() => !loading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
        className={`border-2 border-dashed rounded-md p-5 text-center cursor-pointer transition-all mb-3 ${
          loading ? 'opacity-50 cursor-not-allowed' : dragOver ? 'border-navy bg-white' :
          file ? 'border-emerald-600 bg-white' : 'border-rule-strong hover:border-ink bg-white'}`}>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        {file ? (
          <div>
            <p className="text-ink text-sm font-medium break-words">{file.name}</p>
            <p className="text-ink-faint text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
          </div>
        ) : (
          <div>
            <p className="text-ink text-sm font-medium">Drop your degree or transcript here</p>
            <p className="text-ink-faint text-xs mt-0.5">JPG, PNG, PDF · Max 10MB</p>
          </div>
        )}
      </div>
      {error && <p className="text-red-700 text-xs mb-3">{error}</p>}
      {result && (
        <div className="bg-white border border-rule rounded-md p-4 mb-3">
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wider mb-3">Extracted · {result.processingTimeMs}ms</p>
          <div className="grid grid-cols-2 gap-2">
            {[['Program', result.fields.program], ['Department', result.fields.department],
              ['Grad Year', result.fields.graduationYear], ['CGPA', result.fields.cgpa]].map(([label, value]) => (
              <div key={label} className="border-l-2 border-rule pl-2">
                <p className="text-xs text-ink-faint">{label}</p>
                <p className={`text-sm font-medium truncate ${value ? 'text-ink' : 'text-ink-faint italic'}`}>{value || 'Not detected'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        {file && !result && (
          <button onClick={handleExtract} disabled={loading}
            className="button-primary flex-1 !min-h-10">
            {loading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Extracting…</> : <><Scan className="h-3.5 w-3.5" />Extract Fields</>}
          </button>
        )}
        {result && (
          <>
            <button onClick={handleUse} className="button-primary flex-1 !min-h-10">Use these fields</button>
            <button onClick={() => { setResult(null); setFile(null) }} className="button-secondary !min-h-10">Reset</button>
          </>
        )}
      </div>
    </div>
  )
}

const NewApplication = () => {
  const { api, downloadDocument } = useAuth()
  const [step, setStep] = useState(1)
  const [identityChecked, setIdentityChecked] = useState(false)
  const [application, setApplication] = useState(null)
  const [checking, setChecking] = useState(true)
  const [checkFailed, setCheckFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState([])
  const [removeTarget, setRemoveTarget] = useState(null)
  const [notice, setNotice] = useState('')
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const errorRef = useRef(null)
  const headingRef = useRef(null)
  const firstStep = useRef(true)
  const [form, setForm] = useState({ programName: '', department: '', graduationYear: new Date().getFullYear(), cgpa: '' })
  const editable = !application || application.status === 'draft' || (application.status === 'pending' && !application.submittedAt && !application.documents?.length)
  const applyRecord = record => {
    setApplication(record)
    setDocuments(record.documents || [])
    setForm({ programName: record.programName, department: record.department, graduationYear: record.graduationYear, cgpa: record.cgpa ?? '' })
  }
  const load = async () => {
    setChecking(true); setCheckFailed(false); setError('')
    try {
      const { data } = await api.get('/student/applications')
      const active = data.applications.find(item => activeStatuses.includes(item.status))
      if (active) { applyRecord(active); setStep(active.status === 'draft' ? (active.documents.length ? 3 : 1) : 3) }
    } catch (err) { setCheckFailed(true); setError(apiError(err, 'Could not load your application. Please retry.')) }
    finally { setChecking(false) }
  }
  useEffect(() => { load() }, [api])
  // Actions sit at the bottom of a long form; bring their error into view instead of only announcing it.
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [error])
  // The button that changed the step is gone, so put focus on the new step's heading.
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return }
    headingRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0)
  }, [step])

  const saveDetails = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const { data } = application
        ? await api.patch(`/student/applications/${application._id}`, form)
        : await api.post('/student/applications', form)
      setApplication(data.application); setStep(2)
    } catch (err) { setError(apiError(err, 'Could not save your draft.')) }
    finally { setBusy(false) }
  }
  const upload = async event => {
    const files = Array.from(event.target.files)
    event.target.value = ''
    if (!files.length) return
    if (files.length > 5 || files.some(file => file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))) {
      setError('Select up to five PDF, JPG, or PNG files, each 10MB or smaller.'); return
    }
    setBusy(true); setError('')
    try {
      const body = new FormData()
      files.forEach(file => body.append('documents', file))
      const { data } = await api.post(`/student/applications/${application._id}/documents`, body)
      setDocuments(previous => [...previous, ...data.documents])
    } catch (err) { setError(apiError(err, 'Upload failed. Your draft is saved; you can retry.')) }
    finally { setBusy(false) }
  }
  const replace = async (event, document) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError('Choose a PDF, JPG, or PNG file, 10MB or smaller.'); return
    }
    setBusy(true); setError(''); setNotice('')
    try {
      const body = new FormData(); body.append('document', file)
      const { data } = await api.put(`/student/applications/${application._id}/documents/${document._id}`, body)
      setDocuments(data.documents); setNotice('Document replaced. Your draft is saved.')
    } catch (err) { setError(apiError(err, 'Could not replace the document. Your original file is still attached.')) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const { data } = await api.delete(`/student/applications/${application._id}/documents/${removeTarget._id}`)
      setDocuments(data.documents); setRemoveTarget(null); setNotice('Document removed. Your draft is saved.')
    } catch (err) { setRemoveTarget(null); setError(apiError(err, 'Could not remove the document.')) }
    finally { setBusy(false) }
  }
  const submit = async () => {
    setBusy(true); setError('')
    try {
      const { data } = await api.post(`/student/applications/${application._id}/submit`)
      setApplication(data.application); setStep(4)
    } catch (err) { setError(apiError(err, 'Could not submit. Your draft is saved; please retry.')) }
    finally { setBusy(false) }
  }
  const withdraw = async () => {
    setBusy(true); setError('')
    try { await api.patch(`/student/applications/${application._id}/withdraw`); setConfirmWithdraw(false); setApplication(null); setDocuments([]); setNotice(''); setIdentityChecked(false); setForm({ programName: '', department: '', graduationYear: new Date().getFullYear(), cgpa: '' }); setStep(1) }
    catch (err) { setConfirmWithdraw(false); setError(apiError(err, 'Could not withdraw the application.')) }
    finally { setBusy(false) }
  }
  const download = doc => downloadDocument(doc._id, doc.originalName).catch(err => setError(apiError(err, 'Document download failed.')))
  if (checking) return <p role="status" className="text-center py-16 text-ink-faint">Loading your application...</p>
  return <div className="max-w-3xl space-y-5">
    <Link to="/student/dashboard" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"><ArrowLeft className="h-4 w-4" /> Back to overview</Link>
    <div ref={errorRef} aria-live="assertive">{error && <p role="alert" className="border-l-2 border-red-700 bg-red-50 p-4 text-sm text-red-800">{error}</p>}</div>
    <div aria-live="polite">{notice && <p role="status" className="border-l-2 border-emerald-700 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}</div>
    {checkFailed ? <button onClick={load} className="button-primary">Retry loading</button> :
    <div className="space-y-9">
      <div><p className="page-kicker mb-3">Degree attestation</p><h1 ref={headingRef} tabIndex={-1} className="page-title focus:outline-none">{step === 4 ? 'Application submitted' : !editable ? 'Your active application' : application ? 'Continue your application' : 'New degree application'}</h1>
        {editable && step !== 4 && <p className="text-sm text-ink-faint mt-2">Save your details, add supporting documents, then submit for review. Your saved draft can be resumed later.</p>}</div>
      {step === 4 ? <div className="space-y-4 border-t border-ink pt-6">
        <p className="flex items-center gap-2 text-emerald-800"><CheckCircle className="h-5 w-5" />Submitted for review</p>
        <p className="text-ink">Your application and {documents.length} supporting document{documents.length === 1 ? '' : 's'} are now waiting for the university’s review.</p>
        <p className="text-sm text-ink-soft">You can follow its progress and read any feedback on your overview.</p>
        <Link to="/student/dashboard" className="button-primary">Go to overview</Link>
      </div> : !editable ? <div className="space-y-4">
        <p className="flex items-center gap-2 border-y border-rule py-4 text-ink"><span aria-hidden="true" className="status-dot bg-blue-600" />Status: {labels[application.status]}</p>
        <dl className="grid grid-cols-2 gap-4 text-sm">{[['Program', application.programName], ['Department', application.department], ['Graduation year', application.graduationYear], ['CGPA', application.cgpa ?? 'Not provided']].map(([key, value]) => <div key={key}><dt className="text-ink-faint">{key}</dt><dd className="text-ink font-medium">{value}</dd></div>)}</dl>
        {application.adminComments && <p className="border-l-2 border-rule-strong pl-3 text-sm text-ink-soft"><strong className="font-medium text-ink">Reviewer’s note:</strong> {application.adminComments}</p>}
        <Link to={`/student/applications/${application._id}`} className="text-link text-sm">View details & history</Link>
        {documents.map(doc => <button key={doc._id} onClick={() => download(doc)} className="text-link block text-sm">Download {doc.originalName}</button>)}
        {application.status === 'pending' && <button onClick={() => setConfirmWithdraw(true)} disabled={busy} className="min-h-11 text-red-800 text-sm underline disabled:opacity-50">Withdraw application</button>}
      </div> : <>
        <ol className="progress-strip" aria-label="Application steps">{['Your details', 'Identity check', 'Review & submit'].map((label, index) => {
          const state = step === index + 1 ? 'current' : step > index + 1 && (index !== 1 || identityChecked) ? 'done' : 'next'
          return <li key={label} data-state={state} aria-current={state === 'current' ? 'step' : undefined}><span>0{index + 1}{index === 1 ? ' · optional' : ''}</span>{label}<span className="sr-only">{state === 'done' ? ' (complete)' : state === 'current' ? ' (current step)' : step > index + 1 ? ' (skipped)' : ''}</span></li>
        })}</ol>
        {step === 1 && <>
          <OCRUploader api={api} onFieldsExtracted={fields => setForm(previous => ({ ...previous, ...fields }))} />
          <form onSubmit={saveDetails} className="space-y-4">
            <label className="block text-sm">Program name<input required maxLength={150} value={form.programName} onChange={event => setForm({ ...form, programName: event.target.value })} className="mt-2 block border border-rule-strong rounded-md px-3.5 py-3 w-full text-sm focus:border-ink" /></label>
            <label className="block text-sm">Department<input required maxLength={100} list="departments" value={form.department} onChange={event => setForm({ ...form, department: event.target.value })} className="mt-2 block border border-rule-strong rounded-md px-3.5 py-3 w-full text-sm focus:border-ink" /><datalist id="departments">{departments.map(dept => <option key={dept} value={dept} />)}</datalist></label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">Graduation year<input required type="number" min={2000} max={2030} value={form.graduationYear} onChange={event => setForm({ ...form, graduationYear: event.target.value })} className="mt-2 block border border-rule-strong rounded-md px-3.5 py-3 w-full text-sm focus:border-ink" /></label>
              <label className="block text-sm">CGPA (optional)<input type="number" min={0} max={4} step="0.01" value={form.cgpa} onChange={event => setForm({ ...form, cgpa: event.target.value })} className="mt-2 block border border-rule-strong rounded-md px-3.5 py-3 w-full text-sm focus:border-ink" /></label>
            </div>
            <button disabled={busy} className="button-primary w-full">{busy ? 'Saving draft...' : 'Save draft & continue'}</button>
          </form>
        </>}
        {step === 2 && <>
          <FaceVerification api={api} onVerified={() => { setIdentityChecked(true); setError(''); setStep(3) }} />
          <div className="flex justify-between gap-3"><button onClick={() => setStep(1)} className="min-h-11 text-sm underline text-ink-soft hover:text-ink">Back to details</button><button onClick={() => { setError(''); setStep(3) }} className="button-secondary">Skip optional check</button></div>
        </>}
        {step === 3 && <div className="space-y-5">
          <div className="border-t border-ink pt-4 text-sm space-y-1"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink">Review your details</p><p className="display pt-2 text-2xl">{form.programName}</p><p className="text-ink-soft">{form.department} · Graduation {form.graduationYear}{form.cgpa !== '' ? ` · CGPA ${form.cgpa}` : ''}</p>{application.status === 'draft' && <button disabled={busy} onClick={() => setStep(1)} className="text-link mt-2">Edit details</button>}</div>
          <label className={`block border-2 border-dashed border-rule-strong bg-white rounded-md p-8 text-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy ${busy ? 'opacity-50' : 'cursor-pointer hover:border-ink'}`}>
            <Upload className="h-8 w-8 text-ink-faint mx-auto mb-2" /><span className="block text-sm font-medium text-ink">Add supporting documents</span><span className="block text-xs text-ink-faint mt-1">Degree certificate, transcript, or ID. PDF, JPG, PNG; up to five files per upload, 10MB each.</span>
            <input aria-label="Add supporting documents" disabled={busy} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={upload} className="sr-only" />
          </label>
          {busy && <p role="status" className="text-sm text-ink-faint">Saving, please wait...</p>}
          <ul className="divide-y divide-rule border-y border-rule-strong">{documents.map(doc => <li key={doc._id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><CheckCircle className="h-4 w-4 text-emerald-700 shrink-0" /><button onClick={() => download(doc)} className="text-link break-all text-left flex-1 min-w-0">{doc.originalName}</button>{application.status === 'draft' && <div className="flex gap-2 items-center"><label className={`button-secondary !px-3 !min-h-10 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-navy ${busy ? 'opacity-50' : ''}`}>Replace<input aria-label={`Replace ${doc.originalName}`} disabled={busy} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={event => replace(event, doc)} /></label><button aria-label={`Remove ${doc.originalName}`} disabled={busy} onClick={() => setRemoveTarget(doc)} className="min-h-10 px-2 text-red-700 underline disabled:opacity-50">Remove</button></div>}</li>)}</ul>
          <p className="text-xs text-ink-faint">At least one document is required. Submitting locks your details and documents for admin review.</p>
          <button disabled={busy || !documents.length} onClick={submit} className="button-primary w-full">{busy ? 'Please wait...' : 'Submit application for review'}</button>
          <button disabled={busy} onClick={() => setConfirmWithdraw(true)} className="min-h-11 text-red-800 text-sm underline disabled:opacity-50">Withdraw draft</button>
        </div>}
      </>}
    </div>}
    {confirmWithdraw && <ConfirmationDialog title={application?.status === 'draft' ? 'Withdraw this draft?' : 'Withdraw this application?'} busy={busy} danger onClose={() => setConfirmWithdraw(false)} onConfirm={withdraw} confirmLabel="Withdraw"><p>It will be closed and kept on your record as withdrawn. You can start a new application afterwards.</p></ConfirmationDialog>}
    {removeTarget && <ConfirmationDialog title="Remove document?" busy={busy} danger onClose={() => setRemoveTarget(null)} onConfirm={remove} confirmLabel="Remove document"><p className="break-words">Remove {removeTarget.originalName} from your draft? You can upload another file before submitting.</p>{documents.length === 1 && <p className="mt-3">You will need to add a supporting document before you can submit.</p>}</ConfirmationDialog>}
  </div>
}
export default NewApplication
