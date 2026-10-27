import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, Upload, CheckCircle, XCircle, RefreshCw, Shield } from 'lucide-react'

const FaceVerification = ({ api, onVerified }) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const mounted = useRef(true)
  const requestRef = useRef(null)

  const [idPhoto, setIdPhoto] = useState(null)
  const [idPreview, setIdPreview] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      streamRef.current?.getTracks().forEach(track => track.stop())
      requestRef.current?.abort()
    }
  }, [])
  useEffect(() => () => { if (idPreview) URL.revokeObjectURL(idPreview) }, [idPreview])
  useEffect(() => {
    if (cameraOn && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOn])

  // Handle ID photo upload
  const handleIdUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WEBP image of 10MB or less.'); return
    }
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
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return }
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
    if (video.readyState < 2 || !video.videoWidth) { setError('Camera is still loading. Please try again.'); return }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob || !mounted.current) return
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
      requestRef.current = new AbortController()
      const fd = new FormData()
      fd.append('id_photo', idPhoto)
      fd.append('selfie', selfie)

      const { data } = await api.post('/face/verify', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
        signal: requestRef.current.signal,
      })

      setResult(data)

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
      <div className="flex items-start gap-3 border-y border-rule py-4">
        <Shield className="h-5 w-5 text-ink-soft flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-ink">Optional photo comparison</p>
          <p className="text-xs text-ink-faint mt-0.5">
            Compare your ID photo with a selfie. You can skip this check and submit supporting documents for review.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ID Photo */}
        <div>
          <p id="id-photo-label" className="field-label mb-2">1 · Your ID photo</p>
          {/* sr-only, not display:none, so the file input stays reachable by keyboard. */}
          <label className={`block border-2 border-dashed rounded-md overflow-hidden cursor-pointer bg-white transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy ${
            idPreview ? 'border-emerald-600' : 'border-rule-strong hover:border-ink'
          }`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={loading}
              aria-labelledby="id-photo-label"
              aria-describedby="id-photo-hint"
              className="sr-only"
              onChange={handleIdUpload}
            />
            {idPreview ? (
              <div className="relative">
                <img src={idPreview} alt="Your uploaded ID photo" className="w-full h-48 object-cover" />
                <div aria-hidden="true" className="absolute top-2 right-2 bg-emerald-700 text-white rounded-full p-1">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div id="id-photo-hint" className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-1">
                  Choose another file to change it
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-ink-faint">
                <Upload className="h-8 w-8" />
                <p className="text-sm font-medium text-ink">Upload your CNIC or passport</p>
                <p id="id-photo-hint" className="text-xs">JPG, PNG or WEBP · up to 10MB</p>
              </div>
            )}
          </label>
        </div>

        {/* Selfie */}
        <div>
          <p className="field-label mb-2">2 · A selfie</p>
          <div className={`border-2 border-dashed rounded-md overflow-hidden transition-all ${
            selfiePreview ? 'border-emerald-600' : cameraOn ? 'border-ink' : 'border-rule-strong'
          }`}>
            {selfiePreview ? (
              <div className="relative">
                <img src={selfiePreview} alt="Your selfie" className="w-full h-48 object-cover" />
                <div aria-hidden="true" className="absolute top-2 right-2 bg-emerald-700 text-white rounded-full p-1">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <button
                  onClick={retakeSelfie}
                  className="absolute bottom-2 right-2 flex min-h-9 items-center gap-1 bg-black/75 text-white text-xs px-3 rounded-md hover:bg-black/90 transition-colors"
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
                  aria-label="Camera preview"
                  className="w-full h-48 object-cover scale-x-[-1]"
                />
                <canvas ref={canvasRef} className="hidden" />
                <button
                  onClick={captureSelfie}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white text-ink font-medium text-sm px-5 min-h-10 rounded-md border border-rule-strong hover:border-ink transition-colors flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" /> Capture
                </button>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2">
                <Camera aria-hidden="true" className="h-8 w-8 text-ink-faint" />
                <button onClick={startCamera} className="button-secondary !min-h-10">
                  Open camera
                </button>
                <p className="text-xs text-ink-faint">Make sure your face is clearly visible</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="text-xs text-ink-soft">
        <p className="font-medium text-ink mb-1">For the best result</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Make sure your face is clearly visible in both photos</li>
          <li>Use good, even light, and avoid bright light behind you</li>
          <li>Look straight at the camera for your selfie</li>
          <li>Lay the ID flat, with nothing covering the photo</li>
        </ul>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 border-l-2 border-red-700 bg-red-50 text-red-800 p-3 text-sm">
          <XCircle aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {/* Result */}
      <div aria-live="polite">{loading && <p className="sr-only">Comparing your photos. This can take 20 to 30 seconds.</p>}</div>
      {result && (
        <div role="status" className={`flex items-center gap-3 p-4 border-l-2 ${
          result.match
            ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
            : 'bg-red-50 border-red-700 text-red-800'
        }`}>
          {result.match
            ? <CheckCircle className="h-5 w-5 flex-shrink-0" />
            : <XCircle className="h-5 w-5 flex-shrink-0" />
          }
          <div>
            <p className="font-medium text-sm">
              {result.match ? 'Photos match' : 'The photos don’t match'}
            </p>
            <p className="text-xs mt-0.5">
              {result.match
                ? `Similarity ${result.confidence}%. You can continue to your documents.`
                : 'Please retake your selfie or upload a clearer ID photo and try again.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Verify button */}
      {result?.match && <button onClick={() => onVerified(result.photoUrl)} className="button-primary w-full">Continue to documents</button>}
      {!result?.match && (
        <button
          onClick={handleVerify}
          disabled={loading || !idPhoto || !selfie}
          className="button-primary w-full"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Comparing photos… this can take 20–30 seconds
            </>
          ) : (
            <><Shield className="h-4 w-4" /> Compare photos</>
          )}
        </button>
      )}
    </div>
  )
}

export default FaceVerification
