import { Link } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'

export const statusLabels = { draft: 'Draft', pending: 'Pending', under_review: 'Under review', approved: 'Approved', issuing: 'Issuing', issued: 'Issued', rejected: 'Rejected', withdrawn: 'Withdrawn' }
const colors = { draft: 'bg-slate-100 text-slate-700', pending: 'bg-amber-50 text-amber-800', under_review: 'bg-blue-50 text-blue-800', approved: 'bg-emerald-50 text-emerald-800', issuing: 'bg-amber-50 text-amber-800', issued: 'bg-purple-50 text-purple-800', rejected: 'bg-red-50 text-red-800', withdrawn: 'bg-slate-100 text-slate-700' }
export const formatDate = value => value ? new Date(value).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export function StatusBadge({ status }) { return <span className={`status-pill whitespace-nowrap ${colors[status] || colors.draft}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />{statusLabels[status] || status}</span> }

const eventLabels = { draft_created: 'Draft created', draft_updated: 'Details updated', documents_added: 'Documents added', document_removed: 'Document removed', document_replaced: 'Document replaced', submitted: 'Submitted for review', review_started: 'Review started', approved: 'Application approved', rejected: 'Application rejected', withdrawn: 'Application withdrawn', issuance_attempted: 'Certificate issuance started', issuance_failed: 'Issuance needs a retry', degree_issued: 'Certificate issued' }
export function ActivityTimeline({ history = [] }) {
  return <section className="record-section"><h2>Activity history</h2><p className="record-caption">Changes and decisions, with the person and time recorded.</p>
    {!history.length ? <p className="mt-5 text-sm text-slate-500">This application predates activity tracking. Its next action will start the history.</p> : <ol className="activity-timeline">{history.map((event, index) => <li key={event._id || index}>
      <p className="text-sm font-semibold text-navy">{eventLabels[event.action] || 'Application updated'}</p>
      <p className="mt-1 text-xs text-slate-600 break-words">{event.actorName || 'Account unavailable'} <span className="text-slate-500">· {event.actorRole?.replace('_', ' ')}</span></p>
      <time dateTime={event.at} className="block mt-1 text-xs text-slate-500">{new Date(event.at).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</time>
      {event.details && <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap break-words">{event.details}</p>}
    </li>)}</ol>}
  </section>
}

export function RecordDocuments({ documents = [], onDownload, busy }) {
  return <section className="record-section"><h2>Supporting documents <span className="text-sm text-slate-500 font-normal">({documents.length})</span></h2><p className="record-caption">Open each file to check the evidence supplied by the student.</p>
    <ul className="mt-5 divide-y divide-slate-200">{documents.map(document => <li key={document._id} className="flex items-center gap-3 py-3 min-w-0"><FileText className="h-5 w-5 text-slate-400 shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-navy break-words">{document.originalName || 'Document'}</p><p className="text-xs text-slate-500">{document.fileType === 'application/pdf' ? 'PDF' : 'Image'}{document.fileSize != null && ` · ${Math.max(1, Math.round(document.fileSize / 1024))} KB`}</p></div><button disabled={busy} className="button-secondary !px-3" onClick={() => onDownload(document)} aria-label={`Download ${document.originalName || 'document'}`}><Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span></button></li>)}</ul>
    {!documents.length && <p className="mt-5 text-sm text-amber-800">No supporting documents are attached.</p>}
  </section>
}

export function CertificateLinks({ degree }) {
  if (!degree || degree.issuanceStatus !== 'issued') return null
  return <section className="record-section"><h2>Issued certificate</h2><p className="mt-3 font-mono text-xs text-slate-500 break-all select-all">{degree.hash}</p><div className="flex flex-wrap gap-3 mt-4"><Link to={`/verify/${degree.hash}`} className="button-secondary">Verify certificate</Link>{degree.pdfUrl && <a href={degree.pdfUrl} target="_blank" rel="noreferrer" className="button-primary"><Download className="h-4 w-4" />Certificate PDF</a>}</div></section>
}
