import { Link } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'

export const statusLabels = { draft: 'Draft', pending: 'Pending', under_review: 'Under review', approved: 'Approved', issuing: 'Issuing', issued: 'Issued', rejected: 'Rejected', withdrawn: 'Withdrawn' }
export const statusDots = { draft: 'bg-stone-400', pending: 'bg-amber-500', under_review: 'bg-blue-600', approved: 'bg-emerald-600', issuing: 'bg-amber-500', issued: 'bg-navy', rejected: 'bg-red-600', withdrawn: 'bg-stone-400' }
export const formatDate = value => value ? new Date(value).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export function StatusBadge({ status, label }) { return <span className="status-pill whitespace-nowrap"><span aria-hidden="true" className={`status-dot ${statusDots[status] || statusDots.draft}`} />{label || statusLabels[status] || status}</span> }

const eventLabels = { draft_created: 'Draft created', draft_updated: 'Details updated', documents_added: 'Documents added', document_removed: 'Document removed', document_replaced: 'Document replaced', submitted: 'Submitted for review', review_started: 'Review started', approved: 'Application approved', rejected: 'Application rejected', withdrawn: 'Application withdrawn', issuance_attempted: 'Certificate issuance started', issuance_failed: 'Issuance needs a retry', degree_issued: 'Certificate issued' }
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

export function RecordDocuments({ documents = [], onDownload, busy }) {
  return <section className="record-section"><h2>Supporting documents <span className="font-mono tracking-normal text-ink-faint">({documents.length})</span></h2><p className="record-caption">Open each file to check the evidence supplied by the student.</p>
    <ul className="mt-3 divide-y divide-rule">{documents.map(document => <li key={document._id} className="flex items-center gap-3 py-3 min-w-0"><FileText className="h-4 w-4 text-ink-faint shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-ink break-words">{document.originalName || 'Document'}</p><p className="font-mono text-[11px] text-ink-faint">{document.fileType === 'application/pdf' ? 'PDF' : 'Image'}{document.fileSize != null && ` · ${Math.max(1, Math.round(document.fileSize / 1024))} KB`}</p></div><button disabled={busy} className="button-secondary !min-h-10 !px-3" onClick={() => onDownload(document)} aria-label={`Download ${document.originalName || 'document'}`}><Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span></button></li>)}</ul>
    {!documents.length && <p className="mt-5 text-sm text-amber-800">No supporting documents are attached.</p>}
  </section>
}

export function CertificateLinks({ degree }) {
  if (!degree || degree.issuanceStatus !== 'issued') return null
  return <section className="record-section"><h2>Issued certificate</h2><p className="mt-3 font-mono text-xs text-ink-faint break-all select-all">{degree.hash}</p><div className="flex flex-wrap gap-3 mt-4"><Link to={`/verify/${degree.hash}`} className="button-secondary">Verify certificate</Link>{degree.pdfUrl && <a href={degree.pdfUrl} target="_blank" rel="noreferrer" className="button-primary"><Download className="h-4 w-4" />Certificate PDF</a>}</div></section>
}
