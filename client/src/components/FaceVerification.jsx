import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, CheckCircle, XCircle, RefreshCw, Shield } from 'lucide-react'

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

  // Handle ID photo upload
  const handleIdUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIdPhoto(file)
    setIdPreview(URL.createObjectURL(file))
    setResult(null)
    setError('')
  }

  // Start webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOn(true)
      setError('')
    } catch (err) {
      setError('Could not access camera. Please allow camera permission and try again.')
    }
  }

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraOn(false)
  }

  // Capture selfie from webcam
  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const video = videoRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
      setSelfie(file)
      setSelfiePreview(canvas.toDataURL('image/jpeg'))
      setResult(null)
      setError('')
      stopCamera()
    }, 'image/jpeg', 0.9)
  }, [])

  // Retake selfie
  const retakeSelfie = () => {
    setSelfie(null)
    setSelfiePreview(null)
    setResult(null)
    startCamera()
  }

  // Submit for verification
  const handleVerify = async () => {
    if (!idPhoto || !selfie) {
      setError('Please provide both your ID photo and a selfie.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('id_photo', idPhoto)
      fd.append('selfie', selfie)

      const { data } = await api.post('/face/verify', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      })

      setResult(data)

      if (data.match) {
        // Wait 2 seconds to show success then move on
        setTimeout(() => onVerified(data.photoUrl), 2000)
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Verification failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-navy/5 rounded-xl border border-navy/10">
        <Shield className="h-5 w-5 text-navy flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-navy">Identity Verification Required</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Upload your CNIC or passport photo, then take a selfie. Our AI will verify they match.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ID Photo */}
        <div>
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Step 1 — Upload ID Photo
          </p>
          <label className={`block border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all ${
            idPreview ? 'border-green-400' : 'border-gray-200 hover:border-navy'
          }`}>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleIdUpload}
            />
            {idPreview ? (
              <div className="relative">
                <img src={idPreview} alt="ID" className="w-full h-48 object-cover" />
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-1">
                  Click to change
                </div>
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

        {/* Selfie */}
        <div>
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
            Step 2 — Take a Selfie
          </p>
          <div className={`border-2 border-dashed rounded-xl overflow-hidden transition-all ${
            selfiePreview ? 'border-green-400' : cameraOn ? 'border-navy' : 'border-gray-200'
          }`}>
            {selfiePreview ? (
              <div className="relative">
                <img src={selfiePreview} alt="Selfie" className="w-full h-48 object-cover" />
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <button
                  onClick={retakeSelfie}
                  className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors"
                >
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
                />
                <canvas ref={canvasRef} className="hidden" />
                <button
                  onClick={captureSelfie}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white text-navy font-medium text-sm px-6 py-2 rounded-full shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" /> Capture
                </button>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2">
                <Camera className="h-8 w-8 text-gray-300" />
                <button
                  onClick={startCamera}
                  className="bg-navy text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-navy-light transition-colors"
                >
                  Open Camera
                </button>
                <p className="text-xs text-gray-400">Make sure your face is clearly visible</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tips */}
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
          <XCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          result.match
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {result.match
            ? <CheckCircle className="h-5 w-5 flex-shrink-0" />
            : <XCircle className="h-5 w-5 flex-shrink-0" />
          }
          <div>
            <p className="font-medium text-sm">
              {result.match ? 'Identity Verified ✓' : 'Faces Do Not Match'}
            </p>
            <p className="text-xs mt-0.5 opacity-75">
              {result.match
                ? `Confidence: ${result.confidence}% — Proceeding to next step…`
                : 'Please retake your selfie or upload a clearer ID photo and try again.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Verify button */}
      {!result?.match && (
        <button
          onClick={handleVerify}
          disabled={loading || !idPhoto || !selfie}
          className="w-full h-11 bg-navy text-white rounded-lg hover:bg-navy-light transition-colors disabled:opacity-40 text-sm font-medium flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying identity… this may take 20–30 seconds
            </>
          ) : (
            <><Shield className="h-4 w-4" /> Verify Identity</>
          )}
        </button>
      )}
    </div>
  )
}

export default FaceVerification
