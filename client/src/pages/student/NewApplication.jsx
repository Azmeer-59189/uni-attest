import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Upload, ArrowLeft, CheckCircle, Clock, FileText, AlertCircle, X, Scan } from 'lucide-react'

const STATUS_CONFIG = {
  pending:      { label: 'Pending Review',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Clock },
  under_review: { label: 'Under Review',     cls: 'bg-blue-50 text-blue-700 border-blue-200',       icon: FileText },
  approved:     { label: 'Approved',         cls: 'bg-green-50 text-green-700 border-green-200',    icon: CheckCircle },
  issued:       { label: 'Issued',           cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: CheckCircle },
  rejected:     { label: 'Rejected',         cls: 'bg-red-50 text-red-700 border-red-200',          icon: AlertCircle },
}

const departments = [
  'Computer Science', 'Electrical Engineering', 'Mechanical Engineering',
  'Civil Engineering', 'Business Administration', 'Mathematics',
  'Physics', 'Medicine', 'Law', 'Other'
]

const OCRUploader = ({ onFieldsExtracted, api }) => {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleFile = (f) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
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
      const { data } = await api.post('/ocr/extract', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
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
      programName:    f.program        || '',
      department:     f.department     || '',
      graduationYear: f.graduationYear || new Date().getFullYear(),
      cgpa:           f.cgpa           || '',
    })
    setResult(null); setFile(null)
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Scan className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-medium text-blue-800">Auto-fill with OCR</p>
        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full ml-1">Optional</span>
      </div>
      <p className="text-xs text-blue-500 mb-4">Upload your degree or transcript to extract details automatically.</p>

      <div
        onClick={() => !loading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all mb-3 ${
          loading ? 'opacity-50 cursor-not-allowed' :
          dragOver ? 'border-blue-500 bg-blue-100' :
          file    ? 'border-green-400 bg-green-50' :
          'border-blue-200 hover:border-blue-400 bg-white'
        }`}
      >
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden" onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        {file ? (
          <div>
            <p className="text-green-600 text-sm font-medium">{file.name}</p>
            <p className="text-gray-400 text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
          </div>
        ) : (
          <div>
            <p className="text-blue-600 text-sm font-medium">Drop your degree or transcript here</p>
            <p className="text-blue-400 text-xs mt-0.5">JPG, PNG, PDF · Max 10MB</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

      {result && (
        <div className="bg-white border border-blue-100 rounded-lg p-4 mb-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Extracted · {result.processingTimeMs}ms
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Program',    result.fields.program],
              ['Department', result.fields.department],
              ['Grad Year',  result.fields.graduationYear],
              ['CGPA',       result.fields.cgpa],
            ].map(([label, value]) => (
              <div key={label} className={`p-2 rounded ${value ? 'bg-green-50' : 'bg-gray-50'}`}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-sm font-medium truncate ${value ? 'text-green-700' : 'text-gray-300'}`}>
                  {value || 'Not detected'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {file && !result && (
          <button onClick={handleExtract} disabled={loading}
            className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            {loading
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Extracting…</>
              : <><Scan className="h-3.5 w-3.5" /> Extract Fields</>}
          </button>
        )}
        {result && (
          <>
            <button onClick={handleUse}
              className="flex-1 h-9 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">
              ✓ Use These Fields
            </button>
            <button onClick={() => { setResult(null); setFile(null) }}
              className="h-9 px-4 border border-gray-200 text-gray-500 text-sm rounded-lg hover:border-gray-300 transition-colors">
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const NewApplication = () => {
  const [step, setStep] = useState(1)
  const [existingApp, setExistingApp] = useState(null)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [formData, setFormData] = useState({
    programName: '', department: '', graduationYear: new Date().getFullYear(), cgpa: ''
  })
  const [applicationId, setApplicationId] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { api } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { checkExistingApplication() }, [])

  const checkExistingApplication = async () => {
    try {
      const res = await api.get('/student/applications')
      const active = res.data.applications.find(a =>
        ['pending', 'under_review', 'approved'].includes(a.status)
      )
      if (active) setExistingApp(active)
    } catch (err) {
      console.error('Failed to check applications:', err)
    } finally {
      setCheckingExisting(false)
    }
  }

  const handleOCRFields = (fields) => {
    setFormData(prev => ({ ...prev, ...fields }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await api.post('/student/applications', formData)
      setApplicationId(res.data.application._id)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setLoading(true); setError('')
    const fd = new FormData()
    files.forEach(f => fd.append('documents', f))
    try {
      await api.post(`/student/applications/${applicationId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUploadedFiles(prev => [...prev, ...files.map(f => f.name)])
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  const update = (field) => (e) => setFormData({ ...formData, [field]: e.target.value })

  if (checkingExisting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy"></div>
      </div>
    )
  }

  if (existingApp) {
    const cfg = STATUS_CONFIG[existingApp.status] || STATUS_CONFIG.pending
    const Icon = cfg.icon
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/student/dashboard')} className="flex items-center text-gray-500 hover:text-navy mb-6 text-sm gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
            <div className="w-10 h-10 bg-navy/5 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-navy" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-medium text-navy">Active Application</h1>
              <p className="text-gray-400 text-xs mt-0.5">You already have a submitted application</p>
            </div>
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-lg border mb-6 ${cfg.cls}`}>
            <Icon className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Status: {cfg.label}</p>
              <p className="text-xs mt-0.5 opacity-75">
                {existingApp.status === 'pending' && 'Your application is queued and will be reviewed soon.'}
                {existingApp.status === 'under_review' && 'The admin is currently reviewing your application.'}
                {existingApp.status === 'approved' && 'Your application is approved. Degree issuance is in progress.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              ['Program', existingApp.programName],
              ['Department', existingApp.department],
              ['Graduation Year', existingApp.graduationYear],
              ['CGPA', existingApp.cgpa || '—'],
              ['Submitted', new Date(existingApp.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })],
              ['Last Updated', new Date(existingApp.updatedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-medium text-navy">{value}</p>
              </div>
            ))}
          </div>
          {existingApp.adminComments && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1">Admin Note</p>
              <p className="text-sm text-blue-800">{existingApp.adminComments}</p>
            </div>
          )}
          {existingApp.rejectionReason && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
              <p className="text-xs font-medium text-red-700 uppercase tracking-wider mb-1">Rejection Reason</p>
              <p className="text-sm text-red-800">{existingApp.rejectionReason}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => navigate('/student/dashboard')}
              className="flex-1 h-11 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-navy hover:text-navy transition-colors">
              Back to Dashboard
            </button>
            {existingApp.status === 'rejected' && (
              <button onClick={() => setExistingApp(null)}
                className="flex-1 h-11 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy-light transition-colors">
                Submit New Application
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/student/dashboard')} className="flex items-center text-gray-500 hover:text-navy mb-6 text-sm gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <h1 className="text-2xl font-serif font-medium text-navy mb-6">New Degree Application</h1>

        <div className="flex items-center mb-8">
          {['Details', 'Documents', 'Done'].map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step > i + 1 ? 'bg-green-500 text-white' :
                step === i + 1 ? 'bg-navy text-white' :
                'bg-gray-100 text-gray-400'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`ml-2 text-sm ${step === i + 1 ? 'text-navy font-medium' : 'text-gray-400'}`}>{label}</span>
              {i < 2 && <div className={`w-12 h-px mx-4 ${step > i + 1 ? 'bg-green-400' : 'bg-gray-200'}`}></div>}
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            <X className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}

        {step === 1 && (
          <>
            {/* OCR uploader — ABOVE the form fields */}
            <OCRUploader api={api} onFieldsExtracted={handleOCRFields} />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">
                  Program Name <span className="text-gold">*</span>
                </label>
                <input type="text" required placeholder="e.g. Bachelor of Science in Computer Science"
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                  value={formData.programName} onChange={update('programName')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">
                    Department <span className="text-gold">*</span>
                  </label>
                  <select required
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm bg-white"
                    value={formData.department} onChange={update('department')}>
                    <option value="">Select</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">
                    Graduation Year <span className="text-gold">*</span>
                  </label>
                  <input type="number" required min="2000" max="2030"
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                    value={formData.graduationYear} onChange={update('graduationYear')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">
                  CGPA <span className="text-gray-300">(optional)</span>
                </label>
                <input type="number" step="0.01" min="0" max="4" placeholder="e.g. 3.75"
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                  value={formData.cgpa} onChange={update('cgpa')} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full h-11 bg-navy text-white rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50 text-sm font-medium mt-2">
                {loading ? 'Submitting…' : 'Continue to Documents →'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-navy transition-colors">
              <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 mb-1">Upload your documents</p>
              <p className="text-xs text-gray-400 mb-4">Degree certificate, transcript, CNIC · PDF, JPG, PNG · max 10MB each</p>
              <label className="cursor-pointer bg-navy text-white px-6 py-2.5 rounded-lg hover:bg-navy-light transition-colors text-sm font-medium inline-block">
                Select Files
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((name, i) => (
                  <div key={i} className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-green-700 truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)}
                className="flex-1 h-11 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-navy hover:text-navy transition-colors">
                Back
              </button>
              <button onClick={() => setStep(3)} disabled={uploadedFiles.length === 0}
                className="flex-1 h-11 bg-navy text-white rounded-lg hover:bg-navy-light transition-colors disabled:opacity-40 text-sm font-medium">
                {uploadedFiles.length === 0 ? 'Upload at least 1 file' : 'Done →'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-serif font-medium text-navy mb-2">Application Submitted!</h2>
            <p className="text-gray-400 text-sm mb-2">
              Your application and {uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''} have been submitted.
            </p>
            <p className="text-gray-400 text-sm mb-8">
              You'll be notified when the status changes. Expected review time: 5–7 working days.
            </p>
            <button onClick={() => navigate('/student/dashboard')}
              className="bg-navy text-white px-8 py-2.5 rounded-lg hover:bg-navy-light transition-colors text-sm font-medium">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NewApplication
