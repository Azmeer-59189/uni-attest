import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function ConfirmationDialog({ title, children, busy, onClose, onConfirm, confirmLabel = 'Confirm', disabled = false, danger = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  return <dialog ref={ref} aria-labelledby="confirmation-title" className="confirmation-dialog" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="flex items-start justify-between gap-4"><h2 id="confirmation-title" className="text-xl font-semibold">{title}</h2><button disabled={busy} onClick={onClose} aria-label="Close dialog" className="p-2 -mt-1 -mr-2"><X className="h-5 w-5" /></button></div>
    <div className="mt-4 text-sm text-slate-600">{children}</div>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><button disabled={busy} onClick={onClose} className="button-secondary">Cancel</button><button disabled={busy || disabled} onClick={onConfirm} className={`button-primary ${danger ? '!bg-red-700 hover:!bg-red-800' : ''}`}>{busy ? 'Please wait…' : confirmLabel}</button></div>
  </dialog>
}
