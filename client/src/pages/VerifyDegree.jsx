import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Search, Shield, AlertCircle, CheckCircle } from 'lucide-react'

const VerifyDegree = () => {
  const { hash: urlHash } = useParams()
  const [hash, setHash] = useState(urlHash || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sequence = useRef(0)
  const verify = useCallback(async value => {
    const current = ++sequence.current
    const trimmedHash = value.trim()
    setResult(null); setError('')
    if (!/^(0x)?[a-fA-F0-9]{64}$/.test(trimmedHash)) {
      setLoading(false); setError('Please enter a valid 64-character degree or transaction hash.'); return
    }
    setLoading(true)
    try {
      const { data } = await axios.get(`/api/verify/${trimmedHash}`)
      if (current === sequence.current) setResult(data)
    } catch (err) {
      if (current === sequence.current) {
        if (err.response?.status === 404) setResult(err.response.data)
        else setError(err.response?.data?.error || 'Verification failed. Please retry.')
      }
    } finally { if (current === sequence.current) setLoading(false) }
  }, [])
  useEffect(() => {
    setHash(urlHash || '')
    if (urlHash) verify(urlHash)
    else { setResult(null); setError(''); setLoading(false) }
    return () => { sequence.current += 1 }
  }, [urlHash, verify])
  const handleVerify = event => { event.preventDefault(); verify(hash) }

  return (
    <div className="max-w-2xl mx-auto py-2 sm:py-6">
      <div className="text-center mb-9">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl border border-[#d5e1f0] bg-[#edf3fb] flex items-center justify-center"><Shield className="h-8 w-8 text-[#345f94]" /></div><p className="page-kicker mb-3">Public credential lookup</p>
        <h1 className="page-title">Verify Degree</h1>
        <p className="text-sm leading-relaxed text-slate-500 mt-4 max-w-md mx-auto">Enter a degree or transaction hash to check its issued details and available blockchain proof.</p>
      </div>

      <form onSubmit={handleVerify} className="panel p-5 sm:p-6 mb-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            aria-label="Degree or transaction hash"
            placeholder="Enter 64-character degree hash..."
            className="min-w-0 flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-navy font-mono text-sm"
            value={hash}
            disabled={loading}
            onChange={(e) => { setHash(e.target.value); setResult(null); setError('') }}
            maxLength={66}
          />
          <button type="submit" disabled={loading}
            className="button-primary">
            <Search className="h-4 w-4" />
            <span>{loading ? 'Verifying...' : 'Verify'}</span>
          </button>
        </div>
        {error && <div className="flex items-center space-x-2 mt-3 text-red-600 text-sm"><AlertCircle className="h-4 w-4" /><span>{error}</span></div>}
      </form>

      {result?.verified && (
        <div role="status" className="panel p-6 sm:p-8 !border-t-4 !border-t-emerald-500">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <h2 className="text-base font-semibold text-emerald-800">{result.verificationLevel === 'blockchain' ? 'Verified on Amoy' : result.verificationLevel === 'local_blockchain' ? 'Verified on Local Test Blockchain' : 'Issued Details Verified Locally'}</h2>
          </div>

          <div className="space-y-3">
            {result.verificationLevel === 'local_blockchain' && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">Development certificate verified against this computer's test blockchain. This is not public Polygon Amoy proof, and the test chain resets when restarted.</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Student Name</p>
                <p className="font-medium text-sm text-navy mt-1.5 break-words">{result.degree.studentName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Student ID</p>
                <p className="font-medium text-sm text-navy mt-1.5 break-words">{result.degree.studentId}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Program</p>
                <p className="font-medium text-sm text-navy mt-1.5 break-words">{result.degree.program}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Department</p>
                <p className="font-medium text-sm text-navy mt-1.5 break-words">{result.degree.department}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Graduation Year</p>
                <p className="font-medium text-sm text-navy mt-1.5 break-words">{result.degree.graduationYear}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Issued Date</p>
                <p className="font-medium text-sm text-navy mt-1.5 break-words">{new Date(result.degree.issuedAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Blockchain Transaction</p>
              <p className="font-mono text-xs break-all text-navy">{result.degree.blockchainTx || 'Not stored on blockchain'}</p>
              {result.degree.polygonScanUrl && (
                <a
                  href={result.degree.polygonScanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View on Amoy Polygonscan
                </a>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Blockchain Verification</p>
              <p className="text-sm font-medium">
                {result.degree.blockchainVerification?.checked
                  ? result.degree.blockchainVerification.verified
                    ? `Verified on ${result.degree.blockchainNetworkLabel || 'Polygon Amoy'}`
                    : result.degree.blockchainVerification.error || `Not found on ${result.degree.blockchainNetworkLabel || 'Polygon Amoy'}`
                  : 'Not checked'}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Verification Hash</p>
              <p className="font-mono text-[11px] leading-relaxed break-all bg-slate-50 rounded-lg p-3 mt-2">{result.degree.hash}</p>
            </div>
          </div>
        </div>
      )}

      {result && !result.verified && (
        <div role="status" className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-red-700">Verification Incomplete</h2>
          <p className="text-red-600">{result.error || 'The degree could not be verified.'}</p>
        </div>
      )}
    </div>
  )
}

export default VerifyDegree
