import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Eye, FileText, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiError } from '../utils/apiError'

import { statusLabels } from '../utils/workflow'
export { statusLabels }
export const statusDots = { draft: 'bg-stone-400', scrutiny: 'bg-blue-600', objection: 'bg-amber-500', records_verification: 'bg-blue-600', registrar_approval: 'bg-emerald-600', issuing: 'bg-amber-500', issued: 'bg-navy', rejected: 'bg-red-600', withdrawn: 'bg-stone-400' }
export const formatDate = value => value ? new Date(value).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export function StatusBadge({ status, label }) { return <span className="status-pill whitespace-nowrap"><span aria-hidden="true" className={`status-dot ${statusDots[status] || statusDots.draft}`} />{label || statusLabels[status] || status}</span> }

const eventLabels = {
  draft_created: 'Request started', draft_updated: 'Details updated', details_updated: 'Details updated', documents_added: 'Documents added', document_added: 'Document uploaded', document_removed: 'Document removed', document_replaced: 'Document replaced',
  payment_recorded: 'Fee payment entered', submitted: 'Submitted for scrutiny', resubmitted: 'Resubmitted after objection', withdrawn: 'Request withdrawn',
  document_accepted: 'Document accepted', document_flagged: 'Document flagged', document_pending: 'Document review cleared', fee_verified: 'Fee payment verified', fee_unverified: 'Fee verification removed',
  ocr_checked: 'Document read with OCR', face_checked: 'Photograph compared with CNIC',
  objection_raised: 'Objection raised', forwarded_to_records_verification: 'Forwarded to records verification', forwarded_to_registrar_approval: 'Forwarded to the registrar',
  rejected: 'Request rejected', issuance_attempted: 'Registrar approved; issuing', issuance_failed: 'Issuance needs a retry', degree_issued: 'Attestation certificate issued',
  review_started: 'Review started', approved: 'Approved'
}
export function ActivityTimeline({ history = [] }) {
  return <section className="record-section"><h2>Activity history</h2><p className="record-caption">Changes and decisions, with the person and time recorded.</p>
    {!history.length ? <p className="mt-5 text-sm text-ink-faint">This application predates activity tracking. Its next action will start the history.</p> : <ol className="activity-timeline">{history.map((event, index) => <li key={event._id || index}>
      <p className="text-sm font-medium text-ink">{eventLabels[event.action] || 'Application updated'}</p>
      <p className="mt-0.5 text-xs text-ink-soft break-words">{event.actorName || 'Account unavailable'} <span className="text-ink-faint">· {event.actorRole?.replace('_', ' ')}</span></p>
      <time dateTime={event.at} className="block mt-0.5 font-mono text-[11px] text-ink-faint">{new Date(event.at).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</time>
      {event.details && <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap break-words">{event.details}</p>}
    </li>)}</ol>}
  </section>
}

const previewable = type => type === 'application/pdf' || /^image\/(png|jpe?g)$/.test(type || '')

// Shows a private document inside the page; the file is fetched with the session and released on close.
function DocumentPreview({ document: file, onClose, onDownload }) {
  const { documentUrl } = useAuth()
  const ref = useRef(null)
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const dialog = ref.current
    const previous = window.document.activeElement
    dialog.showModal()
    let active = true, created = null
    documentUrl(file._id, file.fileType)
      .then(value => { created = value; if (active) setUrl(value); else URL.revokeObjectURL(value) })
      .catch(err => { if (active) setError(apiError(err, 'This document could not be opened.')) })
    return () => { active = false; if (created) URL.revokeObjectURL(created); dialog.close(); previous?.focus() }
  }, [documentUrl, file._id, file.fileType])
  const name = file.originalName || 'Document'
  return <dialog ref={ref} aria-labelledby="preview-title" className="preview-dialog" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
      <h2 id="preview-title" className="flex-1 min-w-0 truncate !text-sm !font-medium !normal-case !tracking-normal text-ink">{name}</h2>
      <button className="button-secondary !min-h-9 !px-3" onClick={() => onDownload(file)}><Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span></button>
      <button onClick={onClose} aria-label="Close preview" className="p-2 -mr-2"><X className="h-5 w-5" /></button>
    </div>
    <div className="preview-body">
      {error ? <p role="alert" className="m-6 border-l-2 border-red-700 bg-red-50 p-3 text-sm text-red-800">{error}</p>
        : !url ? <p className="m-6 text-sm text-ink-faint">Loading document…</p>
        : file.fileType === 'application/pdf' ? <iframe src={url} title={name} className="h-full w-full border-0" />
        : <img src={url} alt={name} className="mx-auto max-h-full max-w-full object-contain" />}
    </div>
  </dialog>
}

const reviewStyles = { accepted: ['bg-emerald-600', 'Accepted'], flagged: ['bg-amber-500', 'Flagged'], pending: ['bg-stone-400', 'Not checked'] }
export function ReviewMark({ review }) {
  const [dot, label] = reviewStyles[review?.status || 'pending']
  return <span className="status-pill !text-[11px]"><span aria-hidden="true" className={`status-dot ${dot}`} />{label}</span>
}

// Documents in checklist order. `actions` renders extra controls per document, such as the scrutiny officer's accept and flag.
export function RecordDocuments({ documents = [], kinds = {}, onDownload, busy, actions, title = 'Documents', caption = 'Open each file to check the evidence supplied by the applicant.', showReview = true }) {
  const [preview, setPreview] = useState(null)
  const order = Object.keys(kinds)
  const sorted = [...documents].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
  return <section className="record-section"><h2>{title} <span className="font-mono tracking-normal text-ink-faint">({documents.length})</span></h2>{caption && <p className="record-caption">{caption}</p>}
    <ul className="mt-3 divide-y divide-rule">{sorted.map(document => {
      const label = kinds[document.kind] || 'Document'
      return <li key={document._id} className="py-3 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FileText className="h-4 w-4 text-ink-faint shrink-0" />
          <div className="flex-1 min-w-[12rem]"><p className="text-sm font-medium text-ink">{label}</p><p className="font-mono text-[11px] text-ink-faint break-all">{document.originalName || 'file'}{document.fileSize != null && ` · ${Math.max(1, Math.round(document.fileSize / 1024))} KB`}</p></div>
          {showReview && <ReviewMark review={document.review} />}
          <div className="flex gap-2">
            {previewable(document.fileType) && <button disabled={busy} className="button-secondary !min-h-10 !px-3" onClick={() => setPreview(document)} aria-label={`Open ${label}`}><Eye className="h-4 w-4" /><span className="hidden sm:inline">Open</span></button>}
            <button disabled={busy} className="button-secondary !min-h-10 !px-3" onClick={() => onDownload(document)} aria-label={`Download ${label}`}><Download className="h-4 w-4" /></button>
          </div>
        </div>
        {document.review?.status === 'flagged' && document.review.note && <p className="mt-2 ml-7 border-l-2 border-amber-500 pl-3 text-sm text-amber-900">{document.review.note}</p>}
        {actions && <div className="mt-2 ml-7">{actions(document)}</div>}
      </li>
    })}</ul>
    {!documents.length && <p className="mt-5 text-sm text-amber-800">No documents are attached.</p>}
    {preview && <DocumentPreview document={preview} onClose={() => setPreview(null)} onDownload={onDownload} />}
  </section>
}

export function CertificateLinks({ degree }) {
  if (!degree || degree.issuanceStatus !== 'issued') return null
  return <section className="record-section"><h2>Attestation certificate</h2>{degree.attestationNumber && <p className="mt-3 font-mono text-sm text-ink">{degree.attestationNumber}</p>}<p className="mt-1 font-mono text-xs text-ink-faint break-all select-all">{degree.hash}</p><div className="flex flex-wrap gap-3 mt-4"><Link to={`/verify/${degree.hash}`} className="button-secondary">Verify certificate</Link>{degree.pdfUrl && <a href={degree.pdfUrl} target="_blank" rel="noreferrer" className="button-primary"><Download className="h-4 w-4" />Download certificate</a>}</div></section>
}
