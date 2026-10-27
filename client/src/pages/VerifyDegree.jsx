import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { Search, AlertCircle, CheckCircle } from 'lucide-react'

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

  const level = result?.verificationLevel
  const degree = result?.degree
  const chain = degree?.blockchainNetworkLabel || 'Polygon Amoy'
  return (
    <div className="max-w-3xl">
      <p className="page-kicker">Public credential lookup</p>
      <h1 className="page-title mt-4">Verify a degree.</h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">Enter the degree or transaction hash printed on a certificate, or open its QR link. You’ll see the details the university issued and any blockchain proof behind them.</p>

      <form onSubmit={handleVerify} className="mt-10 border-t border-ink pt-5">
        <label htmlFor="verify-hash" className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink">Degree or transaction hash</label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="verify-hash"
            type="text"
            placeholder="0x… (64 hexadecimal characters)"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-rule-strong px-3 py-2 font-mono text-sm focus:border-ink"
            value={hash}
            disabled={loading}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'verify-error' : undefined}
            onChange={(e) => { setHash(e.target.value); setResult(null); setError('') }}
            maxLength={66}
          />
          <button type="submit" disabled={loading} className="button-primary">
            <Search className="h-4 w-4" />
            <span>{loading ? 'Checking…' : 'Verify'}</span>
          </button>
        </div>
        {error && <p id="verify-error" className="mt-3 flex items-center gap-2 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
      </form>

      {result?.verified && (
        <section role="status" aria-label="Verification result" className="mt-14">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CheckCircle className="h-4 w-4" />{level === 'blockchain' ? `Verified on ${chain}` : level === 'local_blockchain' ? 'Verified on the local test blockchain' : 'Issued details verified by the university'}</p>
          {level === 'local_blockchain' && <p className="mt-3 border-l-2 border-amber-600 bg-amber-50 p-3 text-sm text-amber-900">Development certificate verified against this computer’s test blockchain. This is not public Polygon Amoy proof, and the test chain resets when restarted.</p>}
          <article className="certificate-sheet mt-5">
            <p className="page-kicker text-center">Certificate of attestation</p>
            <h2 className="display mt-5 text-center text-3xl sm:text-4xl break-words">{degree.program}</h2>
            <p className="mt-2 text-center text-sm text-ink-soft break-words">{degree.department}</p>
            <div className="mx-auto my-8 h-px w-24 bg-rule-strong" />
            <dl className="meta-list mx-auto max-w-md">
              <dt>Awarded to</dt><dd className="font-medium">{degree.studentName}</dd>
              <dt>Student ID</dt><dd className="font-mono text-[13px]">{degree.studentId}</dd>
              <dt>Graduated</dt><dd>{degree.graduationYear}</dd>
              <dt>Issued</dt><dd>{new Date(degree.issuedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
            </dl>
          </article>

          <h2 className="rule-heading mt-12"><span>Proof</span></h2>
          <dl className="divide-y divide-rule text-sm">
            <div className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)]"><dt className="text-ink-faint">Blockchain check</dt><dd className="text-ink">{degree.blockchainVerification?.checked ? degree.blockchainVerification.verified ? `Record found on ${chain}` : degree.blockchainVerification.error || `Not found on ${chain}` : 'Not checked'}</dd></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)]"><dt className="text-ink-faint">Transaction</dt><dd><span className="block font-mono text-xs break-all text-ink">{degree.blockchainTx || 'Not stored on blockchain'}</span>{degree.polygonScanUrl && <a href={degree.polygonScanUrl} target="_blank" rel="noreferrer" className="text-link mt-2 text-xs">View on Amoy Polygonscan</a>}</dd></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)]"><dt className="text-ink-faint">Verification hash</dt><dd className="font-mono text-xs break-all text-ink select-all">{degree.hash}</dd></div>
          </dl>
        </section>
      )}

      {result && !result.verified && (
        <section role="status" className="mt-14 border-t-2 border-red-700 pt-5">
          <h2 className="display text-3xl text-red-800">This certificate could not be verified.</h2>
          <p className="mt-3 max-w-xl text-ink-soft">{result.error || 'No issued degree matches this hash.'} Check that the hash was copied in full, or ask the holder for their verification link.</p>
        </section>
      )}
    </div>
  )
}

export default VerifyDegree
