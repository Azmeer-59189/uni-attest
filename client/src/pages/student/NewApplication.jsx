import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Upload, ArrowLeft, CheckCircle, Clock, FileText,
  AlertCircle, X, Scan, Camera, RefreshCw, Shield, XCircle
} from 'lucide-react'

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
      programName: f.program || '', department: f.department || '',
      graduationYear: f.graduationYear || new Date().getFullYear(), cgpa: f.cgpa || '',
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
      <div onClick={() => !loading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all mb-3 ${
          loading ? 'opacity-50 cursor-not-allowed' : dragOver ? 'border-blue-500 bg-blue-100' :
          file ? 'border-green-400 bg-green-50' : 'border-blue-200 hover:border-blue-400 bg-white'}`}>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
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
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Extracted · {result.processingTimeMs}ms</p>
          <div className="grid grid-cols-2 gap-2">
            {[['Program', result.fields.program], ['Department', result.fields.department],
              ['Grad Year', result.fields.graduationYear], ['CGPA', result.fields.cgpa]].map(([label, value]) => (
              <div key={label} className={`p-2 rounded ${value ? 'bg-green-50' : 'bg-gray-50'}`}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-sm font-medium truncate ${value ? 'text-green-700' : 'text-gray-300'}`}>{value || 'Not detected'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        {file && !result && (
          <button onClick={handleExtract} disabled={loading}
            className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            {loading ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Extracting…</> : <><Scan className="h-3.5 w-3.5" />Extract Fields</>}
          </button>
        )}
        {result && (
          <>
            <button onClick={handleUse} className="flex-1 h-9 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors">Use These Fields</button>
            <button onClick={() => { setResult(null); setFile(null) }} className="h-9 px-4 border border-gray-200 text-gray-500 text-sm rounded-lg hover:border-gray-300 transition-colors">Reset</button>
          </>
        )}
      </div>
    </div>
  )
}

const FaceVerification = ({ api, onVerified }) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [idPhoto, setIdPhoto] = useState(null)
  const [idPreview, setIdPreview] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleIdUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIdPhoto(file); setIdPreview(URL.createObjectURL(file)); setResult(null); setError('')
  }

const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' }
    })
    streamRef.current = stream
    setCameraOn(true)
    setError('')
    // Wait for video element to be in DOM then set srcObject
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    }, 100)
  } catch {
    setError('Could not access camera. Please allow camera permission and try again.')
  }
}

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraOn(false)
  }

const captureSelfie = useCallback(() => {
  if (!videoRef.current || !canvasRef.current) return

  const doCapture = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
    ctx.restore()
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setSelfiePreview(dataUrl)
    fetch(dataUrl)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
        setSelfie(file)
        setResult(null)
        setError('')
        stopCamera()
      })
  }

  // Wait for video to be ready, retry up to 10 times
  let attempts = 0
  const tryCapture = () => {
    const video = videoRef.current
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      doCapture()
    } else if (attempts < 10) {
      attempts++
      setTimeout(tryCapture, 200)
    } else {
      setError('Camera not ready. Please try again.')
    }
  }
  tryCapture()
}, [])

  const retakeSelfie = () => {
    setSelfie(null); setSelfiePreview(null); setResult(null); startCamera()
  }

  const handleVerify = async () => {
    if (!idPhoto || !selfie) { setError('Please provide both your ID photo and a selfie.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const fd = new FormData()
      fd.append('id_photo', idPhoto)
      fd.append('selfie', selfie)
      const { data } = await api.post('/face/verify', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      })
      setResult(data)
      if (data.match) setTimeout(() => onVerified(data.photoUrl), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-navy/5 rounded-xl border border-navy/10">
        <Shield className="h-5 w-5 text-navy flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-navy">Identity Verification Required</p>
          <p className="text-xs text-gray-400 mt-0.5">Upload your CNIC or passport photo, then take a selfie. Our AI will verify they match.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Step 1 — Upload ID Photo</p>
          <label className={`block border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all ${idPreview ? 'border-green-400' : 'border-gray-200 hover:border-navy'}`}>
            <input type="file" accept="image/*" className="hidden" onChange={handleIdUpload} />
            {idPreview ? (
              <div className="relative">
                <img src={idPreview} alt="ID" className="w-full h-48 object-cover" />
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1"><CheckCircle className="h-4 w-4" /></div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">Click to change</div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Upload className="h-8 w-8" />
                <p className="text-sm font-medium">Upload CNIC / Passport</p>
                <p className="text-xs">JPG, PNG · Max 10MB</p>
              </div>
            )}
          </label>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Step 2 — Take a Selfie</p>
          <div className={`border-2 border-dashed rounded-xl overflow-hidden transition-all ${selfiePreview ? 'border-green-400' : cameraOn ? 'border-navy' : 'border-gray-200'}`}>
            {selfiePreview ? (
              <div className="relative">
                <img src={selfiePreview} alt="Selfie" className="w-full h-48 object-cover" />
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1"><CheckCircle className="h-4 w-4" /></div>
                <button onClick={retakeSelfie} className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors">
                  <RefreshCw className="h-3 w-3" /> Retake
                </button>
              </div>
            ) : cameraOn ? (
              <div className="relative">
                <video
  ref={videoRef}
  autoPlay
  playsInline
  muted
  className="w-full h-48 object-cover scale-x-[-1]"
  onLoadedMetadata={(e) => e.target.play()}
/>
                <canvas ref={canvasRef} className="hidden" />
                <button onClick={captureSelfie} className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white text-navy font-medium text-sm px-6 py-2 rounded-full shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <Camera className="h-4 w-4" /> Capture
                </button>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2">
                <Camera className="h-8 w-8 text-gray-300" />
                <button onClick={startCamera} className="bg-navy text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-navy-light transition-colors">Open Camera</button>
                <p className="text-xs text-gray-400">Make sure your face is clearly visible</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
        <p className="text-xs font-medium text-amber-700 mb-1">Tips for best results</p>
        <ul className="text-xs text-amber-600 space-y-0.5">
          <li>• Make sure your face is clearly visible in both photos</li>
          <li>• Good lighting — avoid backlighting or dark environments</li>
          <li>• Look directly at the camera for your selfie</li>
          <li>• ID photo should be flat and unobstructed</li>
        </ul>
      </div>
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg text-sm">
          <XCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}
      {result && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${result.match ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {result.match ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <XCircle className="h-5 w-5 flex-shrink-0" />}
          <div>
            <p className="font-medium text-sm">{result.match ? 'Identity Verified ✓' : 'Faces Do Not Match'}</p>
            <p className="text-xs mt-0.5 opacity-75">
              {result.match ? `Confidence: ${result.confidence}% — Proceeding to next step…` : 'Please retake your selfie or upload a clearer ID photo and try again.'}
            </p>
          </div>
        </div>
      )}
      {!result?.match && (
        <button onClick={handleVerify} disabled={loading || !idPhoto || !selfie}
          className="w-full h-11 bg-navy text-white rounded-lg hover:bg-navy-light transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2">
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying identity… this may take 20–30 seconds</>
            : <><Shield className="h-4 w-4" />Verify Identity</>}
        </button>
      )}
    </div>
  )
}

const NewApplication = () => {
  const [step, setStep] = useState(1)
  const [existingApp, setExistingApp] = useState(null)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
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
      const active = res.data.applications.find(a => ['pending', 'under_review', 'approved'].includes(a.status))
      if (active) setExistingApp(active)
    } catch (err) {
      console.error('Failed to check applications:', err)
    } finally {
      setCheckingExisting(false)
    }
  }

  const handleWithdraw = async () => {
    if (!window.confirm('Are you sure you want to withdraw this application? This cannot be undone.')) return
    setWithdrawing(true)
    try {
      await api.patch(`/student/applications/${existingApp._id}/withdraw`)
      setExistingApp(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to withdraw application.')
    } finally {
      setWithdrawing(false)
    }
  }

  const handleOCRFields = (fields) => setFormData(prev => ({ ...prev, ...fields }))

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
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

  const handleFaceVerified = () => setStep(3)

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

  if (checkingExisting) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy"></div>
    </div>
  )

  if (existingApp) {
    const cfg = STATUS_CONFIG[existingApp.status] || STATUS_CONFIG.pending
    const Icon = cfg.icon
    const canWithdraw = existingApp.status === 'pending'

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
            {canWithdraw && (
              <button onClick={handleWithdraw} disabled={withdrawing}
                className="flex-1 h-11 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {withdrawing ? 'Withdrawing…' : 'Withdraw & Reapply'}
              </button>
            )}
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

  const steps = ['Details', 'Verify ID', 'Documents', 'Done']

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate('/student/dashboard')} className="flex items-center text-gray-500 hover:text-navy mb-6 text-sm gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>
      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <h1 className="text-2xl font-serif font-medium text-navy mb-6">New Degree Application</h1>
        <div className="flex items-center mb-8 overflow-x-auto">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-navy text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`ml-2 text-sm whitespace-nowrap ${step === i + 1 ? 'text-navy font-medium' : 'text-gray-400'}`}>{label}</span>
              {i < steps.length - 1 && <div className={`w-6 h-px mx-3 flex-shrink-0 ${step > i + 1 ? 'bg-green-400' : 'bg-gray-200'}`}></div>}
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
            <OCRUploader api={api} onFieldsExtracted={handleOCRFields} />
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Program Name <span className="text-gold">*</span></label>
                <input type="text" required placeholder="e.g. Bachelor of Science in Computer Science"
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                  value={formData.programName} onChange={update('programName')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Department <span className="text-gold">*</span></label>
                  <select required className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm bg-white"
                    value={formData.department} onChange={update('department')}>
                    <option value="">Select</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Graduation Year <span className="text-gold">*</span></label>
                  <input type="number" required min="2000" max="2030"
                    className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                    value={formData.graduationYear} onChange={update('graduationYear')} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">CGPA <span className="text-gray-300">(optional)</span></label>
                <input type="number" step="0.01" min="0" max="4" placeholder="e.g. 3.75"
                  className="w-full h-11 px-4 border border-gray-200 rounded-lg focus:outline-none focus:border-navy text-sm"
                  value={formData.cgpa} onChange={update('cgpa')} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full h-11 bg-navy text-white rounded-lg hover:bg-navy-light transition-colors disabled:opacity-50 text-sm font-medium mt-2">
                {loading ? 'Submitting…' : 'Continue to Identity Verification →'}
              </button>
            </form>
          </>
        )}

        {step === 2 && <FaceVerification api={api} onVerified={handleFaceVerified} />}

        {step === 3 && (
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
              <button onClick={() => setStep(2)} className="flex-1 h-11 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-navy hover:text-navy transition-colors">Back</button>
              <button onClick={() => setStep(4)} disabled={uploadedFiles.length === 0}
                className="flex-1 h-11 bg-navy text-white rounded-lg hover:bg-navy-light transition-colors disabled:opacity-40 text-sm font-medium">
                {uploadedFiles.length === 0 ? 'Upload at least 1 file' : 'Done →'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-serif font-medium text-navy mb-2">Application Submitted!</h2>
            <p className="text-gray-400 text-sm mb-2">Your application and {uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''} have been submitted.</p>
            <p className="text-gray-400 text-sm mb-8">You'll be notified when the status changes. Expected review time: 5–7 working days.</p>
            <button onClick={() => navigate('/student/dashboard')} className="bg-navy text-white px-8 py-2.5 rounded-lg hover:bg-navy-light transition-colors text-sm font-medium">Go to Dashboard</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NewApplication
