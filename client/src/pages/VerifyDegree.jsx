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
    if (!/^(0x)?[a-fA-F0-9]{64}$/.test(trimmedHash) && !/^ATT-\d{4}-\d{6}$/i.test(trimmedHash)) {
      setLoading(false); setError('Enter an attestation number such as ATT-2026-000123, or the 64-character hash printed on the certificate.'); return
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
      <h1 className="page-title mt-4">Verify an attestation.</h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">Enter the attestation number or verification hash printed on the certificate, or scan its QR code. You’ll see the particulars the university attested, so you can compare them with the document in front of you.</p>

      <form onSubmit={handleVerify} className="mt-10 border-t border-ink pt-5">
        <label htmlFor="verify-hash" className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink">Attestation number or hash</label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="verify-hash"
            type="text"
            placeholder="ATT-2026-000123 or 64-character hash"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-rule-strong px-3 py-2 font-mono text-sm focus:border-ink"
            value={hash}
            disabled={loading}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'verify-error' : undefined}
            onChange={(e) => { setHash(e.target.value); setResult(null); setError('') }}
            maxLength={66} autoCapitalize="characters" spellCheck={false}
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
            <p className="page-kicker text-center">{degree.requestType === 'transcript' ? 'Transcript' : degree.requestType === 'degree_transcript' ? 'Degree and transcript' : 'Degree'} attestation{degree.attestationNumber && <> · <span className="font-mono tracking-normal">{degree.attestationNumber}</span></>}</p>
            <h2 className="display mt-5 text-center text-3xl sm:text-4xl break-words">{degree.program}</h2>
            <p className="mt-2 text-center text-sm text-ink-soft break-words">{degree.department}{degree.university && ` · ${degree.university}`}</p>
            <div className="mx-auto my-8 h-px w-24 bg-rule-strong" />
            <dl className="meta-list mx-auto max-w-md">
              <dt>Name</dt><dd className="font-medium">{degree.studentName}</dd>
              {degree.fatherName && <><dt>Father’s name</dt><dd>{degree.fatherName}</dd></>}
              {degree.cnic && <><dt>CNIC</dt><dd className="font-mono text-[13px]">{degree.cnic}</dd></>}
              <dt>Registration no.</dt><dd className="font-mono text-[13px]">{degree.registrationNumber || degree.studentId}</dd>
              {degree.session && <><dt>Session</dt><dd>{degree.session}</dd></>}
              <dt>Year of passing</dt><dd>{degree.graduationYear}</dd>
              {degree.cgpa != null && <><dt>CGPA</dt><dd>{Number(degree.cgpa).toFixed(2)}</dd></>}
              <dt>Attested</dt><dd>{new Date(degree.issuedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
            </dl>
            {degree.pdfUrl && <p className="mt-8 text-center"><a href={degree.pdfUrl} target="_blank" rel="noreferrer" className="text-link text-sm">View the issued certificate (PDF)</a></p>}
          </article>

          <h2 className="rule-heading mt-12"><span>Proof</span></h2>
          <dl className="divide-y divide-rule text-sm">
            <div className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)]"><dt className="text-ink-faint">Blockchain check</dt><dd className="text-ink">{degree.blockchainVerification?.checked ? degree.blockchainVerification.verified ? `Record found on ${chain}` : degree.blockchainVerification.error || `Not found on ${chain}` : degree.blockchainTx ? degree.blockchainVerification?.error || 'Not checked' : 'Not used for this certificate. The university’s own record is the proof.'}</dd></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)]"><dt className="text-ink-faint">Transaction</dt><dd><span className="block font-mono text-xs break-all text-ink">{degree.blockchainTx || 'Not stored on blockchain'}</span>{degree.polygonScanUrl && <a href={degree.polygonScanUrl} target="_blank" rel="noreferrer" className="text-link mt-2 text-xs">View on Amoy Polygonscan</a>}</dd></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[12rem_minmax(0,1fr)]"><dt className="text-ink-faint">Verification hash</dt><dd className="font-mono text-xs break-all text-ink select-all">{degree.hash}</dd></div>
          </dl>
        </section>
      )}

      {result && !result.verified && (
        <section role="status" className="mt-14 border-t-2 border-red-700 pt-5">
          <h2 className="display text-3xl text-red-800">This certificate could not be verified.</h2>
          <p className="mt-3 max-w-xl text-ink-soft">{result.error || 'No attestation matches this number or hash.'} Check that it was copied in full, or ask the holder for their verification link.</p>
        </section>
      )}
    </div>
  )
}

export default VerifyDegree
